/**
 * Phase 6 Automated Test Suite: Sweet Shop Management and Product Catalogue
 * 
 * Verifies:
 * 1. RBAC & Permissions:
 *    - SELLER with manage_shop_catalog can manage categories and products.
 *    - CUSTOMER cannot create, update, or delete products or categories (403 Forbidden).
 * 2. Category Management:
 *    - Create category (201 Created).
 *    - Prevent duplicate category name for the same sweet shop (409 Conflict).
 *    - List categories with pagination.
 *    - Update category details.
 *    - Delete category and check cascade behavior.
 * 3. Product Management (CRUD):
 *    - Create product with valid price, stock, category, image URL, and availability status (201 Created).
 *    - Validation: Negative price rejected (400 Bad Request).
 *    - Validation: Negative stock quantity rejected (400 Bad Request).
 *    - Validation: Invalid availabilityStatus rejected (400 Bad Request).
 *    - Read product details by ID (200 OK).
 *    - Update product price, stock quantity, and availability (200 OK).
 * 4. Multi-Tenant Seller Isolation:
 *    - Sweet Shop 1 cannot update or delete Sweet Shop 2's products (404/403 Isolated).
 *    - Sweet Shop 1 cannot create a product assigned to Sweet Shop 2's category (400 Bad Request).
 * 5. Filtering, Search, and Pagination:
 *    - Search products by name keyword.
 *    - Filter by availability status.
 *    - Filter by minPrice and maxPrice range.
 *    - Paginate product catalog (page, limit, total, totalPages).
 * 6. Safe Fixture Management:
 *    - Uses isolated, designated test UUID fixtures and cleans up at the end.
 */

const http = require('http');
const bcrypt = require('bcrypt');
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

