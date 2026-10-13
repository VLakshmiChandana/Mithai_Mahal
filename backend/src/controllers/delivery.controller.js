/**
 * Delivery & Support Controllers
 */

const deliveryService = require('../services/delivery.service');
const supportService = require('../services/support.service');
const { ForbiddenError } = require('../middleware/errorHandler');

// -----------------------------------------------------------------------------
// DELIVERY CONTROLLERS
// -----------------------------------------------------------------------------

async function createPartner(req, res, next) {
  try {
    const partner = await deliveryService.createDeliveryPartner(req.body);
    res.status(201).json({
      success: true,
      message: 'Delivery partner registered successfully.',
      data: partner
    });
  } catch (err) {
    next(err);
  }
}

async function listPartners(req, res, next) {
  try {
    const partners = await deliveryService.listDeliveryPartners(req.query);
    res.status(200).json({
      success: true,
      data: partners
    });
  } catch (err) {
    next(err);
  }
}

async function assignPartner(req, res, next) {
  try {
    const assignedBy = { id: req.user.id, role: req.user.role };
    const tracking = await deliveryService.assignDeliveryPartner(
      req.params.orderId,
      req.body.partnerId,
      assignedBy
    );
    res.status(200).json({
      success: true,
      message: 'Delivery partner assigned successfully.',
      data: tracking
    });
  } catch (err) {
    next(err);
  }
}

async function updateDeliveryStatus(req, res, next) {
  try {
    const tracking = await deliveryService.updateDeliveryStatus(
      req.params.orderId,
      req.body.status,
      {
        failureReason: req.body.failureReason,
        notes: req.body.notes,
        actor: req.user
      }
    );
    res.status(200).json({
      success: true,
      message: `Delivery status updated to "${req.body.status}".`,
      data: tracking
    });
  } catch (err) {
    next(err);
  }
}

async function updateLocation(req, res, next) {
  try {
    const tracking = await deliveryService.updateDeliveryLocation(
      req.params.orderId,
      {
        latitude: req.body.latitude,
        longitude: req.body.longitude,
        partnerId: req.body.partnerId || null
      }
    );
    res.status(200).json({
      success: true,
      message: 'Delivery location updated.',
      data: tracking
    });
  } catch (err) {
    next(err);
  }
}

async function getTracking(req, res, next) {
  try {
    const tracking = await deliveryService.getDeliveryTracking(req.params.orderId, req.user);
    res.status(200).json({
      success: true,
      data: tracking
    });
  } catch (err) {
    next(err);
  }
}

async function resetSimulation(req, res, next) {
  try {
    const tracking = await deliveryService.resetDeliverySimulation(req.params.orderId);
    res.status(200).json({
      success: true,
      message: 'Delivery simulation reset to beginning (0s)',
      data: tracking
    });
  } catch (err) {
    next(err);
  }
}

// -----------------------------------------------------------------------------
// SUPPORT TICKET CONTROLLERS
// -----------------------------------------------------------------------------

async function createTicket(req, res, next) {
  try {
    if (req.user.userType !== 'CUSTOMER') {
      throw new ForbiddenError('Only customers can open support tickets.');
    }
    const ticket = await supportService.createTicket(req.user.id, req.body);
    res.status(201).json({
      success: true,
      message: 'Support ticket opened successfully.',
      data: ticket
    });
  } catch (err) {
    next(err);
  }
}

async function getCustomerTicket(req, res, next) {
  try {
    const ticket = await supportService.getTicketById(req.params.ticketId, req.user.id, false);
    res.status(200).json({
      success: true,
      data: ticket
    });
  } catch (err) {
    next(err);
  }
}

async function listCustomerTickets(req, res, next) {
  try {
    const result = await supportService.listCustomerTickets(req.user.id, req.query);
    res.status(200).json({
      success: true,
      data: result.items,
      pagination: result.pagination
    });
  } catch (err) {
    next(err);
  }
}

async function listStaffTickets(req, res, next) {
  try {
    const result = await supportService.listStaffTickets(req.query);
    res.status(200).json({
      success: true,
      data: result.items,
      pagination: result.pagination
    });
  } catch (err) {
    next(err);
  }
}

async function getStaffTicket(req, res, next) {
  try {
    const ticket = await supportService.getTicketById(req.params.ticketId, req.user.id, true);
    res.status(200).json({
      success: true,
      data: ticket
    });
  } catch (err) {
    next(err);
  }
}

async function addMessage(req, res, next) {
  try {
    const ticket = await supportService.addTicketMessage(
      req.params.ticketId,
      req.user,
      req.body.message
    );
    res.status(200).json({
      success: true,
      message: 'Message added to ticket.',
      data: ticket
    });
  } catch (err) {
    next(err);
  }
}

async function updateTicketStatus(req, res, next) {
  try {
    const ticket = await supportService.updateTicketStatus(
      req.params.ticketId,
      req.user.id,
      req.body
    );
    res.status(200).json({
      success: true,
      message: 'Support ticket updated.',
      data: ticket
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  createPartner,
  listPartners,
  assignPartner,
  updateDeliveryStatus,
  updateLocation,
  getTracking,
  resetSimulation,
  createTicket,
  getCustomerTicket,
  listCustomerTickets,
  listStaffTickets,
  getStaffTicket,
  addMessage,
  updateTicketStatus
};
