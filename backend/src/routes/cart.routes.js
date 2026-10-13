/**
 * Shopping Cart Routes (/api/v1/cart)
 */

const express = require('express');
const Joi = require('joi');
const cartController = require('../controllers/cart.controller');
const authenticate = require('../middleware/authenticate');
const { requireRoles } = require('../middleware/authorize');
const validate = require('../middleware/validate');

const router = express.Router();

const addItemSchema = {
  body: Joi.object({
    productId: Joi.string().guid().required(),
    quantity: Joi.number().integer().min(1).default(1),
    clearAndReplace: Joi.boolean().default(false)
  })
};

const updateItemSchema = {
  params: Joi.object({
    itemId: Joi.string().guid().required()
  }),
  body: Joi.object({
    quantity: Joi.number().integer().min(0).required()
  })
};

const itemParamsSchema = {
  params: Joi.object({
    itemId: Joi.string().guid().required()
  })
};

const validateCheckoutSchema = {
  body: Joi.object({
    deliveryAddressId: Joi.string().guid().optional()
  })
};

// All cart operations require an authenticated CUSTOMER
router.use(authenticate, requireRoles('CUSTOMER'));

router.get('/', cartController.getCart);
router.post('/items', validate(addItemSchema), cartController.addItem);
router.patch('/items/:itemId', validate(updateItemSchema), cartController.updateItem);
router.delete('/items/:itemId', validate(itemParamsSchema), cartController.removeItem);
router.delete('/', cartController.clearCart);
router.post('/validate-checkout', validate(validateCheckoutSchema), cartController.validateCheckout);

module.exports = router;
