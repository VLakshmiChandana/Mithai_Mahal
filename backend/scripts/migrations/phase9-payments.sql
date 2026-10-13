-- ==============================================================================
-- MIGRATION: Phase 9 - Payments, Webhook Logs & Vendor Settlement Accounting
-- DATABASE: sweet_shop_delivery
-- ENGINE: MySQL 8.0 (InnoDB)
-- ==============================================================================

USE sweet_shop_delivery;

-- 1. Table: payments
-- Persists transaction attempts, payment gateway references, amounts, and statuses
CREATE TABLE IF NOT EXISTS payments (
    id CHAR(36) NOT NULL DEFAULT (UUID()),
    order_id CHAR(36) NOT NULL,
    payment_reference VARCHAR(100) NOT NULL, -- Internal idempotency/tracking reference (e.g. PAY-...)
    provider VARCHAR(50) NOT NULL DEFAULT 'mock', -- 'mock', 'razorpay', 'stripe'
    provider_payment_id VARCHAR(100) NULL, -- Gateway payment ID (e.g. pay_N7...)
    amount DECIMAL(10, 2) NOT NULL,
    currency VARCHAR(10) NOT NULL DEFAULT 'INR',
    status VARCHAR(30) NOT NULL DEFAULT 'INITIATED',
    payment_method VARCHAR(50) NULL,
    raw_response JSON NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_payments_reference (payment_reference),
    KEY idx_payments_order_id (order_id),
    KEY idx_payments_status (status),
    KEY idx_payments_provider_id (provider_payment_id),
    CONSTRAINT chk_payments_status CHECK (
        status IN ('INITIATED', 'PENDING', 'SUCCESS', 'FAILED', 'REFUNDED')
    ),
    CONSTRAINT fk_payments_order FOREIGN KEY (order_id)
        REFERENCES orders (id) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Table: payment_webhooks
-- Audit log of received webhooks enforcing idempotency per event_id
CREATE TABLE IF NOT EXISTS payment_webhooks (
    id CHAR(36) NOT NULL DEFAULT (UUID()),
    provider VARCHAR(50) NOT NULL,
    event_id VARCHAR(150) NOT NULL,
    event_type VARCHAR(100) NOT NULL,
    payload JSON NOT NULL,
    processed_status VARCHAR(30) NOT NULL DEFAULT 'PROCESSED',
    processed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_webhooks_provider_event (provider, event_id),
    KEY idx_webhooks_processed_status (processed_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Table: vendor_settlements
-- Auditable vendor payout accounting per paid order
-- Commission Rule:
-- Platform Commission = 10% on Order Subtotal (sweets)
-- Sweet Shop Payout = Subtotal (90%) + Packaging Charge (100% to shop)
-- Platform Retains = Platform Commission (10%) + Delivery Fee + GST
CREATE TABLE IF NOT EXISTS vendor_settlements (
    id CHAR(36) NOT NULL DEFAULT (UUID()),
    order_id CHAR(36) NOT NULL,
    seller_id CHAR(36) NOT NULL,
    payment_id CHAR(36) NOT NULL,
    gross_order_amount DECIMAL(10, 2) NOT NULL,
    commission_rate DECIMAL(5, 2) NOT NULL DEFAULT 10.00, -- 10.00%
    platform_commission DECIMAL(10, 2) NOT NULL,
    packaging_reimbursement DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    delivery_fee_retained DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    gst_retained DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    net_seller_payout DECIMAL(10, 2) NOT NULL,
    settlement_status VARCHAR(30) NOT NULL DEFAULT 'PENDING_PAYOUT',
    payout_batch_id VARCHAR(100) NULL,
    payout_at TIMESTAMP NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_settlements_order_id (order_id),
    KEY idx_settlements_seller_id (seller_id),
    KEY idx_settlements_status (settlement_status),
    CONSTRAINT chk_settlements_status CHECK (
        settlement_status IN ('PENDING_PAYOUT', 'PROCESSING', 'SETTLED', 'ON_HOLD', 'CANCELLED')
    ),
    CONSTRAINT fk_settlements_order FOREIGN KEY (order_id)
        REFERENCES orders (id) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_settlements_seller FOREIGN KEY (seller_id)
        REFERENCES sellers (id) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_settlements_payment FOREIGN KEY (payment_id)
        REFERENCES payments (id) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
