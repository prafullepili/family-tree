import test from 'node:test';
import assert from 'node:assert/strict';
import { photoCropRect } from './photoCrop.js';

test('photo crop fits a centered square and keeps pan/zoom coordinates inside the image', () => {
  assert.deepEqual(photoCropRect(1200,800),{x:200,y:0,size:800});
  assert.deepEqual(photoCropRect(800,1200),{x:0,y:200,size:800});
  assert.deepEqual(photoCropRect(1200,800,{zoom:2,x:100,y:0}),{x:800,y:0,size:400});
  assert.deepEqual(photoCropRect(1200,800,{zoom:100,x:-30,y:500}),{x:0,y:600,size:200});
  assert.throws(()=>photoCropRect(0,100),/invalid dimensions/);
});
