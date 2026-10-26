import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { createAppLifecycle } from '../pwa/platform/app-lifecycle.mjs';
import { createAppController } from '../pwa/ui/controller.mjs';
import { createSubmissionState } from '../pwa/state/submission-state.mjs';
import { memoryPlatform } from './fixtures/pwa-environment.mjs';

const protocol = 'bean-pocket-update-v1';
const scope = 'https://example.test/candidate/';
const turn = () => new Promise(resolve => setImmediate(resolve));
class Port {
  postMessage(data) { queueMicrotask(() => { if (!this.peer.closed) this.peer.onmessage?.({ data }); }); }
  close() { this.closed = true; }
}
class Channel {
  constructor() { this.port1 = new Port(); this.port2 = new Port(); this.port1.peer = this.port2; this.port2.peer = this.port1; }
}

async function productPage(native, { active = false, timeoutMs = 5000, window = null, defaultNavigation = false, initialized = true } = {}) {
  const listeners = new Map(), requests = [], navigations = [], freezes = [];
  let onThaw;
  let readAll = async () => ({ beans: [], bags: [], recipes: [], records: [] });
  const owner = { scriptURL: scope + 'sw.js', postMessage(data) { requests.push(data); } };
  const registration = { scope, waiting: active ? null : owner, active: active ? owner : null, installing: null };
  const serviceWorker = {
    getRegistration: async () => registration,
    addEventListener(type, fn) { if (!listeners.has(type)) listeners.set(type, new Set()); listeners.get(type).add(fn); },
    removeEventListener(type, fn) { listeners.get(type)?.delete(fn); },
  };
  const state = createSubmissionState(native);
  let lifecycle;
  const app = createAppController({ state,
    file: { readConnection: async () => JSON.parse(native.files.get('connection.json')) },
    view: { setFrozen(value) { freezes.push(value); if (!value) onThaw?.(); }, setState() {}, renderData() {}, showStatus() {}, showConnection() {} },
    onStateChange: () => lifecycle?.notifyStateChange(),
    makeClient: () => ({ verify: async () => true }),
    makeRepository: () => ({ readAll: () => readAll(), async listBeans() {
      const snapshot = await readAll();
      return { items: snapshot.beans, nextCursor: null, hasMore: false, complete: true };
    } }),
    makeCommands: () => ({}),
  });
  assert.equal(await app.initialize(), initialized);
  lifecycle = createAppLifecycle({ getState: app.getState, setFrozen: app.setFrozen, submissionState: state,
    serviceWorker, document: null, window, timeoutMs,
    ...(defaultNavigation ? {} : { navigate(details) { navigations.push({ ...details, ...app.getState() }); return true; } }) });
  await lifecycle.start();
  async function receive(data, ports, source = owner) {
    await Promise.all([...(listeners.get('message') ?? [])].map(fn => fn({ data, ports, source })));
  }
  return { owner, registration, app, lifecycle, state, requests, navigations, freezes, receive,
    onThaw(fn) { onThaw = fn; },
    setReadAll(fn) { readAll = fn; },
    async send(type, generation = 'probe', source = owner) {
      let ack;
      await receive({ protocol, type, generation }, [{ postMessage(value) { ack = value; } }], source);
      await turn(); return ack;
    },
    async emit(type) { await Promise.all([...(listeners.get(type) ?? [])].map(fn => fn())); await turn(); },
  };
}

let generationSequence = 0;
async function worker(pages) {
  const events = new Map(), timers = new Map(), messages = [], tasks = [], generations = [];
  let skipped = 0;
  const clients = pages.map((p, index) => ({ id: `client-${index}`, url: scope + (index ? 'frame.html' : 'index.html'),
    postMessage(data, ports) { messages.push({ client: index, ...data }); tasks.push(p.receive(data, ports)); },
  }));
  const self = { registration: { scope }, location: { origin: 'https://example.test' },
    clients: { matchAll: async () => clients },
    skipWaiting: async () => { skipped++; },
    addEventListener(type, fn) { events.set(type, fn); },
  };
  vm.runInNewContext(await readFile(new URL('../pwa/sw.js', import.meta.url), 'utf8'), {
    self, URL, Request, MessageChannel: Channel,
    crypto: { randomUUID() { const generation = `generation-${++generationSequence}`; generations.push(generation); return generation; } },
    caches: { open: async () => ({ addAll: async () => {} }), keys: async () => [] },
    setTimeout(fn) { const key = {}; timers.set(key, fn); return key; }, clearTimeout(key) { timers.delete(key); },
  });
  return { messages, generations, clients, get skipped() { return skipped; },
    async dispatch(type) {
      if (type === 'activate') for (const p of pages) { p.registration.waiting = null; p.registration.active = p.owner; }
      let pending; events.get(type)({ waitUntil(value) { pending = value; } });
      await pending; await Promise.all(tasks); await turn();
    },
    async retry() {
      let pending; events.get('message')({ data: { protocol, type: 'retry' }, source: clients[0], waitUntil(value) { pending = value; } });
      await pending; await Promise.all(tasks); await turn();
    },
  };
}

