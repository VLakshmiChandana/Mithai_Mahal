/**
 * Phase 17 Automated Verification & Regression Suite:
 * 1. Super Admin Control Center Endpoints & Analytics
 * 2. Admin Operational Dashboard & Boundary Restrictions
 * 3. RBAC Enforcement (Customer / Seller / Admin / Super Admin)
 * 4. Account Lifecycle Management (Safe status toggle & Audit Logging)
 * 5. Razorpay Test Mode Flow (Server order creation, signature verification, and simulator helper)
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

async function request(method, path, body = null, token = null, extraHeaders = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(baseUrl + path);
    let bodyBuffer = null;
    const reqHeaders = { ...extraHeaders };

    if (body !== null) {
      if (Buffer.isBuffer(body)) {
        bodyBuffer = body;
      } else if (typeof body === 'string') {
        bodyBuffer = Buffer.from(body);
      } else {
        bodyBuffer = Buffer.from(JSON.stringify(body));
        if (!reqHeaders['Content-Type']) {
          reqHeaders['Content-Type'] = 'application/json';
        }
      }
      reqHeaders['Content-Length'] = bodyBuffer.length;
    }

    if (token) {
      reqHeaders['Authorization'] = `Bearer ${token}`;
    }

    const options = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: reqHeaders
    };

    const req = http.request(options, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        const raw = Buffer.concat(chunks).toString('utf8');
        let parsed = null;
        try {
          parsed = JSON.parse(raw);
        } catch (_) {
          parsed = raw;
        }
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          data: parsed
        });
      });
    });

    req.on('error', reject);

    if (bodyBuffer) {
      req.write(bodyBuffer);
    }
    req.end();
  });
}

async function runPhase17Tests() {
  console.log('\n================================================================');
  console.log(' Phase 17: Super Admin Control Center, Admin Dashboard & Razorpay');
  console.log('================================================================\n');

  server = http.createServer(app);
  await new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      baseUrl = `http://127.0.0.1:${port}`;
      console.log(`Test server running at ${baseUrl}\n`);
      resolve();
    });
  });

  try {
    // -------------------------------------------------------------------------
    // 1. SETUP ACTORS: Super Admin, Admin, Customer
    // -------------------------------------------------------------------------
    console.log('--- 1. Authenticating Roles ---');
    const [saRows] = await pool.query('SELECT email FROM super_admins LIMIT 1');
    const saEmail = saRows[0]?.email || 'superadmin@sweetshop.internal';
    const saPassword = 'SuperAdminPassword123!';
    const bcrypt = require('bcrypt');
    const saHash = await bcrypt.hash(saPassword, 10);
    await pool.query('UPDATE super_admins SET password_hash = ?, is_active = TRUE WHERE email = ?', [saHash, saEmail]);

    const saLogin = await request('POST', '/api/v1/auth/login', {
      email: saEmail,
      password: saPassword
    });
    assert(saLogin.statusCode === 200, 'Super Admin logs in successfully');
    const superAdminToken = saLogin.data?.data?.accessToken;

    // Super Admin creates Admin
    const adminEmail = `admin.phase17.${Date.now()}@mithaimahal.com`;
    const adminPassword = 'AdminPassword123!';
    const createAdminRes = await request('POST', '/api/v1/staff/admins', {
      name: 'Operations Admin',
      email: adminEmail,
      password: adminPassword,
      mobileNumber: '+919876500001'
    }, superAdminToken);
    assert(createAdminRes.statusCode === 201, 'Super Admin provisions new Admin account (HTTP 201)');

    const adminLogin = await request('POST', '/api/v1/auth/login', {
      email: adminEmail,
      password: adminPassword
    });
    assert(adminLogin.statusCode === 200, 'Admin logs in successfully');
    const adminToken = adminLogin.data?.data?.accessToken;

    // Register Customer
    const [shops] = await pool.query('SELECT id FROM sellers WHERE verification_status = "APPROVED" LIMIT 1');
    const shopId = shops[0]?.id;
    const custEmail = `cust.phase17.${Date.now()}@example.com`;
    const custPassword = 'CustomerPass123!';
    await request('POST', '/api/v1/customers/register', {
      sellerId: shopId,
      email: custEmail,
      password: custPassword,
      firstName: 'Kavita',
      lastName: 'Patel'
    });
    const custLogin = await request('POST', '/api/v1/auth/login', {
      sellerId: shopId,
      email: custEmail,
      password: custPassword
    });
    const custToken = custLogin.data?.data?.accessToken;

    // -------------------------------------------------------------------------
    // 2. SUPER ADMIN CONTROL CENTER ENDPOINTS
    // -------------------------------------------------------------------------
    console.log('\n--- 2. Testing Super Admin Control Center Telemetry & Analytics ---');
    
    // Overview Analytics
    const overviewRes = await request('GET', '/api/v1/super-admin/analytics/overview', null, superAdminToken);
    assert(overviewRes.statusCode === 200, 'Super Admin accesses /api/v1/super-admin/analytics/overview (HTTP 200)');
    assert(overviewRes.data?.data?.today?.revenue !== undefined, 'Today revenue metric present');
    assert(overviewRes.data?.data?.today?.successfulPayments !== undefined, 'Today successful payments metric present');
    assert(overviewRes.data?.data?.sellers?.pendingApprovals !== undefined, 'Pending seller approvals metric present');
    assert(overviewRes.data?.data?.lifetime?.commissionRetained !== undefined, 'Platform commission metric present');

    // Sales Trends
    const trendsRes = await request('GET', '/api/v1/super-admin/analytics/sales-trends?days=7', null, superAdminToken);
    assert(trendsRes.statusCode === 200, 'Super Admin accesses /api/v1/super-admin/analytics/sales-trends (HTTP 200)');
    assert(Array.isArray(trendsRes.data?.data), 'Sales trends returned as array');

    // Top Performers
    const performersRes = await request('GET', '/api/v1/super-admin/analytics/top-performers', null, superAdminToken);
    assert(performersRes.statusCode === 200, 'Super Admin accesses /api/v1/super-admin/analytics/top-performers (HTTP 200)');
    assert(Array.isArray(performersRes.data?.data?.topProducts), 'Top products rankings returned');
    assert(Array.isArray(performersRes.data?.data?.topShops), 'Top shops rankings returned');

    // Platform Config
    const configRes = await request('GET', '/api/v1/super-admin/config', null, superAdminToken);
    assert(configRes.statusCode === 200, 'Super Admin retrieves platform config (HTTP 200)');
    assert(configRes.data?.data?.paymentProvider === 'razorpay', 'Payment provider configured as razorpay');
    assert(configRes.data?.data?.database?.status === 'CONNECTED', 'Database status reports CONNECTED');

    // Update Platform Config
    const updateConfigRes = await request('PATCH', '/api/v1/super-admin/config', {
      commissionRatePercent: 12.5,
      reason: 'Automated test commission rate adjustment'
    }, superAdminToken);
    assert(updateConfigRes.statusCode === 200, 'Super Admin updates commission rate policy (HTTP 200)');
    assert(updateConfigRes.data?.data?.commissionRatePercent === 12.5, 'New commission rate confirmed');

    // Restore commission back to 10.0
    await request('PATCH', '/api/v1/super-admin/config', {
      commissionRatePercent: 10.0,
      reason: 'Restoring standard 10% commission'
    }, superAdminToken);

    // -------------------------------------------------------------------------
    // 3. ACCOUNT GOVERNANCE & AUDIT LOGGING
    // -------------------------------------------------------------------------
    console.log('\n--- 3. Testing Account Governance & Audit Logging ---');

    // List All Accounts
    const accountsRes = await request('GET', '/api/v1/super-admin/accounts?limit=10', null, superAdminToken);
    assert(accountsRes.statusCode === 200, 'Super Admin lists platform accounts (HTTP 200)');
    assert(Array.isArray(accountsRes.data?.data) && accountsRes.data.data.length > 0, 'Accounts list populated');
    const hasPasswordLeak = accountsRes.data.data.some(a => a.password_hash !== undefined || a.password !== undefined);
    assert(!hasPasswordLeak, 'Security check: Zero password hashes leaked in accounts directory');

    // Safe Deactivate Account
    const targetAccount = accountsRes.data.data.find(a => a.role === 'ADMIN' && a.email === adminEmail);
    assert(Boolean(targetAccount), 'Located target admin account for deactivation test');

    const deactivateRes = await request('PATCH', `/api/v1/super-admin/accounts/ADMIN/${targetAccount.id}/status`, {
      isActive: false,
      reason: 'Routine compliance audit hold'
    }, superAdminToken);
    assert(deactivateRes.statusCode === 200, 'Super Admin deactivates account with mandatory reason (HTTP 200)');
    assert(deactivateRes.data?.data?.isActive === false, 'Account status updated to inactive');

    // Verify Audit Log was recorded
    const auditRes = await request('GET', '/api/v1/super-admin/audit-logs?action=ACCOUNT_DEACTIVATED', null, superAdminToken);
    assert(auditRes.statusCode === 200, 'Super Admin retrieves audit logs (HTTP 200)');
    assert(Array.isArray(auditRes.data?.data), 'Audit logs returned as array');
    const loggedAction = auditRes.data.data.find(l => l.target_id === targetAccount.id);
    assert(Boolean(loggedAction), 'Audit entry persisted with actor, action, target, and reason');
    assert(loggedAction?.reason === 'Routine compliance audit hold', 'Audit log reason matches');

    // Safe Reactivate Account
    const reactivateRes = await request('PATCH', `/api/v1/super-admin/accounts/ADMIN/${targetAccount.id}/status`, {
      isActive: true,
      reason: 'Compliance audit cleared'
    }, superAdminToken);
    assert(reactivateRes.statusCode === 200, 'Super Admin reactivates account (HTTP 200)');
    assert(reactivateRes.data?.data?.isActive === true, 'Account status restored to active');

    // Prevent Super Admin self-deactivation
    const [selfSa] = await pool.query('SELECT id FROM super_admins WHERE email = ?', [saEmail]);
    const selfDeactivateRes = await request('PATCH', `/api/v1/super-admin/accounts/SUPER_ADMIN/${selfSa[0].id}/status`, {
      isActive: false,
      reason: 'Illegal self deactivation'
    }, superAdminToken);
    assert(selfDeactivateRes.statusCode === 403, 'Super Admin self-deactivation blocked with HTTP 403 Forbidden');

    // -------------------------------------------------------------------------
    // 4. ADMIN OPERATIONAL DASHBOARD & RBAC BOUNDARIES
    // -------------------------------------------------------------------------
    console.log('\n--- 4. Testing Admin Operations Dashboard & RBAC Boundaries ---');

    // Admin operational metrics
    const adminMetricsRes = await request('GET', '/api/v1/admin/dashboard/metrics', null, adminToken);
    assert(adminMetricsRes.statusCode === 200, 'Admin accesses operational metrics /api/v1/admin/dashboard/metrics (HTTP 200)');
    assert(adminMetricsRes.data?.data?.metrics?.activeOrders !== undefined, 'Active orders queue metric present');
    assert(adminMetricsRes.data?.data?.metrics?.openTickets !== undefined, 'Support tickets queue metric present');

    // Boundary Test 4.1: Admin forbidden from Super Admin Analytics
    const adminBlockedAnalytics = await request('GET', '/api/v1/super-admin/analytics/overview', null, adminToken);
    assert(adminBlockedAnalytics.statusCode === 403, 'Admin blocked from Super Admin analytics (HTTP 403 Forbidden)');

    // Boundary Test 4.2: Admin forbidden from Super Admin Account Management
    const adminBlockedAccounts = await request('GET', '/api/v1/super-admin/accounts', null, adminToken);
    assert(adminBlockedAccounts.statusCode === 403, 'Admin blocked from platform account management (HTTP 403 Forbidden)');

    // Boundary Test 4.3: Admin forbidden from Audit Logs
    const adminBlockedAudit = await request('GET', '/api/v1/super-admin/audit-logs', null, adminToken);
    assert(adminBlockedAudit.statusCode === 403, 'Admin blocked from platform audit logs (HTTP 403 Forbidden)');

    // Boundary Test 4.4: Admin forbidden from creating other Admins
    const adminBlockedCreateAdmin = await request('POST', '/api/v1/staff/admins', {
      name: 'Escalated Admin',
      email: `unauth.${Date.now()}@test.com`,
      password: 'AdminPassword123!'
    }, adminToken);
    assert(adminBlockedCreateAdmin.statusCode === 403, 'Admin forbidden from creating other Admins (HTTP 403 Forbidden)');

    // Boundary Test 4.5: Customer forbidden from Admin dashboard
    const custBlockedDashboard = await request('GET', '/api/v1/admin/dashboard/metrics', null, custToken);
    assert(custBlockedDashboard.statusCode === 403, 'Customer blocked from Admin dashboard (HTTP 403 Forbidden)');

    // Boundary Test 4.6: Unauthenticated request rejected
    const unauthDashboard = await request('GET', '/api/v1/admin/dashboard/metrics');
    assert(unauthDashboard.statusCode === 401, 'Unauthenticated request rejected with HTTP 401 Unauthorized');

    // -------------------------------------------------------------------------
    // 5. RAZORPAY TEST MODE CHECKOUT, SIMULATOR & VERIFICATION
    // -------------------------------------------------------------------------
    console.log('\n--- 5. Testing Razorpay Test Mode Checkout, Dupe Simulator & Verification ---');

    // 5.1 Create order
    let [shopProd] = await pool.query(
      'SELECT id, price, seller_id FROM products WHERE seller_id = ? AND is_active = TRUE AND stock_quantity > 5 LIMIT 1',
      [shopId]
    );

    let activeShopId = shopId;
    if (shopProd.length === 0) {
      const [anyProd] = await pool.query(
        'SELECT id, price, seller_id FROM products WHERE is_active = TRUE AND stock_quantity > 5 LIMIT 1'
      );
      if (anyProd.length > 0) {
        shopProd = anyProd;
        activeShopId = anyProd[0].seller_id;
      }
    }

    const addrRes = await request('POST', '/api/v1/addresses', {
      recipientName: 'Kavita Patel',
      recipientPhone: '+919876543210',
      addressLine1: '45 Lotus Enclave',
      city: 'Mumbai',
      state: 'Maharashtra',
      pincode: '400050',
      addressType: 'HOME',
      isDefault: true
    }, custToken);
    const addrId = addrRes.data?.data?.id;

    await request('POST', '/api/v1/cart/items', {
      productId: shopProd[0].id,
      quantity: 1
    }, custToken);

    const orderRes = await request('POST', '/api/v1/orders', {
      deliveryAddressId: addrId,
      paymentMethod: 'RAZORPAY'
    }, custToken);
    assert(orderRes.statusCode === 201, 'Order created with RAZORPAY payment method');
    const testOrderId = orderRes.data?.data?.id;

    // 5.2 Initiate Payment with Razorpay Provider
    const payInitRes = await request('POST', `/api/v1/payments/orders/${testOrderId}/initiate`, {}, custToken);
    assert(payInitRes.statusCode === 200, 'Payment initiated via Razorpay provider (HTTP 200)');
    const checkout = payInitRes.data?.data?.checkout;
    assert(checkout?.provider === 'razorpay', 'Active provider confirmed as razorpay');
    assert(checkout?.keyId?.startsWith('rzp_test_'), 'Razorpay Key ID confirmed in Test Mode');
    assert(Boolean(checkout?.razorpayOrderId), `Genuine Razorpay server order created: ${checkout?.razorpayOrderId}`);

    // 5.3 Test Development Test-Sign Generator (Powers Razorpay Dupe simulator)
    const testPaymentId = `pay_test_${Date.now()}`;
    const testSignRes = await request('POST', `/api/v1/payments/orders/${testOrderId}/test-sign`, {
      razorpayOrderId: checkout.razorpayOrderId,
      razorpayPaymentId: testPaymentId
    }, custToken);
    assert(testSignRes.statusCode === 200, 'Dev test signature generated for Razorpay Dupe simulator (HTTP 200)');
    const generatedSig = testSignRes.data?.data?.razorpaySignature;
    assert(typeof generatedSig === 'string' && generatedSig.length === 64, 'Cryptographic 64-char HMAC-SHA256 signature generated');

    // 5.4 Test Forged Signature Rejection
    const badVerifyRes = await request('POST', `/api/v1/payments/orders/${testOrderId}/verify`, {
      razorpayOrderId: checkout.razorpayOrderId,
      razorpayPaymentId: testPaymentId,
      razorpaySignature: 'forged_tampered_signature_hex_12345'
    }, custToken);
    assert(badVerifyRes.statusCode === 400, 'Forged signature rejected with HTTP 400 Bad Request');

    // 5.5 Test Valid Cryptographic Signature Verification
    const goodVerifyRes = await request('POST', `/api/v1/payments/orders/${testOrderId}/verify`, {
      razorpayOrderId: checkout.razorpayOrderId,
      razorpayPaymentId: testPaymentId,
      razorpaySignature: generatedSig
    }, custToken);
    assert(goodVerifyRes.statusCode === 200, 'Valid signature verified server-side (HTTP 200 OK)');

    // 5.6 Verify Database Statuses
    const [finalOrderRows] = await pool.query(
      'SELECT order_status, payment_status FROM orders WHERE id = ?',
      [testOrderId]
    );
    assert(
      finalOrderRows[0].order_status === 'CONFIRMED' && finalOrderRows[0].payment_status === 'PAID',
      `Order status is CONFIRMED and payment_status is PAID in MySQL: (${finalOrderRows[0].order_status}, ${finalOrderRows[0].payment_status})`
    );

    // 5.7 Verify Idempotent Verification
    const replayVerifyRes = await request('POST', `/api/v1/payments/orders/${testOrderId}/verify`, {
      razorpayOrderId: checkout.razorpayOrderId,
      razorpayPaymentId: testPaymentId,
      razorpaySignature: generatedSig
    }, custToken);
    assert(replayVerifyRes.statusCode === 200, 'Replayed verification handled idempotently without error (HTTP 200)');

  } catch (err) {
    console.error('Fatal test suite error:', err);
    failedCount++;
  } finally {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  }

  console.log('\n================================================================');
  console.log(` Phase 17 Results: ${passedCount} PASSED, ${failedCount} FAILED`);
  console.log('================================================================\n');

  if (failedCount > 0) {
    process.exit(1);
  }
}

runPhase17Tests().then(() => {
  pool.end();
}).catch((err) => {
  console.error(err);
  process.exit(1);
});
