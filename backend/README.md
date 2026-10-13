# Sweet Shop Delivery Platform — Backend Authentication Service

> **Stack:** Node.js, Express.js, MySQL 8.0 (`mysql2/promise`), JWT, bcrypt, dotenv  
> **Target Database:** `sweet_shop_delivery`

---

## Getting Started

### 1. Configure Local Environment (`.env`)
Copy `.env.example` to `.env` (already done) and set your local MySQL root password:
```ini
PORT=5000
NODE_ENV=development

DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=YOUR_MYSQL_ROOT_PASSWORD_HERE
DB_NAME=sweet_shop_delivery
DB_CONNECTION_LIMIT=10

JWT_ACCESS_SECRET=your_long_random_access_secret_32_bytes
JWT_REFRESH_SECRET=your_long_random_refresh_secret_32_bytes
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
```

### 2. Verify Database Connectivity
Once `DB_PASSWORD` is entered in `.env`, run:
```bash
npm test
```
Or directly:
```bash
node scripts/test-db-connection.js
```
This queries the existing 14 tables in `sweet_shop_delivery` and lists the 6 seeded roles.

### 3. Start the Server
- **Development (with hot-reload):**
  ```bash
  npm run dev
  ```
- **Production start:**
  ```bash
  npm start
  ```

### 4. Test the Health Endpoint
In PowerShell or terminal:
```bash
curl http://localhost:5000/health
```
**Expected Response when Connected (HTTP 200):**
```json
{
  "status": "UP",
  "timestamp": "2026-10-12T14:30:00.000Z",
  "environment": "development",
  "database": {
    "status": "CONNECTED",
    "name": "sweet_shop_delivery",
    "version": "8.0.45"
  }
}
```
*(If DB credentials are wrong or the server is starting, it gracefully returns HTTP 503 with `"status": "DEGRADED"` and `"database": "DISCONNECTED"` without crashing).*

---

### 5. Initialize or Reset Super Admin Password (Phase 2)
To set a secure password for the root Super Admin (`superadmin@sweetshop.internal`):
```bash
npm run superadmin:reset
```
- **Masked Input:** Characters are hidden while typing to prevent shoulder-surfing.
- **Security:** Password is hashed with `bcrypt` (work factor 12) before writing to MySQL.
- **Verification:** Performs an immediate database self-check using `bcrypt.compare` to ensure the stored hash matches.

---

### 6. Run Core Security Services Test Suite (Phase 3)
To run the automated tests for Token, RBAC, and Authentication services:
```bash
npm run test:services
```
This tests:
- Cryptographic JWT signing and tampering rejection
- SHA-256 refresh token hashing and access token denylist checks
- RBAC permission resolution from MySQL (`roles` -> `role_permissions` -> `permissions`)
- Timing-safe login with bcrypt credential verification
- Transaction-safe refresh token rotation and token reuse detection (theft protection)

---

### 7. Run Middleware Pipeline Test Suite (Phase 4)
To run the automated tests for all 5 security middleware components:
```bash
npm run test:middleware
```
This tests:
- `authenticate.js`: Bearer token extraction, signature & expiry checks, `jwt_tokens` denylist checks, database active status validation, and non-existent account rejection.
- `authorize.js`: RBAC role and permission checks, fail-closed policy.
- `tenant.js`: Seller isolation, cross-tenant breach prevention, and staff bypass validation.
- `validate.js`: Joi request body/param/query sanitization and validation.
- `errorHandler.js`: Normalized JSON error formatting and production stack trace masking.

---

### 8. Run End-to-End API Integration Test Suite (Phase 5)
To execute the live HTTP integration test suite across all controllers and routes:
```bash
npm run test:e2e
```
This suite verifies:
- **Authentication:** Login, Protected `/me`, Refresh Token Rotation, and Immediate Session Revocation on Logout.
- **Staff Management:** Creation of Admins, Accountants, and Sweet Shop Sellers with RBAC enforcement (`manage_platform_staff`, `manage_seller_accounts`).
- **Seller Management:** Viewing and updating own business profile, with cross-tenant access blocking.
- **Customer Registration & Multi-Tenant Isolation:** Validating that identical customer emails can register under distinct Sweet Shops (`UNIQUE(seller_id, email)` preserved), duplicate emails within the same shop are rejected (409 Conflict), and customer tokens are strictly blocked from privileged staff operations.

---

## API Reference (Phase 5)

