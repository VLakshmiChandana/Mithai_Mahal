-- ==============================================================================
-- MIGRATION: Phase 7 - Shopping Cart & Cart Items
-- DATABASE: sweet_shop_delivery
-- ENGINE: MySQL 8.0 (InnoDB)
-- ==============================================================================

USE sweet_shop_delivery;

-- 1. Table: shopping_carts
-- Each customer has an active shopping cart scoped to exactly one sweet shop at a time.
CREATE TABLE IF NOT EXISTS shopping_carts (
    id CHAR(36) NOT NULL DEFAULT (UUID()),
    user_id CHAR(36) NOT NULL,
    seller_id CHAR(36) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_customer_cart (user_id),
    KEY idx_carts_seller_id (seller_id),
    CONSTRAINT fk_carts_user FOREIGN KEY (user_id)
        REFERENCES seller_users (id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_carts_seller FOREIGN KEY (seller_id)
        REFERENCES sellers (id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Table: cart_items
-- Stores items added to the customer's cart
CREATE TABLE IF NOT EXISTS cart_items (
    id CHAR(36) NOT NULL DEFAULT (UUID()),
    cart_id CHAR(36) NOT NULL,
    product_id CHAR(36) NOT NULL,
    quantity INT NOT NULL DEFAULT 1,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_cart_product (cart_id, product_id),
    KEY idx_cart_items_cart_id (cart_id),
    KEY idx_cart_items_product_id (product_id),
    CONSTRAINT chk_cart_quantity CHECK (quantity > 0),
    CONSTRAINT fk_cart_items_cart FOREIGN KEY (cart_id)
        REFERENCES shopping_carts (id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_cart_items_product FOREIGN KEY (product_id)
        REFERENCES products (id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
