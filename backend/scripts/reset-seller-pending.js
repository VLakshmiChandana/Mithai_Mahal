const { pool } = require('../src/config/db');

async function resetPending() {
  try {
    const [res] = await pool.query(
      `UPDATE sellers 
       SET account_status = 'PENDING_APPROVAL', verification_status = 'PENDING';`
    );
    console.log(`[+] Successfully reset ${res.affectedRows} seller(s) to PENDING status for KYC verification demo!`);
  } catch (err) {
    console.error('[!] Error:', err.message);
  } finally {
    await pool.end();
  }
}

resetPending();
