/**
 * Authorization Middleware (RBAC Guard)
 * 
 * Enforces role and permission checks using the authenticated user context
 * resolved from the database during authentication.
 * 
 * Rules:
 * - Fails closed if req.user is missing or permissions cannot be verified.
 * - Supports requiring one or multiple permissions.
 * - Supports requiring specific allowed roles.
 */

const { ForbiddenError, UnauthorizedError } = require('./errorHandler');

/**
 * Middleware factory requiring one or more specific permissions.
 * @param {string|string[]} requiredPermissions - Single permission or array of permissions (ALL required by default)
 * @param {Object} [options={ requireAll: true }]
 */
function requirePermissions(requiredPermissions, options = { requireAll: true }) {
  const permList = Array.isArray(requiredPermissions) ? requiredPermissions : [requiredPermissions];

  return (req, res, next) => {
    if (!req.user) {
      return next(new UnauthorizedError('Authentication required before authorization.'));
    }

    const userPermissions = Array.isArray(req.user.permissions) ? req.user.permissions : [];

    const hasAccess = options.requireAll
      ? permList.every(perm => userPermissions.includes(perm))
      : permList.some(perm => userPermissions.includes(perm));

    if (!hasAccess) {
      return next(new ForbiddenError(`Forbidden: Missing required permission(s): ${permList.join(', ')}`));
    }

    next();
  };
}

/**
 * Middleware factory requiring one of the specified roles.
 * @param {...string} allowedRoles - Role names (e.g. 'SUPER_ADMIN', 'ADMIN')
 */
function requireRoles(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return next(new UnauthorizedError('Authentication required before authorization.'));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(new ForbiddenError(`Forbidden: Role "${req.user.role}" is not authorized for this resource.`));
    }

    next();
  };
}

module.exports = {
  requirePermissions,
  requireRoles
};
