import assert from 'node:assert/strict';
import test from 'node:test';
import AuthSession from './models/AuthSession.js';
import User from './models/User.js';
import { createSession } from './services/authService.js';
import { logoutAll, setPassword } from './controllers/authController.js';
import { verifyPassword } from './authSecurity.js';

test('a recently signed-in Google user can add a hashed password once', async (t) => {
  let stored;
  t.mock.method(User, 'findOneAndUpdate', (filter, update) => {
    assert.deepEqual(filter, { _id: 'google-user', passwordHash: null });
    stored = update.$set.passwordHash;
    return { select: async () => ({ _id: 'google-user', googleSubject: 'google-id', passwordHash: stored }) };
  });
  let payload;
  await setPassword({ user: { _id: 'google-user', googleSubject: 'google-id' }, authSession: { createdAt: new Date() }, body: { password: 'new-password-123' } }, { json: (value) => { payload = value; } }, (error) => { throw error; });
  assert.equal(await verifyPassword('new-password-123', stored), true);
  assert.equal(payload.user.hasPassword, true);
  assert.equal(payload.user.passwordHash, undefined);
});

test('password setup rejects existing passwords, non-Google accounts, old sessions, and short passwords', async (t) => {
  t.mock.method(User, 'findOneAndUpdate', () => { throw Error('Must not write'); });
  const base = { user: { _id: 'google-user', googleSubject: 'google-id' }, authSession: { createdAt: new Date() }, body: { password: 'new-password-123' } };
  for (const [override, expected] of [
    [{ user: { ...base.user, passwordHash: 'existing' } }, 409],
    [{ user: { _id: 'other' } }, 409],
    [{ authSession: { createdAt: new Date(Date.now() - 16 * 60000) } }, 403],
    [{ body: { password: 'short' } }, 400],
  ]) {
    let status;
    await setPassword({ ...base, ...override }, { status: (value) => { status = value; return { json() {} }; } }, (error) => { throw error; });
    assert.equal(status, expected);
  }
});

test('log out everywhere revokes only the authenticated user sessions and clears the cookie', async (t) => {
  const calls = [];
  t.mock.method(User, 'updateOne', async (filter, update) => { calls.push(['version', filter, update]); });
  t.mock.method(AuthSession, 'deleteMany', async (filter) => { calls.push(['delete', filter]); });
  const headers = {};
  let status;
  await logoutAll({ user: { _id: 'current-user' } }, {
    setHeader: (key, value) => { headers[key] = value; },
    status: (value) => { status = value; return { end() {} }; },
  }, (error) => { throw error; });
  assert.deepEqual(calls, [
    ['version', { _id: 'current-user' }, { $inc: { passwordVersion: 1 } }],
    ['delete', { userId: 'current-user' }],
  ]);
  assert.equal(status, 204);
  assert.match(headers['Set-Cookie'], /kinfolk_session=;/);
});

test('log out everywhere reports database errors instead of claiming success', async (t) => {
  t.mock.method(User, 'updateOne', async () => { throw Error('Database unavailable'); });
  let reported;
  await logoutAll({ user: { _id: 'current-user' } }, {}, (error) => { reported = error; });
  assert.equal(reported.message, 'Database unavailable');
});

test('new sessions retain the current password version after password recovery', async (t) => {
  let stored;
  t.mock.method(AuthSession, 'deleteMany', async () => ({}));
  t.mock.method(AuthSession, 'create', async (value) => { stored = value; });
  const headers = {};
  const user = new User({
    displayName: 'Test Person', username: 'test.person', email: 'test@example.com',
    passwordVersion: 1,
  });
  const result = await createSession(user, { get: () => 'test-browser' }, {
    setHeader: (name, value) => { headers[name] = value; },
  });
  assert.equal(stored.passwordVersion, user.passwordVersion);
  assert.equal(stored.csrfToken, result.csrfToken);
  assert.match(headers['Set-Cookie'], /kinfolk_session=/);
  user.passwordVersion = 2;
  assert.notEqual(stored.passwordVersion, user.passwordVersion);
});
