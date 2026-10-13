/**
 * Customer Routes (/api/v1/customers)
 */

const express = require('express');
const Joi = require('joi');
const customerController = require('../controllers/customer.controller');
const authenticate = require('../middleware/authenticate');
const { requireRoles } = require('../middleware/authorize');
const validate = require('../middleware/validate');

const router = express.Router();

const registerCustomerSchema = {
  body: Joi.object({
    sellerId: Joi.string().guid().optional(),
    email: Joi.string().email({ tlds: { allow: false } }).required(),
    password: Joi.string().min(8).required(),
    firstName: Joi.string().min(2).max(100).required(),
    lastName: Joi.string().max(100).optional(),
    phone: Joi.string().max(20).optional()
  })
};

const updateCustomerProfileSchema = {
  body: Joi.object({
    firstName: Joi.string().min(2).max(100).optional(),
    lastName: Joi.string().max(100).optional(),
    phone: Joi.string().max(20).optional(),
    profilePhoto: Joi.string().uri().allow(null, '').optional()
  })
};

// Public: Customer registration under a specific sweet shop (sellerId)
router.post(
  '/register',
  validate(registerCustomerSchema),
  customerController.registerCustomer
);

// Protected: View and update own customer profile
router.get(
  '/profile',
  authenticate,
  requireRoles('CUSTOMER'),
  customerController.getProfile
);

router.patch(
  '/profile',
  authenticate,
  requireRoles('CUSTOMER'),
  validate(updateCustomerProfileSchema),
  customerController.updateProfile
);

module.exports = router;
