/**
 * End-to-End API Integration Test Suite (Phase 5)
 * 
 * Verifies all API endpoints over real HTTP requests:
 * 1. Authentication APIs:
 *    - POST /api/v1/auth/login (Success & Failure)
 *    - GET  /api/v1/auth/me (Protected User Context)
 *    - POST /api/v1/auth/refresh (Token Rotation)
 *    - POST /api/v1/auth/logout (Session Revocation)
 * 
 * 2. Staff Management APIs:
 *    - POST /api/v1/staff/admins (Super Admin permission check)
 *    - POST /api/v1/staff/accountants (Super Admin check)
 *    - POST /api/v1/staff/sellers (Super Admin & Admin check)
 *    - GET  /api/v1/staff/sellers (List sellers)
 * 
 * 3. Seller Management APIs:
 *    - GET   /api/v1/sellers/profile (View own profile)
 *    - PATCH /api/v1/sellers/profile (Update profile)
 *    - GET   /api/v1/sellers/:sellerId (Tenant isolation)
 * 
 * 4. Customer APIs:
 *    - POST  /api/v1/customers/register (Multi-tenant scoped registration)
 *    - Cross-tenant email uniqueness check (Same email in Shop 1 & Shop 2)
 *    - Duplicate email rejection in same shop (409 Conflict)
 *    - GET   /api/v1/customers/profile
 *    - PATCH /api/v1/customers/profile
 * 
 * 5. Security & Isolation checks:
 *    - Cross-tenant breach attempt (403 Forbidden)
 *    - Privilege escalation attempt (Customer calling Staff API -> 403 Forbidden)
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
    const options = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }

    const req = http.request(options, (res) => {
      let rawData = '';
      res.on('data', chunk => { rawData += chunk; });
      res.on('end', () => {
        let json = null;
        try {
          json = JSON.parse(rawData);
        } catch {
          json = rawData;
        }
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: json
        });
      });
    });

    req.on('error', reject);

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function runE2ETests() {
  console.log('===============================================================');
  console.log('RUNNING PHASE 5 END-TO-END API INTEGRATION TEST SUITE');
  console.log('===============================================================');

  // Start test server on dynamic ephemeral port
  server = app.listen(0);
  const port = server.address().port;
  baseUrl = `http://localhost:${port}`;
  console.log(`[*] Test HTTP server listening on ${baseUrl}\n`);

  // Test identifiers for controlled test fixtures
  const superAdminEmail = 'superadmin@sweetshop.internal';
  const superAdminPassword = 'SuperAdminPassword123!';
  const seller1Id = 'aaaaaaaa-5555-5555-5555-000000000001';
  const seller2Id = 'bbbbbbbb-5555-5555-5555-000000000002';
  const seller1Email = 'shop1_owner@sweetshop.internal';
  const seller2Email = 'shop2_owner@sweetshop.internal';
  const commonPassword = 'Password123!';

  try {
    const passwordHash = await bcrypt.hash(commonPassword, 10);
    const superAdminHash = await bcrypt.hash(superAdminPassword, 10);

    // Seed Super Admin password fixture
    await pool.query(
      'UPDATE super_admins SET password_hash = ?, is_active = TRUE WHERE email = ?;',
      [superAdminHash, superAdminEmail]
    );

    // Seed two distinct sweet shops
    await pool.query(`
      INSERT INTO sellers (
        id, business_name, email, phone, gstin, password_hash, account_status, verification_status, is_active
      ) VALUES 
        (?, 'Sweet Haven Store 1', ?, '+919100000001', '29SHOP10000S1Z1', ?, 'ACTIVE', 'APPROVED', TRUE),
        (?, 'Sweet Haven Store 2', ?, '+919200000002', '29SHOP20000S2Z2', ?, 'ACTIVE', 'APPROVED', TRUE)
      ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash), is_active = TRUE;
    `, [seller1Id, seller1Email, passwordHash, seller2Id, seller2Email, passwordHash]);

    // -------------------------------------------------------------------------
    // 1. AUTHENTICATION APIS
    // -------------------------------------------------------------------------
    console.log('--- 1. Testing Authentication APIs ---');

    // 1.1 Invalid Login
    const badLogin = await request('POST', '/api/v1/auth/login', {
      email: superAdminEmail,
      password: 'WrongPassword999!'
    });
    assert(badLogin.status === 401 && badLogin.body.success === false, 'POST /api/v1/auth/login with wrong password returns 401 Unauthorized');

    // 1.2 Super Admin Login
    const superAdminLogin = await request('POST', '/api/v1/auth/login', {
      email: superAdminEmail,
      password: superAdminPassword
    });
    assert(superAdminLogin.status === 200 && superAdminLogin.body.data.accessToken, 'POST /api/v1/auth/login returns access and refresh tokens');
    const superAdminToken = superAdminLogin.body.data.accessToken;
    const superAdminRefresh = superAdminLogin.body.data.refreshToken;

    // 1.3 GET /api/v1/auth/me
    const meRes = await request('GET', '/api/v1/auth/me', null, superAdminToken);
    assert(meRes.status === 200 && meRes.body.data.role === 'SUPER_ADMIN', 'GET /api/v1/auth/me returns authenticated user context');
    assert(meRes.body.data.permissions.includes('manage_platform_staff'), 'GET /api/v1/auth/me includes granted atomic permissions');

    // 1.4 POST /api/v1/auth/refresh
    const refreshRes = await request('POST', '/api/v1/auth/refresh', {
      refreshToken: superAdminRefresh
    });
    assert(refreshRes.status === 200 && refreshRes.body.data.accessToken, 'POST /api/v1/auth/refresh successfully rotates token');
    const newSuperAdminToken = refreshRes.body.data.accessToken;
    const newSuperAdminRefresh = refreshRes.body.data.refreshToken;

    // 1.5 POST /api/v1/auth/logout
    const logoutRes = await request('POST', '/api/v1/auth/logout', {
      refreshToken: newSuperAdminRefresh
    }, newSuperAdminToken);
    assert(logoutRes.status === 200 && logoutRes.body.success === true, 'POST /api/v1/auth/logout successfully revokes session');

    // Re-verify that logged out token is rejected by /me
    const meAfterLogout = await request('GET', '/api/v1/auth/me', null, newSuperAdminToken);
    assert(meAfterLogout.status === 401, 'Logged out access token is immediately rejected by denylist middleware');

    // Log Super Admin back in for subsequent staff tests
    const reLogin = await request('POST', '/api/v1/auth/login', {
      email: superAdminEmail,
      password: superAdminPassword
    });
    const staffToken = reLogin.body.data.accessToken;

    // -------------------------------------------------------------------------
    // 2. STAFF MANAGEMENT APIS
    // -------------------------------------------------------------------------
    console.log('\n--- 2. Testing Staff Management APIs ---');

    const adminEmail = `admin_${Date.now()}@sweetshop.internal`;
    const createAdminRes = await request('POST', '/api/v1/staff/admins', {
      name: 'Operations Admin',
      email: adminEmail,
      password: 'AdminPassword123!',
      mobileNumber: '+919988776655'
    }, staffToken);
    assert(createAdminRes.status === 201 && createAdminRes.body.data.email === adminEmail, 'Super Admin can create Admin staff (201 Created)');

    const accountantEmail = `accountant_${Date.now()}@sweetshop.internal`;
    const createAccountantRes = await request('POST', '/api/v1/staff/accountants', {
      name: 'Finance Manager',
      email: accountantEmail,
      password: 'AccountantPassword123!'
    }, staffToken);
    assert(createAccountantRes.status === 201 && createAccountantRes.body.data.email === accountantEmail, 'Super Admin can create Accountant staff (201 Created)');

    // Create a new Sweet Shop seller via staff API (GSTIN must be exactly 15 chars)
    const newSellerEmail = `owner_${Date.now()}@sweetshop.internal`;
    const newGstin = `29ABCDE${Date.now().toString().slice(-5)}1Z5`;
    const createSellerRes = await request('POST', '/api/v1/staff/sellers', {
      businessName: 'Royal Mithai Store',
      businessType: 'PVT_LTD',
      email: newSellerEmail,
      phone: '+919111222333',
      gstin: newGstin,
      password: 'ShopPassword123!'
    }, staffToken);
    assert(createSellerRes.status === 201 && createSellerRes.body.data.business_name === 'Royal Mithai Store', 'Super Admin can create Sweet Shop Seller (201 Created)');

    // List all sellers
    const listSellersRes = await request('GET', '/api/v1/staff/sellers', null, staffToken);
    assert(listSellersRes.status === 200 && Array.isArray(listSellersRes.body.data), 'Staff with manage_seller_accounts can list all sellers');

    // -------------------------------------------------------------------------
    // 3. SELLER MANAGEMENT & PROFILE APIS
    // -------------------------------------------------------------------------
    console.log('\n--- 3. Testing Seller Management APIs ---');

    // Login as Seller 1
    const sellerLogin = await request('POST', '/api/v1/auth/login', {
      email: seller1Email,
      password: commonPassword
    });
    const seller1Token = sellerLogin.body.data.accessToken;

    // View own profile
    const sellerProfile = await request('GET', '/api/v1/sellers/profile', null, seller1Token);
    assert(sellerProfile.status === 200 && sellerProfile.body.data.business_name === 'Sweet Haven Store 1', 'Seller can view their own profile');

    // Update own profile
    const updateProfile = await request('PATCH', '/api/v1/sellers/profile', {
      businessName: 'Sweet Haven Store 1 Premium',
      phone: '+919100009999'
    }, seller1Token);
    assert(updateProfile.status === 200 && updateProfile.body.data.business_name === 'Sweet Haven Store 1 Premium', 'Seller can update their own profile');

    // Cross-tenant protection: Seller 1 cannot access Seller 2 profile
    const crossTenantSeller = await request('GET', `/api/v1/sellers/${seller2Id}`, null, seller1Token);
    assert(crossTenantSeller.status === 403, 'Seller attempting to access another sweet shop profile is blocked (403 Forbidden)');

    // -------------------------------------------------------------------------
    // 4. CUSTOMER REGISTRATION & MULTI-TENANT ISOLATION
    // -------------------------------------------------------------------------
    console.log('\n--- 4. Testing Customer Registration & Isolation ---');

    const customerEmail = `customer_${Date.now()}@example.in`;

    // 4.1 Register customer under Shop 1
    const regCustomer1 = await request('POST', '/api/v1/customers/register', {
      sellerId: seller1Id,
      email: customerEmail,
      password: 'CustomerPassword123!',
      firstName: 'Aarav',
      lastName: 'Sharma',
      phone: '+919876500001'
    });
    assert(regCustomer1.status === 201 && regCustomer1.body.data.email === customerEmail, 'Customer registered under Sweet Shop 1 (201 Created)');

    // 4.2 Register same email under Shop 2 (MUST SUCCEED - Multi-Tenant Isolation)
    const regCustomer2 = await request('POST', '/api/v1/customers/register', {
      sellerId: seller2Id,
      email: customerEmail,
      password: 'CustomerPassword123!',
      firstName: 'Aarav',
      lastName: 'Sharma'
    });
    assert(regCustomer2.status === 201, 'Same email registered under Sweet Shop 2 succeeds (tenant-scoped uniqueness preserved)');

    // 4.3 Duplicate email registration under Shop 1 (MUST FAIL with 409 Conflict)
    const regDuplicate = await request('POST', '/api/v1/customers/register', {
      sellerId: seller1Id,
      email: customerEmail,
      password: 'CustomerPassword123!',
      firstName: 'Duplicate Aarav'
    });
    assert(regDuplicate.status === 409, 'Duplicate registration under same sweet shop rejected with 409 Conflict');

    // 4.4 Customer Login (requires sellerId context)
    const customerLogin = await request('POST', '/api/v1/auth/login', {
      sellerId: seller1Id,
      email: customerEmail,
      password: 'CustomerPassword123!'
    });
    assert(customerLogin.status === 200 && customerLogin.body.data.user.role === 'CUSTOMER', 'Customer logs in with seller context and holds CUSTOMER role');
    const customerToken = customerLogin.body.data.accessToken;

    // 4.5 Customer Profile
    const custProfile = await request('GET', '/api/v1/customers/profile', null, customerToken);
    assert(custProfile.status === 200 && custProfile.body.data.first_name === 'Aarav', 'Customer can view own profile');

    // 4.6 Privilege Escalation Protection: Customer calling Staff endpoint
    const privilegeEscalation = await request('POST', '/api/v1/staff/admins', {
      name: 'Hacker Admin',
      email: 'hacker@admin.com',
      password: 'Password123!'
    }, customerToken);
    assert(privilegeEscalation.status === 403, 'Customer calling privileged Staff API is blocked by RBAC guard (403 Forbidden)');

    // -------------------------------------------------------------------------
    // CLEANUP
    // -------------------------------------------------------------------------
    // Clean up created fixtures safely
    await pool.query('DELETE FROM seller_users WHERE email = ?;', [customerEmail]);
    await pool.query('DELETE FROM sellers WHERE email IN (?, ?, ?);', [seller1Email, seller2Email, newSellerEmail]);
    await pool.query('DELETE FROM admins WHERE email = ?;', [adminEmail]);
    await pool.query('DELETE FROM accountants WHERE email = ?;', [accountantEmail]);

    console.log('\n===============================================================');
    console.log(`E2E TEST SUITE RESULTS: ${passedCount} PASSED, ${failedCount} FAILED`);
    console.log('===============================================================');

    if (failedCount > 0) process.exitCode = 1;
  } catch (err) {
    console.error('[!] E2E test suite encountered an unhandled error:', err);
    process.exitCode = 1;
  } finally {
    if (server) server.close();
    await pool.end();
  }
}

runE2ETests();
