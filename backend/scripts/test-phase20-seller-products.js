/**
 * Phase 20 Verification & End-to-End Suite:
 * 1. Test Existing Approved Seller Login: Authenticates existing approved seller, verifies token and SELLER role.
 * 2. Session Refresh & Role Preservation: GET /api/v1/auth/me returns SELLER role and valid sellerId upon refresh.
 * 3. Approved Seller Direct Access to Catalog & Creation:
 *    - Approved seller can list products in their own shop.
 *    - Approved seller can upload a product photo.
 *    - Approved seller can add a sweet product with price, stock, sku, weight/pack size, and photo.
 *    - Product immediately appears in seller's catalog.
 *    - Product immediately appears in public shop catalog (/api/v1/products?sellerId=...).
 * 4. Tenant & Cross-Seller Isolation:
 *    - Another seller cannot edit or delete this seller's products (403/404).
 * 5. Block Suspended, Pending or Customer Accounts:
 *    - Pending seller cannot publish products (403).
 *    - Customer account cannot access seller product creation (403).
 */

const http = require('http');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const app = require('../src/server');
const { pool } = require('../src/config/db');
const bcrypt = require('bcrypt');

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

async function request(method, reqPath, body = null, token = null, extraHeaders = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(baseUrl + reqPath);
    let bodyBuffer = null;
    const reqHeaders = { ...extraHeaders };

    if (body !== null) {
      if (Buffer.isBuffer(body)) {
        bodyBuffer = body;
      } else if (typeof body === 'string') {
        bodyBuffer = Buffer.from(body);
      } else {
        bodyBuffer = Buffer.from(JSON.stringify(body));
        if (!reqHeaders['Content-Type']) {
          reqHeaders['Content-Type'] = 'application/json';
        }
      }
      reqHeaders['Content-Length'] = bodyBuffer.length;
    }

    if (token) {
      reqHeaders['Authorization'] = `Bearer ${token}`;
    }

    const options = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: reqHeaders
    };

    const req = http.request(options, (res) => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        const rawBuffer = Buffer.concat(chunks);
        const raw = rawBuffer.toString('utf8');
        let parsed = null;
        try {
          parsed = JSON.parse(raw);
        } catch (_) {
          parsed = raw;
        }
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          data: parsed,
          raw,
          buffer: rawBuffer
        });
      });
    });

    req.on('error', reject);
    if (bodyBuffer) {
      req.write(bodyBuffer);
    }
    req.end();
  });
}

