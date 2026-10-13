/**
 * Product & Category Service
 * 
 * Business logic for:
 * - Product Categories: Create, Read (paginated/filtered), Update, Delete
 * - Products: Create, Read (paginated/filtered/searched), Update, Delete
 * 
 * Enforces:
 * - Seller tenant isolation (seller_id parameter verified from req.tenantId / authenticated context)
 * - Safe stock and price validation
 * - Foreign key integrity (category must belong to same seller)
 */

const { pool } = require('../config/db');
const { AppError, NotFoundError, ForbiddenError, ValidationError } = require('../middleware/errorHandler');

/**
 * -----------------------------------------------------------------------------
 * CATEGORY SERVICES
 * -----------------------------------------------------------------------------
 */

/**
 * Create a new product category for a sweet shop
 * @param {string} sellerId 
 * @param {Object} data 
 */
async function createCategory(sellerId, { name, description = null, displayOrder = 0 }) {
  const trimmedName = name.trim();

  // Check unique category name within this seller
  const [existing] = await pool.query(
    'SELECT id FROM product_categories WHERE seller_id = ? AND name = ? LIMIT 1;',
    [sellerId, trimmedName]
  );

  if (existing.length > 0) {
    throw new AppError('A category with this name already exists for your sweet shop.', 409, 'CONFLICT');
  }

  const [insertRes] = await pool.query(
    `INSERT INTO product_categories (
      id, seller_id, name, description, display_order, is_active
    ) VALUES (
      UUID(), ?, ?, ?, ?, TRUE
    );`,
    [sellerId, trimmedName, description, displayOrder]
  );

  const [created] = await pool.query(
    'SELECT id, seller_id, name, description, display_order, is_active, created_at, updated_at FROM product_categories WHERE seller_id = ? AND name = ?;',
    [sellerId, trimmedName]
  );

  return created[0];
}

/**
 * List categories for a sweet shop with pagination and active filter
 */
async function listCategories(sellerId, { page = 1, limit = 20, isActive = null }) {
  const offset = (page - 1) * limit;
  const conditions = ['seller_id = ?'];
  const params = [sellerId];

  if (isActive !== null && isActive !== undefined) {
    conditions.push('is_active = ?');
    params.push(isActive === true || isActive === 'true' ? 1 : 0);
  }

  const whereClause = `WHERE ${conditions.join(' AND ')}`;

  const [countRows] = await pool.query(
    `SELECT COUNT(*) as total FROM product_categories ${whereClause};`,
    params
  );
  const total = countRows[0].total;

  const [rows] = await pool.query(
    `SELECT id, seller_id, name, description, display_order, is_active, created_at, updated_at 
     FROM product_categories 
     ${whereClause} 
     ORDER BY display_order ASC, name ASC 
     LIMIT ? OFFSET ?;`,
    [...params, Number(limit), Number(offset)]
  );

  return {
    items: rows,
    pagination: {
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / limit)
    }
  };
}

/**
 * Get category by ID with tenant verification
 */
async function getCategoryById(categoryId, sellerId = null) {
  const query = sellerId
    ? 'SELECT * FROM product_categories WHERE id = ? AND seller_id = ? LIMIT 1;'
    : 'SELECT * FROM product_categories WHERE id = ? LIMIT 1;';
  const params = sellerId ? [categoryId, sellerId] : [categoryId];

  const [rows] = await pool.query(query, params);
  if (rows.length === 0) {
    throw new NotFoundError('Product category not found.');
  }

  return rows[0];
}

/**
 * Update category with tenant ownership guard
 */
async function updateCategory(categoryId, sellerId, updates) {
  const existing = await getCategoryById(categoryId, sellerId);

  const fields = [];
  const params = [];

  if (updates.name !== undefined) {
    const trimmed = updates.name.trim();
    if (trimmed !== existing.name) {
      // Check duplicate name
      const [dup] = await pool.query(
        'SELECT id FROM product_categories WHERE seller_id = ? AND name = ? AND id != ? LIMIT 1;',
        [sellerId, trimmed, categoryId]
      );
      if (dup.length > 0) {
        throw new AppError('Another category already exists with this name.', 409, 'CONFLICT');
      }
    }
    fields.push('name = ?');
    params.push(trimmed);
  }

  if (updates.description !== undefined) {
    fields.push('description = ?');
    params.push(updates.description);
  }

  if (updates.displayOrder !== undefined) {
    fields.push('display_order = ?');
    params.push(updates.displayOrder);
  }

  if (updates.isActive !== undefined) {
    fields.push('is_active = ?');
    params.push(updates.isActive ? 1 : 0);
  }

  if (fields.length === 0) {
    return existing;
  }

  params.push(categoryId, sellerId);
  await pool.query(
    `UPDATE product_categories SET ${fields.join(', ')} WHERE id = ? AND seller_id = ?;`,
    params
  );

  return getCategoryById(categoryId, sellerId);
}

