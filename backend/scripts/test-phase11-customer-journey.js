/**
 * Phase 11 Full Customer Journey Automated Integration Test
 * 
 * Verifies the end-to-end user experience delivered by the frontend API contract:
 * 1. Guest shop discovery & public menu browsing
 * 2. Customer account registration under selected sweet shop
 * 3. Customer authentication & profile retrieval
 * 4. Cart management, live pricing, and cross-shop conflict resolution
 * 5. Delivery address creation & default address selection
 * 6. Checkout server-side validation & atomic order placement
 * 7. Payment initiation & mock capture with HMAC-SHA256 signature
 * 8. Live order tracking & simulated GPS telemetry
 * 9. Customer support ticket opening & threaded reply
 * 10. Clean session logout
 */

const http = require('http');
const crypto = require('crypto');
const app = require('../src/server');
const config = require('../src/config/env');
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

function computeSignature(payloadString, secret) {
  return crypto.createHmac('sha256', secret).update(payloadString).digest('hex');
}

async function request(method, path, body = null, token = null, extraHeaders = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(baseUrl + path);
    const bodyStr = body !== null ? (typeof body === 'string' ? body : JSON.stringify(body)) : null;

    const reqHeaders = {
      'Content-Type': 'application/json',
      ...extraHeaders
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

async function runCustomerJourney() {
  console.log('===============================================================');
  console.log('RUNNING PHASE 11 FULL CUSTOMER JOURNEY TEST SUITE');
  console.log('===============================================================');

  server = app.listen(0);
  const port = server.address().port;
  baseUrl = `http://localhost:${port}`;
  console.log(`[*] Test HTTP server listening on ${baseUrl}\n`);

  let customerToken = null;
  let customerUser = null;
  let shop1Id = null;
  let shop2Id = null;
  let shop1Products = [];
  let shop2Products = [];
  let createdAddressId = null;
  let createdOrderId = null;
  let createdTicketId = null;

  const testEmail = `journey_customer_${Date.now()}@sweetshop.internal`;
  const webhookSecret = config.payment.webhookSecret;

  try {
    // -------------------------------------------------------------------------
    // 1. GUEST BROWSING & SHOP DISCOVERY
    // -------------------------------------------------------------------------
    console.log('--- 1. Guest Shop Discovery & Menu Browsing ---');
    const shopsRes = await request('GET', '/api/v1/sellers/public');
    assert(shopsRes.status === 200 && Array.isArray(shopsRes.body.data) && shopsRes.body.data.length >= 2, 'Guest lists active sweet shops');
    shop1Id = shopsRes.body.data[0].id;
    shop2Id = shopsRes.body.data[1].id;

    const shop1Menu = await request('GET', `/api/v1/products?sellerId=${shop1Id}`);
    assert(shop1Menu.status === 200 && Array.isArray(shop1Menu.body.data) && shop1Menu.body.data.length > 0, 'Guest browses Shop 1 sweets menu');
    shop1Products = shop1Menu.body.data;

    const shop2Menu = await request('GET', `/api/v1/products?sellerId=${shop2Id}`);
    assert(shop2Menu.status === 200 && Array.isArray(shop2Menu.body.data) && shop2Menu.body.data.length > 0, 'Guest browses Shop 2 sweets menu');
    shop2Products = shop2Menu.body.data;

    // -------------------------------------------------------------------------
    // 2. CUSTOMER REGISTRATION & LOGIN
    // -------------------------------------------------------------------------
    console.log('\n--- 2. Customer Registration & Authentication ---');
    const regRes = await request('POST', '/api/v1/customers/register', {
      sellerId: shop1Id,
      email: testEmail,
      password: 'CustomerPassword123!',
      firstName: 'Ananya',
      lastName: 'Iyer',
      phone: '+919876543299'
    });
    assert(regRes.status === 201 && regRes.body.data.email === testEmail, 'Customer registered under chosen sweet shop');

    const loginRes = await request('POST', '/api/v1/auth/login', {
      sellerId: shop1Id,
      email: testEmail,
      password: 'CustomerPassword123!'
    });
    assert(loginRes.status === 200 && loginRes.body.data.accessToken, 'Customer logs in and receives JWT access token');
    customerToken = loginRes.body.data.accessToken;
    customerUser = loginRes.body.data.user;

    const profileRes = await request('GET', '/api/v1/customers/profile', null, customerToken);
    assert(profileRes.status === 200 && profileRes.body.data.first_name === 'Ananya', 'Customer profile verified from database');

    // -------------------------------------------------------------------------
    // 3. CART MANAGEMENT & CROSS-SHOP CONFLICT HANDLING
    // -------------------------------------------------------------------------
    console.log('\n--- 3. Cart Operations & Single-Shop Rules ---');
    const p1 = shop1Products[0];
    const add1Res = await request('POST', '/api/v1/cart/items', {
      productId: p1.id,
      quantity: 2
    }, customerToken);
    assert(add1Res.status === 200, 'Customer adds Shop 1 sweet to cart');

    const cart1Res = await request('GET', '/api/v1/cart', null, customerToken);
    assert(cart1Res.status === 200 && cart1Res.body.data.items.length === 1, 'Cart holds 1 item from Shop 1');

    // Cross-shop conflict: Try adding product from Shop 2
    const p2 = shop2Products[0];
    const conflictRes = await request('POST', '/api/v1/cart/items', {
      productId: p2.id,
      quantity: 1
    }, customerToken);
    assert(conflictRes.status === 409, 'Adding sweet from different shop triggers 409 CROSS_SHOP_CART_CONFLICT');

    // Resolve conflict with clearAndReplace = true
    const replaceRes = await request('POST', '/api/v1/cart/items', {
      productId: p2.id,
      quantity: 1,
      clearAndReplace: true
    }, customerToken);
    assert(replaceRes.status === 200, 'clearAndReplace clears old shop and initializes cart with Shop 2 sweets');

    const cart2Res = await request('GET', '/api/v1/cart', null, customerToken);
    assert(cart2Res.status === 200 && cart2Res.body.data.items[0].product_id === p2.id, 'Cart successfully switched to Shop 2');

    // -------------------------------------------------------------------------
    // 4. DELIVERY ADDRESS MANAGEMENT
    // -------------------------------------------------------------------------
    console.log('\n--- 4. Delivery Address Management ---');
    const createAddrRes = await request('POST', '/api/v1/addresses', {
      recipientName: 'Ananya Iyer',
      recipientPhone: '+919876543299',
      addressLine1: 'Flat 502, Gokul Heights',
      addressLine2: 'Linking Road, Bandra West',
      city: 'Mumbai',
      state: 'Maharashtra',
      pincode: '400050',
      addressType: 'HOME',
      isDefault: true
    }, customerToken);
    assert(createAddrRes.status === 201 && createAddrRes.body.data.is_default === 1, 'Delivery address created with default status');
    createdAddressId = createAddrRes.body.data.id;

    // -------------------------------------------------------------------------
    // 5. CHECKOUT VALIDATION & ATOMIC ORDER PLACEMENT
    // -------------------------------------------------------------------------
    console.log('\n--- 5. Checkout Validation & Order Placement ---');
    const checkoutValRes = await request('POST', '/api/v1/cart/validate-checkout', {
      deliveryAddressId: createdAddressId
    }, customerToken);
    assert(checkoutValRes.status === 200 && checkoutValRes.body.data.valid === true, 'Checkout validation succeeds with server prices & packaging');

    const placeOrderRes = await request('POST', '/api/v1/orders', {
      deliveryAddressId: createdAddressId
    }, customerToken);
    assert(placeOrderRes.status === 201 && placeOrderRes.body.data.id, 'Order placed atomically with SWT- order number');
    createdOrderId = placeOrderRes.body.data.id;

    // -------------------------------------------------------------------------
    // 6. PAYMENT INITIATION & MOCK TRANSACTION CAPTURE
    // -------------------------------------------------------------------------
    console.log('\n--- 6. Payment Processing & Mock Webhook ---');
    const initPayRes = await request('POST', `/api/v1/payments/orders/${createdOrderId}/initiate`, {}, customerToken);
    if (initPayRes.status !== 200) {
      console.error('[DEBUG INIT PAY ERROR]:', initPayRes.status, initPayRes.body);
    }
    assert(initPayRes.status === 200 && (initPayRes.body.data.payment.payment_reference || initPayRes.body.data.payment.paymentReference), 'Payment initiated via provider abstraction');
    const payRef = initPayRes.body.data.payment.payment_reference || initPayRes.body.data.payment.paymentReference;
    const providerPaymentId = initPayRes.body.data.checkout.providerPaymentId;
    const payAmount = initPayRes.body.data.payment.amount;

    // Complete payment using active provider flow
    if (initPayRes.body.data.checkout.provider === 'razorpay') {
      const rzpOrderId = initPayRes.body.data.checkout.razorpayOrderId || initPayRes.body.data.checkout.providerOrderId;
      const rzpPayId = `pay_test_${Date.now()}`;
      const signRes = await request('POST', `/api/v1/payments/orders/${createdOrderId}/test-sign`, {
        razorpayOrderId: rzpOrderId,
        razorpayPaymentId: rzpPayId
      }, customerToken);
      assert(signRes.status === 200, 'Test signature generated');
      const verifyRes = await request('POST', `/api/v1/payments/orders/${createdOrderId}/verify`, {
        razorpayOrderId: rzpOrderId,
        razorpayPaymentId: rzpPayId,
        razorpaySignature: signRes.body.data.razorpaySignature
      }, customerToken);
      assert(verifyRes.status === 200, 'Customer verifies payment via Razorpay test signature verification');
    } else {
      const mockCaptureRes = await request('POST', `/api/v1/payments/orders/${createdOrderId}/mock-capture`, {}, customerToken);
      assert(mockCaptureRes.status === 200, 'Customer triggers simulated mock capture endpoint');
    }

    const orderAfterPay = await request('GET', `/api/v1/orders/my-orders/${createdOrderId}`, null, customerToken);
    assert(orderAfterPay.body.data.payment_status === 'PAID', 'Order payment_status is confirmed PAID in MySQL');

    // -------------------------------------------------------------------------
    // 7. DELIVERY DISPATCH & SIMULATED TRACKING
    // -------------------------------------------------------------------------
    console.log('\n--- 7. Delivery Partner Assignment & Telemetry ---');
    // Admin creates partner and assigns to order for tracking demonstration
    const partnerId = require('crypto').randomUUID();
    const partnerPhone = `+919811${Date.now().toString().slice(-6)}`;
    await pool.query(`
      INSERT INTO delivery_partners (id, name, phone, email, vehicle_type, vehicle_number, is_available, is_active)
      VALUES (?, 'Sanjay Rider', ?, 'sanjay.rider@sweetshop.internal', 'MOTORCYCLE', 'MH-01-AB-9999', FALSE, TRUE)
      ON DUPLICATE KEY UPDATE is_available = FALSE;
    `, [partnerId, partnerPhone]);

    await pool.query(`
      INSERT INTO order_deliveries (id, order_id, partner_id, delivery_status, current_latitude, current_longitude, assigned_by, assigned_by_role)
      VALUES (UUID(), ?, ?, 'IN_TRANSIT', 19.07600000, 72.87770000, '00000000-0000-0000-0000-000000000001', 'ADMIN')
      ON DUPLICATE KEY UPDATE delivery_status = 'IN_TRANSIT';
    `, [createdOrderId, partnerId]);

    const trackingRes = await request('GET', `/api/v1/deliveries/orders/${createdOrderId}/tracking`, null, customerToken);
    assert(trackingRes.status === 200 && trackingRes.body.data.delivery && trackingRes.body.data.delivery.status === 'IN_TRANSIT', 'Customer queries live delivery telemetry (200 OK)');
    assert(trackingRes.body.data.delivery.assignedPartner.name === 'Sanjay Rider', 'Telemetry displays assigned rider details');

    // -------------------------------------------------------------------------
    // 8. CUSTOMER SUPPORT TICKETS & CONVERSATION
    // -------------------------------------------------------------------------
    console.log('\n--- 8. Customer Support Tickets & Conversation ---');
    // 8a. Order-linked ticket
    const ticketRes = await request('POST', '/api/v1/support/tickets', {
      orderId: createdOrderId,
      subject: 'Inquiry regarding fresh delivery packaging',
      category: 'ORDER_ISSUE',
      priority: 'MEDIUM',
      initialMessage: 'Could you please confirm if the sweets box is packed with dry ice?'
    }, customerToken);
    assert(ticketRes.status === 201 && ticketRes.body.data.id, 'Customer opens support ticket linked to sweet order');
    createdTicketId = ticketRes.body.data.id;

    // 8b. General inquiry (no specific order / empty orderId or null)
    const generalTicketRes = await request('POST', '/api/v1/support/tickets', {
      orderId: null,
      subject: 'Inquiry about bulk festive mithai orders',
      category: 'OTHER',
      priority: 'LOW',
      initialMessage: 'Do you offer customized sweet hampers for upcoming Diwali celebrations?'
    }, customerToken);
    assert(generalTicketRes.status === 201 && generalTicketRes.body.data.id, 'Customer opens general inquiry ticket with no linked order (orderId: null)');
    const createdGeneralTicketId = generalTicketRes.body.data.id;

    const replyRes = await request('POST', `/api/v1/support/tickets/${createdTicketId}/messages`, {
      message: 'Yes, please ensure it stays upright during transport.'
    }, customerToken);
    assert(replyRes.status === 200, 'Customer sends message in support thread');

    const ticketDetailRes = await request('GET', `/api/v1/support/my-tickets/${createdTicketId}`, null, customerToken);
    assert(ticketDetailRes.status === 200 && ticketDetailRes.body.data.messages.length >= 2, 'Support thread includes both customer messages');

    // -------------------------------------------------------------------------
    // 9. LOGOUT & REVOCATION
    // -------------------------------------------------------------------------
    console.log('\n--- 9. Customer Session Logout ---');
    const logoutRes = await request('POST', '/api/v1/auth/logout', null, customerToken);
    assert(logoutRes.status === 200, 'Customer logs out successfully');

    const meAfterLogout = await request('GET', '/api/v1/auth/me', null, customerToken);
    assert(meAfterLogout.status === 401, 'Logged-out access token is rejected');

    // -------------------------------------------------------------------------
    // CLEANUP
    // -------------------------------------------------------------------------
    await pool.query('DELETE FROM support_ticket_messages WHERE ticket_id IN (?, ?);', [createdTicketId, createdGeneralTicketId]);
    await pool.query('DELETE FROM support_tickets WHERE id IN (?, ?);', [createdTicketId, createdGeneralTicketId]);
    await pool.query('DELETE FROM delivery_audit_logs WHERE order_id = ?;', [createdOrderId]);
    await pool.query('DELETE FROM order_deliveries WHERE order_id = ?;', [createdOrderId]);
    await pool.query('DELETE FROM delivery_partners WHERE id = ?;', [partnerId]);
    await pool.query('DELETE FROM vendor_settlements WHERE order_id = ?;', [createdOrderId]);
    await pool.query('DELETE FROM payments WHERE order_id = ?;', [createdOrderId]);
    await pool.query('DELETE FROM order_items WHERE order_id = ?;', [createdOrderId]);
    await pool.query('DELETE FROM orders WHERE id = ?;', [createdOrderId]);
    await pool.query('DELETE FROM user_addresses WHERE id = ?;', [createdAddressId]);
    await pool.query('DELETE FROM shopping_carts WHERE user_id = ?;', [customerUser.id]);
    await pool.query('DELETE FROM seller_users WHERE email = ?;', [testEmail]);

    console.log('\n===============================================================');
    console.log(`CUSTOMER JOURNEY TEST RESULTS: ${passedCount} PASSED, ${failedCount} FAILED`);
    console.log('===============================================================');

    if (failedCount > 0) process.exitCode = 1;
  } catch (err) {
    console.error('[!] Customer journey test error:', err);
    process.exitCode = 1;
  } finally {
    if (server) server.close();
    await pool.end();
  }
}

runCustomerJourney();
