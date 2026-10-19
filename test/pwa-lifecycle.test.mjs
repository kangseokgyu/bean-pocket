import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { createAppLifecycle } from '../pwa/platform/app-lifecycle.mjs';
import { createUpdateCoordinator } from '../pwa/platform/update-coordinator.mjs';

const PROTOCOL = 'bean-pocket-update-v1';
const GENERATION = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

function eventTarget() {
  const listeners = new Map();
  return {
    addEventListener(type, listener) {
      const current = listeners.get(type) ?? new Set();
      current.add(listener);
      listeners.set(type, current);
    },
    removeEventListener(type, listener) { listeners.get(type)?.delete(listener); },
    async emit(type, event) {
      return Promise.all([...(listeners.get(type) ?? [])].map(listener => listener(event)));
    },
  };
}

function page({ state = { dirty: false, pending: false }, blocked = false, initialized = true, freezeResult = true, scope = 'https://example.test/pwa/', navigate = () => false } = {}) {
  const serviceWorker = eventTarget();
  const owner = { scriptURL: new URL('sw.js', scope).href };
  const registration = { scope, installing: null, waiting: owner, active: null };
  serviceWorker.getRegistration = async () => registration;
  const events = [];
  const locks = [];
  let frozen = false;
  let held = false;
  const submissionState = {
    withWriteLock(action) {
      if (held) return Promise.reject(Object.assign(new Error(), { code: 'lock-busy' }));
      held = true;
      locks.push('acquired');
      const done = Promise.resolve().then(() => action({
        async inspect() { events.push('inspect'); return { initialized, blocked }; },
      }));
      return done.finally(() => { held = false; locks.push('released'); });
    },
  };
  const coordinator = createUpdateCoordinator({
    getState: () => state,
    setFrozen: async (value, details) => {
      frozen = value;
      events.push(value ? `freeze:${details.generation}` : `unfreeze:${details.generation}`);
      return freezeResult;
    },
    submissionState,
    serviceWorker,
    timeoutMs: 100,
    navigate,
  });
  coordinator.start();

  async function request(type, generation = GENERATION) {
    let response;
    const port = { postMessage(value) { response = value; }, close() {} };
    await serviceWorker.emit('message', {
      data: { protocol: PROTOCOL, type, generation },
      ports: [port],
      source: owner,
    });
    return { response, get frozen() { return frozen; }, events, locks, coordinator };
  }
  return { request, serviceWorker, owner, registration, events, locks, coordinator, submissionState, isFrozen: () => frozen };
}

class TestPort {
  constructor() { this.peer = null; this.onmessage = null; this.closed = false; }
  postMessage(data) { queueMicrotask(() => this.peer?.onmessage?.({ data })); }
  close() { this.closed = true; }
}

class TestMessageChannel {
  constructor() {
    this.port1 = new TestPort();
    this.port2 = new TestPort();
    this.port1.peer = this.port2;
    this.port2.peer = this.port1;
  }
}

async function runInstall({ state, blocked = false, freezeResult = true, mutateClients, scope = 'https://example.test/pwa/', multiWindow = false } = {}) {
  const clientPage = page({ state, blocked, freezeResult, scope, navigate: () => true });
  function makeClient(id, targetPage, url) {
    return {
      id, url, messages: [], targetPage,
      postMessage(data, ports = []) {
        this.messages.push(data.type);
        if (this.silent) return;
        void targetPage.serviceWorker.emit('message', {
          data, ports, source: targetPage.owner,
        });
      },
    };
  }
  const client = makeClient('client-a', clientPage, new URL('index.html', scope).href);
  const secondPage = multiWindow ? page({ state, blocked, freezeResult, scope, navigate: () => true }) : null;
  const secondClient = secondPage ? makeClient('client-b', secondPage, new URL('other.html', scope).href) : null;
  const outsideClient = makeClient('client-outside', clientPage, 'https://other.test/pwa/index.html');
  const clientsState = { items: [client, ...(secondClient ? [secondClient] : []), outsideClient], calls: 0 };
  const workerEvents = new Map();
  let skipWaitingCalls = 0;
  const cache = { async addAll() {} };
  const self = {
    registration: { scope },
    location: { origin: 'https://example.test' },
    clients: {
      async matchAll() {
        clientsState.calls++;
        if (mutateClients) mutateClients(clientsState, client);
        return [...clientsState.items];
      },
    },
    async skipWaiting() {
      skipWaitingCalls++;
      for (const item of clientsState.items) {
        if (item.targetPage) {
          item.targetPage.registration.waiting = null;
          item.targetPage.registration.active = item.targetPage.owner;
        }
      }
    },
    addEventListener(type, listener) {
      const current = workerEvents.get(type) ?? [];
      current.push(listener);
      workerEvents.set(type, current);
    },
  };
  const context = vm.createContext({
    self,
    URL,
    MessageChannel: TestMessageChannel,
    crypto: { randomUUID: () => GENERATION },
    caches: { async open() { return cache; }, async keys() { return []; } },
    setTimeout,
    clearTimeout,
    Promise,
  });
  const source = await readFile(new URL('../pwa/sw.js', import.meta.url), 'utf8');
  vm.runInContext(source, context, { filename: 'pwa/sw.js' });
  let installPromise;
  workerEvents.get('install')[0]({ waitUntil(promise) { installPromise = promise; } });
  await installPromise;
  if (skipWaitingCalls > 0) {
    let activatePromise;
    workerEvents.get('activate')[0]({ waitUntil(promise) { activatePromise = promise; } });
    await activatePromise;
  }
  return { clientPage, client, secondPage, secondClient, outsideClient, clientsState, skipWaitingCalls };
}

