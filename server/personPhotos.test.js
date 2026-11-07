import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

process.env.NODE_ENV = 'test';
process.env.EMAIL_VERIFICATION_REQUIRED = 'false';
const { app, initializeDatabase } = await import('./index.js');
const { TreeMembership } = await import('./models/treeModels.js');
const { photoBucket } = await import('./services/personPhotoService.js');
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jG6kAAAAASUVORK5CYII=', 'base64');

test('device photos persist in GridFS and enforce tree roles, CSRF, type, and size limits', { timeout: 900000 }, async () => {
  const mongo = await MongoMemoryServer.create(); let server;
  try {
    await mongoose.connect(mongo.getUri(), { dbName: 'familytree' }); await initializeDatabase();
    server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
    const base = `http://127.0.0.1:${server.address().port}/api`;
    const call = async (account, path, method = 'GET', body, treeId, mime = 'application/json') => {
      const headers = { 'Content-Type': mime };
      if (account) { headers.Cookie = account.cookie; headers['X-CSRF-Token'] = account.csrfToken; }
      if (treeId) headers['X-Tree-Id'] = treeId;
      return fetch(base + path, { method, headers, ...(body !== undefined ? { body: Buffer.isBuffer(body) ? body : JSON.stringify(body) } : {}) });
    };
    const register = async name => {
      const response = await call(null, '/auth/register', 'POST', { displayName: name, username: name, email: name + '@example.com', password: 'PhotoTest123!' });
      assert.equal(response.status, 201);
      return { ...await response.json(), cookie: response.headers.get('set-cookie').split(';')[0] };
    };
    const owner = await register('photoowner'), viewer = await register('photoviewer'), outsider = await register('photooutsider');
    const trees = await (await call(owner, '/trees')).json(), treeId = trees[0].id;
    const otherTree = (await (await call(outsider, '/trees')).json())[0].id;
    await TreeMembership.create({ treeId, userId: viewer.user.id, role: 'viewer' });
    assert.equal((await call(null, '/photos', 'POST', png, treeId, 'image/png')).status, 401);
    assert.equal((await call({ ...owner, csrfToken: '' }, '/photos', 'POST', png, treeId, 'image/png')).status, 403);
    assert.equal((await call(viewer, '/photos', 'POST', png, treeId, 'image/png')).status, 403);
    assert.equal((await call(owner, '/photos', 'POST', Buffer.from('<svg/>'), treeId, 'image/png')).status, 415);
    assert.equal((await call(owner, '/photos', 'POST', Buffer.alloc(1048577), treeId, 'image/png')).status, 413);
    const upload = await call(owner, '/photos', 'POST', png, treeId, 'image/png');
    assert.equal(upload.status, 201);
    const { photoUrl } = await upload.json();
    assert.match(photoUrl, /^\/api\/photos\/[a-f\d]{24}$/);
    const path = photoUrl.slice(4);
    assert.equal((await call(null, path)).status, 401);
    assert.equal((await call(outsider, path)).status, 403);
    const download = await call(viewer, path);
    assert.equal(download.status, 200); assert.equal(download.headers.get('content-type'), 'image/png');
    assert.deepEqual(Buffer.from(await download.arrayBuffer()), png);
    assert.equal(await mongoose.connection.db.collection('personPhotos.chunks').countDocuments(), 1);
    assert.equal((await photoBucket().find({}).toArray()).length, 1);
    assert.equal((await call(outsider, '/people', 'POST', { firstName: 'Invalid reference', photoUrl }, otherTree)).status, 400);
    const saved = await call(owner, '/people', 'POST', { firstName: 'With photo', photoUrl }, treeId);
    assert.equal(saved.status, 201); const person = await saved.json();
    assert.equal(person.photoUrl, photoUrl);
    assert.equal((await call(owner, path, 'DELETE', undefined, treeId)).status, 409);
    assert.equal((await call(owner, '/people/' + person._id, 'DELETE', undefined, treeId)).status, 204);
    assert.equal((await call(owner, path, 'DELETE', undefined, treeId)).status, 409);
    assert.equal((await call(viewer, path)).status, 200);
    const unused = await (await call(owner, '/photos', 'POST', png, treeId, 'image/png')).json();
    assert.equal((await call(owner, unused.photoUrl.slice(4), 'DELETE', undefined, treeId)).status, 204);
    assert.equal((await call(owner, unused.photoUrl.slice(4))).status, 404);
  } finally {
    if (server) await new Promise(resolve => server.close(resolve));
    await mongoose.disconnect(); await mongo.stop();
  }
});
