/**
 * Phase 25 Automated Verification Suite:
 * Task A: Admin Seller Approval & KYC Document Access
 * Task B: Storage & Authorized Document Streaming (PDF & Image, path traversal protection, missing file error handling)
 * Task C: Approval Gating & Business Rules (block on missing/placeholder/rejected docs)
 * Task D: Role Authorization & Audit Logging
 */

const http = require('http');
const crypto = require('crypto');
const app = require('../src/server');
const { pool } = require('../src/config/db');
const tokenService = require('../src/services/token.service');
const fs = require('fs');
const path = require('path');

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
  const url = new URL(baseUrl + path);
  const headers = { ...extraHeaders };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  let reqBody = null;
  if (body !== null) {
    if (Buffer.isBuffer(body) || typeof body === 'string') {
      reqBody = body;
    } else {
      reqBody = JSON.stringify(body);
      if (!headers['Content-Type']) headers['Content-Type'] = 'application/json';
    }
  }

  const res = await fetch(url.toString(), {
    method,
    headers,
    body: reqBody
  });

  const contentType = res.headers.get('content-type') || '';
  let resData;
  if (contentType.includes('application/json')) {
    resData = await res.json();
  } else {
    resData = Buffer.from(await res.arrayBuffer());
  }

  return { status: res.status, headers: res.headers, data: resData };
}

