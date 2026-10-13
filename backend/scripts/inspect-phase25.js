const { pool } = require('../src/config/db');

async function inspect() {
  try {
    const [logs] = await pool.query('SELECT id, actor_id, actor_type, actor_name, action, target_id, details, reason, created_at FROM audit_logs ORDER BY created_at DESC LIMIT 3;');
    console.log('=== LATEST AUDIT LOGS ===');
    console.table(logs);
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

inspect();
