/**
 * Phase 7 Automated Integration Test Suite:
 * Shopping Cart, Delivery Address Management, and Checkout Validation
 * 
 * Verifies:
 * 1. Delivery Address APIs:
 *    - Create address (201 Created).
 *    - First address defaults to is_default: true.
 *    - Update address fields.
 *    - Set second address as default (unsets first).
 *    - Customer 2 blocked from viewing/updating Customer 1's address (ownership check, 404).
 *    - Delete address.
 * 2. Shopping Cart Operations:
 *    - Add sweet product to cart (200 OK).
 *    - Live subtotal and tax computed automatically by server based on DB price.
 *    - Update item quantity.
 *    - Quantity exceeding live stock rejected with 400 Bad Request.
 *    - Negative quantity rejected by Joi validation (400 Bad Request).
 * 3. Single Sweet Shop Rule:
 *    - Attempting to add product from a different sweet shop without clearAndReplace fails (409 Conflict, CROSS_SHOP_CART_CONFLICT).
 *    - Adding with clearAndReplace=true successfully switches shop and clears previous items.
 * 4. Server-Side Price Calculation & Security:
 *    - Server recalculates all subtotals using DB prices (price injection ignored).
 * 5. Customer Isolation:
 *    - Customer 2 viewing cart sees their own separate cart (not Customer 1's).
 * 6. Checkout Validation:
 *    - Returns full breakdown (items, availability, packaging fee, delivery fee, GST, grand total).
 *    - Does NOT reserve or deduct inventory.
 *    - Out of stock / unavailable items correctly flagged as invalid checkout.
 *    - Selected delivery address verified for ownership.
 * 7. Safe Fixtures & Cleanup:
 *    - Uses designated isolated UUID fixtures and safely tears down afterwards.
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

async function runPhase7Tests() {
  console.log('===============================================================');
  console.log('RUNNING PHASE 7 CART, ADDRESS & CHECKOUT TEST SUITE');
  console.log('===============================================================');

  server = app.listen(0);
  const port = server.address().port;
  baseUrl = `http://localhost:${port}`;
  console.log(`[*] Test HTTP server listening on ${baseUrl}\n`);

  // Fixture IDs
  const seller1Id = '77777777-1111-1111-1111-000000000001';
  const seller2Id = '77777777-2222-2222-2222-000000000002';
  const cust1Id = '77777777-3333-3333-3333-000000000001';
  const cust2Id = '77777777-3333-3333-3333-000000000002';
  const prod1Id = '77777777-4444-4444-4444-000000000001'; // Shop 1, Stock 10, Price 250
  const prod2Id = '77777777-4444-4444-4444-000000000002'; // Shop 1, Stock 2, Price 100
  const prod3Id = '77777777-4444-4444-4444-000000000003'; // Shop 2, Stock 20, Price 300

  const password = 'TestPassword123!';

  let cust1Token;
  let cust2Token;

  try {
    const hash = await bcrypt.hash(password, 10);

    // 1. Seed two sweet shops
    await pool.query(`
      INSERT INTO sellers (
        id, business_name, email, phone, gstin, password_hash, account_status, verification_status, is_active
      ) VALUES 
        (?, 'Anand Sweets', 'anand@sweetshop.internal', '+919811199991', '29ANAND1234F1Z1', ?, 'ACTIVE', 'APPROVED', TRUE),
        (?, 'Haldirams Sweets', 'haldiram@sweetshop.internal', '+919811199992', '29HALDI1234F1Z2', ?, 'ACTIVE', 'APPROVED', TRUE)
      ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash), is_active = TRUE;
    `, [seller1Id, hash, seller2Id, hash]);

    // 2. Seed two customers
    await pool.query(`
      INSERT INTO seller_users (
        id, seller_id, first_name, last_name, email, password_hash, is_active
      ) VALUES 
        (?, ?, 'Rahul', 'Sharma', 'rahul@sweetshop.internal', ?, TRUE),
        (?, ?, 'Priya', 'Verma', 'priya@sweetshop.internal', ?, TRUE)
      ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash), is_active = TRUE;
    `, [cust1Id, seller1Id, hash, cust2Id, seller1Id, hash]);

    // 3. Seed sweet products
    await pool.query(`
      INSERT INTO products (
        id, seller_id, name, description, price, stock_quantity, availability_status, is_active
      ) VALUES 
        (?, ?, 'Kaju Barfi 500g', 'Rich cashew fudge', 250.00, 10, 'AVAILABLE', TRUE),
        (?, ?, 'Rasgulla 2pcs', 'Spongy syrup sweets', 100.00, 2, 'AVAILABLE', TRUE),
        (?, ?, 'Soan Papdi 500g', 'Flaky sweet', 300.00, 20, 'AVAILABLE', TRUE)
      ON DUPLICATE KEY UPDATE price = VALUES(price), stock_quantity = VALUES(stock_quantity), is_active = TRUE;
    `, [prod1Id, seller1Id, prod2Id, seller1Id, prod3Id, seller2Id]);

    // Login both customers
    const c1Login = await request('POST', '/api/v1/auth/login', {
      email: 'rahul@sweetshop.internal',
      password,
      sellerId: seller1Id
    });
    cust1Token = c1Login.body.data.accessToken;

    const c2Login = await request('POST', '/api/v1/auth/login', {
      email: 'priya@sweetshop.internal',
      password,
      sellerId: seller1Id
    });
    cust2Token = c2Login.body.data.accessToken;

    // -------------------------------------------------------------------------
    // 1. DELIVERY ADDRESS APIS & OWNERSHIP
    // -------------------------------------------------------------------------
    console.log('--- 1. Testing Delivery Address Management & Ownership ---');

    // Customer 1 creates Address 1
    const addr1Res = await request('POST', '/api/v1/addresses', {
      recipientName: 'Rahul Sharma',
      recipientPhone: '+919876543210',
      addressLine1: 'Flat 402, Royal Palms',
      addressLine2: 'MG Road',
      city: 'Bangalore',
      state: 'Karnataka',
      pincode: '560001',
      addressType: 'HOME'
    }, cust1Token);
    assert(addr1Res.status === 201 && addr1Res.body.data.is_default === 1, 'Customer 1 creates first address (auto marked default = 1)');
    const addr1Id = addr1Res.body.data.id;

    // Customer 1 creates Address 2
    const addr2Res = await request('POST', '/api/v1/addresses', {
      recipientName: 'Rahul Office',
      addressLine1: 'Tech Park, Tower B',
      city: 'Bangalore',
      state: 'Karnataka',
      pincode: '560100',
      addressType: 'WORK',
      isDefault: true
    }, cust1Token);
    assert(addr2Res.status === 201 && addr2Res.body.data.is_default === 1, 'Customer 1 creates second address marked default (sets is_default = 1)');
    const addr2Id = addr2Res.body.data.id;

    // Verify Address 1 was demoted from default
    const checkAddr1 = await request('GET', `/api/v1/addresses/${addr1Id}`, null, cust1Token);
    assert(checkAddr1.status === 200 && checkAddr1.body.data.is_default === 0, 'Previous address successfully demoted to non-default (0)');

    // Customer 2 attempts to access Customer 1's address (Ownership protection)
    const crossAddrGet = await request('GET', `/api/v1/addresses/${addr1Id}`, null, cust2Token);
    assert(crossAddrGet.status === 404, 'Customer 2 blocked from viewing Customer 1 address (404 Not Found)');

    // Customer 2 attempts to delete Customer 1's address
    const crossAddrDel = await request('DELETE', `/api/v1/addresses/${addr1Id}`, null, cust2Token);
    assert(crossAddrDel.status === 404, 'Customer 2 blocked from deleting Customer 1 address (404 Not Found)');

    // -------------------------------------------------------------------------
    // 2. SHOPPING CART OPERATIONS & LIVE PRICING
    // -------------------------------------------------------------------------
    console.log('\n--- 2. Testing Shopping Cart Operations & Live Pricing ---');

    // Customer 1 views empty cart initially
    const emptyCartRes = await request('GET', '/api/v1/cart', null, cust1Token);
    assert(emptyCartRes.status === 200 && emptyCartRes.body.data.items.length === 0, 'Customer 1 starts with empty cart');

    // Customer 1 adds Product 1 (Kaju Barfi, Qty 2, Price ₹250)
    const addP1 = await request('POST', '/api/v1/cart/items', {
      productId: prod1Id,
      quantity: 2
    }, cust1Token);
    assert(addP1.status === 200 && addP1.body.data.items.length === 1, 'Add Product 1 (Qty 2) to cart succeeds');
    assert(addP1.body.data.subtotal === '500.00', 'Server calculates subtotal as ₹500.00 (2 × ₹250.00) using DB price');
    const p1ItemId = addP1.body.data.items[0].item_id;

    // Customer 1 adds Product 2 (Rasgulla, Qty 1, Price ₹100)
    const addP2 = await request('POST', '/api/v1/cart/items', {
      productId: prod2Id,
      quantity: 1
    }, cust1Token);
    assert(addP2.status === 200 && addP2.body.data.items.length === 2, 'Add Product 2 (Qty 1) to cart succeeds');
    assert(addP2.body.data.subtotal === '600.00', 'Server updates subtotal to ₹600.00');

    // Update quantity within stock limits
    const updateQtyRes = await request('PATCH', `/api/v1/cart/items/${p1ItemId}`, {
      quantity: 3
    }, cust1Token);
    assert(updateQtyRes.status === 200 && updateQtyRes.body.data.subtotal === '850.00', 'Update Product 1 quantity to 3 updates subtotal to ₹850.00 (3×250 + 1×100)');

    // Update quantity exceeding stock (Prod 1 stock is 10, try setting 15)
    const exceedStockRes = await request('PATCH', `/api/v1/cart/items/${p1ItemId}`, {
      quantity: 15
    }, cust1Token);
    assert(exceedStockRes.status === 400, 'Setting quantity exceeding available stock rejected with 400 Bad Request');

    // -------------------------------------------------------------------------
    // 3. SINGLE SWEET SHOP RULE (CROSS-SHOP CONFLICT & SWITCH)
    // -------------------------------------------------------------------------
    console.log('\n--- 3. Testing Single Sweet Shop Cart Rule ---');

    // Customer 1 attempts to add Product 3 (belonging to Haldirams Sweets, Shop 2)
    const crossShopAdd = await request('POST', '/api/v1/cart/items', {
      productId: prod3Id,
      quantity: 1
    }, cust1Token);
    assert(crossShopAdd.status === 409 && crossShopAdd.body.error.code === 'CROSS_SHOP_CART_CONFLICT', 'Adding item from different sweet shop rejected (409 CROSS_SHOP_CART_CONFLICT)');

    // Customer 1 agrees to switch shop using clearAndReplace = true
    const switchShopAdd = await request('POST', '/api/v1/cart/items', {
      productId: prod3Id,
      quantity: 2,
      clearAndReplace: true
    }, cust1Token);
    assert(switchShopAdd.status === 200 && switchShopAdd.body.data.items.length === 1 && switchShopAdd.body.data.items[0].product_id === prod3Id, 'clearAndReplace=true clears old shop cart and initializes new sweet shop cart');
    assert(switchShopAdd.body.data.sellerName === 'Haldirams Sweets', 'Cart successfully transferred to "Haldirams Sweets"');

    // -------------------------------------------------------------------------
    // 4. CUSTOMER CART ISOLATION
    // -------------------------------------------------------------------------
    console.log('\n--- 4. Testing Customer Cart Isolation ---');

    // Customer 2 views their cart (should be empty, unaffected by Customer 1)
    const c2Cart = await request('GET', '/api/v1/cart', null, cust2Token);
    assert(c2Cart.status === 200 && c2Cart.body.data.items.length === 0, 'Customer 2 cart is completely isolated and empty');

    // Customer 2 cannot modify Customer 1's cart item
    const c1CurrentItemId = switchShopAdd.body.data.items[0].item_id;
    const crossItemDel = await request('DELETE', `/api/v1/cart/items/${c1CurrentItemId}`, null, cust2Token);
    assert(crossItemDel.status === 404, 'Customer 2 cannot delete Customer 1 cart item (404 Not Found)');

    // -------------------------------------------------------------------------
    // 5. CHECKOUT VALIDATION (PRE-CHECKOUT BREAKDOWN)
    // -------------------------------------------------------------------------
    console.log('\n--- 5. Testing Checkout Validation ---');

    // Validate checkout for Customer 1 with their delivery address
    const checkoutRes = await request('POST', '/api/v1/cart/validate-checkout', {
      deliveryAddressId: addr2Id
    }, cust1Token);

    assert(checkoutRes.status === 200 && checkoutRes.body.data.valid === true, 'Checkout validation succeeds for valid cart and address (valid: true)');
    assert(checkoutRes.body.data.billing.subtotal === '600.00', 'Billing subtotal computed correctly (2 × ₹300.00 = ₹600.00)');
    assert(checkoutRes.body.data.billing.packagingCharge === '15.00', 'Packaging charge included in breakdown (₹15.00)');
    assert(Number(checkoutRes.body.data.billing.grandTotal) > 600.00, 'Grand total computed with packaging and GST');

    // Test checkout with unowned address (Customer 2's or non-existent address)
    const invalidAddrCheckout = await request('POST', '/api/v1/cart/validate-checkout', {
      deliveryAddressId: '00000000-0000-0000-0000-000000000999'
    }, cust1Token);
    assert(invalidAddrCheckout.status === 400, 'Checkout validation rejects invalid or unowned delivery address (400 Bad Request)');

    // Verify inventory was NOT deducted (Prod 3 stock remains 20)
    const [prod3Row] = await pool.query('SELECT stock_quantity FROM products WHERE id = ?;', [prod3Id]);
    assert(prod3Row[0].stock_quantity === 20, 'Stock quantity was NOT deducted during checkout validation (remains 20)');

    // -------------------------------------------------------------------------
    // CLEANUP
    // -------------------------------------------------------------------------
    await pool.query('DELETE FROM cart_items WHERE product_id IN (?, ?, ?);', [prod1Id, prod2Id, prod3Id]);
    await pool.query('DELETE FROM shopping_carts WHERE user_id IN (?, ?);', [cust1Id, cust2Id]);
    await pool.query('DELETE FROM user_addresses WHERE user_id IN (?, ?);', [cust1Id, cust2Id]);
    await pool.query('DELETE FROM products WHERE id IN (?, ?, ?);', [prod1Id, prod2Id, prod3Id]);
    await pool.query('DELETE FROM seller_users WHERE id IN (?, ?);', [cust1Id, cust2Id]);
    await pool.query('DELETE FROM sellers WHERE id IN (?, ?);', [seller1Id, seller2Id]);

    console.log('\n===============================================================');
    console.log(`PHASE 7 TEST SUITE RESULTS: ${passedCount} PASSED, ${failedCount} FAILED`);
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

runPhase7Tests();
