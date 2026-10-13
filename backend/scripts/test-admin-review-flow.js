const { pool } = require('../src/config/db');
const tokenService = require('../src/services/token.service');
const rbacService = require('../src/services/rbac.service');
const sellerService = require('../src/services/seller.service');
const fs = require('fs');
const path = require('path');
const http = require('http');
const app = require('../src/server');

async function testAdminFlow() {
  const server = http.createServer(app);
  await new Promise(resolve => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    // 1. Get an active Admin user
    const [admins] = await pool.query("SELECT id, name, email FROM admins WHERE is_active = 1 LIMIT 1;");
    const adminUser = admins[0];
    console.log('Using Admin user:', adminUser.email);

    // Generate token for admin
    const adminToken = tokenService.generateAccessToken({
      userId: adminUser.id,
      userType: 'ADMIN',
      role: 'ADMIN'
    });

    // 2. Check an existing pending seller
    const [pendingSellers] = await pool.query("SELECT id, business_name FROM sellers WHERE verification_status = 'PENDING' LIMIT 1;");
    if (pendingSellers.length > 0) {
      const pendingSeller = pendingSellers[0];
      console.log('Testing review on pending seller with placeholder doc:', pendingSeller.business_name);

      // Attempt approve
      const approveRes = await fetch(`${baseUrl}/api/v1/sellers/${pendingSeller.id}/review`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${adminToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status: 'APPROVED' })
      });
      const approveBody = await approveRes.json();
      console.log('Approve attempt HTTP status:', approveRes.status);
      console.log('Approve attempt response body:', approveBody);
    }

    // 3. Create a test seller with valid uploaded document and test Admin approval
    const testEmail = `test.seller.${Date.now()}@mithaimahal.com`;
    const regRes = await fetch(`${baseUrl}/api/v1/sellers/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        businessName: 'Admin Flow Test Sweets',
        ownerName: 'Test Owner',
        email: testEmail,
        phone: '9876543210',
        password: 'Password123!',
        shopAddress: '123 Test Market',
        city: 'Bengaluru',
        state: 'Karnataka',
        pincode: '560001',
        gstin: '29ABCDE1234F1Z' + Math.floor(Math.random() * 9)
      })
    });
    const regData = await regRes.json();
    console.log('Register HTTP status:', regRes.status, regData);
    const newSellerId = regData.data?.id || regData.id;
    console.log('Registered new test seller:', newSellerId);

    // Get seller token
    const sellerToken = tokenService.generateAccessToken({
      userId: newSellerId,
      userType: 'SELLER',
      role: 'SELLER'
    });

    // Upload a genuine PDF document
    const boundary = '----WebKitFormBoundary' + Math.random().toString(16).slice(2);
    const pdfContent = Buffer.from('%PDF-1.4\n%Test valid PDF content\n%%EOF');
    const multipartBody = Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="documentType"\r\n\r\nFSSAI_REGISTRATION\r\n`),
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="documentNumber"\r\n\r\n12345678901234\r\n`),
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="test_fssai.pdf"\r\nContent-Type: application/pdf\r\n\r\n`),
      pdfContent,
      Buffer.from(`\r\n--${boundary}--\r\n`)
    ]);

    const uploadRes = await fetch(`${baseUrl}/api/v1/sellers/documents`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${sellerToken}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`
      },
      body: multipartBody
    });
    const uploadData = await uploadRes.json();
    console.log('Document uploaded HTTP status:', uploadRes.status);
    console.log('Uploaded doc id:', uploadData.data?.id);
    const docId = uploadData.data?.id;

    // Admin fetches documents for this seller
    const getDocsRes = await fetch(`${baseUrl}/api/v1/sellers/${newSellerId}/documents`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const docsData = await getDocsRes.json();
    console.log('Admin get documents HTTP status:', getDocsRes.status);
    console.log('Seller docs count:', docsData.data?.length);

    // Admin streams this document file
    const streamRes = await fetch(`${baseUrl}/api/v1/sellers/${newSellerId}/documents/${docId}/file`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    console.log('Admin stream document HTTP status:', streamRes.status);
    console.log('Content-Type:', streamRes.headers.get('content-type'));
    const streamBuf = await streamRes.arrayBuffer();
    console.log('Streamed bytes length:', streamBuf.byteLength);

    // Now Admin approves this seller with genuine document
    const adminApproveRes = await fetch(`${baseUrl}/api/v1/sellers/${newSellerId}/review`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ status: 'APPROVED' })
    });
    const adminApproveData = await adminApproveRes.json();
    console.log('Admin approve with valid doc HTTP status:', adminApproveRes.status);
    console.log('Admin approve result:', adminApproveData);

  } catch (err) {
    console.error('Test error:', err);
  } finally {
    server.close();
    await pool.end();
  }
}

testAdminFlow();
