import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { createUpdateCoordinator } from '../pwa/platform/update-coordinator.mjs';
import { createSubmissionState } from '../pwa/state/submission-state.mjs';
import { memoryPlatform } from './fixtures/pwa-environment.mjs';
const ROOT = new URL('../', import.meta.url).pathname;
const scope = 'https://example.test/pwa/';
const protocol = 'bean-pocket-update-v1';
const turn = () => new Promise(r => setImmediate(r));
function gate() { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; }
function page({ inspect = async () => ({ blocked: false }), freeze, native, navigate, controller } = {}) {
  let listener, frozen = false, held = false;
  const owner = { scriptURL: scope + 'sw.js' };
  const registration = { scope, installing: null, waiting: owner, active: null };
  const state = { dirty: false, pending: false };
  const serviceWorker = {
    controller,
    getRegistration: async () => registration,
    addEventListener(_type, fn) { listener = fn; },
    removeEventListener() { listener = undefined; },
  };
  const submissionState = native ? createSubmissionState(native) : {
    async withWriteLock(fn) {
      if (held) throw Error('busy');
      held = true;
      try { return await fn({ inspect }); } finally { held = false; }
    },
  };
  const coordinator = createUpdateCoordinator({ getState: () => state,
    setFrozen: async value => { if (freeze) await freeze(value); frozen = value; return true; },
    submissionState, serviceWorker, navigate, timeoutMs: 100 });
  coordinator.start();
  async function send(type, generation = 'g1', source = owner) {
    let ack;
    await listener?.({ source, data: { protocol, type, generation },
      ports: [{ postMessage(value) { ack = value; } }] });
    await turn();
    return ack;
  }
  return { coordinator, state, send, owner, registration, serviceWorker, get frozen() { return frozen; }, get held() { return held; },
    receive(data, ports = []) { return listener?.({ source: owner, data, ports }); } };
}
class Port {
  postMessage(data) { queueMicrotask(() => { if (!this.peer.closed) this.peer.onmessage?.({ data }); }); }
  close() { this.closed = true; }
}
class Channel {
  constructor() { this.port1 = new Port(); this.port2 = new Port(); this.port1.peer = this.port2; this.port2.peer = this.port1; }
}
async function worker(p, { onMatch, onSkip, onMessage } = {}) {
  const events = new Map(), timers = new Map(), messages = [], tasks = [];
  let calls = 0, skipped = 0, timerId = 0;
  const client = { id: 'window-1', url: scope + 'index.html', postMessage(data, ports) {
    messages.push(data.type); tasks.push(p.receive(data, ports));
    onMessage?.(data);
  } };
  const self = { registration: { scope }, location: { origin: 'https://example.test' },
    clients: { async matchAll() { await onMatch?.(++calls); return [client]; } },
    async skipWaiting() { skipped++; onSkip?.(); },
    addEventListener(type, fn) { events.set(type, fn); } };
  const source = await readFile(ROOT + '/pwa/sw.js', 'utf8');
  vm.runInNewContext(source, { self, URL, MessageChannel: Channel,
    crypto: { randomUUID: () => 'g1' },
    caches: { async open() { return { async addAll() {} }; }, async keys() { return []; } },
    setTimeout(fn) { const id = ++timerId; timers.set(id, fn); return id; },
    clearTimeout(id) { timers.delete(id); } });
  function dispatch(type) {
    if (type === 'activate') { p.registration.waiting = null; p.registration.active = p.owner; }
    let pending; events.get(type)({ waitUntil(p) { pending = p; } }); return pending;
  }
  return { dispatch, messages, tasks, expire() { for (const [id, fn] of [...timers]) { timers.delete(id); fn(); } },
    get skipped() { return skipped; } };
}

test('R1: SW prepare timeout must unfreeze the recipient even when inspect completes late', async () => {
  const entered = gate(), release = gate();
  const p = page({ inspect: async () => { entered.resolve(); await release.promise; return { blocked: false }; } });
  const w = await worker(p);
  const installing = w.dispatch('install');
  await entered.promise;
  assert.equal(p.frozen, true);
  w.expire(); // fire actual worker timeout callback without a wall-clock delay
  await installing;
  release.resolve(); await Promise.all(w.tasks); await turn();
  const actual = { frozen: p.frozen, messages: w.messages, skipped: w.skipped };
  await p.coordinator.stop();
  assert.equal(actual.frozen, false, JSON.stringify(actual));
});

