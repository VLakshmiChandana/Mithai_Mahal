/**
 * Tenant Isolation Middleware
 * 
 * Rules:
 * 1. Derives the permitted seller context from authenticated req.user.
 * 2. Enforces multi-tenant boundaries:
 *    - SELLER: Must only manage resources belonging to their own sellerId (req.user.id).
 *    - CUSTOMER: Must only access resources within their registered seller tenant (req.user.sellerId).
 *    - Global Staff (SUPER_ADMIN, ADMIN, ACCOUNTANT, CUSTOMER_CARE):
 *      Can access any tenant if they possess cross-tenant administrative permissions.
 * 3. Never trusts client-supplied seller_id in body, params, or query without validation.
 */

const { ForbiddenError, UnauthorizedError } = require('./errorHandler');

// Permissions that allow platform staff to access or manage any seller's data
const CROSS_TENANT_STAFF_PERMISSIONS = Object.freeze([
  'manage_platform_staff',
  'manage_seller_accounts',
  'review_seller_kyc',
  'manage_financial_settlements',
  'handle_support_tickets'
]);

/**
 * Middleware enforcing tenant boundary for routes accessing seller-scoped resources.
 * 
 * Extracts target sellerId from:
 * 1. req.params.sellerId
 * 2. req.query.sellerId
 * 3. req.body.sellerId
 * 
 * If a target sellerId is specified:
 * - Checks if user has cross-tenant admin privileges OR if the target sellerId matches req.user.sellerId.
 * - Injects validated `req.tenantId` into request.
 */
function enforceTenant(paramName = 'sellerId') {
  return (req, res, next) => {
    if (!req.user) {
      return next(new UnauthorizedError('Authentication required to verify tenant context.'));
    }

    const { userType, permissions, sellerId: userSellerId } = req.user;

    // Check if user is platform staff with cross-tenant permissions
    const isGlobalStaff = CROSS_TENANT_STAFF_PERMISSIONS.some(p => permissions.includes(p));

    // Extract requested seller context from params, body, or query
    const targetSellerId = req.params[paramName] || req.body[paramName] || req.query[paramName] || null;

    if (isGlobalStaff) {
      // Global staff can operate on any requested seller, or global context
      req.tenantId = targetSellerId || userSellerId || null;
      return next();
    }

    // For tenant-scoped users (SELLER, CUSTOMER):
    const effectiveUserTenant = userType === 'SELLER' ? req.user.id : userSellerId;

    if (!effectiveUserTenant) {
      return next(new ForbiddenError('User has no valid seller tenant association.'));
    }

    if (targetSellerId && targetSellerId !== effectiveUserTenant) {
      // Cross-tenant breach attempt detected
      return next(new ForbiddenError('Cross-tenant violation: Access to another seller tenant is prohibited.'));
    }

    // Force verified tenantId onto request so subsequent controllers query by req.tenantId
    req.tenantId = effectiveUserTenant;
    next();
  };
}

module.exports = {
  enforceTenant,
  CROSS_TENANT_STAFF_PERMISSIONS
};
