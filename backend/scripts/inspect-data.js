const { pool } = require('../src/config/db');

async function inspect() {
  try {
    const [sellers] = await pool.query('SELECT id, business_name, is_active, account_status, verification_status FROM sellers;');
    console.log('=== SELLERS (' + sellers.length + ') ===');
    console.table(sellers);

    const [categories] = await pool.query('SELECT id, seller_id, name FROM product_categories;');
    console.log('=== CATEGORIES (' + categories.length + ') ===');
    console.table(categories);

    const [products] = await pool.query('SELECT id, seller_id, category_id, name, price, stock_quantity, availability_status, image_url FROM products;');
    console.log('=== PRODUCTS (' + products.length + ') ===');
    console.table(products);
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

inspect();
