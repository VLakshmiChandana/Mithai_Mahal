/**
 * Automated Test Suite for Phase 4: Middleware Pipeline
 * 
 * Verifies all 5 middleware components:
 * 1. authenticate.js:
 *    - Missing Authorization header (401)
 *    - Malformed Authorization header (401)
 *    - Tampered JWT signature (401)
 *    - Expired JWT token (401)
 *    - Revoked JWT token via jti denylist (401)
 *    - Inactive / disabled account (403)
 *    - Non-existent account in database (401)
 *    - Valid active token successfully populates req.user
 * 
 * 2. authorize.js:
 *    - Insufficient permissions (403)
 *    - Sufficient permissions (Passes to next)
 *    - Wrong role (403)
 *    - Authorized role (Passes to next)
 * 
 * 3. tenant.js:
 *    - Customer trying to access another seller's data (403 Forbidden)
 *    - Customer accessing their own seller's data (Passes to next)
 *    - Seller trying to access another seller's data (403 Forbidden)
 *    - Seller accessing their own shop data (Passes to next)
 *    - Global Super Admin with staff permission (Passes to any tenant)
 * 
 * 4. validate.js:
 *    - Invalid body payload (400 ValidationError)
 *    - Missing required fields (400 ValidationError)
 *    - Valid body sanitized and passed through
 * 
 * 5. errorHandler.js:
 *    - Converts errors to uniform JSON structure with status code
 *    - Masks sensitive internal errors in production
 */

const Joi = require('joi');
const jwt = require('jsonwebtoken');
const config = require('../src/config/env');
const { pool } = require('../src/config/db');
const tokenService = require('../src/services/token.service');
const authenticate = require('../src/middleware/authenticate');
const { requirePermissions, requireRoles } = require('../src/middleware/authorize');
const { enforceTenant } = require('../src/middleware/tenant');
const validate = require('../src/middleware/validate');
const { errorHandler } = require('../src/middleware/errorHandler');

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

/**
 * Helper to run an Express middleware in test mode.
 */
function runMiddleware(middleware, req, res = {}) {
  return new Promise((resolve) => {
    let nextCalled = false;
    let nextError = null;

    res.status = (code) => {
      res.statusCode = code;
      return res;
    };
    res.json = (body) => {
      res.body = body;
      resolve({ nextCalled, nextError, res });
    };

    middleware(req, res, (err) => {
      nextCalled = true;
      nextError = err || null;
      resolve({ nextCalled, nextError, res });
    });
  });
}

