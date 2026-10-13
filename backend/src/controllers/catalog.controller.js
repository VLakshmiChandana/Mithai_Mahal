/**
 * Product & Category Controllers
 * 
 * Handlers for:
 * - /api/v1/categories (Seller management & Public/Customer browsing)
 * - /api/v1/products   (Seller management & Public/Customer browsing)
 */

const catalogService = require('../services/catalog.service');
const { ForbiddenError } = require('../middleware/errorHandler');

/**
 * Helper to determine effective seller ID for catalog operations
 * - SELLER: req.user.id
 * - CUSTOMER: req.user.sellerId
 * - Staff or Public: req.query.sellerId or req.params.sellerId
 */
function resolveSellerId(req) {
  if (req.user) {
    if (req.user.userType === 'SELLER') {
      return req.user.id;
    }
    if (req.user.userType === 'CUSTOMER') {
      return req.query.sellerId || req.user.sellerId || null;
    }
  }
  return req.tenantId || req.query.sellerId || req.params.sellerId || null;
}

// -----------------------------------------------------------------------------
// CATEGORY CONTROLLERS
// -----------------------------------------------------------------------------

async function createCategory(req, res, next) {
  try {
    const sellerId = resolveSellerId(req);
    if (!sellerId) {
      throw new ForbiddenError('Seller tenant context is required to create a category.');
    }

    const category = await catalogService.createCategory(sellerId, req.body);
    res.status(201).json({
      success: true,
      message: 'Product category created successfully.',
      data: category
    });
  } catch (err) {
    next(err);
  }
}

async function listCategories(req, res, next) {
  try {
    const sellerId = resolveSellerId(req);
    if (!sellerId) {
      throw new ForbiddenError('Seller tenant context is required to view categories.');
    }

    const { page, limit, isActive } = req.query;
    const result = await catalogService.listCategories(sellerId, { page, limit, isActive });
    res.status(200).json({
      success: true,
      data: result.items,
      pagination: result.pagination
    });
  } catch (err) {
    next(err);
  }
}

async function getCategory(req, res, next) {
  try {
    const sellerId = req.user && req.user.userType === 'SELLER' ? req.user.id : (req.query.sellerId || null);
    const category = await catalogService.getCategoryById(req.params.categoryId, sellerId);
    res.status(200).json({
      success: true,
      data: category
    });
  } catch (err) {
    next(err);
  }
}

async function updateCategory(req, res, next) {
  try {
    const sellerId = resolveSellerId(req);
    if (!sellerId) {
      throw new ForbiddenError('Seller tenant context is required to update a category.');
    }

    const updated = await catalogService.updateCategory(req.params.categoryId, sellerId, req.body);
    res.status(200).json({
      success: true,
      message: 'Product category updated successfully.',
      data: updated
    });
  } catch (err) {
    next(err);
  }
}

async function deleteCategory(req, res, next) {
  try {
    const sellerId = resolveSellerId(req);
    if (!sellerId) {
      throw new ForbiddenError('Seller tenant context is required to delete a category.');
    }

    const result = await catalogService.deleteCategory(req.params.categoryId, sellerId);
    res.status(200).json({
      success: true,
      message: 'Product category deleted successfully.',
      data: result
    });
  } catch (err) {
    next(err);
  }
}

// -----------------------------------------------------------------------------
// PRODUCT CONTROLLERS
// -----------------------------------------------------------------------------

async function createProduct(req, res, next) {
  try {
    const sellerId = resolveSellerId(req);
    if (!sellerId) {
      throw new ForbiddenError('Seller tenant context is required to create a sweet product.');
    }

    const product = await catalogService.createProduct(sellerId, req.body);
    res.status(201).json({
      success: true,
      message: 'Sweet product created successfully.',
      data: product
    });
  } catch (err) {
    next(err);
  }
}

async function listProducts(req, res, next) {
  try {
    const sellerId = resolveSellerId(req);

    const {
      categoryId,
      search,
      availabilityStatus,
      minPrice,
      maxPrice,
      isActive,
      sortBy,
      sortOrder,
      page,
      limit
    } = req.query;

    const result = await catalogService.listProducts({
      sellerId,
      categoryId,
      search,
      availabilityStatus,
      minPrice,
      maxPrice,
      isActive,
      sortBy,
      sortOrder,
      page,
      limit
    });

    res.status(200).json({
      success: true,
      data: result.items,
      pagination: result.pagination
    });
  } catch (err) {
    next(err);
  }
}

async function getProduct(req, res, next) {
  try {
    const sellerId = req.user && req.user.userType === 'SELLER' ? req.user.id : null;
    const product = await catalogService.getProductById(req.params.productId, sellerId);
    res.status(200).json({
      success: true,
      data: product
    });
  } catch (err) {
    next(err);
  }
}

async function updateProduct(req, res, next) {
  try {
    const sellerId = resolveSellerId(req);
    if (!sellerId) {
      throw new ForbiddenError('Seller tenant context is required to update a product.');
    }

    const updated = await catalogService.updateProduct(req.params.productId, sellerId, req.body);
    res.status(200).json({
      success: true,
      message: 'Sweet product updated successfully.',
      data: updated
    });
  } catch (err) {
    next(err);
  }
}

async function deleteProduct(req, res, next) {
  try {
    const sellerId = resolveSellerId(req);
    if (!sellerId) {
      throw new ForbiddenError('Seller tenant context is required to delete a product.');
    }

    const result = await catalogService.deleteProduct(req.params.productId, sellerId);
    res.status(200).json({
      success: true,
      message: 'Sweet product deleted successfully.',
      data: result
    });
  } catch (err) {
    next(err);
  }
}

async function adjustStock(req, res, next) {
  try {
    const sellerId = resolveSellerId(req);
    if (!sellerId) {
      throw new ForbiddenError('Seller tenant context is required to adjust product stock.');
    }

    const { quantityChange, newQuantity, reason, notes } = req.body;
    const result = await catalogService.adjustStock(req.params.productId, sellerId, {
      quantityChange,
      newQuantity,
      reason,
      notes,
      actorId: req.user.id,
      actorType: req.user.userType
    });

    res.status(200).json({
      success: true,
      message: 'Product stock adjusted successfully.',
      data: result
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  createCategory,
  listCategories,
  getCategory,
  updateCategory,
  deleteCategory,
  createProduct,
  listProducts,
  getProduct,
  updateProduct,
  adjustStock,
  deleteProduct
};
