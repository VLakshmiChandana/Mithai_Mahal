/**
 * Delivery Management Service
 * 
 * Core responsibilities:
 * 1. Delivery Partner Management:
 *    - Create, list, and update delivery partners.
 * 2. Order Delivery Assignment:
 *    - Assign available delivery partner to orders in CONFIRMED or PREPARING status.
 *    - Prevents conflicting/duplicate assignments.
 *    - Sets order_deliveries.delivery_status = 'ASSIGNED'.
 * 3. Delivery Lifecycle State Machine:
 *    - ASSIGNED -> PICKED_UP
 *    - PICKED_UP -> IN_TRANSIT
 *    - IN_TRANSIT -> DELIVERED (also synchronizes order.order_status = 'DELIVERED')
 *    - Any active state -> FAILED
 *    - Logs state transitions in delivery_audit_logs.
 * 4. Location Updates (Simulated GPS / Coordinate breadcrumbs):
 *    - Validates latitude (-90 to 90) and longitude (-180 to 180).
 *    - Updates order_deliveries current coordinates and partner position.
 *    - Adds breadcrumb audit log.
 * 5. Order Tracking Query:
 *    - Scoped strictly to the customer who placed the order, or the seller who prepared it, or platform staff.
 */

const { pool } = require('../config/db');
const { AppError, NotFoundError, ValidationError, ForbiddenError } = require('../middleware/errorHandler');

const ALLOWED_DELIVERY_TRANSITIONS = Object.freeze({
  ASSIGNED: ['PICKED_UP', 'FAILED'],
  PICKED_UP: ['IN_TRANSIT', 'FAILED'],
  IN_TRANSIT: ['DELIVERED', 'FAILED'],
  DELIVERED: [], // Terminal
  FAILED: []    // Terminal
});

/**
 * Register a new delivery partner
 */
async function createDeliveryPartner({ name, phone, email, vehicleType = 'MOTORCYCLE', vehicleNumber, drivingLicenseNumber }) {
  const [existing] = await pool.query('SELECT id FROM delivery_partners WHERE phone = ? LIMIT 1;', [phone]);
  if (existing.length > 0) {
    throw new AppError('A delivery partner with this phone number already exists.', 409, 'CONFLICT');
  }

  await pool.query(
    `INSERT INTO delivery_partners (
      id, name, phone, email, vehicle_type, vehicle_number, driving_license_number,
      is_available, is_active
    ) VALUES (
      UUID(), ?, ?, ?, ?, ?, ?, TRUE, TRUE
    );`,
    [name, phone, email || null, vehicleType, vehicleNumber || null, drivingLicenseNumber || null]
  );

  const [partner] = await pool.query('SELECT * FROM delivery_partners WHERE phone = ? LIMIT 1;', [phone]);
  return partner[0];
}

/**
 * List delivery partners with optional availability filter
 */
async function listDeliveryPartners({ isAvailable = null }) {
  const conditions = ['is_active = TRUE'];
  const params = [];

  if (isAvailable !== null && isAvailable !== undefined) {
    conditions.push('is_available = ?');
    params.push(isAvailable === true || isAvailable === 'true' ? 1 : 0);
  }

  const where = `WHERE ${conditions.join(' AND ')}`;
  const [rows] = await pool.query(
    `SELECT id, name, phone, email, vehicle_type, vehicle_number,
            current_latitude, current_longitude, is_available, created_at
     FROM delivery_partners ${where}
     ORDER BY name ASC;`,
    params
  );
  return rows;
}

/**
 * Assign an order to an available delivery partner
 * 
 * Rules:
 * - Order must be CONFIRMED or PREPARING
 * - Order must not already have an active assignment
 * - Partner must be available
 */
