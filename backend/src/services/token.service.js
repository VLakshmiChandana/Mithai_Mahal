/**
 * Token Service
 * Responsible for:
 * 1. Generating cryptographically signed JWT access tokens with unique jti claims.
 * 2. Verifying access tokens and extracting payloads.
 * 3. Hashing token identifiers / tokens using SHA-256 for secure lookup.
 * 4. Generating cryptographically random refresh tokens and calculating their hashes.
 * 5. Checking access-token revocation against the jwt_tokens denylist.
 * 
 * Security:
 * - Never logs raw tokens, secrets, or hashes.
 * - Enforces cryptographically random jti via crypto.randomUUID().
 * - Uses SHA-256 for token storage (raw refresh tokens are never persisted).
 */

const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const config = require('../config/env');
const { pool } = require('../config/db');

/**
 * Computes a standard SHA-256 hex digest of a string or buffer.
 * Used for storing and querying refresh_tokens and jwt_tokens denylist.
 * @param {string} input 
 * @returns {string} 64-character lowercase hex string
 */
function hashSha256(input) {
  if (!input || typeof input !== 'string') {
    throw new Error('Invalid input for SHA-256 hashing.');
  }
  return crypto.createHash('sha256').update(input, 'utf8').digest('hex');
}

/**
 * Signs a short-lived access JWT.
 * 
 * Payload structure:
 * - sub: User Account ID (UUID)
 * - userType: Account Type ('SUPER_ADMIN', 'ADMIN', 'ACCOUNTANT', 'SELLER', 'CUSTOMER_CARE', 'CUSTOMER')
 * - role: Canonical role name
 * - sellerId: Tenant ID (string UUID or null for global staff)
 * - jti: Cryptographically secure unique token identifier (UUIDv4)
 * 
 * @param {Object} params
 * @param {string} params.userId
 * @param {string} params.userType
 * @param {string} params.role
 * @param {string|null} [params.sellerId=null]
 * @returns {string} Signed JWT access token
 */
function generateAccessToken({ userId, userType, role, sellerId = null }) {
  if (!userId || !userType || !role) {
    throw new Error('Missing required claims for access token generation.');
  }

  const jti = crypto.randomUUID();

  const payload = {
    sub: userId,
    userType,
    role,
    sellerId: sellerId || null,
    jti
  };

  return jwt.sign(payload, config.jwt.accessSecret, {
    expiresIn: config.jwt.accessExpiresIn,
    algorithm: 'HS256'
  });
}

/**
 * Verifies a JWT access token's cryptographic signature and expiration.
 * @param {string} token 
 * @returns {Object} Decoded payload
 */
function verifyAccessToken(token) {
  if (!token || typeof token !== 'string') {
    throw new Error('Access token is required for verification.');
  }
  return jwt.verify(token, config.jwt.accessSecret, {
    algorithms: ['HS256']
  });
}

/**
 * Generates an opaque, cryptographically random refresh token.
 * Returns the raw token (sent once to client) and its SHA-256 hash (stored in DB).
 * 
 * @returns {{ rawToken: string, tokenHash: string }}
 */
function generateRefreshToken() {
  // 32 cryptographically secure random bytes = 64 hex characters
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashSha256(rawToken);
  return { rawToken, tokenHash };
}

/**
 * Checks whether an access token has been revoked prematurely.
 * Uses SHA-256 of the token's jti to query the jwt_tokens denylist.
 * 
 * @param {string} jti - Unique token identifier from decoded JWT
 * @returns {Promise<boolean>} true if revoked, false otherwise
 */
async function isAccessTokenRevoked(jti) {
  if (!jti) return true;

  const accessHash = hashSha256(jti);

  const [rows] = await pool.query(
    `SELECT id FROM jwt_tokens 
     WHERE access_token_hash = ? 
       AND is_revoked = TRUE 
       AND access_token_expires_at > CURRENT_TIMESTAMP 
     LIMIT 1;`,
    [accessHash]
  );

  return rows.length > 0;
}

/**
 * Adds an access token to the jwt_tokens denylist upon explicit logout or revocation.
 * 
 * @param {Object} params
 * @param {string} params.jti - Unique token identifier from decoded JWT
 * @param {string} params.userId - Account ID
 * @param {string} params.userType - Account Type
 * @param {string|null} [params.sellerId=null] - Tenant ID (null for global accounts)
 * @param {number|Date} params.expiresAt - Expiration timestamp (seconds or Date)
 * @param {string|null} [params.deviceId=null]
 * @param {string|null} [params.ipAddress=null]
 * @param {string|null} [params.userAgent=null]
 */
async function revokeAccessToken({
  jti,
  userId,
  userType,
  sellerId = null,
  expiresAt,
  deviceId = null,
  ipAddress = null,
  userAgent = null
}) {
  if (!jti || !userId || !userType || !expiresAt) {
    throw new Error('Missing parameters required to revoke access token.');
  }

  const accessHash = hashSha256(jti);
  const expiryDate = expiresAt instanceof Date ? expiresAt : new Date(expiresAt * 1000);

  await pool.query(
    `INSERT INTO jwt_tokens (
      id, user_id, user_type, seller_id, access_token_hash, 
      token_type, device_id, ip_address, user_agent, 
      access_token_expires_at, revoked_at, is_revoked
    ) VALUES (
      UUID(), ?, ?, ?, ?, 
      'Bearer', ?, ?, ?, 
      ?, CURRENT_TIMESTAMP, TRUE
    )
    ON DUPLICATE KEY UPDATE 
      is_revoked = TRUE, 
      revoked_at = CURRENT_TIMESTAMP;`,
    [
      userId,
      userType,
      sellerId || null,
      accessHash,
      deviceId,
      ipAddress,
      userAgent,
      expiryDate
    ]
  );
}

module.exports = {
  hashSha256,
  generateAccessToken,
  verifyAccessToken,
  generateRefreshToken,
  isAccessTokenRevoked,
  revokeAccessToken
};