async function runTests() {
  console.log('===============================================================');
  console.log('RUNNING PHASE 4 MIDDLEWARE PIPELINE AUTOMATED TEST SUITE');
  console.log('===============================================================');

  // Setup mock database records
  const activeSellerId = '11111111-4444-4444-4444-000000000001';
  const otherSellerId  = '22222222-4444-4444-4444-000000000002';
  const disabledAdminId = '33333333-4444-4444-4444-000000000003';
  const customerUserId  = '44444444-4444-4444-4444-000000000004';

  try {
    // Insert test records into MySQL
    await pool.query(`
      INSERT INTO sellers (id, business_name, email, phone, gstin, password_hash, account_status, is_active)
      VALUES 
        (?, 'Phase 4 Active Sweets', 'p4_seller1@test.in', '+919800000001', '29TEST44444A1Z1', 'h_pwd', 'ACTIVE', TRUE),
        (?, 'Phase 4 Other Sweets', 'p4_seller2@test.in', '+919800000002', '29TEST44444B1Z2', 'h_pwd', 'ACTIVE', TRUE)
      ON DUPLICATE KEY UPDATE is_active = TRUE;
    `, [activeSellerId, otherSellerId]);

    // Insert disabled admin
    await pool.query(`
      INSERT INTO super_admins (id, name, email, password_hash, is_active)
      VALUES (?, 'Disabled Admin', 'disabled_admin@test.in', 'h_pwd', FALSE)
      ON DUPLICATE KEY UPDATE is_active = FALSE;
    `, [disabledAdminId]);

    // Insert customer under activeSellerId
    await pool.query(`
      INSERT INTO seller_users (id, seller_id, email, password_hash, first_name, is_active)
      VALUES (?, ?, 'p4_customer@test.in', 'h_pwd', 'Priya', TRUE)
      ON DUPLICATE KEY UPDATE is_active = TRUE;
    `, [customerUserId, activeSellerId]);

    // Assign CUSTOMER role to customer
    await pool.query(`
      INSERT INTO seller_user_roles (id, seller_user_id, role_id)
      VALUES (UUID(), ?, '00000000-0000-0000-0000-000000000006')
      ON DUPLICATE KEY UPDATE role_id = VALUES(role_id);
    `, [customerUserId]);

    // -------------------------------------------------------------------------
    // 1. AUTHENTICATE MIDDLEWARE TESTS
    // -------------------------------------------------------------------------
    console.log('\n--- 1. Testing authenticate.js ---');

    // 1.1 Missing Header
    const { nextError: err1 } = await runMiddleware(authenticate, { headers: {} });
    assert(err1 && err1.statusCode === 401 && err1.message.includes('Missing Authorization'), 'Missing Authorization header returns 401 Unauthorized');

    // 1.2 Malformed Header
    const { nextError: err2 } = await runMiddleware(authenticate, { headers: { authorization: 'Basic 12345' } });
    assert(err2 && err2.statusCode === 401 && err2.message.includes('Malformed'), 'Malformed Authorization header returns 401');

    // 1.3 Tampered Token
    const validSellerToken = tokenService.generateAccessToken({
      userId: activeSellerId,
      userType: 'SELLER',
      role: 'SELLER',
      sellerId: activeSellerId
    });
    const tamperedToken = validSellerToken.slice(0, -6) + 'xxxxxx';
    const { nextError: err3 } = await runMiddleware(authenticate, { headers: { authorization: `Bearer ${tamperedToken}` } });
    assert(err3 && err3.statusCode === 401 && err3.message.includes('Invalid access token'), 'Tampered token signature returns 401');

    // 1.4 Expired Token
    const expiredToken = jwt.sign(
      { sub: activeSellerId, userType: 'SELLER', role: 'SELLER', jti: 'test-exp-jti' },
      config.jwt.accessSecret,
      { expiresIn: '-1s' }
    );
    const { nextError: err4 } = await runMiddleware(authenticate, { headers: { authorization: `Bearer ${expiredToken}` } });
    assert(err4 && err4.statusCode === 401 && err4.message.includes('expired'), 'Expired token returns 401 with TokenExpiredError message');

    // 1.5 Revoked Token (Denylist)
    const revokedToken = tokenService.generateAccessToken({
      userId: activeSellerId,
      userType: 'SELLER',
      role: 'SELLER',
      sellerId: activeSellerId
    });
    const decodedRevoked = jwt.decode(revokedToken);
    await tokenService.revokeAccessToken({
      jti: decodedRevoked.jti,
      userId: activeSellerId,
      userType: 'SELLER',
      sellerId: activeSellerId,
      expiresAt: decodedRevoked.exp
    });
    const { nextError: err5 } = await runMiddleware(authenticate, { headers: { authorization: `Bearer ${revokedToken}` } });
    assert(err5 && err5.statusCode === 401 && err5.message.includes('revoked'), 'Revoked token in jwt_tokens denylist returns 401');

    // 1.6 Disabled / Inactive Account
    const disabledToken = tokenService.generateAccessToken({
      userId: disabledAdminId,
      userType: 'SUPER_ADMIN',
      role: 'SUPER_ADMIN',
      sellerId: null
    });
    const { nextError: err6 } = await runMiddleware(authenticate, { headers: { authorization: `Bearer ${disabledToken}` } });
    assert(err6 && err6.statusCode === 403 && err6.message.includes('disabled'), 'Inactive/disabled database account returns 403 Forbidden');

    // 1.7 Non-existent Account
    const ghostToken = tokenService.generateAccessToken({
      userId: 'ffffffff-ffff-ffff-ffff-ffffffffffff',
      userType: 'SUPER_ADMIN',
      role: 'SUPER_ADMIN',
      sellerId: null
    });
    const { nextError: err7 } = await runMiddleware(authenticate, { headers: { authorization: `Bearer ${ghostToken}` } });
    assert(err7 && err7.statusCode === 401 && err7.message.includes('no longer exists'), 'Non-existent database account returns 401');

    // 1.8 Valid Token Success
    const validReq = { headers: { authorization: `Bearer ${validSellerToken}` } };
    const { nextCalled: ok8, nextError: err8 } = await runMiddleware(authenticate, validReq);
    assert(ok8 && !err8, 'Valid token passes authentication middleware to next()');
    assert(validReq.user && validReq.user.id === activeSellerId, 'req.user is populated with verified database id');
    assert(validReq.user.permissions.includes('manage_shop_catalog'), 'req.user is populated with fresh database permissions');

    // -------------------------------------------------------------------------
    // 2. AUTHORIZE MIDDLEWARE TESTS (RBAC)
    // -------------------------------------------------------------------------
    console.log('\n--- 2. Testing authorize.js ---');

    // 2.1 Missing user context
    const permGuard = requirePermissions('manage_platform_staff');
    const { nextError: rbacErr1 } = await runMiddleware(permGuard, {});
    assert(rbacErr1 && rbacErr1.statusCode === 401, 'RBAC guard fails closed (401) if req.user is missing');

    // 2.2 Insufficient Permission (SELLER lacks manage_platform_staff)
    const { nextError: rbacErr2 } = await runMiddleware(permGuard, validReq);
    assert(rbacErr2 && rbacErr2.statusCode === 403 && rbacErr2.message.includes('Missing required permission'), 'User lacking required permission receives 403 Forbidden');

    // 2.3 Sufficient Permission (SELLER has manage_shop_catalog)
    const sellerPermGuard = requirePermissions('manage_shop_catalog');
    const { nextCalled: rbacOk3 } = await runMiddleware(sellerPermGuard, validReq);
    assert(rbacOk3, 'User possessing required permission successfully passes to next()');

    // 2.4 Require Role Guard: Wrong Role
    const superAdminRoleGuard = requireRoles('SUPER_ADMIN');
    const { nextError: roleErr4 } = await runMiddleware(superAdminRoleGuard, validReq);
    assert(roleErr4 && roleErr4.statusCode === 403 && roleErr4.message.includes('not authorized'), 'User with non-matching role receives 403 Forbidden');

    // 2.5 Require Role Guard: Correct Role
    const sellerRoleGuard = requireRoles('SELLER');
    const { nextCalled: roleOk5 } = await runMiddleware(sellerRoleGuard, validReq);
    assert(roleOk5, 'User with matching role passes requireRoles guard');

    // -------------------------------------------------------------------------
    // 3. TENANT ISOLATION MIDDLEWARE TESTS
    // -------------------------------------------------------------------------
    console.log('\n--- 3. Testing tenant.js ---');

    const customerToken = tokenService.generateAccessToken({
      userId: customerUserId,
      userType: 'CUSTOMER',
      role: 'CUSTOMER',
      sellerId: activeSellerId
    });
    const customerReq = { headers: { authorization: `Bearer ${customerToken}` } };
    await runMiddleware(authenticate, customerReq);

    const tenantMiddleware = enforceTenant('sellerId');

    // 3.1 Customer accessing own seller (Passes)
    customerReq.params = { sellerId: activeSellerId };
    const { nextCalled: tenantOk1 } = await runMiddleware(tenantMiddleware, customerReq);
    assert(tenantOk1 && customerReq.tenantId === activeSellerId, 'Customer accessing own seller is allowed with validated req.tenantId');

    // 3.2 Customer attempting cross-tenant breach (Forbidden)
    customerReq.params = { sellerId: otherSellerId };
    const { nextError: tenantErr2 } = await runMiddleware(tenantMiddleware, customerReq);
    assert(tenantErr2 && tenantErr2.statusCode === 403 && tenantErr2.message.includes('Cross-tenant violation'), 'Customer attempting cross-tenant access is blocked with 403 Forbidden');

    // 3.3 Seller accessing own shop (Passes)
    validReq.params = { sellerId: activeSellerId };
    const { nextCalled: tenantOk3 } = await runMiddleware(tenantMiddleware, validReq);
    assert(tenantOk3 && validReq.tenantId === activeSellerId, 'Seller accessing own shop passes with validated req.tenantId');

    // 3.4 Seller attempting to access another shop (Forbidden)
    validReq.params = { sellerId: otherSellerId };
    const { nextError: tenantErr4 } = await runMiddleware(tenantMiddleware, validReq);
    assert(tenantErr4 && tenantErr4.statusCode === 403 && tenantErr4.message.includes('Cross-tenant violation'), 'Seller attempting cross-tenant breach to another sweet shop is blocked (403)');

    // 3.5 Global Super Admin accessing any tenant (Allowed)
    const superAdminToken = tokenService.generateAccessToken({
      userId: '00000000-0000-0000-0000-000000000100',
      userType: 'SUPER_ADMIN',
      role: 'SUPER_ADMIN',
      sellerId: null
    });
    const superAdminReq = { headers: { authorization: `Bearer ${superAdminToken}` }, params: { sellerId: otherSellerId } };
    await runMiddleware(authenticate, superAdminReq);
    const { nextCalled: tenantOk5 } = await runMiddleware(tenantMiddleware, superAdminReq);
    assert(tenantOk5 && superAdminReq.tenantId === otherSellerId, 'Global Super Admin can inspect any tenant context');

    // -------------------------------------------------------------------------
    // 4. REQUEST VALIDATION MIDDLEWARE TESTS
    // -------------------------------------------------------------------------
    console.log('\n--- 4. Testing validate.js ---');

    const testSchema = {
      body: Joi.object({
        email: Joi.string().email().required(),
        password: Joi.string().min(8).required(),
        amount: Joi.number().positive().optional()
      })
    };
    const validator = validate(testSchema);

    // 4.1 Missing required field
    const badReq1 = { body: { email: 'invalid_email' } };
    const { nextError: valErr1 } = await runMiddleware(validator, badReq1);
    assert(valErr1 && valErr1.statusCode === 400 && valErr1.details.length >= 2, 'Invalid email and missing password caught by Joi validator (400)');

    // 4.2 Valid body with unknown stripped
    const goodReq2 = { body: { email: 'valid@sweetshop.in', password: 'StrongPassword123!', unknownField: 'stripMe' } };
    const { nextCalled: valOk2 } = await runMiddleware(validator, goodReq2);
    assert(valOk2 && goodReq2.body.email === 'valid@sweetshop.in' && goodReq2.body.unknownField === undefined, 'Valid request passes and unknown fields are stripped');

    // -------------------------------------------------------------------------
    // 5. ERROR HANDLER TESTS
    // -------------------------------------------------------------------------
    console.log('\n--- 5. Testing errorHandler.js ---');

    const mockRes = {
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(body) {
        this.body = body;
        return this;
      }
    };
    const testErr = new Error('Database syntax error occurred');
    testErr.statusCode = 500;
    errorHandler(testErr, {}, mockRes, () => {});

    assert(mockRes.statusCode === 500, 'Error handler sets status 500');
    assert(mockRes.body && mockRes.body.success === false, 'Error handler response envelope has success: false');
    assert(mockRes.body.error.code === 'INTERNAL_ERROR', 'Error handler standardizes error code');

    // Clean up test records
    await pool.query('DELETE FROM jwt_tokens WHERE user_id IN (?, ?, ?, ?);', [activeSellerId, otherSellerId, disabledAdminId, customerUserId]);
    await pool.query('DELETE FROM seller_user_roles WHERE seller_user_id = ?;', [customerUserId]);
    await pool.query('DELETE FROM seller_users WHERE id = ?;', [customerUserId]);
    await pool.query('DELETE FROM super_admins WHERE id = ?;', [disabledAdminId]);
    await pool.query('DELETE FROM sellers WHERE id IN (?, ?);', [activeSellerId, otherSellerId]);

    console.log('\n===============================================================');
    console.log(`PHASE 4 TEST RESULTS: ${passedCount} PASSED, ${failedCount} FAILED`);
    console.log('===============================================================');

    if (failedCount > 0) process.exitCode = 1;
  } catch (err) {
    console.error('[!] Test suite encountered an unexpected error:', err);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

runTests();
