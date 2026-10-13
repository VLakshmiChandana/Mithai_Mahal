/**
 * Environment configuration loader and validator.
 * Validates required variables and fails safely on startup if critical configs are missing.
 * Prevents password or secret leakage into logs.
 */

const path = require('path');
const dotenv = require('dotenv');

// Load .env file from project root
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const requiredEnvVars = [
  'DB_HOST',
  'DB_USER',
  'DB_NAME',
  'JWT_ACCESS_SECRET',
  'JWT_REFRESH_SECRET'
];

const missingVars = requiredEnvVars.filter(varName => !process.env[varName] || process.env[varName].trim() === '');

if (missingVars.length > 0) {
  // Safe error reporting: never print current variable values or credentials
  console.error('[FATAL CONFIG ERROR] Missing required environment variables in .env:');
  missingVars.forEach(v => console.error(`  - ${v}`));
  console.error('\nPlease copy .env.example to .env and configure the required settings.\n');
  process.exit(1);
}

module.exports = {
  port: parseInt(process.env.PORT, 10) || 5000,
  nodeEnv: process.env.NODE_ENV || 'development',
  db: {
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT, 10) || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME,
    connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT, 10) || 10,
    waitForConnections: true,
    queueLimit: 0
  },
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET,
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d'
  },
  payment: {
    provider: process.env.PAYMENT_PROVIDER || 'mock',
    webhookSecret: process.env.PAYMENT_WEBHOOK_SECRET || 'dev_mock_webhook_secret_key_12345',
    commissionRatePercent: parseFloat(process.env.PLATFORM_COMMISSION_PERCENT) || 10.0,
    razorpayKeyId: process.env.RAZORPAY_KEY_ID || 'rzp_test_Tmz9SmPPkoO88p',
    razorpayKeySecret: process.env.RAZORPAY_KEY_SECRET || 'ml3sZ9oT4LuO6p0gJ6xpmbPE'
  }
};
