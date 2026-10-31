import express from 'express';
import { rateLimit } from 'express-rate-limit';
import { OAuth2Client } from 'google-auth-library';
import mongoose from 'mongoose';
import AuthSession from './models/AuthSession.js';
import Person from './models/Person.js';
import TreeLayout from './models/TreeLayout.js';
import User from './models/User.js';
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE_MS,
  hashPassword,
  hashToken,
  isValidEmail,
  isValidUsername,
  normalizeIdentity,
  normalizeUsername,
  parseCookies,
  publicUser,
  randomToken,
  sessionCookie,
  verifyPassword,
} from './authSecurity.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many sign-in attempts. Please wait a few minutes and try again.' },
});

function databaseReady(_req, res, next) {
  if (mongoose.connection.readyState !== 1) return res.status(503).json({ error: 'The account service is temporarily unavailable.' });
  next();
}

async function createSession(user, req, res) {
  const token = randomToken();
  const csrfToken = randomToken(24);
  await AuthSession.deleteMany({ userId: user._id, expiresAt: { $lte: new Date() } });
  await AuthSession.create({
    userId: user._id,
    tokenHash: hashToken(token),
    csrfToken,
    expiresAt: new Date(Date.now() + SESSION_MAX_AGE_MS),
    userAgent: String(req.get('user-agent') || '').slice(0, 300),
  });
  res.setHeader('Set-Cookie', sessionCookie(token));
  return { user: publicUser(user), csrfToken };
}

async function claimLegacyTree(user) {
  if (user.role !== 'owner') return;
  await Promise.all([
    Person.updateMany({ ownerId: null, treeId: null }, { $set: { ownerId: user._id } }),
    TreeLayout.updateMany({ ownerId: null, treeId: null }, { $set: { ownerId: user._id } }),
  ]);
}

async function uniqueGoogleUsername(email, displayName) {
  const emailName = normalizeIdentity(email).split('@')[0];
  const nameFallback = normalizeIdentity(displayName).replace(/\s+/g, '.');
  let base = normalizeUsername(emailName || nameFallback || 'family.member')
    .replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, '')
    .slice(0, 24);
  if (base.length < 3) base = `member.${base || 'user'}`.slice(0, 24);
  let candidate = base;
  let suffix = 1;
  while (await User.exists({ normalizedUsername: candidate })) {
    suffix += 1;
    candidate = `${base.slice(0, 28 - String(suffix).length)}${suffix}`;
  }
  return candidate;
}

export async function requireAuth(req, res, next) {
  if (mongoose.connection.readyState !== 1) return res.status(503).json({ error: 'The account service is temporarily unavailable.' });
  try {
    const token = parseCookies(req.headers.cookie)[SESSION_COOKIE];
    if (!token) return res.status(401).json({ error: 'Please sign in to continue.' });
    const session = await AuthSession.findOne({ tokenHash: hashToken(token), expiresAt: { $gt: new Date() } });
    if (!session) {
      res.setHeader('Set-Cookie', sessionCookie('', { clear: true }));
      return res.status(401).json({ error: 'Your session has expired. Please sign in again.' });
    }
    const user = await User.findById(session.userId).select('+passwordHash');
    if (!user) {
      await AuthSession.deleteOne({ _id: session._id });
      res.setHeader('Set-Cookie', sessionCookie('', { clear: true }));
      return res.status(401).json({ error: 'Please sign in to continue.' });
    }
    if (!SAFE_METHODS.has(req.method)) {
      const csrfToken = String(req.get('x-csrf-token') || '');
      if (!csrfToken || hashToken(csrfToken) !== hashToken(session.csrfToken)) return res.status(403).json({ error: 'The security token is missing or expired. Refresh and try again.' });
    }
    req.user = user;
    req.authSession = session;
    next();
  } catch (error) {
    next(error);
  }
}