All endpoints return a standardized JSON envelope:
- **Success:** `{ "success": true, "data": { ... }, "message": "..." }`
- **Error:** `{ "success": false, "error": { "code": "ERROR_CODE", "message": "...", "details": [...] } }`

### 1. Authentication APIs (`/api/v1/auth`)

#### `POST /api/v1/auth/login`
- **Access:** Public
- **Request Body:**
```json
{
  "email": "superadmin@sweetshop.internal",
  "password": "SuperAdminPassword123!",
  "sellerId": "optional-uuid-only-for-customers",
  "deviceId": "web-chrome-client"
}
```
- **Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "7b82f9d1a3c5e...",
    "tokenType": "Bearer",
    "user": {
      "id": "00000000-0000-0000-0000-000000000100",
      "email": "superadmin@sweetshop.internal",
      "name": "Super Administrator",
      "userType": "SUPER_ADMIN",
      "role": "SUPER_ADMIN",
      "permissions": [
        "manage_platform_staff",
        "manage_platform_settings",
        "manage_seller_accounts",
        "review_seller_kyc"
      ],
      "sellerId": null
    }
  }
}
```

#### `GET /api/v1/auth/me`
- **Access:** Authenticated (`Bearer <token>`)
- **Response (200 OK):** Returns authenticated user's current identity, role, permissions, and tenant context.

#### `POST /api/v1/auth/refresh`
- **Access:** Public
- **Request Body:** `{ "refreshToken": "7b82f9d1a3c5e...", "deviceId": "web-chrome-client" }`
- **Response (200 OK):** Issues new `accessToken` and rotated `refreshToken`. Revoked refresh tokens trigger theft detection.

#### `POST /api/v1/auth/logout`
- **Access:** Authenticated (`Bearer <token>`)
- **Request Body:** `{ "refreshToken": "7b82f9d1a3c5e..." }` (Optional)
- **Response (200 OK):** Immediately adds access token `jti` to `jwt_tokens` denylist and revokes refresh token session.

---

### 2. Staff Management APIs (`/api/v1/staff`)

#### `POST /api/v1/staff/admins`
- **Access:** Staff with `manage_platform_staff` permission
- **Request Body:**
```json
{
  "name": "Platform Administrator",
  "email": "admin1@sweetshop.internal",
  "password": "StrongPassword123!",
  "mobileNumber": "+919876543210"
}
```
- **Response (201 Created):** Admin created with `created_by` foreign-key set to the creator's ID.

#### `POST /api/v1/staff/accountants`
- **Access:** Staff with `manage_platform_staff` permission
- **Request Body:** Same format as `/admins`.

#### `POST /api/v1/staff/sellers`
- **Access:** Staff with `manage_seller_accounts` permission
- **Request Body:**
```json
{
  "businessName": "Bikaner Sweet House",
  "legalName": "Bikaner Sweets Pvt Ltd",
  "businessType": "PVT_LTD",
  "email": "owner@bikanersweets.internal",
  "phone": "+919123456789",
  "gstin": "29ABCDE1234F1Z5",
  "password": "StorePassword123!"
}
```
- **Response (201 Created):** Creates seller record with `ACTIVE` status and default approval.

#### `GET /api/v1/staff/sellers`
- **Access:** Staff with `manage_seller_accounts` permission
- **Response (200 OK):** Paginated array of sweet shop sellers.

---

### 3. Seller Profile APIs (`/api/v1/sellers`)

#### `GET /api/v1/sellers/profile`
- **Access:** Authenticated `SELLER`
- **Response (200 OK):** Returns shop's details (`business_name`, `phone`, `gstin`, `verification_status`).

#### `PATCH /api/v1/sellers/profile`
- **Access:** Authenticated `SELLER`
- **Request Body:**
```json
{
  "businessName": "Bikaner Sweet House Premium",
  "phone": "+919988776655"
}
```
- **Response (200 OK):** Returns updated profile.

#### `GET /api/v1/sellers/:sellerId`
- **Access:** Authenticated (Tenant-guarded: Sellers can only access their own ID; Staff can access any ID).

---

### 4. Customer APIs (`/api/v1/customers`)

#### `POST /api/v1/customers/register`
- **Access:** Public (requires `sellerId` tenant context)
- **Request Body:**
```json
{
  "sellerId": "aaaaaaaa-5555-5555-5555-000000000001",
  "email": "customer@example.in",
  "password": "CustomerPassword123!",
  "firstName": "Aarav",
  "lastName": "Sharma",
  "phone": "+919876543210"
}
```
- **Response (201 Created):** Enforces `UNIQUE(seller_id, email)` — permits identical customer email under different sweet shops, but rejects duplicates within the same shop.

#### `GET /api/v1/customers/profile`
- **Access:** Authenticated `CUSTOMER`
- **Response (200 OK):** Returns customer profile for their assigned sweet shop.

---

### 9. Run Product Catalogue Test Suite (Phase 6)
To execute the automated integration test suite for product categories and sweet products:
```bash
npm run test:catalog
```
This suite verifies:
- **RBAC:** Ensures only accounts with `manage_shop_catalog` (Sellers) can create, edit, or delete items, while Customers and non-sellers are rejected with HTTP 403 Forbidden.
- **Input Validation:** Enforces positive prices, non-negative stock numbers, and valid availability statuses (`AVAILABLE`, `OUT_OF_STOCK`, `DISCONTINUED`).
- **Tenant Isolation:** Rejects cross-tenant product updates, deletions, and foreign category assignments (404/400).
- **Search & Filtering:** Validates case-insensitive keyword searches, price range boundaries (`minPrice`, `maxPrice`), and pagination metadata.

---

## API Reference (Phase 6: Sweet Shop Management & Product Catalogue)

### 5. Category Management APIs (`/api/v1/categories`)

#### `POST /api/v1/categories`
- **Access:** Authenticated `SELLER` (requires `manage_shop_catalog` permission)
- **Request Body:**
```json
{
  "name": "Dry Fruit Sweets",
  "description": "Premium sweets prepared with cashews, almonds, and pistachios",
  "displayOrder": 1
}
```
- **Response (201 Created):**
```json
{
  "success": true,
  "message": "Product category created successfully.",
  "data": {
    "id": "e9b5f3a1-7c2d-4f8a-9e1b-3d5c7f8a9e01",
    "seller_id": "aaaaaaaa-5555-5555-5555-000000000001",
    "name": "Dry Fruit Sweets",
    "description": "Premium sweets prepared with cashews, almonds, and pistachios",
    "display_order": 1,
    "is_active": 1,
    "created_at": "2026-10-12T10:00:00.000Z",
    "updated_at": "2026-10-12T10:00:00.000Z"
  }
}
```

#### `GET /api/v1/categories`
- **Access:** Authenticated (`SELLER` lists own categories; `CUSTOMER` lists categories of their assigned shop)
- **Query Params:** `page=1`, `limit=20`, `isActive=true`
- **Response (200 OK):** Paginated array of categories ordered by `display_order` and `name`.

#### `PATCH /api/v1/categories/:categoryId`
- **Access:** Authenticated `SELLER` (owning tenant only)
- **Request Body:** `{ "name": "Nut Sweets", "displayOrder": 2 }`
- **Response (200 OK):** Updated category object.

#### `DELETE /api/v1/categories/:categoryId`
- **Access:** Authenticated `SELLER` (owning tenant only)
- **Response (200 OK):** `{ "success": true, "message": "Product category deleted successfully.", "data": { "deleted": true, "id": "..." } }`
- *Note: Products belonging to this category automatically retain their product record with `category_id` set to `NULL`.*

---

### 6. Product Management APIs (`/api/v1/products`)

#### `POST /api/v1/products`
- **Access:** Authenticated `SELLER` (requires `manage_shop_catalog` permission)
- **Request Body:**
```json
{
  "name": "Kaju Katli Box 500g",
  "description": "Authentic cashew fudge diamonds garnished with silver foil",
  "categoryId": "e9b5f3a1-7c2d-4f8a-9e1b-3d5c7f8a9e01",
  "price": 450.00,
  "stockQuantity": 50,
  "imageUrl": "https://cdn.sweetshop.internal/images/kaju-katli.jpg",
  "availabilityStatus": "AVAILABLE"
}
```
- **Response (201 Created):**
```json
{
  "success": true,
  "message": "Sweet product created successfully.",
  "data": {
    "id": "f8a7c6b5-1d2e-3f4a-5b6c-7d8e9f0a1b2c",
    "seller_id": "aaaaaaaa-5555-5555-5555-000000000001",
    "category_id": "e9b5f3a1-7c2d-4f8a-9e1b-3d5c7f8a9e01",
    "category_name": "Dry Fruit Sweets",
    "name": "Kaju Katli Box 500g",
    "description": "Authentic cashew fudge diamonds garnished with silver foil",
    "price": "450.00",
    "stock_quantity": 50,
    "image_url": "https://cdn.sweetshop.internal/images/kaju-katli.jpg",
    "availability_status": "AVAILABLE",
    "is_active": 1,
    "created_at": "2026-10-12T10:05:00.000Z",
    "updated_at": "2026-10-12T10:05:00.000Z"
  }
}
```

#### `GET /api/v1/products`
- **Access:** Authenticated (`SELLER`, `CUSTOMER`, or Platform Staff)
- **Query Params:**
  - `search`: Filter by product name or description substring (e.g. `?search=laddoo`)
  - `categoryId`: Filter by specific category UUID
  - `availabilityStatus`: Filter by `AVAILABLE`, `OUT_OF_STOCK`, or `DISCONTINUED`
  - `minPrice` / `maxPrice`: Filter products by price range (e.g. `?minPrice=100&maxPrice=500`)
  - `sortBy`: Sort by `created_at`, `price`, `name`, or `stock_quantity`
  - `sortOrder`: `ASC` or `DESC`
  - `page`: Page number (default: 1)
  - `limit`: Items per page (default: 20, max: 100)
- **Response (200 OK):**
```json
{
  "success": true,
  "data": [ ... ],
  "pagination": {
    "total": 1,
    "page": 1,
    "limit": 20,
    "totalPages": 1
  }
}
```

#### `GET /api/v1/products/:productId`
- **Access:** Authenticated
- **Response (200 OK):** Product details with populated `category_name` and `seller_business_name`.

#### `PATCH /api/v1/products/:productId`
- **Access:** Authenticated `SELLER` (strictly isolated to owner store)
- **Request Body:**
```json
{
  "price": 420.00,
  "stockQuantity": 30,
  "availabilityStatus": "AVAILABLE"
}
```
- **Response (200 OK):** Updated product record.

#### `DELETE /api/v1/products/:productId`
- **Access:** Authenticated `SELLER` (strictly isolated to owner store)
- **Response (200 OK):**
```json
{
  "success": true,
  "message": "Sweet product deleted successfully.",
  "data": {
    "deleted": true,
    "id": "f8a7c6b5-1d2e-3f4a-5b6c-7d8e9f0a1b2c"
  }
}
```

---

### 10. Run Shopping Cart & Checkout Test Suite (Phase 7)
To run the automated tests for delivery addresses, shopping carts, single-shop rules, and checkout validation:
```bash
npm run test:cart
```
This suite verifies:
- **Delivery Addresses:** Creation, setting default flags, and customer ownership isolation.
- **Cart Management:** Adding sweets, updating quantities, deleting items, and clearing carts.
- **Single Sweet Shop Rule:** Enforcing single-shop ordering and handling `CROSS_SHOP_CART_CONFLICT` with seamless `clearAndReplace: true` switches.
- **Server-Side Pricing:** All subtotals and totals derived strictly from live database prices.
- **Checkout Validation:** Validates stock levels, availability, address ownership, and generates pre-checkout billing breakdowns (subtotal, ₹15 packaging, delivery fees, and 5% GST) without deducting inventory.

---

## API Reference (Phase 7: Cart, Addresses & Checkout Validation)

### 7. Delivery Address APIs (`/api/v1/addresses`)

#### `POST /api/v1/addresses`
- **Access:** Authenticated `CUSTOMER`
- **Request Body:**
```json
{
  "recipientName": "Rahul Sharma",
  "recipientPhone": "+919876543210",
  "addressLine1": "Flat 402, Royal Palms Apartments",
  "addressLine2": "MG Road, Indiranagar",
  "city": "Bangalore",
  "state": "Karnataka",
  "pincode": "560038",
  "country": "India",
  "addressType": "HOME",
  "isDefault": true
}
```
- **Response (201 Created):** Address record created with `user_id` bound to the customer.

#### `GET /api/v1/addresses`
- **Access:** Authenticated `CUSTOMER`
- **Response (200 OK):** Array of customer delivery addresses ordered with default address first.

#### `GET /api/v1/addresses/:addressId`
- **Access:** Authenticated `CUSTOMER` (ownership verified)

#### `PATCH /api/v1/addresses/:addressId`
- **Access:** Authenticated `CUSTOMER` (ownership verified)

#### `DELETE /api/v1/addresses/:addressId`
- **Access:** Authenticated `CUSTOMER` (ownership verified)

#### `POST /api/v1/addresses/:addressId/default`
- **Access:** Authenticated `CUSTOMER` (sets specified address as default and unsets others)

---

### 8. Shopping Cart APIs (`/api/v1/cart`)

#### `GET /api/v1/cart`
- **Access:** Authenticated `CUSTOMER`
- **Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "cartId": "4c2e1b8a-9f0a-4b1c-8d2e-3f4a5b6c7d8e",
    "sellerId": "aaaaaaaa-5555-5555-5555-000000000001",
    "sellerName": "Anand Sweets",
    "items": [
      {
        "item_id": "9f0a4b1c-8d2e-3f4a-5b6c-7d8e9f0a1b2c",
        "product_id": "f8a7c6b5-1d2e-3f4a-5b6c-7d8e9f0a1b2c",
        "product_name": "Kaju Barfi 500g",
        "quantity": 2,
        "unit_price": "250.00",
        "stock_quantity": 25,
        "availability_status": "AVAILABLE",
        "item_total": "500.00"
      }
    ],
    "itemCount": 2,
    "subtotal": "500.00",
    "estimatedTax": "25.00",
    "estimatedTotal": "525.00"
  }
}
```

