/**
 * Payment Provider Abstraction Layer
 * 
 * Supports:
 * - 'mock' (Default for local development & automated test suites)
 * - Extensible provider interface for production gateways (e.g. Razorpay / Stripe)
 * 
 * Webhook Signature Verification:
 * Standard Razorpay-compatible HMAC-SHA256 signature verification over raw request body:
 * hex(HMAC-SHA256(rawBody, webhookSecret)) === signatureHeader
 */

const crypto = require('crypto');
const config = require('../config/env');

class PaymentProvider {
  /**
   * Create checkout/payment intent session with provider
   * @param {Object} options - { paymentReference, orderNumber, amount, currency, customer }
   * @returns {Promise<{ providerPaymentId: string, checkoutUrl: string, clientSecret: string }>}
   */
  async createPaymentSession(options) {
    throw new Error('createPaymentSession must be implemented by payment provider');
  }

  /**
   * Verify authenticity of incoming webhook payload
   * @param {Buffer|string} rawBody - Raw unparsed request body
   * @param {string} signature - Header signature sent by provider
   * @param {string} secret - Webhook secret key
   * @returns {boolean}
   */
  verifyWebhookSignature(rawBody, signature, secret) {
    throw new Error('verifyWebhookSignature must be implemented by payment provider');
  }
}

/**
 * Mock Payment Provider
 * Safely simulates checkout flows, payment tokens, and HMAC-SHA256 webhooks for local/test environments
 */
class MockPaymentProvider extends PaymentProvider {
  constructor() {
    super();
    this.name = 'mock';
  }

  async createPaymentSession({ paymentReference, orderNumber, amount, currency, customer }) {
    // Generate deterministic mock gateway transaction ID
    const providerPaymentId = `order_rzp_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    return {
      provider: 'razorpay_mock',
      providerPaymentId,
      razorpayOrderId: providerPaymentId,
      keyId: config.payment.razorpayKeyId,
      checkoutUrl: `https://checkout.sweetshop.internal/mock-pay?ref=${paymentReference}&id=${providerPaymentId}`,
      clientSecret: `mock_sec_${Math.random().toString(36).substring(2, 10)}`,
      amount,
      currency,
      customer
    };
  }

  /**
   * Standard HMAC-SHA256 signature verification over raw payload
   */
  verifyWebhookSignature(rawBody, signature, secret) {
    if (!signature || !secret || !rawBody) return false;

    const payload = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(typeof rawBody === 'string' ? rawBody : JSON.stringify(rawBody), 'utf8');
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');

    // Constant-time buffer comparison to prevent timing attacks
    const sigBuffer = Buffer.from(signature, 'hex');
    const expectedBuffer = Buffer.from(expectedSignature, 'hex');

    if (sigBuffer.length !== expectedBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(sigBuffer, expectedBuffer);
  }
}

/**
 * Official Razorpay Payment Provider (Supports Test Mode & Live Mode via HTTPS API)
 * Zero third-party library overhead, uses native Node.js https and crypto modules.
 */
class RazorpayProvider extends PaymentProvider {
  constructor() {
    super();
    this.name = 'razorpay';
    this.keyId = config.payment.razorpayKeyId;
    this.keySecret = config.payment.razorpayKeySecret;
  }

  /**
   * Create Razorpay Order via official Orders API: POST https://api.razorpay.com/v1/orders
   * Amount must be integer in smallest currency unit (paise: ₹1 = 100 paise)
   */
  async createPaymentSession({ paymentReference, orderNumber, amount, currency, customer }) {
    const https = require('https');
    const amountInPaise = Math.round(Number(amount) * 100);

    const postData = JSON.stringify({
      amount: amountInPaise,
      currency: currency || 'INR',
      receipt: paymentReference,
      notes: {
        orderNumber,
        platform: 'Mithai Mahal Sweets'
      }
    });

    const authHeader = Buffer.from(`${this.keyId}:${this.keySecret}`).toString('base64');

    return new Promise((resolve, reject) => {
      const req = https.request({
        hostname: 'api.razorpay.com',
        port: 443,
        path: '/v1/orders',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData),
          'Authorization': `Basic ${authHeader}`
        }
      }, (res) => {
        let responseBody = '';
        res.on('data', (chunk) => { responseBody += chunk; });
        res.on('end', () => {
          try {
            const data = JSON.parse(responseBody);
            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve({
                provider: 'razorpay',
                providerPaymentId: data.id, // e.g. order_EKwxwAgIt4KOqm
                razorpayOrderId: data.id,
                keyId: this.keyId,
                amount: Number(amount),
                currency: data.currency,
                receipt: data.receipt,
                status: data.status,
                customer
              });
            } else {
              const errMsg = data.error?.description || data.error?.message || `Razorpay API error (${res.statusCode})`;
              reject(new Error(errMsg));
            }
          } catch (parseErr) {
            reject(new Error(`Failed to parse Razorpay API response: ${parseErr.message}`));
          }
        });
      });

      req.on('error', (err) => {
        reject(new Error(`Razorpay network communication failed: ${err.message}`));
      });

      req.setTimeout(10000, () => {
        req.destroy(new Error('Razorpay API request timed out after 10000ms'));
      });

      req.write(postData);
      req.end();
    });
  }

  /**
   * Verify authenticity of incoming Razorpay Webhook signature over raw payload:
   * hex(HMAC-SHA256(rawBody, webhookSecret)) === signatureHeader
   */
  verifyWebhookSignature(rawBody, signature, secret) {
    if (!signature || !secret || !rawBody) return false;

    const payload = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(typeof rawBody === 'string' ? rawBody : JSON.stringify(rawBody), 'utf8');
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');

    const sigBuffer = Buffer.from(signature, 'hex');
    const expectedBuffer = Buffer.from(expectedSignature, 'hex');

    if (sigBuffer.length !== expectedBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(sigBuffer, expectedBuffer);
  }

  /**
   * Verify client checkout payment signature:
   * hex(HMAC-SHA256(razorpay_order_id + "|" + razorpay_payment_id, keySecret)) === razorpay_signature
   */
  verifyPaymentSignature(orderId, paymentId, signature) {
    if (!orderId || !paymentId || !signature) return false;

    const payload = `${orderId}|${paymentId}`;
    const expectedSignature = crypto
      .createHmac('sha256', this.keySecret)
      .update(payload)
      .digest('hex');

    const sigBuffer = Buffer.from(signature, 'hex');
    const expectedBuffer = Buffer.from(expectedSignature, 'hex');

    if (sigBuffer.length !== expectedBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(sigBuffer, expectedBuffer);
  }
}

// Factory function returning active provider instance based on environment configuration
function getPaymentProvider() {
  const providerType = config.payment.provider.toLowerCase();
  switch (providerType) {
    case 'razorpay':
      return new RazorpayProvider();
    case 'mock':
    default:
      return new MockPaymentProvider();
  }
}

module.exports = {
  PaymentProvider,
  MockPaymentProvider,
  RazorpayProvider,
  getPaymentProvider
};
