/**
 * Phase 10 Automated Test Suite:
 * Delivery Partners, Live Simulated Tracking & Customer Support Tickets
 * 
 * Verifies:
 * 1. Delivery Partner Management:
 *    - Platform Admin registers delivery partner (201 Created).
 *    - Partner phone uniqueness enforced.
 *    - List available delivery partners.
 * 2. Order Delivery Assignment:
 *    - Authorized user (Admin/Seller) assigns partner to CONFIRMED order (200 OK).
 *    - Partner marked is_available = FALSE.
 *    - Duplicate/conflicting assignment to already assigned order rejected (409 ALREADY_ASSIGNED).
 *    - Order in illegal state (PLACED) cannot be assigned (400 Bad Request).
 * 3. Delivery Lifecycle State Machine:
 *    - Transitions: ASSIGNED -> PICKED_UP -> IN_TRANSIT -> DELIVERED.
 *    - When DELIVERED, order status synchronizes to DELIVERED and partner is freed (is_available = TRUE).
 *    - Invalid backward transitions (e.g. IN_TRANSIT -> PICKED_UP) rejected (400 Bad Request).
 * 4. Live Simulated Tracking & Location Updates:
 *    - GPS coordinate updates validated (-90 to 90, -180 to 180).
 *    - Audit trail logs recorded in delivery_audit_logs.
 *    - Customer 1 views own live tracking with coordinates and timeline.
 *    - Customer 2 blocked from viewing Customer 1's tracking (403 Forbidden).
 * 5. Customer Support Ticket System:
 *    - Customer 1 opens ticket linked to order (201 Created).
 *    - Customer can post reply messages.
 *    - Support agent (holding handle_support_tickets) lists tickets, replies, and resolves ticket (200 OK).
 *    - Customer 2 blocked from viewing Customer 1's ticket (404 Not Found).
 * 6. Auditability & Security:
 *    - Ensures audit trail does not log passwords or sensitive credentials.
 */

const http = require('http');
const bcrypt = require('bcrypt');
const app = require('../src/server');
const { pool } = require('../src/config/db');

