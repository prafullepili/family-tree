import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

process.env.NODE_ENV = 'test';
process.env.RESEND_API_KEY = 'test-key';
process.env.EMAIL_FROM = 'VanshLink <accounts@example.com>';
process.env.PUBLIC_APP_URL = 'https://example.com/family-tree/';
const { app, initializeDatabase } = await import('./index.js');
const { default: User } = await import('./models/User.js');
const { default: AuthSession } = await import('./models/AuthSession.js');
const { hashToken, randomToken } = await import('./authSecurity.js');

test('password recovery delivers private expiring links and invalidates passwords and sessions', { timeout: 900000 }, async (t) => {
  const mongo = await MongoMemoryServer.create({ instance: { launchTimeout: 60000 } });
  let server;
  const realFetch = globalThis.fetch;
  const emails = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    if (url === 'https://api.resend.com/emails') {
      emails.push(JSON.parse(options.body));
      return new Response('{}', { status: 200 });
    }
    return realFetch(url, options);
  });
  try {
    await mongoose.connect(mongo.getUri(), { dbName: 'familytree' });
    await initializeDatabase();
    server = app.listen(0, '127.0.0.1');
    await new Promise((resolve) => server.once('listening', resolve));
    const base = `http://127.0.0.1:${server.address().port}/api/auth`;
    async function post(path, body) {
      const response = await fetch(`${base}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      return { status: response.status, body: await response.json(), cookie: response.headers.get('set-cookie')?.split(';')[0] };
    }
    const registration = await post('/register', { displayName: 'Reset Tester', username: 'resettester', email: 'reset@example.com', password: 'OldPassword123' });
    assert.equal(registration.status, 201);
    const staleSession = (await AuthSession.findOne().lean());
    const request = await post('/forgot-password', { email: 'reset@example.com' });
    const unknown = await post('/forgot-password', { email: 'unknown@example.com' });
    assert.equal(request.status, 200);
    assert.deepEqual(request.body, unknown.body);
    assert.equal(emails.length, 1);
    const link = new URL(emails[0].text.match(/https:\/\/\S+/)[0]);
    assert.equal(link.pathname, '/family-tree/');
    assert.equal(link.search, '');
    const token = new URLSearchParams(link.hash.slice(1)).get('reset-password');
    assert.ok(token);
    assert.equal(JSON.stringify(request.body).includes(token), false);
    const user = await User.findOne().select('+resetTokenHash +resetTokenExpiresAt');
    assert.equal(user.resetTokenHash, hashToken(token));
    assert.notEqual(user.resetTokenHash, token);
    assert.ok(user.resetTokenExpiresAt > new Date());
    const throttled = await post('/forgot-password', { email: 'reset@example.com' });
    assert.equal(throttled.status, 200);
    assert.equal(emails.length, 1);
    assert.equal((await post('/reset-password', { token, password: 'short' })).status, 400);
    assert.equal((await post('/reset-password', { token: randomToken(), password: 'NewPassword123' })).status, 400);
    const outcomes = await Promise.all([
      post('/reset-password', { token, password: 'NewPassword123' }),
      post('/reset-password', { token, password: 'NewPassword123' }),
    ]);
    assert.deepEqual(outcomes.map((r) => r.status).sort(), [200, 400]);
    assert.equal((await post('/reset-password', { token, password: 'AnotherPass123' })).status, 400);
    assert.equal((await post('/login', { identity: 'reset@example.com', password: 'OldPassword123' })).status, 401);
    assert.equal(await AuthSession.countDocuments(), 0);
    assert.equal((await fetch(`${base}/me`, { headers: { Cookie: registration.cookie } })).status, 401);
    // An old login finishing after reset must not re-establish an old-password session.
    await AuthSession.create(staleSession);
    assert.equal((await fetch(`${base}/me`, { headers: { Cookie: registration.cookie } })).status, 401);
    assert.equal((await post('/login', { identity: 'reset@example.com', password: 'NewPassword123' })).status, 200);
    const expired = randomToken();
    await User.updateOne({ _id: user._id }, { $set: { resetTokenHash: hashToken(expired), resetTokenExpiresAt: new Date(Date.now() - 1000) } });
    assert.equal((await post('/reset-password', { token: expired, password: 'ExpiredPass123' })).status, 400);
    assert.equal((await post('/login', { identity: 'reset@example.com', password: 'NewPassword123' })).status, 200);
  } finally {
    if (server) await new Promise((resolve) => server.close(resolve));
    await mongoose.disconnect();
    await mongo.stop();
  }
});
