import User from '../models/User.js';
import AuthSession from '../models/AuthSession.js';
import { hashPassword, hashToken, randomToken, normalizeIdentity } from '../authSecurity.js';

export function passwordResetConfigured() {
  try {
    const url = new URL(process.env.PUBLIC_APP_URL);
    return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM &&
      (url.protocol === 'https:' || (process.env.NODE_ENV !== 'production' && url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname))));
  } catch { return false; }
}

export async function sendAccountEmail(to, subject, text) {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: process.env.EMAIL_FROM, to: [to], subject, text }),
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw Error('Account email delivery failed.');
}

export async function requestPasswordReset(email) {
  const token = randomToken();
  const tokenHash = hashToken(token);
  const user = await User.findOneAndUpdate({
    normalizedEmail: normalizeIdentity(email),
    $or: [{ resetRequestedAt: null }, { resetRequestedAt: { $lt: new Date(Date.now() - 60000) } }],
  }, { $set: { resetTokenHash: tokenHash, resetTokenExpiresAt: new Date(Date.now() + 30 * 60000), resetRequestedAt: new Date() } }, { new: true });
  if (!user) return;
  const link = new URL(process.env.PUBLIC_APP_URL);
  link.search = '';
  link.hash = `reset-password=${token}`;
  try {
    await sendAccountEmail(user.email, 'Reset your VanshLink password',
      `A password reset was requested for your VanshLink account.\n\nChoose a new password: ${link.href}\n\nThis link expires in 30 minutes and can be used once. If you did not request this, ignore this email. Your password has not changed.`);
  } catch {
    await User.updateOne({ _id: user._id, resetTokenHash: tokenHash }, { $unset: { resetTokenHash: 1, resetTokenExpiresAt: 1, resetRequestedAt: 1 } });
    console.error('Password reset email could not be delivered. Check the email provider configuration.');
  }
}

export async function applyPasswordReset(token, password) {
  const tokenHash = hashToken(token);
  const filter = { resetTokenHash: tokenHash, resetTokenExpiresAt: { $gt: new Date() } };
  if (!await User.exists(filter)) return null;
  const passwordHash = await hashPassword(password);
  const user = await User.findOneAndUpdate({ ...filter, resetTokenExpiresAt: { $gt: new Date() } }, {
    $set: { passwordHash }, $inc: { passwordVersion: 1 },
    $unset: { resetTokenHash: 1, resetTokenExpiresAt: 1, resetRequestedAt: 1 },
  }, { new: true });
  if (!user) return null;
  await AuthSession.deleteMany({ userId: user._id });
  sendAccountEmail(user.email, 'Your VanshLink password was changed',
    'Your VanshLink password has been changed and existing sessions have been signed out. If you did not make this change, reset your password immediately.').catch(() => console.error('Password change notification could not be delivered.'));
  return user;
}
