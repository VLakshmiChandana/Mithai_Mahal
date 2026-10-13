/**
 * Payment & Vendor Settlement Accounting Service
 * 
 * Core responsibilities:
 * 1. Payment Initiation:
 *    - Creates an auditable payment record for eligible orders (`payment_status = 'PENDING'`).
 *    - Generates unique payment reference `PAY-<ORDER_NUMBER>-<TIMESTAMP>`.
 *    - Uses payment provider abstraction to generate session/intent.
 * 2. Webhook Handling with Strict Idempotency:
 *    - Verifies raw request body signature using provider's HMAC-SHA256 scheme.
 *    - Enforces idempotency via `payment_webhooks` table on `(provider, event_id)`.
 *    - Replays are rejected safely without processing duplicate settlements or status changes.
 * 3. Strict Verification & Payment State Transitions:
 *    - Revalidates order matching, payment reference, currency (INR), and exact amount.
 *    - Never marks an order PAID merely because client reports success; requires valid webhook confirmation.
 * 4. Vendor Settlement Accounting:
 *    - Commission Rule: Configurable 10% on Order Subtotal (sweets amount).
 *    - Net Seller Payout = Subtotal (90%) + Packaging Charge (100% to seller).
 *    - Platform Retains = Platform Commission (10%) + Delivery Fee + GST.
 *    - Creates immutable settlement record inside an ACID transaction.
 * 5. Accountant Reporting:
 *    - Endpoints restricted to users holding `manage_financial_settlements` permission.
 */

const { pool } = require('../config/db');
const config = require('../config/env');
const { getPaymentProvider } = require('./payment.provider');
const { AppError, NotFoundError, ValidationError, ForbiddenError } = require('../middleware/errorHandler');

/**
 * Initiate payment for an eligible order
 * @param {string} orderId 
 * @param {string} userId - Authenticated customer ID
 */
async function initiatePayment(orderId, userId) {
  // 1. Fetch order and check eligibility
  const [orderRows] = await pool.query(
    `SELECT o.*, s.business_name
     FROM orders o
     JOIN sellers s ON o.seller_id = s.id
     WHERE o.id = ? AND o.user_id = ?
     LIMIT 1;`,
    [orderId, userId]
  );

  if (orderRows.length === 0) {
    throw new NotFoundError('Order not found or does not belong to your account.');
  }

  const order = orderRows[0];

  if (order.order_status === 'CANCELLED') {
    throw new ValidationError('Cannot initiate payment for a cancelled order.');
  }

  if (order.payment_status === 'PAID') {
    throw new ValidationError('Order has already been paid.');
  }

  // 2. Generate unique payment reference
  const paymentReference = `PAY-${order.order_number}-${Date.now()}`;
  const provider = getPaymentProvider();

  // 3. Request session from payment provider
  const session = await provider.createPaymentSession({
    paymentReference,
    orderNumber: order.order_number,
    amount: order.total_amount,
    currency: 'INR',
    customer: {
      name: order.recipient_name,
      phone: order.recipient_phone
    }
  });

  // 4. Persist payment attempt in database
  await pool.query(
    `INSERT INTO payments (
      id, order_id, payment_reference, provider, provider_payment_id,
      amount, currency, status, raw_response
    ) VALUES (
      UUID(), ?, ?, ?, ?,
      ?, 'INR', 'INITIATED', ?
    );`,
    [
      order.id,
      paymentReference,
      session.provider,
      session.providerPaymentId,
      order.total_amount,
      JSON.stringify(session)
    ]
  );

  const [createdPayment] = await pool.query(
    'SELECT * FROM payments WHERE payment_reference = ? LIMIT 1;',
    [paymentReference]
  );

  return {
    payment: createdPayment[0],
    checkout: session
  };
}

/**
 * Handle incoming payment webhook with strict signature verification and idempotency
 * 
 * @param {Buffer|string} rawBody - Raw body buffer/string
 * @param {string} signature - Header signature
 * @param {Object} event - Parsed JSON webhook payload
 */
