/**
 * Execute Phase 6 SQL Migration
 */

const fs = require('fs');
const path = require('path');
const { pool } = require('../src/config/db');

async function runMigration() {
  console.log('[*] Running Phase 6 Database Migration...');
  const sqlFile = path.join(__dirname, 'migrations', 'phase6-catalog.sql');
  const sql = fs.readFileSync(sqlFile, 'utf8');

  // Split statements by semicolon
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.toLowerCase().startsWith('use '));

  for (const statement of statements) {
    console.log(`Executing statement: ${statement.slice(0, 50)}...`);
    await pool.query(statement);
  }

  const [tables] = await pool.query('SHOW TABLES;');
  console.log('[✓] Migration complete! Tables now in database:');
  console.log(tables.map(t => Object.values(t)[0]));
  await pool.end();
}

runMigration().catch(err => {
  console.error('[!] Migration failed:', err);
  process.exit(1);
});
