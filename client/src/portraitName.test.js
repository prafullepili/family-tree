import test from 'node:test';
import assert from 'node:assert/strict';
import { portraitNameLines, portraitNodeHeight } from './portraitName.js';

test('portrait names wrap every character without shortening and reserve space for long names', () => {
  const name = 'Gitanjali Desudu ALongUnbrokenFamilySurname';
  const lines = portraitNameLines(name);
  assert.equal(lines.join('').replace(/\s/g,''),name.replace(/\s/g,''));
  assert.ok(lines.length > 2);
  assert.ok(portraitNodeHeight(name) > 184);
  assert.equal(portraitNodeHeight('Prafull Epili'),184);
});
