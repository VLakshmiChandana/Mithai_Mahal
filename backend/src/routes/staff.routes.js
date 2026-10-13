/**
 * Staff Management Routes (/api/v1/staff)
 */

const express = require('express');
const Joi = require('joi');
const staffController = require('../controllers/staff.controller');
const authenticate = require('../middleware/authenticate');
const { requirePermissions, requireRoles } = require('../middleware/authorize');
const validate = require('../middleware/validate');

const router = express.Router();

const createStaffSchema = {
  body: Joi.object({
    name: Joi.string().min(2).max(150).required(),
    email: Joi.string().email({ tlds: { allow: false } }).required(),
    password: Joi.string().min(8).required(),
    mobileNumber: Joi.string().max(20).optional()
  })
};

const createSellerSchema = {
  body: Joi.object({
    businessName: Joi.string().min(2).max(255).required(),
    legalName: Joi.string().max(255).optional(),
    businessType: Joi.string().valid('PROPRIETORSHIP', 'PARTNERSHIP', 'PVT_LTD', 'LLP', 'PUBLIC_LTD', 'OTHER').default('PROPRIETORSHIP'),
    email: Joi.string().email({ tlds: { allow: false } }).required(),
    phone: Joi.string().min(8).max(20).required(),
    gstin: Joi.string().length(15).alphanum().required(),
    password: Joi.string().min(8).required()
  })
};

// All staff endpoints require authentication
router.use(authenticate);

// Super Admin only: Create Admins and Accountants
router.post(
  '/admins',
  requireRoles('SUPER_ADMIN'),
  requirePermissions('manage_platform_staff'),
  validate(createStaffSchema),
  staffController.createAdmin
);

router.post(
  '/accountants',
  requireRoles('SUPER_ADMIN'),
  requirePermissions('manage_platform_staff'),
  validate(createStaffSchema),
  staffController.createAccountant
);

// Super Admin or Admin with manage_seller_accounts: Create & list Sellers
router.post(
  '/sellers',
  requireRoles('SUPER_ADMIN', 'ADMIN'),
  requirePermissions('manage_seller_accounts'),
  validate(createSellerSchema),
  staffController.createSeller
);

router.get(
  '/sellers',
  requirePermissions('manage_seller_accounts'),
  staffController.listSellers
);

module.exports = router;
