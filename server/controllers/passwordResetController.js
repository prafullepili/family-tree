import { setTimeout as delay } from 'node:timers/promises';
import { performance } from 'node:perf_hooks';
import { sessionCookie } from '../authSecurity.js';
import { applyPasswordReset } from '../services/passwordResetService.js';

export function forgotPassword(_req, res) {
  res.status(503).json({ error: 'Password recovery email is not available. Please contact the site owner or use Google sign-in if your account is linked.' });
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
