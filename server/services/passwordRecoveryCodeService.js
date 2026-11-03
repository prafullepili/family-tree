import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import User from '../models/User.js';
import AuthSession from '../models/AuthSession.js';
import { hashPassword } from '../authSecurity.js';
import { sendPasswordResetEmail } from './gmailService.js';
import { emailVerificationConfigured } from './emailVerificationService.js';

export const passwordRecoveryConfigured = emailVerificationConfigured;
const digest = (user, code) => createHmac('sha256', process.env.EMAIL_OTP_SECRET)
  .update(`password-reset:${user._id}:${user.normalizedEmail}:${code}`).digest('hex');

export async function requestRecoveryCode(email) {
  const user = await User.findOne({ normalizedEmail: email });
  if (!user) return;
  const now = new Date();
  await User.updateOne({ _id: user._id, $or: [{ recoveryWindowAt: null }, { recoveryWindowAt: { $lt: new Date(now - 3600000) } }] }, { $set: { recoveryWindowAt: now, recoverySendCount: 0 } });
  const code = String(randomInt(0, 1000000)).padStart(6, '0');
  const hash = digest(user, code);
  const claimed = await User.findOneAndUpdate({
    _id: user._id, recoverySendCount: { $lt: 5 },
    $or: [{ recoverySentAt: null }, { recoverySentAt: { $lte: new Date(now - 60000) } }],
  }, { $set: { recoveryHash: hash, recoveryExpiresAt: new Date(+now + 300000), recoverySentAt: now, recoveryAttempts: 0 }, $inc: { recoverySendCount: 1 } });
  if (!claimed) return;
  try { await sendPasswordResetEmail(user.email, code); }
  catch {
    await User.updateOne({ _id: user._id, recoveryHash: hash }, { $unset: { recoveryHash: 1, recoveryExpiresAt: 1, recoverySentAt: 1 } });
    console.error('Password recovery email could not be delivered. Check Gmail configuration and SMTP access.');
  }
}

export async function applyRecoveryCode(email, code, password) {
  if (!passwordRecoveryConfigured()) return null;
  const user = await User.findOneAndUpdate({
    normalizedEmail: email, recoveryExpiresAt: { $gt: new Date() }, recoveryAttempts: { $lt: 5 },
  }, { $inc: { recoveryAttempts: 1 } }, { new: true }).select('+recoveryHash');
  if (!user?.recoveryHash) return null;
  const expected = Buffer.from(user.recoveryHash, 'hex');
  const supplied = Buffer.from(digest(user, code), 'hex');
  if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) return null;
  const passwordHash = await hashPassword(password);
  const updated = await User.findOneAndUpdate({ _id: user._id, recoveryHash: user.recoveryHash, recoveryAttempts: { $lte: 5 }, recoveryExpiresAt: { $gt: new Date() } }, {
    $set: { passwordHash }, $inc: { passwordVersion: 1 },
    $unset: { recoveryHash: 1, recoveryExpiresAt: 1, recoverySentAt: 1, recoveryAttempts: 1, resetTokenHash: 1, resetTokenExpiresAt: 1, resetRequestedAt: 1 },
  }, { new: true });
  if (!updated) return null;
  await AuthSession.deleteMany({ userId: user._id });
  return updated;
}
