/**
 * Shopping Cart & Checkout Validation Service
 * 
 * Core business rules:
 * 1. Single Sweet Shop Rule:
 *    - A customer cart can contain products from only one sweet shop at a time.
 *    - If a customer attempts to add a sweet from a different sweet shop:
 *      * Returns 409 Conflict with error code 'CROSS_SHOP_CART_CONFLICT'
 *      * Supports `clearAndReplace=true` flag in the request body to atomically clear the existing cart and initiate the new shop's basket.
 * 2. Real-Time Price Calculation:
 *    - Totals, taxes, and item prices are ALWAYS calculated from the live MySQL database (`products.price`).
 *    - Client-supplied prices and totals are completely ignored to prevent price manipulation attacks.
 * 3. Checkout Validation (Without Reserving or Deducting Stock):
 *    - Verifies product existence, availability status (`AVAILABLE`), stock adequacy, and seller active status.
 *    - Verifies valid delivery address ownership if addressId is provided.
 *    - Returns comprehensive price breakdown (subtotal, packaging charge, estimated delivery fee, GST, grand total).
 */

const { pool } = require('../config/db');
const { AppError, NotFoundError, ValidationError, ForbiddenError } = require('../middleware/errorHandler');

/**
 * Get active cart for a customer with live product prices, calculated subtotal, and seller info
 */
async function getCart(userId) {
  // 1. Fetch or initialize cart
  const [cartRows] = await pool.query(
    `SELECT c.id, c.user_id, c.seller_id, c.created_at, c.updated_at,
            s.business_name as seller_business_name
     FROM shopping_carts c
     JOIN sellers s ON c.seller_id = s.id
     WHERE c.user_id = ?
     LIMIT 1;`,
    [userId]
  );

  if (cartRows.length === 0) {
    return {
      cartId: null,
      sellerId: null,
      sellerName: null,
      items: [],
      itemCount: 0,
      subtotal: '0.00',
      estimatedTax: '0.00',
      estimatedTotal: '0.00'
    };
  }

  const cart = cartRows[0];

  // 2. Fetch cart items joined with live products table
  const [itemRows] = await pool.query(
    `SELECT ci.id as item_id, ci.product_id, ci.quantity,
            p.name as product_name, p.price as unit_price, p.stock_quantity,
            p.image_url, p.availability_status, p.is_active,
            ROUND(p.price * ci.quantity, 2) as item_total
     FROM cart_items ci
     JOIN products p ON ci.product_id = p.id
     WHERE ci.cart_id = ?
     ORDER BY ci.created_at ASC;`,
    [cart.id]
  );

  // 3. Compute live totals
  let subtotal = 0;
  let totalItems = 0;

  for (const item of itemRows) {
    const price = Number(item.unit_price);
    const qty = Number(item.quantity);
    subtotal += price * qty;
    totalItems += qty;
  }

  // 5% standard GST on confectioneries / sweets
  const estimatedTax = (subtotal * 0.05);
  const estimatedTotal = (subtotal + estimatedTax);

  return {
    cartId: cart.id,
    sellerId: cart.seller_id,
    sellerName: cart.seller_business_name,
    items: itemRows,
    itemCount: totalItems,
    subtotal: subtotal.toFixed(2),
    estimatedTax: estimatedTax.toFixed(2),
    estimatedTotal: estimatedTotal.toFixed(2)
  };
}

/**
 * Add a sweet product to the customer's cart
 * 
 * Enforces Single Sweet Shop policy:
 * - If cart exists for another shop, throws 409 Conflict unless clearAndReplace=true
 */
