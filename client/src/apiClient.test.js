import assert from 'node:assert/strict';
import test from 'node:test';

const jsonResponse = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

test('initial family load is shared across duplicate startup effects', async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url) => {
    calls.push(url);
    if (url === '/api/health') return jsonResponse({ configured: true, database: 'connected' });
    if (url === '/api/people') return jsonResponse([{ _id: 'person-1', firstName: 'One' }]);
    return jsonResponse({ error: 'Unexpected request' }, 404);
  };

  try {
    const { loadInitialFamilyData } = await import(`./apiClient.js?shared=${Date.now()}`);
    const [first, second] = await Promise.all([loadInitialFamilyData(), loadInitialFamilyData()]);
    assert.deepEqual(first, second);
    assert.deepEqual(calls, ['/api/health', '/api/people']);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('disconnected MongoDB stops after one health request', async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url) => {
    calls.push(url);
    return jsonResponse({ configured: true, database: 'disconnected' });
  };

  try {
    const { loadInitialFamilyData } = await import(`./apiClient.js?offline=${Date.now()}`);
    await assert.rejects(loadInitialFamilyData(), /MongoDB is currently disconnected/);
    assert.deepEqual(calls, ['/api/health']);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
