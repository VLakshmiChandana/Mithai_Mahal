const { pool } = require('../src/config/db');

async function audit() {
  const [tables] = await pool.query('SHOW TABLES');
  const tableNames = tables.map(t => Object.values(t)[0]);
  console.log('=== DATABASE TABLES ===');
  console.log(tableNames.join(', '));

  // 1. Inspect sellers and seller_documents schema
  console.log('\n=== SELLERS TABLE COLUMNS ===');
  const [sellerCols] = await pool.query('DESCRIBE sellers');
  console.log(sellerCols.map(c => `${c.Field} (${c.Type})`).join(', '));

  if (tableNames.includes('seller_documents')) {
    console.log('\n=== SELLER_DOCUMENTS TABLE COLUMNS ===');
    const [docCols] = await pool.query('DESCRIBE seller_documents');
    console.log(docCols.map(c => `${c.Field} (${c.Type})`).join(', '));
  } else {
    console.log('\n[!] Table seller_documents DOES NOT EXIST');
  }

  // 2. Query all sellers
  console.log('\n=== ALL SELLERS IN DATABASE ===');
  const [sellers] = await pool.query('SELECT id, business_name, owner_name, email, phone, city, verification_status, account_status, is_active, created_at FROM sellers ORDER BY created_at ASC');
  for (const s of sellers) {
    console.log(`- ID: ${s.id} | Name: "${s.business_name}" | Owner: "${s.owner_name}" | Status: ${s.verification_status}/${s.account_status} | Active: ${s.is_active} | Created: ${s.created_at}`);
  }

  // 3. Check seller documents if table exists
  if (tableNames.includes('seller_documents')) {
    const [docs] = await pool.query('SELECT * FROM seller_documents');
    console.log(`\n=== SELLER DOCUMENTS (${docs.length}) ===`);
    for (const d of docs) {
      console.log(`- ID: ${d.id} | Seller: ${d.seller_id} | Type: ${d.document_type} | File: ${d.document_file} | Status: ${d.verification_status || d.status} | Notes: ${d.rejection_reason || d.notes}`);
    }
  }

  // 4. Inspect support_tickets
  console.log('\n=== SUPPORT TICKETS COLUMNS ===');
  const [ticketCols] = await pool.query('DESCRIBE support_tickets');
  console.log(ticketCols.map(c => `${c.Field} (${c.Type})`).join(', '));

  // 5. Inspect payments and orders
  console.log('\n=== RECENT PAYMENTS ===');
  const [payments] = await pool.query('SELECT id, order_id, amount, status, payment_method, created_at FROM payments ORDER BY created_at DESC LIMIT 10');
  for (const p of payments) {
    console.log(`- ID: ${p.id} | Order: ${p.order_id} | Amount: ${p.amount} | Status: ${p.status} | Method: ${p.payment_method} | Created: ${p.created_at}`);
  }

  await pool.end();
}

audit().catch(console.error);