async function addItemToCart(userId, { productId, quantity = 1, clearAndReplace = false }) {
  const qty = parseInt(quantity, 10);
  if (qty <= 0) {
    throw new ValidationError('Quantity must be greater than zero.');
  }

  // 1. Fetch live product and its seller
  const [prodRows] = await pool.query(
    `SELECT p.id, p.seller_id, p.name, p.price, p.stock_quantity, p.availability_status, p.is_active,
            s.business_name as seller_name, s.account_status as seller_status, s.is_active as seller_active,
            s.verification_status as seller_verification
     FROM products p
     JOIN sellers s ON p.seller_id = s.id
     WHERE p.id = ?
     LIMIT 1;`,
    [productId]
  );

  if (prodRows.length === 0) {
    throw new NotFoundError('Sweet product not found.');
  }

  const product = prodRows[0];

  if (!product.seller_active || product.seller_status !== 'ACTIVE' || product.seller_verification !== 'APPROVED') {
    throw new ValidationError(
      `The sweet shop "${product.seller_name}" is currently suspended or inactive and cannot accept cart orders.`
    );
  }

  if (!product.is_active || product.availability_status !== 'AVAILABLE') {
    throw new ValidationError(`"${product.name}" is currently unavailable.`);
  }

  if (product.stock_quantity < qty) {
    throw new ValidationError(
      `Insufficient stock for "${product.name}". Requested: ${qty}, Available: ${product.stock_quantity}.`
    );
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // 2. Check if customer already has an active cart
    const [existingCartRows] = await connection.query(
      'SELECT id, seller_id FROM shopping_carts WHERE user_id = ? LIMIT 1;',
      [userId]
    );

    let cartId;

    if (existingCartRows.length > 0) {
      const currentCart = existingCartRows[0];

      // Single Sweet Shop Rule Enforcement:
      if (currentCart.seller_id !== product.seller_id) {
        if (!clearAndReplace) {
          const [currentShop] = await connection.query(
            'SELECT business_name FROM sellers WHERE id = ?;',
            [currentCart.seller_id]
          );
          const currentShopName = currentShop.length > 0 ? currentShop[0].business_name : 'another sweet shop';

          throw new AppError(
            `Your cart contains items from "${currentShopName}". You can only order from one sweet shop at a time. Send "clearAndReplace: true" to clear current cart and start with "${product.seller_name}".`,
            409,
            'CROSS_SHOP_CART_CONFLICT'
          );
        }

        // Customer requested clearAndReplace: clear items and switch cart to new sweet shop
        await connection.query('DELETE FROM cart_items WHERE cart_id = ?;', [currentCart.id]);
        await connection.query(
          'UPDATE shopping_carts SET seller_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?;',
          [product.seller_id, currentCart.id]
        );
        cartId = currentCart.id;
      } else {
        cartId = currentCart.id;
      }
    } else {
      // Create new cart for this customer and seller
      await connection.query(
        'INSERT INTO shopping_carts (id, user_id, seller_id) VALUES (UUID(), ?, ?);',
        [userId, product.seller_id]
      );
      const [newCart] = await connection.query(
        'SELECT id FROM shopping_carts WHERE user_id = ? LIMIT 1;',
        [userId]
      );
      cartId = newCart[0].id;
    }

    // 3. Upsert product item in cart
    const [existingItemRows] = await connection.query(
      'SELECT id, quantity FROM cart_items WHERE cart_id = ? AND product_id = ? LIMIT 1;',
      [cartId, productId]
    );

    if (existingItemRows.length > 0) {
      const newQty = existingItemRows[0].quantity + qty;
      if (product.stock_quantity < newQty) {
        throw new ValidationError(
          `Cannot add ${qty} more. Total in cart would be ${newQty}, but only ${product.stock_quantity} are in stock.`
        );
      }
      await connection.query(
        'UPDATE cart_items SET quantity = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?;',
        [newQty, existingItemRows[0].id]
      );
    } else {
      await connection.query(
        'INSERT INTO cart_items (id, cart_id, product_id, quantity) VALUES (UUID(), ?, ?, ?);',
        [cartId, productId, qty]
      );
    }

    await connection.commit();
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }

  return getCart(userId);
}

/**
 * Update quantity of a specific item in the customer's cart
 */
async function updateItemQuantity(userId, itemId, quantity) {
  const qty = parseInt(quantity, 10);
  if (qty < 0) {
    throw new ValidationError('Quantity must be zero or greater.');
  }

  // 1. Verify item belongs to customer's cart
  const [rows] = await pool.query(
    `SELECT ci.id, ci.cart_id, ci.product_id, p.name as product_name, p.stock_quantity, p.availability_status
     FROM cart_items ci
     JOIN shopping_carts c ON ci.cart_id = c.id
     JOIN products p ON ci.product_id = p.id
     WHERE ci.id = ? AND c.user_id = ?
     LIMIT 1;`,
    [itemId, userId]
  );

  if (rows.length === 0) {
    throw new NotFoundError('Cart item not found or does not belong to your cart.');
  }

  const item = rows[0];

  if (qty === 0) {
    // Setting to 0 removes the item
    await pool.query('DELETE FROM cart_items WHERE id = ?;', [itemId]);
    return getCart(userId);
  }

  // Validate live stock
  if (item.stock_quantity < qty) {
    throw new ValidationError(
      `Cannot set quantity to ${qty}. Only ${item.stock_quantity} available in stock.`
    );
  }

  await pool.query(
    'UPDATE cart_items SET quantity = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?;',
    [qty, itemId]
  );

  return getCart(userId);
}

/**
 * Remove an item from the customer's cart
 */
