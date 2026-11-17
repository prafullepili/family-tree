import test from 'node:test';
import assert from 'node:assert/strict';
import { layoutTree } from './layoutTree.js';

test('portrait spouse links meet the visible image edges while card links keep their original bounds', () => {
  const people = [{id:'a', treeX:0, treeY:0, partnerIds:['b']}, {id:'b', treeX:400, treeY:0, partnerIds:['a']}];
  const portrait = layoutTree(people, {nodeHeight:184, portrait:true});
  const a = portrait.positions.get('a'), b = portrait.positions.get('b');
  const edge = portrait.edges.find((item) => item.kind === 'partner');
  assert.equal(edge.x1, a.x + a.w / 2 + 60);
  assert.equal(edge.x2, b.x + b.w / 2 - 60);
  assert.equal(edge.y1, a.y + 60);
  assert.equal(a.w, 196);
  assert.equal(a.h, 184);
  const classic = layoutTree(people);
  const classicEdge = classic.edges.find((item) => item.kind === 'partner');
  assert.equal(classicEdge.x1, classic.positions.get('a').x + 196);
  assert.equal(classicEdge.y1, classic.positions.get('a').y + 38);
});
