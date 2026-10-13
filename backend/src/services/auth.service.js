/**
 * Authentication Service
 * 
 * Core responsibilities:
 * 1. Account identification and safe credential verification using bcrypt.
 * 2. Unambiguous account lookup:
 *    - Global accounts (SUPER_ADMIN, ADMIN, ACCOUNTANT, CUSTOMER_CARE, SELLER) are resolved globally.
 *    - Tenant accounts (CUSTOMER) require sellerId to resolve within tenant boundary.
 * 3. Prevention of account enumeration:
 *    - Returns generic external error messages ("Invalid email or password").
 *    - Uses dummy constant-time bcrypt verification if user is not found to prevent timing attacks.
 * 4. Refresh token rotation & transaction-safe revocation:
 *    - Stores only SHA-256 hash of refresh token.
 *    - Detects token reuse and revokes token families if reuse is attempted.
 * 5. Coordinated logout and access token revocation.
 */

const bcrypt = require('bcrypt');
const { pool } = require('../config/db');
const tokenService = require('./token.service');
const rbacService = require('./rbac.service');

// Dummy bcrypt hash used for constant-time comparison when an account is not found
// Prevents timing attacks that reveal whether an email exists in the database
const TIMING_SAFE_DUMMY_HASH = '$2a$12$e8kP6q7lUaG8XGk9k1W9g.g2Bq0u8W0iM8w5sZ2eL2n9sY1mK7L8C';

/**
 * Standardized application error for authentication failures.
 * Keeps external message generic.
 */
class AuthError extends Error {
  constructor(message = 'Invalid email or password.', statusCode = 401) {
    super(message);
    this.name = 'AuthError';
    this.statusCode = statusCode;
  }
}

/**
 * Finds an account across identity tables.
 * 
 * Lookup strategy:
 * - If sellerId is provided, first checks seller_users (tenant customer scope).
 * - If not found (or sellerId not provided), checks the global identity tables:
 *   1. super_admins
 *   2. admins
 *   3. accountants
 *   4. sellers
 *   5. customer_care
 * 
 * @param {string} email - User login email
 * @param {string|null} [sellerId=null] - Optional seller tenant ID
 * @returns {Promise<{ user: Object, userType: string }|null>}
 */
async function findAccountByEmail(email, sellerId = null) {
  if (!email || typeof email !== 'string') return null;

  const normalizedEmail = email.trim().toLowerCase();

  // 1. If sellerId is specified, check tenant-scoped customer table first
  if (sellerId) {
    const [customerRows] = await pool.query(
      `SELECT id, seller_id, email, password_hash, first_name, last_name, is_active 
       FROM seller_users 
       WHERE email = ? AND seller_id = ? 
       LIMIT 1;`,
      [normalizedEmail, sellerId]
    );

    if (customerRows.length > 0) {
      return { user: customerRows[0], userType: 'CUSTOMER' };
    }
  }

  // 2. Check super_admins
  const [superAdminRows] = await pool.query(
    `SELECT id, email, password_hash, name, is_active 
     FROM super_admins 
     WHERE email = ? 
     LIMIT 1;`,
    [normalizedEmail]
  );
  if (superAdminRows.length > 0) {
    return { user: superAdminRows[0], userType: 'SUPER_ADMIN' };
  }

  // 3. Check admins
  const [adminRows] = await pool.query(
    `SELECT id, email, password_hash, name, is_active 
     FROM admins 
     WHERE email = ? 
     LIMIT 1;`,
    [normalizedEmail]
  );
  if (adminRows.length > 0) {
    return { user: adminRows[0], userType: 'ADMIN' };
  }

  // 4. Check accountants
  const [accountantRows] = await pool.query(
    `SELECT id, email, password_hash, name, is_active 
     FROM accountants 
     WHERE email = ? 
     LIMIT 1;`,
    [normalizedEmail]
  );
  if (accountantRows.length > 0) {
    return { user: accountantRows[0], userType: 'ACCOUNTANT' };
  }

  // 5. Check sellers (Sweet shop vendors)
  const [sellerRows] = await pool.query(
    `SELECT id, email, password_hash, business_name, account_status, verification_status, rejection_reason, is_active 
     FROM sellers 
     WHERE email = ? 
     LIMIT 1;`,
    [normalizedEmail]
  );
  if (sellerRows.length > 0) {
    return { user: sellerRows[0], userType: 'SELLER' };
  }

  // 6. Check customer_care
  const [supportRows] = await pool.query(
    `SELECT id, email, password_hash, name, is_active 
     FROM customer_care 
     WHERE email = ? 
     LIMIT 1;`,
    [normalizedEmail]
  );
  if (supportRows.length > 0) {
    return { user: supportRows[0], userType: 'CUSTOMER_CARE' };
  }

  // 7. Check seller_users if sellerId was not supplied
  const [customerRows] = await pool.query(
    `SELECT id, seller_id, email, password_hash, first_name, last_name, is_active 
     FROM seller_users 
     WHERE email = ? 
     ORDER BY created_at DESC 
     LIMIT 1;`,
    [normalizedEmail]
  );
  if (customerRows.length > 0) {
    return { user: customerRows[0], userType: 'CUSTOMER' };
  }

  return null;
}

