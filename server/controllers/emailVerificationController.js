import User from '../models/User.js';
import { normalizeIdentity, isValidEmail } from '../authSecurity.js';
import { consumeVerificationCode, issueVerificationCode } from '../services/emailVerificationService.js';
import { createSession, claimLegacyTree } from '../services/authService.js';

export async function verifyEmail(req, res, next) {
  try {
    const email = normalizeIdentity(req.body?.email);
    const code = String(req.body?.code || '');
    if (!isValidEmail(email) || !/^\d{6}$/.test(code)) return res.status(400).json({ error: 'Enter your email and the 6-digit code.' });
    const user = await consumeVerificationCode(email, code);
    if (!user) return res.status(400).json({ error: 'The code is invalid, expired, or has reached its attempt limit. Request a new code.' });
    user.lastLoginAt = new Date();
    await user.save();
    await claimLegacyTree(user);
    res.json(await createSession(user, req, res));
  } catch (error) { next(error); }
}

export async function resendVerification(req, res, next) {
  try {
    const email = normalizeIdentity(req.body?.email);
    if (!isValidEmail(email)) return res.status(400).json({ error: 'Enter a valid email address.' });
    const user = await User.findOne({ normalizedEmail: email, emailVerificationRequired: true });
    if (user) {
      try { await issueVerificationCode(user); }
      catch (error) {
        // Do not reveal whether an account exists or is already verified.
        console.error('Verification email was not sent:', error.status || 503);
      }
    }
    res.json({ message: 'If verification is pending, a code will be sent. Wait 60 seconds between requests; delivery is limited to 5 codes per hour.' });
  } catch (error) { next(error); }
}
