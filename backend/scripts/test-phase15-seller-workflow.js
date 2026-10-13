/**
 * Comprehensive Automated Verification Suite for Phase 15:
 * Role-Based Authentication, Registration, Seller Verification, and Inventory Management
 * Uses native Node.js http module.
 */

const http = require('http');
const crypto = require('crypto');
const app = require('../src/server');
const config = require('../src/config/env');
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

async function request(method, path, body = null, token = null, extraHeaders = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(baseUrl + path);
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
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let parsed;
        try {
          parsed = JSON.parse(data);
        } catch {
          parsed = data;
        }
        resolve({ status: res.statusCode, headers: res.headers, body: parsed });
      });
    });

    req.on('error', reject);
    if (bodyBuffer) {
      req.write(bodyBuffer);
    }
    req.end();
  });
}

function buildMultipartFormData(fields, fileField) {
  const boundary = '----WebKitFormBoundary' + crypto.randomBytes(16).toString('hex');
  const buffers = [];

  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined && value !== null) {
      buffers.push(Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="${key}"\r\n\r\n${value}\r\n`
      ));
    }
  }

  if (fileField) {
    buffers.push(Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="${fileField.name}"; filename="${fileField.filename}"\r\nContent-Type: ${fileField.contentType}\r\n\r\n`
    ));
    buffers.push(fileField.buffer);
    buffers.push(Buffer.from('\r\n'));
  }

  buffers.push(Buffer.from(`--${boundary}--\r\n`));
  const fullBody = Buffer.concat(buffers);

  return {
    body: fullBody,
    headers: {
      'Content-Type': `multipart/form-data; boundary=${boundary}`
    }
  };
}

