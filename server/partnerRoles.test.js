import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
process.env.NODE_ENV = 'test';
process.env.EMAIL_VERIFICATION_REQUIRED = 'false';
const { app, initializeDatabase } = await import('./index.js');

test('partner edits normalize the linked role and save reciprocal labels, including gender changes and neutral labels', { timeout: 900000 }, async () => {
  const mongo = await MongoMemoryServer.create(); let server;
  try {
    await mongoose.connect(mongo.getUri(), { dbName: 'familytree' }); await initializeDatabase();
    server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
    const base = `http://127.0.0.1:${server.address().port}/api`;
    const registration = await fetch(base + '/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ displayName: 'Role tester', username: 'roletester', email: 'role@example.com', password: 'RoleTest123!' }) });
    assert.equal(registration.status, 201);
    const cookie = registration.headers.get('set-cookie').split(';')[0], account = await registration.json();
    const headers = { Cookie: cookie, 'X-CSRF-Token': account.csrfToken, 'Content-Type': 'application/json' };
    const trees = await (await fetch(base + '/trees', { headers })).json(); headers['X-Tree-Id'] = trees[0].id;
    const call = async (path, method = 'GET', body) => {
      const response = await fetch(base + path, { method, headers, ...(body ? { body: JSON.stringify(body) } : {}) });
      assert.ok(response.ok, `Unexpected status ${response.status}`);
      return response.json();
    };
    const husband = await call('/people', 'POST', { firstName: 'Chandru', gender: 'male' });
    const wife = await call('/people', 'POST', { firstName: 'Sayama', gender: 'female', partnerIds: [husband._id], partnerRelationships: [{ partnerId: husband._id, label: 'Wife' }] });
    assert.equal(wife.partnerRelationships[0].label, 'Husband');
    assert.equal((await call('/people/' + husband._id)).partnerRelationships[0].label, 'Wife');
    await call('/people/' + husband._id, 'PATCH', { partnerRelationships: [{ partnerId: wife._id, label: 'Wife' }] });
    assert.equal((await call('/people/' + wife._id)).partnerRelationships[0].label, 'Husband');
    await call('/people/' + wife._id, 'PATCH', { gender: 'male' });
    assert.equal((await call('/people/' + husband._id)).partnerRelationships[0].label, 'Husband');
    await call('/people/' + wife._id, 'PATCH', { partnerRelationships: [{ partnerId: husband._id, label: 'Spouse' }] });
    assert.equal((await call('/people/' + husband._id)).partnerRelationships[0].label, 'Spouse');
    assert.equal((await call('/people/' + wife._id)).partnerRelationships[0].label, 'Spouse');
  } finally {
    if (server) await new Promise(resolve => server.close(resolve));
    await mongoose.disconnect(); await mongo.stop();
  }
});