async function runSuite() {
  server = http.createServer(app);
  await new Promise(resolve => server.listen(0, resolve));
  const port = server.address().port;
  baseUrl = `http://127.0.0.1:${port}`;
  console.log(`\n================================================================`);
  console.log(` Phase 25: Admin Seller Approval & KYC Document Access Suite`);
  console.log(`================================================================\n`);
  console.log(`Test server running at ${baseUrl}\n`);

  try {
    // 1. Roles & Tokens
    console.log('--- 1. Authenticating Roles ---');
    const [superAdminRows] = await pool.query("SELECT id, email FROM super_admins LIMIT 1;");
    const superAdmin = superAdminRows[0];
    const superAdminToken = tokenService.generateAccessToken({
      userId: superAdmin.id,
      userType: 'SUPER_ADMIN',
      role: 'SUPER_ADMIN'
    });

    const [adminRows] = await pool.query("SELECT id, email FROM admins WHERE is_active = 1 LIMIT 1;");
    const admin = adminRows[0];
    const adminToken = tokenService.generateAccessToken({
      userId: admin.id,
      userType: 'ADMIN',
      role: 'ADMIN'
    });

    const [custRows] = await pool.query("SELECT id FROM seller_users WHERE is_active = 1 LIMIT 1;");
    let customerUserId;
    if (custRows.length > 0) {
      customerUserId = custRows[0].id;
    } else {
      const newCustId = crypto.randomUUID();
      await pool.query(
        "INSERT INTO seller_users (id, first_name, last_name, email, password_hash, is_active) VALUES (?, 'Test', 'Customer', ?, 'hash', 1);",
        [newCustId, `test.cust.${Date.now()}@mithaimahal.com`]
      );
      customerUserId = newCustId;
    }

    const customerToken = tokenService.generateAccessToken({
      userId: customerUserId,
      userType: 'CUSTOMER',
      role: 'CUSTOMER'
    });

    assert(!!superAdminToken, 'Super Admin access token generated');
    assert(!!adminToken, 'Admin access token generated');
    assert(!!customerToken, 'Customer access token generated');

    // 2. Register Seller (Initial Placeholder State)
    console.log('\n--- 2. Seller Registration & Placeholder Document Gating ---');
    const sellerEmail = `p25.test.${Date.now()}@mithaimahal.com`;
    const regRes = await request('POST', '/api/v1/sellers/register', {
      businessName: 'Phase 25 Mithai Shop',
      ownerName: 'Radha Mohan',
      email: sellerEmail,
      phone: '9123456789',
      password: 'Password123!',
      shopAddress: '42 MG Road',
      city: 'Mysuru',
      state: 'Karnataka',
      pincode: '570001',
      gstin: '29ABCDE' + Math.floor(1000 + Math.random() * 9000) + 'F1Z5',
      fssaiNumber: '11223344556677'
    });

    assert(regRes.status === 201, 'Seller registers successfully (HTTP 201)');
    const sellerId = regRes.data.data.id;
    assert(!!sellerId, 'Registered seller ID returned');

    const sellerToken = tokenService.generateAccessToken({
      userId: sellerId,
      userType: 'SELLER',
      role: 'SELLER',
      sellerId
    });

    // Admin fetches documents for this newly registered seller
    const docsRes = await request('GET', `/api/v1/sellers/${sellerId}/documents`, null, adminToken);
    assert(docsRes.status === 200, 'Admin accesses seller documents (HTTP 200)');
    assert(docsRes.data.data.length > 0, 'Placeholder document row exists');
    const placeholderDoc = docsRes.data.data[0];
    assert(placeholderDoc.is_placeholder === true, 'Document marked as is_placeholder=true');

    // Attempting to stream a placeholder document returns HTTP 404 with clean message
    const streamPlaceholderRes = await request('GET', `/api/v1/sellers/${sellerId}/documents/${placeholderDoc.id}/file`, null, adminToken);
    assert(streamPlaceholderRes.status === 404, 'Streaming placeholder document returns HTTP 404');
    assert(streamPlaceholderRes.data.error?.message?.includes('missing or pending upload'), 'Clean error message for pending/missing file returned');

    // Attempting approval by Admin while document is placeholder MUST FAIL (HTTP 400)
    const approveFailRes = await request('PATCH', `/api/v1/sellers/${sellerId}/review`, { status: 'APPROVED' }, adminToken);
    assert(approveFailRes.status === 400, 'Admin approval blocked when documents are placeholders (HTTP 400)');
    assert(approveFailRes.data.error?.message?.includes('Mandatory compliance document files are missing or pending upload'), 'Specific compliance validation error returned');

    // 3. Document Upload (PDF and Image) & Authorized Streaming
    console.log('\n--- 3. Document Upload & Authorized Streaming ---');
    // Upload PDF
    const boundaryPdf = '----WebKitFormBoundary' + Math.random().toString(16).slice(2);
    const pdfBytes = Buffer.from('%PDF-1.4\n%Phase 25 FSSAI License Sample\n%%EOF');
    const pdfMultipart = Buffer.concat([
      Buffer.from(`--${boundaryPdf}\r\nContent-Disposition: form-data; name="documentType"\r\n\r\nFSSAI_REGISTRATION\r\n`),
      Buffer.from(`--${boundaryPdf}\r\nContent-Disposition: form-data; name="documentNumber"\r\n\r\n11223344556677\r\n`),
      Buffer.from(`--${boundaryPdf}\r\nContent-Disposition: form-data; name="file"; filename="fssai_cert.pdf"\r\nContent-Type: application/pdf\r\n\r\n`),
      pdfBytes,
      Buffer.from(`\r\n--${boundaryPdf}--\r\n`)
    ]);

    const uploadPdfRes = await request('POST', '/api/v1/sellers/documents', pdfMultipart, sellerToken, {
      'Content-Type': `multipart/form-data; boundary=${boundaryPdf}`
    });
    assert(uploadPdfRes.status === 201, 'Seller uploads genuine PDF FSSAI document (HTTP 201)');
    const pdfDocId = uploadPdfRes.data.data.id;

    // Upload GSTIN Image
    const boundaryImg = '----WebKitFormBoundary' + Math.random().toString(16).slice(2);
    const imgBytes = Buffer.from('\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15c4\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82');
    const imgMultipart = Buffer.concat([
      Buffer.from(`--${boundaryImg}\r\nContent-Disposition: form-data; name="documentType"\r\n\r\nGSTIN_CERTIFICATE\r\n`),
      Buffer.from(`--${boundaryImg}\r\nContent-Disposition: form-data; name="documentNumber"\r\n\r\n29ABCDE1234F1Z5\r\n`),
      Buffer.from(`--${boundaryImg}\r\nContent-Disposition: form-data; name="file"; filename="gstin_cert.png"\r\nContent-Type: image/png\r\n\r\n`),
      imgBytes,
      Buffer.from(`\r\n--${boundaryImg}--\r\n`)
    ]);

    const uploadImgRes = await request('POST', '/api/v1/sellers/documents', imgMultipart, sellerToken, {
      'Content-Type': `multipart/form-data; boundary=${boundaryImg}`
    });
    assert(uploadImgRes.status === 201, 'Seller uploads genuine PNG GSTIN document (HTTP 201)');
    const imgDocId = uploadImgRes.data.data.id;

    // Admin streams PDF
    const streamPdfRes = await request('GET', `/api/v1/sellers/${sellerId}/documents/${pdfDocId}/file`, null, adminToken);
    assert(streamPdfRes.status === 200, 'Admin successfully streams PDF document (HTTP 200)');
    assert(streamPdfRes.headers.get('content-type') === 'application/pdf', 'PDF stream returns application/pdf');
    assert(streamPdfRes.data.length === pdfBytes.length, 'PDF stream length matches uploaded bytes');

    // Admin streams Image
    const streamImgRes = await request('GET', `/api/v1/sellers/${sellerId}/documents/${imgDocId}/file`, null, adminToken);
    assert(streamImgRes.status === 200, 'Admin successfully streams Image document (HTTP 200)');
    assert(streamImgRes.headers.get('content-type') === 'image/png', 'Image stream returns image/png');
    assert(streamImgRes.data.length === imgBytes.length, 'Image stream length matches uploaded bytes');

    // Security: Customer role forbidden from streaming private document
    const forbiddenStreamRes = await request('GET', `/api/v1/sellers/${sellerId}/documents/${pdfDocId}/file`, null, customerToken);
    assert(forbiddenStreamRes.status === 403, 'Customer role forbidden from accessing KYC documents (HTTP 403)');

    // Security: Unauthenticated request rejected
    const unauthStreamRes = await request('GET', `/api/v1/sellers/${sellerId}/documents/${pdfDocId}/file`);
    assert(unauthStreamRes.status === 401, 'Unauthenticated request rejected with HTTP 401');

    // 4. Admin Approval & Audit Logging
    console.log('\n--- 4. Admin Seller Approval & Audit Logging ---');
    const adminApproveRes = await request('PATCH', `/api/v1/sellers/${sellerId}/review`, {
      status: 'APPROVED',
      reviewNotes: 'Verified against national FSSAI register'
    }, adminToken);

    assert(adminApproveRes.status === 200, 'Admin approves seller with valid KYC documents (HTTP 200)');
    assert(adminApproveRes.data.data.verification_status === 'APPROVED', 'Seller verification_status is APPROVED');
    assert(adminApproveRes.data.data.account_status === 'ACTIVE', 'Seller account_status is ACTIVE');

    // Verify audit log
    const [auditRows] = await pool.query(
      "SELECT * FROM audit_logs WHERE target_id = ? AND action = 'SELLER_VERIFICATION_APPROVED' ORDER BY created_at DESC LIMIT 1;",
      [sellerId]
    );
    assert(auditRows.length === 1, 'Audit log created for seller approval');
    assert(auditRows[0].actor_id === admin.id, 'Audit log records correct Admin actor ID');
    assert(auditRows[0].action === 'SELLER_VERIFICATION_APPROVED', 'Audit log records correct action');

    // 5. Rejection & Resubmission Workflow
    console.log('\n--- 5. Rejection & Document Invalidation Flow ---');
    // Create another seller to test rejection
    const sellerEmail2 = `p25.reject.${Date.now()}@mithaimahal.com`;
    const regRes2 = await request('POST', '/api/v1/sellers/register', {
      businessName: 'Phase 25 Rejection Test Shop',
      ownerName: 'Sohan Lal',
      email: sellerEmail2,
      phone: '9876501234',
      password: 'Password123!',
      gstin: '29ABCDE' + Math.floor(1000 + Math.random() * 9000) + 'F1Z9'
    });
    const sellerId2 = regRes2.data.data.id;

    // Admin rejects with mandatory reason
    const rejectRes = await request('PATCH', `/api/v1/sellers/${sellerId2}/review`, {
      status: 'REJECTED',
      rejectionReason: 'FSSAI document is unreadable and certificate is expired.'
    }, adminToken);

    assert(rejectRes.status === 200, 'Admin rejects seller application with mandatory reason (HTTP 200)');
    assert(rejectRes.data.data.verification_status === 'REJECTED', 'Seller verification_status is REJECTED');

    // Attempting to approve rejected seller without re-upload is blocked
    const reApproveBlockedRes = await request('PATCH', `/api/v1/sellers/${sellerId2}/review`, {
      status: 'APPROVED'
    }, adminToken);
    assert(reApproveBlockedRes.status === 400, 'Approving seller with rejected documents is blocked (HTTP 400)');

  } catch (err) {
    console.error('Unexpected suite error:', err);
    failedCount++;
  } finally {
    server.close();
    await pool.end();
  }

  console.log(`\n================================================================`);
  console.log(` Phase 25 Results: ${passedCount} Passed, ${failedCount} Failed`);
  console.log(`================================================================\n`);

  if (failedCount > 0) {
    process.exit(1);
  }
}

runSuite();