/**
 * Delete category (Soft delete or delete with check)
 */
async function deleteCategory(categoryId, sellerId) {
  await getCategoryById(categoryId, sellerId);

  // When deleting a category, associated products have category_id SET NULL via FK
  await pool.query(
    'DELETE FROM product_categories WHERE id = ? AND seller_id = ?;',
    [categoryId, sellerId]
  );

  return { deleted: true, id: categoryId };
}


/**
 * -----------------------------------------------------------------------------
 * PRODUCT SERVICES
 * -----------------------------------------------------------------------------
 */

/**
 * Create a new sweet product
 */
async function createProduct(sellerId, data) {
  const {
    name,
    description = null,
    categoryId = null,
    price,
    stockQuantity = 0,
    imageUrl = null,
    availabilityStatus = 'AVAILABLE',
    sku = null,
    weightPackSize = null,
    lowStockThreshold = 5
  } = data;

  // Enforce Seller Verification & Active status
  const [sellerRows] = await pool.query(
    'SELECT account_status, verification_status FROM sellers WHERE id = ? LIMIT 1;',
    [sellerId]
  );
  if (sellerRows.length === 0) {
    throw new NotFoundError('Sweet shop seller not found.');
  }

  const seller = sellerRows[0];
  if (seller.account_status === 'SUSPENDED' || seller.account_status === 'TERMINATED') {
    throw new ForbiddenError(
      `Suspended seller accounts cannot publish products (${seller.account_status}).`
    );
  }

  // If categoryId is specified, ensure it belongs to this seller
  if (categoryId) {
    const [cat] = await pool.query(
      'SELECT id FROM product_categories WHERE id = ? AND seller_id = ? LIMIT 1;',
      [categoryId, sellerId]
    );
    if (cat.length === 0) {
      throw new ValidationError('Provided category does not exist in your sweet shop catalog.');
    }
  }

  const productId = require('crypto').randomUUID();

  await pool.query(
    `INSERT INTO products (
      id, seller_id, category_id, name, description, price, 
      stock_quantity, image_url, availability_status, sku, weight_pack_size, low_stock_threshold, is_active
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, TRUE
    );`,
    [
      productId,
      sellerId,
      categoryId || null,
      name.trim(),
      description,
      Number(price).toFixed(2),
      Math.max(0, parseInt(stockQuantity, 10)),
      imageUrl,
      availabilityStatus,
      sku ? sku.trim() : null,
      weightPackSize ? weightPackSize.trim() : null,
      parseInt(lowStockThreshold, 10) || 5
    ]
  );

  const [created] = await pool.query(
    `SELECT p.*, c.name as category_name 
     FROM products p 
     LEFT JOIN product_categories c ON p.category_id = c.id 
     WHERE p.id = ?;`,
    [productId]
  );

  return created[0];
}

/**
 * List products with filtering (category, search, availability, min/max price) and pagination
 */
