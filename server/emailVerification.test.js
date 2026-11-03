import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import nodemailer from 'nodemailer';
import { OAuth2Client } from 'google-auth-library';
import { MongoMemoryServer } from 'mongodb-memory-server';

process.env.NODE_ENV = 'test';
process.env.EMAIL_VERIFICATION_REQUIRED = 'true';
process.env.GMAIL_USER = 'sender@gmail.com';
process.env.GMAIL_APP_PASSWORD = 'test-app-password';
process.env.EMAIL_OTP_SECRET = 'test-secret-with-more-than-32-characters';
const { app, initializeDatabase } = await import('./index.js');
const { default: User } = await import('./models/User.js');
const { default: AuthSession } = await import('./models/AuthSession.js');
const { issueVerificationCode } = await import('./services/emailVerificationService.js');

test('email OTP gates new accounts, expires, limits attempts/resends, and is consumed once', { timeout: 900000 }, async (t) => {
  const sent = [];
  let deliveryFails = false;
  t.mock.method(nodemailer, 'createTransport', () => ({ sendMail: async (mail) => {
    if (deliveryFails) throw Error('Simulated SMTP failure');
    sent.push(mail);
  } }));
  const mongo = await MongoMemoryServer.create();
  let server;
  try {
    await mongoose.connect(mongo.getUri(), { dbName: 'familytree' });
    await initializeDatabase();
    server = app.listen(0, '127.0.0.1');
    await new Promise((resolve) => server.once('listening', resolve));
    const base = `http://127.0.0.1:${server.address().port}/api/auth`;
    const post = async (path, body) => {
      const response = await fetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      return { status: response.status, body: await response.json(), cookie: response.headers.get('set-cookie') };
    };
    const email = 'verify@example.com';
    const registration = await post('/register', { displayName: 'OTP Tester', username: 'otptester', email, password: 'TestPassword123' });
    assert.equal(registration.status, 202);
    assert.equal(registration.body.verificationRequired, true);
    assert.equal(registration.cookie, null);
    assert.equal(await AuthSession.countDocuments(), 0);
    assert.equal((await post('/login', { identity: email, password: 'TestPassword123' })).status, 403);
    assert.equal(sent.length, 1);
    const firstCode = sent[0].text.match(/code is (\d{6})/)[1];
    let user = await User.findOne({ normalizedEmail: email }).select('+verificationHash');
    assert.equal(user.verificationHash.includes(firstCode), false);
    assert.equal(JSON.stringify(registration.body).includes(firstCode), false);
    await assert.rejects(issueVerificationCode(user), (e) => e.status === 429);
    const wrong = firstCode === '000000' ? '111111' : '000000';
    for (let n = 0; n < 5; n++) assert.equal((await post('/verify-email', { email, code: wrong })).status, 400);
    assert.equal((await post('/verify-email', { email, code: firstCode })).status, 400);
    await User.updateOne({ _id: user._id }, { $set: { verificationSentAt: new Date(Date.now() - 61000) } });
    await issueVerificationCode(user);
    const secondCode = sent[1].text.match(/code is (\d{6})/)[1];
    await User.updateOne({ _id: user._id }, { $set: { verificationExpiresAt: new Date(Date.now() - 1) } });
    assert.equal((await post('/verify-email', { email, code: secondCode })).status, 400);
    await User.updateOne({ _id: user._id }, { $set: { verificationSentAt: new Date(Date.now() - 61000) } });
    await issueVerificationCode(user);
    const code = sent[2].text.match(/code is (\d{6})/)[1];
    const results = await Promise.all([post('/verify-email', { email, code }), post('/verify-email', { email, code })]);
    assert.deepEqual(results.map((r) => r.status).sort(), [200, 400]);
    const verified = results.find((r) => r.status === 200);
    assert.equal((await fetch(base + '/me', { headers: { Cookie: verified.cookie.split(';')[0] } })).status, 200);
    user = await User.findById(user._id).select('+verificationHash');
    assert.equal(user.emailVerificationRequired, false);
    assert.ok(user.emailVerifiedAt);
    assert.equal(user.verificationHash, undefined);
    assert.equal((await post('/login', { identity: email, password: 'TestPassword123' })).status, 200);
    const unknown = await post('/resend-verification', { email: 'unknown@example.com' });
    const known = await post('/resend-verification', { email });
    assert.deepEqual(unknown.body, known.body);
    assert.equal(sent.length, 3);
    const limited = await User.create({ displayName: 'Limited', username: 'limited', normalizedUsername: 'limited', email: 'limited@example.com', normalizedEmail: 'limited@example.com', emailVerificationRequired: true, verificationWindowAt: new Date(), verificationSendCount: 5 });
    await assert.rejects(issueVerificationCode(limited), (e) => e.status === 429);
    await User.updateOne({ _id: limited._id }, { $set: { verificationSendCount: 0 } });
    deliveryFails = true;
    await assert.rejects(issueVerificationCode(limited), (e) => e.status === 503);
    assert.equal((await User.findById(limited._id).select('+verificationHash')).verificationHash, undefined);
    deliveryFails = false;
    // Google-verified email ownership uses no Gmail delivery or email code.
    process.env.GOOGLE_CLIENT_ID = 'test-google-client';
    let emailVerified = false;
    t.mock.method(OAuth2Client.prototype, 'verifyIdToken', async () => ({ getPayload: () => ({ sub: 'google-subject', email: 'googleuser@gmail.com', name: 'Google User', email_verified: emailVerified }) }));
    assert.equal((await post('/google', { credential: 'test-credential' })).status, 401);
    emailVerified = true;
    assert.equal((await post('/google', { credential: 'test-credential' })).status, 200);
    const googleUser = await User.findOne({ normalizedEmail: 'googleuser@gmail.com' });
    assert.equal(googleUser.emailVerificationRequired, false);
    assert.ok(googleUser.emailVerifiedAt);
    assert.equal(sent.length, 3);
  } finally {
    if (server) await new Promise((resolve) => server.close(resolve));
    await mongoose.disconnect(); await mongo.stop();
  }
});
