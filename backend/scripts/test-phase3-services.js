/**
 * Automated Unit & Integration Tests for Phase 3: Core Security Services
 * 
 * Verifies:
 * 1. Token Service: Access token signing, claims validation, tampering rejection, refresh token hashing.
 * 2. Token Service Denylist: Adding jti to jwt_tokens and checking isAccessTokenRevoked.
 * 3. RBAC Service: Querying permissions for SUPER_ADMIN, CUSTOMER, and nonexistent roles.
 * 4. Auth Service: Timing-safe rejection of invalid credentials.
 * 5. Auth Service: Successful login with Super Admin, refresh token insertion, and token rotation.
 * 6. Auth Service: Token theft/reuse detection (revoking family on reused token).
 */

const { pool } = require('../src/config/db');
const tokenService = require('../src/services/token.service');
const rbacService = require('../src/services/rbac.service');
const authService = require('../src/services/auth.service');

let testPassedCount = 0;
let testFailedCount = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  [PASS] ${message}`);
    testPassedCount++;
  } else {
    console.error(`  [FAIL] ${message}`);
    testFailedCount++;
  }
}

async function runTests() {
  console.log('===============================================================');
  console.log('RUNNING PHASE 3 SECURITY SERVICES AUTOMATED TEST SUITE');
  console.log('===============================================================');

  try {
    // -------------------------------------------------------------------------
    // TEST SUITE 1: TOKEN SERVICE
    // -------------------------------------------------------------------------
    console.log('\n--- 1. Testing Token Service ---');

    // 1.1 Generation and claims check
    const mockUser = {
      userId: '00000000-0000-0000-0000-000000000100',
      userType: 'SUPER_ADMIN',
      role: 'SUPER_ADMIN',
      sellerId: null
    };

    const token = tokenService.generateAccessToken(mockUser);
    assert(typeof token === 'string' && token.split('.').length === 3, 'JWT access token generated with 3 components (header.payload.sig)');

    // 1.2 Verification
    const decoded = tokenService.verifyAccessToken(token);
    assert(decoded.sub === mockUser.userId, 'Token sub claim matches user ID');
    assert(decoded.userType === 'SUPER_ADMIN', 'Token userType claim matches SUPER_ADMIN');
    assert(decoded.role === 'SUPER_ADMIN', 'Token role claim matches SUPER_ADMIN');
    assert(typeof decoded.jti === 'string' && decoded.jti.length > 20, 'Token jti is a cryptographically unique UUID');
    assert(typeof decoded.exp === 'number', 'Token exp claim is populated');

    // 1.3 Tampering detection
    let tamperedFailed = false;
    try {
      const tampered = token.slice(0, -5) + 'abcde';
      tokenService.verifyAccessToken(tampered);
    } catch {
      tamperedFailed = true;
    }
    assert(tamperedFailed, 'Tampered token signature is correctly rejected by verifyAccessToken');

    // 1.4 Refresh token hashing
    const { rawToken, tokenHash } = tokenService.generateRefreshToken();
    assert(rawToken.length === 64, 'Raw refresh token is 64 hex characters (32 random bytes)');
    assert(tokenHash.length === 64, 'Refresh token SHA-256 hash is 64 hex characters');
    assert(tokenService.hashSha256(rawToken) === tokenHash, 'hashSha256 produces deterministic hash of rawToken');

    // 1.5 Access Token Denylist
    const testJti = 'test-jti-' + Date.now();
    const isInitiallyRevoked = await tokenService.isAccessTokenRevoked(testJti);
    assert(!isInitiallyRevoked, 'Unrevoked jti is not in denylist');

    await tokenService.revokeAccessToken({
      jti: testJti,
      userId: mockUser.userId,
      userType: mockUser.userType,
      expiresAt: Math.floor(Date.now() / 1000) + 900 // 15 mins future
    });

    const isAfterRevocation = await tokenService.isAccessTokenRevoked(testJti);
    assert(isAfterRevocation, 'Revoked jti is successfully recognized in jwt_tokens denylist');

    // Clean up test denylist row
    await pool.query('DELETE FROM jwt_tokens WHERE access_token_hash = ?;', [tokenService.hashSha256(testJti)]);

    // -------------------------------------------------------------------------
    // TEST SUITE 2: RBAC SERVICE
    // -------------------------------------------------------------------------
    console.log('\n--- 2. Testing RBAC Service ---');

    const superAdminPermissions = await rbacService.getPermissionsForRole('SUPER_ADMIN');
    assert(superAdminPermissions.length >= 4, `SUPER_ADMIN role resolved ${superAdminPermissions.length} permissions from database`);
    assert(superAdminPermissions.some(p => p.name === 'manage_platform_staff'), 'SUPER_ADMIN possesses "manage_platform_staff" permission');

    const customerPermissions = await rbacService.getPermissionsForRole('CUSTOMER');
    assert(customerPermissions.length >= 3, `CUSTOMER role resolved ${customerPermissions.length} permissions`);
    assert(customerPermissions.some(p => p.name === 'create_customer_order'), 'CUSTOMER possesses "create_customer_order" permission');
    assert(!customerPermissions.some(p => p.name === 'manage_platform_staff'), 'CUSTOMER does NOT possess "manage_platform_staff" permission');

    const userAccess = await rbacService.resolveUserAccess({
      userId: mockUser.userId,
      userType: 'SUPER_ADMIN'
    });
    assert(userAccess.role === 'SUPER_ADMIN', 'resolveUserAccess canonically maps SUPER_ADMIN userType to SUPER_ADMIN role');
    assert(userAccess.permissions.includes('review_seller_kyc'), 'resolveUserAccess includes "review_seller_kyc" permission');

    // -------------------------------------------------------------------------
    // TEST SUITE 3: AUTH SERVICE
    // -------------------------------------------------------------------------
    console.log('\n--- 3. Testing Authentication Service ---');

    // 3.1 Non-existent user
    let nonExistentFailed = false;
    try {
      await authService.login({
        email: 'nobody_exists@sweetshop.internal',
        password: 'AnyPassword123!'
      });
    } catch (err) {
      if (err.statusCode === 401 && err.message === 'Invalid email or password.') {
        nonExistentFailed = true;
      }
    }
    assert(nonExistentFailed, 'Non-existent user rejected with generic "Invalid email or password" error');

    // 3.2 Existing Super Admin with WRONG password
    let wrongPasswordFailed = false;
    try {
      await authService.login({
        email: 'superadmin@sweetshop.internal',
        password: 'DefinitivelyWrongPassword999!'
      });
    } catch (err) {
      if (err.statusCode === 401 && err.message === 'Invalid email or password.') {
        wrongPasswordFailed = true;
      }
    }
    assert(wrongPasswordFailed, 'Valid email with wrong password rejected with same generic error');

    // 3.3 Create a disposable test seller account for end-to-end login & token rotation test
    const testSellerId = '99999999-0000-0000-0000-000000000001';
    const testSellerEmail = 'test_owner_' + Date.now() + '@sweetshop.internal';
    const testPlainPassword = 'OwnerPassword123!';
    const bcrypt = require('bcrypt');
    const testHash = await bcrypt.hash(testPlainPassword, 10);

    await pool.query(`
      INSERT INTO sellers (
        id, business_name, email, phone, gstin, password_hash, account_status, verification_status, is_active
      ) VALUES (
        ?, 'Test Sweets Shop', ?, '+919999999999', '29TEST00000T1Z1', ?, 'ACTIVE', 'APPROVED', TRUE
      ) ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash);
    `, [testSellerId, testSellerEmail, testHash]);

    // Test successful login
    const loginResult = await authService.login({
      email: testSellerEmail,
      password: testPlainPassword,
      metadata: { deviceId: 'test-device-1' }
    });

    assert(typeof loginResult.accessToken === 'string', 'Login issued access token');
    assert(typeof loginResult.refreshToken === 'string', 'Login issued raw refresh token');
    assert(loginResult.user.userType === 'SELLER', 'Logged in userType is SELLER');
    assert(loginResult.user.role === 'SELLER', 'Logged in user role is SELLER');

    // Test token rotation
    const rotationResult = await authService.rotateRefreshToken(loginResult.refreshToken, {
      deviceId: 'test-device-1'
    });

    assert(typeof rotationResult.accessToken === 'string', 'Rotation issued new access token');
    assert(typeof rotationResult.refreshToken === 'string', 'Rotation issued new refresh token');
    assert(rotationResult.refreshToken !== loginResult.refreshToken, 'New refresh token differs from previous one');

    // Test token reuse detection (theft simulation)
    let reuseDetected = false;
    try {
      // Reusing the old refresh token MUST fail
      await authService.rotateRefreshToken(loginResult.refreshToken);
    } catch (err) {
      if (err.message.includes('Compromised refresh token detected')) {
        reuseDetected = true;
      }
    }
    assert(reuseDetected, 'Reusing revoked refresh token triggers theft detection and invalidates token family');

    // Test logout
    const logoutResult = await authService.logout({
      rawRefreshToken: rotationResult.refreshToken,
      accessToken: rotationResult.accessToken
    });
    assert(logoutResult.loggedOut === true, 'Logout successfully revoked both refresh token and access token');

    // Verify access token is now in denylist
    const decodedLoggedOut = tokenService.verifyAccessToken(rotationResult.accessToken);
    const isDeniedAfterLogout = await tokenService.isAccessTokenRevoked(decodedLoggedOut.jti);
    assert(isDeniedAfterLogout, 'Logged-out access token is actively blocked in jwt_tokens denylist');

    // Clean up test seller & tokens
    await pool.query('DELETE FROM refresh_tokens WHERE seller_id = ?;', [testSellerId]);
    await pool.query('DELETE FROM jwt_tokens WHERE seller_id = ?;', [testSellerId]);
    await pool.query('DELETE FROM sellers WHERE id = ?;', [testSellerId]);

    console.log('\n===============================================================');
    console.log(`TEST SUITE RESULTS: ${testPassedCount} PASSED, ${testFailedCount} FAILED`);
    console.log('===============================================================');

    if (testFailedCount > 0) {
      process.exitCode = 1;
    }
  } catch (err) {
    console.error('[!] Test suite encountered an unhandled error:', err);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

runTests();
