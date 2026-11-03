import { setTimeout as delay } from 'node:timers/promises';
import { performance } from 'node:perf_hooks';
import { sessionCookie, isValidEmail, normalizeIdentity } from '../authSecurity.js';
import { applyPasswordReset } from '../services/passwordResetService.js';
import { passwordRecoveryConfigured, requestRecoveryCode, applyRecoveryCode } from '../services/passwordRecoveryCodeService.js';

export async function forgotPassword(req, res) {
  if (!passwordRecoveryConfigured()) return res.status(503).json({ error: 'Password recovery email is not configured. Use Google sign-in if linked, or contact the site owner.' });
  const email = normalizeIdentity(req.body?.email);
  if (!isValidEmail(email)) return res.status(400).json({ error: 'Enter a valid email address.' });
  requestRecoveryCode(email).catch(() => console.error('Password recovery request could not be processed.'));
  await delay(300);
  res.json({ message: 'If an account exists for this email, a reset code will arrive shortly. Check your inbox and spam folder.' });
}

export async function resetPassword(req, res, next) {
  try {
    const token = String(req.body?.token || '');
    const password = String(req.body?.password || '');
    const email = normalizeIdentity(req.body?.email);
    const code = String(req.body?.code || '');
    const legacy = Boolean(token);
    if (legacy ? !/^[A-Za-z0-9_-]{43}$/.test(token) : !isValidEmail(email) || !/^\d{6}$/.test(code)) return res.status(400).json({ error: 'Enter a valid reset link or your email and 6-digit code.' });
    if (password.length < 8 || password.length > 128) return res.status(400).json({ error: 'Password must be between 8 and 128 characters.' });
    const startedAt = performance.now();
    const user = legacy ? await applyPasswordReset(token, password) : await applyRecoveryCode(email, code, password);
    await delay(Math.max(0, 200 - (performance.now() - startedAt)));
    if (!user) return res.status(400).json({ error: 'The reset code or link is invalid, expired, or has reached its attempt limit. Request a new one.' });
    res.setHeader('Set-Cookie', sessionCookie('', { clear: true }));
    res.json({ message: 'Your password has been updated. Sign in with your new password.' });
  } catch (error) { next(error); }
}
