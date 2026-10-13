/**
 * Delivery Address Controller
 */

const addressService = require('../services/address.service');
const { ForbiddenError } = require('../middleware/errorHandler');

function getCustomerId(req) {
  if (!req.user || req.user.userType !== 'CUSTOMER') {
    throw new ForbiddenError('Only customer accounts can manage delivery addresses.');
  }
  return req.user.id;
}

async function listAddresses(req, res, next) {
  try {
    const customerId = getCustomerId(req);
    const addresses = await addressService.listAddresses(customerId);
    res.status(200).json({
      success: true,
      data: addresses
    });
  } catch (err) {
    next(err);
  }
}

async function getAddress(req, res, next) {
  try {
    const customerId = getCustomerId(req);
    const address = await addressService.getAddressById(req.params.addressId, customerId);
    res.status(200).json({
      success: true,
      data: address
    });
  } catch (err) {
    next(err);
  }
}

async function createAddress(req, res, next) {
  try {
    const customerId = getCustomerId(req);
    const address = await addressService.createAddress(customerId, req.body);
    res.status(201).json({
      success: true,
      message: 'Delivery address added successfully.',
      data: address
    });
  } catch (err) {
    next(err);
  }
}

async function updateAddress(req, res, next) {
  try {
    const customerId = getCustomerId(req);
    const address = await addressService.updateAddress(req.params.addressId, customerId, req.body);
    res.status(200).json({
      success: true,
      message: 'Delivery address updated successfully.',
      data: address
    });
  } catch (err) {
    next(err);
  }
}

async function deleteAddress(req, res, next) {
  try {
    const customerId = getCustomerId(req);
    const result = await addressService.deleteAddress(req.params.addressId, customerId);
    res.status(200).json({
      success: true,
      message: 'Delivery address deleted successfully.',
      data: result
    });
  } catch (err) {
    next(err);
  }
}

async function setDefaultAddress(req, res, next) {
  try {
    const customerId = getCustomerId(req);
    const address = await addressService.setDefaultAddress(req.params.addressId, customerId);
    res.status(200).json({
      success: true,
      message: 'Default delivery address set successfully.',
      data: address
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listAddresses,
  getAddress,
  createAddress,
  updateAddress,
  deleteAddress,
  setDefaultAddress
};
