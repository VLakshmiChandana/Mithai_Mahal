/**
 * Seller Management Controller
 * 
 * Endpoints:
 * - GET   /api/v1/sellers/profile         (Get seller's own profile)
 * - PATCH /api/v1/sellers/profile         (Update own business info: name, phone, logo)
 * - GET   /api/v1/sellers/:sellerId       (Get specific seller - Protected by tenant isolation)
 * - PATCH /api/v1/sellers/:sellerId/status(Update account status - Staff only)
 */

const { pool } = require('../config/db');
const { AppError, NotFoundError, ForbiddenError } = require('../middleware/errorHandler');

async function getProfile(req, res, next) {
  try {
    const sellerId = req.user.userType === 'SELLER' ? req.user.id : req.tenantId;

    const [rows] = await pool.query(
      `SELECT id, owner_name, business_name, legal_name, business_type, email, phone, gstin, 
              shop_address, city, state, pincode,
              logo, profile_photo, account_status, verification_status, rejection_reason, is_active, created_at, updated_at 
       FROM sellers 
       WHERE id = ?;`,
      [sellerId]
    );

    if (rows.length === 0) {
      throw new NotFoundError('Seller account not found.');
    }

    res.status(200).json({
      success: true,
      data: rows[0]
    });
  } catch (err) {
    next(err);
  }
}

async function updateProfile(req, res, next) {
  try {
    const sellerId = req.user.userType === 'SELLER' ? req.user.id : req.tenantId;
    const { businessName, phone, logo, profilePhoto } = req.body;

    const updates = [];
    const values = [];

    if (businessName) {
      updates.push('business_name = ?');
      values.push(businessName);
    }
    if (phone) {
      updates.push('phone = ?');
      values.push(phone);
    }
    if (logo !== undefined) {
      updates.push('logo = ?');
      values.push(logo);
    }
    if (profilePhoto !== undefined) {
      updates.push('profile_photo = ?');
      values.push(profilePhoto);
    }

    if (updates.length === 0) {
      throw new AppError('No valid profile fields provided for update.', 400, 'BAD_REQUEST');
    }

    values.push(sellerId);

    await pool.query(
      `UPDATE sellers SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?;`,
      values
    );

    const [updated] = await pool.query(
      `SELECT id, business_name, legal_name, business_type, email, phone, gstin, 
              logo, profile_photo, account_status, verification_status, is_active, updated_at 
       FROM sellers 
       WHERE id = ?;`,
      [sellerId]
    );

    res.status(200).json({
      success: true,
      message: 'Seller profile updated successfully.',
      data: updated[0]
    });
  } catch (err) {
    next(err);
  }
}

