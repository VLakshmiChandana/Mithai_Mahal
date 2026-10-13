/**
 * Super Admin Dedicated Control Center Routes (/api/v1/super-admin)
 * Enforces strict SUPER_ADMIN role authentication and granular RBAC permissions.
 */

const express = require('express');
const Joi = require('joi');
const adminController = require('../controllers/admin.controller');
const authenticate = require('../middleware/authenticate');
const { requireRoles, requirePermissions } = require('../middleware/authorize');
const validate = require('../middleware/validate');

const router = express.Router();

// Strict Super Admin Access Only
router.use(authenticate);
router.use(requireRoles('SUPER_ADMIN'));

const updateStatusSchema = {
  params: Joi.object({
    role: Joi.string().valid('ADMIN', 'ACCOUNTANT', 'SELLER', 'CUSTOMER', 'SUPER_ADMIN').required(),
    userId: Joi.string().guid().required()
  }),
  body: Joi.object({
    isActive: Joi.boolean().required(),
    reason: Joi.string().max(500).optional()
  })
};

const updateConfigSchema = {
  body: Joi.object({
    commissionRatePercent: Joi.number().min(0).max(50).required(),
    reason: Joi.string().max(500).optional()
  })
};

// 1. Business Intelligence & Analytics
router.get(
  '/analytics/overview',
  requirePermissions('view_platform_analytics'),
  adminController.getSuperAdminAnalytics
);

router.get(
  '/analytics/sales-trends',
  requirePermissions('view_platform_analytics'),
  adminController.getSalesTrends
);

router.get(
  '/analytics/top-performers',
  requirePermissions('view_platform_analytics'),
  adminController.getTopPerformers
);

// 2. Global Account Lifecycle Management
router.get(
  '/accounts',
  requirePermissions('manage_platform_accounts'),
  adminController.listAllAccounts
);

router.patch(
  '/accounts/:role/:userId/status',
  requirePermissions('manage_platform_accounts'),
  validate(updateStatusSchema),
  adminController.updateAccountStatus
);

// 3. Platform Audit Logs & Security Events
router.get(
  '/audit-logs',
  requirePermissions('view_audit_logs'),
  adminController.listAuditLogs
);

// 4. Platform Configuration
router.get(
  '/config',
  adminController.getPlatformConfig
);

router.patch(
  '/config',
  validate(updateConfigSchema),
  adminController.updatePlatformConfig
);

// 5. Super Admin Shop Suspension & Reactivation
const shopActionSchema = {
  params: Joi.object({
    sellerId: Joi.string().guid().required()
  }),
  body: Joi.object({
    reason: Joi.string().min(5).max(500).required()
  })
};

router.post(
  '/shops/:sellerId/suspend',
  requirePermissions('manage_platform_accounts'),
  validate(shopActionSchema),
  adminController.suspendShop
);

router.post(
  '/shops/:sellerId/reactivate',
  requirePermissions('manage_platform_accounts'),
  validate(shopActionSchema),
  adminController.reactivateShop
);

module.exports = router;
