/**
 * Phase 17 Database Migration & Setup:
 * 1. Creates `audit_logs` table for administrative tracking.
 * 2. Seeds Phase 17 granular permissions and maps them to SUPER_ADMIN and ADMIN.
 */

const { pool } = require('../src/config/db');

async function setup() {
  console.log('[*] Setting up Phase 17 Database Schema & RBAC Permissions...');

  // 1. Create audit_logs table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id CHAR(36) PRIMARY KEY,
      actor_id CHAR(36) NOT NULL,
      actor_type VARCHAR(50) NOT NULL,
      actor_name VARCHAR(150),
      action VARCHAR(100) NOT NULL,
      target_id CHAR(36),
      target_type VARCHAR(50),
      details JSON,
      ip_address VARCHAR(45),
      user_agent TEXT,
      reason VARCHAR(500),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_actor (actor_id),
      INDEX idx_action (action),
      INDEX idx_target (target_id),
      INDEX idx_created (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
  console.log('  [+] Table audit_logs verified/created.');

  // 2. Add Phase 17 Permissions
  const permissionsToAdd = [
    {
      id: '10000000-0000-0000-0000-000000000010',
      name: 'view_platform_analytics',
      resource: 'analytics',
      action: 'READ',
      description: 'Access platform-wide financial revenue, sales trends, and rankings'
    },
    {
      id: '10000000-0000-0000-0000-000000000011',
      name: 'view_audit_logs',
      resource: 'audit_logs',
      action: 'READ',
      description: 'View administrative audit logs and security events'
    },
    {
      id: '10000000-0000-0000-0000-000000000012',
      name: 'view_operational_metrics',
      resource: 'operations',
      action: 'READ',
      description: 'View operational queue metrics, live orders, and low-stock alerts'
    },
    {
      id: '10000000-0000-0000-0000-000000000013',
      name: 'manage_platform_accounts',
      resource: 'accounts',
      action: 'MANAGE',
      description: 'Activate, deactivate, or suspend administrative and customer accounts'
    }
  ];

  for (const p of permissionsToAdd) {
    await pool.query(`
      INSERT INTO permissions (id, name, resource, action, description, created_at)
      VALUES (?, ?, ?, ?, ?, NOW())
      ON DUPLICATE KEY UPDATE description = VALUES(description);
    `, [p.id, p.name, p.resource, p.action, p.description]);
  }
  console.log('  [+] Phase 17 permissions seeded.');

  // 3. Map permissions to roles
  // SUPER_ADMIN gets all 4
  const superAdminRoleId = '00000000-0000-0000-0000-000000000001';
  for (const p of permissionsToAdd) {
    await pool.query(`
      INSERT IGNORE INTO role_permissions (id, role_id, permission_id, created_at)
      VALUES (UUID(), ?, ?, NOW());
    `, [superAdminRoleId, p.id]);
  }

  // ADMIN gets view_operational_metrics
  const adminRoleId = '00000000-0000-0000-0000-000000000002';
  await pool.query(`
    INSERT IGNORE INTO role_permissions (id, role_id, permission_id, created_at)
    VALUES (UUID(), ?, '10000000-0000-0000-0000-000000000012', NOW());
  `, [adminRoleId]);

  console.log('  [+] RBAC role-permission mappings updated.');
  console.log('[*] Phase 17 database setup complete.\n');
  await pool.end();
}

setup().catch((err) => {
  console.error('[!] Setup error:', err);
  process.exit(1);
});
