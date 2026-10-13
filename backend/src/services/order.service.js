/**
 * Order Placement & Management Service
 * 
 * Core responsibilities:
 * 1. Atomic Order Placement:
 *    - Re-validates customer's shopping cart, delivery address, product availability, and shop status.
 *    - Consistent ascending UUID sorting of products before `SELECT ... FOR UPDATE` locking to prevent database deadlocks.
 *    - Validates live stock quantities. Fails closed with 400 Bad Request if any item is out of stock.
 *    - Atomically decrements `products.stock_quantity`.
 *    - Auto-adjusts `availability_status` to 'OUT_OF_STOCK' if remaining stock hits 0.
 *    - Generates unique order number: `SWT-<TIMESTAMP>-<RANDOM>`.
 *    - Captures immutable delivery address snapshot and pricing snapshot.
 *    - Clears customer's shopping cart upon successful creation.
 *    - Executes all operations inside an ACID database transaction.
 * 
 * 2. Allowed Status Transitions:
 *    - PLACED -> CONFIRMED, CANCELLED
 *    - CONFIRMED -> PREPARING, CANCELLED
 *    - PREPARING -> OUT_FOR_DELIVERY, CANCELLED
 *    - OUT_FOR_DELIVERY -> DELIVERED, CANCELLED
 *    - DELIVERED -> Terminal state (no transitions)
 *    - CANCELLED -> Terminal state (no transitions)
 * 
 * 3. Inventory Restoration on Cancellation:
 *    - Exactly-once inventory restoration: executed within transaction when order moves to CANCELLED.
 *    - Only allowed for eligible orders prior to DELIVERED.
 */

const { pool } = require('../config/db');
const { AppError, NotFoundError, ValidationError, ForbiddenError } = require('../middleware/errorHandler');

// Allowed status transitions map
const ALLOWED_TRANSITIONS = Object.freeze({
  PLACED: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['PREPARING', 'CANCELLED'],
  PREPARING: ['OUT_FOR_DELIVERY', 'CANCELLED'],
  OUT_FOR_DELIVERY: ['DELIVERED', 'CANCELLED'],
  DELIVERED: [], // Terminal
  CANCELLED: []  // Terminal
});

/**
 * Generate a unique, human-readable order number
 * Format: SWT-YYYYMMDD-<6 RANDOM CHARS>
 */
function generateOrderNumber() {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const randomChars = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `SWT-${dateStr}-${randomChars}`;
}

/**
 * Place order from current customer shopping cart
 * 
 * @param {string} userId - Authenticated customer ID
 * @param {Object} options - { deliveryAddressId, notes }
 */
