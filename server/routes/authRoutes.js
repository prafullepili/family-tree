import { Router } from 'express';
import { getAuthConfig, register, login, googleLogin, getSession, logout } from '../controllers/authController.js';
import { authLimiter, databaseReady, requireAuth } from '../middleware/auth.js';
import { resetRequestLimiter } from '../middleware/passwordReset.js';
import { forgotPassword, resetPassword } from '../controllers/passwordResetController.js';
export function createAuthRouter() {
  const router = Router();
  router.get("/config", getAuthConfig);
  router.post('/forgot-password', resetRequestLimiter, databaseReady, forgotPassword);
  router.post('/reset-password', authLimiter, databaseReady, resetPassword);
  router.post("/register", authLimiter, databaseReady, register);
  router.post("/login", authLimiter, databaseReady, login);
  router.post("/google", authLimiter, databaseReady, googleLogin);
  router.get("/me", databaseReady, requireAuth, getSession);
  router.post("/logout", requireAuth, logout);
  return router;
}
