import test from 'node:test';
import assert from 'node:assert/strict';
import { createAppController } from '../pwa/ui/controller.mjs';

const CONNECTION = { token: 'secret-token', dataSources: { beans: '11111111-1111-4111-8111-111111111111', bags: '22222222-2222-4222-8222-222222222222', recipes: '33333333-3333-4333-8333-333333333333', steps: '44444444-4444-4444-8444-444444444444', records: '55555555-5555-4555-8555-555555555555' } };
const REVISION = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
function harness({ verify = async () => true, readAll = async () => ({ beans: [], bags: [], recipes: [], records: [] }),
  connection = null, inspection = { initialized: false, blocked: false },
  journal = { operations: [], connectionGuard: null, activeConnectionRevision: null }, resolutionOperation = null,
  lockBusyCount = 0, lockBusyAlways = false, inspectionError = null } = {}) {
  const events = [];
  let lockAttempts = 0;
  const view = { showConnection(value) { events.push(['connection', value]); }, showStatus(value) { events.push(['status', value]); }, renderData() {}, clearSecret() { events.push(['clear']); }, showConnectionSuccess() { events.push(['connection-success']); } };
  const context = { async inspect() { events.push(['inspect']); if (inspectionError) throw Object.freeze({ code: inspectionError }); return inspection; }, async readJournal() { return journal; }, async beginConnectionChange(value) { events.push(['begin', value.revision]); }, async commitConnectionChange() { events.push(['commit']); }, async confirmConnection(value) { events.push(['confirm', value.originalConfirmed]); }, async confirmResolution(key, options) { events.push(['confirm-resolution']); return options.freshRead(resolutionOperation); } };
  const state = { async withWriteLock(action) {
    events.push(['lock']);
    lockAttempts++;
    if (lockBusyAlways || lockAttempts <= lockBusyCount) throw Object.freeze({ code: 'lock-busy' });
    return action(context);
  } };
  const file = { async readConnection() { return connection; } };
  const controller = createAppController({ view, state, file, makeClient: () => ({ async verify() { events.push(['verify']); return verify(); } }), makeRepository: () => ({ readAll }), makeCommands: () => ({}), uuid: () => REVISION });
  return { controller, events, get lockAttempts() { return lockAttempts; } };
}

test('connection verifies under the write lock before durable commit and never exposes the token', async () => {
  const env = harness();
  assert.equal(await env.controller.connect(CONNECTION), true);
  const names = env.events.map(item => item[0]);
  assert.ok(names.indexOf('verify') < names.indexOf('begin'));
  assert.ok(names.indexOf('begin') < names.indexOf('commit'));
  assert.ok(names.indexOf('commit') < names.indexOf('connection-success'), 'feedback follows the durable commit');
  assert.equal(env.controller.getState().connected, true);
  assert.equal(JSON.stringify(env.events).includes('secret-token'), false);
});

test('a rejected connection replacement keeps the previously verified connection active', async () => {
  let verification = 0;
  const env = harness({ verify: async () => {
    verification++;
    if (verification === 2) throw Object.freeze({ code: 'unauthorized', httpStatus: 401 });
    return true;
  } });
  await env.controller.connect(CONNECTION);
  const replacement = { ...CONNECTION, token: 'replacement-token' };

  await assert.rejects(env.controller.connect(replacement));

  assert.equal(env.controller.getState().connected, true);
  assert.equal(env.events.filter(([type]) => type === 'connection').at(-1)[1].connected, true);
  assert.equal(JSON.stringify(env.events).includes('replacement-token'), false);
});

test('a verification failure never writes or reports an active connection', async () => {
  const env = harness({ verify: async () => { throw Object.freeze({ code: 'http-rejected', httpStatus: 401 }); } });
  await assert.rejects(env.controller.connect(CONNECTION));
  assert.equal(env.events.some(item => item[0] === 'begin' || item[0] === 'commit'), false);
  assert.equal(env.controller.getState().connected, false);
  assert.equal(JSON.stringify(env.events).includes('secret-token'), false);
});

