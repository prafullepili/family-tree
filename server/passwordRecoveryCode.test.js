import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import nodemailer from 'nodemailer';
import { MongoMemoryServer } from 'mongodb-memory-server';

process.env.NODE_ENV = 'test';
process.env.EMAIL_VERIFICATION_REQUIRED = 'false';
process.env.GMAIL_USER = 'sender@gmail.com';
process.env.GMAIL_APP_PASSWORD = 'test-password';
process.env.EMAIL_OTP_SECRET = 'private-test-secret-longer-than-32-characters';
const { app, initializeDatabase } = await import('./index.js');
const { default: User } = await import('./models/User.js');
const { default: AuthSession } = await import('./models/AuthSession.js');
const { requestRecoveryCode } = await import('./services/passwordRecoveryCodeService.js');

test('Gmail reset codes are private, limited, expiring, single-use, and invalidate old sessions', { timeout: 900000 }, async (t) => {
  const emails = [];
  let deliveryFails = false;
  t.mock.method(nodemailer, 'createTransport', () => ({ sendMail: async (email) => {
    if (deliveryFails) throw Error('Simulated SMTP failure');
    emails.push(email);
  } }));
  const mongo = await MongoMemoryServer.create();
  let server;
  try {
    await mongoose.connect(mongo.getUri(), { dbName: 'familytree' }); await initializeDatabase();
    server = app.listen(0, '127.0.0.1');
    await new Promise((resolve) => server.once('listening', resolve));
    const base = `http://127.0.0.1:${server.address().port}/api/auth`;
    const post = async (path, body) => {
      const r = await fetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      return { status: r.status, body: await r.json(), cookie: r.headers.get('set-cookie')?.split(';')[0] };
    };
    const email = 'reset@example.com';
    const registered = await post('/register', { displayName: 'Reset Tester', username: 'resettester', email, password: 'OldPassword123' });
    assert.equal(registered.status, 201);
    const known = await post('/forgot-password', { email });
    const unknown = await post('/forgot-password', { email: 'unknown@example.com' });
    assert.equal(known.status, 200); assert.deepEqual(known.body, unknown.body);
    assert.equal(emails.length, 1);
    const code = emails[0].text.match(/code is (\d{6})/)[1];
    assert.equal(JSON.stringify(known.body).includes(code), false);
    const user = await User.findOne().select('+recoveryHash');
    assert.equal(user.recoveryHash.includes(code), false);
    await requestRecoveryCode(email); assert.equal(emails.length, 1);
    const wrong = code === '000000' ? '111111' : '000000';
    for (let n = 0; n < 5; n++) assert.equal((await post('/reset-password', { email, code: wrong, password: 'NewPassword123' })).status, 400);
    assert.equal((await post('/reset-password', { email, code, password: 'NewPassword123' })).status, 400);
    const reissue = async () => {
      await User.updateOne({ _id: user._id }, { $set: { recoverySentAt: new Date(Date.now() - 61000) } });
      await requestRecoveryCode(email);
      return emails.at(-1).text.match(/code is (\d{6})/)[1];
    };
    const expired = await reissue();
    await User.updateOne({ _id: user._id }, { $set: { recoveryExpiresAt: new Date(Date.now() - 1) } });
    assert.equal((await post('/reset-password', { email, code: expired, password: 'NewPassword123' })).status, 400);
    const fresh = await reissue();
    assert.equal((await post('/reset-password', { email, code: fresh, password: 'short' })).status, 400);
    const results = await Promise.all([post('/reset-password', { email, code: fresh, password: 'NewPassword123' }), post('/reset-password', { email, code: fresh, password: 'NewPassword123' })]);
    assert.deepEqual(results.map((r) => r.status).sort(), [200, 400]);
    assert.equal(await AuthSession.countDocuments(), 0);
    assert.equal((await fetch(base + '/me', { headers: { Cookie: registered.cookie } })).status, 401);
    assert.equal((await post('/login', { identity: email, password: 'OldPassword123' })).status, 401);
    const login = await post('/login', { identity: email, password: 'NewPassword123' });
    assert.equal(login.status, 200);
    assert.equal((await fetch(base + '/me', { headers: { Cookie: login.cookie } })).status, 200);
    assert.equal((await User.findById(user._id)).passwordVersion, 1);
    assert.equal((await User.findById(user._id).select('+recoveryHash')).recoveryHash, undefined);
    await User.updateOne({ _id: user._id }, { $set: { recoverySendCount: 5, recoverySentAt: new Date(Date.now() - 61000) } });
    await requestRecoveryCode(email); assert.equal(emails.length, 3);
    await User.updateOne({ _id: user._id }, { $set: { recoverySendCount: 0 } });
    deliveryFails = true;
    await requestRecoveryCode(email);
    assert.equal((await User.findById(user._id).select('+recoveryHash')).recoveryHash, undefined);
  } finally {
    if (server) await new Promise((resolve) => server.close(resolve));
    await mongoose.disconnect(); await mongo.stop();
  }
});
