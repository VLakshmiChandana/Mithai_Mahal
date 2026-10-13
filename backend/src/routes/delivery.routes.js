/**
 * Delivery Routes (/api/v1/deliveries)
 */

const express = require('express');
const Joi = require('joi');
const deliveryController = require('../controllers/delivery.controller');
const authenticate = require('../middleware/authenticate');
const { requireRoles, requirePermissions } = require('../middleware/authorize');
const validate = require('../middleware/validate');

const router = express.Router();

const createPartnerSchema = {
  body: Joi.object({
    name: Joi.string().min(2).max(150).required(),
    phone: Joi.string().min(8).max(20).required(),
    email: Joi.string().email({ tlds: { allow: false } }).allow(null, '').optional(),
    vehicleType: Joi.string().valid('MOTORCYCLE', 'SCOOTER', 'BICYCLE', 'ELECTRIC_VEHICLE', 'OTHER').default('MOTORCYCLE'),
    vehicleNumber: Joi.string().max(30).allow(null, '').optional(),
    drivingLicenseNumber: Joi.string().max(50).allow(null, '').optional()
  })
};

const assignPartnerSchema = {
  params: Joi.object({
    orderId: Joi.string().guid().required()
  }),
  body: Joi.object({
    partnerId: Joi.string().guid().required()
  })
};

const updateStatusSchema = {
  params: Joi.object({
    orderId: Joi.string().guid().required()
  }),
  body: Joi.object({
    status: Joi.string().valid('PICKED_UP', 'IN_TRANSIT', 'DELIVERED', 'FAILED').required(),
    failureReason: Joi.string().max(255).allow(null, '').optional(),
    notes: Joi.string().max(255).allow(null, '').optional()
  })
};

const updateLocationSchema = {
  params: Joi.object({
    orderId: Joi.string().guid().required()
  }),
  body: Joi.object({
    latitude: Joi.number().min(-90).max(90).required(),
    longitude: Joi.number().min(-180).max(180).required(),
    partnerId: Joi.string().guid().optional()
  })
};

const orderIdParamSchema = {
  params: Joi.object({
    orderId: Joi.string().guid().required()
  })
};

router.use(authenticate);

// 1. Delivery Partner Management (Platform Admin / Super Admin)
router.post(
  '/partners',
  requireRoles('ADMIN', 'SUPER_ADMIN'),
  validate(createPartnerSchema),
  deliveryController.createPartner
);

router.get(
  '/partners',
  requireRoles('ADMIN', 'SUPER_ADMIN', 'SELLER'),
  deliveryController.listPartners
);

// 2. Assignment & Status Management (Staff or Sweet Shop Seller)
router.post(
  '/orders/:orderId/assign',
  requireRoles('ADMIN', 'SUPER_ADMIN', 'SELLER'),
  validate(assignPartnerSchema),
  deliveryController.assignPartner
);

router.patch(
  '/orders/:orderId/status',
  requireRoles('ADMIN', 'SUPER_ADMIN', 'SELLER'),
  validate(updateStatusSchema),
  deliveryController.updateDeliveryStatus
);

// 3. Location Tracking Updates (Delivery Partner simulation or Staff)
router.post(
  '/orders/:orderId/location',
  requireRoles('ADMIN', 'SUPER_ADMIN', 'SELLER'),
  validate(updateLocationSchema),
  deliveryController.updateLocation
);

// 4. Live Delivery Tracking View (Scoped to Customer, Seller, or Staff)
router.get(
  '/orders/:orderId/tracking',
  validate(orderIdParamSchema),
  deliveryController.getTracking
);

// 5. Demo Simulation Reset (Scoped to Order owner, Seller, or Staff)
router.post(
  '/orders/:orderId/simulation/reset',
  validate(orderIdParamSchema),
  deliveryController.resetSimulation
);

module.exports = router;
