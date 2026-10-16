import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import vm from 'node:vm';

const script = await readFile(new URL('../public/sw.js', import.meta.url), 'utf8');
function worker({ offline = false, cached = new Response('offline screen') } = {}) {
  const listeners = new Map();
  const removed = [];
  const saved = [];
  const requests = [];
  let activated = false;
  const context = {
    URL,
    Response,
    self: {
      location: { origin: 'https://gold.example' },
      clients: { claim: async () => {} },
      addEventListener: (name, handler) => listeners.set(name, handler),
      skipWaiting: () => {
        activated = true;
      },
    },
    caches: {
      open: async () => ({
        addAll: async (urls) => saved.push(...urls),
        match: async () => cached,
      }),
      keys: async () => ['sheri-gold-offline-v0', 'sheri-gold-offline-v1', 'another-app-cache'],
      delete: async (name) => removed.push(name),
    },
    fetch: async (request) => {
      requests.push(request);
      if (offline) throw new Error('offline');
      return new Response('network response');
    },
  };
  vm.runInNewContext(script, context);
  function fetchEvent(url, method = 'GET', mode = 'cors') {
    let result;
    listeners.get('fetch')({
      request: { url, method, mode },
      respondWith: (promise) => {
        result = promise;
      },
    });
    return result;
  }
  return { listeners, removed, saved, requests, fetchEvent, activated: () => activated };
}

test('offline navigation gets a generic page, not a cached account or price', async () => {
  const sw = worker({ offline: true });
  const response = await sw.fetchEvent(
    'https://gold.example/requests/private-id',
    'GET',
    'navigate'
  );
  assert.equal(await response.text(), 'offline screen');
  assert.deepEqual(sw.saved, []);
});
test('online navigation always uses the network and is never cached', async () => {
  const sw = worker();
  assert.equal(
    await (await sw.fetchEvent('https://gold.example/account', 'GET', 'navigate')).text(),
    'network response'
  );
  assert.equal(sw.requests.length, 1);
  assert.deepEqual(sw.saved, []);
});
test('does not intercept API responses, financial mutations, receipts, or RSC requests', () => {
  const sw = worker({ offline: true });
  for (const [url, method, mode] of [
    ['https://gold.example/api/trading/wallet', 'GET', 'cors'],
    ['https://gold.example/api/trading/transactions', 'POST', 'cors'],
    ['https://gold.example/api/trading/transactions/id/receipt', 'GET', 'navigate'],
    ['https://api.gold.example/api/trading/rates', 'GET', 'cors'],
    ['https://gold.example/requests?_rsc=123', 'GET', 'cors'],
    ['https://gold.example/anything', 'POST', 'cors'],
  ])
    assert.equal(sw.fetchEvent(url, method, mode), undefined);
});
test('only preloads public fallback assets and leaves updates waiting', async () => {
  const sw = worker();
  let task;
  sw.listeners.get('install')({
    waitUntil: (promise) => {
      task = promise;
    },
  });
  await task;
  assert.ok(sw.saved.includes('/offline.html'));
  assert.ok(sw.saved.every((url) => url === '/offline.html' || url.startsWith('/icons/')));
  assert.equal(sw.activated(), false);
  for (const url of sw.saved) await readFile(new URL(`../public${url}`, import.meta.url));
});
test('activation only removes this applications old fallback caches', async () => {
  const sw = worker();
  let task;
  sw.listeners.get('activate')({
    waitUntil: (promise) => {
      task = promise;
    },
  });
  await task;
  assert.deepEqual(sw.removed, ['sheri-gold-offline-v0']);
});
test('a waiting update activates only on an explicit update message', () => {
  const sw = worker();
  sw.listeners.get('message')({ data: { type: 'OTHER' } });
  assert.equal(sw.activated(), false);
  sw.listeners.get('message')({ data: { type: 'ACTIVATE_UPDATE' } });
  assert.equal(sw.activated(), true);
});
test('missing offline cache fails with a non-sensitive 503', async () => {
  const sw = worker({ offline: true, cached: undefined });
  // Explicitly replace the default cache result with null.
  const empty = worker({ offline: true, cached: null });
  assert.equal((await empty.fetchEvent('https://gold.example/', 'GET', 'navigate')).status, 503);
  assert.deepEqual(sw.saved, []);
});
test('icons have the declared PNG dimensions', async () => {
  for (const [name, size] of [
    ['icon-192.png', 192],
    ['icon-512.png', 512],
    ['maskable-512.png', 512],
    ['apple-touch-icon.png', 180],
  ]) {
    const bytes = await readFile(new URL(`../public/icons/${name}`, import.meta.url));
    assert.equal(bytes.readUInt32BE(16), size);
    assert.equal(bytes.readUInt32BE(20), size);
  }
});
