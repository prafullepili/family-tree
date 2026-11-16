import test from 'node:test';
import assert from 'node:assert/strict';
import { familyGroupBounds } from './familyGroupBounds.js';

test('family borders enclose parents and children with room for controls, and deduplicate partner groups', () => {
  const positions = new Map(['a','b','c'].map((id,index) => [id,{x:index*220,y:index===2?210:0,w:196,h:156}]));
  const layout = { positions, familyBranches:[{parentIds:['a','b'],children:['c']}], edges:[{kind:'partner',fromId:'a',toId:'b'}] };
  const [group] = familyGroupBounds(layout);
  assert.equal(familyGroupBounds(layout).length,1);
  assert.deepEqual(group.primaryIds,['a','b']);
  assert.equal(group.primaryIds.includes('c'),false);
  assert.deepEqual([group.x,group.y,group.width,group.height],[-14,-14,664,414]);
  assert.equal(familyGroupBounds({...layout,familyBranches:[]}).length,1);
  assert.deepEqual(familyGroupBounds({...layout,familyBranches:[]})[0].primaryIds,['a','b']);
  assert.equal(familyGroupBounds({positions:new Map(),edges:[]}).length,0);
});
