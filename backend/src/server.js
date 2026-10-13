/**
 * Express application entry point.
 * Features:
 * - JSON body parser
 * - Health check endpoint (GET /health) verifying database connectivity
 * - 404 handler for unknown routes
 * - Centralized error handler preventing stack trace and credential leaks
 */

const express = require('express');
const config = require('./config/env');
const { testConnection } = require('./config/db');

const app = express();

// Middleware: Security headers (equivalent to Helmet with OWASP recommended directives)
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' https://checkout.razorpay.com; connect-src 'self' https://api.razorpay.com; frame-src https://api.razorpay.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:;");
  next();
});

// Middleware: Structured JSON logging in production / clean dev console logging
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (config.nodeEnv === 'production') {
      console.log(JSON.stringify({
        level: res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info',
        timestamp: new Date().toISOString(),
        method: req.method,
        path: req.originalUrl || req.url,
        statusCode: res.statusCode,
        durationMs: duration,
        ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress
      }));
    }
  });
  next();
});

// Middleware: Production CORS headers with origin whitelist support
const allowedOrigins = process.env.CORS_ALLOWED_ORIGINS
  ? process.env.CORS_ALLOWED_ORIGINS.split(',').map(s => s.trim())
  : ['http://localhost:5173', 'http://localhost:3000', 'http://127.0.0.1:5173'];

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (config.nodeEnv === 'production' && process.env.CORS_ALLOWED_ORIGINS) {
    if (origin && allowedOrigins.includes(origin)) {
      res.header('Access-Control-Allow-Origin', origin);
    }
  } else {
    res.header('Access-Control-Allow-Origin', origin || '*');
  }
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, x-payment-signature, x-razorpay-signature, x-device-id');
  res.header('Access-Control-Allow-Credentials', 'true');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});

// Middleware: Global Rate Limiting
const { globalLimiter, authLimiter } = require('./middleware/rateLimiter');
app.use(globalLimiter);

// Middleware: parse incoming JSON requests (preserves rawBody for webhook HMAC verification)
app.use(express.json({
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}));

// Middleware: serve static public assets (sweet images, logos, svgs)
const path = require('path');
app.use(express.static(path.join(__dirname, '../public')));

// Health Check Endpoint: GET /health
app.get('/health', async (req, res, next) => {
  try {
    const dbStatus = await testConnection();
    return res.status(200).json({
      status: 'UP',
      timestamp: new Date().toISOString(),
      environment: config.nodeEnv,
      database: {
        status: 'CONNECTED',
        name: dbStatus.database,
        version: dbStatus.version
      }
    });
  } catch (error) {
    // If the database cannot connect, report DEGRADED/DOWN status safely
    return res.status(503).json({
      status: 'DEGRADED',
      timestamp: new Date().toISOString(),
      environment: config.nodeEnv,
      database: {
        status: 'DISCONNECTED',
        error: error.message
      }
    });
  }
});

// Mount API Routes
const authRoutes = require('./routes/auth.routes');
const staffRoutes = require('./routes/staff.routes');
const sellerRoutes = require('./routes/seller.routes');
const customerRoutes = require('./routes/customer.routes');
const { categoryRouter, productRouter } = require('./routes/catalog.routes');
const cartRoutes = require('./routes/cart.routes');
const addressRoutes = require('./routes/address.routes');
const orderRoutes = require('./routes/order.routes');
const paymentRoutes = require('./routes/payment.routes');
const deliveryRoutes = require('./routes/delivery.routes');
const supportRoutes = require('./routes/support.routes');
const superAdminRoutes = require('./routes/super-admin.routes');
const adminDashboardRoutes = require('./routes/admin-dashboard.routes');
const uploadRoutes = require('./routes/upload.routes');

app.use('/api/v1/auth', authLimiter, authRoutes);
app.use('/api/v1/staff', staffRoutes);
app.use('/api/v1/sellers', sellerRoutes);
app.use('/api/v1/customers', customerRoutes);
app.use('/api/v1/categories', categoryRouter);
app.use('/api/v1/products', productRouter);
app.use('/api/v1/cart', cartRoutes);
app.use('/api/v1/addresses', addressRoutes);
app.use('/api/v1/orders', orderRoutes);
app.use('/api/v1/payments', paymentRoutes);
app.use('/api/v1/deliveries', deliveryRoutes);
app.use('/api/v1/support', supportRoutes);
app.use('/api/v1/super-admin', superAdminRoutes);
app.use('/api/v1/admin/dashboard', adminDashboardRoutes);
app.use('/api/v1/uploads', uploadRoutes);

// Public Sweet Shop Discovery alias (/api/v1/shops)
const sellerController = require('./controllers/seller.controller');
app.get('/api/v1/shops', sellerController.listPublicShops);
app.get('/api/v1/shops/:sellerId', sellerController.getPublicShopDetails);

const { errorHandler, NotFoundError } = require('./middleware/errorHandler');

// 404 Handler for undefined routes
app.use((req, res, next) => {
  next(new NotFoundError(`Cannot ${req.method} ${req.originalUrl}`));
});

// Centralized Error Handling Middleware
app.use(errorHandler);

// Start the HTTP server only if executed directly
if (require.main === module) {
  app.listen(config.port, () => {
    console.log(`[Sweet Shop Backend] Server listening on port ${config.port} (${config.nodeEnv})`);
  });
}

module.exports = app;
