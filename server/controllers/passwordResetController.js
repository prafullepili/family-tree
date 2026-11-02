import { setTimeout as delay } from 'node:timers/promises';
import { performance } from 'node:perf_hooks';
import { isValidEmail, sessionCookie } from '../authSecurity.js';
import { applyPasswordReset, passwordResetConfigured, requestPasswordReset } from '../services/passwordResetService.js';

export async function forgotPassword(req, res, next) {
  try {
    if (!passwordResetConfigured()) return res.status(503).json({ error: 'Password recovery is not available yet. Please contact the site owner or use Google sign-in if your account is linked.' });
    const email = String(req.body?.email || '').trim();
    if (!isValidEmail(email)) return res.status(400).json({ error: 'Enter a valid email address.' });
    // Delivery runs separately so provider latency does not disclose account existence.
    requestPasswordReset(email).catch(() => console.error('Password reset request could not be processed.'));
    await delay(300);
    res.json({ message: 'If an account exists for this email, a password reset link will arrive shortly. Check your inbox and spam folder.' });
  } catch (error) { next(error); }
}

export async function resetPassword(req, res, next) {
  try {
    const token = String(req.body?.token || '');
    const password = String(req.body?.password || '');
    if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return res.status(400).json({ error: 'This reset link is invalid or expired. Request a new one.' });
    if (password.length < 8 || password.length > 128) return res.status(400).json({ error: 'Password must be between 8 and 128 characters.' });
    const startedAt = performance.now();
    const user = await applyPasswordReset(token, password);
    await delay(Math.max(0, 200 - (performance.now() - startedAt)));
    if (!user) return res.status(400).json({ error: 'This reset link is invalid or expired. Request a new one.' });
    res.setHeader('Set-Cookie', sessionCookie('', { clear: true }));
    res.json({ message: 'Your password has been updated. Sign in with your new password.' });
  } catch (error) { next(error); }
}
