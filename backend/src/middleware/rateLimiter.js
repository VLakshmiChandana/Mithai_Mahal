/**
 * In-Memory Sliding-Window Rate Limiter Middleware
 * 
 * Protects public and sensitive authentication endpoints from brute force and denial of service attacks.
 * Features:
 * - Zero external dependency overhead.
 * - Standard RateLimit-* HTTP response headers.
 * - Sliding window calculation.
 * - Whitelist support for health check endpoints.
 */

class MemoryRateLimiter {
  constructor(windowMs = 60 * 1000, maxRequests = 100, message = 'Too many requests from this IP, please try again later.') {
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;
    this.message = message;
    this.clients = new Map();

    // Periodic sweep to prevent memory leak
    const timer = setInterval(() => this.cleanup(), windowMs * 2);
    if (timer.unref) timer.unref();
  }

  cleanup() {
    const now = Date.now();
    for (const [key, record] of this.clients.entries()) {
      if (now - record.startTime > this.windowMs) {
        this.clients.delete(key);
      }
    }
  }

  middleware() {
    return (req, res, next) => {
      // Don't rate limit health checks
      if (req.path === '/health' || req.path === '/api/v1/health') {
        return next();
      }

      // Identify client by IP (respects standard x-forwarded-for behind reverse proxy)
      const ip = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket.remoteAddress || '127.0.0.1';
      const key = `${ip}:${req.baseUrl || ''}`;
      const now = Date.now();

      let record = this.clients.get(key);

      if (!record || now - record.startTime > this.windowMs) {
        record = {
          startTime: now,
          count: 1
        };
        this.clients.set(key, record);
      } else {
        record.count++;
      }

      const remaining = Math.max(0, this.maxRequests - record.count);
      const resetTime = Math.ceil((record.startTime + this.windowMs - now) / 1000);

      res.setHeader('RateLimit-Limit', this.maxRequests);
      res.setHeader('RateLimit-Remaining', remaining);
      res.setHeader('RateLimit-Reset', resetTime);

      if (record.count > this.maxRequests) {
        res.setHeader('Retry-After', resetTime);
        return res.status(429).json({
          success: false,
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: this.message,
            retryAfterSeconds: resetTime
          }
        });
      }

      next();
    };
  }
}

// Global API rate limiter: 300 requests per minute per IP
const globalLimiter = new MemoryRateLimiter(60 * 1000, 300, 'Too many requests. Please slow down.').middleware();

// Sensitive Auth rate limiter (login / refresh / customer register): 30 attempts per 5 minutes per IP
const authLimiter = new MemoryRateLimiter(5 * 60 * 1000, 30, 'Too many authentication attempts. Please try again in 5 minutes.').middleware();

module.exports = {
  MemoryRateLimiter,
  globalLimiter,
  authLimiter
};
