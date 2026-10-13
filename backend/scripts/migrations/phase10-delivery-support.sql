-- ==============================================================================
-- MIGRATION: Phase 10 - Delivery Partners, Tracking & Support Tickets
-- DATABASE: sweet_shop_delivery
-- ENGINE: MySQL 8.0 (InnoDB)
-- ==============================================================================

USE sweet_shop_delivery;

-- 1. Table: delivery_partners
-- Stores delivery rider profiles, vehicle details, verification, and availability
CREATE TABLE IF NOT EXISTS delivery_partners (
    id CHAR(36) NOT NULL DEFAULT (UUID()),
    name VARCHAR(150) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    email VARCHAR(255) NULL,
    vehicle_type VARCHAR(50) NOT NULL DEFAULT 'MOTORCYCLE', -- 'MOTORCYCLE', 'SCOOTER', 'BICYCLE', 'ELECTRIC_VEHICLE'
    vehicle_number VARCHAR(30) NULL,
    driving_license_number VARCHAR(50) NULL,
    current_latitude DECIMAL(10, 8) NULL,
    current_longitude DECIMAL(11, 8) NULL,
    is_available BOOLEAN NOT NULL DEFAULT TRUE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_delivery_partners_phone (phone),
    KEY idx_partners_available (is_available),
    KEY idx_partners_active (is_active),
    CONSTRAINT chk_partners_vehicle_type CHECK (
        vehicle_type IN ('MOTORCYCLE', 'SCOOTER', 'BICYCLE', 'ELECTRIC_VEHICLE', 'OTHER')
    )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Table: order_deliveries
-- Delivery assignment, transit state machine, timestamps, and live simulated coordinates
CREATE TABLE IF NOT EXISTS order_deliveries (
    id CHAR(36) NOT NULL DEFAULT (UUID()),
    order_id CHAR(36) NOT NULL,
    partner_id CHAR(36) NOT NULL,
    delivery_status VARCHAR(30) NOT NULL DEFAULT 'ASSIGNED',
    
    -- Coordinates (Simulated or GPS)
    current_latitude DECIMAL(10, 8) NULL,
    current_longitude DECIMAL(11, 8) NULL,
    location_updated_at TIMESTAMP NULL,
    
    -- Audit Timestamps
    assigned_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    picked_up_at TIMESTAMP NULL,
    delivered_at TIMESTAMP NULL,
    failed_at TIMESTAMP NULL,
    failure_reason VARCHAR(255) NULL,
    
    assigned_by CHAR(36) NOT NULL, -- Admin, Super Admin, or Seller ID
    assigned_by_role VARCHAR(50) NOT NULL,
    
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    PRIMARY KEY (id),
    UNIQUE KEY uq_order_deliveries_order (order_id), -- At most one active delivery assignment per order
    KEY idx_order_deliveries_partner (partner_id),
    KEY idx_order_deliveries_status (delivery_status),
    
    CONSTRAINT chk_order_deliveries_status CHECK (
        delivery_status IN ('ASSIGNED', 'PICKED_UP', 'IN_TRANSIT', 'DELIVERED', 'FAILED')
    ),
    CONSTRAINT fk_deliveries_order FOREIGN KEY (order_id)
        REFERENCES orders (id) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_deliveries_partner FOREIGN KEY (partner_id)
        REFERENCES delivery_partners (id) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Table: delivery_audit_logs
-- Immutable history of status transitions and location breadcrumbs
CREATE TABLE IF NOT EXISTS delivery_audit_logs (
    id CHAR(36) NOT NULL DEFAULT (UUID()),
    delivery_id CHAR(36) NOT NULL,
    order_id CHAR(36) NOT NULL,
    partner_id CHAR(36) NOT NULL,
    status VARCHAR(30) NOT NULL,
    latitude DECIMAL(10, 8) NULL,
    longitude DECIMAL(11, 8) NULL,
    notes VARCHAR(255) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    PRIMARY KEY (id),
    KEY idx_delivery_logs_delivery_id (delivery_id),
    KEY idx_delivery_logs_order_id (order_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Table: support_tickets
-- Customer support inquiry tickets linked to orders
CREATE TABLE IF NOT EXISTS support_tickets (
    id CHAR(36) NOT NULL DEFAULT (UUID()),
    ticket_number VARCHAR(50) NOT NULL,
    user_id CHAR(36) NOT NULL, -- Customer who opened ticket
    order_id CHAR(36) NULL,   -- Associated order (optional but recommended)
    seller_id CHAR(36) NULL,  -- Sweet shop context
    subject VARCHAR(200) NOT NULL,
    category VARCHAR(50) NOT NULL DEFAULT 'ORDER_ISSUE', -- 'ORDER_ISSUE', 'DELIVERY_DELAY', 'FOOD_QUALITY', 'PAYMENT_ISSUE', 'OTHER'
    priority VARCHAR(20) NOT NULL DEFAULT 'MEDIUM',     -- 'LOW', 'MEDIUM', 'HIGH', 'URGENT'
    status VARCHAR(30) NOT NULL DEFAULT 'OPEN',         -- 'OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'
    assigned_agent_id CHAR(36) NULL,                    -- customer_care or admin ID
    resolved_at TIMESTAMP NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    PRIMARY KEY (id),
    UNIQUE KEY uq_tickets_ticket_number (ticket_number),
    KEY idx_tickets_user_id (user_id),
    KEY idx_tickets_order_id (order_id),
    KEY idx_tickets_seller_id (seller_id),
    KEY idx_tickets_status (status),
    KEY idx_tickets_agent (assigned_agent_id),
    
    CONSTRAINT chk_tickets_category CHECK (
        category IN ('ORDER_ISSUE', 'DELIVERY_DELAY', 'FOOD_QUALITY', 'PAYMENT_ISSUE', 'OTHER')
    ),
    CONSTRAINT chk_tickets_priority CHECK (
        priority IN ('LOW', 'MEDIUM', 'HIGH', 'URGENT')
    ),
    CONSTRAINT chk_tickets_status CHECK (
        status IN ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED')
    ),
    CONSTRAINT fk_tickets_user FOREIGN KEY (user_id)
        REFERENCES seller_users (id) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_tickets_order FOREIGN KEY (order_id)
        REFERENCES orders (id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Table: support_ticket_messages
-- Conversation messages and replies between customer and support agents
CREATE TABLE IF NOT EXISTS support_ticket_messages (
    id CHAR(36) NOT NULL DEFAULT (UUID()),
    ticket_id CHAR(36) NOT NULL,
    sender_id CHAR(36) NOT NULL,
    sender_type VARCHAR(50) NOT NULL, -- 'CUSTOMER', 'CUSTOMER_CARE', 'ADMIN', 'SYSTEM'
    sender_name VARCHAR(150) NOT NULL,
    message TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    PRIMARY KEY (id),
    KEY idx_ticket_messages_ticket (ticket_id),
    CONSTRAINT fk_ticket_messages_ticket FOREIGN KEY (ticket_id)
        REFERENCES support_tickets (id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