async function cleanup(pages, ...workers) {
  for (const p of pages) {
    for (const generation of new Set(workers.flatMap(w => w.generations))) await p.send('abort', generation);
    await p.lifecycle.stop();
  }
}

test('N1: restarted active worker explicitly recovers two product controllers and the shared write lock', async () => {
  const native = memoryPlatform(), pages = [await productPage(native), await productPage(native)];
  const first = await worker(pages); await first.dispatch('install');
  assert.equal(first.skipped, 1);
  const restarted = await worker(pages);
  try {
    await restarted.dispatch('activate');
    assert.ok(pages.every(p => p.navigations.length === 1), JSON.stringify(restarted.messages));
    assert.ok(pages.every(p => p.navigations[0].frozen && !p.navigations[0].dirty && !p.navigations[0].pending));
    assert.equal(restarted.skipped, 0, 'active recovery must not create an install-only commit');
    assert.equal((await createSubmissionState(native).withWriteLock(context => context.inspect())).blocked, false);
  } finally { await cleanup(pages, first, restarted); }
});

test('late retry delivered to an already active worker cannot freeze a product controller without a new activation', async () => {
  const native = memoryPlatform(), p = await productPage(native, { active: true }), w = await worker([p]);
  try {
    await w.retry();
    assert.equal(w.skipped, 0);
    assert.equal(p.app.getState().frozen, false);
    assert.equal(p.freezes.includes(true), false);
    await p.app.refresh();
  } finally { await cleanup([p], w); }
});

test('waiting-worker restart aborts its old owned generation before preparing a fresh generation', async () => {
  const native = memoryPlatform(), p = await productPage(native);
  const first = await worker([p]); await first.dispatch('install');
  const restarted = await worker([p]);
  try {
    await restarted.retry();
    assert.equal(restarted.skipped, 1);
    assert.equal(p.app.getState().frozen, true);
    assert.ok(restarted.messages.find(message => message.type === 'recover'));
  } finally { await cleanup([p], first, restarted); }
});

test('recovery from a different worker instance cannot release the owned generation', async () => {
  const native = memoryPlatform(), p = await productPage(native), w = await worker([p]);
  try {
    await w.dispatch('install');
    const other = { scriptURL: p.owner.scriptURL }; p.registration.active = other;
    const ack = await p.send('recover', 'recovery-id', other);
    assert.equal(ack?.ok, true);
    assert.equal(p.app.getState().frozen, true);
    await assert.rejects(createSubmissionState(native).withWriteLock(context => context.inspect()));
  } finally { await cleanup([p], w); }
});

test('recovery releases only the lifecycle lock and preserves an unresolved journal barrier without navigation', async () => {
  const native = memoryPlatform(), p = await productPage(native), first = await worker([p]);
  await first.dispatch('install');
  const journal = native.journal();
  journal.connectionGuard = { phase: 'unknown', candidateRevision: journal.activeConnectionRevision, targetFingerprint: 'a'.repeat(64) };
  native.files.set('submission-journal.json', JSON.stringify(journal));
  const restarted = await worker([p]);
  try {
    await restarted.dispatch('activate');
    assert.equal(p.app.getState().frozen, false);
    assert.equal((await createSubmissionState(native).withWriteLock(context => context.inspect())).blocked, true);
    assert.equal(p.navigations.length, 0);
  } finally { await cleanup([p], first, restarted); }
});

test('controllerchange and the committed watchdog ask the active owner for explicit recovery without local thaw', async () => {
  const native = memoryPlatform(), p = await productPage(native, { timeoutMs: 15 }), w = await worker([p]);
  try {
    await w.dispatch('install');
    p.registration.waiting = null; p.registration.active = p.owner;
    p.requests.length = 0;
    await p.emit('controllerchange');
    assert.ok(p.requests.some(message => message.type === 'retry'));
    p.requests.length = 0;
    await new Promise(resolve => setTimeout(resolve, 30));
    assert.ok(p.requests.some(message => message.type === 'retry'));
    assert.equal(p.app.getState().frozen, true, 'a timer only requests the terminal worker decision');
    await assert.rejects(createSubmissionState(native).withWriteLock(context => context.inspect()));
  } finally { await cleanup([p], w); }
});