test('prepare freezes first and ACKs only after a clean-state recheck', async () => {
  const app = page();
  const { response, frozen, events } = await app.request('prepare');
  assert.deepEqual(response, { protocol: PROTOCOL, type: 'ack', generation: GENERATION, ok: true, frozen: true, clean: true });
  assert.equal(frozen, true);
  assert.deepEqual(events.slice(0, 2), [`freeze:${GENERATION}`, 'inspect']);
});

test('dirty state or failed freeze refuses prepare and leaves no window frozen', async () => {
  for (const options of [
    { state: { dirty: true, pending: false } },
    { state: { dirty: false, pending: 1 } },
    { freezeResult: false },
  ]) {
    const app = page(options);
    const { response, frozen } = await app.request('prepare');
    assert.equal(response.ok, false);
    assert.equal(frozen, false);
  }
});

test('prepare checks journal under lock, then native write lock stays held through recheck and releases on apply or abort', async () => {
  const app = page();
  assert.equal((await app.request('prepare')).response.ok, true);
  const lockRequest = app.request('lock');
  await new Promise(resolve => setImmediate(resolve));
  const { response } = await lockRequest;
  assert.equal(response.ok, true);
  assert.equal(app.isFrozen(), true);
  assert.deepEqual(app.locks, ['acquired', 'released', 'acquired']);
  assert.equal((await app.request('recheck')).response.ok, true);
  assert.equal(app.isFrozen(), true);
  await app.request('abort');
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(app.isFrozen(), false);
  assert.deepEqual(app.locks, ['acquired', 'released', 'acquired', 'released']);
});

test('journal with unresolved work refuses prepare and leaves the window unfrozen', async () => {
  const app = page({ blocked: true });
  assert.equal((await app.request('prepare')).response.ok, false);
  assert.equal(app.isFrozen(), false);
});

test('a clean first-run state with no connection or journal can safely update', async () => {
  const app = page({ initialized: false });
  assert.equal((await app.request('prepare')).response.ok, true);
  await app.request('abort');
  assert.equal(app.isFrozen(), false);
});

test('a dirty transition after prepare invalidates that generation before apply', async () => {
  const state = { dirty: false, pending: false };
  const app = page({ state });
  assert.equal((await app.request('prepare')).response.ok, true);
  assert.equal((await app.request('lock')).response.ok, true);
  state.dirty = true;
  assert.equal((await app.request('recheck')).response.ok, false);
  assert.equal(app.isFrozen(), true);
  await app.request('abort');
  assert.deepEqual(app.locks, ['acquired', 'released', 'acquired', 'released']);
});

test('worker source must match the registered scope exactly', async () => {
  const app = page({ scope: 'https://example.test/bean-pocket/' });
  await app.serviceWorker.emit('message', {
    data: { protocol: PROTOCOL, type: 'prepare', generation: GENERATION },
    ports: [{ postMessage() {}, close() {} }],
    source: { scriptURL: 'https://example.test/pwa/sw.js' },
  });
  assert.equal(app.isFrozen(), false);
});

test('install applies only after every window is clean, frozen, rechecked, and lock-protected', async () => {
  const result = await runInstall({ state: { dirty: false, pending: false } });
  assert.equal(result.skipWaitingCalls, 1);
  assert.deepEqual(result.client.messages, ['prepare', 'lock', 'recheck', 'commit', 'activate', 'navigate']);
  assert.equal(result.clientPage.isFrozen(), true);
  await result.clientPage.coordinator.stop();
  assert.deepEqual(result.clientPage.locks, ['acquired', 'released', 'acquired', 'released']);
});

