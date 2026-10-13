/**
 * Seller Verification & Document Management Service
 * 
 * Supports:
 * - Public seller registration (starts PENDING)
 * - Secure document upload & metadata tracking (outside public static directories)
 * - Review & approve/reject workflow (Admin/Super Admin)
 * - Seller application correction and resubmission
 * - Secure private document streaming
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const { pool } = require('../config/db');
const { AppError, NotFoundError, ForbiddenError, ValidationError } = require('../middleware/errorHandler');
const auditService = require('./audit.service');

const BCRYPT_ROUNDS = 12;

// Secure private directory for verification documents (never exposed statically)
const PRIVATE_DOCS_DIR = path.resolve(__dirname, '../../private_uploads/seller_documents');
if (!fs.existsSync(PRIVATE_DOCS_DIR)) {
  fs.mkdirSync(PRIVATE_DOCS_DIR, { recursive: true });
}

/**
 * Safely resolve document file path with fallback and traversal protection
 */
function resolveDocumentPath(filePath) {
  if (!filePath || filePath === 'PENDING_UPLOAD') return null;

  // 1. Direct path check
  if (fs.existsSync(filePath)) {
    return path.resolve(filePath);
  }

  // 2. Basename inside PRIVATE_DOCS_DIR
  const baseName = path.basename(filePath);
  const fallbackInPrivate = path.join(PRIVATE_DOCS_DIR, baseName);
  if (fs.existsSync(fallbackInPrivate)) {
    return path.resolve(fallbackInPrivate);
  }

  // 3. Relative to backend root
  const rootRelative = path.resolve(__dirname, '../../', filePath);
  if (fs.existsSync(rootRelative)) {
    return path.resolve(rootRelative);
  }

  return null;
}

/**
 * Public Seller Self-Registration
 */
