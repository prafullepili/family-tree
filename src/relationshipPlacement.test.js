import test from 'node:test';
import assert from 'node:assert/strict';
import { relationshipPlacement } from './relationshipPlacement.js';
import { layoutTree } from './layoutTree.js';

const person = (id, treeX, treeY, fields = {}) => ({ id, treeX, treeY, ...fields });
const plan = (people, values, prior = null) => relationshipPlacement(people, values, prior, layoutTree(people).positions);

test('new child uses the moved parent position, including negative coordinates', () => {
  const people = [person('parent', -258, 79)];
  assert.deepEqual(plan(people, { parentIds: ['parent'] }), { treeX: -258, treeY: 269 });
});
test('two parents center their new child beneath their saved positions', () => {
  const people = [person('a', 1000, -300), person('b', 1380, -300)];
  assert.deepEqual(plan(people, { parentIds: ['a', 'b'] }), { treeX: 1190, treeY: -110 });
});
test('new parent is above existing children', () => {
  assert.deepEqual(plan([person('child', -800, 600)], { childIds: ['child'] }), { treeX: -800, treeY: 410 });
});
for (const role of ['partnerIds', 'siblingIds']) {
  test(`${role} stays beside the linked person on the same generation`, () => {
    const result = plan([person('relative', 1200, 1500)], { [role]: ['relative'] });
    assert.equal(result.treeY, 1500);
    assert.equal(result.treeX, 1200 + 196 + (role === 'partnerIds' ? 184 : 120));
  });
}
test('custom relative stays nearby', () => {
  assert.deepEqual(plan([person('relative', 0, 450)], { relationshipLinks: [{ personId: 'relative', label: 'Cousin' }] }), { treeX: 316, treeY: 450 });
});
test('crowded child row searches sideways without overlapping or moving existing people', () => {
  const people = [person('parent', 0, 0), ...Array.from({ length: 20 }, (_, i) => person(`child${i}`, (i - 10) * 316, 190, { parentIds: ['parent'] }))];
  const before = layoutTree(people).positions;
  const placement = plan(people, { parentIds: ['parent'] });
  assert.equal(placement.treeY, 190);
  const after = layoutTree([...people, person('new', placement.treeX, placement.treeY, { parentIds: ['parent'] })]).positions;
  for (const [id, position] of before) {
    assert.equal(after.get(id).rawX, position.rawX);
    assert.equal(after.get(id).rawY, position.rawY);
    assert.ok(Math.abs(placement.treeX - position.rawX) >= 214 || Math.abs(placement.treeY - position.rawY) >= 94);
  }
});
test('profile edits and inferred siblings preserve positions', () => {
  const prior = person('person', 0, 190, { parentIds: ['parent'] });
  const people = [person('parent', 0, 0), prior, person('sibling', 316, 190, { parentIds: ['parent'] })];
  assert.equal(plan(people, { parentIds: ['parent'], siblingIds: ['sibling'] }, prior), null);
});
test('new partner link repositions an existing person relative to the new partner', () => {
  const prior = person('person', 5000, 5000, { parentIds: ['parent'] });
  const people = [prior, person('parent', 0, 0), person('partner', 800, 190)];
  assert.deepEqual(plan(people, { parentIds: ['parent'], partnerIds: ['partner'] }, prior), { treeX: 1180, treeY: 190 });
});
test('unlinked people and removal-only edits do not trigger relocation', () => {
  const prior = person('person', 500, 500, { siblingIds: ['other'] });
  assert.equal(plan([prior, person('other', 0, 0)], {}, prior), null);
  assert.equal(plan([], {}), null);
});
test('saved placement survives reload without automatic coordinates replacing it', () => {
  const people = [person('parent', 900, -500)];
  const placement = plan(people, { parentIds: ['parent'] });
  const result = layoutTree(JSON.parse(JSON.stringify([...people, person('new', placement.treeX, placement.treeY, { parentIds: ['parent'] })])));
  assert.equal(result.positions.get('new').rawX, placement.treeX);
  assert.equal(result.positions.get('new').rawY, placement.treeY);
});