async function removeItem(userId, itemId) {
  const [rows] = await pool.query(
    `SELECT ci.id, ci.cart_id
     FROM cart_items ci
     JOIN shopping_carts c ON ci.cart_id = c.id
     WHERE ci.id = ? AND c.user_id = ?
     LIMIT 1;`,
    [itemId, userId]
  );

  if (rows.length === 0) {
    throw new NotFoundError('Cart item not found or does not belong to your cart.');
  }

  await pool.query('DELETE FROM cart_items WHERE id = ?;', [itemId]);
  return getCart(userId);
}

/**
 * Clear all items from customer's cart
 */
async function clearCart(userId) {
  const [cart] = await pool.query(
    'SELECT id FROM shopping_carts WHERE user_id = ? LIMIT 1;',
    [userId]
  );

  if (cart.length > 0) {
    await pool.query('DELETE FROM cart_items WHERE cart_id = ?;', [cart[0].id]);
    await pool.query('DELETE FROM shopping_carts WHERE id = ?;', [cart[0].id]);
  }

  return { cleared: true };
}

/**
 * Validate checkout readiness
 * 
 * Verifies:
 * 1. Cart is not empty.
 * 2. Sweet shop is ACTIVE and operational.
 * 3. Every sweet product is AVAILABLE, active, and has sufficient stock.
 * 4. Verifies delivery address belongs to customer (if addressId provided).
 * 5. Re-computes accurate live pricing, taxes, packaging, and total.
 * 6. DOES NOT deduct or reserve stock.
 */
async function validateCheckout(userId, { deliveryAddressId = null }) {
  const cart = await getCart(userId);

  if (!cart.cartId || cart.items.length === 0) {
    throw new ValidationError('Your cart is empty. Add products before proceeding to checkout.');
  }

  // 1. Verify Sweet Shop Status
  const [sellerRows] = await pool.query(
    'SELECT id, business_name, account_status, verification_status, is_active FROM sellers WHERE id = ? LIMIT 1;',
    [cart.sellerId]
  );

  if (
    sellerRows.length === 0 ||
    !sellerRows[0].is_active ||
    sellerRows[0].account_status === 'SUSPENDED' ||
    sellerRows[0].account_status === 'TERMINATED'
  ) {
    throw new ValidationError('The sweet shop is currently suspended or inactive and cannot accept orders.');
  }

  // 2. Verify Delivery Address (if provided)
  let validatedAddress = null;
  if (deliveryAddressId) {
    const [addrRows] = await pool.query(
      'SELECT * FROM user_addresses WHERE id = ? AND user_id = ? LIMIT 1;',
      [deliveryAddressId, userId]
    );
    if (addrRows.length === 0) {
      throw new ValidationError('Selected delivery address not found or does not belong to you.');
    }
    validatedAddress = addrRows[0];
  }

  // 3. Line-by-line stock and availability check
  const itemValidations = [];
  let isCheckoutReady = true;
  let subtotal = 0;

  for (const item of cart.items) {
    const isAvailable = item.is_active && item.availability_status === 'AVAILABLE';
    const hasSufficientStock = item.stock_quantity >= item.quantity;
    const canFulfill = isAvailable && hasSufficientStock;

    if (!canFulfill) {
      isCheckoutReady = false;
    }

    const itemTotal = Number(item.unit_price) * item.quantity;
    subtotal += itemTotal;

    itemValidations.push({
      productId: item.product_id,
      productName: item.product_name,
      requestedQuantity: item.quantity,
      availableStock: item.stock_quantity,
      unitPrice: Number(item.unit_price).toFixed(2),
      itemTotal: itemTotal.toFixed(2),
      status: canFulfill ? 'READY' : (!isAvailable ? 'UNAVAILABLE' : 'INSUFFICIENT_STOCK')
    });
  }

  // Fee computations:
  const packagingCharge = 15.00; // Flat packaging fee for sweet boxes
  const deliveryFee = subtotal > 500 ? 0.00 : 40.00; // Free delivery over ₹500
  const gst = Number((subtotal * 0.05).toFixed(2));
  const grandTotal = Number((subtotal + packagingCharge + deliveryFee + gst).toFixed(2));

  return {
    valid: isCheckoutReady,
    message: isCheckoutReady
      ? 'Cart is valid and ready for payment/order placement.'
      : 'Some items in your cart are currently out of stock or unavailable.',
    shop: {
      sellerId: cart.sellerId,
      businessName: cart.sellerName
    },
    deliveryAddress: validatedAddress,
    items: itemValidations,
    billing: {
      subtotal: subtotal.toFixed(2),
      packagingCharge: packagingCharge.toFixed(2),
      deliveryFee: deliveryFee.toFixed(2),
      gst: gst.toFixed(2),
      grandTotal: grandTotal.toFixed(2)
    }
  };
}

module.exports = {
  getCart,
  addItemToCart,
  updateItemQuantity,
  removeItem,
  clearCart,
  validateCheckout
};