test('two scoped windows freeze and recheck while only one holds the origin-wide native lock', async () => {
  const result = await runInstall({
    state: { dirty: false, pending: false },
    scope: 'https://example.test/bean-pocket/',
    multiWindow: true,
  });
  assert.equal(result.skipWaitingCalls, 1);
  assert.deepEqual(result.client.messages, ['prepare', 'lock', 'recheck', 'commit', 'activate', 'navigate']);
  assert.deepEqual(result.secondClient.messages, ['prepare', 'recheck', 'commit', 'activate', 'navigate']);
  assert.deepEqual(result.outsideClient.messages, []);
  assert.equal(result.clientPage.isFrozen(), true);
  assert.equal(result.secondPage.isFrozen(), true);
  await result.clientPage.coordinator.stop();
  await result.secondPage.coordinator.stop();
});

test('dirty, unresolved, or membership-changing windows abort without skipWaiting', async () => {
  const dirty = await runInstall({ state: { dirty: true, pending: false } });
  assert.equal(dirty.skipWaitingCalls, 0);
  assert.equal(dirty.clientPage.isFrozen(), false);

  const unresolved = await runInstall({ blocked: true });
  assert.equal(unresolved.skipWaitingCalls, 0);
  assert.equal(unresolved.clientPage.isFrozen(), false);

  const changed = await runInstall({
    state: { dirty: false, pending: false },
    mutateClients(snapshot, client) {
      if (client.messages.includes('lock') && !snapshot.items.some(item => item.id === 'client-b')) {
        snapshot.items.push({ id: 'client-b', url: 'https://example.test/pwa/other.html', postMessage() {} });
      }
    },
  });
  assert.equal(changed.skipWaitingCalls, 0);
  assert.equal(changed.clientPage.isFrozen(), false);
});

test('unresponsive windows time out, abort, and never trigger skipWaiting', async () => {
  const result = await runInstall({ state: { dirty: false, pending: false } });
  result.client.silent = true;
  // A second install uses a client that never replies to the prepare request.
  const timedOut = await runInstall({ state: { dirty: false, pending: false }, mutateClients(_snapshot, client) { client.silent = true; } });
  assert.equal(timedOut.skipWaitingCalls, 0);
  assert.equal(timedOut.clientPage.isFrozen(), false);
  assert.equal(result.skipWaitingCalls, 1);
});

test('app lifecycle retries a waiting worker on start and state changes, without forcing reload', async () => {
  const messages = [];
  const waiting = { postMessage(message) { messages.push(message); } };
  const serviceWorker = Object.assign(eventTarget(), {
    async getRegistration() { return { waiting }; },
  });
  const app = createAppLifecycle({
    getState: () => ({ dirty: false, pending: false }),
    setFrozen() { return true; },
    submissionState: { withWriteLock() {} },
    serviceWorker,
    document: null,
    window: null,
  });
  await app.start();
  app.notifyStateChange();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(messages.length >= 2, true);
  assert.ok(messages.every(message => message.protocol === PROTOCOL && message.type === 'retry'));
  assert.deepEqual(Object.keys(app).sort(), ['isFrozen', 'notifyStateChange', 'start', 'stop'].sort());
});

test('app lifecycle start wires the coordinator into the service worker handshake', async () => {
  const serviceWorker = eventTarget();
  const owner = { scriptURL: 'https://example.test/bean-pocket/sw.js' };
  serviceWorker.getRegistration = async () => ({ scope: 'https://example.test/bean-pocket/', waiting: owner });
  const lifecycle = createAppLifecycle({
    getState: () => ({ dirty: false, pending: false }),
    setFrozen(value) { return value ? true : true; },
    submissionState: { withWriteLock: async action => action({ async inspect() { return { initialized: false, blocked: false }; } }) },
    serviceWorker,
    document: null,
    window: null,
  });
  await lifecycle.start();
  let response;
  await serviceWorker.emit('message', {
    data: { protocol: PROTOCOL, type: 'prepare', generation: GENERATION },
    ports: [{ postMessage(value) { response = value; }, close() {} }],
    source: owner,
  });
  assert.equal(response.ok, true);
  assert.equal(lifecycle.isFrozen(), true);
  await serviceWorker.emit('message', { data: { protocol: PROTOCOL, type: 'abort', generation: GENERATION },
    ports: [{ postMessage() {} }], source: owner });
  await lifecycle.stop();
  assert.equal(lifecycle.isFrozen(), false);
});
