-- ==============================================================================
-- MIGRATION: Phase 8 - Orders & Order Items Engine
-- DATABASE: sweet_shop_delivery
-- ENGINE: MySQL 8.0 (InnoDB)
-- ==============================================================================

USE sweet_shop_delivery;

-- 1. Table: orders
-- Tracks placed orders with immutable pricing snapshots, delivery address snapshots, and state transitions
CREATE TABLE IF NOT EXISTS orders (
    id CHAR(36) NOT NULL DEFAULT (UUID()),
    order_number VARCHAR(50) NOT NULL,
    user_id CHAR(36) NOT NULL,
    seller_id CHAR(36) NOT NULL,
    delivery_address_id CHAR(36) NULL,
    
    -- Address Snapshot (Preserves audit history if customer updates/deletes their address later)
    recipient_name VARCHAR(100) NOT NULL,
    recipient_phone VARCHAR(20) NOT NULL,
    delivery_address_line_1 VARCHAR(255) NOT NULL,
    delivery_address_line_2 VARCHAR(255) NULL,
    delivery_city VARCHAR(100) NOT NULL,
    delivery_state VARCHAR(100) NOT NULL,
    delivery_pincode VARCHAR(20) NOT NULL,
    
    -- Immutable Financial Snapshot (In INR, 2 decimal places)
    subtotal DECIMAL(10, 2) NOT NULL,
    packaging_charge DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    delivery_fee DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    gst_amount DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    total_amount DECIMAL(10, 2) NOT NULL,
    
    -- Status and Lifecycle
    order_status VARCHAR(30) NOT NULL DEFAULT 'PLACED',
    payment_status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
    
    -- Cancellation Tracking
    cancelled_by VARCHAR(50) NULL,
    cancellation_reason VARCHAR(255) NULL,
    cancelled_at TIMESTAMP NULL,
    
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    PRIMARY KEY (id),
    UNIQUE KEY uq_orders_order_number (order_number),
    KEY idx_orders_user_id (user_id),
    KEY idx_orders_seller_id (seller_id),
    KEY idx_orders_status (order_status),
    KEY idx_orders_created_at (created_at),
    
    CONSTRAINT chk_orders_status CHECK (
        order_status IN ('PLACED', 'CONFIRMED', 'PREPARING', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED')
    ),
    CONSTRAINT chk_orders_payment_status CHECK (
        payment_status IN ('PENDING', 'PAID', 'FAILED', 'REFUNDED')
    ),
    CONSTRAINT fk_orders_user FOREIGN KEY (user_id)
        REFERENCES seller_users (id) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_orders_seller FOREIGN KEY (seller_id)
        REFERENCES sellers (id) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_orders_address FOREIGN KEY (delivery_address_id)
        REFERENCES user_addresses (id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Table: order_items
-- Immutable line-item snapshot of products purchased in an order
CREATE TABLE IF NOT EXISTS order_items (
    id CHAR(36) NOT NULL DEFAULT (UUID()),
    order_id CHAR(36) NOT NULL,
    product_id CHAR(36) NOT NULL,
    product_name VARCHAR(150) NOT NULL,
    unit_price DECIMAL(10, 2) NOT NULL,
    quantity INT NOT NULL,
    item_total DECIMAL(10, 2) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    PRIMARY KEY (id),
    KEY idx_order_items_order_id (order_id),
    KEY idx_order_items_product_id (product_id),
    
    CONSTRAINT chk_order_items_qty CHECK (quantity > 0),
    CONSTRAINT chk_order_items_unit_price CHECK (unit_price >= 0.00),
    CONSTRAINT chk_order_items_total CHECK (item_total >= 0.00),
    CONSTRAINT fk_order_items_order FOREIGN KEY (order_id)
        REFERENCES orders (id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_order_items_product FOREIGN KEY (product_id)
        REFERENCES products (id) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
