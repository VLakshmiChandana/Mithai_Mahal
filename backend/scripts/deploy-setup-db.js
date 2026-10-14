/**
 * Cloud Database Deployment & Initialization Script
 * 
 * Safely initializes tables, schema, and demo catalog on any cloud MySQL database
 * (Aiven, TiDB Cloud, Clever Cloud, AWS RDS, Railway, etc.)
 * 
 * Usage:
 *   node scripts/deploy-setup-db.js
 */

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
const config = require('../src/config/env');

async function deployDatabase() {
  console.log('====================================================');
  console.log('MITHAI MAHAL — CLOUD DATABASE INITIALIZATION');
  console.log('====================================================\n');
  console.log(`[*] Target Host: ${config.db.host}:${config.db.port}`);
  console.log(`[*] Target Database: ${config.db.database}`);
  console.log(`[*] SSL Enabled: ${process.env.DB_SSL === 'true' ? 'YES' : 'NO'}\n`);

  let connection;
  try {
    console.log('[*] Connecting to database...');
    connection = await mysql.createConnection({
      host: config.db.host,
      port: config.db.port,
      user: config.db.user,
      password: config.db.password,
      database: config.db.database,
      multipleStatements: true,
      ...(process.env.DB_SSL === 'true' ? { ssl: { rejectUnauthorized: false } } : {})
    });
    console.log('[+] Connected successfully!\n');

    // Read SQL dump file
    const sqlPath = path.resolve(__dirname, '../../database/sweet_shop_delivery_workbench.sql');
    if (!fs.existsSync(sqlPath)) {
      throw new Error(`SQL file not found at ${sqlPath}`);
    }

    console.log('[*] Reading database/sweet_shop_delivery_workbench.sql...');
    let sql = fs.readFileSync(sqlPath, 'utf8');

    // Clean SQL to be compatible with managed cloud databases
    console.log('[*] Sanitizing SQL commands for cloud compatibility...');
    
    // Remove CREATE DATABASE and USE statements
    sql = sql.replace(/CREATE DATABASE[^\n;]+;/gi, '');
    sql = sql.replace(/USE `?[a-zA-Z0-9_]+`?;/gi, '');
    // Remove LOCK / UNLOCK TABLES
    sql = sql.replace(/LOCK TABLES `?[a-zA-Z0-9_]+`? WRITE;/gi, '');
    sql = sql.replace(/UNLOCK TABLES;/gi, '');
    // Remove unsupported charset comments
    sql = sql.replace(/\/\*!40000 ALTER TABLE `?[a-zA-Z0-9_]+`? (DISABLE|ENABLE) KEYS \*\/;/gi, '');

    console.log('[*] Executing schema migrations and seed records (this may take 10-20 seconds)...');
    await connection.query('SET FOREIGN_KEY_CHECKS = 0;');
    await connection.query(sql);
    await connection.query('SET FOREIGN_KEY_CHECKS = 1;');
    console.log('[+] Schema and seed data successfully loaded!\n');

    // Ensure Super Admin & Operations Admin accounts are ready
    console.log('[*] Configuring administrative credentials...');
    const superAdminPassword = 'SuperAdminPass123!';
    const adminPassword = 'AdminPassword123!';
    const superAdminHash = await bcrypt.hash(superAdminPassword, 10);
    const adminHash = await bcrypt.hash(adminPassword, 10);

    // Platform Super Admin
    await connection.query(
      `INSERT INTO super_admins (id, name, email, mobile_number, password_hash, is_active)
       VALUES ('00000000-0000-0000-0000-000000000101', 'Platform Super Admin', 'superadmin@mithaimahal.com', '+919876543210', ?, 1)
       ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash), is_active = 1;`,
      [superAdminHash]
    );

    // Operations Admin
    await connection.query(
      `INSERT INTO admins (id, name, email, mobile_number, password_hash, created_by, is_active)
       VALUES ('00000000-0000-0000-0000-000000000201', 'Operations Admin', 'admin@gmail.com', '+919876543211', ?, '00000000-0000-0000-0000-000000000101', 1)
       ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash), is_active = 1;`,
      [adminHash]
    );
    console.log('[+] Administrative credentials configured!\n');

    // Verify tables
    const [tables] = await connection.query('SHOW TABLES;');
    console.log(`[+] Verification: ${tables.length} tables found in cloud database.`);
    console.log('====================================================');
    console.log('DATABASE READY FOR PRODUCTION DEPLOYMENT!');
    console.log('====================================================\n');

  } catch (err) {
    console.error('[!] Deployment script error:', err.message);
    process.exitCode = 1;
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

deployDatabase();