export function createAuthRouter() {
  const router = express.Router();

  router.get('/config', (_req, res) => {
    res.json({ googleClientId: process.env.GOOGLE_CLIENT_ID || '' });
  });

  router.post('/register', authLimiter, databaseReady, async (req, res, next) => {
    try {
      const displayName = String(req.body?.displayName || '').trim().slice(0, 80);
      const username = String(req.body?.username || '').trim();
      const normalizedUsername = normalizeIdentity(username);
      const email = String(req.body?.email || '').trim();
      const normalizedEmail = normalizeIdentity(email);
      const password = String(req.body?.password || '');
      if (displayName.length < 2) return res.status(400).json({ error: 'Enter your name.' });
      if (!isValidUsername(username)) return res.status(400).json({ error: 'Username must be 3–30 characters using letters, numbers, dots, dashes, or underscores.' });
      if (!isValidEmail(email)) return res.status(400).json({ error: 'Enter a valid email address.' });
      if (password.length < 8 || password.length > 128) return res.status(400).json({ error: 'Password must be between 8 and 128 characters.' });
      if (await User.exists({ $or: [{ normalizedUsername }, { normalizedEmail }] })) return res.status(409).json({ error: 'That email or username is already registered.' });

      const isFirstUser = (await User.estimatedDocumentCount()) === 0;
      const user = await User.create({
        displayName,
        username,
        normalizedUsername,
        email,
        normalizedEmail,
        passwordHash: await hashPassword(password),
        role: isFirstUser ? 'owner' : 'member',
        lastLoginAt: new Date(),
      });
      await claimLegacyTree(user);
      res.status(201).json(await createSession(user, req, res));
    } catch (error) {
      if (error?.code === 11000) return res.status(409).json({ error: 'That email or username is already registered.' });
      next(error);
    }
  });

  router.post('/login', authLimiter, databaseReady, async (req, res, next) => {
    try {
      const identity = normalizeIdentity(req.body?.identity);
      const password = String(req.body?.password || '');
      const user = await User.findOne({ $or: [{ normalizedEmail: identity }, { normalizedUsername: identity }] }).select('+passwordHash');
      if (!user?.passwordHash || !(await verifyPassword(password, user.passwordHash))) return res.status(401).json({ error: 'Email/username or password is incorrect.' });
      user.lastLoginAt = new Date();
      await user.save();
      await claimLegacyTree(user);
      res.json(await createSession(user, req, res));
    } catch (error) {
      next(error);
    }
  });

  router.post('/google', authLimiter, databaseReady, async (req, res, next) => {
    try {
      const credential = String(req.body?.credential || '');
      const clientId = process.env.GOOGLE_CLIENT_ID;
      if (!clientId) return res.status(503).json({ error: 'Google sign-in is not configured yet.' });
      if (!credential) return res.status(400).json({ error: 'Google did not return a sign-in credential.' });
      const ticket = await new OAuth2Client().verifyIdToken({ idToken: credential, audience: clientId });
      const payload = ticket.getPayload();
      if (!payload?.sub || !payload?.email || payload.email_verified !== true) return res.status(401).json({ error: 'Google could not verify this email address.' });

      const normalizedEmail = normalizeIdentity(payload.email);
      let user = await User.findOne({ googleSubject: payload.sub }).select('+passwordHash');
      if (!user) {
        user = await User.findOne({ normalizedEmail }).select('+passwordHash');
        if (user && user.googleSubject && user.googleSubject !== payload.sub) return res.status(409).json({ error: 'This email is already connected to another Google account.' });
        if (user) {
          const googleIsAuthoritative = normalizedEmail.endsWith('@gmail.com') || Boolean(payload.hd);
          if (!googleIsAuthoritative) return res.status(409).json({ error: 'Sign in with your password before connecting this Google account.' });
          user.googleSubject = payload.sub;
          if (!user.avatarUrl && payload.picture) user.avatarUrl = payload.picture;
        } else {
          const isFirstUser = (await User.estimatedDocumentCount()) === 0;
          const username = await uniqueGoogleUsername(payload.email, payload.name);
          user = await User.create({
            displayName: String(payload.name || payload.email.split('@')[0]).slice(0, 80),
            username,
            normalizedUsername: username,
            email: payload.email,
            normalizedEmail,
            googleSubject: payload.sub,
            avatarUrl: String(payload.picture || ''),
            role: isFirstUser ? 'owner' : 'member',
          });
          await claimLegacyTree(user);
        }
      }
      user.lastLoginAt = new Date();
      await user.save();
      await claimLegacyTree(user);
      res.json(await createSession(user, req, res));
    } catch (error) {
      if (error?.code === 11000) return res.status(409).json({ error: 'This Google account is already registered.' });
      if (/token|audience|issuer|signature/i.test(String(error?.message || ''))) return res.status(401).json({ error: 'Google sign-in could not be verified.' });
      next(error);
    }
  });

  router.get('/me', databaseReady, requireAuth, (req, res) => {
    res.json({ user: publicUser(req.user), csrfToken: req.authSession.csrfToken });
  });

  router.post('/logout', requireAuth, async (req, res, next) => {
    try {
      await AuthSession.deleteOne({ _id: req.authSession._id });
      res.setHeader('Set-Cookie', sessionCookie('', { clear: true }));
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  });

  return router;
}