test('a successful connection remains active when the first full read fails', async () => {
  const env = harness({ readAll: async () => { throw Object.freeze({ code: 'read-failed' }); } });
  assert.equal(await env.controller.connect(CONNECTION), true);
  assert.equal(env.controller.getState().connected, true);
  assert.ok(env.events.some(([type, value]) => type === 'status' && value.type === 'read-error'));
});

test('lifecycle freeze refuses dirty or pending work and freezes clean state', async () => {
  const env = harness();
  assert.equal(env.controller.setFrozen(true, { generation: 'test' }), true);
  assert.equal(env.controller.getState().frozen, true);
  env.controller.setFrozen(false);
  env.controller.bind();
  assert.equal(env.controller.getState().dirty, false);
});

test('frozen lifecycle rejects refresh and connection replacement before side effects', async () => {
  let reads = 0;
  const env = harness({ readAll: async () => { reads++; return { beans: [], bags: [], recipes: [], records: [] }; } });
  env.controller.setFrozen(true, { generation: 'update' });
  await assert.rejects(env.controller.refresh(), error => error.code === 'lifecycle-frozen');
  await assert.rejects(env.controller.connect(CONNECTION), error => error.code === 'lifecycle-frozen');
  assert.equal(reads, 0);
  assert.equal(env.events.some(([type]) => type === 'verify' || type === 'begin'), false);
});

test('dirty drafts prevent lifecycle freeze and are reported to the coordinator', async () => {
  const env = harness();
  env.controller.setDirty(true);
  assert.equal(env.controller.setFrozen(true), false);
  assert.equal(env.controller.getState().dirty, true);
  assert.equal(env.controller.getState().frozen, false);
});

test('manual refresh owns the pending state and refuses a second read until it finishes', async () => {
  let hold = false;
  let releaseRead;
  let reads = 0;
  const env = harness({ readAll: async () => {
    reads++;
    if (hold) await new Promise(resolve => { releaseRead = resolve; });
    return { beans: [], bags: [], recipes: [], records: [] };
  } });
  await env.controller.connect(CONNECTION);
  hold = true;

  const first = env.controller.refresh();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(env.controller.getState().pending, true);
  await assert.rejects(env.controller.refresh(), error => error.code === 'lock-unavailable');
  assert.equal(reads, 2);

  releaseRead();
  await first;
  assert.equal(env.controller.getState().pending, false);
});

test('current-connection recovery keeps pending through reinitialization and its final read', async () => {
  const states = [];
  let readCount = 0;
  let releaseFinalRead;
  let markFinalReadStarted;
  const finalReadStarted = new Promise(resolve => { markFinalReadStarted = resolve; });
  const finalReadGate = new Promise(resolve => { releaseFinalRead = resolve; });
  const connection = { ...CONNECTION, revision: REVISION };
  const context = {
    async inspect() { return { initialized: true, blocked: false }; },
    async readJournal() { return { operations: [], connectionGuard: null, activeConnectionRevision: REVISION }; },
    async confirmConnection(options) { return options.freshRead({ connectionRevision: REVISION }); },
  };
  const controller = createAppController({
    view: {
      setState(value) { states.push(value.pending); },
      showConnection() {}, showStatus() {}, renderData() {}, showUnresolved() {}, finishStartup() {},
    },
    state: { async withWriteLock(action) { return action(context); } },
    file: { async readConnection() { return connection; } },
    makeClient: () => ({ async verify() {} }),
    makeRepository: () => ({ async readAll() {
      readCount++;
      if (readCount === 2) {
        markFinalReadStarted();
        await finalReadGate;
      }
      return { beans: [], bags: [], recipes: [], records: [] };
    } }),
    makeCommands: () => ({}),
  });

  const recovering = controller.confirmCurrent(true);
  await finalReadStarted;
  assert.equal(controller.getState().pending, true);
  assert.equal(states.includes(false), false, 'the handoff to initialize must not briefly end pending work');

  releaseFinalRead();
  await recovering;
  assert.equal(controller.getState().pending, false);
  assert.equal(states.at(-1), false);
});