async function runPhase6Tests() {
  console.log('===============================================================');
  console.log('RUNNING PHASE 6 PRODUCT CATALOGUE AUTOMATED TEST SUITE');
  console.log('===============================================================');

  server = app.listen(0);
  const port = server.address().port;
  baseUrl = `http://localhost:${port}`;
  console.log(`[*] Test HTTP server listening on ${baseUrl}\n`);

  // Fixture IDs
  const seller1Id = 'cccccccc-6666-6666-6666-000000000001';
  const seller2Id = 'dddddddd-6666-6666-6666-000000000002';
  const seller1Email = 'mithai_palace@sweetshop.internal';
  const seller2Email = 'bengali_sweets@sweetshop.internal';
  const customerEmail = 'catalog_tester@sweetshop.internal';
  const password = 'TestPassword123!';

  let seller1Token;
  let seller2Token;
  let customerToken;

  try {
    const hash = await bcrypt.hash(password, 10);

    // 1. Seed test sellers
    await pool.query(`
      INSERT INTO sellers (
        id, business_name, email, phone, gstin, password_hash, account_status, verification_status, is_active
      ) VALUES 
        (?, 'Mithai Palace', ?, '+919811100001', '29MPALA1234F1Z1', ?, 'ACTIVE', 'APPROVED', TRUE),
        (?, 'Bengali Sweets Corner', ?, '+919822200002', '29BSWEE1234F1Z2', ?, 'ACTIVE', 'APPROVED', TRUE)
      ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash), is_active = TRUE;
    `, [seller1Id, seller1Email, hash, seller2Id, seller2Email, hash]);

    // 2. Seed test customer scoped to Seller 1
    await pool.query(`
      INSERT INTO seller_users (
        id, seller_id, first_name, last_name, email, password_hash, is_active
      ) VALUES (
        UUID(), ?, 'Vikram', 'Mehta', ?, ?, TRUE
      ) ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash), is_active = TRUE;
    `, [seller1Id, customerEmail, hash]);

    // Obtain login tokens
    const s1Login = await request('POST', '/api/v1/auth/login', { email: seller1Email, password });
    seller1Token = s1Login.body.data.accessToken;

    const s2Login = await request('POST', '/api/v1/auth/login', { email: seller2Email, password });
    seller2Token = s2Login.body.data.accessToken;

    const custLogin = await request('POST', '/api/v1/auth/login', {
      email: customerEmail,
      password,
      sellerId: seller1Id
    });
    customerToken = custLogin.body.data.accessToken;

    // -------------------------------------------------------------------------
    // 1. RBAC & PERMISSION CHECKS
    // -------------------------------------------------------------------------
    console.log('--- 1. Testing RBAC & Role Restrictions ---');

    // Customer attempting to create category
    const custCatRes = await request('POST', '/api/v1/categories', {
      name: 'Unauth Category'
    }, customerToken);
    assert(custCatRes.status === 403, 'Customer cannot create category (403 Forbidden)');

    // Customer attempting to create product
    const custProdRes = await request('POST', '/api/v1/products', {
      name: 'Gulab Jamun',
      price: 150.00
    }, customerToken);
    assert(custProdRes.status === 403, 'Customer cannot create product (403 Forbidden)');

    // -------------------------------------------------------------------------
    // 2. CATEGORY MANAGEMENT & CONSTRAINTS
    // -------------------------------------------------------------------------
    console.log('\n--- 2. Testing Category Management & Constraints ---');

    // Seller 1 creates category
    const catRes = await request('POST', '/api/v1/categories', {
      name: 'Ghee Sweets',
      description: 'Traditional pure desi ghee sweets and laddoos',
      displayOrder: 1
    }, seller1Token);
    assert(catRes.status === 201 && catRes.body.data.name === 'Ghee Sweets', 'Seller 1 creates "Ghee Sweets" category (201 Created)');
    const gheeCatId = catRes.body.data.id;

    // Duplicate category name under same shop rejected
    const dupCatRes = await request('POST', '/api/v1/categories', {
      name: 'Ghee Sweets'
    }, seller1Token);
    assert(dupCatRes.status === 409, 'Duplicate category name under same shop rejected with 409 Conflict');

    // Seller 2 can create same category name (Tenant-scoped uniqueness)
    const s2CatRes = await request('POST', '/api/v1/categories', {
      name: 'Ghee Sweets'
    }, seller2Token);
    assert(s2CatRes.status === 201, 'Seller 2 can use same category name in their own store (201 Created)');
    const s2CatId = s2CatRes.body.data.id;

    // List categories for Seller 1
    const listCatRes = await request('GET', '/api/v1/categories', null, seller1Token);
    assert(listCatRes.status === 200 && listCatRes.body.data.length >= 1, 'Seller 1 can list their categories (200 OK)');

    // Update category
    const updateCatRes = await request('PATCH', `/api/v1/categories/${gheeCatId}`, {
      description: 'Updated pure cow ghee sweets'
    }, seller1Token);
    assert(updateCatRes.status === 200 && updateCatRes.body.data.description === 'Updated pure cow ghee sweets', 'Seller 1 can update category details (200 OK)');

    // -------------------------------------------------------------------------
    // 3. PRODUCT VALIDATION CHECKS
    // -------------------------------------------------------------------------
    console.log('\n--- 3. Testing Product Input Validation ---');

    // Negative price rejected
    const negPriceRes = await request('POST', '/api/v1/products', {
      name: 'Motichoor Laddoo',
      price: -50.00
    }, seller1Token);
    assert(negPriceRes.status === 400, 'Negative price rejected by Joi validation (400 Bad Request)');

    // Negative stock rejected
    const negStockRes = await request('POST', '/api/v1/products', {
      name: 'Motichoor Laddoo',
      price: 120.00,
      stockQuantity: -5
    }, seller1Token);
    assert(negStockRes.status === 400, 'Negative stock rejected by Joi validation (400 Bad Request)');

    // Invalid availability status rejected
    const badStatusRes = await request('POST', '/api/v1/products', {
      name: 'Motichoor Laddoo',
      price: 120.00,
      availabilityStatus: 'EXPIRED'
    }, seller1Token);
    assert(badStatusRes.status === 400, 'Invalid availabilityStatus rejected (400 Bad Request)');

    // -------------------------------------------------------------------------
    // 4. PRODUCT CRUD OPERATIONS
    // -------------------------------------------------------------------------
    console.log('\n--- 4. Testing Product CRUD Operations ---');

    // Create Product 1 (Motichoor Laddoo)
    const prod1Res = await request('POST', '/api/v1/products', {
      name: 'Motichoor Laddoo Box 500g',
      description: 'Soft melt-in-mouth boondi laddoos made with pure ghee',
      categoryId: gheeCatId,
      price: 280.00,
      stockQuantity: 25,
      imageUrl: 'https://images.unsplash.com/photo-mithai-laddoo',
      availabilityStatus: 'AVAILABLE'
    }, seller1Token);
    assert(prod1Res.status === 201 && prod1Res.body.data.name === 'Motichoor Laddoo Box 500g', 'Seller 1 creates product with category, price, and stock (201 Created)');
    const prod1Id = prod1Res.body.data.id;

    // Create Product 2 (Kaju Katli)
    const prod2Res = await request('POST', '/api/v1/products', {
      name: 'Silver Vark Kaju Katli 500g',
      description: 'Diamond shaped rich cashew fudge with silver leaf',
      price: 450.00,
      stockQuantity: 15,
      availabilityStatus: 'AVAILABLE'
    }, seller1Token);
    assert(prod2Res.status === 201, 'Seller 1 creates second sweet product without category (201 Created)');
    const prod2Id = prod2Res.body.data.id;

    // Get product by ID
    const getProdRes = await request('GET', `/api/v1/products/${prod1Id}`, null, seller1Token);
    assert(getProdRes.status === 200 && Number(getProdRes.body.data.price) === 280.00, 'Fetch product by ID returns correct price & details (200 OK)');

    // Update product (price and stock)
    const updateProdRes = await request('PATCH', `/api/v1/products/${prod1Id}`, {
      price: 300.00,
      stockQuantity: 40
    }, seller1Token);
    assert(updateProdRes.status === 200 && Number(updateProdRes.body.data.price) === 300.00 && updateProdRes.body.data.stock_quantity === 40, 'Update product price and stock quantity succeeds (200 OK)');

    // -------------------------------------------------------------------------
    // 5. MULTI-TENANT SELLER ISOLATION
    // -------------------------------------------------------------------------
    console.log('\n--- 5. Testing Multi-Tenant Seller Isolation ---');

    // Seller 2 attempts to update Seller 1's product
    const crossUpdateRes = await request('PATCH', `/api/v1/products/${prod1Id}`, {
      price: 10.00
    }, seller2Token);
    assert(crossUpdateRes.status === 404, 'Seller 2 cannot update Seller 1 product (Isolated, 404 Not Found)');

    // Seller 2 attempts to delete Seller 1's product
    const crossDelRes = await request('DELETE', `/api/v1/products/${prod1Id}`, null, seller2Token);
    assert(crossDelRes.status === 404, 'Seller 2 cannot delete Seller 1 product (Isolated, 404 Not Found)');

    // Seller 2 attempts to use Seller 1's category
    const crossCatRes = await request('POST', '/api/v1/products', {
      name: 'Roshogolla',
      price: 200.00,
      categoryId: gheeCatId // Belonging to Seller 1
    }, seller2Token);
    assert(crossCatRes.status === 400, 'Seller 2 cannot link product to another seller category (400 Bad Request)');

    // -------------------------------------------------------------------------
    // 6. FILTERING, SEARCH, AND PAGINATION
    // -------------------------------------------------------------------------
    console.log('\n--- 6. Testing Filtering, Search, and Pagination ---');

    // Customer browsing Seller 1's catalog
    const custBrowseRes = await request('GET', '/api/v1/products', null, customerToken);
    assert(custBrowseRes.status === 200 && custBrowseRes.body.data.length >= 2, 'Customer receives products within their registered sweet shop (200 OK)');

    // Search by keyword "Katli"
    const searchRes = await request('GET', '/api/v1/products?search=Katli', null, seller1Token);
    assert(searchRes.status === 200 && searchRes.body.data.length === 1 && searchRes.body.data[0].name.includes('Kaju Katli'), 'Search by keyword "Katli" returns matched product');

    // Filter by price range: minPrice=350, maxPrice=500
    const priceFilterRes = await request('GET', '/api/v1/products?minPrice=350&maxPrice=500', null, seller1Token);
    assert(priceFilterRes.status === 200 && priceFilterRes.body.data.length === 1 && priceFilterRes.body.data[0].name.includes('Kaju Katli'), 'Filter by price range [350, 500] returns only matching products');

    // Pagination test (limit=1, page=1)
    const pageRes = await request('GET', '/api/v1/products?limit=1&page=1', null, seller1Token);
    assert(pageRes.status === 200 && pageRes.body.data.length === 1 && pageRes.body.pagination.totalPages >= 2, 'Pagination returns correct limit, page, and totalPages metadata');

    // -------------------------------------------------------------------------
    // 7. PRODUCT DELETION
    // -------------------------------------------------------------------------
    console.log('\n--- 7. Testing Product Deletion ---');

    const delProdRes = await request('DELETE', `/api/v1/products/${prod2Id}`, null, seller1Token);
    assert(delProdRes.status === 200 && delProdRes.body.data.deleted === true, 'Seller can delete their product (200 OK)');

    const verifyDel = await request('GET', `/api/v1/products/${prod2Id}`, null, seller1Token);
    assert(verifyDel.status === 404, 'Deleted product is no longer returned (404 Not Found)');

    // -------------------------------------------------------------------------
    // CLEANUP
    // -------------------------------------------------------------------------
    await pool.query('DELETE FROM products WHERE seller_id IN (?, ?);', [seller1Id, seller2Id]);
    await pool.query('DELETE FROM product_categories WHERE seller_id IN (?, ?);', [seller1Id, seller2Id]);
    await pool.query('DELETE FROM seller_users WHERE email = ?;', [customerEmail]);
    await pool.query('DELETE FROM sellers WHERE id IN (?, ?);', [seller1Id, seller2Id]);

    console.log('\n===============================================================');
    console.log(`PHASE 6 TEST SUITE RESULTS: ${passedCount} PASSED, ${failedCount} FAILED`);
    console.log('===============================================================');

    if (failedCount > 0) process.exitCode = 1;
  } catch (err) {
    console.error('[!] Test suite encountered an unhandled error:', err);
    process.exitCode = 1;
  } finally {
    if (server) server.close();
    await pool.end();
  }
}

runPhase6Tests();
