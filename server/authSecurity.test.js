import assert from 'node:assert/strict';
import test from 'node:test';
import { hashPassword, hashToken, isValidEmail, isValidUsername, normalizeIdentity, parseCookies, publicUser, sessionCookie, verifyPassword } from './authSecurity.js';

test('password hashes verify the correct password without storing it', async () => {
  const password = 'A stronger family passphrase';
  const passwordHash = await hashPassword(password);

  assert.equal(passwordHash.includes(password), false);
  assert.equal(await verifyPassword(password, passwordHash), true);
  assert.equal(await verifyPassword('wrong password', passwordHash), false);
});

test('login identities normalize consistently', () => {
  assert.equal(normalizeIdentity('  Person@Example.COM  '), 'person@example.com');
  assert.equal(isValidEmail('person@example.com'), true);
  assert.equal(isValidEmail('not-an-email'), false);
  assert.equal(isValidUsername('family.owner'), true);
  assert.equal(isValidUsername('-invalid-'), false);
});

test('session helpers parse and hash opaque cookie values', () => {
  assert.deepEqual(parseCookies('other=1; kinfolk_session=hello%20world'), { other: '1', kinfolk_session: 'hello world' });
  assert.equal(hashToken('same-token'), hashToken('same-token'));
  assert.notEqual(hashToken('same-token'), hashToken('another-token'));
});

test('session cookies are HttpOnly and public users never expose password hashes', () => {
  const previousSecure = process.env.COOKIE_SECURE;
  const previousSameSite = process.env.COOKIE_SAME_SITE;
  process.env.COOKIE_SECURE = 'true';
  process.env.COOKIE_SAME_SITE = 'none';
  try {
    const cookie = sessionCookie('opaque-token');
    assert.match(cookie, /HttpOnly/);
    assert.match(cookie, /Secure/);
    assert.match(cookie, /SameSite=None/);
    assert.match(cookie, /Partitioned/);
    const output = publicUser({
      _id: 'user-1',
      displayName: 'Family Owner',
      username: 'family.owner',
      email: 'owner@example.com',
      passwordHash: 'must-not-leak',
      googleSubject: 'google-id',
      avatarUrl: '',
      role: 'owner',
    });
    assert.equal('passwordHash' in output, false);
    assert.equal(output.hasPassword, true);
  } finally {
    if (previousSecure === undefined) delete process.env.COOKIE_SECURE;
    else process.env.COOKIE_SECURE = previousSecure;
    if (previousSameSite === undefined) delete process.env.COOKIE_SAME_SITE;
    else process.env.COOKIE_SAME_SITE = previousSameSite;
  }
});
