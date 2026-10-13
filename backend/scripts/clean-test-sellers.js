const { pool } = require('../src/config/db');

async function cleanupOrphanedTestSellers() {
  try {
    const [delRes] = await pool.query("DELETE FROM sellers WHERE email LIKE 'owner_%@sweetshop.internal';");
    console.log('Cleaned orphaned test sellers:', delRes.affectedRows);
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

cleanupOrphanedTestSellers();
