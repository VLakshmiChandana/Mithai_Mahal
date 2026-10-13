/**
 * Authentication Middleware
 * 
 * Responsibilities:
 * 1. Extract Bearer token from Authorization header.
 * 2. Cryptographically verify signature and expiry via token.service.
 * 3. Query the jwt_tokens denylist to reject prematurely revoked tokens.
 * 4. Verify account active status and existence directly in the database.
 * 5. Attach authenticated user context (req.user) containing id, userType, role, permissions, and sellerId.
 */

const { pool } = require('../config/db');
const tokenService = require('../services/token.service');
const rbacService = require('../services/rbac.service');
const { UnauthorizedError, ForbiddenError } = require('./errorHandler');

// Map userType to its backing identity table and primary active check column
const IDENTITY_TABLE_CONFIG = Object.freeze({
  SUPER_ADMIN: { table: 'super_admins', checkActive: true, checkStatus: 'name' },
  ADMIN: { table: 'admins', checkActive: true, checkStatus: 'name' },
  ACCOUNTANT: { table: 'accountants', checkActive: true, checkStatus: 'name' },
  CUSTOMER_CARE: { table: 'customer_care', checkActive: true, checkStatus: 'name' },
  SELLER: { table: 'sellers', checkActive: true, checkStatus: 'business_name, owner_name, logo, phone, account_status, verification_status, rejection_reason' },
  CUSTOMER: { table: 'seller_users', checkActive: true, checkStatus: 'first_name, last_name, seller_id' }
});

async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || typeof authHeader !== 'string') {
      throw new UnauthorizedError('Missing Authorization header. Expected Bearer token.');
    }

    const parts = authHeader.trim().split(' ');
    if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
      throw new UnauthorizedError('Malformed Authorization header. Format: Bearer <token>');
    }

    const token = parts[1];

    // 1. Verify cryptographic validity and expiration
    let decoded;
    try {
      decoded = tokenService.verifyAccessToken(token);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        throw new UnauthorizedError('Access token has expired.');
      }
      throw new UnauthorizedError('Invalid access token signature or format.');
    }

    // 2. Check jwt_tokens denylist via unique jti hash
    if (!decoded.jti) {
      throw new UnauthorizedError('Invalid token: Missing jti claim.');
    }

    const isRevoked = await tokenService.isAccessTokenRevoked(decoded.jti);
    if (isRevoked) {
      throw new UnauthorizedError('Access token has been revoked.');
    }

    // 3. Resolve user identity and active status from MySQL (Do not trust token blindly)
    const tableConfig = IDENTITY_TABLE_CONFIG[decoded.userType];
    if (!tableConfig) {
      throw new UnauthorizedError('Unrecognized user type in token.');
    }

    const [rows] = await pool.query(
      `SELECT id, email, is_active ${tableConfig.checkStatus ? `, ${tableConfig.checkStatus}` : ''} 
       FROM ${tableConfig.table} 
       WHERE id = ? 
       LIMIT 1;`,
      [decoded.sub]
    );

    if (rows.length === 0) {
      throw new UnauthorizedError('Account no longer exists.');
    }

    const dbUser = rows[0];

    // Reject inactive accounts
    if (!dbUser.is_active) {
      throw new ForbiddenError('Account is disabled.');
    }

    // Additional seller check
    if (decoded.userType === 'SELLER' && dbUser.account_status === 'SUSPENDED') {
      throw new ForbiddenError('Seller account is suspended.');
    }

    // 4. Resolve fresh permissions from RBAC service (Guarantees recent privilege changes apply)
    const access = await rbacService.resolveUserAccess({
      userId: dbUser.id,
      userType: decoded.userType
    });

    // 5. Attach sanitized user context to request
    const resolvedName = dbUser.business_name || dbUser.name || (dbUser.first_name ? `${dbUser.first_name} ${dbUser.last_name || ''}`.trim() : null);
    req.user = {
      id: dbUser.id,
      email: dbUser.email,
      name: resolvedName,
      businessName: dbUser.business_name || null,
      ownerName: dbUser.owner_name || null,
      logo: dbUser.logo || null,
      userType: decoded.userType,
      role: access.role,
      permissions: access.permissions,
      sellerId: decoded.sellerId || (decoded.userType === 'SELLER' ? dbUser.id : null),
      verificationStatus: dbUser.verification_status || null,
      accountStatus: dbUser.account_status || null,
      rejectionReason: dbUser.rejection_reason || null,
      jti: decoded.jti,
      tokenExp: decoded.exp
    };

    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Optional Authentication Middleware
 * If Authorization header is provided, verifies token and populates req.user.
 * If Authorization header is omitted, safely continues with req.user = null.
 */
async function optionalAuthenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || typeof authHeader !== 'string') {
    req.user = null;
    return next();
  }
  return authenticate(req, res, next);
}

authenticate.optional = optionalAuthenticate;
authenticate.optionalAuthenticate = optionalAuthenticate;
authenticate.authenticate = authenticate;

module.exports = authenticate;

