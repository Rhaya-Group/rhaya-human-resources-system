// backend/src/middleware/rateLimiter.js
import rateLimit from "express-rate-limit";

/**
 * Rate limiter for login endpoint
 * 5 attempts per 15 minutes per IP
 */
export const loginLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 15 minutes
  max: 10,
  message: {
    error:
      "Too many login attempts from this IP, please try again after 15 minutes.",
  },
  standardHeaders: true, // Return rate limit info in headers
  legacyHeaders: false,
  skipSuccessfulRequests: false, // Count successful requests
  skipFailedRequests: false, // Count failed requests
});

/**
 * Rate limiter for forgot password endpoint
 * 3 attempts per hour per IP
 */
export const forgotPasswordLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3,
  message: {
    error:
      "Too many password reset requests from this IP, please try again after 1 hour.",
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
});

/**
 * Rate limiter for reset password endpoint
 * 5 attempts per hour per IP
 */
export const resetPasswordLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  message: {
    error:
      "Too many password reset attempts from this IP, please try again after 1 hour.",
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
});

/**
 * Rate limiter for change password endpoint
 * 10 attempts per hour per user
 */
export const changePasswordLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  message: {
    error: "Too many password change attempts, please try again after 1 hour.",
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
});

/**
 * General API rate limiter
 * 100 requests per 15 minutes per IP
 */
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000,
  message: {
    error: "Too many requests from this IP, please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Don't count successful requests for general limiter
});

/**
 * Rate limiter for internal API endpoints
 * Limits requests per client (identified by X-Client-Id or IP)
 */
export const internalApiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute per client

  // Use client ID if authenticated, otherwise IP
  keyGenerator: (req) => {
    return req.clientId || req.ip;
  },

  // Custom message
  message: {
    error: "Too many requests from this client",
    retryAfter: 60,
  },

  // Standard headers
  standardHeaders: true,
  legacyHeaders: false,

  // Skip successful requests from counting (optional - be more lenient)
  skipSuccessfulRequests: false,

  // Skip failed requests from counting (optional)
  skipFailedRequests: false,

  // Custom handler for when limit is exceeded
  handler: (req, res) => {
    console.warn("[RateLimit] Limit exceeded", {
      clientId: req.clientId || "unknown",
      ip: req.ip,
      path: req.originalUrl,
      method: req.method,
    });

    res.status(429).json({
      error: "Too many requests",
      retryAfter: 60,
      message: "Please wait before making more requests",
    });
  },
});

/**
 * Stricter rate limiter for resource-intensive endpoints
 * (e.g., full employee list without filters)
 */
export const strictInternalApiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20, // 20 requests per minute

  keyGenerator: (req) => req.clientId || req.ip,

  message: {
    error: "Rate limit exceeded for this endpoint",
    retryAfter: 60,
  },

  standardHeaders: true,
  legacyHeaders: false,

  handler: (req, res) => {
    console.warn("[RateLimit] Strict limit exceeded", {
      clientId: req.clientId || "unknown",
      ip: req.ip,
      path: req.originalUrl,
    });

    res.status(429).json({
      error: "Rate limit exceeded",
      retryAfter: 60,
      message:
        "This endpoint has stricter rate limits. Please reduce request frequency.",
    });
  },
});

export default {
  loginLimiter,
  forgotPasswordLimiter,
  resetPasswordLimiter,
  changePasswordLimiter,
  generalLimiter,
  internalApiLimiter,
  strictInternalApiLimiter,
};