async function updateSellerStatus(req, res, next) {
  try {
    const { sellerId } = req.params;
    const { accountStatus, verificationStatus } = req.body;

    const updates = [];
    const values = [];

    if (accountStatus) {
      updates.push('account_status = ?');
      values.push(accountStatus);
    }
    if (verificationStatus) {
      updates.push('verification_status = ?');
      values.push(verificationStatus);
    }

    if (updates.length === 0) {
      throw new AppError('No status fields provided to update.', 400, 'BAD_REQUEST');
    }

    values.push(sellerId);

    const [result] = await pool.query(
      `UPDATE sellers SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?;`,
      values
    );

    if (result.affectedRows === 0) {
      throw new NotFoundError('Seller account not found.');
    }

    const [updated] = await pool.query(
      `SELECT id, business_name, email, account_status, verification_status, updated_at 
       FROM sellers 
       WHERE id = ?;`,
      [sellerId]
    );

    res.status(200).json({
      success: true,
      message: 'Seller status updated successfully.',
      data: updated[0]
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Public: List all active, approved sweet shops
 */
async function listPublicShops(req, res, next) {
  try {
    const [rows] = await pool.query(
      `SELECT id, business_name, email, phone, logo, profile_photo, created_at 
       FROM sellers 
       WHERE is_active = TRUE AND account_status != 'SUSPENDED' AND account_status != 'TERMINATED'
       ORDER BY business_name ASC;`
    );

    res.status(200).json({
      success: true,
      data: rows
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Public: Get single sweet shop public details by ID
 */
async function getPublicShopDetails(req, res, next) {
  try {
    const { sellerId } = req.params;
    const [rows] = await pool.query(
      `SELECT id, business_name, email, phone, logo, profile_photo, created_at 
       FROM sellers 
       WHERE id = ? AND is_active = TRUE AND account_status != 'SUSPENDED' AND account_status != 'TERMINATED'
       LIMIT 1;`,
      [sellerId]
    );

    if (rows.length === 0) {
      throw new NotFoundError('Sweet shop not found or is currently inactive.');
    }

    res.status(200).json({
      success: true,
      data: rows[0]
    });
  } catch (err) {
    next(err);
  }
}

const sellerService = require('../services/seller.service');

async function registerSeller(req, res, next) {
  try {
    const seller = await sellerService.registerSeller(req.body);
    res.status(201).json({
      success: true,
      message: 'Sweet shop seller registered successfully. Account is pending verification.',
      data: seller
    });
  } catch (err) {
    next(err);
  }
}

async function uploadDocument(req, res, next) {
  try {
    const sellerId = req.user.userType === 'SELLER' ? req.user.id : req.tenantId;
    const { documentType, documentNumber, expiryDate } = req.body;

    const result = await sellerService.uploadVerificationDocument(sellerId, {
      documentType,
      documentNumber,
      expiryDate,
      file: req.file
    });

    res.status(201).json({
      success: true,
      message: 'Verification document uploaded successfully.',
      data: result
    });
  } catch (err) {
    next(err);
  }
}

async function getDocuments(req, res, next) {
  try {
    let sellerId;
    if (req.user.userType === 'SELLER') {
      sellerId = req.user.id;
    } else if (req.params.sellerId) {
      sellerId = req.params.sellerId;
    } else {
      sellerId = req.tenantId;
    }

    const docs = await sellerService.getSellerDocuments(sellerId);
    res.status(200).json({
      success: true,
      data: docs
    });
  } catch (err) {
    next(err);
  }
}

async function reviewVerification(req, res, next) {
  try {
    const { sellerId } = req.params;
    const { status, rejectionReason, reviewNotes } = req.body;
    const reviewerId = req.user.id;

    const updated = await sellerService.reviewSellerVerification(sellerId, reviewerId, {
      status,
      rejectionReason,
      reviewNotes,
      reviewer: req.user
    });

    res.status(200).json({
      success: true,
      message: `Seller verification updated to ${status}.`,
      data: updated
    });
  } catch (err) {
    next(err);
  }
}

async function resubmitVerification(req, res, next) {
  try {
    const sellerId = req.user.userType === 'SELLER' ? req.user.id : req.tenantId;
    const updated = await sellerService.resubmitSellerVerification(sellerId, req.body || {});

    res.status(200).json({
      success: true,
      message: 'Seller verification application resubmitted for review.',
      data: updated
    });
  } catch (err) {
    next(err);
  }
}

const fs = require('fs');
const path = require('path');

async function streamDocumentFile(req, res, next) {
  try {
    const { sellerId, documentId } = req.params;
    const user = req.user;

    // Authorization checks
    const role = user.role || user.userType;
    if (role === 'SELLER' && user.id !== sellerId) {
      throw new ForbiddenError('You can only access your own verification documents.');
    }
    if (role !== 'SELLER' && !['SUPER_ADMIN', 'ADMIN'].includes(role)) {
      throw new ForbiddenError('Access to seller verification documents is restricted.');
    }

    const doc = await sellerService.getDocumentForStream(sellerId, documentId);
    if (!doc) {
      throw new NotFoundError('Verification document record not found.');
    }
    if (doc.isPlaceholder || !doc.hasFile || !doc.filePath || !fs.existsSync(doc.filePath)) {
      throw new NotFoundError('Verification document file is missing or pending upload. Please request the seller to upload a valid document.');
    }

    const resolvedPath = path.resolve(doc.filePath);

    res.setHeader('Content-Type', doc.mimeType || 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(doc.fileName || 'document.pdf')}"`);
    res.setHeader('Cache-Control', 'private, no-cache, no-store');

    const stream = fs.createReadStream(resolvedPath);
    stream.on('error', (err) => {
      next(new AppError('Failed to read document stream from storage.', 500, 'STREAM_ERROR'));
    });
    stream.pipe(res);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getProfile,
  updateProfile,
  updateSellerStatus,
  listPublicShops,
  getPublicShopDetails,
  registerSeller,
  uploadDocument,
  getDocuments,
  reviewVerification,
  resubmitVerification,
  streamDocumentFile
};

