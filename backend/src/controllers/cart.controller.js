/**
 * Shopping Cart & Checkout Controller
 */

const cartService = require('../services/cart.service');
const { ForbiddenError } = require('../middleware/errorHandler');

/**
 * Ensure requesting user is a customer
 */
function getCustomerId(req) {
  if (!req.user || req.user.userType !== 'CUSTOMER') {
    throw new ForbiddenError('Only customer accounts can manage shopping carts and checkout.');
  }
  return req.user.id;
}

async function getCart(req, res, next) {
  try {
    const customerId = getCustomerId(req);
    const cart = await cartService.getCart(customerId);
    res.status(200).json({
      success: true,
      data: cart
    });
  } catch (err) {
    next(err);
  }
}

async function addItem(req, res, next) {
  try {
    const customerId = getCustomerId(req);
    const cart = await cartService.addItemToCart(customerId, req.body);
    res.status(200).json({
      success: true,
      message: 'Product added to cart successfully.',
      data: cart
    });
  } catch (err) {
    next(err);
  }
}

async function updateItem(req, res, next) {
  try {
    const customerId = getCustomerId(req);
    const cart = await cartService.updateItemQuantity(customerId, req.params.itemId, req.body.quantity);
    res.status(200).json({
      success: true,
      message: 'Cart item updated successfully.',
      data: cart
    });
  } catch (err) {
    next(err);
  }
}

async function removeItem(req, res, next) {
  try {
    const customerId = getCustomerId(req);
    const cart = await cartService.removeItem(customerId, req.params.itemId);
    res.status(200).json({
      success: true,
      message: 'Item removed from cart.',
      data: cart
    });
  } catch (err) {
    next(err);
  }
}

async function clearCart(req, res, next) {
  try {
    const customerId = getCustomerId(req);
    const result = await cartService.clearCart(customerId);
    res.status(200).json({
      success: true,
      message: 'Cart cleared successfully.',
      data: result
    });
  } catch (err) {
    next(err);
  }
}

async function validateCheckout(req, res, next) {
  try {
    const customerId = getCustomerId(req);
    const summary = await cartService.validateCheckout(customerId, req.body);
    res.status(200).json({
      success: true,
      data: summary
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getCart,
  addItem,
  updateItem,
  removeItem,
  clearCart,
  validateCheckout
};