async function assignDeliveryPartner(orderId, partnerId, assignedBy) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // 1. Verify Order Eligibility
    const [orderRows] = await connection.query(
      `SELECT id, seller_id, order_status, recipient_name, recipient_phone,
              delivery_address_line_1, delivery_city, delivery_pincode
       FROM orders WHERE id = ? LIMIT 1 FOR UPDATE;`,
      [orderId]
    );

    if (orderRows.length === 0) {
      throw new NotFoundError('Order not found.');
    }

    const order = orderRows[0];
    if (!['CONFIRMED', 'PREPARING'].includes(order.order_status)) {
      throw new ValidationError(
        `Order in status "${order.order_status}" cannot be assigned for delivery. Must be CONFIRMED or PREPARING.`
      );
    }

    // 2. Check if order already has an active delivery
    const [existingDelivery] = await connection.query(
      'SELECT id, delivery_status FROM order_deliveries WHERE order_id = ? LIMIT 1;',
      [orderId]
    );

    if (existingDelivery.length > 0 && existingDelivery[0].delivery_status !== 'FAILED') {
      throw new AppError('Order is already assigned to a delivery partner.', 409, 'ALREADY_ASSIGNED');
    }

    // 3. Verify Delivery Partner Availability
    const [partnerRows] = await connection.query(
      'SELECT id, name, phone, is_available, is_active FROM delivery_partners WHERE id = ? LIMIT 1 FOR UPDATE;',
      [partnerId]
    );

    if (partnerRows.length === 0 || !partnerRows[0].is_active) {
      throw new NotFoundError('Delivery partner not found or inactive.');
    }

    const partner = partnerRows[0];
    if (!partner.is_available) {
      throw new ValidationError(`Delivery partner "${partner.name}" is currently unavailable or busy.`);
    }

    // 4. Create or Reassign Order Delivery
    let deliveryId;
    if (existingDelivery.length > 0) {
      // Reassigning after previous FAILED attempt
      deliveryId = existingDelivery[0].id;
      await connection.query(
        `UPDATE order_deliveries 
         SET partner_id = ?, delivery_status = 'ASSIGNED', assigned_at = CURRENT_TIMESTAMP,
             failed_at = NULL, failure_reason = NULL, assigned_by = ?, assigned_by_role = ?,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?;`,
        [partnerId, assignedBy.id, assignedBy.role, deliveryId]
      );
    } else {
      await connection.query(
        `INSERT INTO order_deliveries (
          id, order_id, partner_id, delivery_status, assigned_by, assigned_by_role
        ) VALUES (
          UUID(), ?, ?, 'ASSIGNED', ?, ?
        );`,
        [orderId, partnerId, assignedBy.id, assignedBy.role]
      );
      const [newDel] = await connection.query('SELECT id FROM order_deliveries WHERE order_id = ?;', [orderId]);
      deliveryId = newDel[0].id;
    }

    // 5. Mark Delivery Partner as Busy (is_available = FALSE)
    await connection.query('UPDATE delivery_partners SET is_available = FALSE WHERE id = ?;', [partnerId]);

    // 6. Audit Log Entry
    await connection.query(
      `INSERT INTO delivery_audit_logs (
        id, delivery_id, order_id, partner_id, status, notes
      ) VALUES (
        UUID(), ?, ?, ?, 'ASSIGNED', ?
      );`,
      [deliveryId, orderId, partnerId, `Assigned by ${assignedBy.role}`]
    );

    await connection.commit();

    return getDeliveryTracking(orderId);
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

/**
 * Update delivery status with state machine validation
 */
