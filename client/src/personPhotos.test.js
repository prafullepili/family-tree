import test from 'node:test';
import assert from 'node:assert/strict';
import { preparePersonPhoto, uploadPersonPhoto, discardUnusedPhoto } from './personPhotos.js';

test('photo preparation rejects unsupported formats and oversized originals before opening them', async () => {
  await assert.rejects(preparePersonPhoto({ type: 'image/svg+xml', size: 30 }), /JPEG, PNG, or WebP/);
  await assert.rejects(preparePersonPhoto({ type: 'image/jpeg', size: 11 * 1024 * 1024 }), /10 MB/);
});

test('photo preparation scales images down, produces JPEG, and releases the source preview', async (t) => {
  const previousImage = globalThis.Image, previousDocument = globalThis.document;
  t.after(() => {
    if (previousImage === undefined) delete globalThis.Image; else globalThis.Image = previousImage;
    if (previousDocument === undefined) delete globalThis.document; else globalThis.document = previousDocument;
  });
  let revoked = false, quality;
  t.mock.method(URL, 'createObjectURL', () => 'blob:test-photo');
  t.mock.method(URL, 'revokeObjectURL', () => { revoked = true; });
  globalThis.Image = class {
    naturalWidth = 2000; naturalHeight = 1000;
    set src(value) { queueMicrotask(() => this.onload()); }
  };
  const canvas = { width: 0, height: 0, getContext: () => ({ fillRect() {}, drawImage() {} }), toBlob(callback, type, value) { quality = value; callback(new Blob(['jpeg'], { type })); } };
  globalThis.document = { createElement: () => canvas };
  const file = await preparePersonPhoto(new Blob(['image'], { type: 'image/png' }));
  assert.equal(file.type, 'image/jpeg'); assert.equal(canvas.width, 1024); assert.equal(canvas.height, 512);
  assert.equal(quality, 0.86); assert.equal(revoked, true);
});

test('photo upload sends binary data and surfaces server errors; cleanup only targets stored photos', async () => {
  const file = new Blob(['image'], { type: 'image/jpeg' }); let request;
  const result = await uploadPersonPhoto(file, async (url, options) => {
    request = { url, options }; return new Response(JSON.stringify({ photoUrl: '/api/photos/123' }), { status: 201 });
  });
  assert.equal(result, '/api/photos/123'); assert.equal(request.options.body, file);
  assert.equal(request.options.headers['Content-Type'], 'image/jpeg');
  await assert.rejects(uploadPersonPhoto(file, async () => new Response(JSON.stringify({ error: 'Too large' }), { status: 413 })), /Too large/);
  let deleted = false;
  await discardUnusedPhoto('https://example.com/image.jpg', async () => { deleted = true; });
  assert.equal(deleted, false);
  await discardUnusedPhoto('/api/photos/123', async (_, options) => { assert.equal(options.method, 'DELETE'); deleted = true; });
  assert.equal(deleted, true);
});