async function placeOrder(userId, { deliveryAddressId }) {
  if (!deliveryAddressId) {
    throw new ValidationError('deliveryAddressId is required to place an order.');
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // 1. Verify delivery address ownership and active status
    const [addressRows] = await connection.query(
      `SELECT * FROM user_addresses WHERE id = ? AND user_id = ? LIMIT 1;`,
      [deliveryAddressId, userId]
    );

    if (addressRows.length === 0) {
      throw new ValidationError('Selected delivery address does not exist or does not belong to you.');
    }
    const address = addressRows[0];

    // 2. Fetch customer's active shopping cart
    const [cartRows] = await connection.query(
      `SELECT c.id as cart_id, c.seller_id, s.business_name, s.account_status, s.is_active as seller_active, s.verification_status
       FROM shopping_carts c
       JOIN sellers s ON c.seller_id = s.id
       WHERE c.user_id = ?
       LIMIT 1;`,
      [userId]
    );

    if (cartRows.length === 0) {
      throw new ValidationError('Your shopping cart is empty. Add items before placing an order.');
    }
    const cart = cartRows[0];

    if (!cart.seller_active || cart.account_status !== 'ACTIVE' || cart.verification_status !== 'APPROVED') {
      throw new ValidationError('The sweet shop is currently awaiting verification or inactive and cannot accept orders.');
    }

    // 3. Fetch items in cart
    const [cartItems] = await connection.query(
      `SELECT product_id, quantity FROM cart_items WHERE cart_id = ?;`,
      [cart.cart_id]
    );

    if (cartItems.length === 0) {
      throw new ValidationError('Your shopping cart has no items.');
    }

    // 4. Deadlock-free locking: Sort product IDs in consistent lexicographical order
    const productIds = cartItems.map(item => item.product_id).sort();

    // Lock all products using SELECT ... FOR UPDATE
    const [lockedProducts] = await connection.query(
      `SELECT id, name, price, stock_quantity, availability_status, is_active
       FROM products
       WHERE id IN (?)
       ORDER BY id ASC
       FOR UPDATE;`,
      [productIds]
    );

    const productMap = new Map();
    lockedProducts.forEach(p => productMap.set(p.id, p));

    // 5. Validate stock and recompute prices
    let subtotal = 0;
    const orderItemsToInsert = [];

    for (const item of cartItems) {
      const prod = productMap.get(item.product_id);

      if (!prod || !prod.is_active || prod.availability_status !== 'AVAILABLE') {
        const name = prod ? prod.name : 'A requested product';
        throw new ValidationError(`"${name}" is no longer available.`);
      }

      if (prod.stock_quantity < item.quantity) {
        throw new ValidationError(
          `Insufficient stock for "${prod.name}". Requested: ${item.quantity}, Available: ${prod.stock_quantity}.`
        );
      }

      const unitPrice = Number(prod.price);
      const itemTotal = Number((unitPrice * item.quantity).toFixed(2));
      subtotal += itemTotal;

      orderItemsToInsert.push({
        productId: prod.id,
        productName: prod.name,
        unitPrice: unitPrice.toFixed(2),
        quantity: item.quantity,
        itemTotal: itemTotal.toFixed(2)
      });
    }

    // 6. Calculate fee structure
    const packagingCharge = 15.00;
    const deliveryFee = subtotal > 500 ? 0.00 : 40.00;
    const gstAmount = Number((subtotal * 0.05).toFixed(2));
    const totalAmount = Number((subtotal + packagingCharge + deliveryFee + gstAmount).toFixed(2));

    // 7. Atomic Inventory Deduction
    for (const item of cartItems) {
      const prod = productMap.get(item.product_id);
      const newStock = prod.stock_quantity - item.quantity;
      const newStatus = newStock === 0 ? 'OUT_OF_STOCK' : 'AVAILABLE';

      await connection.query(
        `UPDATE products 
         SET stock_quantity = ?, availability_status = ?, updated_at = CURRENT_TIMESTAMP 
         WHERE id = ?;`,
        [newStock, newStatus, item.product_id]
      );
    }

    // 8. Generate Order
    const orderNumber = generateOrderNumber();
    const recipientPhone = address.recipient_phone || '9999999999';
    const recipientName = address.recipient_name || 'Customer';

    const [orderInsert] = await connection.query(
      `INSERT INTO orders (
        id, order_number, user_id, seller_id, delivery_address_id,
        recipient_name, recipient_phone, delivery_address_line_1, delivery_address_line_2,
        delivery_city, delivery_state, delivery_pincode,
        subtotal, packaging_charge, delivery_fee, gst_amount, total_amount,
        order_status, payment_status
      ) VALUES (
        UUID(), ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?, ?, ?,
        'PLACED', 'PENDING'
      );`,
      [
        orderNumber,
        userId,
        cart.seller_id,
        address.id,
        recipientName,
        recipientPhone,
        address.address_line_1,
        address.address_line_2,
        address.city,
        address.state,
        address.pincode,
        subtotal.toFixed(2),
        packagingCharge.toFixed(2),
        deliveryFee.toFixed(2),
        gstAmount.toFixed(2),
        totalAmount.toFixed(2)
      ]
    );

    const [orderRows] = await connection.query(
      'SELECT id FROM orders WHERE order_number = ? LIMIT 1;',
      [orderNumber]
    );
    const orderId = orderRows[0].id;

    // 9. Insert Immutable Line Items
    for (const line of orderItemsToInsert) {
      await connection.query(
        `INSERT INTO order_items (
          id, order_id, product_id, product_name, unit_price, quantity, item_total
        ) VALUES (
          UUID(), ?, ?, ?, ?, ?, ?
        );`,
        [
          orderId,
          line.productId,
          line.productName,
          line.unitPrice,
          line.quantity,
          line.itemTotal
        ]
      );
    }

    // 10. Clear Customer's Shopping Cart
    await connection.query('DELETE FROM cart_items WHERE cart_id = ?;', [cart.cart_id]);
    await connection.query('DELETE FROM shopping_carts WHERE id = ?;', [cart.cart_id]);

    await connection.commit();

    return getOrderById(orderId, userId, null);
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

/**
 * Get detailed order by ID with line items
 * Enforces ownership:
 * - If userId provided: checks order.user_id = userId
 * - If sellerId provided: checks order.seller_id = sellerId
 */
async function getOrderById(orderId, userId = null, sellerId = null) {
  let query = `
    SELECT o.*, s.business_name as seller_business_name
    FROM orders o
    JOIN sellers s ON o.seller_id = s.id
    WHERE o.id = ?
  `;
  const params = [orderId];

  if (userId) {
    query += ' AND o.user_id = ?';
    params.push(userId);
  } else if (sellerId) {
    query += ' AND o.seller_id = ?';
    params.push(sellerId);
  }

  query += ' LIMIT 1;';

  const [orderRows] = await pool.query(query, params);

  if (orderRows.length === 0) {
    throw new NotFoundError('Order not found or you do not have permission to view it.');
  }

  const order = orderRows[0];

  const [items] = await pool.query(
    `SELECT id, product_id, product_name, unit_price, quantity, item_total, created_at
     FROM order_items
     WHERE order_id = ?
     ORDER BY created_at ASC;`,
    [order.id]
  );

  return {
    ...order,
    items
  };
}

/**
 * List orders for customer
 */
async function listCustomerOrders(userId, { page = 1, limit = 20, status = null }) {
  const conditions = ['o.user_id = ?'];
  const params = [userId];

  if (status && status !== 'ALL') {
    const normStatus = status.replace(/\s+/g, '_').toUpperCase();
    if (normStatus === 'OUT_FOR_DELIVERY') {
      conditions.push("(o.order_status = 'OUT_FOR_DELIVERY' OR d.delivery_status IN ('PICKED_UP', 'IN_TRANSIT'))");
    } else if (normStatus === 'DELIVERED') {
      conditions.push("(o.order_status = 'DELIVERED' OR d.delivery_status = 'DELIVERED')");
    } else {
      conditions.push('o.order_status = ?');
      params.push(normStatus);
    }
  }

  const where = `WHERE ${conditions.join(' AND ')}`;
  const [countRows] = await pool.query(
    `SELECT COUNT(DISTINCT o.id) as total 
     FROM orders o
     LEFT JOIN order_deliveries d ON o.id = d.order_id
     ${where};`, 
    params
  );
  const total = countRows[0].total;

  const offset = (Number(page) - 1) * Number(limit);
  const [rows] = await pool.query(
    `SELECT o.id, o.order_number, o.seller_id, s.business_name as seller_name,
            o.total_amount, o.order_status, o.payment_status, o.created_at,
            d.id as delivery_id, d.delivery_status, d.simulation_started_at,
            d.assigned_at, d.picked_up_at, d.delivered_at,
            dp.name as partner_name, dp.vehicle_type, dp.vehicle_number
     FROM orders o
     JOIN sellers s ON o.seller_id = s.id
     LEFT JOIN order_deliveries d ON o.id = d.order_id
     LEFT JOIN delivery_partners dp ON d.partner_id = dp.id
     ${where}
     ORDER BY o.created_at DESC
     LIMIT ? OFFSET ?;`,
    [...params, Number(limit), Number(offset)]
  );

  // Synchronize 5-minute delivery timeline for any active simulation orders
  const items = await Promise.all(rows.map(async (row) => {
    let elapsedSec = 0;
    if (row.simulation_started_at && row.payment_status === 'PAID' && row.order_status !== 'CANCELLED') {
      const startedMs = new Date(row.simulation_started_at).getTime();
      elapsedSec = Math.max(0, Math.floor((Date.now() - startedMs) / 1000));

      // 300s -> DELIVERED
      if (elapsedSec >= 300 && row.delivery_status !== 'DELIVERED') {
        await pool.query(
          `UPDATE order_deliveries SET delivery_status = 'DELIVERED', delivered_at = COALESCE(delivered_at, CURRENT_TIMESTAMP) WHERE id = ?;`,
          [row.delivery_id]
        );
        await pool.query(`UPDATE orders SET order_status = 'DELIVERED' WHERE id = ?;`, [row.id]);
        row.delivery_status = 'DELIVERED';
        row.order_status = 'DELIVERED';
      } 
      // 200s -> IN_TRANSIT
      else if (elapsedSec >= 200 && (row.delivery_status === 'ASSIGNED' || row.delivery_status === 'PICKED_UP')) {
        await pool.query(
          `UPDATE order_deliveries SET delivery_status = 'IN_TRANSIT' WHERE id = ?;`,
          [row.delivery_id]
        );
        await pool.query(`UPDATE orders SET order_status = 'OUT_FOR_DELIVERY' WHERE id = ?;`, [row.id]);
        row.delivery_status = 'IN_TRANSIT';
        row.order_status = 'OUT_FOR_DELIVERY';
      } 
      // 100s -> PICKED_UP
      else if (elapsedSec >= 100 && row.delivery_status === 'ASSIGNED') {
        await pool.query(
          `UPDATE order_deliveries SET delivery_status = 'PICKED_UP', picked_up_at = COALESCE(picked_up_at, CURRENT_TIMESTAMP) WHERE id = ?;`,
          [row.delivery_id]
        );
        await pool.query(`UPDATE orders SET order_status = 'OUT_FOR_DELIVERY' WHERE id = ?;`, [row.id]);
        row.delivery_status = 'PICKED_UP';
        row.order_status = 'OUT_FOR_DELIVERY';
      }
    }

    return {
      id: row.id,
      order_number: row.order_number,
      seller_id: row.seller_id,
      seller_name: row.seller_name,
      shop_name: row.seller_name,
      total_amount: row.total_amount,
      order_status: row.order_status,
      payment_status: row.payment_status,
      created_at: row.created_at,
      delivery: row.delivery_id ? {
        id: row.delivery_id,
        deliveryStatus: row.delivery_status,
        simulationStartedAt: row.simulation_started_at,
        simulationElapsedSeconds: Math.min(300, elapsedSec),
        simulationDurationSeconds: 300,
        progressPercent: Math.min(100, Math.round((Math.min(300, elapsedSec) / 300) * 100)),
        remainingSeconds: Math.max(0, 300 - elapsedSec),
        assignedAt: row.assigned_at,
        pickedUpAt: row.picked_up_at,
        deliveredAt: row.delivered_at,
        partnerName: row.partner_name || 'Ramesh Kumar (Mithai Express)',
        vehicleType: row.vehicle_type || 'SCOOTER',
        vehicleNumber: row.vehicle_number || 'MH-02-MK-5522'
      } : null
    };
  }));

  return {
    items,
    pagination: {
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / Number(limit))
    }
  };
}

/**
 * List orders for sweet shop seller
 */
async function listSellerOrders(sellerId, { page = 1, limit = 20, status = null }) {
  const conditions = ['seller_id = ?'];
  const params = [sellerId];

  if (status) {
    conditions.push('order_status = ?');
    params.push(status);
  }

  const where = `WHERE ${conditions.join(' AND ')}`;
  const [countRows] = await pool.query(`SELECT COUNT(*) as total FROM orders ${where};`, params);
  const total = countRows[0].total;

  const offset = (Number(page) - 1) * Number(limit);
  const [rows] = await pool.query(
    `SELECT o.id, o.order_number, o.user_id, o.recipient_name, o.recipient_phone,
            o.total_amount, o.order_status, o.payment_status, o.created_at
     FROM orders o
     ${where}
     ORDER BY o.created_at DESC
     LIMIT ? OFFSET ?;`,
    [...params, Number(limit), Number(offset)]
  );

  return {
    items: rows,
    pagination: {
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / Number(limit))
    }
  };
}

