import { Router } from 'express';
import { getAuthConfig, register, login, googleLogin, getSession, logout } from '../controllers/authController.js';
import { authLimiter, databaseReady, requireAuth } from '../middleware/auth.js';
import { resetRequestLimiter } from '../middleware/passwordReset.js';
import { forgotPassword, resetPassword } from '../controllers/passwordResetController.js';
import { verifyEmail, resendVerification } from '../controllers/emailVerificationController.js';
import { rateLimit } from 'express-rate-limit';
export function createAuthRouter() {
  const router = Router();
  const verificationLimiter = rateLimit({ windowMs: 15 * 60000, limit: 30, standardHeaders: 'draft-8', legacyHeaders: false, message: { error: 'Too many verification attempts. Please try again later.' } });
  const resendLimiter = rateLimit({ windowMs: 60 * 60000, limit: 10, standardHeaders: 'draft-8', legacyHeaders: false, message: { error: 'Too many code requests. Please try again later.' } });
  router.get("/config", getAuthConfig);
  router.post('/forgot-password', resetRequestLimiter, databaseReady, forgotPassword);
  router.post('/reset-password', authLimiter, databaseReady, resetPassword);
  router.post('/verify-email', verificationLimiter, databaseReady, verifyEmail);
  router.post('/resend-verification', resendLimiter, databaseReady, resendVerification);
  router.post("/register", authLimiter, databaseReady, register);
  router.post("/login", authLimiter, databaseReady, login);
  router.post("/google", authLimiter, databaseReady, googleLogin);
  router.get("/me", databaseReady, requireAuth, getSession);
  router.post("/logout", requireAuth, logout);
  return router;
}
