import test from 'node:test';
import assert from 'node:assert/strict';
import { loadGoogleIdentity } from './googleIdentity.js';

test('Google script loading survives duplicate mounts and retries failed loads', async () => {
  const originalWindow = globalThis.window;
  const originalDocument = globalThis.document;
  let script;
  let appended = 0;
  globalThis.window = {};
  globalThis.document = {
    getElementById: () => script,
    createElement: () => {
      const element = new EventTarget();
      element.remove = () => { script = undefined; };
      return element;
    },
    head: { appendChild: (element) => { script = element; appended += 1; } },
  };
  try {
    const firstMount = loadGoogleIdentity();
    const secondMount = loadGoogleIdentity();
    assert.equal(firstMount, secondMount);
    assert.equal(appended, 1);
    script.dispatchEvent(new Event('error'));
    await assert.rejects(firstMount, /could not load/);
    const retry = loadGoogleIdentity();
    assert.equal(appended, 2);
    const identity = { initialize() {}, renderButton() {} };
    window.google = { accounts: { id: identity } };
    script.dispatchEvent(new Event('load'));
    assert.equal(await retry, identity);
    assert.equal(await loadGoogleIdentity(), identity);
    assert.equal(appended, 2);
  } finally {
    globalThis.window = originalWindow;
    globalThis.document = originalDocument;
  }
});
