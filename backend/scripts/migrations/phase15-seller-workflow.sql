-- ==============================================================================
-- MIGRATION: Phase 15 - Role-Based Workflows, Seller Verification & Inventory Management
-- DATABASE: sweet_shop_delivery
-- ENGINE: MySQL 8.0 (InnoDB)
-- ==============================================================================

USE sweet_shop_delivery;

-- 1. Extend sellers table with address and owner information if not present
SET @dbname = DATABASE();

-- Add owner_name
SET @precheck = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'sellers' AND COLUMN_NAME = 'owner_name');
SET @sql = IF(@precheck = 0, 'ALTER TABLE sellers ADD COLUMN owner_name VARCHAR(150) NULL AFTER legal_name;', 'SELECT "owner_name exists";');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Add shop_address
SET @precheck = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'sellers' AND COLUMN_NAME = 'shop_address');
SET @sql = IF(@precheck = 0, 'ALTER TABLE sellers ADD COLUMN shop_address TEXT NULL AFTER phone;', 'SELECT "shop_address exists";');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Add city
SET @precheck = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'sellers' AND COLUMN_NAME = 'city');
SET @sql = IF(@precheck = 0, 'ALTER TABLE sellers ADD COLUMN city VARCHAR(100) NULL AFTER shop_address;', 'SELECT "city exists";');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Add state
SET @precheck = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'sellers' AND COLUMN_NAME = 'state');
SET @sql = IF(@precheck = 0, 'ALTER TABLE sellers ADD COLUMN state VARCHAR(100) NULL AFTER city;', 'SELECT "state exists";');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Add pincode
SET @precheck = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'sellers' AND COLUMN_NAME = 'pincode');
SET @sql = IF(@precheck = 0, 'ALTER TABLE sellers ADD COLUMN pincode VARCHAR(10) NULL AFTER state;', 'SELECT "pincode exists";');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Add rejection_reason
SET @precheck = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'sellers' AND COLUMN_NAME = 'rejection_reason');
SET @sql = IF(@precheck = 0, 'ALTER TABLE sellers ADD COLUMN rejection_reason TEXT NULL AFTER verification_status;', 'SELECT "rejection_reason exists";');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 2. Extend products table with SKU, weight/pack_size, low_stock_threshold
SET @precheck = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'products' AND COLUMN_NAME = 'sku');
SET @sql = IF(@precheck = 0, 'ALTER TABLE products ADD COLUMN sku VARCHAR(50) NULL AFTER name;', 'SELECT "sku exists";');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @precheck = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'products' AND COLUMN_NAME = 'weight_pack_size');
SET @sql = IF(@precheck = 0, 'ALTER TABLE products ADD COLUMN weight_pack_size VARCHAR(50) NULL AFTER sku;', 'SELECT "weight_pack_size exists";');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @precheck = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'products' AND COLUMN_NAME = 'low_stock_threshold');
SET @sql = IF(@precheck = 0, 'ALTER TABLE products ADD COLUMN low_stock_threshold INT NOT NULL DEFAULT 5 AFTER stock_quantity;', 'SELECT "low_stock_threshold exists";');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 3. Table: seller_documents (stores individual uploaded verification certificates securely)
CREATE TABLE IF NOT EXISTS seller_documents (
    id CHAR(36) NOT NULL DEFAULT (UUID()),
    seller_id CHAR(36) NOT NULL,
    document_type VARCHAR(50) NOT NULL, -- 'FSSAI_REGISTRATION', 'FSSAI_LICENSE', 'GST_CERTIFICATE', 'BUSINESS_PROOF', 'OTHER'
    document_number VARCHAR(100) NULL,
    file_path VARCHAR(500) NOT NULL,   -- Private storage path outside public directory
    file_name VARCHAR(255) NOT NULL,
    file_size INT NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    expiry_date DATE NULL,
    verification_status VARCHAR(30) NOT NULL DEFAULT 'PENDING', -- 'PENDING', 'UNDER_REVIEW', 'APPROVED', 'REJECTED'
    rejection_reason TEXT NULL,
    reviewed_by CHAR(36) NULL,
    reviewed_at TIMESTAMP NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_seller_documents_seller (seller_id),
    KEY idx_seller_documents_status (verification_status),
    CONSTRAINT fk_seller_docs_seller FOREIGN KEY (seller_id)
        REFERENCES sellers (id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Table: inventory_adjustments (audit trail for stock increments, decrements, adjustments)
CREATE TABLE IF NOT EXISTS inventory_adjustments (
    id CHAR(36) NOT NULL DEFAULT (UUID()),
    product_id CHAR(36) NOT NULL,
    seller_id CHAR(36) NOT NULL,
    previous_quantity INT NOT NULL,
    new_quantity INT NOT NULL,
    quantity_change INT NOT NULL,
    reason VARCHAR(100) NOT NULL, -- 'INITIAL_STOCK', 'MANUAL_ADJUSTMENT', 'ORDER_PURCHASE', 'ORDER_CANCELLED', 'RESTOCK', 'DAMAGE'
    actor_id CHAR(36) NULL,       -- Seller ID, Admin ID, or System
    actor_type VARCHAR(50) NOT NULL DEFAULT 'SELLER',
    notes TEXT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_inv_adjustments_product (product_id),
    KEY idx_inv_adjustments_seller (seller_id),
    KEY idx_inv_adjustments_created (created_at),
    CONSTRAINT fk_inv_adj_product FOREIGN KEY (product_id)
        REFERENCES products (id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_inv_adj_seller FOREIGN KEY (seller_id)
        REFERENCES sellers (id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
