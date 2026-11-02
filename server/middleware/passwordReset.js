import { rateLimit } from 'express-rate-limit';

export const resetRequestLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many password recovery requests. Please try again in 15 minutes.' },
});
