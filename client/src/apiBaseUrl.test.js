import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveApiBaseUrl } from './apiBaseUrl.js';

test('local production builds keep login and data requests on the local origin', () => {
  for (const hostname of ['localhost', '127.0.0.1', '[::1]']) {
    assert.equal(resolveApiBaseUrl({ hostname, configuredUrl: 'https://family-tree-t6j3.onrender.com', production: true }), '');
  }
});

test('deployed clients retain their configured API origin', () => {
  assert.equal(resolveApiBaseUrl({ hostname: 'prafullepili.github.io', configuredUrl: 'https://family-tree-t6j3.onrender.com/', production: true }), 'https://family-tree-t6j3.onrender.com');
  assert.equal(resolveApiBaseUrl({ hostname: 'example.com' }), '');
});
