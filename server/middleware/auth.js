import { rateLimit } from 'express-rate-limit';
import mongoose from 'mongoose';
import AuthSession from '../models/AuthSession.js';
import User from '../models/User.js';
import { SESSION_COOKIE, hashToken, parseCookies, sessionCookie } from '../authSecurity.js';
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: {
    error: 'Too many sign-in attempts. Please wait a few minutes and try again.'
  }
});
export function databaseReady(_req, res, next) {
  if (mongoose.connection.readyState !== 1) return res.status(503).json({
    error: 'The account service is temporarily unavailable.'
  });
  next();
}
export async function requireAuth(req, res, next) {
  if (mongoose.connection.readyState !== 1) return res.status(503).json({
    error: 'The account service is temporarily unavailable.'
  });
  try {
    const token = parseCookies(req.headers.cookie)[SESSION_COOKIE];
    if (!token) return res.status(401).json({
      error: 'Please sign in to continue.'
    });
    const session = await AuthSession.findOne({
      tokenHash: hashToken(token),
      expiresAt: {
        $gt: new Date()
      }
    });
    if (!session) {
      res.setHeader('Set-Cookie', sessionCookie('', {
        clear: true
      }));
      return res.status(401).json({
        error: 'Your session has expired. Please sign in again.'
      });
    }
    const user = await User.findById(session.userId).select('+passwordHash');
    if (!user || (session.passwordVersion || 0) !== (user.passwordVersion || 0)) {
      await AuthSession.deleteOne({
        _id: session._id
      });
      res.setHeader('Set-Cookie', sessionCookie('', {
        clear: true
      }));
      return res.status(401).json({
        error: 'Please sign in to continue.'
      });
    }
    if (user.emailVerificationRequired) return res.status(403).json({ error: 'Verify your email before accessing your trees.' });
    if (!SAFE_METHODS.has(req.method)) {
      const csrfToken = String(req.get('x-csrf-token') || '');
      if (!csrfToken || hashToken(csrfToken) !== hashToken(session.csrfToken)) return res.status(403).json({
        error: 'The security token is missing or expired. Refresh and try again.'
      });
    }
    req.user = user;
    req.authSession = session;
    next();
  } catch (error) {
    next(error);
  }
}
export { authLimiter };
