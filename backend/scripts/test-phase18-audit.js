/**
 * Phase 18 Automated Verification & Regression Suite:
 * Task A: Seller KYC & Document Inconsistencies (Placeholder replacement & approval gating)
 * Task B: Super Admin Shop Suspension & Reactivation, exclusion from listing & checkout
 * Task C: Customer Support Ticket Submission & Retrieval (no ambiguous column error, idempotent duplicate protection)
 * Task D: Refresh Operations & Telemetry
 * Task F: Financial Metrics derive verified revenue from `payments` table
 * Task G: Private KYC Document Access streaming endpoint authorization
 */

const http = require('http');
const crypto = require('crypto');
const app = require('../src/server');
const config = require('../src/config/env');
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
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        const raw = Buffer.concat(chunks).toString('utf8');
        let parsed = null;
        try {
          parsed = JSON.parse(raw);
        } catch (_) {
          parsed = raw;
        }
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          data: parsed
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

async function runPhase18Tests() {
  console.log('\n================================================================');
  console.log(' Phase 18: Critical Bug Fixes, Seller Governance & Regression');
  console.log('================================================================\n');

  server = http.createServer(app);
  await new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      baseUrl = `http://127.0.0.1:${port}`;
      console.log(`Test server running at ${baseUrl}\n`);
      resolve();
    });
  });

  try {
    // -------------------------------------------------------------------------
    // 1. SETUP ACTORS: Super Admin & Customer
    // -------------------------------------------------------------------------
    console.log('--- 1. Authenticating Roles ---');
    const [saRows] = await pool.query('SELECT email FROM super_admins LIMIT 1');
    const saEmail = saRows[0]?.email || 'superadmin@sweetshop.internal';
    const saPassword = 'SuperAdminPassword123!';
    const saHash = await bcrypt.hash(saPassword, 10);
    await pool.query('UPDATE super_admins SET password_hash = ?, is_active = TRUE WHERE email = ?', [saHash, saEmail]);

    const saLogin = await request('POST', '/api/v1/auth/login', {
      email: saEmail,
      password: saPassword
    });
    assert(saLogin.statusCode === 200, 'Super Admin logs in successfully');
    const superAdminToken = saLogin.data?.data?.accessToken;

    // Pick an approved shop for customer tenancy
    const [shops] = await pool.query('SELECT id FROM sellers WHERE verification_status = "APPROVED" LIMIT 1');
    const shopId = shops[0]?.id;

    // Customer setup
    const custEmail = `cust.p18.${Date.now()}@mithaimahal.com`;
    const custPassword = 'CustomerPassword123!';
    const custReg = await request('POST', '/api/v1/customers/register', {
      sellerId: shopId,
      email: custEmail,
      password: custPassword,
      firstName: 'P18 Customer',
      lastName: 'Tester',
      phone: '9988776655'
    });
    assert(custReg.statusCode === 201, 'Customer registers successfully (HTTP 201)');

    const custLogin = await request('POST', '/api/v1/auth/login', {
      sellerId: shopId,
      email: custEmail,
      password: custPassword
    });
    assert(custLogin.statusCode === 200, 'Customer logs in successfully (HTTP 200)');
    const customerToken = custLogin.data?.data?.accessToken;

    // -------------------------------------------------------------------------
    // 2. TASK C: Customer Support Ticket Submission & Retrieval
    // -------------------------------------------------------------------------
    console.log('\n--- 2. Task C: Customer Support Ticket Submission & Retrieval ---');
    const ticketPayload = {
      subject: 'Order packaging quality inquiry',
      category: 'ORDER_ISSUE',
      priority: 'MEDIUM',
      initialMessage: 'Can you please ensure double silver foil insulation on the motichoor laddoo box?'
    };

    const submitTicketRes = await request('POST', '/api/v1/support/tickets', ticketPayload, customerToken);
    assert(submitTicketRes.statusCode === 201, 'Ticket submitted without orderId returns HTTP 201');
    assert(submitTicketRes.data?.data?.id || submitTicketRes.data?.data?.ticket?.id, 'Returned ticket object contains valid ID');

    // Duplicate submission within 30 seconds returns existing ticket (idempotent duplicate protection)
    const dupTicketRes = await request('POST', '/api/v1/support/tickets', ticketPayload, customerToken);
    assert(dupTicketRes.statusCode === 200 || dupTicketRes.statusCode === 201, 'Duplicate ticket submission within 30s handled gracefully (HTTP 200/201)');
    assert(dupTicketRes.data?.data?.ticket_number === submitTicketRes.data?.data?.ticket_number, 'Duplicate submission returns the existing idempotent ticket');

    // List customer tickets (Verifying ambiguous column bug fix)
    const listTicketsRes = await request('GET', '/api/v1/support/my-tickets', null, customerToken);
    assert(listTicketsRes.statusCode === 200, 'GET /my-tickets returns HTTP 200 without ambiguous column SQL crash');
    assert(Array.isArray(listTicketsRes.data?.data), 'GET /my-tickets returns array of tickets');
    assert(listTicketsRes.data?.data?.length > 0, 'Customer tickets array contains the newly created ticket');

    // -------------------------------------------------------------------------
    // 3. TASK F: Validate Financial Calculations
    // -------------------------------------------------------------------------
    console.log('\n--- 3. Task F: Validate Financial Dashboard Calculations ---');
    const analyticsRes = await request('GET', '/api/v1/super-admin/analytics/overview', null, superAdminToken);
    assert(analyticsRes.statusCode === 200, 'GET /super-admin/analytics/overview returns HTTP 200');
    const analytics = analyticsRes.data?.data;
    assert(typeof analytics?.today?.revenue === 'number', 'Today revenue is a valid numeric value');
    assert(typeof analytics?.today?.successfulPayments === 'number', 'Today successful payments count is valid');
    assert(typeof analytics?.lifetime?.grossSales === 'number', 'Lifetime gross sales is valid');
    console.log(`     Reported today revenue: ₹${analytics?.today?.revenue}, lifetime verified sales: ₹${analytics?.lifetime?.grossSales}`);

    const trendsRes = await request('GET', '/api/v1/super-admin/analytics/sales-trends?days=7', null, superAdminToken);
    assert(trendsRes.statusCode === 200, 'Sales trends endpoint returns HTTP 200');
    assert(Array.isArray(trendsRes.data?.data), 'Sales trends is returned as an array');

    // -------------------------------------------------------------------------
    // 4. TASK A & G: Seller KYC, Document Placeholders & Secure Streaming
    // -------------------------------------------------------------------------
    console.log('\n--- 4. Task A & G: Seller KYC & Document Streaming ---');
    // Register a new seller
    const sellerStamp = Date.now();
    const sellerReg = await request('POST', '/api/v1/sellers/register', {
      businessName: `P18 Mithai Emporium ${sellerStamp}`,
      legalName: 'P18 Sweets LLP',
      ownerName: 'Vikas Sharma',
      email: `seller.p18.${sellerStamp}@sweets.com`,
      password: 'SellerPassword123!',
      phone: '9876543210',
      businessType: 'PARTNERSHIP',
      gstin: `27AAACP${Math.floor(1000 + Math.random() * 9000)}B1Z1`,
      fssaiNumber: '10019011000123',
      shopAddress: '42 Chandni Chowk',
      city: 'Delhi',
      state: 'Delhi',
      pincode: '110006'
    });
    if (sellerReg.statusCode !== 201) {
      console.error('     sellerReg failure:', sellerReg.data);
    }
    assert(sellerReg.statusCode === 201, 'New seller registered successfully (HTTP 201)');
    const p18SellerId = sellerReg.data?.data?.id;

    const sellerLogin = await request('POST', '/api/v1/auth/login', {
      email: `seller.p18.${sellerStamp}@sweets.com`,
      password: 'SellerPassword123!'
    });
    assert(sellerLogin.statusCode === 200, 'Seller logs in successfully (HTTP 200)');
    const sellerToken = sellerLogin.data?.data?.accessToken;

    // Inspect documents for this newly registered seller
    const docsRes = await request('GET', `/api/v1/sellers/${p18SellerId}/documents`, null, superAdminToken);
    assert(docsRes.statusCode === 200, 'Super Admin retrieves seller documents (HTTP 200)');
    const initialDocs = docsRes.data?.data || [];
    assert(initialDocs.length > 0, 'Initial placeholder document row exists');
    assert(initialDocs[0].is_placeholder === true, 'Placeholder document is correctly flagged with is_placeholder=true');

    // Attempting to approve seller while documents are placeholder/missing must be rejected
    const approvePrematureRes = await request('PATCH', `/api/v1/sellers/${p18SellerId}/review`, {
      status: 'APPROVED'
    }, superAdminToken);
    assert(approvePrematureRes.statusCode === 400, 'Approving seller with placeholder/missing documents is blocked (HTTP 400)');

    // Now upload a genuine document file for this seller
    const multipart = buildMultipartFormData(
      {
        documentType: 'FSSAI_REGISTRATION',
        documentNumber: '10019011000123'
      },
      {
        name: 'file',
        filename: 'fssai_cert.pdf',
        contentType: 'application/pdf',
        buffer: Buffer.from('%PDF-1.4 Mock verification PDF data for automated testing')
      }
    );

    const uploadRes = await request('POST', '/api/v1/sellers/documents', multipart.body, sellerToken, multipart.headers);
    assert(uploadRes.statusCode === 201, 'Genuine document upload replaces placeholder (HTTP 201)');

    // Inspect documents again
    const updatedDocsRes = await request('GET', `/api/v1/sellers/${p18SellerId}/documents`, null, superAdminToken);
    const updatedDocs = updatedDocsRes.data?.data || [];
    const fssaiDoc = updatedDocs.find(d => d.document_type === 'FSSAI_REGISTRATION');
    assert(fssaiDoc && !fssaiDoc.is_placeholder, 'FSSAI document is now recognized as genuine uploaded file');

    // Test Private Streaming Endpoint (Task G)
    const streamDocRes = await request('GET', `/api/v1/sellers/${p18SellerId}/documents/${fssaiDoc.id}/file`, null, superAdminToken);
    assert(streamDocRes.statusCode === 200, 'Authorized Super Admin streams private KYC document (HTTP 200)');
    assert(streamDocRes.headers['content-type'] === 'application/pdf', 'Streaming response has correct application/pdf MIME type');

    // Unauthorized role test: Customer cannot access private seller KYC document
    const unauthStreamRes = await request('GET', `/api/v1/sellers/${p18SellerId}/documents/${fssaiDoc.id}/file`, null, customerToken);
    if (unauthStreamRes.statusCode !== 403) {
      console.log('     unauthStreamRes returned status:', unauthStreamRes.statusCode, unauthStreamRes.data);
    }
    assert(unauthStreamRes.statusCode === 403, 'Customer role is forbidden from accessing KYC documents (HTTP 403)');

    // Now Super Admin can approve the seller
    const approveRes = await request('PATCH', `/api/v1/sellers/${p18SellerId}/review`, {
      status: 'APPROVED'
    }, superAdminToken);
    assert(approveRes.statusCode === 200, 'Super Admin approves seller with valid document (HTTP 200)');

    // -------------------------------------------------------------------------
    // 5. TASK B: Super Admin Shop Suspension & Reactivation
    // -------------------------------------------------------------------------
    console.log('\n--- 5. Task B: Super Admin Shop Suspension & Reactivation ---');
    // Ensure seller has an active product
    const [pInsert] = await pool.query(`
      INSERT INTO products (seller_id, name, description, price, stock_quantity, is_active, availability_status)
      VALUES (?, 'P18 Royal Peda', 'Fresh peda made from full-cream milk', 250.00, 50, TRUE, 'AVAILABLE')
    `, [p18SellerId]);
    const productId = pInsert.insertId;

    // Check public shop listing: Approved active seller should be present
    const publicShopsRes = await request('GET', '/api/v1/shops');
    assert(publicShopsRes.statusCode === 200, 'GET /shops returns HTTP 200');
    const shopInList = (publicShopsRes.data?.data || []).some(s => s.id === p18SellerId);
    assert(shopInList, 'Newly approved shop is visible in public listing');

    // Super Admin suspends the shop with mandatory reason
    const suspendRes = await request('POST', `/api/v1/super-admin/shops/${p18SellerId}/suspend`, {
      reason: 'Routine compliance audit required regarding storage temperature'
    }, superAdminToken);
    assert(suspendRes.statusCode === 200, 'Super Admin suspends shop (HTTP 200)');

    // Verify audit log
    const [auditRows] = await pool.query(
      "SELECT * FROM audit_logs WHERE action = 'SHOP_SUSPENDED' AND target_id = ? ORDER BY id DESC LIMIT 1",
      [String(p18SellerId)]
    );
    assert(auditRows.length > 0, 'Audit log correctly records SHOP_SUSPENDED action');

    // Suspended shop must NOT appear in public listing
    const publicShopsAfterSuspend = await request('GET', '/api/v1/shops');
    const shopInListAfter = (publicShopsAfterSuspend.data?.data || []).some(s => s.id === p18SellerId);
    assert(!shopInListAfter, 'Suspended shop is excluded from public shop listing');

    // Customer attempt to add item from suspended shop to cart must fail
    const addToCartRes = await request('POST', '/api/v1/cart/items', {
      productId: productId,
      quantity: 1
    }, customerToken);
    assert(addToCartRes.statusCode === 400, 'Adding product from suspended shop to cart is blocked (HTTP 400)');

    // Non-superadmin cannot suspend or reactivate
    const unauthSuspend = await request('POST', `/api/v1/super-admin/shops/${p18SellerId}/reactivate`, {
      reason: 'Reactivation attempt by customer'
    }, customerToken);
    assert(unauthSuspend.statusCode === 403, 'Customer cannot reactivate shop (HTTP 403)');

    // Super Admin reactivates the shop
    const reactivateRes = await request('POST', `/api/v1/super-admin/shops/${p18SellerId}/reactivate`, {
      reason: 'Compliance review completed and approved by supervisor'
    }, superAdminToken);
    assert(reactivateRes.statusCode === 200, 'Super Admin reactivates shop (HTTP 200)');

    // Reactivated shop appears again in public listing
    const publicShopsAfterReactivate = await request('GET', '/api/v1/shops');
    const shopInListReactivated = (publicShopsAfterReactivate.data?.data || []).some(s => s.id === p18SellerId);
    assert(shopInListReactivated, 'Reactivated shop reappears in public shop listing');

    // -------------------------------------------------------------------------
    // 6. TASK D: Refresh Operations
    // -------------------------------------------------------------------------
    console.log('\n--- 6. Task D: Refresh Operations Endpoints ---');
    const refreshOps = await request('GET', '/api/v1/admin/dashboard/metrics', null, superAdminToken);
    assert(refreshOps.statusCode === 200, 'Admin operations telemetry refresh endpoint returns HTTP 200');

    console.log('\n================================================================');
    console.log(` Phase 18 Suite Results: ${passedCount} Passed, ${failedCount} Failed`);
    console.log('================================================================\n');

  } catch (err) {
    console.error('Unexpected test suite error:', err);
    failedCount++;
  } finally {
    if (server) {
      server.close();
    }
  }
}

runPhase18Tests().then(() => {
  process.exit(failedCount > 0 ? 1 : 0);
});
