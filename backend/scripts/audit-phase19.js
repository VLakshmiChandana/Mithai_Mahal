const { pool } = require('../src/config/db');

async function run() {
  try {
    const [sellers] = await pool.query('SELECT id, business_name, email, is_active, account_status, verification_status, logo, city FROM sellers');
    console.log(`--- ALL SELLERS (${sellers.length}) ---`);
    for (const s of sellers) {
      console.log(`${s.id} | ${s.business_name} | ${s.email} | active:${s.is_active} | acc:${s.account_status} | verif:${s.verification_status} | logo:${s.logo}`);
    }

    const [docs] = await pool.query('SELECT id, seller_id, document_type, file_name, file_path, file_size, mime_type, verification_status FROM seller_documents');
    console.log(`--- ALL DOCUMENTS (${docs.length}) ---`);
    for (const d of docs) {
      console.log(`${d.id} | seller:${d.seller_id} | ${d.file_name} | path:${d.file_path} | size:${d.file_size} | verif:${d.verification_status}`);
    }
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

run();
