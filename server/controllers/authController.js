import AuthSession from '../models/AuthSession.js';
import User from '../models/User.js';
import { OAuth2Client } from 'google-auth-library';
import { hashPassword, isValidEmail, isValidUsername, normalizeIdentity, publicUser, sessionCookie, verifyPassword } from '../authSecurity.js';
import { createSession, claimLegacyTree, uniqueGoogleUsername } from '../services/authService.js';
import { emailVerificationRequired, emailVerificationConfigured, issueVerificationCode } from '../services/emailVerificationService.js';
export const getAuthConfig = (_req, res) => {
  res.json({
    googleClientId: process.env.GOOGLE_CLIENT_ID || '',
    emailVerificationRequired: emailVerificationRequired(),
  });
};
export const register = async (req, res, next) => {
  try {
    if (emailVerificationRequired() && !emailVerificationConfigured()) return res.status(503).json({ error: 'Email registration is not ready. Use Google sign-in or contact the site owner.' });
    const displayName = String(req.body?.displayName || '').trim().slice(0, 80);
    const username = String(req.body?.username || '').trim();
    const normalizedUsername = normalizeIdentity(username);
    const email = String(req.body?.email || '').trim();
    const normalizedEmail = normalizeIdentity(email);
    const password = String(req.body?.password || '');
    if (displayName.length < 2) return res.status(400).json({
      error: 'Enter your name.'
    });
    if (!isValidUsername(username)) return res.status(400).json({
      error: 'Username must be 3–30 characters using letters, numbers, dots, dashes, or underscores.'
    });
    if (!isValidEmail(email)) return res.status(400).json({
      error: 'Enter a valid email address.'
    });
    if (password.length < 8 || password.length > 128) return res.status(400).json({
      error: 'Password must be between 8 and 128 characters.'
    });
    if (await User.exists({
      $or: [{
        normalizedUsername
      }, {
        normalizedEmail
      }]
    })) return res.status(409).json({
      error: 'That email or username is already registered.'
    });
    const isFirstUser = (await User.estimatedDocumentCount()) === 0;
    const user = await User.create({
      displayName,
      username,
      normalizedUsername,
      email,
      normalizedEmail,
      passwordHash: await hashPassword(password),
      emailVerificationRequired: emailVerificationRequired(),
      role: isFirstUser ? 'owner' : 'member',
      lastLoginAt: new Date()
    });
    if (user.emailVerificationRequired) {
      try { await issueVerificationCode(user); }
      catch (error) { return res.status(error.status || 503).json({ error: error.message, verificationRequired: true, email: user.email }); }
      return res.status(202).json({ verificationRequired: true, email: user.email });
    }
    await claimLegacyTree(user);
    res.status(201).json(await createSession(user, req, res));
  } catch (error) {
    if (error?.code === 11000) return res.status(409).json({
      error: 'That email or username is already registered.'
    });
    next(error);
  }
};
export const login = async (req, res, next) => {
  try {
    const identity = normalizeIdentity(req.body?.identity);
    const password = String(req.body?.password || '');
    const user = await User.findOne({
      $or: [{
        normalizedEmail: identity
      }, {
        normalizedUsername: identity
      }]
    }).select('+passwordHash');
    if (!user?.passwordHash || !(await verifyPassword(password, user.passwordHash))) return res.status(401).json({
      error: 'Email/username or password is incorrect.'
    });
    if (user.emailVerificationRequired) return res.status(403).json({ error: 'Verify your email before signing in.', verificationRequired: true, email: user.email });
    user.lastLoginAt = new Date();
    await user.save();
    await claimLegacyTree(user);
    res.json(await createSession(user, req, res));
  } catch (error) {
    next(error);
  }
};
export const googleLogin = async (req, res, next) => {
  try {
    const credential = String(req.body?.credential || '');
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) return res.status(503).json({
      error: 'Google sign-in is not configured yet.'
    });
    if (!credential) return res.status(400).json({
      error: 'Google did not return a sign-in credential.'
    });
    const ticket = await new OAuth2Client().verifyIdToken({
      idToken: credential,
      audience: clientId
    });
    const payload = ticket.getPayload();
    if (!payload?.sub || !payload?.email || payload.email_verified !== true) return res.status(401).json({
      error: 'Google could not verify this email address.'
    });
    const normalizedEmail = normalizeIdentity(payload.email);
    let user = await User.findOne({
      googleSubject: payload.sub
    }).select('+passwordHash');
    if (!user) {
      user = await User.findOne({
        normalizedEmail
      }).select('+passwordHash');
      if (user && user.googleSubject && user.googleSubject !== payload.sub) return res.status(409).json({
        error: 'This email is already connected to another Google account.'
      });
      if (user) {
        const googleIsAuthoritative = normalizedEmail.endsWith('@gmail.com') || Boolean(payload.hd);
        if (!googleIsAuthoritative) return res.status(409).json({
          error: 'Sign in with your password before connecting this Google account.'
        });
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
          role: isFirstUser ? 'owner' : 'member'
        });
        await claimLegacyTree(user);
      }
    }
    user.emailVerifiedAt = new Date();
    user.emailVerificationRequired = false;
    user.verificationHash = undefined;
    user.verificationExpiresAt = undefined;
    user.lastLoginAt = new Date();
    await user.save();
    await claimLegacyTree(user);
    res.json(await createSession(user, req, res));
  } catch (error) {
    if (error?.code === 11000) return res.status(409).json({
      error: 'This Google account is already registered.'
    });
    if (/token|audience|issuer|signature/i.test(String(error?.message || ''))) return res.status(401).json({
      error: 'Google sign-in could not be verified.'
    });
    next(error);
  }
};
export const getSession = (req, res) => {
  res.json({
    user: publicUser(req.user),
    csrfToken: req.authSession.csrfToken
  });
};
export const logout = async (req, res, next) => {
  try {
    await AuthSession.deleteOne({
      _id: req.authSession._id
    });
    res.setHeader('Set-Cookie', sessionCookie('', {
      clear: true
    }));
    res.status(204).end();
  } catch (error) {
    next(error);
  }
};