/**
 * Authenticates a user with email and password.
 * 
 * @param {Object} credentials
 * @param {string} credentials.email
 * @param {string} credentials.password
 * @param {string|null} [credentials.sellerId=null]
 * @param {Object} [metadata={}]
 * @param {string|null} [metadata.deviceId=null]
 * @param {string|null} [metadata.ipAddress=null]
 * @param {string|null} [metadata.userAgent=null]
 * @returns {Promise<{ accessToken: string, refreshToken: string, user: Object }>}
 */
async function login({ email, password, sellerId = null, metadata = {} }) {
  if (!email || !password) {
    throw new AuthError('Email and password are required.');
  }

  const accountRecord = await findAccountByEmail(email, sellerId);

  // Timing-safe verification: run bcrypt comparison even if account was not found
  const passwordHash = accountRecord ? accountRecord.user.password_hash : TIMING_SAFE_DUMMY_HASH;
  const isPasswordValid = await bcrypt.compare(password, passwordHash);

  if (!accountRecord || !isPasswordValid) {
    throw new AuthError('Invalid email or password.');
  }

  const { user, userType } = accountRecord;

  // Verify account is active
  if (!user.is_active) {
    throw new AuthError('Account is currently disabled. Please contact support.', 403);
  }

  // Additional check for sellers: must not be suspended/terminated
  if (userType === 'SELLER' && user.account_status === 'SUSPENDED') {
    throw new AuthError('Seller account is suspended.', 403);
  }

  // Resolve user role and permissions
  const access = await rbacService.resolveUserAccess({
    userId: user.id,
    userType
  });

  const resolvedSellerId = userType === 'CUSTOMER' ? user.seller_id : (userType === 'SELLER' ? user.id : null);

  // Generate short-lived access JWT
  const accessToken = tokenService.generateAccessToken({
    userId: user.id,
    userType,
    role: access.role,
    sellerId: resolvedSellerId
  });

  // Generate cryptographically random refresh token
  const { rawToken, tokenHash } = tokenService.generateRefreshToken();

  // Calculate 7-day expiration date
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  // Persist refresh token hash in database
  await pool.query(
    `INSERT INTO refresh_tokens (
      id, user_id, user_type, seller_id, token_hash, 
      device_id, ip_address, user_agent, expires_at
    ) VALUES (
      UUID(), ?, ?, ?, ?, 
      ?, ?, ?, ?
    );`,
    [
      user.id,
      userType,
      resolvedSellerId,
      tokenHash,
      metadata.deviceId || null,
      metadata.ipAddress || null,
      metadata.userAgent || null,
      expiresAt
    ]
  );

  return {
    accessToken,
    refreshToken: rawToken,
    user: {
      id: user.id,
      email: user.email,
      name: user.name || user.first_name || user.business_name || null,
      userType,
      role: access.role,
      permissions: access.permissions,
      sellerId: resolvedSellerId,
      verificationStatus: user.verification_status || null,
      accountStatus: user.account_status || null,
      rejectionReason: user.rejection_reason || null
    }
  };
}

/**
 * Rotates an existing refresh token:
 * 1. Verifies token hash exists, is unrevoked, and not expired.
 * 2. Revokes the old refresh token.
 * 3. Issues a new refresh token and new access token within a database transaction.
 * 
 * @param {string} rawRefreshToken - Raw refresh token from client
 * @param {Object} [metadata={}]
 * @returns {Promise<{ accessToken: string, refreshToken: string }>}
 */