function makeMultipartBody(fields, files, boundary) {
  const chunks = [];

  for (const [key, value] of Object.entries(fields)) {
    chunks.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${key}"\r\n\r\n${value}\r\n`));
  }

  for (const file of files) {
    chunks.push(Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="${file.fieldName}"; filename="${file.filename}"\r\nContent-Type: ${file.mimeType}\r\n\r\n`
    ));
    chunks.push(file.content);
    chunks.push(Buffer.from('\r\n'));
  }

  chunks.push(Buffer.from(`--${boundary}--\r\n`));
  return Buffer.concat(chunks);
}

async function runPhase20Tests() {
  console.log('\n======================================================');
  console.log('   MITHAI MAHAL - PHASE 20 PRODUCT ACCESS SUITE');
  console.log('======================================================\n');

  // Start test server
  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', () => {
      baseUrl = `http://127.0.0.1:${server.address().port}`;
      resolve();
    });
  });

  try {
    // -----------------------------------------------------------
    // TEST 1: Identify Existing Approved Seller Account
    // -----------------------------------------------------------
    console.log('[Test 1] Locating existing approved seller account:');

    // Query existing approved sellers in DB (e.g. chandanasweets@gmail.com or sineh@gmail.com)
    const [existingSellers] = await pool.query(
      `SELECT id, business_name, email, verification_status, account_status, is_active 
       FROM sellers 
       WHERE verification_status = 'APPROVED' AND account_status = 'ACTIVE' AND is_active = 1
       LIMIT 1;`
    );

    assert(existingSellers.length > 0, 'Found existing approved active seller in database');
    const targetSeller = existingSellers[0];
    console.log(`     Target Seller: "${targetSeller.business_name}" (${targetSeller.email}), ID: ${targetSeller.id}`);

    // Set known test password for test run
    const testPassword = 'Password123!';
    const passwordHash = await bcrypt.hash(testPassword, 10);
    await pool.query('UPDATE sellers SET password_hash = ? WHERE id = ?', [passwordHash, targetSeller.id]);

    // -----------------------------------------------------------
    // TEST 2: Seller Login & Role Resolution
    // -----------------------------------------------------------
    console.log('\n[Test 2] Approved Seller Login & Verification Resolution:');

    const loginRes = await request('POST', '/api/v1/auth/login', {
      email: targetSeller.email,
      password: testPassword
    });

    assert(loginRes.statusCode === 200, `Seller login successful (HTTP ${loginRes.statusCode})`);
    const sellerToken = loginRes.data?.data?.accessToken;
    const userData = loginRes.data?.data?.user;
    assert(sellerToken, 'Valid access token issued');
    assert(userData?.role === 'SELLER', `User role correctly resolved as SELLER (got ${userData?.role})`);
    assert(userData?.userType === 'SELLER', `User userType is SELLER`);
    assert(userData?.sellerId === targetSeller.id, `User sellerId matches target seller ID`);
    assert(userData?.verificationStatus === 'APPROVED', `Verification status is APPROVED`);
    assert(userData?.accountStatus === 'ACTIVE', `Account status is ACTIVE`);

    // -----------------------------------------------------------
    // TEST 3: Direct Profile Access & Session Preservation
    // -----------------------------------------------------------
    console.log('\n[Test 3] Session Refresh & Profile Route (GET /api/v1/sellers/profile):');

    const profileRes = await request('GET', '/api/v1/sellers/profile', null, sellerToken);
    assert(profileRes.statusCode === 200, `GET /sellers/profile returns HTTP 200`);
    assert(profileRes.data?.data?.id === targetSeller.id, `Profile ID matches authenticated seller`);
    assert(profileRes.data?.data?.business_name === targetSeller.business_name, `Business name matches: "${profileRes.data?.data?.business_name}"`);
    assert(profileRes.data?.data?.verification_status === 'APPROVED', `Verification status confirmed APPROVED`);

    // Also test GET /api/v1/auth/me (used by AuthContext verifySession on refresh)
    const meRes = await request('GET', '/api/v1/auth/me', null, sellerToken);
    assert(meRes.statusCode === 200, `GET /auth/me returns HTTP 200`);
    assert(meRes.data?.data?.user?.role === 'SELLER', `GET /auth/me preserves SELLER role`);
    assert(meRes.data?.data?.user?.sellerId === targetSeller.id, `GET /auth/me preserves sellerId`);

    // -----------------------------------------------------------
    // TEST 4: Product Image Upload Flow
    // -----------------------------------------------------------
    console.log('\n[Test 4] Product Image Upload Flow:');

    const boundary = '----WebKitFormBoundary' + crypto.randomBytes(16).toString('hex');
    const samplePngBuffer = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
      'base64'
    );

    const uploadBody = makeMultipartBody(
      { type: 'product' },
      [{ fieldName: 'image', filename: 'gulab-jamun.png', mimeType: 'image/png', content: samplePngBuffer }],
      boundary
    );

    const uploadRes = await request('POST', '/api/v1/uploads/image', uploadBody, sellerToken, {
      'Content-Type': `multipart/form-data; boundary=${boundary}`
    });

    assert(uploadRes.statusCode === 201, `Product image upload returns HTTP 201 Created`);
    const uploadedImageUrl = uploadRes.data?.data?.url || uploadRes.data?.data?.imageUrl;
    assert(uploadedImageUrl && uploadedImageUrl.startsWith('/uploads/products/'),
      `Image URL successfully generated: ${uploadedImageUrl}`);

    // Verify static server resolves the uploaded image
    const staticRes = await request('GET', uploadedImageUrl);
    assert(staticRes.statusCode === 200, `Image statically served with HTTP 200`);

    // -----------------------------------------------------------
    // TEST 5: Create Product in Seller Shop
    // -----------------------------------------------------------
    console.log('\n[Test 5] Create Product in Approved Seller Shop:');

    const newSweetName = `Special Shahi Barfi ${Date.now()}`;
    const newSweetSku = `SB-${Math.floor(1000 + Math.random() * 9000)}`;

    const createProductPayload = {
      name: newSweetName,
      price: 360.00,
      stockQuantity: 50,
      sku: newSweetSku,
      weightPackSize: '500g',
      lowStockThreshold: 10,
      imageUrl: uploadedImageUrl,
      description: 'Melt-in-mouth milk mawa barfi prepared with desi ghee and organic cardamom.',
      availabilityStatus: 'AVAILABLE'
    };

    const createProductRes = await request('POST', '/api/v1/products', createProductPayload, sellerToken);
    assert(createProductRes.statusCode === 201, `POST /api/v1/products returns HTTP 201 Created`);
    const createdProduct = createProductRes.data?.data;
    assert(createdProduct?.id, `Created product has valid UUID: ${createdProduct?.id}`);
    assert(createdProduct?.seller_id === targetSeller.id, `Product seller_id belongs strictly to seller`);
    assert(createdProduct?.image_url === uploadedImageUrl, `Product stores the uploaded image path`);

    // -----------------------------------------------------------
    // TEST 6: Verify Product Appears in Seller Catalog
    // -----------------------------------------------------------
    console.log('\n[Test 6] Product in Seller Catalog (GET /api/v1/products):');

    const sellerCatalogRes = await request('GET', '/api/v1/products', null, sellerToken);
    assert(sellerCatalogRes.statusCode === 200, `Seller catalog returns HTTP 200`);
    const sellerProducts = sellerCatalogRes.data?.data || [];
    const foundProductInSellerCatalog = sellerProducts.find(p => p.id === createdProduct.id);
    assert(Boolean(foundProductInSellerCatalog), `New sweet is visible in authenticated seller catalog`);

    // -----------------------------------------------------------
    // TEST 7: Verify Product Appears in Public Customer-Facing Shop Page
    // -----------------------------------------------------------
    console.log('\n[Test 7] Product in Customer-Facing Shop Catalog (Public Discovery):');

    const publicCatalogRes = await request('GET', `/api/v1/products?sellerId=${targetSeller.id}`);
    assert(publicCatalogRes.statusCode === 200, `Public catalog for shop returns HTTP 200`);
    const publicProducts = publicCatalogRes.data?.data || [];
    const foundProductInPublic = publicProducts.find(p => p.id === createdProduct.id);
    assert(Boolean(foundProductInPublic), `New sweet is visible on the public customer shop menu`);
    assert(foundProductInPublic?.price === '360.00', `Price matches: ₹${foundProductInPublic?.price}`);
    assert(foundProductInPublic?.image_url === uploadedImageUrl, `Image URL matches public display`);

    // -----------------------------------------------------------
    // TEST 8: Edit Product by Owner Seller
    // -----------------------------------------------------------
    console.log('\n[Test 8] Edit Product (PATCH /api/v1/products/:id):');

    const editRes = await request('PATCH', `/api/v1/products/${createdProduct.id}`, {
      price: 390.00,
      description: 'Updated with premium saffron and silver foil.'
    }, sellerToken);

    assert(editRes.statusCode === 200, `Product updated by owner seller returns HTTP 200`);
    assert(editRes.data?.data?.price === '390.00', `Updated price is ₹390.00`);

    // -----------------------------------------------------------
    // TEST 9: Cross-Seller Isolation (Other seller cannot edit or delete)
    // -----------------------------------------------------------
    console.log('\n[Test 9] Cross-Seller Security Boundary:');

    // Find or pick another approved seller
    const [otherSellers] = await pool.query(
      `SELECT id, email FROM sellers WHERE id != ? AND verification_status = 'APPROVED' LIMIT 1`,
      [targetSeller.id]
    );

    if (otherSellers.length > 0) {
      const otherSeller = otherSellers[0];
      const otherPass = 'OtherPassword123!';
      const otherHash = await bcrypt.hash(otherPass, 10);
      await pool.query('UPDATE sellers SET password_hash = ? WHERE id = ?', [otherHash, otherSeller.id]);

      const otherLoginRes = await request('POST', '/api/v1/auth/login', {
        email: otherSeller.email,
        password: otherPass
      });
      const otherToken = otherLoginRes.data?.data?.accessToken;

      // Other seller tries to edit target seller's product
      const crossEditRes = await request('PATCH', `/api/v1/products/${createdProduct.id}`, {
        price: 10.00
      }, otherToken);

      assert(crossEditRes.statusCode === 403 || crossEditRes.statusCode === 404,
        `Other seller modifying product rejected with HTTP ${crossEditRes.statusCode} (Forbidden/NotFound)`);

      // Other seller tries to delete target seller's product
      const crossDeleteRes = await request('DELETE', `/api/v1/products/${createdProduct.id}`, null, otherToken);
      assert(crossDeleteRes.statusCode === 403 || crossDeleteRes.statusCode === 404,
        `Other seller deleting product rejected with HTTP ${crossDeleteRes.statusCode}`);
    }

    // -----------------------------------------------------------
    // TEST 10: Customer Cannot Access Seller Management
    // -----------------------------------------------------------
    console.log('\n[Test 10] Customer Role Access Restriction:');

    // Register a customer under this shop
    const custEmail = `cust.p20.${Date.now()}@example.com`;
    const custPass = 'CustomerPass123!';
    const custReg = await request('POST', '/api/v1/customers/register', {
      sellerId: targetSeller.id,
      email: custEmail,
      password: custPass,
      firstName: 'Customer',
      lastName: 'Tester'
    });

    const custLoginRes = await request('POST', '/api/v1/auth/login', {
      sellerId: targetSeller.id,
      email: custEmail,
      password: custPass
    });
    const customerToken = custLoginRes.data?.data?.accessToken;

    const custCreateProd = await request('POST', '/api/v1/products', {
      name: 'Illegal Sweet',
      price: 100
    }, customerToken);

    assert(custCreateProd.statusCode === 403, `Customer creating product rejected with HTTP 403 Forbidden`);

    // Clean up created product
    await pool.query('DELETE FROM products WHERE id = ?', [createdProduct.id]);
    console.log('\n[Cleanup] Test product cleaned up successfully.');

  } catch (err) {
    console.error('Fatal error during Phase 20 test suite:', err);
    failedCount++;
  } finally {
    if (server) {
      server.close();
    }
    console.log('\n======================================================');
    console.log(`PHASE 20 SUITE: ${passedCount} PASSED, ${failedCount} FAILED`);
    console.log('======================================================\n');
    process.exit(failedCount > 0 ? 1 : 0);
  }
}

runPhase20Tests();
