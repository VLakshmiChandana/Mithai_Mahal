/**
 * Delivery Address Routes (/api/v1/addresses)
 */

const express = require('express');
const Joi = require('joi');
const addressController = require('../controllers/address.controller');
const authenticate = require('../middleware/authenticate');
const { requireRoles } = require('../middleware/authorize');
const validate = require('../middleware/validate');

const router = express.Router();

const createAddressSchema = {
  body: Joi.object({
    recipientName: Joi.string().min(2).max(100).optional(),
    recipientPhone: Joi.string().min(8).max(20).optional(),
    addressLine1: Joi.string().min(3).max(255).required(),
    addressLine2: Joi.string().max(255).allow(null, '').optional(),
    city: Joi.string().min(2).max(100).required(),
    state: Joi.string().min(2).max(100).required(),
    pincode: Joi.string().min(4).max(20).required(),
    country: Joi.string().max(100).default('India'),
    addressType: Joi.string().valid('HOME', 'WORK', 'OTHER').default('HOME'),
    isDefault: Joi.boolean().default(false)
  })
};

const updateAddressSchema = {
  params: Joi.object({
    addressId: Joi.string().guid().required()
  }),
  body: Joi.object({
    recipientName: Joi.string().min(2).max(100).optional(),
    recipientPhone: Joi.string().min(8).max(20).optional(),
    addressLine1: Joi.string().min(3).max(255).optional(),
    addressLine2: Joi.string().max(255).allow(null, '').optional(),
    city: Joi.string().min(2).max(100).optional(),
    state: Joi.string().min(2).max(100).optional(),
    pincode: Joi.string().min(4).max(20).optional(),
    country: Joi.string().max(100).optional(),
    addressType: Joi.string().valid('HOME', 'WORK', 'OTHER').optional(),
    isDefault: Joi.boolean().optional()
  })
};

const addressIdParamSchema = {
  params: Joi.object({
    addressId: Joi.string().guid().required()
  })
};

// All address operations require an authenticated CUSTOMER
router.use(authenticate, requireRoles('CUSTOMER'));

router.get('/', addressController.listAddresses);
router.post('/', validate(createAddressSchema), addressController.createAddress);
router.get('/:addressId', validate(addressIdParamSchema), addressController.getAddress);
router.patch('/:addressId', validate(updateAddressSchema), addressController.updateAddress);
router.delete('/:addressId', validate(addressIdParamSchema), addressController.deleteAddress);
router.post('/:addressId/default', validate(addressIdParamSchema), addressController.setDefaultAddress);

module.exports = router;
