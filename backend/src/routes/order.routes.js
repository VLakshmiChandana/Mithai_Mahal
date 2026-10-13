/**
 * Order Routes (/api/v1/orders)
 */

const express = require('express');
const Joi = require('joi');
const orderController = require('../controllers/order.controller');
const authenticate = require('../middleware/authenticate');
const { requireRoles, requirePermissions } = require('../middleware/authorize');
const validate = require('../middleware/validate');

const router = express.Router();

const placeOrderSchema = {
  body: Joi.object({
    deliveryAddressId: Joi.string().guid().required()
  })
};

const cancelOrderSchema = {
  params: Joi.object({
    orderId: Joi.string().guid().required()
  }),
  body: Joi.object({
    reason: Joi.string().max(255).allow(null, '').optional()
  })
};

const updateStatusSchema = {
  params: Joi.object({
    orderId: Joi.string().guid().required()
  }),
  body: Joi.object({
    status: Joi.string().valid('CONFIRMED', 'PREPARING', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED').required(),
    reason: Joi.string().max(255).allow(null, '').optional()
  })
};

const orderIdParamSchema = {
  params: Joi.object({
    orderId: Joi.string().guid().required()
  })
};

const listOrdersQuerySchema = {
  query: Joi.object({
    status: Joi.string().valid('ALL', 'PLACED', 'CONFIRMED', 'PREPARING', 'OUT_FOR_DELIVERY', 'OUT FOR DELIVERY', 'DELIVERED', 'CANCELLED').optional(),
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20)
  })
};

router.use(authenticate);

// -----------------------------------------------------------------------------
// Customer Order Routes
// -----------------------------------------------------------------------------
router.post(
  '/',
  requireRoles('CUSTOMER'),
  requirePermissions('create_customer_order'),
  validate(placeOrderSchema),
  orderController.placeOrder
);

router.get(
  '/my-orders',
  requireRoles('CUSTOMER'),
  validate(listOrdersQuerySchema),
  orderController.listCustomerOrders
);

router.get(
  '/my-orders/:orderId',
  requireRoles('CUSTOMER'),
  validate(orderIdParamSchema),
  orderController.getCustomerOrder
);

router.post(
  '/my-orders/:orderId/cancel',
  requireRoles('CUSTOMER'),
  validate(cancelOrderSchema),
  orderController.cancelCustomerOrder
);

// -----------------------------------------------------------------------------
// Seller Order Management Routes
// -----------------------------------------------------------------------------
router.get(
  '/seller-orders',
  requireRoles('SELLER'),
  validate(listOrdersQuerySchema),
  orderController.listSellerOrders
);

router.get(
  '/seller-orders/:orderId',
  requireRoles('SELLER'),
  validate(orderIdParamSchema),
  orderController.getSellerOrder
);

router.patch(
  '/seller-orders/:orderId/status',
  requireRoles('SELLER'),
  validate(updateStatusSchema),
  orderController.updateSellerOrderStatus
);

module.exports = router;