/**
 * Update order status with strict lifecycle transition guards and inventory restoration
 */
async function updateOrderStatus(orderId, sellerId, newStatus, reason = null) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // 1. Lock order for update
    const [rows] = await connection.query(
      `SELECT * FROM orders WHERE id = ? AND seller_id = ? LIMIT 1 FOR UPDATE;`,
      [orderId, sellerId]
    );

    if (rows.length === 0) {
      throw new NotFoundError('Order not found or does not belong to your sweet shop.');
    }

    const order = rows[0];
    const currentStatus = order.order_status;

    // 2. Validate transition
    const allowed = ALLOWED_TRANSITIONS[currentStatus] || [];
    if (!allowed.includes(newStatus)) {
      throw new ValidationError(
        `Invalid status transition: Order cannot transition from "${currentStatus}" to "${newStatus}". Allowed: [${allowed.join(', ')}].`
      );
    }

    // 3. Handle Cancellation & Inventory Restoration
    if (newStatus === 'CANCELLED') {
      // Fetch order items to restore stock
      const [items] = await connection.query(
        `SELECT product_id, quantity FROM order_items WHERE order_id = ?;`,
        [orderId]
      );

      for (const item of items) {
        await connection.query(
          `UPDATE products 
           SET stock_quantity = stock_quantity + ?,
               availability_status = IF(availability_status = 'OUT_OF_STOCK', 'AVAILABLE', availability_status),
               updated_at = CURRENT_TIMESTAMP
           WHERE id = ?;`,
          [item.quantity, item.product_id]
        );
      }

      await connection.query(
        `UPDATE orders 
         SET order_status = 'CANCELLED',
             cancelled_by = 'SELLER',
             cancellation_reason = ?,
             cancelled_at = CURRENT_TIMESTAMP,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?;`,
        [reason || 'Cancelled by sweet shop', orderId]
      );
    } else {
      await connection.query(
        `UPDATE orders SET order_status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?;`,
        [newStatus, orderId]
      );
    }

    await connection.commit();
    return getOrderById(orderId, null, sellerId);
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

