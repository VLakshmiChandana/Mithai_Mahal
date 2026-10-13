/**
 * Automated Verification Suite for Phase 11 Public Discovery & Safe Browsing
 */

const http = require('http');
const app = require('../src/server');
const { pool } = require('../src/config/db');

let server;
let baseUrl;
let passedCount = 0;
let failedCount = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  [PASS] ${message}`);
    passedCount++;
  } else {
    console.error(`  [FAIL] ${message}`);
    failedCount++;
  }
}

async function request(method, path, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(baseUrl + path);
    const options = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let parsed;
        try {
          parsed = JSON.parse(data);
        } catch {
          parsed = data;
        }
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: parsed
        });
      });
    });

    req.on('error', reject);

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function runTests() {
  console.log('===============================================================');
  console.log('RUNNING PHASE 11 PUBLIC DISCOVERY & SAFE BROWSING TEST SUITE');
  console.log('===============================================================');

  server = app.listen(0);
  const port = server.address().port;
  baseUrl = `http://localhost:${port}`;
  console.log(`[*] Test HTTP server listening on ${baseUrl}\n`);

  const shop1Id = '11111111-0000-0000-0000-000000000001';
  const shop2Id = '22222222-0000-0000-0000-000000000002';

  try {
    // 1. Public list sweet shops without token
    const listShopsRes = await request('GET', '/api/v1/sellers/public');
    assert(listShopsRes.status === 200, 'Public GET /api/v1/sellers/public returns HTTP 200');
    assert(Array.isArray(listShopsRes.body.data) && listShopsRes.body.data.length >= 4, 'Returns all active, approved demo sweet shops');
    assert(listShopsRes.body.data.some(s => s.id === shop1Id && s.business_name.includes('Anand')), 'Contains Anand Mithai Bhandar');

    // 2. Sensitive fields (password_hash, gstin) are not leaked in public shop listing
    const firstShop = listShopsRes.body.data[0];
    assert(!firstShop.password_hash && !firstShop.gstin, 'Public shop record does not leak password hash or GSTIN');

    // 3. Get single shop public details
    const shopDetailRes = await request('GET', `/api/v1/sellers/public/${shop1Id}`);
    assert(shopDetailRes.status === 200 && shopDetailRes.body.data.id === shop1Id, 'Public GET /api/v1/sellers/public/:id returns shop details');

    // 4. Invalid UUID rejected
    const invalidUuidRes = await request('GET', '/api/v1/sellers/public/not-a-valid-uuid');
    assert(invalidUuidRes.status === 400, 'Invalid sellerId UUID returns 400 Bad Request');

    // 5. Inactive / unapproved shop is not exposed publicly
    const inactiveShopId = '99999999-9999-9999-9999-000000000099';
    await pool.query(`
      INSERT INTO sellers (
        id, business_name, legal_name, business_type, email, phone, gstin,
        password_hash, account_status, verification_status, is_active
      ) VALUES (
        ?, 'Suspended Mithai Shop', 'Suspended LLP', 'LLP', 'suspended@sweetshop.internal',
        '+919899999999', '29SUSPE1234F1Z9', 'dummy_hash', 'SUSPENDED', 'UNDER_REVIEW', FALSE
      ) ON DUPLICATE KEY UPDATE account_status = 'SUSPENDED', is_active = FALSE;
    `, [inactiveShopId]);

    const hiddenShopRes = await request('GET', `/api/v1/sellers/public/${inactiveShopId}`);
    assert(hiddenShopRes.status === 404, 'Suspended / inactive shop returns 404 Not Found from public route');

    // 6. Guest browses categories of Shop 1 without Authorization header
    const guestCatsRes = await request('GET', `/api/v1/categories?sellerId=${shop1Id}`);
    assert(guestCatsRes.status === 200, 'Guest can browse categories with ?sellerId (HTTP 200)');
    assert(Array.isArray(guestCatsRes.body.data) && guestCatsRes.body.data.length >= 2, 'Returns categories for specified sweet shop');

    // 7. Guest browses products of Shop 1 without Authorization header
    const guestProdsRes = await request('GET', `/api/v1/products?sellerId=${shop1Id}`);
    assert(guestProdsRes.status === 200, 'Guest can browse products with ?sellerId (HTTP 200)');
    assert(Array.isArray(guestProdsRes.body.data) && guestProdsRes.body.data.length >= 5, 'Returns products for specified sweet shop');

    const firstProduct = guestProdsRes.body.data[0];
    const productId = firstProduct.id;

    // 8. Guest views single product details without token
    const guestProductRes = await request('GET', `/api/v1/products/${productId}`);
    assert(guestProductRes.status === 200 && guestProductRes.body.data.id === productId, 'Guest can view single product details without token (HTTP 200)');

    // 9. Customer registered under Shop 1 can browse Shop 2's products
    // Register and login customer under Shop 1
    const testCustEmail = `p11_tester_${Date.now()}@sweetshop.internal`;
    const regCust = await request('POST', '/api/v1/customers/register', {
      sellerId: shop1Id,
      email: testCustEmail,
      password: 'CustomerPassword123!',
      firstName: 'P11',
      lastName: 'Tester'
    });
    assert(regCust.status === 201, 'Customer registers under Shop 1 (201 Created)');

    const loginRes = await request('POST', '/api/v1/auth/login', {
      sellerId: shop1Id,
      email: testCustEmail,
      password: 'CustomerPassword123!'
    });
    assert(loginRes.status === 200, 'Customer logs in under Shop 1');
    const custToken = loginRes.body.data.accessToken;

    // Customer from Shop 1 queries Shop 2's products
    const crossShopBrowseRes = await request('GET', `/api/v1/products?sellerId=${shop2Id}`, null, custToken);
    assert(crossShopBrowseRes.status === 200, 'Customer registered under Shop 1 can browse Shop 2 catalogue');
    assert(crossShopBrowseRes.body.data.every(p => p.seller_id === shop2Id), 'All returned products belong to Shop 2');

    // 10. Security invariant: Customer cart single-shop isolation is strictly enforced
    // Add Shop 1 product to cart
    const addShop1 = await request('POST', '/api/v1/cart/items', {
      productId: productId,
      quantity: 1
    }, custToken);
    assert(addShop1.status === 200, 'Customer adds Shop 1 product to cart');

    // Fetch Shop 2 product
    const shop2Prods = crossShopBrowseRes.body.data;
    const shop2ProductId = shop2Prods[0].id;

    // Try to add Shop 2 product without clearAndReplace -> MUST FAIL with 409 Conflict
    const addCrossConflict = await request('POST', '/api/v1/cart/items', {
      productId: shop2ProductId,
      quantity: 1
    }, custToken);
    assert(addCrossConflict.status === 409, 'Adding product from different shop without clearAndReplace fails with 409 Conflict');

    // 11. Security invariant: Guest attempting product creation is rejected with 401
    const guestCreateProduct = await request('POST', '/api/v1/products', {
      name: 'Illegal Hack Sweet',
      price: 100
    });
    assert(guestCreateProduct.status === 401, 'Guest attempting to create product is blocked (401 Unauthorized)');

    // 12. Security invariant: Customer attempting product creation is rejected with 403
    const customerCreateProduct = await request('POST', '/api/v1/products', {
      name: 'Illegal Customer Sweet',
      price: 100
    }, custToken);
    assert(customerCreateProduct.status === 403, 'Customer attempting to create product is blocked by RBAC (403 Forbidden)');

    // Cleanup test customer and test suspended shop
    await pool.query('DELETE FROM cart_items WHERE product_id IN (?, ?);', [productId, shop2ProductId]);
    await pool.query('DELETE FROM shopping_carts WHERE user_id = ?;', [regCust.body.data.id]);
    await pool.query('DELETE FROM seller_users WHERE email = ?;', [testCustEmail]);
    await pool.query('DELETE FROM sellers WHERE id = ?;', [inactiveShopId]);

    console.log('\n===============================================================');
    console.log(`PHASE 11 PUBLIC DISCOVERY SUITE: ${passedCount} PASSED, ${failedCount} FAILED`);
    console.log('===============================================================');

    if (failedCount > 0) process.exitCode = 1;
  } catch (err) {
    console.error('[!] Test suite error:', err);
    process.exitCode = 1;
  } finally {
    if (server) server.close();
    await pool.end();
  }
}

runTests();