test('R2: abort received during a pending prepare must tombstone the generation', async () => {
  const entered = gate(), release = gate();
  const p = page({ freeze: async value => { if (value) { entered.resolve(); await release.promise; } } });
  const preparing = p.send('prepare'); await entered.promise;
  const aborting = p.send('abort'); await turn();
  assert.equal(p.frozen, false);
  release.resolve();
  const [ack, abortAck] = await Promise.all([preparing, aborting]);
  const actual = { frozen: p.frozen, ack };
  await p.coordinator.stop();
  assert.equal(abortAck.ok, true);
  assert.equal(actual.frozen, false, JSON.stringify(actual));
});

test('R3: stop while prepare is awaiting setFrozen must not leave a live freeze', async () => {
  const entered = gate(), release = gate();
  const p = page({ freeze: async value => { if (value) { entered.resolve(); await release.promise; } } });
  const preparing = p.send('prepare'); await entered.promise;
  const stopping = p.coordinator.stop(); await turn();
  release.resolve(); await Promise.all([preparing, stopping]);
  const actual = p.frozen; await p.coordinator.stop();
  assert.equal(actual, false);
});

test('R4: invalidation after recheck must prevent skipWaiting with an unfrozen, unlocked dirty leader', async () => {
  const p = page(); let atSkip;
  const w = await worker(p, {
    async onMatch(call) { if (call === 3) { p.state.dirty = true; p.coordinator.notifyStateChange(); await turn(); } },
    onSkip() { atSkip = { dirty: p.state.dirty, frozen: p.frozen, held: p.held }; },
  });
  await w.dispatch('install'); await Promise.all(w.tasks);
  await p.coordinator.stop();
  assert.equal(w.skipped, 0, JSON.stringify({ skipped: w.skipped, atSkip, messages: w.messages }));
});

test('R5: activation from an unrelated generation must not release current freeze/leader lock', async () => {
  const p = page(); await p.send('prepare', 'new-generation'); await p.send('lock', 'new-generation');
  await p.send('activate', 'old-generation');
  const actual = { frozen: p.frozen, held: p.held };
  await p.coordinator.stop();
  assert.equal(actual.frozen && actual.held, true, JSON.stringify(actual));
});

test('R7: aborting an older overlapping generation must not unfreeze an ACKed newer one', async () => {
  const p = page();
  await p.send('prepare', 'old'); await p.send('prepare', 'new');
  await p.send('abort', 'old');
  const ack = await p.send('recheck', 'new');
  const actual = { frozen: p.frozen, ack };
  await p.coordinator.stop();
  assert.equal(actual.frozen || actual.ack.ok === false, true, JSON.stringify(actual));
});

test('R8: activation from newly active B is accepted while the open A page still has controller A', async () => {
  const oldController = { scriptURL: scope + 'sw.js' };
  const navigations = [];
  const p = page({ controller: oldController, navigate: details => { navigations.push(details); return true; } });
  assert.equal((await p.send('prepare')).ok, true);
  assert.equal((await p.send('lock')).ok, true);
  assert.equal((await p.send('commit')).ok, true);
  p.registration.waiting = null;
  p.registration.active = p.owner;
  assert.equal(p.serviceWorker.controller, oldController);
  const activated = await p.send('activate');
  assert.equal(activated.ok, true, JSON.stringify(activated));
  const navigated = await p.send('navigate');
  assert.equal(navigated.ok, true, JSON.stringify(navigated));
  assert.equal(navigations.length, 1);
  assert.equal(p.frozen && !p.held, true);
  await p.coordinator.stop();
});

test('R9: stop waits for an in-flight freeze and applies its unfreeze after the late completion', async () => {
  const entered = gate(), release = gate();
  const p = page({ freeze: async value => { if (value) { entered.resolve(); await release.promise; } } });
  const preparing = p.send('prepare'); await entered.promise;
  let stopped = false;
  const stopping = p.coordinator.stop().then(() => { stopped = true; });
  await turn();
  assert.equal(stopped, false, 'stop must wait until a pending freeze can be safely undone');
  release.resolve();
  const [ack] = await Promise.all([preparing, stopping]);
  assert.equal(ack.ok, false);
  assert.equal(p.frozen, false);
  assert.equal(p.held, false);
  assert.equal(stopped, true);
});

test('R10: invalidation racing the commit ACK prevents skipWaiting and releases only after abort', async () => {
  const p = page(); let invalidated = false;
  const w = await worker(p, { onMessage(data) {
    if (data.type === 'commit' && !invalidated) {
      invalidated = true;
      p.state.dirty = true;
      p.coordinator.notifyStateChange();
    }
  } });
  await w.dispatch('install');
  await Promise.all(w.tasks);
  assert.equal(w.skipped, 0);
  assert.equal(p.frozen || p.held, false);
  await p.coordinator.stop();
});

