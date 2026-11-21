import { ipKeyGenerator, rateLimit, type Options } from 'express-rate-limit';
import { env } from '../config/env.js';

const MINUTE = 60_000;

const base: Partial<Options> = {
  windowMs: MINUTE,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skip: () => !env.RATE_LIMIT_ENABLED,
  handler: (_req, res) => {
    res.status(429).json({
      success: false,
      data: null,
      error: { code: 'RATE_LIMITED', message: 'Too many requests. Please wait a moment and try again.' },
      meta: {},
    });
  },
};

/*
 * Per-IP limits are looser than the security document's targets because a venue or
 * campus network puts many people behind one public IP. Per-account limits stay strict.
 */
export const loginIpLimiter = rateLimit({ ...base, limit: 30 });

export const loginAccountLimiter = rateLimit({
  ...base,
  limit: 10,
  keyGenerator: (req) => {
    const username = typeof req.body?.username === 'string' ? req.body.username : '';
    return `${ipKeyGenerator(req.ip ?? 'unknown')}|${username.trim().toLowerCase().slice(0, 30)}`;
  },
});

export const registerLimiter = rateLimit({ ...base, limit: 10 });

export const refreshLimiter = rateLimit({ ...base, limit: 60 });

const perUser: Options['keyGenerator'] = (req) =>
  req.auth?.userId ?? ipKeyGenerator(req.ip ?? 'unknown');

/** Must run after `authenticate`. */
export const uploadLimiter = rateLimit({ ...base, limit: 10, keyGenerator: perUser });

/** Placing an order reserves stock, so each customer gets a small budget. Runs after `authenticate`. */
export const checkoutLimiter = rateLimit({ ...base, limit: 10, keyGenerator: perUser });

export const apiLimiter = rateLimit({ ...base, limit: 300 });

/** Shopping assistant. Public, so the limit is per IP (docs/09 §9.5). */
export const aiChatLimiter = rateLimit({ ...base, limit: 20 });
