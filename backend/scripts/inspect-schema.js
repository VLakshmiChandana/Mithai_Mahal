const { pool } = require('../src/config/db');

async function check() {
  const [tables] = await pool.query('SHOW TABLES');
  console.log('TABLES:');
  for (const t of tables) {
    const name = Object.values(t)[0];
    const [cols] = await pool.query(`DESCRIBE \`${name}\``);
    console.log(`\n--- TABLE: ${name} ---`);
    console.log(cols.map(c => `${c.Field} (${c.Type})`).join(', '));
  }
  await pool.end();
}

check().catch(console.error);
