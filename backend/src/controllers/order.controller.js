/**
 * Order Controller
 * 
 * Endpoints for:
 * - Customers: Place Order, List Orders, Get Order Details, Cancel Order
 * - Sellers: List Shop Orders, Get Order Details, Update Order Status
 */

const orderService = require('../services/order.service');
const { ForbiddenError } = require('../middleware/errorHandler');

/**
 * Customer: Place order from current cart
 */
async function placeOrder(req, res, next) {
  try {
    if (req.user.userType !== 'CUSTOMER') {
      throw new ForbiddenError('Only customers can place sweet orders.');
    }

    const order = await orderService.placeOrder(req.user.id, req.body);
    res.status(201).json({
      success: true,
      message: 'Sweet order placed successfully.',
      data: order
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Customer: List own orders
 */
async function listCustomerOrders(req, res, next) {
  try {
    if (req.user.userType !== 'CUSTOMER') {
      throw new ForbiddenError('Only customers can access customer order history.');
    }

    const result = await orderService.listCustomerOrders(req.user.id, req.query);
    res.status(200).json({
      success: true,
      data: result.items,
      pagination: result.pagination
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Customer: Get own order details
 */
async function getCustomerOrder(req, res, next) {
  try {
    if (req.user.userType !== 'CUSTOMER') {
      throw new ForbiddenError('Only customers can access customer order details.');
    }

    const order = await orderService.getOrderById(req.params.orderId, req.user.id, null);
    res.status(200).json({
      success: true,
      data: order
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Customer: Cancel order
 */
async function cancelCustomerOrder(req, res, next) {
  try {
    if (req.user.userType !== 'CUSTOMER') {
      throw new ForbiddenError('Only customers can cancel their own orders.');
    }

    const order = await orderService.customerCancelOrder(
      req.params.orderId,
      req.user.id,
      req.body.reason
    );

    res.status(200).json({
      success: true,
      message: 'Order cancelled successfully and inventory restored.',
      data: order
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Seller: List sweet shop orders
 */
async function listSellerOrders(req, res, next) {
  try {
    if (req.user.userType !== 'SELLER') {
      throw new ForbiddenError('Only sweet shop sellers can access seller orders.');
    }

    const result = await orderService.listSellerOrders(req.user.id, req.query);
    res.status(200).json({
      success: true,
      data: result.items,
      pagination: result.pagination
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Seller: Get shop order details
 */
async function getSellerOrder(req, res, next) {
  try {
    if (req.user.userType !== 'SELLER') {
      throw new ForbiddenError('Only sweet shop sellers can access seller orders.');
    }

    const order = await orderService.getOrderById(req.params.orderId, null, req.user.id);
    res.status(200).json({
      success: true,
      data: order
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Seller: Update order status
 */
async function updateSellerOrderStatus(req, res, next) {
  try {
    if (req.user.userType !== 'SELLER') {
      throw new ForbiddenError('Only sweet shop sellers can update order status.');
    }

    const order = await orderService.updateOrderStatus(
      req.params.orderId,
      req.user.id,
      req.body.status,
      req.body.reason
    );

    res.status(200).json({
      success: true,
      message: `Order status updated to "${req.body.status}".`,
      data: order
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  placeOrder,
  listCustomerOrders,
  getCustomerOrder,
  cancelCustomerOrder,
  listSellerOrders,
  getSellerOrder,
  updateSellerOrderStatus
};
