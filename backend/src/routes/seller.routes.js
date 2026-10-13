/**
 * Seller Management Routes (/api/v1/sellers)
 */

const express = require('express');
const Joi = require('joi');
const sellerController = require('../controllers/seller.controller');
const authenticate = require('../middleware/authenticate');
const { requirePermissions, requireRoles } = require('../middleware/authorize');
const { enforceTenant } = require('../middleware/tenant');
const validate = require('../middleware/validate');

const multer = require('multer');
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }
});

const router = express.Router();

const registerSellerSchema = {
  body: Joi.object({
    ownerName: Joi.string().min(2).max(150).optional(),
    businessName: Joi.string().min(2).max(255).required(),
    legalName: Joi.string().max(255).optional(),
    businessType: Joi.string().valid('PROPRIETORSHIP', 'PARTNERSHIP', 'PVT_LTD', 'LLP', 'PUBLIC_LTD', 'OTHER').default('PROPRIETORSHIP'),
    email: Joi.string().email({ tlds: { allow: false } }).required(),
    phone: Joi.string().min(8).max(20).required(),
    password: Joi.string().min(8).required(),
    shopAddress: Joi.string().max(255).optional(),
    city: Joi.string().max(100).optional(),
    state: Joi.string().max(100).optional(),
    pincode: Joi.string().pattern(/^\d{6}$/).optional(),
    gstin: Joi.string().length(15).alphanum().optional().allow(null, ''),
    fssaiNumber: Joi.string().length(14).pattern(/^\d+$/).optional().allow(null, ''),
    fssaiType: Joi.string().valid('REGISTRATION', 'STATE_LICENSE', 'CENTRAL_LICENSE').default('REGISTRATION')
  })
};

const reviewVerificationSchema = {
  params: Joi.object({
    sellerId: Joi.string().guid().required()
  }),
  body: Joi.object({
    status: Joi.string().valid('APPROVED', 'REJECTED').required(),
    rejectionReason: Joi.string().max(500).when('status', {
      is: 'REJECTED',
      then: Joi.required(),
      otherwise: Joi.optional().allow(null, '')
    }),
    reviewNotes: Joi.string().max(500).optional().allow(null, '')
  })
};

const updateProfileSchema = {
  body: Joi.object({
    businessName: Joi.string().min(2).max(255).optional(),
    phone: Joi.string().min(8).max(20).optional(),
    logo: Joi.string().max(500).allow(null, '').optional(),
    profilePhoto: Joi.string().max(500).allow(null, '').optional()
  })
};

const updateStatusSchema = {
  params: Joi.object({
    sellerId: Joi.string().guid().required()
  }),
  body: Joi.object({
    accountStatus: Joi.string().valid('PENDING_APPROVAL', 'ACTIVE', 'SUSPENDED', 'TERMINATED').optional(),
    verificationStatus: Joi.string().valid('PENDING', 'UNDER_REVIEW', 'APPROVED', 'REJECTED').optional()
  })
};

const sellerIdParamSchema = {
  params: Joi.object({
    sellerId: Joi.string().guid().required()
  })
};

// -----------------------------------------------------------------------------
// Public Routes
// -----------------------------------------------------------------------------
router.post('/register', validate(registerSellerSchema), sellerController.registerSeller);
router.get('/public', sellerController.listPublicShops);
router.get('/public/:sellerId', validate(sellerIdParamSchema), sellerController.getPublicShopDetails);

// -----------------------------------------------------------------------------
// Authenticated Seller & Staff Routes
// -----------------------------------------------------------------------------
router.use(authenticate);

// Seller Verification & Documents (Seller context)
router.get(
  '/documents',
  requireRoles('SELLER'),
  sellerController.getDocuments
);

router.post(
  '/documents',
  requireRoles('SELLER'),
  upload.single('file'),
  sellerController.uploadDocument
);

router.post(
  '/resubmit',
  requireRoles('SELLER'),
  sellerController.resubmitVerification
);

// View and update own profile (Seller context)
router.get(
  '/profile',
  requireRoles('SELLER'),
  sellerController.getProfile
);

router.patch(
  '/profile',
  requireRoles('SELLER'),
  validate(updateProfileSchema),
  sellerController.updateProfile
);

// Staff Review & Inspection Endpoints (Super Admin & Admin)
router.get(
  '/:sellerId/documents',
  requireRoles('SUPER_ADMIN', 'ADMIN'),
  requirePermissions('manage_seller_accounts'),
  validate(sellerIdParamSchema),
  sellerController.getDocuments
);

// Secure Authorized Document Streaming (Staff or Document Owner)
const documentStreamParamSchema = {
  params: Joi.object({
    sellerId: Joi.string().guid().required(),
    documentId: Joi.string().guid().required()
  })
};

router.get(
  '/:sellerId/documents/:documentId/file',
  validate(documentStreamParamSchema),
  sellerController.streamDocumentFile
);

router.patch(
  '/:sellerId/review',
  requireRoles('SUPER_ADMIN', 'ADMIN'),
  requirePermissions('manage_seller_accounts'),
  validate(reviewVerificationSchema),
  sellerController.reviewVerification
);

// Get specific seller profile (Enforced by tenant isolation)
router.get(
  '/:sellerId',
  enforceTenant('sellerId'),
  sellerController.getProfile
);

// Staff-only: Update seller account or verification status
router.patch(
  '/:sellerId/status',
  requireRoles('SUPER_ADMIN', 'ADMIN'),
  requirePermissions('manage_seller_accounts'),
  validate(updateStatusSchema),
  sellerController.updateSellerStatus
);

module.exports = router;
