import test from 'node:test';
import assert from 'node:assert/strict';
import { allowTreeEdit, isTreeEditingLocked, isTreeMutation, setTreeEditingLocked, subscribeTreeEditLock, TREE_LOCK_MESSAGE } from './treeEditLock.js';
import { apiFetch } from './apiClient.js';
import createPersonNavigation from './createPersonNavigation.js';
import createPersonActions from './createPersonActions.js';
import createDataTransferActions from './createDataTransferActions.js';
import createSavedViewActions from './createSavedViewActions.js';

test('locked API requests block all tree mutations while viewing and authentication remain available', async (t) => {
  t.after(() => setTreeEditingLocked(false));
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => { calls++; return new Response('{}'); });
  setTreeEditingLocked(true);
  for (const [path, method] of [['people', 'POST'], ['people/123', 'PATCH'], ['people/batch', 'DELETE'], ['people/layout/positions', 'PATCH'], ['people/import', 'POST'], ['layouts', 'POST'], ['layouts/123', 'DELETE'], ['photos', 'POST'], ['trees', 'POST'], ['trees/123/invitations', 'POST'], ['trees/123/members/456', 'PATCH'], ['trees/123/recycle-bin/456/restore', 'POST']]) {
    await assert.rejects(apiFetch(`https://api.example.com/api/${path}`, { method }), new RegExp('tree is locked'));
  }
  assert.equal(calls, 0);
  await apiFetch('/api/people');
  await apiFetch('/api/auth/logout', { method: 'POST' });
  assert.equal(calls, 2);
  setTreeEditingLocked(false);
  await apiFetch('/api/people', { method: 'POST' });
  assert.equal(calls, 3);
});

test('controllers created before locking cannot edit people, import data, or change local saved views', async (t) => {
  t.after(() => setTreeEditingLocked(false));
  setTreeEditingLocked(false);
  const notices = [], selected = [];
  const options = { readOnly: false, notify: message => notices.push(message), setSelectedId: id => selected.push(id), setSelectedNodeIds() {} };
  const nav = createPersonNavigation(options), people = createPersonActions(options), data = createDataTransferActions(options), views = createSavedViewActions(options);
  setTreeEditingLocked(true);
  nav.openAddPersonForm(); nav.openQuickAdd({}, 'son'); nav.openPersonEditor({}); nav.openLinkEditor();
  await people.saveMember({}); await people.removePerson();
  await data.confirmDataImport(); await data.handleImportFile({ target: { files: [{}], value: 'file' } });
  let prevented = false;
  await views.saveNamedLayout({ preventDefault() { prevented = true; } });
  await views.applyNamedLayout({}); await views.removeNamedLayout({});
  assert.equal(prevented, true);
  assert.equal(notices.length, 11);
  assert.ok(notices.every(message => message === TREE_LOCK_MESSAGE));
  nav.selectPerson('person');
  assert.deepEqual(selected, ['person']);
});

test('lock subscribers update only on changes and Viewer access never becomes writable', () => {
  setTreeEditingLocked(false);
  const states = [], unsubscribe = subscribeTreeEditLock(() => states.push(isTreeEditingLocked()));
  setTreeEditingLocked(true); setTreeEditingLocked(true); setTreeEditingLocked(false);
  unsubscribe(); setTreeEditingLocked(true); setTreeEditingLocked(false);
  assert.deepEqual(states, [true, false]);
  assert.equal(allowTreeEdit(false), true);
  assert.equal(allowTreeEdit(true), false);
  assert.equal(isTreeMutation('/api/auth/login', 'POST'), false);
  assert.equal(isTreeMutation('/api/trees?view=all', 'GET'), false);
});