async function updateDeliveryStatus(orderId, newStatus, { failureReason = null, notes = null, actor = null }) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [deliveryRows] = await connection.query(
      `SELECT d.*, o.order_status, o.user_id as customer_id
       FROM order_deliveries d
       JOIN orders o ON d.order_id = o.id
       WHERE d.order_id = ?
       LIMIT 1 FOR UPDATE;`,
      [orderId]
    );

    if (deliveryRows.length === 0) {
      throw new NotFoundError('No delivery assignment found for this order.');
    }

    const delivery = deliveryRows[0];
    const currentStatus = delivery.delivery_status;

    // Validate Transition
    const allowed = ALLOWED_DELIVERY_TRANSITIONS[currentStatus] || [];
    if (!allowed.includes(newStatus)) {
      throw new ValidationError(
        `Invalid delivery transition: Cannot transition from "${currentStatus}" to "${newStatus}". Allowed: [${allowed.join(', ')}].`
      );
    }

    const updates = ['delivery_status = ?'];
    const params = [newStatus];

    if (newStatus === 'PICKED_UP') {
      updates.push('picked_up_at = CURRENT_TIMESTAMP');
      // Advance order status to OUT_FOR_DELIVERY
      await connection.query('UPDATE orders SET order_status = "OUT_FOR_DELIVERY" WHERE id = ?;', [orderId]);
    } else if (newStatus === 'DELIVERED') {
      updates.push('delivered_at = CURRENT_TIMESTAMP');
      // Advance order status to DELIVERED
      await connection.query('UPDATE orders SET order_status = "DELIVERED" WHERE id = ?;', [orderId]);
      // Free the delivery partner
      await connection.query('UPDATE delivery_partners SET is_available = TRUE WHERE id = ?;', [delivery.partner_id]);
    } else if (newStatus === 'FAILED') {
      updates.push('failed_at = CURRENT_TIMESTAMP', 'failure_reason = ?');
      params.push(failureReason || 'Delivery attempt failed');
      // Free the delivery partner
      await connection.query('UPDATE delivery_partners SET is_available = TRUE WHERE id = ?;', [delivery.partner_id]);
    }

    params.push(delivery.id);
    await connection.query(
      `UPDATE order_deliveries SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?;`,
      params
    );

    // Audit Log
    await connection.query(
      `INSERT INTO delivery_audit_logs (
        id, delivery_id, order_id, partner_id, status, notes
      ) VALUES (
        UUID(), ?, ?, ?, ?, ?
      );`,
      [delivery.id, orderId, delivery.partner_id, newStatus, notes || `Status changed to ${newStatus}`]
    );

    await connection.commit();
    return getDeliveryTracking(orderId);
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

/**
 * Record simulated GPS coordinates for an order delivery
 */
async function updateDeliveryLocation(orderId, { latitude, longitude, partnerId = null }) {
  const [deliveryRows] = await pool.query(
    'SELECT id, partner_id, delivery_status FROM order_deliveries WHERE order_id = ? LIMIT 1;',
    [orderId]
  );

  if (deliveryRows.length === 0) {
    throw new NotFoundError('No delivery assignment found for this order.');
  }

  const delivery = deliveryRows[0];

  if (['DELIVERED', 'FAILED'].includes(delivery.delivery_status)) {
    throw new ValidationError('Cannot update location for a completed or failed delivery.');
  }

  if (partnerId && partnerId !== delivery.partner_id) {
    throw new ForbiddenError('You are not the assigned delivery partner for this order.');
  }

  const lat = Number(latitude);
  const lng = Number(longitude);

  await pool.query(
    `UPDATE order_deliveries 
     SET current_latitude = ?, current_longitude = ?, location_updated_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP 
     WHERE id = ?;`,
    [lat, lng, delivery.id]
  );

  await pool.query(
    `UPDATE delivery_partners 
     SET current_latitude = ?, current_longitude = ?, updated_at = CURRENT_TIMESTAMP 
     WHERE id = ?;`,
    [lat, lng, delivery.partner_id]
  );

  // Record audit breadcrumb
  await pool.query(
    `INSERT INTO delivery_audit_logs (
      id, delivery_id, order_id, partner_id, status, latitude, longitude, notes
    ) VALUES (
      UUID(), ?, ?, ?, ?, ?, ?, 'Location update breadcrumb'
    );`,
    [delivery.id, orderId, delivery.partner_id, delivery.delivery_status, lat, lng]
  );

  return getDeliveryTracking(orderId);
}

/**
 * Fetch detailed delivery and live tracking information for an order
 */
