/**
 * Product & Category Catalog Routes
 * 
 * Endpoints:
 * - Categories:
 *   - POST   /api/v1/categories             (Create Category - Seller only)
 *   - GET    /api/v1/categories             (List Categories - Seller or Authenticated Customer)
 *   - GET    /api/v1/categories/:categoryId (Get Category - Seller or Authenticated Customer)
 *   - PATCH  /api/v1/categories/:categoryId (Update Category - Seller only)
 *   - DELETE /api/v1/categories/:categoryId (Delete Category - Seller only)
 * 
 * - Products:
 *   - POST   /api/v1/products               (Create Product - Seller only)
 *   - GET    /api/v1/products               (List Products - Seller, Customer, or Public with query filters)
 *   - GET    /api/v1/products/:productId    (Get Product - Seller or Customer)
 *   - PATCH  /api/v1/products/:productId    (Update Product - Seller only)
 *   - DELETE /api/v1/products/:productId    (Delete Product - Seller only)
 */

const express = require('express');
const Joi = require('joi');
const catalogController = require('../controllers/catalog.controller');
const authenticate = require('../middleware/authenticate');
const { requireRoles, requirePermissions } = require('../middleware/authorize');
const { enforceTenant } = require('../middleware/tenant');
const validate = require('../middleware/validate');

const categoryRouter = express.Router();
const productRouter = express.Router();

// -----------------------------------------------------------------------------
// VALIDATION SCHEMAS
// -----------------------------------------------------------------------------

const createCategorySchema = {
  body: Joi.object({
    name: Joi.string().min(2).max(100).required(),
    description: Joi.string().max(1000).allow(null, '').optional(),
    displayOrder: Joi.number().integer().min(0).optional()
  })
};

const updateCategorySchema = {
  params: Joi.object({
    categoryId: Joi.string().guid().required()
  }),
  body: Joi.object({
    name: Joi.string().min(2).max(100).optional(),
    description: Joi.string().max(1000).allow(null, '').optional(),
    displayOrder: Joi.number().integer().min(0).optional(),
    isActive: Joi.boolean().optional()
  })
};

const getCategorySchema = {
  params: Joi.object({
    categoryId: Joi.string().guid().required()
  })
};

const listCategoriesSchema = {
  query: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    isActive: Joi.boolean().optional(),
    sellerId: Joi.string().guid().optional()
  })
};

const createProductSchema = {
  body: Joi.object({
    name: Joi.string().min(2).max(150).required(),
    description: Joi.string().max(3000).allow(null, '').optional(),
    categoryId: Joi.string().guid().allow(null).optional(),
    price: Joi.number().precision(2).positive().required(),
    stockQuantity: Joi.number().integer().min(0).default(0),
    sku: Joi.string().max(64).allow(null, '').optional(),
    weightPackSize: Joi.string().max(64).allow(null, '').optional(),
    lowStockThreshold: Joi.number().integer().min(0).default(5).optional(),
    imageUrl: Joi.string().max(500).allow(null, '').optional(),
    availabilityStatus: Joi.string().valid('AVAILABLE', 'OUT_OF_STOCK', 'DISCONTINUED').default('AVAILABLE')
  })
};

const updateProductSchema = {
  params: Joi.object({
    productId: Joi.string().guid().required()
  }),
  body: Joi.object({
    name: Joi.string().min(2).max(150).optional(),
    description: Joi.string().max(3000).allow(null, '').optional(),
    categoryId: Joi.string().guid().allow(null).optional(),
    price: Joi.number().precision(2).positive().optional(),
    stockQuantity: Joi.number().integer().min(0).optional(),
    sku: Joi.string().max(64).allow(null, '').optional(),
    weightPackSize: Joi.string().max(64).allow(null, '').optional(),
    lowStockThreshold: Joi.number().integer().min(0).optional(),
    imageUrl: Joi.string().max(500).allow(null, '').optional(),
    availabilityStatus: Joi.string().valid('AVAILABLE', 'OUT_OF_STOCK', 'DISCONTINUED').optional(),
    isActive: Joi.boolean().optional()
  })
};

