/**
 * Support Ticket Routes (/api/v1/support)
 */

const express = require('express');
const Joi = require('joi');
const deliveryController = require('../controllers/delivery.controller');
const authenticate = require('../middleware/authenticate');
const { requireRoles, requirePermissions } = require('../middleware/authorize');
const validate = require('../middleware/validate');

const router = express.Router();

const createTicketSchema = {
  body: Joi.object({
    orderId: Joi.string().guid().allow(null, '').optional(),
    subject: Joi.string().min(5).max(200).required(),
    category: Joi.string().valid('ORDER_ISSUE', 'DELIVERY_DELAY', 'FOOD_QUALITY', 'PAYMENT_ISSUE', 'OTHER').default('ORDER_ISSUE'),
    priority: Joi.string().valid('LOW', 'MEDIUM', 'HIGH', 'URGENT').default('MEDIUM'),
    initialMessage: Joi.string().min(5).max(2000).required()
  })
};

const addMessageSchema = {
  params: Joi.object({
    ticketId: Joi.string().guid().required()
  }),
  body: Joi.object({
    message: Joi.string().min(1).max(2000).required()
  })
};

const ticketIdParamSchema = {
  params: Joi.object({
    ticketId: Joi.string().guid().required()
  })
};

const updateStatusSchema = {
  params: Joi.object({
    ticketId: Joi.string().guid().required()
  }),
  body: Joi.object({
    status: Joi.string().valid('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED').optional(),
    assignedAgentId: Joi.string().guid().allow(null).optional()
  })
};

const listQuerySchema = {
  query: Joi.object({
    status: Joi.string().valid('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED').optional(),
    category: Joi.string().valid('ORDER_ISSUE', 'DELIVERY_DELAY', 'FOOD_QUALITY', 'PAYMENT_ISSUE', 'OTHER').optional(),
    priority: Joi.string().valid('LOW', 'MEDIUM', 'HIGH', 'URGENT').optional(),
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20)
  })
};

router.use(authenticate);

// -----------------------------------------------------------------------------
// Customer Ticket Endpoints
// -----------------------------------------------------------------------------
router.post(
  '/tickets',
  requireRoles('CUSTOMER'),
  validate(createTicketSchema),
  deliveryController.createTicket
);

router.get(
  '/my-tickets',
  requireRoles('CUSTOMER'),
  validate(listQuerySchema),
  deliveryController.listCustomerTickets
);

router.get(
  '/my-tickets/:ticketId',
  requireRoles('CUSTOMER'),
  validate(ticketIdParamSchema),
  deliveryController.getCustomerTicket
);

// -----------------------------------------------------------------------------
// Shared Conversation Messaging
// -----------------------------------------------------------------------------
router.post(
  '/tickets/:ticketId/messages',
  validate(addMessageSchema),
  deliveryController.addMessage
);

// -----------------------------------------------------------------------------
// Support Agent & Admin Endpoints (Requires handle_support_tickets)
// -----------------------------------------------------------------------------
router.get(
  '/staff/tickets',
  requirePermissions('handle_support_tickets'),
  validate(listQuerySchema),
  deliveryController.listStaffTickets
);

router.get(
  '/staff/tickets/:ticketId',
  requirePermissions('handle_support_tickets'),
  validate(ticketIdParamSchema),
  deliveryController.getStaffTicket
);

router.patch(
  '/staff/tickets/:ticketId/status',
  requirePermissions('handle_support_tickets'),
  validate(updateStatusSchema),
  deliveryController.updateTicketStatus
);

module.exports = router;
