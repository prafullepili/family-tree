import AuthSession from '../models/AuthSession.js';
import Person from '../models/Person.js';
import TreeLayout from '../models/TreeLayout.js';
import User from '../models/User.js';
import { SESSION_MAX_AGE_MS, hashToken, normalizeIdentity, normalizeUsername, publicUser, randomToken, sessionCookie } from '../authSecurity.js';
export async function createSession(user, req, res) {
  const token = randomToken();
  const csrfToken = randomToken(24);
  await AuthSession.deleteMany({
    userId: user._id,
    passwordVersion: user.passwordVersion || 0,
    expiresAt: {
      $lte: new Date()
    }
  });
  await AuthSession.create({
    userId: user._id,
    passwordVersion: user.passwordVersion || 0,
    tokenHash: hashToken(token),
    csrfToken,
    expiresAt: new Date(Date.now() + SESSION_MAX_AGE_MS),
    userAgent: String(req.get('user-agent') || '').slice(0, 300)
  });
  res.setHeader('Set-Cookie', sessionCookie(token));
  return {
    user: publicUser(user),
    csrfToken
  };
}
export async function claimLegacyTree(user) {
  if (user.role !== 'owner') return;
  await Promise.all([Person.updateMany({
    ownerId: null,
    treeId: null
  }, {
    $set: {
      ownerId: user._id
    }
  }), TreeLayout.updateMany({
    ownerId: null,
    treeId: null
  }, {
    $set: {
      ownerId: user._id
    }
  })]);
}
export async function uniqueGoogleUsername(email, displayName) {
  const emailName = normalizeIdentity(email).split('@')[0];
  const nameFallback = normalizeIdentity(displayName).replace(/\s+/g, '.');
  let base = normalizeUsername(emailName || nameFallback || 'family.member').replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, '').slice(0, 24);
  if (base.length < 3) base = `member.${base || 'user'}`.slice(0, 24);
  let candidate = base;
  let suffix = 1;
  while (await User.exists({
    normalizedUsername: candidate
  })) {
    suffix += 1;
    candidate = `${base.slice(0, 28 - String(suffix).length)}${suffix}`;
  }
  return candidate;
}