test('C1: real submission-state blocks incoherent/guarded/unknown/processing journals, and accepts empty first run', async () => {
  for (const condition of ['empty', 'clean', 'guard', 'unknown', 'processing', 'partial', 'connection-only', 'journal-only', 'corrupt']) {
    const native = memoryPlatform({ initialized: condition !== 'empty' });
    if (['guard', 'unknown', 'processing', 'partial'].includes(condition)) {
      const journal = native.journal();
      if (condition === 'guard') journal.connectionGuard = { phase: 'processing',
        candidateRevision: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', targetFingerprint: 'a'.repeat(64) };
      else journal.operations = [{ key: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', kind: 'bean',
        connectionRevision: journal.activeConnectionRevision, targetFingerprint: 'a'.repeat(64),
        payloadFingerprint: 'b'.repeat(64), status: condition, createdPages: [], updatedAt: '2026-10-19T00:00:00.000Z' }];
      native.files.set('submission-journal.json', JSON.stringify(journal));
    }
    if (condition === 'connection-only') native.files.delete('submission-journal.json');
    if (condition === 'journal-only') native.files.delete('connection.json');
    if (condition === 'corrupt') native.files.set('submission-journal.json', '{');
    const p = page({ native }); const ack = await p.send('prepare');
    const allowed = ['empty', 'clean'].includes(condition);
    assert.equal(ack.ok, allowed, condition); assert.equal(p.frozen, allowed, condition);
    await p.coordinator.stop();
  }
});

test('C2: source validation rejects foreign origin and a sibling scope worker', async () => {
  const p = page();
  for (const scriptURL of ['https://foreign.test/pwa/sw.js', 'https://example.test/other/sw.js']) {
    assert.equal(await p.send('prepare', 'g1', { scriptURL }), undefined); assert.equal(p.frozen, false);
  }
  await p.coordinator.stop();
});

test('C3: actual submission-state holds shared lock adapter until activation and blocks another instance', async () => {
  const native = memoryPlatform(); const p = page({ native }); const other = createSubmissionState(native);
  const w = await worker(p);
  await w.dispatch('install');
  let blocked = false;
  try { await other.withWriteLock(context => context.inspect()); } catch { blocked = true; }
  assert.equal(blocked, true); assert.equal(p.frozen, true);
  await w.dispatch('activate'); await Promise.all(w.tasks); await turn();
  assert.equal((await other.withWriteLock(context => context.inspect())).blocked, false);
  assert.equal(p.frozen, false); await p.coordinator.stop();
});


test('F3: committed active build B conditionally replaces the open build A while still frozen', async () => {
  let runningBuild = 'A';
  let safety;
  const p = page({ navigate({ buildVersion }) {
    safety = { frozen: p.frozen, held: p.held, dirty: p.state.dirty };
    runningBuild = buildVersion;
    return true;
  } });
  const w = await worker(p);
  await w.dispatch('install');
  assert.equal(runningBuild, 'A');
  assert.equal(p.frozen && p.held, true);
  await w.dispatch('activate'); await Promise.all(w.tasks);
  assert.equal(runningBuild, '__BUILD_VERSION__');
  assert.deepEqual(safety, { frozen: true, held: true, dirty: false });
  await p.coordinator.stop();
});

test('same script URL with a different worker instance cannot abort an owned generation', async () => {
  const p = page();
  await p.send('prepare');
  await p.send('abort', 'g1', { scriptURL: scope + 'sw.js' });
  assert.equal(p.frozen, true);
  await p.send('abort');
  assert.equal(p.frozen, false);
  await p.coordinator.stop();
});

test('abort before prepare leaves a tombstone that prevents a late prepare from freezing', async () => {
  const p = page();
  await p.send('abort');
  const ack = await p.send('prepare');
  assert.equal(ack.ok, false);
  assert.equal(p.frozen, false);
  await p.coordinator.stop();
});

test('dirty invalidation after commit retains freeze and native lock until a terminal abort', async () => {
  const p = page();
  await p.send('prepare'); await p.send('lock'); await p.send('commit');
  p.state.dirty = true; p.coordinator.notifyStateChange(); await turn();
  assert.equal(p.frozen && p.held, true);
  assert.equal((await p.send('activate')).ok, false);
  await p.send('abort');
  assert.equal(p.frozen || p.held, false);
  await p.coordinator.stop();
});