async function registerSeller(data) {
  const {
    ownerName,
    businessName,
    legalName,
    businessType = 'PROPRIETORSHIP',
    email,
    phone,
    password,
    shopAddress,
    city,
    state,
    pincode,
    gstin = null,
    fssaiNumber = null,
    fssaiType = 'REGISTRATION'
  } = data;

  const normalizedEmail = email.trim().toLowerCase();
  const normalizedGstin = gstin && gstin.trim() ? gstin.trim().toUpperCase() : null;

  // Check email uniqueness across sellers
  const [existingEmail] = await pool.query('SELECT id FROM sellers WHERE email = ? LIMIT 1;', [normalizedEmail]);
  if (existingEmail.length > 0) {
    throw new AppError('A sweet shop seller with this email already exists.', 409, 'CONFLICT');
  }

  if (normalizedGstin) {
    const [existingGst] = await pool.query('SELECT id FROM sellers WHERE gstin = ? LIMIT 1;', [normalizedGstin]);
    if (existingGst.length > 0) {
      throw new AppError('A sweet shop seller with this GSTIN already exists.', 409, 'CONFLICT');
    }
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const sellerId = crypto.randomUUID();

  // Public signup is marked PENDING / PENDING_APPROVAL
  await pool.query(
    `INSERT INTO sellers (
      id, owner_name, business_name, legal_name, business_type, email, phone,
      shop_address, city, state, pincode, gstin, password_hash,
      account_status, verification_status, is_active
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?,
      'PENDING_APPROVAL', 'PENDING', TRUE
    );`,
    [
      sellerId,
      ownerName ? ownerName.trim() : null,
      businessName.trim(),
      legalName ? legalName.trim() : businessName.trim(),
      businessType,
      normalizedEmail,
      phone.trim(),
      shopAddress ? shopAddress.trim() : null,
      city ? city.trim() : null,
      state ? state.trim() : null,
      pincode ? pincode.trim() : null,
      normalizedGstin,
      passwordHash
    ]
  );

  // Seed mandatory FSSAI compliance placeholder for every newly registered sweet shop
  await pool.query(
    `INSERT INTO seller_documents (
      id, seller_id, document_type, document_number, file_path, file_name, file_size, mime_type, verification_status
    ) VALUES (
      UUID(), ?, 'FSSAI_REGISTRATION', ?, 'PENDING_UPLOAD', 'Pending Document File', 0, 'application/pdf', 'PENDING'
    );`,
    [sellerId, fssaiNumber ? fssaiNumber.trim() : null]
  );

  const [created] = await pool.query(
    `SELECT id, owner_name, business_name, legal_name, business_type, email, phone, 
            shop_address, city, state, pincode, gstin, account_status, verification_status, created_at 
     FROM sellers WHERE id = ?;`,
    [sellerId]
  );

  return created[0];
}

/**
 * Upload a verification document (Stored safely outside public directory)
 */
async function uploadVerificationDocument(sellerId, {
  documentType,
  documentNumber = null,
  expiryDate = null,
  file
}) {
  if (!file) {
    throw new ValidationError('Document file is required for upload.');
  }

  // Validate MIME type
  const allowedMimes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
  if (!allowedMimes.includes(file.mimetype)) {
    throw new ValidationError('Invalid document file type. Supported types: PDF, JPEG, PNG, WEBP.');
  }

  // Max 5MB
  if (file.size > 5 * 1024 * 1024) {
    throw new ValidationError('Document file size exceeds 5MB limit.');
  }

  // Generate safe filename and write to private storage
  const ext = path.extname(file.originalname) || '.pdf';
  const safeFilename = `doc_${sellerId}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}${ext}`;
  const targetPath = path.join(PRIVATE_DOCS_DIR, safeFilename);

  fs.writeFileSync(targetPath, file.buffer);

  // Check if a placeholder row exists for this document type that needs actual file attachment
  const [existingPlaceholders] = await pool.query(
    `SELECT id FROM seller_documents 
     WHERE seller_id = ? AND document_type = ? AND file_path = 'PENDING_UPLOAD' 
     ORDER BY created_at ASC LIMIT 1;`,
    [sellerId, documentType]
  );

  let docId;

  if (existingPlaceholders.length > 0) {
    docId = existingPlaceholders[0].id;
    await pool.query(
      `UPDATE seller_documents 
       SET document_number = COALESCE(?, document_number),
           file_path = ?,
           file_name = ?,
           file_size = ?,
           mime_type = ?,
           expiry_date = ?,
           verification_status = 'UNDER_REVIEW',
           rejection_reason = NULL,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?;`,
      [
        documentNumber ? documentNumber.trim() : null,
        targetPath,
        file.originalname,
        file.size,
        file.mimetype,
        expiryDate || null,
        docId
      ]
    );
  } else {
    docId = crypto.randomUUID();
    await pool.query(
      `INSERT INTO seller_documents (
        id, seller_id, document_type, document_number, file_path, file_name, file_size, mime_type, expiry_date, verification_status
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?, 'UNDER_REVIEW'
      );`,
      [
        docId,
        sellerId,
        documentType,
        documentNumber ? documentNumber.trim() : null,
        targetPath,
        file.originalname,
        file.size,
        file.mimetype,
        expiryDate || null
      ]
    );
  }

  // Update seller verification status to UNDER_REVIEW
  await pool.query(
    `UPDATE sellers 
     SET verification_status = 'UNDER_REVIEW', rejection_reason = NULL, updated_at = CURRENT_TIMESTAMP 
     WHERE id = ? AND verification_status IN ('PENDING', 'REJECTED');`,
    [sellerId]
  );

  const [createdDoc] = await pool.query('SELECT * FROM seller_documents WHERE id = ?;', [docId]);
  return createdDoc[0];
}

/**
 * List documents for a seller with explicit placeholder and file availability indicators
 */
async function getSellerDocuments(sellerId) {
  const [docs] = await pool.query(
    `SELECT id, seller_id, document_type, document_number, file_name, file_size, mime_type, 
            expiry_date, verification_status, rejection_reason, reviewed_at, created_at, file_path
     FROM seller_documents 
     WHERE seller_id = ? 
     ORDER BY created_at DESC;`,
    [sellerId]
  );

  return docs.map(d => {
    const resolvedPath = resolveDocumentPath(d.file_path);
    const isFileMissing = !resolvedPath || !fs.existsSync(resolvedPath) || d.file_path === 'PENDING_UPLOAD' || d.file_size === 0;
    // Never display APPROVED for a document whose file is missing
    let effectiveStatus = d.verification_status;
    if (isFileMissing && effectiveStatus === 'APPROVED') {
      effectiveStatus = 'PENDING';
    }
    return {
      id: d.id,
      seller_id: d.seller_id,
      document_type: d.document_type,
      document_number: d.document_number,
      file_name: d.file_name,
      file_size: d.file_size,
      mime_type: d.mime_type,
      expiry_date: d.expiry_date,
      verification_status: effectiveStatus,
      rejection_reason: d.rejection_reason,
      reviewed_at: d.reviewed_at,
      created_at: d.created_at,
      is_placeholder: isFileMissing,
      has_file: !isFileMissing,
      file_path: resolvedPath || d.file_path
    };
  });
}

/**
 * Fetch private document record for authorized streaming
 */
async function getDocumentForStream(sellerId, documentId) {
  const [rows] = await pool.query(
    'SELECT * FROM seller_documents WHERE id = ? AND seller_id = ? LIMIT 1;',
    [documentId, sellerId]
  );
  if (rows.length === 0) return null;
  const d = rows[0];
  const resolvedPath = resolveDocumentPath(d.file_path);
  const isMissing = !resolvedPath || !fs.existsSync(resolvedPath) || d.file_path === 'PENDING_UPLOAD' || d.file_size === 0;

  return {
    id: d.id,
    sellerId: d.seller_id,
    documentType: d.document_type,
    fileName: d.file_name,
    filePath: resolvedPath || d.file_path,
    fileSize: d.file_size,
    mimeType: d.mime_type,
    isPlaceholder: isMissing,
    hasFile: !isMissing
  };
}

/**
 * Review seller verification (Admin/Super Admin only)
 * Enforces document consistency: Cannot approve a seller while mandatory documents are missing or rejected.
 */
async function reviewSellerVerification(sellerId, reviewerId, {
  status, // 'APPROVED' or 'REJECTED'
  rejectionReason = null,
  reviewNotes = null,
  reviewer = null
}) {
  if (!['APPROVED', 'REJECTED'].includes(status)) {
    throw new ValidationError('Invalid review status. Must be APPROVED or REJECTED.');
  }

  if (status === 'REJECTED' && (!rejectionReason || !rejectionReason.trim())) {
    throw new ValidationError('A detailed rejection reason is required when rejecting a seller application.');
  }

  const [sellerRows] = await pool.query('SELECT * FROM sellers WHERE id = ? LIMIT 1;', [sellerId]);
  if (sellerRows.length === 0) {
    throw new NotFoundError('Seller account not found.');
  }
  const currentSeller = sellerRows[0];

  // 1. Fetch current document statuses
  const [docs] = await pool.query(
    `SELECT id, document_type, file_path, file_size, verification_status 
     FROM seller_documents 
     WHERE seller_id = ?;`,
    [sellerId]
  );

  if (status === 'APPROVED') {
    // Rule A: Mandatory compliance documents check
    if (docs.length === 0) {
      throw new ValidationError(
        'Cannot approve seller: No compliance documents have been submitted for this account.'
      );
    }

    // Rule B: Cannot approve seller if any compliance document is in REJECTED state
    const hasRejectedDocs = docs.some(d => d.verification_status === 'REJECTED');
    if (hasRejectedDocs) {
      throw new ValidationError(
        'Cannot approve seller: One or more compliance documents are currently REJECTED. The seller must re-upload valid documents before approval.'
      );
    }

    // Rule C: Cannot approve if any placeholder records exist or actual file is missing on disk
    const docsWithFiles = docs.map(d => {
      const resolved = resolveDocumentPath(d.file_path);
      const exists = resolved && fs.existsSync(resolved) && d.file_path !== 'PENDING_UPLOAD' && d.file_size > 0;
      return { ...d, exists, resolved };
    });

    const missingOrPlaceholder = docsWithFiles.filter(d => !d.exists);
    if (missingOrPlaceholder.length > 0) {
      const missingTypes = missingOrPlaceholder.map(d => d.document_type.replace(/_/g, ' ')).join(', ');
      throw new ValidationError(
        `Cannot approve seller: Mandatory compliance document files are missing or pending upload (${missingTypes}).`
      );
    }

    // Update all genuine documents for this seller to APPROVED
    await pool.query(
      `UPDATE seller_documents 
       SET verification_status = 'APPROVED',
           rejection_reason = NULL,
           reviewed_by = ?,
           reviewed_at = CURRENT_TIMESTAMP 
       WHERE seller_id = ? AND file_path != 'PENDING_UPLOAD';`,
      [reviewerId, sellerId]
    );
  }

  const accountStatus = status === 'APPROVED' ? 'ACTIVE' : 'PENDING_APPROVAL';

  await pool.query(
    `UPDATE sellers 
     SET verification_status = ?, 
         account_status = ?, 
         rejection_reason = ?,
         updated_at = CURRENT_TIMESTAMP 
     WHERE id = ?;`,
    [status, accountStatus, status === 'REJECTED' ? rejectionReason.trim() : null, sellerId]
  );

  if (status === 'REJECTED') {
    // Mark pending/under-review documents as REJECTED with rejection reason
    await pool.query(
      `UPDATE seller_documents 
       SET verification_status = 'REJECTED',
           rejection_reason = ?,
           reviewed_by = ?,
           reviewed_at = CURRENT_TIMESTAMP 
       WHERE seller_id = ?;`,
      [rejectionReason.trim(), reviewerId, sellerId]
    );
  }

  // Audit Logging
  try {
    const actorRole = reviewer?.role || reviewer?.userType || 'ADMIN';
    const actorName = reviewer?.name || reviewer?.email || 'Operations Admin';
    await auditService.logAction({
      actorId: reviewerId,
      actorType: actorRole,
      actorName: actorName,
      action: status === 'APPROVED' ? 'SELLER_VERIFICATION_APPROVED' : 'SELLER_VERIFICATION_REJECTED',
      targetId: sellerId,
      targetType: 'SELLER',
      details: {
        businessName: currentSeller.business_name,
        previousStatus: currentSeller.verification_status,
        newStatus: status,
        reviewNotes: reviewNotes || null
      },
      reason: status === 'REJECTED' ? rejectionReason.trim() : (reviewNotes || 'Verification approved by staff')
    });
  } catch (auditErr) {
    console.warn('[AUDIT LOG WARNING]:', auditErr.message);
  }

  const [updatedSeller] = await pool.query(
    `SELECT id, business_name, email, phone, account_status, verification_status, rejection_reason, updated_at 
     FROM sellers WHERE id = ?;`,
    [sellerId]
  );

  return updatedSeller[0];
}

/**
 * Resubmit rejected seller verification
 */
async function resubmitSellerVerification(sellerId, { notes = null }) {
  const [sellerRows] = await pool.query('SELECT id, verification_status FROM sellers WHERE id = ?;', [sellerId]);
  if (sellerRows.length === 0) {
    throw new NotFoundError('Seller account not found.');
  }

  await pool.query(
    `UPDATE sellers 
     SET verification_status = 'UNDER_REVIEW', 
         rejection_reason = NULL, 
         updated_at = CURRENT_TIMESTAMP 
     WHERE id = ?;`,
    [sellerId]
  );

  const [updated] = await pool.query('SELECT * FROM sellers WHERE id = ?;', [sellerId]);
  return updated[0];
}

module.exports = {
  PRIVATE_DOCS_DIR,
  registerSeller,
  uploadVerificationDocument,
  getSellerDocuments,
  getDocumentForStream,
  reviewSellerVerification,
  resubmitSellerVerification
};