#### `POST /api/v1/cart/items`
- **Access:** Authenticated `CUSTOMER`
- **Request Body:**
```json
{
  "productId": "f8a7c6b5-1d2e-3f4a-5b6c-7d8e9f0a1b2c",
  "quantity": 2,
  "clearAndReplace": false
}
```
- **Response (200 OK):** Updated cart.
- **Cross-Shop Conflict Response (409 Conflict):**
```json
{
  "success": false,
  "error": {
    "code": "CROSS_SHOP_CART_CONFLICT",
    "message": "Your cart contains items from 'Anand Sweets'. You can only order from one sweet shop at a time. Send 'clearAndReplace: true' to clear current cart and start with 'Haldirams Sweets'."
  }
}
```

#### `PATCH /api/v1/cart/items/:itemId`
- **Access:** Authenticated `CUSTOMER`
- **Request Body:** `{ "quantity": 3 }` (Setting `0` removes the item)
- **Response (200 OK):** Updated cart with recalculated subtotal.

#### `DELETE /api/v1/cart/items/:itemId`
- **Access:** Authenticated `CUSTOMER`
- **Response (200 OK):** Updated cart without the item.

#### `DELETE /api/v1/cart`
- **Access:** Authenticated `CUSTOMER`
- **Response (200 OK):** `{ "success": true, "message": "Cart cleared successfully." }`