const getProductSchema = {
  params: Joi.object({
    productId: Joi.string().guid().required()
  })
};

const listProductsSchema = {
  query: Joi.object({
    sellerId: Joi.string().guid().optional(),
    categoryId: Joi.string().guid().optional(),
    search: Joi.string().max(100).optional(),
    availabilityStatus: Joi.string().valid('AVAILABLE', 'OUT_OF_STOCK', 'DISCONTINUED').optional(),
    minPrice: Joi.number().min(0).optional(),
    maxPrice: Joi.number().min(0).optional(),
    isActive: Joi.boolean().optional(),
    sortBy: Joi.string().valid('created_at', 'price', 'name', 'stock_quantity').default('created_at'),
    sortOrder: Joi.string().valid('asc', 'desc', 'ASC', 'DESC').default('DESC'),
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20)
  })
};

const adjustStockSchema = {
  params: Joi.object({
    productId: Joi.string().guid().required()
  }),
  body: Joi.object({
    quantityChange: Joi.number().integer().optional(),
    newQuantity: Joi.number().integer().min(0).optional(),
    reason: Joi.string().valid('RESTOCK', 'DAMAGE', 'RETURN', 'MANUAL_CORRECTION', 'ORDER_DEDUCTION').default('MANUAL_CORRECTION'),
    notes: Joi.string().max(255).allow(null, '').optional()
  }).or('quantityChange', 'newQuantity')
};

// -----------------------------------------------------------------------------
// CATEGORY ROUTES
// -----------------------------------------------------------------------------

// List categories: Accessible by Seller (own) or Customer / Guest (with sellerId query)
categoryRouter.get(
  '/',
  authenticate.optional,
  validate(listCategoriesSchema),
  catalogController.listCategories
);

categoryRouter.get(
  '/:categoryId',
  authenticate.optional,
  validate(getCategorySchema),
  catalogController.getCategory
);

// Management routes: Strictly SELLER only (holding manage_shop_catalog)
categoryRouter.post(
  '/',
  authenticate,
  requireRoles('SELLER'),
  requirePermissions('manage_shop_catalog'),
  validate(createCategorySchema),
  catalogController.createCategory
);

categoryRouter.patch(
  '/:categoryId',
  authenticate,
  requireRoles('SELLER'),
  requirePermissions('manage_shop_catalog'),
  validate(updateCategorySchema),
  catalogController.updateCategory
);

categoryRouter.delete(
  '/:categoryId',
  authenticate,
  requireRoles('SELLER'),
  requirePermissions('manage_shop_catalog'),
  validate(getCategorySchema),
  catalogController.deleteCategory
);

// -----------------------------------------------------------------------------
// PRODUCT ROUTES
// -----------------------------------------------------------------------------

// List products: Accessible by Public, Customer, Seller, or Platform Staff
productRouter.get(
  '/',
  authenticate.optional,
  validate(listProductsSchema),
  catalogController.listProducts
);

productRouter.get(
  '/:productId',
  authenticate.optional,
  validate(getProductSchema),
  catalogController.getProduct
);

// Management routes: Strictly SELLER only (holding manage_shop_catalog)
productRouter.post(
  '/',
  authenticate,
  requireRoles('SELLER'),
  requirePermissions('manage_shop_catalog'),
  validate(createProductSchema),
  catalogController.createProduct
);

productRouter.patch(
  '/:productId',
  authenticate,
  requireRoles('SELLER'),
  requirePermissions('manage_shop_catalog'),
  validate(updateProductSchema),
  catalogController.updateProduct
);

productRouter.patch(
  '/:productId/inventory',
  authenticate,
  requireRoles('SELLER'),
  requirePermissions('manage_shop_catalog'),
  validate(adjustStockSchema),
  catalogController.adjustStock
);

productRouter.delete(
  '/:productId',
  authenticate,
  requireRoles('SELLER'),
  requirePermissions('manage_shop_catalog'),
  validate(getProductSchema),
  catalogController.deleteProduct
);

module.exports = {
  categoryRouter,
  productRouter
};
