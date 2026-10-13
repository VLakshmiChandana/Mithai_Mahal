/**
 * Payment & Settlement Controller
 */

const paymentService = require('../services/payment.service');
const { ForbiddenError, ValidationError } = require('../middleware/errorHandler');

/**
 * Customer: Initiate payment session for an order
 */
async function initiatePayment(req, res, next) {
  try {
    if (req.user.userType !== 'CUSTOMER') {
      throw new ForbiddenError('Only customers can initiate order payments.');
    }

    const result = await paymentService.initiatePayment(req.params.orderId, req.user.id);
    res.status(200).json({
      success: true,
      message: 'Payment session initiated successfully.',
      data: result
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Public Webhook Receiver: Secure payment gateway callback
 */
async function handleWebhook(req, res, next) {
  try {
    const signature = req.headers['x-payment-signature'] || req.headers['x-razorpay-signature'];
    if (!signature) {
      throw new ValidationError('Missing payment signature header.');
    }

    // req.rawBody preserved by express.json verify hook
    const rawBody = req.rawBody || JSON.stringify(req.body);

    const result = await paymentService.processPaymentWebhook(rawBody, signature, req.body);
    res.status(200).json({
      success: true,
      data: result
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Dev/Mock Customer: Simulate payment capture (enabled only when PAYMENT_PROVIDER === 'mock')
 */
async function mockCapture(req, res, next) {
  try {
    const config = require('../config/env');
    if (config.nodeEnv === 'production' || config.payment.provider !== 'mock') {
      throw new ForbiddenError('Mock payment capture is disabled in production environments.');
    }

    const { orderId } = req.params;
    const { pool } = require('../config/db');
    const crypto = require('crypto');

    // Verify order belongs to customer and fetch details
    const [orderRows] = await pool.query(
      'SELECT o.*, p.payment_reference, p.provider_payment_id FROM orders o LEFT JOIN payments p ON o.id = p.order_id WHERE o.id = ? AND o.user_id = ? ORDER BY p.created_at DESC LIMIT 1;',
      [orderId, req.user.id]
    );

    if (orderRows.length === 0) {
      throw new ValidationError('Order not found or does not belong to your account.');
    }

    const order = orderRows[0];
    const paymentRef = order.payment_reference || `PAY-${order.order_number}-${Date.now()}`;
    const providerPaymentId = order.provider_payment_id || `mock_pay_${Date.now()}_auto`;

    // Construct valid webhook payload
    const event = {
      eventId: `evt_mock_${Date.now()}`,
      eventType: 'payment.captured',
      data: {
        paymentReference: paymentRef,
        providerPaymentId,
        amount: Number(order.total_amount),
        currency: 'INR'
      }
    };

    const rawBody = JSON.stringify(event);
    const signature = crypto
      .createHmac('sha256', config.payment.webhookSecret)
      .update(Buffer.from(rawBody, 'utf8'))
      .digest('hex');

    const result = await paymentService.processPaymentWebhook(rawBody, signature, event);

    res.status(200).json({
      success: true,
      message: 'Payment simulated and captured successfully via mock gateway.',
      data: result
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Accountant / Admin: Vendor Settlements Report
 */
async function getSettlementReport(req, res, next) {
  try {
    const { startDate, endDate, sellerId } = req.query;
    const report = await paymentService.getSettlementSummary({ startDate, endDate, sellerId });
    res.status(200).json({
      success: true,
      data: report
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Customer: Verify Razorpay Standard Checkout payment response signature server-side
 */
async function verifyPaymentSignature(req, res, next) {
  try {
    const { orderId } = req.params;
    const razorpayOrderId = req.body.razorpayOrderId || req.body.razorpay_order_id;
    const razorpayPaymentId = req.body.razorpayPaymentId || req.body.razorpay_payment_id;
    const razorpaySignature = req.body.razorpaySignature || req.body.razorpay_signature;
    const { pool } = require('../config/db');
    const config = require('../config/env');
    const { RazorpayProvider, MockPaymentProvider } = require('../services/payment.provider');

    // 1. Fetch order and check customer ownership
    const [orderRows] = await pool.query(
      'SELECT o.*, p.id as payment_id, p.payment_reference FROM orders o JOIN payments p ON o.id = p.order_id WHERE o.id = ? AND o.user_id = ? ORDER BY p.created_at DESC LIMIT 1;',
      [orderId, req.user.id]
    );

    if (orderRows.length === 0) {
      throw new ValidationError('Order not found or does not belong to your account.');
    }

    const order = orderRows[0];

    // If order already paid, return success idempotently
    if (order.payment_status === 'PAID') {
      return res.status(200).json({
        success: true,
        message: 'Order has already been verified and paid.',
        data: { orderId: order.id, paymentStatus: 'PAID' }
      });
    }

    // 2. Cryptographic signature verification using secret strictly from backend config
    const provider = new RazorpayProvider();
    const isValid = provider.verifyPaymentSignature(razorpayOrderId, razorpayPaymentId, razorpaySignature);

    if (!isValid) {
      throw new ValidationError('Invalid Razorpay payment signature. Verification failed.');
    }

    // 3. Signature is cryptographically authentic: execute atomic status update and settlement
    const event = {
      eventId: `rzp_verified_${razorpayPaymentId}`,
      eventType: 'payment.captured',
      data: {
        paymentReference: order.payment_reference,
        providerPaymentId: razorpayPaymentId,
        amount: Number(order.total_amount),
        currency: 'INR'
      }
    };

    const rawBody = JSON.stringify(event);
    const internalSignature = require('crypto')
      .createHmac('sha256', config.payment.webhookSecret)
      .update(Buffer.from(rawBody, 'utf8'))
      .digest('hex');

    const result = await paymentService.processPaymentWebhook(rawBody, internalSignature, event);

    res.status(200).json({
      success: true,
      message: 'Payment signature verified successfully. Order confirmed.',
      data: result
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Development-only: Generate HMAC-SHA256 signature for test simulator
 * Disabled in production environments
 */
async function generateTestSignature(req, res, next) {
  try {
    const config = require('../config/env');
    if (config.nodeEnv === 'production') {
      throw new ForbiddenError('Test signature generator is disabled in production environments.');
    }

    const razorpayOrderId = req.body.razorpayOrderId || req.body.razorpay_order_id;
    const razorpayPaymentId = req.body.razorpayPaymentId || req.body.razorpay_payment_id;

    if (!razorpayOrderId || !razorpayPaymentId) {
      throw new ValidationError('razorpayOrderId and razorpayPaymentId are required.');
    }

    const crypto = require('crypto');
    const signature = crypto
      .createHmac('sha256', config.payment.razorpayKeySecret)
      .update(`${razorpayOrderId}|${razorpayPaymentId}`)
      .digest('hex');

    res.status(200).json({
      success: true,
      data: {
        razorpayOrderId,
        razorpayPaymentId,
        razorpaySignature: signature
      }
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  initiatePayment,
  handleWebhook,
  verifyPaymentSignature,
  mockCapture,
  generateTestSignature,
  getSettlementReport
};
