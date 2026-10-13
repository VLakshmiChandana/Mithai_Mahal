/**
 * Payment & Settlement Routes (/api/v1/payments)
 */

const express = require('express');
const Joi = require('joi');
const paymentController = require('../controllers/payment.controller');
const authenticate = require('../middleware/authenticate');
const { requireRoles, requirePermissions } = require('../middleware/authorize');
const validate = require('../middleware/validate');

const router = express.Router();

const orderIdParamSchema = {
  params: Joi.object({
    orderId: Joi.string().guid().required()
  })
};

const settlementQuerySchema = {
  query: Joi.object({
    startDate: Joi.date().iso().optional(),
    endDate: Joi.date().iso().optional(),
    sellerId: Joi.string().guid().optional()
  })
};

const verifyPaymentSchema = {
  params: Joi.object({
    orderId: Joi.string().guid().required()
  }),
  body: Joi.object({
    razorpayOrderId: Joi.string().optional(),
    razorpay_order_id: Joi.string().optional(),
    razorpayPaymentId: Joi.string().optional(),
    razorpay_payment_id: Joi.string().optional(),
    razorpaySignature: Joi.string().optional(),
    razorpay_signature: Joi.string().optional()
  }).or('razorpayOrderId', 'razorpay_order_id')
    .or('razorpayPaymentId', 'razorpay_payment_id')
    .or('razorpaySignature', 'razorpay_signature')
};

// 1. Public Gateway Webhook Receiver (No JWT auth, protected by HMAC-SHA256 signature)
router.post('/webhook', paymentController.handleWebhook);

// 2. Customer: Initiate Payment
router.post(
  '/orders/:orderId/initiate',
  authenticate,
  requireRoles('CUSTOMER'),
  validate(orderIdParamSchema),
  paymentController.initiatePayment
);

// 2b. Customer: Verify Razorpay Standard Checkout Client Signature Server-Side
router.post(
  '/orders/:orderId/verify',
  authenticate,
  requireRoles('CUSTOMER'),
  validate(verifyPaymentSchema),
  paymentController.verifyPaymentSignature
);

// 2c. Customer: Mock Payment Capture (Simulated Gateway Callback for Dev/Test)
router.post(
  '/orders/:orderId/mock-capture',
  authenticate,
  requireRoles('CUSTOMER'),
  validate(orderIdParamSchema),
  paymentController.mockCapture
);

// 2d. Customer: Development Test Signature Generator (For interactive Razorpay dupe simulator)
router.post(
  '/orders/:orderId/test-sign',
  authenticate,
  requireRoles('CUSTOMER'),
  validate(orderIdParamSchema),
  paymentController.generateTestSignature
);

// 3. Finance & Accounting Team: Settlement Reports
router.get(
  '/settlements',
  authenticate,
  requirePermissions('manage_financial_settlements'),
  validate(settlementQuerySchema),
  paymentController.getSettlementReport
);

module.exports = router;