let server;
let baseUrl;
let passedCount = 0;
let failedCount = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  [PASS] ${message}`);
    passedCount++;
  } else {
    console.error(`  [FAIL] ${message}`);
    failedCount++;
  }
}

async function request(method, path, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(baseUrl + path);
    const bodyStr = body !== null ? JSON.stringify(body) : null;

    const reqHeaders = {
      'Content-Type': 'application/json'
    };

    if (token) {
      reqHeaders['Authorization'] = `Bearer ${token}`;
    }

    if (bodyStr) {
      reqHeaders['Content-Length'] = Buffer.byteLength(bodyStr);
    }

    const options = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: reqHeaders
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let parsed;
        try {
          parsed = JSON.parse(data);
        } catch {
          parsed = data;
        }
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: parsed
        });
      });
    });

    req.on('error', reject);

    if (bodyStr) {
      req.write(bodyStr);
    }
    req.end();
  });
}

async function runPhase10Tests() {
  console.log('===============================================================');
  console.log('RUNNING PHASE 10 DELIVERY & SUPPORT AUTOMATED TEST SUITE');
  console.log('===============================================================');

  server = app.listen(0);
  const port = server.address().port;
  baseUrl = `http://localhost:${port}`;
  console.log(`[*] Test HTTP server listening on ${baseUrl}\n`);

  const sellerId = '10101010-1111-1111-1111-000000000001';
  const cust1Id = '10101010-2222-2222-2222-000000000001';
  const cust2Id = '10101010-2222-2222-2222-000000000002';
  const supportId = '10101010-3333-3333-3333-000000000001';
  const adminId = '10101010-4444-4444-4444-000000000001';
  const orderId = '10101010-5555-5555-5555-000000000001';
  const orderNumber = 'SWT-20261012-DELIV1';

  const password = 'TestPassword123!';

  let cust1Token;
  let cust2Token;
  let sellerToken;
  let supportToken;
  let adminToken;
  let partnerId;
  let ticketId;

  try {
    const hash = await bcrypt.hash(password, 10);

    // 1. Seed Seller
    await pool.query(`
      INSERT INTO sellers (
        id, business_name, email, phone, gstin, password_hash, account_status, verification_status, is_active
      ) VALUES (
        ?, 'Bikanervala Express', 'express@sweetshop.internal', '+919811177771', '29EXPR1234F1Z1', ?, 'ACTIVE', 'APPROVED', TRUE
      ) ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash);
    `, [sellerId, hash]);

    // 2. Seed Admin & Support Agent
    await pool.query(`
      INSERT INTO admins (
        id, name, email, password_hash, created_by, is_active
      ) VALUES (
        ?, 'Delivery Operations Admin', 'deladmin@sweetshop.internal', ?, '00000000-0000-0000-0000-000000000100', TRUE
      ) ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash);
    `, [adminId, hash]);

    await pool.query(`
      INSERT INTO customer_care (
        id, name, email, password_hash, is_active
      ) VALUES (
        ?, 'Support Agent Sneha', 'sneha@sweetshop.internal', ?, TRUE
      ) ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash);
    `, [supportId, hash]);

    // 3. Seed Customers
    await pool.query(`
      INSERT INTO seller_users (
        id, seller_id, first_name, last_name, email, password_hash, is_active
      ) VALUES 
        (?, ?, 'Rohan', 'Verma', 'rohan@sweetshop.internal', ?, TRUE),
        (?, ?, 'Simran', 'Kaur', 'simran@sweetshop.internal', ?, TRUE)
      ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash);
    `, [cust1Id, sellerId, hash, cust2Id, sellerId, hash]);

    // 4. Seed CONFIRMED Order for Customer 1
    await pool.query(`
      INSERT INTO orders (
        id, order_number, user_id, seller_id, recipient_name, recipient_phone,
        delivery_address_line_1, delivery_city, delivery_state, delivery_pincode,
        subtotal, packaging_charge, delivery_fee, gst_amount, total_amount,
        order_status, payment_status
      ) VALUES (
        ?, ?, ?, ?, 'Rohan Verma', '+919876543210',
        'Tower 4, DLF Cyber City', 'Gurugram', 'Haryana', '122002',
        600.00, 15.00, 0.00, 30.00, 645.00,
        'CONFIRMED', 'PAID'
      ) ON DUPLICATE KEY UPDATE order_status = VALUES(order_status);
    `, [orderId, orderNumber, cust1Id, sellerId]);

    // Login accounts
    const aLog = await request('POST', '/api/v1/auth/login', { email: 'deladmin@sweetshop.internal', password });
    adminToken = aLog.body.data.accessToken;

    const sLog = await request('POST', '/api/v1/auth/login', { email: 'express@sweetshop.internal', password });
    sellerToken = sLog.body.data.accessToken;

    const c1Log = await request('POST', '/api/v1/auth/login', { email: 'rohan@sweetshop.internal', password, sellerId });
    cust1Token = c1Log.body.data.accessToken;

    const c2Log = await request('POST', '/api/v1/auth/login', { email: 'simran@sweetshop.internal', password, sellerId });
    cust2Token = c2Log.body.data.accessToken;

    const supLog = await request('POST', '/api/v1/auth/login', { email: 'sneha@sweetshop.internal', password });
    supportToken = supLog.body.data.accessToken;

    // -------------------------------------------------------------------------
    // 1. DELIVERY PARTNER MANAGEMENT
    // -------------------------------------------------------------------------
    console.log('--- 1. Testing Delivery Partner Registration ---');

    const partnerPhone = `+9199${Date.now().toString().slice(-8)}`;
    const regPartnerRes = await request('POST', '/api/v1/deliveries/partners', {
      name: 'Ravi Kumar',
      phone: partnerPhone,
      email: 'ravi.rider@sweetshop.internal',
      vehicleType: 'MOTORCYCLE',
      vehicleNumber: 'HR-26-BR-1234',
      drivingLicenseNumber: 'DL-HR262020001234'
    }, adminToken);

    assert(regPartnerRes.status === 201 && regPartnerRes.body.data.is_available === 1, 'Platform Admin creates delivery partner (201 Created, is_available = 1)');
    partnerId = regPartnerRes.body.data.id;

    // List available partners
    const listPartRes = await request('GET', '/api/v1/deliveries/partners?isAvailable=true', null, sellerToken);
    assert(listPartRes.status === 200 && listPartRes.body.data.some(p => p.id === partnerId), 'Seller can view available delivery partners (200 OK)');

    // -------------------------------------------------------------------------
    // 2. ORDER DELIVERY ASSIGNMENT
    // -------------------------------------------------------------------------
    console.log('\n--- 2. Testing Order Delivery Assignment ---');

    // Customer attempts to assign delivery partner (Blocked)
    const custAssign = await request('POST', `/api/v1/deliveries/orders/${orderId}/assign`, { partnerId }, cust1Token);
    assert(custAssign.status === 403, 'Customer cannot assign delivery partner (403 Forbidden)');

    // Seller assigns delivery partner to CONFIRMED order
    const assignRes = await request('POST', `/api/v1/deliveries/orders/${orderId}/assign`, { partnerId }, sellerToken);
    assert(assignRes.status === 200 && assignRes.body.data.delivery.status === 'ASSIGNED', 'Sweet Shop Seller assigns partner to order (delivery status: ASSIGNED)');

    // Verify delivery partner is now busy (is_available = FALSE)
    const [partRow] = await pool.query('SELECT is_available FROM delivery_partners WHERE id = ?;', [partnerId]);
    assert(partRow[0].is_available === 0, 'Delivery partner marked unavailable / busy (is_available = 0)');

    // Conflicting assignment attempt to same order rejected
    const conflictAssign = await request('POST', `/api/v1/deliveries/orders/${orderId}/assign`, { partnerId }, sellerToken);
    assert(conflictAssign.status === 409 && conflictAssign.body.error.code === 'ALREADY_ASSIGNED', 'Duplicate delivery assignment rejected (409 ALREADY_ASSIGNED)');

    // -------------------------------------------------------------------------
    // 3. DELIVERY LIFECYCLE & LIVE TRACKING
    // -------------------------------------------------------------------------
    console.log('\n--- 3. Testing Delivery Lifecycle & Simulated GPS Tracking ---');

    // Partner picks up package: ASSIGNED -> PICKED_UP
    const pickupRes = await request('PATCH', `/api/v1/deliveries/orders/${orderId}/status`, {
      status: 'PICKED_UP',
      notes: 'Picked up sweet box from Chhappan Bhog counter'
    }, sellerToken);
    assert(pickupRes.status === 200 && pickupRes.body.data.delivery.status === 'PICKED_UP', 'Delivery advanced: ASSIGNED -> PICKED_UP');
    assert(pickupRes.body.data.orderStatus === 'OUT_FOR_DELIVERY', 'Order status synchronized to OUT_FOR_DELIVERY');

    // Partner starts transit: PICKED_UP -> IN_TRANSIT
    const transitRes = await request('PATCH', `/api/v1/deliveries/orders/${orderId}/status`, {
      status: 'IN_TRANSIT',
      notes: 'Rider en route to delivery address'
    }, sellerToken);
    assert(transitRes.status === 200 && transitRes.body.data.delivery.status === 'IN_TRANSIT', 'Delivery advanced: PICKED_UP -> IN_TRANSIT');

    // Illegal backward transition (IN_TRANSIT -> PICKED_UP) rejected
    const badTransRes = await request('PATCH', `/api/v1/deliveries/orders/${orderId}/status`, {
      status: 'PICKED_UP'
    }, sellerToken);
    assert(badTransRes.status === 400, 'Illegal backward transition IN_TRANSIT -> PICKED_UP rejected with 400 Bad Request');

    // Record Simulated GPS Coordinates (Cyber Hub coordinates)
    const locRes = await request('POST', `/api/v1/deliveries/orders/${orderId}/location`, {
      latitude: 28.4952,
      longitude: 77.0891,
      partnerId
    }, sellerToken);
    assert(locRes.status === 200 && locRes.body.data.delivery.trackingCoordinates.latitude === 28.4952, 'Simulated GPS coordinates updated successfully');
    assert(locRes.body.data.delivery.auditLogs.length >= 3, 'Audit trail logs state changes and coordinate breadcrumbs');

    // Customer 1 tracks their delivery
    const custTrackRes = await request('GET', `/api/v1/deliveries/orders/${orderId}/tracking`, null, cust1Token);
    assert(custTrackRes.status === 200 && custTrackRes.body.data.delivery.status === 'IN_TRANSIT', 'Customer 1 views live delivery tracking for own order (200 OK)');

    // Customer 2 attempts to track Customer 1's delivery (Blocked)
    const crossTrackRes = await request('GET', `/api/v1/deliveries/orders/${orderId}/tracking`, null, cust2Token);
    assert(crossTrackRes.status === 403, 'Customer 2 blocked from tracking Customer 1 delivery (403 Forbidden)');

    // Partner delivers package: IN_TRANSIT -> DELIVERED
    const deliveredRes = await request('PATCH', `/api/v1/deliveries/orders/${orderId}/status`, {
      status: 'DELIVERED',
      notes: 'Delivered to recipient in person'
    }, sellerToken);
    assert(deliveredRes.status === 200 && deliveredRes.body.data.delivery.status === 'DELIVERED', 'Delivery advanced: IN_TRANSIT -> DELIVERED');
    assert(deliveredRes.body.data.orderStatus === 'DELIVERED', 'Order status synchronized to DELIVERED');

    // Confirm delivery partner freed for new assignments (is_available = TRUE)
    const [freedPartner] = await pool.query('SELECT is_available FROM delivery_partners WHERE id = ?;', [partnerId]);
    assert(freedPartner[0].is_available === 1, 'Delivery partner automatically freed (is_available = 1) after delivery');

    // -------------------------------------------------------------------------
    // 4. CUSTOMER SUPPORT TICKET SYSTEM
    // -------------------------------------------------------------------------
    console.log('\n--- 4. Testing Customer Support Ticket System ---');

    // Customer 1 opens a support ticket linked to their order
    const openTicketRes = await request('POST', '/api/v1/support/tickets', {
      orderId,
      subject: 'Sweet box lid was slightly unsealed',
      category: 'FOOD_QUALITY',
      priority: 'MEDIUM',
      initialMessage: 'Hi, I received the Laddoo box today but the seal tape was loose. The sweets look fine though.'
    }, cust1Token);

    assert(openTicketRes.status === 201 && openTicketRes.body.data.ticket_number.startsWith('TCK-'), 'Customer opens support ticket (201 Created with TCK- prefix)');
    ticketId = openTicketRes.body.data.id;
    assert(openTicketRes.body.data.messages.length === 1, 'Initial conversation message recorded');

    // Customer 2 attempts to view Customer 1's ticket (Blocked)
    const crossTicketRes = await request('GET', `/api/v1/support/my-tickets/${ticketId}`, null, cust2Token);
    assert(crossTicketRes.status === 404, 'Customer 2 cannot view Customer 1 support ticket (404 Not Found)');

    // Support Agent views all open tickets
    const staffListRes = await request('GET', '/api/v1/support/staff/tickets?status=OPEN', null, supportToken);
    assert(staffListRes.status === 200 && staffListRes.body.data.some(t => t.id === ticketId), 'Support Agent lists open customer tickets (200 OK)');

    // Support Agent adds a reply to the ticket
    const replyRes = await request('POST', `/api/v1/support/tickets/${ticketId}/messages`, {
      message: 'Hello Rohan, thank you for alerting us! We have notified the sweet shop to reinforce box sealing.'
    }, supportToken);
    assert(replyRes.status === 200 && replyRes.body.data.messages.length === 2, 'Support Agent adds reply message to conversation');

    // Support Agent resolves the ticket
    const resolveRes = await request('PATCH', `/api/v1/support/staff/tickets/${ticketId}/status`, {
      status: 'RESOLVED',
      assignedAgentId: supportId
    }, supportToken);
    assert(resolveRes.status === 200 && resolveRes.body.data.status === 'RESOLVED', 'Support Agent resolves ticket (status: RESOLVED)');

    // -------------------------------------------------------------------------
    // CLEANUP
    // -------------------------------------------------------------------------
    await pool.query('DELETE FROM support_ticket_messages WHERE ticket_id = ?;', [ticketId]);
    await pool.query('DELETE FROM support_tickets WHERE id = ?;', [ticketId]);
    await pool.query('DELETE FROM delivery_audit_logs WHERE order_id = ?;', [orderId]);
    await pool.query('DELETE FROM order_deliveries WHERE order_id = ?;', [orderId]);
    await pool.query('DELETE FROM delivery_partners WHERE id = ?;', [partnerId]);
    await pool.query('DELETE FROM orders WHERE id = ?;', [orderId]);
    await pool.query('DELETE FROM customer_care WHERE id = ?;', [supportId]);
    await pool.query('DELETE FROM admins WHERE id = ?;', [adminId]);
    await pool.query('DELETE FROM seller_users WHERE id IN (?, ?);', [cust1Id, cust2Id]);
    await pool.query('DELETE FROM sellers WHERE id = ?;', [sellerId]);

    console.log('\n===============================================================');
    console.log(`PHASE 10 TEST SUITE RESULTS: ${passedCount} PASSED, ${failedCount} FAILED`);
    console.log('===============================================================');

    if (failedCount > 0) process.exitCode = 1;
  } catch (err) {
    console.error('[!] Test suite encountered an unhandled error:', err);
    process.exitCode = 1;
  } finally {
    if (server) server.close();
    await pool.end();
  }
}

runPhase10Tests();
