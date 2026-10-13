/**
 * Phase 22 & 22B Automated Test Suite:
 * - 5-Minute Delivery Simulation
 * - Server Timestamp Persistence across requests and reloads
 * - Authoritative Milestone Synchronization (100s, 200s, 300s)
 * - Customer Order List Synchronization and Polling integration
 */

const http = require('http');
const assert = require('assert');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const app = require('../src/server');
const config = require('../src/config/env');
const { pool } = require('../src/config/db');

let server;
let baseUrl;

function generateToken(user, userType) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role || userType,
      userType
    },
    config.jwt.accessSecret,
    { expiresIn: '1h' }
  );
}

async function request(method, path, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(baseUrl + path);
    const bodyStr = body !== null ? JSON.stringify(body) : null;
    const reqHeaders = { 'Content-Type': 'application/json' };
    if (token) reqHeaders['Authorization'] = `Bearer ${token}`;
    if (bodyStr) reqHeaders['Content-Length'] = Buffer.byteLength(bodyStr);

    const req = http.request({
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: reqHeaders
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let parsed;
        try { parsed = JSON.parse(data); } catch { parsed = data; }
        resolve({ status: res.statusCode, headers: res.headers, body: parsed });
      });
    });
    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

async function runTests() {
  server = http.createServer(app);
  await new Promise(resolve => server.listen(0, resolve));
  const port = server.address().port;
  baseUrl = `http://localhost:${port}`;
  console.log(`[*] Phase 22/22B test server listening on ${baseUrl}`);

  const customerId = '22222222-1111-1111-1111-000000000001';
  const sellerId = '22222222-2222-2222-2222-000000000002';
  const orderId = '22222222-3333-3333-3333-000000000003';
  const partnerId = '22222222-4444-4444-4444-000000000004';

  const hash = await bcrypt.hash('TestPass123!', 10);
  let custToken;

  try {
    // 1. Seed Seller, Customer, Partner, and Order
    await pool.query(`
      INSERT INTO sellers (id, business_name, email, phone, gstin, password_hash, account_status, verification_status, is_active)
      VALUES (?, 'Haldiram Sweets', 'haldiram@test.com', '+919876543201', '29HALD1234F1Z1', ?, 'ACTIVE', 'APPROVED', TRUE)
      ON DUPLICATE KEY UPDATE business_name = VALUES(business_name);
    `, [sellerId, hash]);

    await pool.query(`
      INSERT INTO seller_users (id, seller_id, first_name, last_name, email, password_hash, is_active)
      VALUES (?, ?, 'Aarav', 'Sharma', 'customer22@test.com', ?, TRUE)
      ON DUPLICATE KEY UPDATE first_name = VALUES(first_name);
    `, [customerId, sellerId, hash]);

    // Customer Login to obtain official accessToken
    const logRes = await request('POST', '/api/v1/auth/login', {
      email: 'customer22@test.com',
      password: 'TestPass123!',
      sellerId
    });
    assert.strictEqual(logRes.status, 200, 'Customer logged in successfully');
    custToken = logRes.body.data.accessToken;

    await pool.query(`
      INSERT INTO delivery_partners (id, name, phone, vehicle_type, vehicle_number, is_available, is_active)
      VALUES (?, 'Vikram Scooter Rider', '+919876543202', 'SCOOTER', 'DL-01-MM-9999', TRUE, TRUE)
      ON DUPLICATE KEY UPDATE name = VALUES(name);
    `, [partnerId]);

    // Clean previous test data
    await pool.query('DELETE FROM order_deliveries WHERE order_id = ?;', [orderId]);
    await pool.query('DELETE FROM orders WHERE id = ?;', [orderId]);

    await pool.query(`
      INSERT INTO orders (
        id, order_number, user_id, seller_id, recipient_name, recipient_phone,
        delivery_address_line_1, delivery_city, delivery_state, delivery_pincode,
        subtotal, total_amount, order_status, payment_status, created_at
      ) VALUES (
        ?, 'SWT-20261013-PHASE22', ?, ?, 'Aarav Sharma', '+919876543201',
        'Flat 102, Connaught Place', 'New Delhi', 'Delhi', '110001',
        500.00, 550.00, 'CONFIRMED', 'PAID', CURRENT_TIMESTAMP
      );
    `, [orderId, customerId, sellerId]);

    console.log('\n--- 1. Testing Live Tracking Endpoint & Timestamp Persistence ---');
    const track1 = await request('GET', `/api/v1/deliveries/orders/${orderId}/tracking`, null, custToken);
    assert.strictEqual(track1.status, 200, 'Tracking endpoint returns 200 OK');
    assert.ok(track1.body.data.delivery, 'Delivery record auto-initialized for paid order');
    assert.strictEqual(track1.body.data.delivery.status, 'ASSIGNED', 'Initial delivery status is ASSIGNED');
    assert.ok(track1.body.data.simulation.startedAt, 'Server simulation startedAt timestamp is returned');

    const firstStartedAt = track1.body.data.simulation.startedAt;

    // Call tracking endpoint again (simulating browser reload / refresh telemetry)
    const track2 = await request('GET', `/api/v1/deliveries/orders/${orderId}/tracking`, null, custToken);
    assert.strictEqual(track2.status, 200, 'Second tracking request returns 200 OK');
    assert.strictEqual(
      new Date(track2.body.data.simulation.startedAt).getTime(),
      new Date(firstStartedAt).getTime(),
      'Simulation start timestamp is strictly persisted across refreshes (not reset to zero)'
    );
    console.log('  [PASS] Single authoritative start timestamp persisted across requests');

    console.log('\n--- 2. Testing Milestone Progression: 100s -> PICKED_UP ---');
    // Fast-forward simulation_started_at by 120 seconds in database
    await pool.query(`
      UPDATE order_deliveries 
      SET simulation_started_at = DATE_SUB(NOW(), INTERVAL 120 SECOND) 
      WHERE order_id = ?;
    `, [orderId]);

    const track120s = await request('GET', `/api/v1/deliveries/orders/${orderId}/tracking`, null, custToken);
    assert.strictEqual(track120s.status, 200);
    assert.strictEqual(track120s.body.data.delivery.status, 'PICKED_UP', 'Milestone at >= 100s advances to PICKED_UP');
    assert.strictEqual(track120s.body.data.orderStatus, 'OUT_FOR_DELIVERY', 'Order status synchronizes to OUT_FOR_DELIVERY');
    console.log('  [PASS] At 100s+ delivery status advances to PICKED_UP / OUT_FOR_DELIVERY');

    console.log('\n--- 3. Testing Milestone Progression: 200s -> IN_TRANSIT ---');
    // Fast-forward simulation_started_at by 220 seconds in database
    await pool.query(`
      UPDATE order_deliveries 
      SET simulation_started_at = DATE_SUB(NOW(), INTERVAL 220 SECOND) 
      WHERE order_id = ?;
    `, [orderId]);

    const track220s = await request('GET', `/api/v1/deliveries/orders/${orderId}/tracking`, null, custToken);
    assert.strictEqual(track220s.status, 200);
    assert.strictEqual(track220s.body.data.delivery.status, 'IN_TRANSIT', 'Milestone at >= 200s advances to IN_TRANSIT');
    console.log('  [PASS] At 200s+ delivery status advances to IN_TRANSIT');

    console.log('\n--- 4. Testing Milestone Progression: 300s -> DELIVERED ---');
    // Fast-forward simulation_started_at by 310 seconds in database
    await pool.query(`
      UPDATE order_deliveries 
      SET simulation_started_at = DATE_SUB(NOW(), INTERVAL 310 SECOND) 
      WHERE order_id = ?;
    `, [orderId]);

    const track310s = await request('GET', `/api/v1/deliveries/orders/${orderId}/tracking`, null, custToken);
    assert.strictEqual(track310s.status, 200);
    assert.strictEqual(track310s.body.data.delivery.status, 'DELIVERED', 'Milestone at >= 300s advances to DELIVERED');
    assert.strictEqual(track310s.body.data.orderStatus, 'DELIVERED', 'Order status synchronizes to DELIVERED in database');
    console.log('  [PASS] At 300s delivery status completes to DELIVERED');

    console.log('\n--- 5. Testing Simulation Reset Endpoint ---');
    const resetRes = await request('POST', `/api/v1/deliveries/orders/${orderId}/simulation/reset`, {}, custToken);
    assert.strictEqual(resetRes.status, 200, 'Reset endpoint returns 200 OK');
    assert.strictEqual(resetRes.body.data.delivery.status, 'ASSIGNED', 'Status reset to ASSIGNED');
    assert.strictEqual(resetRes.body.data.simulation.elapsedSeconds, 0, 'Elapsed seconds reset to 0');
    console.log('  [PASS] Reset endpoint resets journey to beginning (0s, ASSIGNED)');

    console.log('\n--- 6. Testing Customer Orders List Polling & Filter Synchronization ---');
    const myOrdersRes = await request('GET', '/api/v1/orders/my-orders', null, custToken);
    assert.strictEqual(myOrdersRes.status, 200);
    assert.ok(myOrdersRes.body.data.length > 0, 'Customer orders retrieved');
    const foundOrder = myOrdersRes.body.data.find(o => o.id === orderId);
    assert.ok(foundOrder, 'Test order found in customer orders');
    assert.ok(foundOrder.delivery, 'Order card includes delivery simulation payload');
    assert.ok(foundOrder.delivery.simulationStartedAt, 'Same server simulationStartedAt is present on order card');

    // Test filter by OUT_FOR_DELIVERY and DELIVERED
    const filterDelivered = await request('GET', '/api/v1/orders/my-orders?status=DELIVERED', null, custToken);
    assert.strictEqual(filterDelivered.status, 200);

    console.log('  [PASS] Customer orders endpoint successfully returns synchronized delivery tracking');

    console.log('\n===============================================================');
    console.log('PHASE 22 & 22B BACKEND TEST SUITE: ALL ASSERTIONS PASSED!');
    console.log('===============================================================');
  } finally {
    // Cleanup
    await pool.query('DELETE FROM order_deliveries WHERE order_id = ?;', [orderId]);
    await pool.query('DELETE FROM orders WHERE id = ?;', [orderId]);
    server.close();
  }
}

runTests().then(() => process.exit(0)).catch(err => {
  console.error('[FAIL]', err);
  process.exit(1);
});