async function listProducts({
  sellerId = null,
  categoryId = null,
  search = null,
  availabilityStatus = null,
  minPrice = null,
  maxPrice = null,
  isActive = null,
  sortBy = 'created_at',
  sortOrder = 'DESC',
  page = 1,
  limit = 20
}) {
  const conditions = [];
  const params = [];

  if (sellerId) {
    conditions.push('p.seller_id = ?');
    params.push(sellerId);
  }

  if (categoryId) {
    conditions.push('p.category_id = ?');
    params.push(categoryId);
  }

  if (availabilityStatus) {
    conditions.push('p.availability_status = ?');
    params.push(availabilityStatus);
  }

  if (isActive !== null && isActive !== undefined) {
    conditions.push('p.is_active = ?');
    params.push(isActive === true || isActive === 'true' ? 1 : 0);
  }

  if (minPrice !== null && minPrice !== undefined) {
    conditions.push('p.price >= ?');
    params.push(Number(minPrice));
  }

  if (maxPrice !== null && maxPrice !== undefined) {
    conditions.push('p.price <= ?');
    params.push(Number(maxPrice));
  }

  if (search && search.trim()) {
    conditions.push('(p.name LIKE ? OR p.description LIKE ?)');
    const term = `%${search.trim()}%`;
    params.push(term, term);
  }

  // Ensure products are only listed for active, non-suspended sellers
  conditions.push("s.is_active = TRUE AND s.account_status != 'SUSPENDED' AND s.account_status != 'TERMINATED'");

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Count total matching
  const [countRows] = await pool.query(
    `SELECT COUNT(*) as total 
     FROM products p 
     JOIN sellers s ON p.seller_id = s.id 
     ${whereClause};`,
    params
  );
  const total = countRows[0].total;

  // Sorting whitelist
  const allowedSortCols = {
    created_at: 'p.created_at',
    price: 'p.price',
    name: 'p.name',
    stock_quantity: 'p.stock_quantity'
  };
  const sortCol = allowedSortCols[sortBy] || 'p.created_at';
  const order = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

  const offset = (Number(page) - 1) * Number(limit);

  const [items] = await pool.query(
    `SELECT p.id, p.seller_id, p.category_id, c.name as category_name,
            p.name, p.description, p.price, p.stock_quantity, p.image_url,
            p.availability_status, p.sku, p.weight_pack_size, p.low_stock_threshold,
            p.is_active, p.created_at, p.updated_at,
            s.business_name as seller_business_name
     FROM products p
     LEFT JOIN product_categories c ON p.category_id = c.id
     JOIN sellers s ON p.seller_id = s.id
     ${whereClause}
     ORDER BY ${sortCol} ${order}
     LIMIT ? OFFSET ?;`,
    [...params, Number(limit), Number(offset)]
  );

  return {
    items,
    pagination: {
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / Number(limit))
    }
  };
}

/**
 * Get product by ID with optional tenant check
 */
async function getProductById(productId, sellerId = null) {
  const query = `
    SELECT p.id, p.seller_id, p.category_id, c.name as category_name,
           p.name, p.description, p.price, p.stock_quantity, p.image_url,
           p.availability_status, p.is_active, p.created_at, p.updated_at,
           s.business_name as seller_business_name
    FROM products p
    LEFT JOIN product_categories c ON p.category_id = c.id
    JOIN sellers s ON p.seller_id = s.id
    WHERE p.id = ? ${sellerId ? 'AND p.seller_id = ?' : ''}
    LIMIT 1;
  `;
  const params = sellerId ? [productId, sellerId] : [productId];

  const [rows] = await pool.query(query, params);
  if (rows.length === 0) {
    throw new NotFoundError('Sweet product not found.');
  }

  return rows[0];
}

/**
 * Update product with tenant ownership check
 */
