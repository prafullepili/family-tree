import assert from 'node:assert/strict';
import test from 'node:test';
import AuthSession from './models/AuthSession.js';
import User from './models/User.js';
import { createSession } from './services/authService.js';

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
