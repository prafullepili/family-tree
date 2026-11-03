import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import User from '../models/User.js';
import { gmailConfigured, sendVerificationEmail } from './gmailService.js';

export const emailVerificationRequired = () => process.env.EMAIL_VERIFICATION_REQUIRED !== 'false';
export const emailVerificationConfigured = () => gmailConfigured() && String(process.env.EMAIL_OTP_SECRET || '').length >= 32;
const digest = (user, code) => createHmac('sha256', process.env.EMAIL_OTP_SECRET)
  .update(`verify-email:${user._id}:${user.normalizedEmail}:${code}`).digest('hex');

export async function issueVerificationCode(user) {
  if (!emailVerificationConfigured()) throw Object.assign(Error('Email verification delivery is not configured. Use Google sign-in or contact the site owner.'), { status: 503 });
  const now = new Date();
  await User.updateOne({ _id: user._id, $or: [{ verificationWindowAt: null }, { verificationWindowAt: { $lt: new Date(now - 3600000) } }] },
    { $set: { verificationWindowAt: now, verificationSendCount: 0 } });
  const code = String(randomInt(0, 1000000)).padStart(6, '0');
  const hash = digest(user, code);
  const claimed = await User.findOneAndUpdate({
    _id: user._id, emailVerificationRequired: true, verificationSendCount: { $lt: 5 },
    $or: [{ verificationSentAt: null }, { verificationSentAt: { $lte: new Date(now - 60000) } }],
  }, { $set: { verificationHash: hash, verificationExpiresAt: new Date(+now + 300000), verificationSentAt: now, verificationAttempts: 0 }, $inc: { verificationSendCount: 1 } });
  if (!claimed) throw Object.assign(Error('Please wait before requesting another code. You can request up to 5 codes per hour.'), { status: 429 });
  try {
    await sendVerificationEmail(user.email, code);
  } catch {
    await User.updateOne({ _id: user._id, verificationHash: hash }, { $unset: { verificationHash: 1, verificationExpiresAt: 1, verificationSentAt: 1 } });
    throw Object.assign(Error('Could not send the verification email. Please try again later or use Google sign-in.'), { status: 503 });
  }
}

export async function consumeVerificationCode(email, code) {
  if (!emailVerificationConfigured()) return null;
  const user = await User.findOneAndUpdate({
    normalizedEmail: email, emailVerificationRequired: true,
    verificationExpiresAt: { $gt: new Date() }, verificationAttempts: { $lt: 5 },
  }, { $inc: { verificationAttempts: 1 } }, { new: true }).select('+verificationHash +passwordHash');
  if (!user?.verificationHash) return null;
  const expected = Buffer.from(user.verificationHash, 'hex');
  const supplied = Buffer.from(digest(user, code), 'hex');
  if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) return null;
  return User.findOneAndUpdate({ _id: user._id, emailVerificationRequired: true, verificationHash: user.verificationHash, verificationAttempts: { $lte: 5 }, verificationExpiresAt: { $gt: new Date() } }, {
    $set: { emailVerifiedAt: new Date(), emailVerificationRequired: false },
    $unset: { verificationHash: 1, verificationExpiresAt: 1, verificationSentAt: 1, verificationAttempts: 1 },
  }, { new: true }).select('+passwordHash');
}
