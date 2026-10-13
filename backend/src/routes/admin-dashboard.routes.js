/**
 * Admin Operational Dashboard Routes (/api/v1/admin/dashboard)
 * Accessible by both ADMIN and SUPER_ADMIN roles holding `view_operational_metrics`.
 */

const express = require('express');
const adminController = require('../controllers/admin.controller');
const authenticate = require('../middleware/authenticate');
const { requireRoles, requirePermissions } = require('../middleware/authorize');

const router = express.Router();

router.use(authenticate);
router.use(requireRoles('SUPER_ADMIN', 'ADMIN'));
router.use(requirePermissions('view_operational_metrics'));

// Operational overview metrics, queue counts, and recent activity
router.get('/metrics', adminController.getAdminOperationalMetrics);

module.exports = router;