async function processPaymentWebhook(rawBody, signature, event) {
  const provider = getPaymentProvider();

  // 1. Verify Webhook Signature using provider scheme
  const isValid = provider.verifyWebhookSignature(
    rawBody,
    signature,
    config.payment.webhookSecret
  );

  if (!isValid) {
    throw new AppError('Invalid webhook signature. Request rejected.', 401, 'INVALID_SIGNATURE');
  }

  const { eventId, eventType, data } = event;
  if (!eventId || !eventType || !data) {
    throw new ValidationError('Malformed webhook event payload.');
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // 2. Idempotency Check: Reject already processed event_id
    const [existingWebhook] = await connection.query(
      'SELECT id, processed_status FROM payment_webhooks WHERE provider = ? AND event_id = ? LIMIT 1;',
      [provider.name, eventId]
    );

    if (existingWebhook.length > 0) {
      // Event has already been processed idempotently
      await connection.rollback();
      return {
        idempotent: true,
        message: 'Webhook event already processed previously.',
        eventId
      };
    }

    // Record webhook event log
    await connection.query(
      `INSERT INTO payment_webhooks (
        id, provider, event_id, event_type, payload, processed_status
      ) VALUES (
        UUID(), ?, ?, ?, ?, 'PROCESSING'
      );`,
      [provider.name, eventId, eventType, JSON.stringify(event)]
    );

    // 3. Process Event based on type
    if (eventType === 'payment.captured' || eventType === 'payment.success') {
      const { paymentReference, providerPaymentId, amount, currency } = data;

      // Lock payment record for update by either internal payment reference or provider order id
      const [paymentRows] = await connection.query(
        'SELECT * FROM payments WHERE payment_reference = ? OR provider_payment_id = ? LIMIT 1 FOR UPDATE;',
        [paymentReference, providerPaymentId || paymentReference]
      );

      if (paymentRows.length === 0) {
        throw new NotFoundError(`Payment reference "${paymentReference}" not found.`);
      }

      const payment = paymentRows[0];

      // Lock order record for update
      const [orderRows] = await connection.query(
        'SELECT * FROM orders WHERE id = ? LIMIT 1 FOR UPDATE;',
        [payment.order_id]
      );

      const order = orderRows[0];

      // 4. Strict Amount and Currency Verification
      const paidAmount = Number(amount);
      const expectedAmount = Number(order.total_amount);

      if (paidAmount !== expectedAmount) {
        await connection.query(
          `UPDATE payments SET status = 'FAILED', raw_response = ? WHERE id = ?;`,
          [JSON.stringify({ error: 'Amount mismatch', expected: expectedAmount, received: paidAmount }), payment.id]
        );
        throw new ValidationError(`Payment amount mismatch: Expected ₹${expectedAmount}, received ₹${paidAmount}`);
      }

      if (currency !== 'INR') {
        throw new ValidationError(`Payment currency mismatch: Expected INR, received ${currency}`);
      }

      // Update payment record to SUCCESS
      await connection.query(
        `UPDATE payments 
         SET status = 'SUCCESS', provider_payment_id = ?, updated_at = CURRENT_TIMESTAMP 
         WHERE id = ?;`,
        [providerPaymentId || payment.provider_payment_id, payment.id]
      );

      // Update order to PAID and advance status to CONFIRMED if currently PLACED
      await connection.query(
        `UPDATE orders 
         SET payment_status = 'PAID',
             order_status = IF(order_status = 'PLACED', 'CONFIRMED', order_status),
             updated_at = CURRENT_TIMESTAMP 
         WHERE id = ?;`,
        [order.id]
      );

      // 5. Vendor Settlement Accounting Calculation
      // Check if settlement already exists for this order
      const [existingSettlement] = await connection.query(
        'SELECT id FROM vendor_settlements WHERE order_id = ? LIMIT 1;',
        [order.id]
      );

      if (existingSettlement.length === 0) {
        const commissionRate = config.payment.commissionRatePercent; // 10.00%
        const subtotal = Number(order.subtotal);
        const packaging = Number(order.packaging_charge);
        const deliveryFee = Number(order.delivery_fee);
        const gst = Number(order.gst_amount);

        // Platform Commission: 10% on Subtotal
        const platformCommission = Number(((subtotal * commissionRate) / 100).toFixed(2));

        // Net Seller Payout: 90% of Subtotal + 100% of Packaging Charge
        const netSellerPayout = Number((subtotal - platformCommission + packaging).toFixed(2));

        await connection.query(
          `INSERT INTO vendor_settlements (
            id, order_id, seller_id, payment_id, gross_order_amount,
            commission_rate, platform_commission, packaging_reimbursement,
            delivery_fee_retained, gst_retained, net_seller_payout,
            settlement_status
          ) VALUES (
            UUID(), ?, ?, ?, ?,
            ?, ?, ?,
            ?, ?, ?,
            'PENDING_PAYOUT'
          );`,
          [
            order.id,
            order.seller_id,
            payment.id,
            order.total_amount,
            commissionRate,
            platformCommission,
            packaging,
            deliveryFee,
            gst,
            netSellerPayout
          ]
        );
      }
    } else if (eventType === 'payment.failed') {
      const { paymentReference, reason } = data;
      await connection.query(
        `UPDATE payments SET status = 'FAILED', raw_response = ? WHERE payment_reference = ?;`,
        [JSON.stringify({ failureReason: reason || 'Payment failed by user or bank' }), paymentReference]
      );
      const [pay] = await connection.query('SELECT order_id FROM payments WHERE payment_reference = ?;', [paymentReference]);
      if (pay.length > 0) {
        await connection.query(`UPDATE orders SET payment_status = 'FAILED' WHERE id = ?;`, [pay[0].order_id]);
      }
    }

    // Mark webhook status as PROCESSED
    await connection.query(
      `UPDATE payment_webhooks SET processed_status = 'PROCESSED' WHERE provider = ? AND event_id = ?;`,
      [provider.name, eventId]
    );

    await connection.commit();

    return {
      success: true,
      eventId,
      eventType
    };
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

/**
 * Financial Reports for Accountants and Platform Admins
 */
async function getSettlementSummary({ startDate, endDate, sellerId = null }) {
  const conditions = [];
  const params = [];

  if (sellerId) {
    conditions.push('vs.seller_id = ?');
    params.push(sellerId);
  }

  if (startDate) {
    conditions.push('vs.created_at >= ?');
    params.push(startDate);
  }

  if (endDate) {
    conditions.push('vs.created_at <= ?');
    params.push(endDate);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Aggregate financial metrics
  const [totals] = await pool.query(
    `SELECT COUNT(*) as total_orders_settled,
            COALESCE(SUM(vs.gross_order_amount), 0) as total_gross_sales,
            COALESCE(SUM(vs.platform_commission), 0) as total_platform_commission,
            COALESCE(SUM(vs.net_seller_payout), 0) as total_vendor_payout,
            COALESCE(SUM(vs.delivery_fee_retained), 0) as total_delivery_fees,
            COALESCE(SUM(vs.gst_retained), 0) as total_gst_collected
     FROM vendor_settlements vs
     ${where};`,
    params
  );

  // List settlements with seller business names
  const [settlementRows] = await pool.query(
    `SELECT vs.*, s.business_name, o.order_number
     FROM vendor_settlements vs
     JOIN sellers s ON vs.seller_id = s.id
     JOIN orders o ON vs.order_id = o.id
     ${where}
     ORDER BY vs.created_at DESC
     LIMIT 50;`,
    params
  );

  return {
    metrics: {
      totalOrdersSettled: Number(totals[0].total_orders_settled),
      totalGrossSales: Number(totals[0].total_gross_sales).toFixed(2),
      totalPlatformCommission: Number(totals[0].total_platform_commission).toFixed(2),
      totalVendorPayout: Number(totals[0].total_vendor_payout).toFixed(2),
      totalDeliveryFees: Number(totals[0].total_delivery_fees).toFixed(2),
      totalGstCollected: Number(totals[0].total_gst_collected).toFixed(2)
    },
    settlements: settlementRows
  };
}

module.exports = {
  initiatePayment,
  processPaymentWebhook,
  getSettlementSummary
};