async function runTests() {
  console.log('\n================================================================');
  console.log('🚀 RUNNING PHASE 15 AUTOMATED VERIFICATION SUITE');
  console.log('================================================================\n');

  try {
    server = app.listen(0);
    const port = server.address().port;
    baseUrl = `http://localhost:${port}/api/v1`;

    // 1. Super Admin Authentication
    console.log('\n--- 1. SUPER ADMIN AUTHENTICATION ---');
    const superAdminEmail = 'superadmin@sweetshop.internal';
    const superAdminPassword = 'SuperAdminPassword123!';
    const bcrypt = require('bcrypt');
    const saHash = await bcrypt.hash(superAdminPassword, 10);
    await pool.query(
      'UPDATE super_admins SET password_hash = ?, is_active = TRUE WHERE email = ?;',
      [saHash, superAdminEmail]
    );

    const superAdminRes = await request('POST', '/auth/login', {
      email: superAdminEmail,
      password: superAdminPassword
    });
    assert(superAdminRes.status === 200, 'Super Admin logs in successfully');
    const superAdminToken = superAdminRes.body.data.accessToken;
    assert(superAdminRes.body.data.user.role === 'SUPER_ADMIN', 'Resolved role is SUPER_ADMIN');

    // 2. Super Admin Creates Platform Admin
    console.log('\n--- 2. SUPER ADMIN CREATES ADMIN STAFF ---');
    const testAdminEmail = `admin_test_${Date.now()}@mithaimahal.internal`;
    const createAdminRes = await request(
      'POST',
      '/staff/admins',
      {
        name: 'Regional Admin Lead',
        email: testAdminEmail,
        password: 'AdminSecurePassword123!',
        mobileNumber: '9988776655'
      },
      superAdminToken
    );
    assert(createAdminRes.status === 201, 'Admin staff created by Super Admin');

    // Admin Logs In
    const adminLoginRes = await request('POST', '/auth/login', {
      email: testAdminEmail,
      password: 'AdminSecurePassword123!'
    });
    assert(adminLoginRes.status === 200, 'Newly created Admin logs in successfully');
    const adminToken = adminLoginRes.body.data.accessToken;
    assert(adminLoginRes.body.data.user.role === 'ADMIN', 'Resolved role is ADMIN');

    // Admin Cannot Create Another Super Admin (Security Guard)
    console.log('\n--- 3. RBAC PRIVILEGE ESCALATION PREVENTION ---');
    const escalateRes = await request(
      'POST',
      '/staff/admins',
      {
        name: 'Unauthorized Escalation Admin',
        email: `escalate_${Date.now()}@mithaimahal.internal`,
        password: 'AdminSecurePassword123!'
      },
      adminToken
    );
    assert(escalateRes.status === 403, 'RBAC correctly denied Admin from creating staff (HTTP 403 Forbidden)');

    // 4. Public Customer Registration & Login
    console.log('\n--- 4. CUSTOMER REGISTRATION & LOGIN ---');
    const testCustomerEmail = `customer_test_${Date.now()}@example.com`;
    const custRegRes = await request('POST', '/customers/register', {
      firstName: 'Aarav',
      lastName: 'Mehta',
      email: testCustomerEmail,
      password: 'CustomerPassword123!',
      phone: '9876543210'
    });
    assert(custRegRes.status === 201, 'Customer registered via public endpoint');

    const custLoginRes = await request('POST', '/auth/login', {
      email: testCustomerEmail,
      password: 'CustomerPassword123!'
    });
    assert(custLoginRes.status === 200, 'Customer logged in successfully');
    assert(custLoginRes.body.data.user.role === 'CUSTOMER', 'Customer assigned CUSTOMER role');

    // 5. Public Seller Self-Registration (Starts PENDING)
    console.log('\n--- 5. PUBLIC SELLER REGISTRATION & STATE INITIALIZATION ---');
    const testSellerEmail = `seller_vendor_${Date.now()}@anandsweets.com`;
    const sellerRegRes = await request('POST', '/sellers/register', {
      businessName: 'Anand Heritage Sweets',
      legalName: 'Anand Heritage Sweets Private Limited',
      businessType: 'PVT_LTD',
      ownerName: 'Anand Rao',
      email: testSellerEmail,
      password: 'SellerPassword123!',
      phone: '9123456780',
      shopAddress: '42 Heritage Lane, Malleshwaram',
      city: 'Bengaluru',
      state: 'Karnataka',
      pincode: '560003',
      gstin: `29AAACA${Math.floor(1000 + Math.random() * 9000)}F1Z5`,
      fssaiNumber: '11223344556677'
    });
    assert(sellerRegRes.status === 201, 'Seller successfully self-registered');
    assert(sellerRegRes.body.data.verification_status === 'PENDING', 'Initial verification status is PENDING');
    assert(sellerRegRes.body.data.account_status === 'PENDING_APPROVAL', 'Initial account status is PENDING_APPROVAL');

    // Seller Login
    const sellerLoginRes = await request('POST', '/auth/login', {
      email: testSellerEmail,
      password: 'SellerPassword123!'
    });
    assert(sellerLoginRes.status === 200, 'Seller logs in successfully');
    const sellerToken = sellerLoginRes.body.data.accessToken;
    const sellerId = sellerLoginRes.body.data.user.id;

    // 6. Verification Enforcement: Pending Seller CANNOT publish products
    console.log('\n--- 6. VERIFICATION ENFORCEMENT ON CATALOG PUBLISHING ---');
    const publishAttemptRes = await request(
      'POST',
      '/products',
      {
        name: 'Mysore Pak Gold',
        price: 450.00,
        stockQuantity: 20,
        sku: 'MP-GOLD-500G'
      },
      sellerToken
    );
    assert(publishAttemptRes.status === 403, 'Publishing blocked for unapproved seller (HTTP 403 Forbidden)');

    // 7. Seller Uploads Verification Document
    console.log('\n--- 7. SELLER SECURE DOCUMENT UPLOAD ---');
    const multipart = buildMultipartFormData(
      {
        documentType: 'FSSAI_REGISTRATION',
        documentNumber: '11223344556677',
        expiryDate: '2028-12-31'
      },
      {
        name: 'file',
        filename: 'fssai_cert.pdf',
        contentType: 'application/pdf',
        buffer: Buffer.from('%PDF-1.4 Mock verification PDF data for automated testing')
      }
    );

    const docUploadRes = await request(
      'POST',
      '/sellers/documents',
      multipart.body,
      sellerToken,
      multipart.headers
    );
    assert(docUploadRes.status === 201, 'FSSAI document uploaded to secure private storage');

    // Verification status updates to UNDER_REVIEW
    const [sellerCheck1] = await pool.query('SELECT verification_status FROM sellers WHERE id = ?;', [sellerId]);
    assert(sellerCheck1[0].verification_status === 'UNDER_REVIEW', 'Seller status automatically moved to UNDER_REVIEW upon document upload');

    // 8. Admin Reviews and Rejects Seller (with Mandatory Reason)
    console.log('\n--- 8. ADMIN REJECTION WORKFLOW WITH AUDIT TRAIL ---');
    const rejectRes = await request(
      'PATCH',
      `/sellers/${sellerId}/review`,
      {
        status: 'REJECTED',
        rejectionReason: 'FSSAI registration certificate is blurry. Please upload clear scan.'
      },
      adminToken
    );
    assert(rejectRes.status === 200, 'Admin successfully rejected application with mandatory reason');

    const [sellerCheck2] = await pool.query('SELECT verification_status, rejection_reason FROM sellers WHERE id = ?;', [sellerId]);
    assert(sellerCheck2[0].verification_status === 'REJECTED', 'Seller verification status is REJECTED');
    assert(sellerCheck2[0].rejection_reason === 'FSSAI registration certificate is blurry. Please upload clear scan.', 'Rejection reason persisted');

    // 9. Seller Resubmits Application
    console.log('\n--- 9. SELLER RESUBMISSION WORKFLOW ---');
    const resubmitRes = await request(
      'POST',
      '/sellers/resubmit',
      { notes: 'Re-uploaded high resolution 300dpi certificate.' },
      sellerToken
    );
    assert(resubmitRes.status === 200, 'Seller successfully resubmitted corrected application');

    const [sellerCheck3] = await pool.query('SELECT verification_status, rejection_reason FROM sellers WHERE id = ?;', [sellerId]);
    assert(sellerCheck3[0].verification_status === 'UNDER_REVIEW', 'Seller status reset to UNDER_REVIEW');
    assert(sellerCheck3[0].rejection_reason === null, 'Rejection reason cleared upon resubmission');

    // 10. Admin Approves Seller
    console.log('\n--- 10. ADMIN APPROVAL & SELLER ACTIVATION ---');
    const approveRes = await request(
      'PATCH',
      `/sellers/${sellerId}/review`,
      {
        status: 'APPROVED',
        reviewNotes: 'Verified against state food safety registry.'
      },
      adminToken
    );
    assert(approveRes.status === 200, 'Admin approved seller verification');

    const [sellerCheck4] = await pool.query('SELECT verification_status, account_status FROM sellers WHERE id = ?;', [sellerId]);
    assert(sellerCheck4[0].verification_status === 'APPROVED', 'Seller verification status is APPROVED');
    assert(sellerCheck4[0].account_status === 'ACTIVE', 'Seller account status is ACTIVE');

    // 11. Approved Seller Publishes Sweet Product & Manages Inventory
    console.log('\n--- 11. APPROVED SELLER PRODUCT CATALOG & INVENTORY MANAGEMENT ---');
    const createProdRes = await request(
      'POST',
      '/products',
      {
        name: 'Heritage Mysore Pak',
        price: 360.00,
        stockQuantity: 30,
        sku: 'HMP-500G',
        weightPackSize: '500g Box',
        lowStockThreshold: 10,
        description: 'Authentic melt-in-mouth gram flour & ghee sweet.'
      },
      sellerToken
    );
    assert(createProdRes.status === 201, 'Approved seller successfully published product');
    const productId = createProdRes.body.data.id;
    assert(createProdRes.body.data.sku === 'HMP-500G', 'SKU correctly stored');
    assert(createProdRes.body.data.weight_pack_size === '500g Box', 'Weight pack size stored');

    // Stock Adjustment with Audit Trail
    console.log('\n--- 12. INVENTORY ADJUSTMENT & AUDIT LOGGING ---');
    const stockAdjRes = await request(
      'PATCH',
      `/products/${productId}/inventory`,
      {
        newQuantity: 50,
        reason: 'RESTOCK',
        notes: 'Morning fresh production batch #502'
      },
      sellerToken
    );
    assert(stockAdjRes.status === 200, 'Stock adjusted successfully');
    assert(stockAdjRes.body.data.newQuantity === 50, 'New authoritative stock is 50');
    assert(stockAdjRes.body.data.quantityChange === 20, 'Quantity change delta is +20');

    // Verify Audit Trail in DB
    const [auditRows] = await pool.query(
      'SELECT * FROM inventory_adjustments WHERE product_id = ? ORDER BY created_at DESC LIMIT 1;',
      [productId]
    );
    assert(auditRows.length > 0, 'Inventory adjustment record saved in database');
    assert(auditRows[0].reason === 'RESTOCK', 'Adjustment reason captured');
    assert(auditRows[0].notes === 'Morning fresh production batch #502', 'Audit notes captured');

    // 13. Tenant Isolation Check: Another seller cannot adjust this product
    console.log('\n--- 13. MULTI-TENANT ISOLATION CHECK ---');
    const [otherSellers] = await pool.query('SELECT id, email FROM sellers WHERE id != ? LIMIT 1;', [sellerId]);
    if (otherSellers.length > 0) {
      const otherSeller = otherSellers[0];
      const tokenService = require('../src/services/token.service');
      const otherToken = tokenService.generateAccessToken({
        userId: otherSeller.id,
        userType: 'SELLER',
        role: 'SELLER',
        sellerId: otherSeller.id
      });

      const crossTenantRes = await request(
        'PATCH',
        `/products/${productId}/inventory`,
        { newQuantity: 10, reason: 'MANUAL_CORRECTION' },
        otherToken
      );
      assert(crossTenantRes.status === 404 || crossTenantRes.status === 403, 'Cross-tenant inventory update safely blocked');
    }

  } catch (err) {
    console.error('Unexpected test failure:', err);
    failedCount++;
  } finally {
    if (server) {
      server.close();
    }
    console.log('\n================================================================');
    console.log(`TEST SUMMARY: ${passedCount} PASSED, ${failedCount} FAILED`);
    console.log('================================================================\n');
    process.exit(failedCount > 0 ? 1 : 0);
  }
}

runTests();
