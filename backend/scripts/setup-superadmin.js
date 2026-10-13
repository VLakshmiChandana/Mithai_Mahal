/**
 * Automated setup script to configure Super Admin & Admin credentials.
 * Run via: node scripts/setup-superadmin.js
 */

const bcrypt = require('bcrypt');
const { pool } = require('../src/config/db');

async function setup() {
  console.log('====================================================');
  console.log('MITHAI MAHAL — SUPER ADMIN & ADMIN CREDENTIAL SETUP');
  console.log('====================================================\n');

  try {
    const superAdminPassword = 'SuperAdminPass123!';
    const adminPassword = 'AdminPassword123!';

    console.log('[*] Generating secure password hashes...');
    const superAdminHash = await bcrypt.hash(superAdminPassword, 10);
    const adminHash = await bcrypt.hash(adminPassword, 10);

    // 1. Update existing superadmin@sweetshop.internal in super_admins
    const [saUpdate] = await pool.query(
      `UPDATE super_admins 
       SET password_hash = ?, is_active = 1, updated_at = CURRENT_TIMESTAMP 
       WHERE email = 'superadmin@sweetshop.internal';`,
      [superAdminHash]
    );

    // 2. Also ensure superadmin@mithaimahal.com is in super_admins (for convenience)
    await pool.query(
      `INSERT INTO super_admins (id, name, email, mobile_number, password_hash, is_active)
       VALUES ('00000000-0000-0000-0000-000000000101', 'Platform Super Admin', 'superadmin@mithaimahal.com', '+919876543210', ?, 1)
       ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash), is_active = 1;`,
      [superAdminHash]
    );

    // 3. Update admin@gmail.com in admins
    await pool.query(
      `UPDATE admins 
       SET password_hash = ?, is_active = 1, updated_at = CURRENT_TIMESTAMP 
       WHERE email = 'admin@gmail.com';`,
      [adminHash]
    );

    console.log('[+] Credentials successfully configured in database!\n');
    console.log('----------------------------------------------------');
    console.log('SUPER ADMIN CREDENTIALS:');
    console.log('  Email:    superadmin@mithaimahal.com');
    console.log('  (or):     superadmin@sweetshop.internal');
    console.log(`  Password: ${superAdminPassword}`);
    console.log('  URL:      http://localhost:5173/super-admin/dashboard');
    console.log('----------------------------------------------------');
    console.log('OPERATIONS ADMIN CREDENTIALS:');
    console.log('  Email:    admin@gmail.com');
    console.log(`  Password: ${adminPassword}`);
    console.log('  URL:      http://localhost:5173/admin/dashboard');
    console.log('----------------------------------------------------\n');
  } catch (err) {
    console.error('[!] Failed to set credentials:', err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

setup();
