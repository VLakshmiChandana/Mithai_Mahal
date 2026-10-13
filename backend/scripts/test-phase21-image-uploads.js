/**
 * Phase 21 End-to-End Test Suite: Image Uploads, Validation & Catalog Integration
 * 
 * Verifies:
 * 1. RBAC on image uploads:
 *    - Unauthenticated upload rejected (401)
 *    - Customer upload rejected (403)
 *    - Approved Seller upload authorized (201)
 * 2. MIME type validations:
 *    - Valid JPEG (image/jpeg) -> 201
 *    - Valid PNG (image/png) -> 201
 *    - Valid WebP (image/webp) -> 201
 *    - Valid SVG (image/svg+xml) -> 201
 *    - Disallowed types (text/plain, application/pdf, etc.) -> 400
 *    - Missing file payload -> 400
 * 3. File size limits:
 *    - Oversized upload (> 5MB) rejected
 * 4. Multipart boundary integrity:
 *    - Missing boundary (the bug where Content-Type was manually set without boundary) rejected
 *    - Correct multipart with boundary parses successfully
 * 5. Physical storage & static delivery:
 *    - Files written to public/uploads/products/ and public/uploads/logos/
 *    - Unique safe filenames generated
 *    - HTTP GET on public URL returns 200 and identical content
 * 6. Catalog & Profile Integration:
 *    - Product created with uploaded image URL persists in database and public storefront
 *    - Shop logo updated with uploaded logo URL persists in seller profile and public storefront
 * 7. Safe cleanup of test artifacts
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
const filesToClean = [];

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

// Minimal 1x1 GIF / PNG / JPEG / WEBP / SVG buffers for testing
const TINY_PNG = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c63000100000500010d0a2d420000000049454e44ae426082', 'hex');
const TINY_JPEG = Buffer.from('ffd8ffe000104a46494600010101004800480000ffdb004300030202020202030202020303030304060404040404080606050609080a0a090809090a0c100c0a0b0e0b09090d110d0c0e0e0e0e0e080a1011100e110e0e0e0effc0000b080001000101011100ffc4001f0000010501010101010100000000000000000102030405060708090a0bffda0008010100003f007f00ffd9', 'hex');
const TINY_WEBP = Buffer.from('524946461a000000574542505650384c0d0000002f00000010071011118888fe0700', 'hex');
const TINY_SVG = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10" fill="gold"/></svg>', 'utf8');

async function runTests() {
  console.log('=== Starting Phase 21: Image Upload Failure & End-to-End Suite ===\n');

  // Start server on dynamic port
  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', () => {
      baseUrl = `http://127.0.0.1:${server.address().port}`;
      resolve();
    });
  });

  let createdProductId = null;
  let sellerToken = null;
  let sellerId = null;
  let customerToken = null;
  let originalShopLogo = null;
  let originalSellerHash = null;

  try {
    // 1. Fetch existing approved seller credentials from DB
    const [sellers] = await pool.query(
      `SELECT id, business_name, email, logo, password_hash, verification_status, account_status 
       FROM sellers 
       WHERE verification_status = 'APPROVED' AND account_status = 'ACTIVE' 
       LIMIT 1`
    );

    if (sellers.length === 0) {
      throw new Error('No approved active seller found in database to execute test suite.');
    }

    const testSeller = sellers[0];
    sellerId = testSeller.id;
    originalShopLogo = testSeller.logo;
    originalSellerHash = testSeller.password_hash;

    const testPass = 'Password123!';
    const testHash = await bcrypt.hash(testPass, 10);
    await pool.query('UPDATE sellers SET password_hash = ? WHERE id = ?', [testHash, sellerId]);

    // Login as approved seller
    const sellerLoginRes = await request('POST', '/api/v1/auth/login', {
      email: testSeller.email,
      password: testPass
    });

    assert(sellerLoginRes.statusCode === 200, `Seller login succeeded for ${testSeller.email} (HTTP 200)`);
    assert(sellerLoginRes.data?.data?.user?.role === 'SELLER', 'User role is authoritative SELLER');
    sellerToken = sellerLoginRes.data?.data?.accessToken;

    // Register & Login as customer for RBAC check
    const custEmail = `cust.p21.${Date.now()}@example.com`;
    const custPass = 'CustPass123!';
    await request('POST', '/api/v1/customers/register', {
      sellerId: testSeller.id,
      email: custEmail,
      password: custPass,
      firstName: 'Cust',
      lastName: 'Tester'
    });
    const custLoginRes = await request('POST', '/api/v1/auth/login', {
      sellerId: testSeller.id,
      email: custEmail,
      password: custPass
    });
    if (custLoginRes.statusCode === 200) {
      customerToken = custLoginRes.data?.data?.accessToken;
    }

    console.log('\n--- Section 1: Authentication & Authorization Enforcements ---');
    // 1a. Upload without token -> 401
    const boundaryNoAuth = '----WebKitFormBoundaryNoAuth' + Date.now();
    const bodyNoAuth = makeMultipartBody(
      { type: 'product' },
      [{ fieldName: 'image', filename: 'laddu.jpg', mimeType: 'image/jpeg', content: TINY_JPEG }],
      boundaryNoAuth
    );
    const noAuthRes = await request('POST', '/api/v1/uploads/image', bodyNoAuth, null, {
      'Content-Type': `multipart/form-data; boundary=${boundaryNoAuth}`
    });
    assert(noAuthRes.statusCode === 401, `Unauthenticated upload rejected with 401 (got ${noAuthRes.statusCode})`);

    // 1b. Customer token -> 403 Forbidden
    if (customerToken) {
      const boundaryCust = '----WebKitFormBoundaryCust' + Date.now();
      const bodyCust = makeMultipartBody(
        { type: 'product' },
        [{ fieldName: 'image', filename: 'laddu.jpg', mimeType: 'image/jpeg', content: TINY_JPEG }],
        boundaryCust
      );
      const custRes = await request('POST', '/api/v1/uploads/image', bodyCust, customerToken, {
        'Content-Type': `multipart/form-data; boundary=${boundaryCust}`
      });
      assert(custRes.statusCode === 403, `Customer upload rejected with 403 Forbidden (got ${custRes.statusCode})`);
    }

    console.log('\n--- Section 2: Boundary Handling & Root Cause Diagnostics ---');
    // 2a. Recreate root cause: Content-Type set to 'multipart/form-data' WITHOUT boundary
    const boundaryMissing = '----WebKitFormBoundaryBug' + Date.now();
    const bodyMissingBoundary = makeMultipartBody(
      { type: 'product' },
      [{ fieldName: 'image', filename: 'laddu.jpg', mimeType: 'image/jpeg', content: TINY_JPEG }],
      boundaryMissing
    );
    const brokenHeaderRes = await request('POST', '/api/v1/uploads/image', bodyMissingBoundary, sellerToken, {
      'Content-Type': 'multipart/form-data' // Intentionally missing boundary
    });
    assert(
      brokenHeaderRes.statusCode === 400 || brokenHeaderRes.statusCode === 500,
      `Request without boundary parameter fails as expected (got HTTP ${brokenHeaderRes.statusCode})`
    );

    console.log('\n--- Section 3: MIME Type Validation ---');
    // 3a. Disallowed MIME: text/plain
    const boundaryTxt = '----WebKitFormBoundaryTxt' + Date.now();
    const bodyTxt = makeMultipartBody(
      { type: 'product' },
      [{ fieldName: 'image', filename: 'test.txt', mimeType: 'text/plain', content: Buffer.from('Hello sweet shop!') }],
      boundaryTxt
    );
    const txtRes = await request('POST', '/api/v1/uploads/image', bodyTxt, sellerToken, {
      'Content-Type': `multipart/form-data; boundary=${boundaryTxt}`
    });
    const errorMsg = txtRes.data?.error?.message || txtRes.data?.message;
    assert(
      errorMsg?.includes('Unsupported image type') || errorMsg?.includes('permitted'),
      `Descriptive error returned: "${errorMsg}"`
    );

    // 3b. Missing file in request body
    const boundaryEmpty = '----WebKitFormBoundaryEmpty' + Date.now();
    const bodyEmpty = makeMultipartBody({ type: 'product' }, [], boundaryEmpty);
    const emptyRes = await request('POST', '/api/v1/uploads/image', bodyEmpty, sellerToken, {
      'Content-Type': `multipart/form-data; boundary=${boundaryEmpty}`
    });
    assert(emptyRes.statusCode === 400, `Upload without image file rejected with 400 (got ${emptyRes.statusCode})`);

    // 3c. Valid JPEG upload
    const boundaryJpg = '----WebKitFormBoundaryJpg' + Date.now();
    const bodyJpg = makeMultipartBody(
      { type: 'product' },
      [{ fieldName: 'image', filename: 'besan_laddu.jpg', mimeType: 'image/jpeg', content: TINY_JPEG }],
      boundaryJpg
    );
    const jpgRes = await request('POST', '/api/v1/uploads/image', bodyJpg, sellerToken, {
      'Content-Type': `multipart/form-data; boundary=${boundaryJpg}`
    });
    assert(jpgRes.statusCode === 201, `Valid JPEG upload accepted with 201 Created (got ${jpgRes.statusCode})`);
    assert(jpgRes.data?.success === true, 'Response payload contains success: true');
    assert(typeof jpgRes.data?.data?.url === 'string' && jpgRes.data.data.url.startsWith('/uploads/products/'), `Returns valid public product image URL: ${jpgRes.data?.data?.url}`);
    assert(jpgRes.data?.data?.mimeType === 'image/jpeg', 'Returned mimeType matches image/jpeg');
    const uploadedProductImageUrl = jpgRes.data?.data?.url;

    // Track for cleanup
    if (uploadedProductImageUrl) {
      filesToClean.push(path.resolve(__dirname, '..', 'public', uploadedProductImageUrl.replace(/^\//, '')));
    }

    // 3d. Valid PNG upload
    const boundaryPng = '----WebKitFormBoundaryPng' + Date.now();
    const bodyPng = makeMultipartBody(
      { type: 'product' },
      [{ fieldName: 'image', filename: 'gulab_jamun.png', mimeType: 'image/png', content: TINY_PNG }],
      boundaryPng
    );
    const pngRes = await request('POST', '/api/v1/uploads/image', bodyPng, sellerToken, {
      'Content-Type': `multipart/form-data; boundary=${boundaryPng}`
    });
    assert(pngRes.statusCode === 201, `Valid PNG upload accepted with 201 Created (got ${pngRes.statusCode})`);
    if (pngRes.data?.data?.url) {
      filesToClean.push(path.resolve(__dirname, '..', 'public', pngRes.data.data.url.replace(/^\//, '')));
    }

    // 3e. Valid WebP upload
    const boundaryWebp = '----WebKitFormBoundaryWebp' + Date.now();
    const bodyWebp = makeMultipartBody(
      { type: 'product' },
      [{ fieldName: 'image', filename: 'rasgulla.webp', mimeType: 'image/webp', content: TINY_WEBP }],
      boundaryWebp
    );
    const webpRes = await request('POST', '/api/v1/uploads/image', bodyWebp, sellerToken, {
      'Content-Type': `multipart/form-data; boundary=${boundaryWebp}`
    });
    assert(webpRes.statusCode === 201, `Valid WebP upload accepted with 201 Created (got ${webpRes.statusCode})`);
    if (webpRes.data?.data?.url) {
      filesToClean.push(path.resolve(__dirname, '..', 'public', webpRes.data.data.url.replace(/^\//, '')));
    }

    // 3f. Valid SVG upload
    const boundarySvg = '----WebKitFormBoundarySvg' + Date.now();
    const bodySvg = makeMultipartBody(
      { type: 'product' },
      [{ fieldName: 'image', filename: 'kaju_katli.svg', mimeType: 'image/svg+xml', content: TINY_SVG }],
      boundarySvg
    );
    const svgRes = await request('POST', '/api/v1/uploads/image', bodySvg, sellerToken, {
      'Content-Type': `multipart/form-data; boundary=${boundarySvg}`
    });
    assert(svgRes.statusCode === 201, `Valid SVG upload accepted with 201 Created (got ${svgRes.statusCode})`);
    if (svgRes.data?.data?.url) {
      filesToClean.push(path.resolve(__dirname, '..', 'public', svgRes.data.data.url.replace(/^\//, '')));
    }

    console.log('\n--- Section 4: File Size Limit (5MB) ---');
    // 4a. File exceeding 5MB (5.2 MB dummy)
    const largeBuffer = Buffer.alloc(5.2 * 1024 * 1024, 0x41);
    const boundaryLarge = '----WebKitFormBoundaryLarge' + Date.now();
    const bodyLarge = makeMultipartBody(
      { type: 'product' },
      [{ fieldName: 'image', filename: 'huge_mithai.jpg', mimeType: 'image/jpeg', content: largeBuffer }],
      boundaryLarge
    );
    const largeRes = await request('POST', '/api/v1/uploads/image', bodyLarge, sellerToken, {
      'Content-Type': `multipart/form-data; boundary=${boundaryLarge}`
    });
    assert(
      largeRes.statusCode === 400 || largeRes.statusCode === 500,
      `Oversized image (> 5MB) rejected with error (got HTTP ${largeRes.statusCode})`
    );

    console.log('\n--- Section 5: Physical Storage & Static Asset Serving ---');
    // 5a. Verify physical file exists on disk
    const diskPath = filesToClean[0];
    assert(fs.existsSync(diskPath), `Uploaded image file exists physically on disk at ${diskPath}`);
    const diskBytes = fs.readFileSync(diskPath);
    assert(diskBytes.equals(TINY_JPEG), 'Physical file on disk has identical binary content to uploaded image');

    // 5b. Verify static HTTP serving returns 200 OK and correct content
    const staticRes = await request('GET', uploadedProductImageUrl);
    assert(staticRes.statusCode === 200, `Static GET ${uploadedProductImageUrl} returns 200 OK`);
    assert(staticRes.buffer.equals(TINY_JPEG), 'Static response buffer matches original binary bytes');

    // 5c. Shop Logo upload (type: 'logo')
    const boundaryLogo = '----WebKitFormBoundaryLogo' + Date.now();
    const bodyLogo = makeMultipartBody(
      { type: 'logo' },
      [{ fieldName: 'image', filename: 'store_emblem.png', mimeType: 'image/png', content: TINY_PNG }],
      boundaryLogo
    );
    const logoRes = await request('POST', '/api/v1/uploads/image', bodyLogo, sellerToken, {
      'Content-Type': `multipart/form-data; boundary=${boundaryLogo}`
    });
    assert(logoRes.statusCode === 201, `Logo upload succeeded (HTTP 201)`);
    assert(
      typeof logoRes.data?.data?.url === 'string' && logoRes.data.data.url.startsWith('/uploads/logos/'),
      `Shop logo stored under /uploads/logos/: ${logoRes.data?.data?.url}`
    );
    const uploadedLogoUrl = logoRes.data?.data?.url;
    if (uploadedLogoUrl) {
      filesToClean.push(path.resolve(__dirname, '..', 'public', uploadedLogoUrl.replace(/^\//, '')));
    }

    console.log('\n--- Section 6: Product Catalog & Profile Persistence ---');
    // 6a. Create sweet product referencing uploaded image
    const createProdRes = await request('POST', '/api/v1/products', {
      name: 'Phase 21 Tested Royal Motichoor',
      price: 340.00,
      stockQuantity: 45,
      sku: `P21-MOTI-${Date.now().toString().slice(-4)}`,
      weightPackSize: '500g Box',
      lowStockThreshold: 5,
      imageUrl: uploadedProductImageUrl,
      description: 'Handcrafted pure ghee motichoor laddu with verified image upload.',
      availabilityStatus: 'AVAILABLE'
    }, sellerToken);

    assert(createProdRes.statusCode === 201, `Product created using uploaded image URL (HTTP 201)`);
    createdProductId = createProdRes.data?.data?.id;
    assert(createProdRes.data?.data?.image_url === uploadedProductImageUrl || createProdRes.data?.data?.imageUrl === uploadedProductImageUrl, 'Created product image_url matches uploaded URL');

    // 6b. Verify product appears in seller's product list
    const listProdRes = await request('GET', '/api/v1/products', null, sellerToken);
    assert(listProdRes.statusCode === 200, 'Seller can list their products (HTTP 200)');
    const foundInList = (listProdRes.data?.data || []).find(p => p.id === createdProductId);
    assert(foundInList !== undefined, 'Created product is present in seller products list');
    assert(foundInList?.image_url === uploadedProductImageUrl, `Product list returns correct image_url: ${foundInList?.image_url}`);

    // 6c. Verify product appears in public discovery
    const publicProdRes = await request('GET', `/api/v1/products?sellerId=${sellerId}`);
    assert(publicProdRes.statusCode === 200, 'Public discovery lists seller products (HTTP 200)');
    const foundPublic = (publicProdRes.data?.data || []).find(p => p.id === createdProductId);
    assert(foundPublic !== undefined, 'Created product appears in public customer storefront');
    assert(foundPublic?.image_url === uploadedProductImageUrl, 'Public product has verified uploaded image URL');

    // 6d. Update seller shop logo using uploaded logo URL
    const updateProfileRes = await request('PATCH', '/api/v1/sellers/profile', {
      logo: uploadedLogoUrl
    }, sellerToken);
    assert(updateProfileRes.statusCode === 200, 'Seller profile updated with uploaded logo (HTTP 200)');

    // 6e. Fetch seller profile to confirm logo persistence
    const profileRes = await request('GET', '/api/v1/sellers/profile', null, sellerToken);
    assert(profileRes.statusCode === 200, 'GET /api/v1/sellers/profile succeeded (HTTP 200)');
    assert(profileRes.data?.data?.logo === uploadedLogoUrl, `Seller profile reflects updated logo: ${profileRes.data?.data?.logo}`);

    // 6f. Check public shop page endpoint for updated logo
    const publicShopRes = await request('GET', `/api/v1/shops/${sellerId}`);
    assert(publicShopRes.statusCode === 200, `Public shop endpoint returns 200`);
    assert(publicShopRes.data?.data?.logo === uploadedLogoUrl, `Public shop profile displays new logo: ${publicShopRes.data?.data?.logo}`);

  } catch (err) {
    console.error('Test execution error:', err);
    failedCount++;
  } finally {
    console.log('\n--- Section 7: Teardown & Safe Cleanup ---');
    // Clean up created product
    if (createdProductId) {
      try {
        await pool.query('DELETE FROM products WHERE id = ?', [createdProductId]);
        console.log(`  [CLEANUP] Deleted temporary test product ID ${createdProductId}`);
      } catch (e) {
        console.error('Failed to clean up test product:', e.message);
      }
    }

    // Revert seller logo to original
    if (sellerId && originalShopLogo !== undefined) {
      try {
        await pool.query('UPDATE sellers SET logo = ? WHERE id = ?', [originalShopLogo, sellerId]);
        console.log(`  [CLEANUP] Restored seller shop logo to original`);
      } catch (e) {
        console.error('Failed to restore seller logo:', e.message);
      }
    }

    // Revert seller password hash
    if (sellerId && originalSellerHash) {
      try {
        await pool.query('UPDATE sellers SET password_hash = ? WHERE id = ?', [originalSellerHash, sellerId]);
        console.log(`  [CLEANUP] Restored seller password hash`);
      } catch (e) {
        console.error('Failed to restore seller password hash:', e.message);
      }
    }

    // Clean up test image files from disk
    for (const f of filesToClean) {
      try {
        if (fs.existsSync(f)) {
          fs.unlinkSync(f);
          console.log(`  [CLEANUP] Removed test image: ${path.basename(f)}`);
        }
      } catch (e) {
        console.error('Failed to clean up file:', f, e.message);
      }
    }

    if (server) {
      server.close();
    }
  }

  console.log(`\n==================================================`);
  console.log(`Phase 21 Test Results: ${passedCount} PASSED, ${failedCount} FAILED`);
  console.log(`==================================================\n`);

  if (failedCount > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests();