async function updateProduct(productId, sellerId, updates) {
  // First check product exists and belongs to this seller
  const existing = await getProductById(productId, sellerId);

  // If activating or setting to AVAILABLE, check seller approval
  if (updates.isActive === true || updates.availabilityStatus === 'AVAILABLE') {
    const [sellerRows] = await pool.query(
      'SELECT account_status, verification_status FROM sellers WHERE id = ? LIMIT 1;',
      [sellerId]
    );
    if (sellerRows.length > 0) {
      const seller = sellerRows[0];
      if (seller.account_status === 'SUSPENDED' || seller.account_status === 'TERMINATED') {
        throw new ForbiddenError(
          `Cannot publish or make product active while seller account is suspended (${seller.account_status}).`
        );
      }
    }
  }

  const fields = [];
  const params = [];

  if (updates.name !== undefined) {
    fields.push('name = ?');
    params.push(updates.name.trim());
  }

  if (updates.description !== undefined) {
    fields.push('description = ?');
    params.push(updates.description);
  }

  if (updates.categoryId !== undefined) {
    if (updates.categoryId) {
      // Verify category belongs to this seller
      const [cat] = await pool.query(
        'SELECT id FROM product_categories WHERE id = ? AND seller_id = ? LIMIT 1;',
        [updates.categoryId, sellerId]
      );
      if (cat.length === 0) {
        throw new ValidationError('Provided category does not exist in your sweet shop catalog.');
      }
    }
    fields.push('category_id = ?');
    params.push(updates.categoryId || null);
  }

  if (updates.price !== undefined) {
    fields.push('price = ?');
    params.push(Number(updates.price).toFixed(2));
  }

  if (updates.sku !== undefined) {
    fields.push('sku = ?');
    params.push(updates.sku ? updates.sku.trim() : null);
  }

  if (updates.weightPackSize !== undefined) {
    fields.push('weight_pack_size = ?');
    params.push(updates.weightPackSize ? updates.weightPackSize.trim() : null);
  }

  if (updates.lowStockThreshold !== undefined) {
    fields.push('low_stock_threshold = ?');
    params.push(parseInt(updates.lowStockThreshold, 10) || 5);
  }

  if (updates.stockQuantity !== undefined) {
    const stock = Math.max(0, parseInt(updates.stockQuantity, 10));
    fields.push('stock_quantity = ?');
    params.push(stock);

    // If stock reaches 0 and status is AVAILABLE, automatically suggest OUT_OF_STOCK unless overridden
    if (stock === 0 && updates.availabilityStatus === undefined && existing.availability_status === 'AVAILABLE') {
      fields.push('availability_status = ?');
      params.push('OUT_OF_STOCK');
    }
  }

  if (updates.imageUrl !== undefined) {
    fields.push('image_url = ?');
    params.push(updates.imageUrl);
  }

  if (updates.availabilityStatus !== undefined) {
    fields.push('availability_status = ?');
    params.push(updates.availabilityStatus);
  }

  if (updates.isActive !== undefined) {
    fields.push('is_active = ?');
    params.push(updates.isActive ? 1 : 0);
  }

  if (fields.length === 0) {
    return existing;
  }

  params.push(productId, sellerId);
  await pool.query(
    `UPDATE products SET ${fields.join(', ')} WHERE id = ? AND seller_id = ?;`,
    params
  );

  return getProductById(productId, sellerId);
}

/**
 * Adjust stock quantity with audit logging
 */
async function adjustStock(productId, sellerId, { quantityChange, newQuantity, reason = 'MANUAL_CORRECTION', notes = null, actorId, actorType = 'SELLER' }) {
  const existing = await getProductById(productId, sellerId);
  const currentStock = parseInt(existing.stock_quantity, 10);

  let targetStock;
  let change;

  if (newQuantity !== undefined && newQuantity !== null) {
    targetStock = Math.max(0, parseInt(newQuantity, 10));
    change = targetStock - currentStock;
  } else if (quantityChange !== undefined && quantityChange !== null) {
    change = parseInt(quantityChange, 10);
    targetStock = Math.max(0, currentStock + change);
  } else {
    throw new ValidationError('Either newQuantity or quantityChange must be provided.');
  }

  await pool.query(
    `UPDATE products 
     SET stock_quantity = ?, 
         availability_status = CASE WHEN ? = 0 THEN 'OUT_OF_STOCK' ELSE availability_status END 
     WHERE id = ? AND seller_id = ?;`,
    [targetStock, targetStock, productId, sellerId]
  );

  const adjustmentId = require('crypto').randomUUID();
  await pool.query(
    `INSERT INTO inventory_adjustments (
      id, product_id, seller_id, previous_quantity, new_quantity, quantity_change, reason, actor_id, actor_type, notes
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
    );`,
    [adjustmentId, productId, sellerId, currentStock, targetStock, change, reason, actorId || sellerId, actorType, notes]
  );

  return {
    productId,
    previousQuantity: currentStock,
    newQuantity: targetStock,
    quantityChange: change,
    reason,
    notes
  };
}

/**
 * Delete product with tenant check
 */
async function deleteProduct(productId, sellerId) {
  await getProductById(productId, sellerId);

  await pool.query(
    'DELETE FROM products WHERE id = ? AND seller_id = ?;',
    [productId, sellerId]
  );

  return { deleted: true, id: productId };
}

module.exports = {
  createCategory,
  listCategories,
  getCategoryById,
  updateCategory,
  deleteCategory,
  createProduct,
  listProducts,
  getProductById,
  updateProduct,
  adjustStock,
  deleteProduct
};
