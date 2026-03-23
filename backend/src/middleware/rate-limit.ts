import rateLimit from 'express-rate-limit';
import { RATE_LIMITS } from '../utils/constants';

/**
 * Default rate limiter: 100 requests per 15 minutes per IP.
 */
export const defaultLimiter = rateLimit({
  windowMs: RATE_LIMITS.DEFAULT_WINDOW_MS,
  max: RATE_LIMITS.DEFAULT_MAX_REQUESTS,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: { code: 'RATE_LIMIT', message: 'Too many requests, please try again later', requestId: '' },
  },
});

/**
 * Hedera rate limiter: 20 requests per 15 minutes per IP.
 * For endpoints that trigger on-chain transactions.
 */
export const hederaLimiter = rateLimit({
  windowMs: RATE_LIMITS.DEFAULT_WINDOW_MS,
  max: RATE_LIMITS.HEDERA_MAX_REQUESTS,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: { code: 'RATE_LIMIT', message: 'Hedera transaction rate limit exceeded, please try again later', requestId: '' },
  },
});