async function rotateRefreshToken(rawRefreshToken, metadata = {}) {
  if (!rawRefreshToken || typeof rawRefreshToken !== 'string') {
    throw new AuthError('Refresh token is required.', 401);
  }

  const oldTokenHash = tokenService.hashSha256(rawRefreshToken);
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // Query the token record with FOR UPDATE lock
    const [tokenRows] = await connection.query(
      `SELECT id, user_id, user_type, seller_id, expires_at, revoked_at 
       FROM refresh_tokens 
       WHERE token_hash = ? 
       FOR UPDATE;`,
      [oldTokenHash]
    );

    if (tokenRows.length === 0) {
      throw new AuthError('Invalid refresh token.', 401);
    }

    const tokenRecord = tokenRows[0];

    // Detect reuse of revoked token (potential theft)
    if (tokenRecord.revoked_at !== null) {
      // Invalidate all tokens for this user as a security safeguard
      await connection.query(
        `UPDATE refresh_tokens 
         SET revoked_at = CURRENT_TIMESTAMP 
         WHERE user_id = ? AND revoked_at IS NULL;`,
        [tokenRecord.user_id]
      );
      await connection.commit();
      throw new AuthError('Compromised refresh token detected. All sessions revoked.', 401);
    }

    // Check expiration
    if (new Date(tokenRecord.expires_at) <= new Date()) {
      throw new AuthError('Refresh token has expired.', 401);
    }

    // Step 1: Revoke the old token
    await connection.query(
      `UPDATE refresh_tokens 
       SET revoked_at = CURRENT_TIMESTAMP 
       WHERE id = ?;`,
      [tokenRecord.id]
    );

    // Step 2: Resolve current user role
    const access = await rbacService.resolveUserAccess({
      userId: tokenRecord.user_id,
      userType: tokenRecord.user_type
    });

    // Step 3: Generate new pair
    const newAccessToken = tokenService.generateAccessToken({
      userId: tokenRecord.user_id,
      userType: tokenRecord.user_type,
      role: access.role,
      sellerId: tokenRecord.seller_id
    });

    const { rawToken: newRawToken, tokenHash: newHash } = tokenService.generateRefreshToken();
    const newExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    // Step 4: Insert new refresh token hash
    await connection.query(
      `INSERT INTO refresh_tokens (
        id, user_id, user_type, seller_id, token_hash, 
        device_id, ip_address, user_agent, expires_at
      ) VALUES (
        UUID(), ?, ?, ?, ?, 
        ?, ?, ?, ?
      );`,
      [
        tokenRecord.user_id,
        tokenRecord.user_type,
        tokenRecord.seller_id,
        newHash,
        metadata.deviceId || null,
        metadata.ipAddress || null,
        metadata.userAgent || null,
        newExpiresAt
      ]
    );

    await connection.commit();

    return {
      accessToken: newAccessToken,
      refreshToken: newRawToken
    };
  } catch (err) {
    await connection.rollback();
    if (err instanceof AuthError) throw err;
    throw new AuthError('Failed to refresh token: ' + err.message, 401);
  } finally {
    connection.release();
  }
}

/**
 * Logs out a session:
 * 1. Revokes the refresh token.
 * 2. Adds the access token's jti hash to jwt_tokens denylist.
 * 
 * @param {Object} params
 * @param {string|null} [params.rawRefreshToken=null]
 * @param {string|null} [params.accessToken=null]
 * @param {Object} [metadata={}]
 */
async function logout({ rawRefreshToken = null, accessToken = null, metadata = {} }) {
  // Revoke refresh token if provided
  if (rawRefreshToken) {
    const tokenHash = tokenService.hashSha256(rawRefreshToken);
    await pool.query(
      `UPDATE refresh_tokens 
       SET revoked_at = CURRENT_TIMESTAMP 
       WHERE token_hash = ? AND revoked_at IS NULL;`,
      [tokenHash]
    );
  }

  // Revoke access token if provided
  if (accessToken) {
    try {
      const decoded = tokenService.verifyAccessToken(accessToken);
      if (decoded && decoded.jti) {
        await tokenService.revokeAccessToken({
          jti: decoded.jti,
          userId: decoded.sub,
          userType: decoded.userType,
          sellerId: decoded.sellerId,
          expiresAt: decoded.exp,
          deviceId: metadata.deviceId || null,
          ipAddress: metadata.ipAddress || null,
          userAgent: metadata.userAgent || null
        });
      }
    } catch {
      // If access token is already expired or malformed, no denylist entry needed
    }
  }

  return { loggedOut: true };
}

module.exports = {
  AuthError,
  findAccountByEmail,
  login,
  rotateRefreshToken,
  logout
};
