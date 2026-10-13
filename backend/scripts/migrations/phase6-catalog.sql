-- ==============================================================================
-- MIGRATION: Phase 6 - Sweet Shop Management and Product Catalogue
-- DATABASE: sweet_shop_delivery
-- ENGINE: MySQL 8.0 (InnoDB)
-- ==============================================================================

USE sweet_shop_delivery;

-- 1. Table: product_categories
-- Allows sweet shops to group their products (e.g., "Bengali Sweets", "Dry Fruit Sweets", "Halwa", "Snacks & Namkeen")
CREATE TABLE IF NOT EXISTS product_categories (
    id CHAR(36) NOT NULL DEFAULT (UUID()),
    seller_id CHAR(36) NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT NULL,
    display_order INT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_seller_category_name (seller_id, name),
    KEY idx_categories_seller_id (seller_id),
    KEY idx_categories_is_active (is_active),
    CONSTRAINT fk_categories_seller FOREIGN KEY (seller_id)
        REFERENCES sellers (id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Table: products
-- Stores sweet products with price, stock, category, image URL, and availability status
CREATE TABLE IF NOT EXISTS products (
    id CHAR(36) NOT NULL DEFAULT (UUID()),
    seller_id CHAR(36) NOT NULL,
    category_id CHAR(36) NULL,
    name VARCHAR(150) NOT NULL,
    description TEXT NULL,
    price DECIMAL(10, 2) NOT NULL,
    stock_quantity INT NOT NULL DEFAULT 0,
    image_url VARCHAR(500) NULL,
    availability_status VARCHAR(20) NOT NULL DEFAULT 'AVAILABLE',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_products_seller_id (seller_id),
    KEY idx_products_category_id (category_id),
    KEY idx_products_availability (availability_status),
    KEY idx_products_price (price),
    KEY idx_products_name (name),
    KEY idx_products_is_active (is_active),
    CONSTRAINT chk_products_price CHECK (price >= 0.00),
    CONSTRAINT chk_products_stock CHECK (stock_quantity >= 0),
    CONSTRAINT chk_products_availability CHECK (availability_status IN ('AVAILABLE', 'OUT_OF_STOCK', 'DISCONTINUED')),
    CONSTRAINT fk_products_seller FOREIGN KEY (seller_id)
        REFERENCES sellers (id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_products_category FOREIGN KEY (category_id)
        REFERENCES product_categories (id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