test('safe activation reloads a hash-routed product document instead of completing a same-document fragment replace', async () => {
  let documentLoads = 0, fragmentNavigations = 0;
  const location = { href: scope + '#/beans',
    replace(url) {
      const target = new URL(url), current = new URL(this.href);
      if (target.hash && target.origin + target.pathname + target.search === current.origin + current.pathname + current.search) fragmentNavigations++;
      else documentLoads++;
    },
    reload() { documentLoads++; },
  };
  const native = memoryPlatform(), p = await productPage(native, { defaultNavigation: true,
    window: { location, addEventListener() {}, removeEventListener() {} } });
  const w = await worker([p]);
  try {
    await w.dispatch('install'); await w.dispatch('activate');
    assert.equal(documentLoads, 1, 'the committed update must replace the running document even when its URL has a fragment');
    assert.equal(fragmentNavigations, 0);
    assert.equal(location.href, scope + '#/beans');
  } finally { await cleanup([p], w); }
});

test('active recovery defers a new document transition if the product becomes dirty after thaw, then resumes on clean', async () => {
  const native = memoryPlatform(), p = await productPage(native), first = await worker([p]);
  await first.dispatch('install');
  let edited = false;
  p.onThaw(() => { if (!edited) { edited = true; p.app.setDirty(true, 'beans'); } });
  const restarted = await worker([p]);
  try {
    await restarted.dispatch('activate'); await restarted.retry();
    assert.equal(p.app.getState().dirty, true);
    assert.equal(p.app.getState().frozen, false);
    assert.equal(p.navigations.length, 0);
    p.requests.length = 0;
    p.app.setDirty(false, 'beans'); await turn();
    assert.ok(p.requests.some(message => message.type === 'retry'), 'clean notification must still reach active B after explicit recovery abort');
    await restarted.retry();
    assert.equal(p.navigations.length, 1);
    assert.equal(restarted.skipped, 0);
  } finally { await cleanup([p], first, restarted); }
});

test('a fresh product client can join the active recovery handshake alongside a committed iframe', async () => {
  const native = memoryPlatform(), leader = await productPage(native), oldFrame = await productPage(native);
  const first = await worker([leader, oldFrame]); await first.dispatch('install');
  // A newly loaded document may fail its first startup lock probe while the old
  // leader retains the acknowledged lock. It still participates in recovery.
  const fresh = await productPage(native, { active: true, initialized: false });
  const restarted = await worker([leader, fresh]);
  try {
    await restarted.dispatch('activate');
    assert.equal(leader.navigations.length, 1);
    assert.equal(fresh.navigations.length, 1);
    assert.equal(restarted.skipped, 0);
  } finally { await cleanup([leader, oldFrame, fresh], first, restarted); }
});

for (const condition of ['clean', 'dirty', 'pending', 'journal']) {
  test(`membership abort after commit preserves active transition intent and revalidates ${condition} state`, async () => {
    const native = memoryPlatform(), leader = await productPage(native), frame = await productPage(native);
    const w = await worker([leader, frame]);
    let releaseRead, pendingRead;
    try {
      await w.dispatch('install'); assert.equal(w.skipped, 1);
      w.clients.splice(1, 1);
      if (condition === 'journal') {
        const journal = native.journal();
        journal.connectionGuard = { phase: 'unknown', candidateRevision: journal.activeConnectionRevision, targetFingerprint: 'a'.repeat(64) };
        native.files.set('submission-journal.json', JSON.stringify(journal));
      }
      let changed = false;
      leader.onThaw(() => {
        if (changed) return;
        changed = true;
        if (condition === 'dirty') leader.app.setDirty(true, 'beans');
        if (condition === 'pending') {
          const gate = new Promise(resolve => { releaseRead = resolve; });
          leader.setReadAll(async () => { await gate; return { beans: [], bags: [], recipes: [], records: [] }; });
          pendingRead = leader.app.refresh();
        }
      });
      await w.dispatch('activate');
      const status = await leader.send('recover', 'after-membership-abort');
      assert.equal(status.ownedGeneration, null);
      assert.equal(status.needsTransition, true, 'the document keeps intent after its aborted session is gone');
      await w.retry(); await w.retry();
      if (condition !== 'clean') {
        assert.equal(leader.navigations.length, 0, `must defer while ${condition}`);
        assert.equal(leader.app.getState().frozen, false);
        leader.requests.length = 0;
        if (condition === 'dirty') leader.app.setDirty(false, 'beans');
        if (condition === 'pending') { releaseRead(); await pendingRead; }
        if (condition === 'journal') {
          const journal = native.journal(); journal.connectionGuard = null;
          native.files.set('submission-journal.json', JSON.stringify(journal));
          await leader.lifecycle.notifyStateChange();
        }
        await turn();
        assert.ok(leader.requests.some(message => message.type === 'retry'));
        await w.retry();
      }
      assert.equal(leader.navigations.length, 1, 'remaining document must transition after a fresh safe active handshake');
      assert.equal(leader.navigations[0].dirty || leader.navigations[0].pending, false);
      assert.equal(w.skipped, 1, 'active recovery must not call skipWaiting again');
      assert.equal((await createSubmissionState(native).withWriteLock(context => context.inspect())).blocked, false);
    } finally {
      releaseRead?.(); await pendingRead;
      await cleanup([leader, frame], w);
    }
  });
}