/**
 * Customer cancel order (Only allowed while order is PLACED)
 */
async function customerCancelOrder(orderId, userId, reason = null) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [rows] = await connection.query(
      `SELECT * FROM orders WHERE id = ? AND user_id = ? LIMIT 1 FOR UPDATE;`,
      [orderId, userId]
    );

    if (rows.length === 0) {
      throw new NotFoundError('Order not found or does not belong to your account.');
    }

    const order = rows[0];

    if (order.order_status !== 'PLACED') {
      throw new ValidationError(
        `Order cannot be cancelled in "${order.order_status}" status. Only orders in "PLACED" status can be cancelled by the customer.`
      );
    }

    // Restore inventory
    const [items] = await connection.query(
      `SELECT product_id, quantity FROM order_items WHERE order_id = ?;`,
      [orderId]
    );

    for (const item of items) {
      await connection.query(
        `UPDATE products 
         SET stock_quantity = stock_quantity + ?,
             availability_status = IF(availability_status = 'OUT_OF_STOCK', 'AVAILABLE', availability_status),
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?;`,
        [item.quantity, item.product_id]
      );
    }

    await connection.query(
      `UPDATE orders 
       SET order_status = 'CANCELLED',
           cancelled_by = 'CUSTOMER',
           cancellation_reason = ?,
           cancelled_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?;`,
      [reason || 'Cancelled by customer', orderId]
    );

    await connection.commit();
    return getOrderById(orderId, userId, null);
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

module.exports = {
  placeOrder,
  getOrderById,
  listCustomerOrders,
  listSellerOrders,
  updateOrderStatus,
  customerCancelOrder
};
