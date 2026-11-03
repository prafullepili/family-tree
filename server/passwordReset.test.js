import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

process.env.NODE_ENV = 'test';
process.env.EMAIL_VERIFICATION_REQUIRED = 'false';
process.env.GMAIL_APP_PASSWORD = '';
const { app, initializeDatabase } = await import('./index.js');
const { default: User } = await import('./models/User.js');
const { default: AuthSession } = await import('./models/AuthSession.js');
const { hashToken, randomToken } = await import('./authSecurity.js');

test('recovery is unavailable while existing tokens still expire and invalidate sessions', { timeout: 900000 }, async (t) => {
  const mongo = await MongoMemoryServer.create({ instance: { launchTimeout: 60000 } });
  let server;
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
    assert.equal(request.status, 503);
    assert.deepEqual(request.body, unknown.body);
    assert.equal(await User.countDocuments({ resetTokenHash: { $exists: true } }), 0);
    // Tokens already issued before email removal remain usable until expiration.
    const token = randomToken();
    const user = await User.findOne();
    await User.updateOne({ _id: user._id }, { $set: { resetTokenHash: hashToken(token), resetTokenExpiresAt: new Date(Date.now() + 1800000) } });
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
