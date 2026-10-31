import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCallback);
const PASSWORD_KEY_LENGTH = 64;
export const SESSION_COOKIE = 'kinfolk_session';
export const SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

export const normalizeIdentity = (value) => String(value || '').trim().toLocaleLowerCase('en-US');
export const normalizeUsername = (value) => normalizeIdentity(value).replace(/[^a-z0-9._-]/g, '');
export const isValidUsername = (value) => /^[a-z0-9](?:[a-z0-9._-]{1,28}[a-z0-9])?$/.test(normalizeIdentity(value));
export const isValidEmail = (value) => {
  const normalized = normalizeIdentity(value);
  return normalized.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized);
};

export async function hashPassword(password) {
  const salt = randomBytes(16);
  const derivedKey = await scrypt(String(password), salt, PASSWORD_KEY_LENGTH);
  return `scrypt$${salt.toString('base64url')}$${Buffer.from(derivedKey).toString('base64url')}`;
}

export async function verifyPassword(password, storedHash) {
  const [algorithm, saltValue, hashValue] = String(storedHash || '').split('$');
  if (algorithm !== 'scrypt' || !saltValue || !hashValue) return false;
  try {
    const expected = Buffer.from(hashValue, 'base64url');
    const actual = Buffer.from(await scrypt(String(password), Buffer.from(saltValue, 'base64url'), expected.length));
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

export const randomToken = (bytes = 32) => randomBytes(bytes).toString('base64url');
export const hashToken = (token) => createHash('sha256').update(String(token || '')).digest('base64url');

export function parseCookies(header) {
  return String(header || '')
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce((cookies, part) => {
      const separator = part.indexOf('=');
      if (separator < 1) return cookies;
      const key = decodeURIComponent(part.slice(0, separator));
      const value = decodeURIComponent(part.slice(separator + 1));
      cookies[key] = value;
      return cookies;
    }, {});
}

export function sessionCookie(token, { clear = false } = {}) {
  const secure = process.env.COOKIE_SECURE === 'true' || process.env.NODE_ENV === 'production';
  const configuredSameSite = String(process.env.COOKIE_SAME_SITE || 'lax').toLocaleLowerCase();
  const sameSite = ['strict', 'lax', 'none'].includes(configuredSameSite) ? configuredSameSite : 'lax';
  const attributes = [
    `${SESSION_COOKIE}=${clear ? '' : encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    `SameSite=${sameSite[0].toUpperCase()}${sameSite.slice(1)}`,
    clear ? 'Max-Age=0' : `Max-Age=${Math.floor(SESSION_MAX_AGE_MS / 1000)}`,
  ];
  if (secure || sameSite === 'none') attributes.push('Secure');
  if (sameSite === 'none') attributes.push('Partitioned');
  return attributes.join('; ');
}

export function publicUser(user) {
  return {
    id: String(user._id),
    displayName: user.displayName,
    username: user.username,
    email: user.email,
    avatarUrl: user.avatarUrl || '',
    role: user.role,
    hasPassword: Boolean(user.passwordHash),
    googleConnected: Boolean(user.googleSubject),
  };
}
