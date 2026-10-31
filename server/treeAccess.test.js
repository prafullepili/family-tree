import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

process.env.NODE_ENV = 'test';
const { app, initializeDatabase } = await import('./index.js');
const { FamilyTree, TreeMembership, TreeInvitation } = await import('./treeAccess.js');
const { default: Person } = await import('./models/Person.js');

test('shared trees enforce roles, isolate data, migrate old data, and restore deleted people', { timeout: 900000 }, async () => {
  const mongo = await MongoMemoryServer.create({ instance: { launchTimeout: 60000 } });
  let server;
  try {
    await mongoose.connect(mongo.getUri(), { dbName: 'familytree' });
    await initializeDatabase();
    server = app.listen(0, '127.0.0.1');
    await new Promise((resolve) => server.once('listening', resolve));
    const base = `http://127.0.0.1:${server.address().port}`;
    async function call(account, path, method = 'GET', body, treeId) {
      const response = await fetch(`${base}/api${path}`, { method, headers: { 'Content-Type': 'application/json', ...(account ? { Cookie: account.cookie, 'X-CSRF-Token': account.csrfToken } : {}), ...(treeId ? { 'X-Tree-Id': treeId } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
      const data = await response.json().catch(() => null);
      return { status: response.status, data, cookie: response.headers.get('set-cookie')?.split(';')[0] };
    }
    async function register(name) {
      const result = await call(null, '/auth/register', 'POST', { displayName: name, username: name, email: `${name}@example.com`, password: 'TestPass123!' });
      assert.equal(result.status, 201);
      return { ...result.data, cookie: result.cookie };
    }
    const owner = await register('owner');
    const editor = await register('editor');
    const viewer = await register('viewer');
    const legacy = await Person.create({ ownerId: owner.user.id, firstName: 'Legacy ancestor', treeX: -150, treeY: 80 });
    const ownerTrees = await call(owner, '/trees');
    assert.equal(ownerTrees.status, 200);
    const treeId = ownerTrees.data[0].id;
    assert.equal(String((await Person.findById(legacy._id)).treeId), treeId);
    await call(owner, '/trees');
    assert.equal(await FamilyTree.countDocuments({ legacyOwnerId: owner.user.id }), 1);
    const privateTree = (await call(editor, '/trees')).data[0].id;
    const secondTree = (await call(owner, '/trees', 'POST', { name: 'Another family' })).data.id;
    const layoutBody = { name: 'Favourite view', familyId: 'family', positions: [{ personId: legacy.id, treeX: -150, treeY: 80 }] };
    assert.equal((await call(owner, '/layouts', 'POST', layoutBody, treeId)).status, 201);
    assert.equal((await call(owner, '/layouts?familyId=family', 'GET', null, secondTree)).data.length, 0);
    assert.equal((await call(owner, '/layouts', 'POST', layoutBody, secondTree)).status, 400);
    assert.equal((await call(editor, '/people', 'GET', null, treeId)).status, 403);
    assert.equal((await call(owner, '/people')).status, 400);
    assert.equal((await call(owner, '/people', 'GET', null, privateTree)).status, 403);

    const invite = await call(owner, `/trees/${treeId}/invitations`, 'POST', { email: 'editor@example.com', role: 'editor' });
    assert.equal(invite.status, 201);
    assert.equal((await call(viewer, '/trees/accept-invitation', 'POST', { token: invite.data.token })).status, 400);
    assert.equal((await call(editor, '/trees/accept-invitation', 'POST', { token: invite.data.token })).status, 200);
    assert.equal((await call(editor, '/trees/accept-invitation', 'POST', { token: invite.data.token })).status, 400);
    const viewerInvite = await call(owner, `/trees/${treeId}/invitations`, 'POST', { email: 'viewer@example.com', role: 'viewer' });
    await call(viewer, '/trees/accept-invitation', 'POST', { token: viewerInvite.data.token });
    const created = await call(editor, '/people', 'POST', { firstName: 'Child', parentIds: [legacy.id], ownerId: editor.user.id, treeId: privateTree }, treeId);
    assert.equal(created.status, 201);
    assert.equal(created.data.treeId, treeId);
    const childId = created.data._id;
    assert.equal((await call(viewer, '/people', 'GET', null, treeId)).data.length, 2);
    for (const [path, method, body] of [
      ['/people', 'POST', { firstName: 'Denied' }],
      [`/people/${childId}`, 'PATCH', { firstName: 'Denied' }],
      ['/people/layout/positions', 'PATCH', { positions: [{ id: childId, treeX: 1, treeY: 1 }] }],
      ['/people/batch', 'DELETE', { ids: [childId] }],
      ['/layouts', 'POST', { name: 'Denied' }],
    ]) assert.equal((await call(viewer, path, method, body, treeId)).status, 403);
    assert.equal((await call(editor, `/trees/${treeId}/invitations`, 'POST', { email: 'bad@example.com', role: 'editor' })).status, 403);
    assert.equal((await call(owner, `/people/${childId}`, 'PATCH', { firstName: 'Wrong tree' }, privateTree)).status, 403);
    const foreign = await call(editor, '/people', 'POST', { firstName: 'Private' }, privateTree);
    const linked = await call(editor, `/people/${childId}`, 'PATCH', { parentIds: [foreign.data._id] }, treeId);
    assert.deepEqual(linked.data.parentIds, []);
    await call(editor, `/people/${childId}`, 'PATCH', { parentIds: [legacy.id] }, treeId);

    assert.equal((await call(editor, '/people/batch', 'DELETE', { ids: [childId] }, treeId)).status, 200);
    assert.equal((await call(owner, '/people', 'GET', null, treeId)).data.length, 1);
    assert.equal((await call(owner, `/trees/${treeId}/recycle-bin`)).data.length, 1);
    assert.equal((await call(viewer, `/trees/${treeId}/recycle-bin/${childId}/restore`, 'POST')).status, 403);
    const restored = await call(editor, `/trees/${treeId}/recycle-bin/${childId}/restore`, 'POST');
    assert.equal(restored.status, 200);
    assert.deepEqual(restored.data.parentIds, [legacy.id]);
    assert.equal((await call(owner, '/people', 'GET', null, treeId)).data.length, 2);
    const history = await call(owner, `/trees/${treeId}/activity`);
    assert.equal(history.status, 200);
    assert.ok(history.data.some((entry) => entry.action === 'Restored person' && entry.actorName === 'editor'));
    const ownerMember = await TreeMembership.findOne({ treeId, role: 'owner' });
    assert.equal((await call(owner, `/trees/${treeId}/members/${ownerMember.id}`, 'DELETE')).status, 404);
    const editorMember = await TreeMembership.findOne({ treeId, userId: editor.user.id });
    assert.equal((await call(owner, `/trees/${treeId}/members/${editorMember.id}`, 'PATCH', { role: 'viewer' })).status, 200);
    assert.equal((await call(editor, '/people', 'POST', { firstName: 'Denied' }, treeId)).status, 403);
    await call(owner, `/trees/${treeId}/members/${editorMember.id}`, 'DELETE');
    assert.equal((await call(editor, '/people', 'GET', null, treeId)).status, 403);
    const pending = await call(owner, `/trees/${treeId}/invitations`, 'POST', { email: 'editor@example.com', role: 'viewer' });
    const stored = await TreeInvitation.findOne({ email: 'editor@example.com', acceptedAt: null });
    assert.notEqual(stored.tokenHash, pending.data.token);
    await call(owner, `/trees/${treeId}/invitations/${stored.id}`, 'DELETE');
    assert.equal((await call(editor, '/trees/accept-invitation', 'POST', { token: pending.data.token })).status, 400);
  } finally {
    if (server) await new Promise((resolve) => server.close(resolve));
    await mongoose.disconnect();
    await mongo.stop();
  }
});
