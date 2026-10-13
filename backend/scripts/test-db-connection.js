/**
 * Standalone test script to verify MySQL connectivity and query the existing 14 tables.
 * Run via: npm test (or node scripts/test-db-connection.js)
 */

const { pool, testConnection } = require('../src/config/db');

async function run() {
  console.log('==================================================');
  console.log('TESTING MYSQL CONNECTION (sweet_shop_delivery)');
  console.log('==================================================');

  try {
    const status = await testConnection();
    console.log('[+] Connection Successful!');
    console.log(`    Database: ${status.database}`);
    console.log(`    Version:  ${status.version}`);

    // Query all existing tables in sweet_shop_delivery
    const [tables] = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = ? 
      ORDER BY table_name;
    `, [status.database]);

    console.log(`\n[+] Found ${tables.length} tables in database:`);
    tables.forEach((t, i) => {
      console.log(`    ${(i + 1).toString().padStart(2, ' ')}. ${t.TABLE_NAME || t.table_name}`);
    });

    // Check roles seeded
    const [roles] = await pool.query('SELECT name FROM roles ORDER BY name;');
    console.log(`\n[+] Found ${roles.length} roles seeded:`);
    roles.forEach(r => console.log(`    - ${r.name}`));

    console.log('\n==================================================');
    console.log('ALL CONNECTION TESTS PASSED SUCCESSFULLY!');
    console.log('==================================================');
  } catch (err) {
    console.error('\n[!] Connection failed:');
    console.error(`    Code:    ${err.code}`);
    console.error(`    Message: ${err.message}`);
    console.error('\nPlease verify DB_PASSWORD in .env matches your local MySQL root password.');
    process.exit(1);
  } finally {
    await pool.end();
  }
}

run();
