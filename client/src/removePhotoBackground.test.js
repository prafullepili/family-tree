import test from 'node:test';
import assert from 'node:assert/strict';
import { applyPersonMask } from './removePhotoBackground.js';

test('person masks remove background, soften boundaries, and preserve existing transparency', () => {
  const pixels = new Uint8ClampedArray([10,20,30,255,10,20,30,255,10,20,30,128,10,20,30,255]);
  applyPersonMask(pixels,4,1,new Float32Array([0,.5,1,1]),4,1);
  assert.deepEqual([...pixels.filter((_,index) => index%4===3)],[0,128,128,255]);
  assert.deepEqual([...pixels.slice(0,3)],[10,20,30]);
});

test('mask sampling handles dimensions different from the photo and refuses an empty cutout', () => {
  const pixels = new Uint8ClampedArray(4*4).fill(255);
  applyPersonMask(pixels,4,1,new Float32Array([0,1]),2,1);
  assert.deepEqual([...pixels.filter((_,index)=>index%4===3)],[0,0,255,255]);
  assert.throws(()=>applyPersonMask(new Uint8ClampedArray(16).fill(255),4,1,new Float32Array([0]),1,1),/No person/);
});