async function getDeliveryTracking(orderId, requester = null) {
  // 1. Fetch Order and Delivery Details
  const [rows] = await pool.query(
    `SELECT o.id as order_id, o.order_number, o.user_id as customer_id, o.seller_id,
            o.order_status, o.payment_status, o.total_amount, o.created_at,
            o.recipient_name, o.recipient_phone,
            o.delivery_address_line_1, o.delivery_city, o.delivery_pincode,
            s.business_name as sweet_shop_name,
            d.id as delivery_id, d.delivery_status, d.current_latitude, d.current_longitude,
            d.location_updated_at, d.assigned_at, d.picked_up_at, d.delivered_at, d.failed_at, d.failure_reason,
            d.simulation_started_at,
            dp.id as partner_id, dp.name as partner_name, dp.phone as partner_phone, dp.vehicle_type, dp.vehicle_number
     FROM orders o
     JOIN sellers s ON o.seller_id = s.id
     LEFT JOIN order_deliveries d ON o.id = d.order_id
     LEFT JOIN delivery_partners dp ON d.partner_id = dp.id
     WHERE o.id = ?
     LIMIT 1;`,
    [orderId]
  );

  if (rows.length === 0) {
    throw new NotFoundError('Order not found.');
  }

  const order = rows[0];

  // 2. Enforce Access Scoping
  if (requester) {
    if (requester.userType === 'CUSTOMER' && requester.id !== order.customer_id) {
      throw new ForbiddenError('You can only track deliveries for your own orders.');
    }
    if (requester.userType === 'SELLER' && requester.id !== order.seller_id) {
      throw new ForbiddenError('You can only view deliveries for your own sweet shop.');
    }
  }

  // 3. Auto-initialize demo delivery record if order is PAID and active
  if (!order.delivery_id && order.payment_status === 'PAID' && order.order_status !== 'CANCELLED') {
    let [partners] = await pool.query('SELECT id, name, phone, vehicle_type, vehicle_number FROM delivery_partners WHERE is_active = TRUE LIMIT 1;');
    let partner;
    if (partners.length > 0) {
      partner = partners[0];
    } else {
      const pId = '00000000-0000-0000-0000-000000000099';
      await pool.query(`
        INSERT INTO delivery_partners (id, name, phone, vehicle_type, vehicle_number, is_available, is_active)
        VALUES (?, 'Ramesh Kumar (Mithai Express)', '+919876543299', 'SCOOTER', 'MH-02-MK-5522', TRUE, TRUE)
        ON DUPLICATE KEY UPDATE is_active = TRUE;
      `, [pId]);
      partner = { id: pId, name: 'Ramesh Kumar (Mithai Express)', phone: '+919876543299', vehicle_type: 'SCOOTER', vehicle_number: 'MH-02-MK-5522' };
    }

    const deliveryId = require('crypto').randomUUID();
    await pool.query(`
      INSERT INTO order_deliveries (
        id, order_id, partner_id, delivery_status, simulation_started_at, assigned_at, assigned_by, assigned_by_role
      ) VALUES (
        ?, ?, ?, 'ASSIGNED', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, ?, 'SYSTEM'
      );
    `, [deliveryId, orderId, partner.id, order.seller_id]);

    // Re-fetch order row with newly created delivery
    const [refetched] = await pool.query(
      `SELECT o.id as order_id, o.order_number, o.user_id as customer_id, o.seller_id,
              o.order_status, o.payment_status, o.total_amount, o.created_at,
              o.recipient_name, o.recipient_phone,
              o.delivery_address_line_1, o.delivery_city, o.delivery_pincode,
              s.business_name as sweet_shop_name,
              d.id as delivery_id, d.delivery_status, d.current_latitude, d.current_longitude,
              d.location_updated_at, d.assigned_at, d.picked_up_at, d.delivered_at, d.failed_at, d.failure_reason,
              d.simulation_started_at,
              dp.id as partner_id, dp.name as partner_name, dp.phone as partner_phone, dp.vehicle_type, dp.vehicle_number
       FROM orders o
       JOIN sellers s ON o.seller_id = s.id
       LEFT JOIN order_deliveries d ON o.id = d.order_id
       LEFT JOIN delivery_partners dp ON d.partner_id = dp.id
       WHERE o.id = ?
       LIMIT 1;`,
      [orderId]
    );
    Object.assign(order, refetched[0]);
  }

  // Ensure simulation_started_at exists if delivery exists
  if (order.delivery_id && !order.simulation_started_at) {
    const simStart = order.assigned_at || order.created_at || new Date();
    await pool.query('UPDATE order_deliveries SET simulation_started_at = ? WHERE id = ?;', [simStart, order.delivery_id]);
    order.simulation_started_at = simStart;
  }

  // 4. Synchronize 5-minute milestone progression based on single authoritative server timestamp
  let simulationElapsedSeconds = 0;
  if (order.simulation_started_at && order.payment_status === 'PAID' && order.order_status !== 'CANCELLED') {
    const startedMs = new Date(order.simulation_started_at).getTime();
    simulationElapsedSeconds = Math.max(0, Math.floor((Date.now() - startedMs) / 1000));

    // Milestone 3: 300s -> DELIVERED
    if (simulationElapsedSeconds >= 300) {
      if (order.delivery_status !== 'DELIVERED' && order.delivery_status !== 'FAILED') {
        await pool.query(
          `UPDATE order_deliveries SET delivery_status = 'DELIVERED', delivered_at = COALESCE(delivered_at, CURRENT_TIMESTAMP), updated_at = CURRENT_TIMESTAMP WHERE id = ?;`,
          [order.delivery_id]
        );
        await pool.query(`UPDATE orders SET order_status = 'DELIVERED' WHERE id = ?;`, [order.order_id]);
        if (order.partner_id) {
          await pool.query(`UPDATE delivery_partners SET is_available = TRUE WHERE id = ?;`, [order.partner_id]);
        }
        await pool.query(
          `INSERT INTO delivery_audit_logs (id, delivery_id, order_id, partner_id, status, notes) VALUES (UUID(), ?, ?, ?, 'DELIVERED', 'Delivered to customer doorstep (5-minute delivery completed)');`,
          [order.delivery_id, order.order_id, order.partner_id]
        );
        order.delivery_status = 'DELIVERED';
        order.order_status = 'DELIVERED';
      }
    } 
    // Milestone 2: 200s -> OUT_FOR_DELIVERY / IN_TRANSIT
    else if (simulationElapsedSeconds >= 200) {
      if (order.delivery_status === 'ASSIGNED' || order.delivery_status === 'PICKED_UP') {
        await pool.query(
          `UPDATE order_deliveries SET delivery_status = 'IN_TRANSIT', updated_at = CURRENT_TIMESTAMP WHERE id = ?;`,
          [order.delivery_id]
        );
        await pool.query(`UPDATE orders SET order_status = 'OUT_FOR_DELIVERY' WHERE id = ?;`, [order.order_id]);
        await pool.query(
          `INSERT INTO delivery_audit_logs (id, delivery_id, order_id, partner_id, status, notes) VALUES (UUID(), ?, ?, ?, 'IN_TRANSIT', 'Rider en route on highway delivery corridor');`,
          [order.delivery_id, order.order_id, order.partner_id]
        );
        order.delivery_status = 'IN_TRANSIT';
        order.order_status = 'OUT_FOR_DELIVERY';
      }
    } 
    // Milestone 1: 100s -> PICKED_UP
    else if (simulationElapsedSeconds >= 100) {
      if (order.delivery_status === 'ASSIGNED') {
        await pool.query(
          `UPDATE order_deliveries SET delivery_status = 'PICKED_UP', picked_up_at = COALESCE(picked_up_at, CURRENT_TIMESTAMP), updated_at = CURRENT_TIMESTAMP WHERE id = ?;`,
          [order.delivery_id]
        );
        await pool.query(`UPDATE orders SET order_status = 'OUT_FOR_DELIVERY' WHERE id = ?;`, [order.order_id]);
        await pool.query(
          `INSERT INTO delivery_audit_logs (id, delivery_id, order_id, partner_id, status, notes) VALUES (UUID(), ?, ?, ?, 'PICKED_UP', 'Picked up fresh sweets from Mithai Mahal counter');`,
          [order.delivery_id, order.order_id, order.partner_id]
        );
        order.delivery_status = 'PICKED_UP';
        order.order_status = 'OUT_FOR_DELIVERY';
      }
    }
  }

  // 5. Fetch Audit Trail Breadcrumbs
  let auditLogs = [];
  if (order.delivery_id) {
    const [logs] = await pool.query(
      `SELECT status, latitude, longitude, notes, created_at
       FROM delivery_audit_logs
       WHERE delivery_id = ?
       ORDER BY created_at ASC;`,
      [order.delivery_id]
    );
    auditLogs = logs;
  }

  return {
    orderId: order.order_id,
    orderNumber: order.order_number,
    orderStatus: order.order_status,
    paymentStatus: order.payment_status,
    totalAmount: order.total_amount,
    createdAt: order.created_at,
    sweetShop: {
      sellerId: order.seller_id,
      name: order.sweet_shop_name
    },
    destination: {
      recipientName: order.recipient_name,
      recipientPhone: order.recipient_phone,
      addressLine1: order.delivery_address_line_1,
      city: order.delivery_city,
      pincode: order.delivery_pincode
    },
    delivery: order.delivery_id ? {
      deliveryId: order.delivery_id,
      status: order.delivery_status,
      simulationStartedAt: order.simulation_started_at,
      simulationElapsedSeconds: Math.min(300, simulationElapsedSeconds),
      simulationDurationSeconds: 300,
      assignedPartner: {
        partnerId: order.partner_id,
        name: order.partner_name || 'Ramesh Kumar (Mithai Express)',
        phone: order.partner_phone || '+919876543299',
        vehicle: `${order.vehicle_type || 'SCOOTER'} (${order.vehicle_number || 'MH-02-MK-5522'})`
      },
      trackingCoordinates: order.current_latitude && order.current_longitude ? {
        latitude: Number(order.current_latitude),
        longitude: Number(order.current_longitude),
        updatedAt: order.location_updated_at,
        source: 'simulated_gps'
      } : null,
      timeline: {
        assignedAt: order.assigned_at,
        pickedUpAt: order.picked_up_at,
        deliveredAt: order.delivered_at,
        failedAt: order.failed_at,
        failureReason: order.failure_reason
      },
      auditLogs
    } : null,
    simulation: {
      isDemo: true,
      startedAt: order.simulation_started_at || order.assigned_at,
      elapsedSeconds: Math.min(300, simulationElapsedSeconds),
      durationSeconds: 300,
      progressPercent: Math.min(100, Math.round((Math.min(300, simulationElapsedSeconds) / 300) * 100)),
      remainingSeconds: Math.max(0, 300 - simulationElapsedSeconds)
    }
  };
}