---

### 9. Checkout Validation API (`/api/v1/cart/validate-checkout`)

#### `POST /api/v1/cart/validate-checkout`
- **Access:** Authenticated `CUSTOMER`
- **Request Body:**
```json
{
  "deliveryAddressId": "7b82f9d1-a3c5-4e7b-9c1a-2d3e4f5a6b7c"
}
```
- **Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "valid": true,
    "message": "Cart is valid and ready for payment/order placement.",
    "shop": {
      "sellerId": "aaaaaaaa-5555-5555-5555-000000000001",
      "businessName": "Anand Sweets"
    },
    "deliveryAddress": {
      "id": "7b82f9d1-a3c5-4e7b-9c1a-2d3e4f5a6b7c",
      "recipient_name": "Rahul Sharma",
      "address_line_1": "Flat 402, Royal Palms Apartments",
      "city": "Bangalore",
      "pincode": "560038"
    },
    "items": [
      {
        "productId": "f8a7c6b5-1d2e-3f4a-5b6c-7d8e9f0a1b2c",
        "productName": "Kaju Barfi 500g",
        "requestedQuantity": 2,
        "availableStock": 25,
        "unitPrice": "250.00",
        "itemTotal": "500.00",
        "status": "READY"
      }
    ],
    "billing": {
      "subtotal": "500.00",
      "packagingCharge": "15.00",
      "deliveryFee": "40.00",
      "gst": "25.00",
      "grandTotal": "580.00"
    }
  }
}
```
- *Note: Checkout validation does NOT deduct or reserve stock.*

---

### 11. Run Order Placement & Atomic Inventory Test Suite (Phase 8)
To run the automated test suite for order placement, atomic inventory deductions, row-locking concurrency, and state transitions:
```bash
npm run test:orders
```
This suite verifies:
- **Atomic Order Placement:** Creating orders, calculating subtotal, delivery fees, packaging, and 5% GST on the server, generating unique `SWT-` order numbers, and persisting immutable line items.
- **Atomic Inventory Deduction:** Stock quantities decremented atomically inside an ACID transaction; products reaching 0 stock automatically update to `OUT_OF_STOCK`.
- **Stock Contention & Overselling Prevention:** When multiple customers compete for remaining inventory, the winner succeeds while subsequent requests are safely rejected (HTTP 400 Bad Request) with full transaction rollback.
- **Tenant & Ownership Isolation:** Customers can only inspect their own orders; sweet shops can only view orders placed at their specific venue.
- **Order Lifecycle Transitions:** Allowed forward transitions (`PLACED` -> `CONFIRMED` -> `PREPARING` -> `OUT_FOR_DELIVERY` -> `DELIVERED`). Disallows illegal backward jumps.
- **Order Cancellation & Exact Restoration:** Cancelling eligible orders safely restores product inventory exactly once, while repeated cancellations or late cancellations are rejected.

---

## API Reference (Phase 8: Order Placement & Management)

### 10. Customer Order APIs (`/api/v1/orders`)

#### `POST /api/v1/orders`
- **Access:** Authenticated `CUSTOMER` (holding `create_customer_order` permission)
- **Request Body:**
```json
{
  "deliveryAddressId": "7b82f9d1-a3c5-4e7b-9c1a-2d3e4f5a6b7c"
}
```
- **Response (201 Created):**
```json
{
  "success": true,
  "message": "Sweet order placed successfully.",
  "data": {
    "id": "e5c2b1a8-4d3e-2f1a-0b9c-8d7e6f5a4b3c",
    "order_number": "SWT-20261012-A9F8B2",
    "user_id": "77777777-3333-3333-3333-000000000001",
    "seller_id": "aaaaaaaa-5555-5555-5555-000000000001",
    "recipient_name": "Amit Kumar",
    "recipient_phone": "+919876500001",
    "delivery_address_line_1": "House 12, Sector 14",
    "delivery_city": "Gurugram",
    "delivery_state": "Haryana",
    "delivery_pincode": "122001",
    "subtotal": "400.00",
    "packaging_charge": "15.00",
    "delivery_fee": "40.00",
    "gst_amount": "20.00",
    "total_amount": "475.00",
    "order_status": "PLACED",
    "payment_status": "PENDING",
    "created_at": "2026-10-12T10:15:00.000Z",
    "items": [
      {
        "id": "1a2b3c4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d",
        "product_id": "88888888-4444-4444-4444-000000000001",
        "product_name": "Besan Laddoo Box",
        "unit_price": "200.00",
        "quantity": 2,
        "item_total": "400.00"
      }
    ]
  }
}
```

#### `GET /api/v1/orders/my-orders`
- **Access:** Authenticated `CUSTOMER`
- **Query Params:** `status=PLACED`, `page=1`, `limit=20`
- **Response (200 OK):** Paginated array of orders placed by the authenticated customer.

#### `GET /api/v1/orders/my-orders/:orderId`
- **Access:** Authenticated `CUSTOMER` (strictly checks `user_id = req.user.id`)
- **Response (200 OK):** Order details including line item snapshot and delivery address snapshot.

#### `POST /api/v1/orders/my-orders/:orderId/cancel`
- **Access:** Authenticated `CUSTOMER`
- **Request Body:** `{ "reason": "Accidentally ordered double" }`
- **Response (200 OK):** Cancels order if still in `PLACED` state and restores inventory to stock.

---

### 11. Seller Order Management APIs (`/api/v1/orders`)

#### `GET /api/v1/orders/seller-orders`
- **Access:** Authenticated `SELLER`
- **Query Params:** `status=PLACED`, `page=1`, `limit=20`
- **Response (200 OK):** Paginated array of customer orders placed at this sweet shop.

#### `GET /api/v1/orders/seller-orders/:orderId`
- **Access:** Authenticated `SELLER` (strictly checks `seller_id = req.user.id`)
- **Response (200 OK):** Detailed order view including line items and customer contact details.

#### `PATCH /api/v1/orders/seller-orders/:orderId/status`
- **Access:** Authenticated `SELLER`
- **Request Body:**
```json
{
  "status": "CONFIRMED"
}
```
- **Allowed Transitions:**
  - `PLACED` -> `CONFIRMED` or `CANCELLED`
  - `CONFIRMED` -> `PREPARING` or `CANCELLED`
  - `PREPARING` -> `OUT_FOR_DELIVERY` or `CANCELLED`
  - `OUT_FOR_DELIVERY` -> `DELIVERED` or `CANCELLED`
  - `DELIVERED` & `CANCELLED` are terminal states.
- **Response (200 OK):** Returns updated order.

---

### 12. Run Payment Processing & Settlement Test Suite (Phase 9)
To run the automated tests for payment sessions, HMAC-SHA256 signature verification, idempotent webhooks, and vendor settlement accounting:
```bash
npm run test:payments
```
This suite verifies:
- **Payment Initiation:** Generates unique `PAY-` references, registers `INITIATED` records, and creates provider checkout URLs.
- **HMAC-SHA256 Signature Verification:** Constant-time verification of raw request payloads; rejects tampered and missing signatures with 401 INVALID_SIGNATURE.
- **Strict Verification:** Currency (INR) and amount matches verified against the live order before transitioning to `PAID`.
- **Idempotency & Replay Protection:** Replaying the same webhook `event_id` is acknowledged idempotently without double-charging or duplicating accounting entries.
- **Vendor Settlement Accounting:** Implements the 10% platform commission rule on subtotal; calculates 90% subtotal + packaging reimbursement to the sweet shop, and logs audit rows in `vendor_settlements`.
- **Financial RBAC Reporting:** Only users with `manage_financial_settlements` (Accountants, Super Admins) can query settlement aggregates.

---

## API Reference (Phase 9: Payments & Vendor Settlements)

### 12. Payment APIs (`/api/v1/payments`)

#### `POST /api/v1/payments/orders/:orderId/initiate`
- **Access:** Authenticated `CUSTOMER`
- **Response (200 OK):**
```json
{
  "success": true,
  "message": "Payment session initiated successfully.",
  "data": {
    "payment": {
      "id": "3a1b2c4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d",
      "order_id": "99999999-4444-4444-4444-000000000001",
      "payment_reference": "PAY-SWT-20261012-P9TEST-1791800000",
      "provider": "mock",
      "amount": "540.00",
      "currency": "INR",
      "status": "INITIATED"
    },
    "checkout": {
      "provider": "mock",
      "providerPaymentId": "mock_pay_1791800000_abc123",
      "checkoutUrl": "https://checkout.sweetshop.internal/mock-pay?ref=PAY-SWT-20261012-P9TEST-1791800000&id=mock_pay_1791800000_abc123"
    }
  }
}
```

#### `POST /api/v1/payments/webhook`
- **Access:** Public Payment Gateway Callback (Protected by HMAC-SHA256 Header)
- **Header:** `x-payment-signature: <hex_hmac_sha256_hash>`
- **Request Body:**
```json
{
  "eventId": "evt_1791800000_xyz",
  "eventType": "payment.captured",
  "data": {
    "paymentReference": "PAY-SWT-20261012-P9TEST-1791800000",
    "providerPaymentId": "mock_pay_1791800000_abc123",
    "amount": 540.00,
    "currency": "INR"
  }
}
```
- **Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "success": true,
    "eventId": "evt_1791800000_xyz",
    "eventType": "payment.captured"
  }
}
```

