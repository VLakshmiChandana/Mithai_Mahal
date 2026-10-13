/**
 * Role-Based Access Control (RBAC) Service
 * 
 * Architecture & Design:
 * 1. Resolves permissions strictly through the relational schema:
 *    roles -> role_permissions -> permissions
 * 2. Identity & Role Mapping Strategy:
 *    - Platform Staff & Sellers (super_admins, admins, accountants, customer_care, sellers):
 *      Primary role is canonically established by their dedicated account table.
 *      (e.g., An authenticated account from super_admins holds the role 'SUPER_ADMIN').
 *    - Tenant Users (seller_users):
 *      Assigned roles dynamically through the seller_user_roles mapping table.
 *      (e.g., A customer holds the 'CUSTOMER' role assigned in seller_user_roles).
 * 3. Never trusts roles or permissions supplied by the client.
 */

const { pool } = require('../config/db');

// Map canonical userType to the default system role name in `roles`
const IDENTITY_TABLE_ROLE_MAP = Object.freeze({
  SUPER_ADMIN: 'SUPER_ADMIN',
  ADMIN: 'ADMIN',
  ACCOUNTANT: 'ACCOUNTANT',
  SELLER: 'SELLER',
  CUSTOMER_CARE: 'CUSTOMER_CARE'
});

/**
 * Resolves all atomic permissions granted to a given role name.
 * Performs a parameterized query joining roles, role_permissions, and permissions.
 * 
 * @param {string} roleName - Canonical role name (e.g. 'SUPER_ADMIN', 'CUSTOMER')
 * @returns {Promise<Array<{ name: string, resource: string, action: string }>>}
 */
async function getPermissionsForRole(roleName) {
  if (!roleName || typeof roleName !== 'string') {
    return [];
  }

  const [rows] = await pool.query(
    `SELECT p.name, p.resource, p.action 
     FROM permissions p
     INNER JOIN role_permissions rp ON p.id = rp.permission_id
     INNER JOIN roles r ON rp.role_id = r.id
     WHERE r.name = ?;`,
    [roleName]
  );

  return rows;
}

/**
 * Resolves the effective role and permissions for any user in the system.
 * Handles both staff identity tables and dynamic seller_users.
 * 
 * @param {Object} params
 * @param {string} params.userId - Account ID (UUID)
 * @param {string} params.userType - Account type ('SUPER_ADMIN', 'ADMIN', 'ACCOUNTANT', 'SELLER', 'CUSTOMER_CARE', 'CUSTOMER')
 * @returns {Promise<{ role: string, permissions: Array<string> }>}
 */
async function resolveUserAccess({ userId, userType }) {
  if (!userId || !userType) {
    throw new Error('User ID and user type are required to resolve access.');
  }

  let effectiveRole = null;

  if (userType === 'CUSTOMER') {
    // Look up dynamic role in seller_user_roles for this seller_user
    const [roleRows] = await pool.query(
      `SELECT r.name 
       FROM roles r
       INNER JOIN seller_user_roles sur ON r.id = sur.role_id
       WHERE sur.seller_user_id = ?
       LIMIT 1;`,
      [userId]
    );

    // Default to 'CUSTOMER' if no custom seller role is assigned
    effectiveRole = roleRows.length > 0 ? roleRows[0].name : 'CUSTOMER';
  } else if (IDENTITY_TABLE_ROLE_MAP[userType]) {
    // Staff and Sellers have canonical roles matching their identity table
    effectiveRole = IDENTITY_TABLE_ROLE_MAP[userType];
  } else {
    throw new Error(`Unsupported account type: ${userType}`);
  }

  // Fetch all granted permissions for this effective role
  const permissionRecords = await getPermissionsForRole(effectiveRole);
  const permissionNames = permissionRecords.map(p => p.name);

  return {
    role: effectiveRole,
    permissions: permissionNames,
    permissionDetails: permissionRecords
  };
}

/**
 * Checks whether an effective role possesses a specific required permission.
 * 
 * @param {string} roleName - Canonical role name
 * @param {string} requiredPermission - Permission name to check (e.g. 'manage_platform_staff')
 * @returns {Promise<boolean>}
 */
async function hasPermission(roleName, requiredPermission) {
  if (!roleName || !requiredPermission) return false;

  const permissions = await getPermissionsForRole(roleName);
  return permissions.some(p => p.name === requiredPermission);
}

module.exports = {
  IDENTITY_TABLE_ROLE_MAP,
  getPermissionsForRole,
  resolveUserAccess,
  hasPermission
};