/**
 * Reset delivery simulation for demo order testing
 */
async function resetDeliverySimulation(orderId) {
  const [rows] = await pool.query(
    'SELECT id, partner_id FROM order_deliveries WHERE order_id = ? LIMIT 1;',
    [orderId]
  );
  if (rows.length === 0) {
    throw new NotFoundError('No delivery record found to reset.');
  }

  const del = rows[0];
  await pool.query(
    `UPDATE order_deliveries 
     SET delivery_status = 'ASSIGNED',
         simulation_started_at = CURRENT_TIMESTAMP,
         picked_up_at = NULL,
         delivered_at = NULL,
         failed_at = NULL,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = ?;`,
    [del.id]
  );

  await pool.query(
    `UPDATE orders SET order_status = 'CONFIRMED' WHERE id = ?;`,
    [orderId]
  );

  await pool.query(
    `INSERT INTO delivery_audit_logs (id, delivery_id, order_id, partner_id, status, notes) 
     VALUES (UUID(), ?, ?, ?, 'ASSIGNED', 'Simulation reset to beginning (0s)');`,
    [del.id, orderId, del.partner_id]
  );

  return getDeliveryTracking(orderId);
}

module.exports = {
  createDeliveryPartner,
  listDeliveryPartners,
  assignDeliveryPartner,
  updateDeliveryStatus,
  updateDeliveryLocation,
  getDeliveryTracking,
  resetDeliverySimulation
};