#### `GET /api/v1/payments/settlements`
- **Access:** Authenticated Staff (holding `manage_financial_settlements` permission)
- **Query Params:** `startDate`, `endDate`, `sellerId`
- **Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "metrics": {
      "totalOrdersSettled": 1,
      "totalGrossSales": "540.00",
      "totalPlatformCommission": "50.00",
      "totalVendorPayout": "465.00",
      "totalDeliveryFees": "0.00",
      "totalGstCollected": "25.00"
    },
    "settlements": [
      {
        "id": "4d5e6f7a-8b9c-0d1e-2f3a-4b5c6d7e8f9a",
        "order_id": "99999999-4444-4444-4444-000000000001",
        "seller_id": "99999999-1111-1111-1111-000000000001",
        "business_name": "Chhappan Bhog",
        "gross_order_amount": "540.00",
        "commission_rate": "10.00",
        "platform_commission": "50.00",
        "packaging_reimbursement": "15.00",
        "net_seller_payout": "465.00",
        "settlement_status": "PENDING_PAYOUT"
      }
    ]
  }
}
```

---

### 13. Delivery Tracking & Customer Support Tickets (Phase 10)

Phase 10 introduces the logistics fulfillment engine, rider assignment lifecycle, simulated GPS tracking, and a customer support ticketing system with message threads and staff resolution.

#### Run Phase 10 Test Suite
```bash
npm run test:delivery
```
This tests:
1. Delivery partner registration and listing with vehicle type and phone uniqueness.
2. Order eligibility checks for delivery assignment (`CONFIRMED` or `PREPARING` and `PAID`).
3. Conflicting and duplicate assignment prevention.
4. Delivery status state machine transitions: `ASSIGNED` -> `PICKED_UP` -> `IN_TRANSIT` -> `DELIVERED` (and `FAILED`).
5. Order status synchronization (`OUT_FOR_DELIVERY` upon `PICKED_UP`, `DELIVERED` upon completion).
6. Rider availability toggling (busy while delivering, freed upon delivery completion).
7. Prevention of unauthorized delivery status progression by customers.
8. Simulated GPS breadcrumb coordinate validation and live tracking queries with estimated arrival calculations.
9. Support ticket creation linked to orders, role-based ticket messaging, and staff resolution workflow.

---

### Delivery & Logistics API Endpoints

#### `POST /api/v1/deliveries/partners`
- **Access:** Admin / Super Admin (`ADMIN`, `SUPER_ADMIN`)
- **Request Body:**
```json
{
  "fullName": "Ramesh Kumar",
  "phone": "+919876543220",
  "email": "ramesh.rider@sweetshop.internal",
  "vehicleType": "BIKE",
  "vehicleNumber": "MH-02-AB-1234"
}
```
- **Response (201 Created):** Returns the registered partner record.

#### `GET /api/v1/deliveries/partners`
- **Access:** Authenticated Staff (`ADMIN`, `SUPER_ADMIN`)
- **Query Params:** `isAvailable=true` (optional filter)
- **Response (200 OK):** List of delivery partners.

#### `POST /api/v1/deliveries/orders/:orderId/assign`
- **Access:** Authenticated Staff or the Order's Seller
- **Request Body:**
```json
{
  "partnerId": "e3b0c442-98fc-1c14-9afbf4c8996fb924",
  "notes": "Fragile sweets, carry upright"
}
```
- **Response (201 Created):** Creates assignment, records initial audit log, sets partner `is_available = 0`.

#### `PUT /api/v1/deliveries/orders/:orderId/status`
- **Access:** Assigned Delivery Partner or Staff / Seller
- **Request Body:**
```json
{
  "status": "PICKED_UP",
  "reason": "Picked up fresh box from shop counter",
  "currentLatitude": 19.0760,
  "currentLongitude": 72.8777
}
```
- **Allowed Statuses:** `ASSIGNED`, `PICKED_UP`, `IN_TRANSIT`, `DELIVERED`, `FAILED`.

#### `PUT /api/v1/deliveries/orders/:orderId/location`
- **Access:** Assigned Delivery Partner
- **Request Body:**
```json
{
  "latitude": 19.0825,
  "longitude": 72.8850,
  "notes": "Approaching customer street"
}
```
- **Behavior:** Updates current delivery coordinates and appends a breadcrumb to `delivery_audit_logs`.

#### `GET /api/v1/deliveries/orders/:orderId/tracking`
- **Access:** Authenticated Customer (order owner), Assigned Partner, Seller, or Staff
- **Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "orderId": "99999999-4444-4444-4444-000000000001",
    "deliveryStatus": "IN_TRANSIT",
    "tracking": {
      "simulatedGps": true,
      "currentLatitude": "19.08250000",
      "currentLongitude": "72.88500000",
      "lastLocationUpdate": "2026-10-12T15:30:00.000Z",
      "estimatedMinutesRemaining": 12
    },
    "partner": {
      "name": "Ramesh Kumar",
      "phone": "+919876543220",
      "vehicleType": "BIKE",
      "vehicleNumber": "MH-02-AB-1234"
    },
    "auditTrail": [ ... ]
  }
}
```

---

### Customer Support Tickets API Endpoints

#### `POST /api/v1/support/tickets`
- **Access:** Authenticated Customer
- **Request Body:**
```json
{
  "orderId": "99999999-4444-4444-4444-000000000001",
  "subject": "Missing items in sweets box",
  "message": "I ordered 2 boxes of Kaju Katli but received only 1.",
  "priority": "HIGH"
}
```
- **Response (201 Created):** Creates support ticket with auto-generated reference (e.g. `TKT-20261012-123456`).

#### `GET /api/v1/support/my-tickets`
- **Access:** Authenticated Customer
- **Response (200 OK):** List of tickets filed by the customer with latest status and message count.

#### `POST /api/v1/support/tickets/:ticketId/messages`
- **Access:** Ticket Customer or Support Staff
- **Request Body:**
```json
{
  "message": "We have contacted the sweet shop vendor to dispatch the missing box immediately."
}
```

#### `PUT /api/v1/support/staff/tickets/:ticketId/status`
- **Access:** Authenticated Staff (`ADMIN`, `SUPER_ADMIN`)
- **Request Body:**
```json
{
  "status": "RESOLVED",
  "resolutionNotes": "Refund processed for missing box via payment gateway."
}
```










