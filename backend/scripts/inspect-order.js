const { pool } = require('../src/config/db');

async function inspectOrder() {
  try {
    const [rows] = await pool.query(`
      SELECT o.id, o.order_number, o.order_status, o.payment_status, o.total_amount,
             o.cancellation_reason, o.cancelled_at, o.created_at,
             p.id as payment_id, p.payment_reference, p.status as payment_record_status
      FROM orders o
      LEFT JOIN payments p ON o.id = p.order_id
      WHERE o.id = 'f473039a-c630-11f1-af03-58cdc9523828'
         OR o.id = '886497d1-c630-11f1-af03-58cdc9523828';
    `);
    console.table(rows);
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

inspectOrder();