test('initialization fails closed when state is blocked without a journal-visible recovery', async () => {
  const env = harness({ connection: { ...CONNECTION, revision: REVISION },
    inspection: { initialized: true, blocked: true },
    journal: { operations: [], connectionGuard: null, activeConnectionRevision: REVISION } });

  assert.equal(await env.controller.initialize(), false);

  assert.equal(env.controller.getState().connected, false);
  assert.equal(env.events.some(([type]) => type === 'verify'), false);
});

test('initialization does not offer a fresh connection setup for an unexplained blocked state', async () => {
  const env = harness({ inspection: { initialized: false, blocked: true },
    journal: { operations: [], connectionGuard: null, activeConnectionRevision: null } });

  assert.equal(await env.controller.initialize(), false);

  const latestStatus = env.events.filter(([type]) => type === 'status').at(-1)[1];
  assert.match(latestStatus.message, /journal/);
  assert.equal(env.events.some(([type]) => type === 'verify'), false);
});

test('initialization keeps the verified connection available to resolve a journaled unknown write', async () => {
  const env = harness({ connection: { ...CONNECTION, revision: REVISION },
    inspection: { initialized: true, blocked: true },
    journal: { operations: [{ kind: 'beans', status: 'unknown', createdPages: [] }],
      connectionGuard: null, activeConnectionRevision: REVISION } });

  assert.equal(await env.controller.initialize(), true);

  assert.equal(env.controller.getState().connected, true);
  assert.equal(env.controller.getState().unresolved, true);
  assert.equal(env.events.filter(([type]) => type === 'verify').length, 1);
});

test('initialization retries only startup lock acquisition and becomes ready when the lock clears', async () => {
  const env = harness({ connection: { ...CONNECTION, revision: REVISION },
    inspection: { initialized: true, blocked: false },
    journal: { operations: [], connectionGuard: null, activeConnectionRevision: REVISION },
    lockBusyCount: 2 });

  assert.equal(await env.controller.initialize(), true);

  assert.equal(env.lockAttempts, 3);
  assert.equal(env.events.filter(([type]) => type === 'verify').length, 1);
  assert.equal(env.controller.getState().connected, true);
});

test('exhausted startup lock contention offers a saved-state retry without connection entry', async () => {
  const env = harness({ lockBusyAlways: true });

  assert.equal(await env.controller.initialize(), false);

  assert.equal(env.lockAttempts, 6);
  assert.equal(env.controller.getState().connected, false);
  assert.equal(env.events.filter(([type]) => type === 'verify').length, 0);
  assert.deepEqual(env.events.filter(([type]) => type === 'connection').at(-1),
    ['connection', { connected: false, retryInitialization: true }]);
  const status = env.events.filter(([type]) => type === 'status').at(-1)[1];
  assert.equal(status.type, 'startup-busy');
  assert.match(status.message, /다른 창/);
  assert.doesNotMatch(status.message, /요청을 완료하지 못했습니다/);
});

test('startup does not retry a lock-busy error thrown after entering the native lock callback', async () => {
  const env = harness({ inspectionError: 'lock-busy' });

  assert.equal(await env.controller.initialize(), false);

  assert.equal(env.lockAttempts, 1);
  assert.equal(env.events.filter(([type]) => type === 'inspect').length, 1);
  assert.equal(env.events.filter(([type]) => type === 'verify').length, 0);
});

test('resolution rejects extra page IDs when the journal already records created pages', async () => {
  let verificationCount = 0;
  let readCount = 0;
  const env = harness({ verify: async () => { verificationCount++; },
    readAll: async () => { readCount++; return { beans: [], bags: [], recipes: [], records: [] }; },
    connection: { ...CONNECTION, revision: REVISION },
    resolutionOperation: { kind: 'beans', status: 'partial', connectionRevision: REVISION,
      targetFingerprint: 'a'.repeat(64), createdPages: [{ kind: 'beans', id: '66666666-6666-4666-8666-666666666666', archiveState: 'active' }] } });
  await env.controller.connect(CONNECTION);
  const before = { verificationCount, readCount };

  await assert.rejects(env.controller.resolveOperation('77777777-7777-4777-8777-777777777777', {
    originalConfirmed: true, decision: 'saved', pageIds: '88888888-8888-4888-8888-888888888888',
  }), error => error.code === 'invalid-resolution');

  assert.deepEqual({ verificationCount, readCount }, before);
});
