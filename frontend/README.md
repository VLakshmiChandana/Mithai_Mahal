# Sweet Shop Customer Web Application (Frontend)

Modern, accessible, and responsive React.js customer-facing website for the Sweet Shop Delivery Platform. Built with Vite, React 18, React Router v6, and Lucide Icons, connected to the Node.js Express & MySQL backend.

---

## 🍬 Overview

This frontend application covers the end-to-end customer purchasing experience:
1. **Public Discovery:** Browse sweet shops and category menus as a guest without requiring authentication.
2. **Customer Authentication:** Register as a customer under a sweet shop or login with JWT token lifecycle (access token + refresh token handling with token refresh queue).
3. **Shopping Cart & Single-Shop Rules:** Cart operations enforcing single-shop purchasing with interactive conflict resolution modals (`keep` or `clearAndReplace`).
4. **Delivery Addresses:** Manage shipping addresses (create, edit, delete, set default).
5. **Checkout & Order Placement:** Live pricing breakdown, address selection, atomic placement generating formatted order numbers (`SWT-YYYYMMDD-XXXX`).
6. **Payment Flow:** Seamless simulation through backend payment provider abstraction and webhook capture.
7. **Order History & Real-Time Tracking:** Timeline stepper, delivery partner telemetry, and interactive simulated GPS tracking map.
8. **Customer Support:** Raise tickets linked to orders and interact via message threads.

---

## 📁 Project Structure

```
sweet-shop-frontend/
├── public/
│   └── favicon.svg
├── src/
│   ├── api/
│   │   ├── client.js          # Central Axios client with session auth & refresh interceptor
│   │   ├── auth.api.js        # Register, login, refresh, logout, profile
│   │   ├── shops.api.js       # Public sweet shops listing & details
│   │   ├── catalog.api.js     # Categories & sweets catalog browsing
│   │   ├── cart.api.js        # Cart items, update quantity, conflict clearing
│   │   ├── address.api.js     # Customer delivery addresses CRUD
│   │   ├── order.api.js       # Checkout validation, order creation, list & details
│   │   ├── payment.api.js     # Payment initiation & mock capture
│   │   ├── delivery.api.js    # Delivery tracking & partner telemetry
│   │   └── support.api.js     # Customer tickets and conversation messaging
│   ├── components/
│   │   ├── common/            # Header, Footer, ProtectedRoute, Modal, Toast, Spinner, ErrorState
│   │   └── customer/          # ShopCard, ProductCard, ProductDetailModal, CategoryPills, ConflictDialog
│   ├── contexts/
│   │   ├── AuthContext.jsx    # Session state, login/logout, profile
│   │   ├── CartContext.jsx    # Live cart items, total calculation, conflict detection
│   │   └── ToastContext.jsx   # Non-intrusive alert toasts
│   ├── pages/
│   │   ├── HomePage.jsx           # Hero, curated sweet shops, featured categories
│   │   ├── ShopListPage.jsx       # Search & list sweet shops
│   │   ├── ShopDetailPage.jsx     # Shop catalog, sweet filtering, add to cart
│   │   ├── AuthPage.jsx           # Customer login & registration modal/views
│   │   ├── CartPage.jsx           # Cart line items, quantity adjustment, order summary
│   │   ├── AddressesPage.jsx      # Customer address management
│   │   ├── CheckoutPage.jsx       # Address selection, delivery charges, place order
│   │   ├── PaymentPage.jsx        # Mock payment gateway checkout simulation
│   │   ├── OrderSuccessPage.jsx   # Post-payment confirmation receipt
│   │   ├── OrdersPage.jsx         # Historical customer orders list
│   │   ├── OrderDetailPage.jsx    # Detailed bill snapshot & items breakdown
│   │   ├── TrackingPage.jsx       # Delivery status timeline & rider telemetry
│   │   ├── SupportPage.jsx        # Customer support ticket list & creation
│   │   └── TicketDetailPage.jsx   # Ticket message thread & replies
│   ├── styles/
│   │   ├── variables.css      # Design system tokens (maroon, warm cream, saffron gold)
│   │   └── index.css          # Global resets, typography, and utility classes
│   ├── App.jsx                # Router configuration & context providers
│   └── main.jsx               # React DOM entry point
├── index.html
├── package.json
└── vite.config.js             # Vite config with /api proxy to http://localhost:5000
```

---

## 🛠️ Prerequisites

- **Node.js**: v18.0.0 or higher
- **Backend Service**: Running on `http://localhost:5000` (`sweet-shop-backend`)
- **MySQL Database**: `sweet_shop_delivery` initialized and seeded

---

## 🚀 Quick Start

### 1. Install Dependencies
```bash
cd sweet-shop-frontend
npm install
```

### 2. Configure Environment (Optional)
The project includes a `.env` template:
```ini
VITE_API_BASE_URL=http://localhost:5000/api/v1
```
*Note: Vite dev server is preconfigured to proxy `/api` requests to `http://localhost:5000`.*

### 3. Start Development Server
```bash
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

### 4. Build for Production
```bash
npm run build
```
Generates production-ready, minified HTML/CSS/JS bundles in `dist/`.

---

## 🧪 Verification & Customer Journey Test

To verify complete end-to-end integration between frontend API contracts and backend database transactions, run the customer journey suite from the backend directory:
```bash
cd ../sweet-shop-backend
node scripts/test-phase11-customer-journey.js
```
Expected output: **24 PASSED, 0 FAILED**.

---

## 🔒 Security & Architecture Notes

- **Token Storage**: JWT access and refresh tokens are stored in `sessionStorage` for tab-scoped isolation. The Axios client automatically intercepts 401s, attempts silent token refresh against `/api/v1/auth/refresh`, and drains an in-flight request queue before falling back to login.
- **Single-Shop Cart Isolation**: If a customer attempts to add sweets from Shop B while their cart contains items from Shop A, the backend returns a 409 conflict. The frontend prompts the user to either cancel or automatically clear and re-initialize their cart for Shop B.
- **Server-Side Pricing**: Prices and item totals are calculated server-side from active database records during checkout. Client prices are treated purely as UI representations.
