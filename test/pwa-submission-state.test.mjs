import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { inspect } from 'node:util';
import { createSubmissionState, createSubmissionDraft } from '../pwa/state/submission-state.mjs';

const REV = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const NEXT = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const ID = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
const KEYS = ['beans', 'bags', 'recipes', 'steps', 'records'];
const sources = Object.fromEntries(KEYS.map((key, n) => [key, String(n + 1).repeat(8) + '-1111-1111-1111-111111111111']));
const connection = revision => ({ schemaVersion: 1, revision, token: 'fake-private-token', dataSources: { ...sources } });
const journalName = 'submission-journal.json';
const connectionName = 'connection.json';
const now = () => '2026-10-19T00:00:00.000Z';
const namedError = name => Object.assign(new Error('PRIVATE RAW ERROR'), { name });

function environment({ initialized = true } = {}) {
  const files = new Map();
  if (initialized) {
    files.set(connectionName, JSON.stringify(connection(REV)));
    files.set(journalName, JSON.stringify({ schemaVersion: 1, activeConnectionRevision: REV, connectionGuard: null, operations: [] }));
  }
  let held = false;
  const calls = [];
  const faults = new Map();
  const hooks = {};
  const trip = stage => { if (faults.has(stage)) throw namedError(faults.get(stage)); };
  const storage = { async getDirectory() {
    trip('root');
    return { async getDirectoryHandle(name, options) {
      assert.equal(name, 'bean-pocket-private-v1'); trip('directory');
      return { async getFileHandle(name, options) {
        trip('handle');
        if (!files.has(name)) {
          if (!options.create) throw namedError('NotFoundError');
          files.set(name, '');
        }
        return {
          async getFile() { trip('getFile'); return { async text() { trip('text'); await hooks.text?.(name); return files.get(name); } }; },
          async createWritable() {
            trip('createWritable'); let staged;
            return {
              async write(value) { trip('write'); await hooks.write?.(value); staged = value; },
              async close() { trip('close'); files.set(name, staged); await hooks.close?.(name); trip('afterClose'); },
              async abort() { trip('abort'); },
            };
          },
        };
      } };
    } };
  } };
  const locks = { async request(name, options, action) {
    calls.push({ name, options });
    if (held) return action(null);
    held = true;
    try { return await action({ name }); } finally { held = false; }
  } };
  const make = (extra = {}) => createSubmissionState({ storage, locks, cryptoImpl: webcrypto, now, ...extra });
  return { files, faults, hooks, locks, calls, make, isLocked: () => held, journal: () => JSON.parse(files.get(journalName)) };
}
const draft = (payload = { name: '가짜 원두', note: 'PRIVATE CUP NOTE' }, revision = REV) =>
  createSubmissionDraft('beans', payload, { connectionRevision: revision, dataSources: sources, cryptoImpl: webcrypto });
async function rejectsCode(action, code) {
  await assert.rejects(action, error => {
    assert.equal(error.code, code);
    assert.equal(Object.isFrozen(error), true);
    const output = JSON.stringify(error) + inspect(error);
    for (const secret of ['PRIVATE', 'fake-private-token', REV, ID, 'cause:', 'stack:']) assert.equal(output.includes(secret), false);
    return true;
  });
}
async function execute(env, d, action, state = env.make()) {
  return state.withWriteLock(ctx => ctx.runOperation(d, d.connectionRevision, action));
}

test('draft canonical hash, isolated deep freeze, new intent key and ordered arrays', async () => {
  const input = { z: [1, { b: 2, a: 1 }], a: '가짜' };
  const a = await draft(input);
  const b = await draft({ a: '가짜', z: [1, { a: 1, b: 2 }] });
  assert.match(a.key, /^[a-f0-9-]{36}$/);
  assert.notEqual(a.key, b.key);
  assert.equal(a.payloadFingerprint, b.payloadFingerprint);
  assert.match(a.targetFingerprint, /^[a-f0-9]{64}$/);
  input.z[1].a = 99;
  assert.equal(a.payload.z[1].a, 1);
  assert.ok(Object.isFrozen(a.payload.z[1]));
  assert.notEqual(a.payloadFingerprint, (await draft({ a: '가짜', z: [{ a: 1, b: 2 }, 1] })).payloadFingerprint);
});

test('draft rejects non-JSON/getters/cycles and invalid target/revision without exposing input', async () => {
  for (const payload of [{ a: NaN }, { a: undefined }, { get a() { throw namedError('Error'); } }, { a: 1n }]) {
    await rejectsCode(() => draft(payload), 'invalid-draft');
  }
  const cycle = {}; cycle.self = cycle;
  await rejectsCode(() => draft(cycle), 'invalid-draft');
  await rejectsCode(() => draft({}, 'bad'), 'invalid-draft');
});

test('processing and known ID durable before subsequent dispatch, exact secret-free journal, success', async () => {
  const env = environment(); const d = await draft(); let count = 0;
  const result = await execute(env, d, async op => {
    await op.write(async () => {
      count++; assert.equal(env.journal().operations[0].status, 'processing');
      return { id: ID };
    }, { createdKind: 'beans' });
    await op.write(async () => {
      assert.equal(env.journal().operations[0].createdPages[0].id, ID);
      count++; return { ok: true };
    });
  });
  assert.equal(result.status, 'succeeded'); assert.equal(count, 2);
  assert.deepEqual(Object.keys(env.journal()).sort(), ['activeConnectionRevision', 'connectionGuard', 'operations', 'schemaVersion'].sort());
  assert.deepEqual(Object.keys(env.journal().operations[0]).sort(), ['key','kind','connectionRevision','targetFingerprint','payloadFingerprint','status','createdPages','updatedAt'].sort());
  assert.equal(env.files.get(journalName).includes('PRIVATE'), false);
  assert.equal(env.files.get(journalName).includes('fake-private-token'), false);
  assert.deepEqual(env.calls[0], { name: 'bean-pocket-write-v1', options: { mode: 'exclusive', ifAvailable: true } });
});

test('same succeeded key never reruns, fresh intent same payload allowed', async () => {
  const env = environment(); const d = await draft(); let count = 0;
  const action = op => op.write(async () => { count++; });
  await execute(env, d, action);
  await rejectsCode(() => execute(env, d, action), 'duplicate-operation');
  await execute(env, await draft(), action);
  assert.equal(count, 2);
});

test('failed key never reruns; altered or forged same-key payload rejected', async () => {
  const env = environment(); const d = await draft(); let count = 0;
  assert.equal((await execute(env, d, op => op.write(async () => { count++; throw { writeState: 'rejected', message: 'PRIVATE' }; }))).status, 'failed');
  await rejectsCode(() => execute(env, d, () => { count++; }), 'duplicate-operation');
  await rejectsCode(() => execute(env, { ...d, payload: { changed: true } }, () => { count++; }), 'invalid-draft');
  assert.equal(count, 1);
});

test('native contention, unsupported locks, lock failure, reentry and expired context fail closed', async () => {
  const env = environment(); const state = env.make(); let escaped;
  await state.withWriteLock(async ctx => {
    escaped = ctx;
    await rejectsCode(() => state.withWriteLock(() => {}), 'lock-busy');
    await rejectsCode(() => env.make().withWriteLock(() => {}), 'lock-busy');
  });
  await rejectsCode(() => escaped.readJournal(), 'lock-expired');
  await rejectsCode(() => env.make({ locks: {} }).withWriteLock(() => {}), 'locks-unavailable');
  await rejectsCode(() => env.make({ locks: { request: async () => { throw namedError('Error'); } } }).withWriteLock(() => {}), 'lock-error');
});

test('distinct state instances contend through the shared native lock', async () => {
  const env = environment();
  let release;
  let announceEntry;
  const gate = new Promise(resolve => { release = resolve; });
  const entered = new Promise(resolve => { announceEntry = resolve; });
  const first = env.make().withWriteLock(async () => { announceEntry(); await gate; });
  await entered;
  let secondAction = false;
  await rejectsCode(() => env.make().withWriteLock(async () => { secondAction = true; }), 'lock-busy');
  assert.equal(secondAction, false);
  release();
  await first;
});

test('callback return closes context admission and drains admitted work before native unlock', async () => {
  const env = environment();
  let releaseJournalRead;
  let announceJournalRead;
  const journalReadGate = new Promise(resolve => { releaseJournalRead = resolve; });
  const journalReadStarted = new Promise(resolve => { announceJournalRead = resolve; });
  let journalReadHeld = false;
  let releaseGuardWrite;
  const guardWriteGate = new Promise(resolve => { releaseGuardWrite = resolve; });
  let guardWriteStarted = false;
  let persistedAfterUnlock = false;
  let capturedError;
  let context;
  let chain;
  const unhandled = [];
  const onUnhandled = error => unhandled.push(error);
  env.hooks.text = async name => {
    if (name === journalName && !journalReadHeld) {
      journalReadHeld = true;
      announceJournalRead();
      await journalReadGate;
    }
  };
  env.hooks.write = async value => {
    if (JSON.parse(value).connectionGuard?.candidateRevision === NEXT) {
      guardWriteStarted = true;
      await guardWriteGate;
    }
  };
  env.hooks.close = name => {
    if (name === journalName && !env.isLocked()) persistedAfterUnlock = true;
  };
  process.on('unhandledRejection', onUnhandled);
  try {
    const running = env.make().withWriteLock(ctx => {
      context = ctx;
      chain = ctx.readJournal().then(() => ctx.beginConnectionChange(connection(NEXT)))
        .then(() => undefined, error => { capturedError = error; });
    });
    await journalReadStarted;
    await new Promise(resolve => setImmediate(resolve));
    releaseJournalRead();
    await running;
    const wasUnlocked = !env.isLocked();
    releaseGuardWrite();
    await chain;
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(wasUnlocked, true);
    assert.equal(capturedError?.code, 'lock-expired');
    assert.equal(guardWriteStarted, false);
    assert.equal(persistedAfterUnlock, false);
    assert.equal(env.journal().connectionGuard, null);
    assert.equal(JSON.parse(env.files.get(connectionName)).revision, REV);
    await rejectsCode(() => context.beginConnectionChange(connection(NEXT)), 'lock-expired');
    assert.deepEqual(unhandled, []);
  } finally {
    releaseJournalRead();
    releaseGuardWrite();
    process.off('unhandledRejection', onUnhandled);
  }
});

test('runOperation drains an in-flight hook and expires escaped hooks before releasing the lock', async () => {
  const env = environment(); const state = env.make(); const d = await draft();
  let release;
  let announceStart;
  const gate = new Promise(resolve => { release = resolve; });
  const started = new Promise(resolve => { announceStart = resolve; });
  let escaped;
  let callbackCount = 0;
  const running = state.withWriteLock(ctx => ctx.runOperation(d, d.connectionRevision, op => {
    escaped = () => op.write(async () => { callbackCount++; });
    void op.write(async () => { callbackCount++; announceStart(); await gate; return { ok: true }; });
  }));
  await started;
  await rejectsCode(() => env.make().withWriteLock(() => {}), 'lock-busy');
  release();
  const result = await running;
  assert.equal(result.status, 'succeeded');
  await rejectsCode(() => escaped(), 'operation-expired');
  assert.equal(callbackCount, 1);
});

for (const stage of ['root', 'directory', 'handle', 'createWritable', 'write', 'close', 'afterClose', 'getFile', 'text']) {
  test('storage failure at ' + stage + ' prevents network and fails closed', async () => {
    const env = environment(); const state = env.make(); const d = await draft(); let count = 0;
    env.faults.set(stage, 'QuotaExceededError');
    await assert.rejects(() => execute(env, d, op => op.write(async () => { count++; }), state));
    assert.equal(count, 0);
  });
}

test('result persistence failure latches memory and restart processing becomes unknown', async () => {
  const env = environment(); const d = await draft(); const state = env.make();
  await assert.rejects(() => execute(env, d, op => op.write(async () => {
    env.faults.set('write', 'QuotaExceededError'); return { id: ID };
  }, { createdKind: 'beans' }), state));
  env.faults.clear();
  await rejectsCode(() => execute(env, awaitableDraft, () => {}, state), 'invalid-draft');
  await rejectsCode(() => execute(env, d, () => {}, state), 'state-blocked');
  await env.make().withWriteLock(async ctx => {
    const j = await ctx.readJournal(); assert.equal(j.operations[0].status, 'unknown');
  });
});
const awaitableDraft = {};

test('successful close with altered readback blocks dispatch and latches uncertainty', async () => {
  const env = environment(); const d = await draft(); let calls = 0;
  env.hooks.close = name => {
    if (name !== journalName) return;
    const journal = JSON.parse(env.files.get(journalName));
    journal.operations[0].updatedAt = '2026-10-19T00:01:00.000Z';
    env.files.set(journalName, JSON.stringify(journal));
  };
  await rejectsCode(() => execute(env, d, op => op.write(async () => { calls++; })), 'save-uncertain');
  assert.equal(calls, 0);
});

test('unknown and partial globally block new keys and connection changes, no auto retry', async () => {
  for (const mode of ['unknown', 'partial']) {
    const env = environment(); const d = await draft(); let count = 0;
    const result = await execute(env, d, async op => {
      if (mode === 'partial') await op.write(async () => ({ id: ID }), { createdKind: 'beans' });
      await op.write(async () => { count++; throw { writeState: mode === 'unknown' ? 'unknown' : 'rejected' }; });
    });
    assert.equal(result.status, mode);
    await rejectsCode(() => execute(env, d, () => { count++; }), 'unresolved-operation');
    const next = await draft();
    await rejectsCode(() => execute(env, next, () => { count++; }), 'unresolved-operation');
    await rejectsCode(() => env.make().withWriteLock(ctx => ctx.beginConnectionChange(connection(NEXT))), 'unresolved-operation');
    assert.equal(count, 1);
  }
});

test('caught write errors retain unknown or rejected outcome instead of succeeding', async () => {
  for (const writeState of ['unknown', 'rejected']) {
    const env = environment(); const d = await draft();
    const result = await execute(env, d, async op => {
      try {
        await op.write(async () => { throw Object.assign(new Error('PRIVATE callback failure'), { writeState }); });
      } catch { /* The operation outcome must remain recorded by the write boundary. */ }
    });
    assert.equal(result.status, writeState === 'unknown' ? 'unknown' : 'failed');
    assert.equal(env.journal().operations[0].status, result.status);
  }
});

test('connection and journal revision reread before every write blocks stale client/draft', async () => {
  const env = environment(); const d = await draft(); let count = 0;
  await rejectsCode(() => env.make().withWriteLock(ctx => ctx.runOperation(d, NEXT, () => { count++; })), 'stale-connection');
  await execute(env, d, async op => {
    await op.write(async () => {
      count++; env.files.set(connectionName, JSON.stringify(connection(NEXT)));
    });
    await assert.rejects(() => op.write(async () => { count++; }));
  });
  assert.equal(count, 1);
});

for (const missing of [connectionName, journalName]) {
  test('one file missing refuses first connection and mutation: ' + missing, async () => {
    const env = environment(); env.files.delete(missing);
    await rejectsCode(() => env.make().withWriteLock(ctx => ctx.beginConnectionChange(connection(NEXT))), 'connection-mismatch');
    await rejectsCode(async () => execute(env, await draft(), () => {}), 'connection-mismatch');
  });
}

test('first connection guard, commit readback, replacement, stale old client and interrupted guard', async () => {
  const env = environment({ initialized: false });
  await env.make().withWriteLock(async ctx => {
    await ctx.beginConnectionChange(connection(REV));
    assert.equal(env.journal().activeConnectionRevision, null);
    assert.equal(env.journal().connectionGuard.phase, 'processing');
    await ctx.commitConnectionChange();
  });
  await env.make().withWriteLock(async ctx => {
    await ctx.beginConnectionChange(connection(NEXT));
    await ctx.commitConnectionChange();
  });
  await rejectsCode(async () => execute(env, await draft(), () => {}), 'stale-connection');
  const third = 'dddddddd-dddd-dddd-dddd-dddddddddddd';
  await env.make().withWriteLock(ctx => ctx.beginConnectionChange(connection(third)));
  await env.make().withWriteLock(async ctx => {
    assert.equal((await ctx.readJournal()).connectionGuard.phase, 'unknown');
    await rejectsCode(() => ctx.beginConnectionChange(connection(REV)), 'unresolved-connection');
  });
});

test('connection recovery requires a persisted guard and both files', async () => {
  let readCalls = 0;
  const options = { originalConfirmed: true, decision: 'use-current', freshRead: async () => {
    readCalls++;
    return { connectionRevision: REV, targetFingerprint: '0'.repeat(64), outcome: 'use-current' };
  } };
  const empty = environment({ initialized: false });
  await rejectsCode(() => empty.make().withWriteLock(ctx => ctx.confirmConnection(options)), 'invalid-resolution');
  const noGuard = environment();
  await rejectsCode(() => noGuard.make().withWriteLock(ctx => ctx.confirmConnection(options)), 'invalid-resolution');
  for (const missing of [connectionName, journalName]) {
    const env = environment(); env.files.delete(missing);
    await rejectsCode(() => env.make().withWriteLock(ctx => ctx.confirmConnection(options)), 'invalid-resolution');
    assert.equal(env.files.has(missing), false);
  }
  assert.equal(readCalls, 0);
});

test('confirmConnection adopts the original active revision after an interrupted replacement', async () => {
  const d = await draft();
  const interrupted = environment();
  await interrupted.make().withWriteLock(ctx => ctx.beginConnectionChange(connection(NEXT)));
  assert.equal(interrupted.journal().activeConnectionRevision, REV);
  assert.equal(interrupted.journal().connectionGuard.candidateRevision, NEXT);

  let oldEvidence;
  await interrupted.make().withWriteLock(ctx => ctx.confirmConnection({
    originalConfirmed: true,
    decision: 'use-current',
    freshRead: async current => {
      oldEvidence = current;
      return { ...current, outcome: 'use-current' };
    },
  }));
  assert.deepEqual(oldEvidence, { connectionRevision: REV, targetFingerprint: d.targetFingerprint });
  assert.equal(interrupted.journal().activeConnectionRevision, REV);
  assert.equal(interrupted.journal().connectionGuard, null);
  assert.equal(JSON.parse(interrupted.files.get(connectionName)).revision, REV);

  const candidateCurrent = environment();
  const journal = candidateCurrent.journal();
  journal.connectionGuard = { phase: 'processing', candidateRevision: NEXT, targetFingerprint: d.targetFingerprint };
  candidateCurrent.files.set(journalName, JSON.stringify(journal));
  candidateCurrent.files.set(connectionName, JSON.stringify(connection(NEXT)));
  await candidateCurrent.make().withWriteLock(ctx => ctx.confirmConnection({
    originalConfirmed: true,
    decision: 'use-current',
    freshRead: async current => ({ ...current, outcome: 'use-current' }),
  }));
  assert.equal(candidateCurrent.journal().activeConnectionRevision, NEXT);
  assert.equal(candidateCurrent.journal().connectionGuard, null);

  const guardOnly = environment({ initialized: false });
  guardOnly.files.set(journalName, JSON.stringify({ schemaVersion: 1, activeConnectionRevision: null,
    connectionGuard: { phase: 'processing', candidateRevision: NEXT, targetFingerprint: d.targetFingerprint }, operations: [] }));
  let freshReadCalls = 0;
  await rejectsCode(() => guardOnly.make().withWriteLock(ctx => ctx.confirmConnection({
    originalConfirmed: true,
    decision: 'use-current',
    freshRead: async current => { freshReadCalls++; return { ...current, outcome: 'use-current' }; },
  })), 'invalid-resolution');
  assert.equal(freshReadCalls, 0);
  assert.equal(guardOnly.files.has(connectionName), false);
  assert.equal(guardOnly.journal().connectionGuard.phase, 'unknown');
  await rejectsCode(() => guardOnly.make().withWriteLock(ctx => ctx.beginConnectionChange(connection(REV))), 'connection-mismatch');
  assert.equal(guardOnly.files.has(connectionName), false);
});

test('close/readback uncertainty in connection change retains blocking guard', async () => {
  const env = environment(); const state = env.make();
  env.hooks.close = name => { if (name === connectionName) env.faults.set('text', 'NotAllowedError'); };
  await assert.rejects(() => state.withWriteLock(async ctx => {
    await ctx.beginConnectionChange(connection(NEXT)); await ctx.commitConnectionChange();
  }));
  env.faults.clear();
  await rejectsCode(async () => execute(env, await draft({}, NEXT), () => {}, state), 'state-blocked');
  assert.ok(env.journal().connectionGuard);
});

test('resolution requires original confirmation, concrete decision and fresh same-target read callback', async () => {
  const env = environment(); const d = await draft();
  await execute(env, d, op => op.write(async () => { throw namedError('Error'); }));
  await env.make().withWriteLock(async ctx => {
    await rejectsCode(() => ctx.confirmResolution(d.key, true), 'invalid-resolution');
    await rejectsCode(() => ctx.confirmResolution(d.key, { originalConfirmed: true, decision: 'not-saved', freshRead: async () => true }), 'invalid-resolution');
    await rejectsCode(() => ctx.confirmResolution(d.key, { originalConfirmed: true, decision: 'not-saved', freshRead: async () => ({ connectionRevision: NEXT, targetFingerprint: d.targetFingerprint, outcome: 'not-saved' }) }), 'invalid-resolution');
    await ctx.confirmResolution(d.key, { originalConfirmed: true, decision: 'not-saved', freshRead: async () => ({ connectionRevision: REV, targetFingerprint: d.targetFingerprint, outcome: 'not-saved' }) });
  });
  assert.equal(env.journal().operations[0].status, 'failed');
  await execute(env, await draft(), op => op.write(async () => {}));
});

test('resolution compares the original durable connection snapshot after fresh read', async () => {
  const env = environment(); const d = await draft();
  await execute(env, d, op => op.write(async () => { throw Object.assign(new Error('PRIVATE'), { writeState: 'unknown' }); }));
  await rejectsCode(() => env.make().withWriteLock(ctx => ctx.confirmResolution(d.key, {
    originalConfirmed: true,
    decision: 'not-saved',
    freshRead: async () => {
      const current = JSON.parse(env.files.get(connectionName));
      current.token = 'tampered-but-private';
      env.files.set(connectionName, JSON.stringify(current));
      return { connectionRevision: REV, targetFingerprint: d.targetFingerprint, outcome: 'not-saved' };
    },
  })), 'resolution-changed');
  assert.equal(env.journal().operations[0].status, 'unknown');
  assert.equal(JSON.parse(env.files.get(connectionName)).token, 'tampered-but-private');
});

test('journal UUID identity is canonical and returned snapshots are deeply immutable', async () => {
  const env = environment(); const d = await draft();
  const journal = env.journal();
  journal.operations.push({ key: d.key.toUpperCase(), kind: d.kind, connectionRevision: REV.toUpperCase(),
    targetFingerprint: d.targetFingerprint, payloadFingerprint: d.payloadFingerprint, status: 'succeeded',
    createdPages: [{ kind: 'beans', id: ID.toUpperCase(), archiveState: 'archived' }], updatedAt: now() });
  env.files.set(journalName, JSON.stringify(journal));
  let calls = 0;
  await rejectsCode(() => execute(env, d, () => { calls++; }), 'duplicate-operation');
  assert.equal(calls, 0);
  await env.make().withWriteLock(async ctx => {
    const snapshot = await ctx.readJournal();
    assert.equal(snapshot.operations[0].key, d.key);
    assert.equal(snapshot.operations[0].connectionRevision, REV);
    assert.equal(snapshot.operations[0].createdPages[0].id, ID);
    assert.ok(Object.isFrozen(snapshot));
    assert.ok(Object.isFrozen(snapshot.operations));
    assert.ok(Object.isFrozen(snapshot.operations[0]));
    assert.ok(Object.isFrozen(snapshot.operations[0].createdPages[0]));
    assert.throws(() => { snapshot.operations[0].status = 'failed'; }, TypeError);
  });
});

test('raw Error returned from a dispatched callback is redacted and marked unknown', async () => {
  const env = environment(); const d = await draft(); let callbackError;
  const result = await execute(env, d, async op => {
    try { await op.write(async () => new Error('PRIVATE raw error')); }
    catch (error) { callbackError = error; }
  });
  assert.equal(result.status, 'unknown');
  assert.equal(callbackError?.code, 'invalid-write-response');
  assert.equal(JSON.stringify(callbackError).includes('PRIVATE'), false);
});

test('clock and crypto feature failures use fixed safe errors', async () => {
  const env = environment(); const d = await draft(); let calls = 0;
  const state = env.make({ now: () => { throw namedError('Error'); } });
  await rejectsCode(() => state.withWriteLock(ctx => ctx.runOperation(d, d.connectionRevision, () => { calls++; })), 'clock-error');
  await rejectsCode(() => createSubmissionDraft('beans', { note: 'PRIVATE' }, {
    connectionRevision: REV, dataSources: sources, cryptoImpl: {},
  }), 'invalid-draft');
  assert.equal(calls, 0);
});

test('archive only current-operation known pages; rejected archive preserves partial and unknown archive blocks', async () => {
  const env = environment(); const d = await draft(); let calls = 0;
  const result = await execute(env, d, async op => {
    await op.write(async () => ({ id: ID }), { createdKind: 'beans' });
    await assert.rejects(() => op.write(async () => { calls++; }, { archiveId: REV }));
    await op.write(async () => { calls++; return { id: ID, in_trash: true }; }, { archiveId: ID });
    throw { writeState: 'rejected' };
  });
  assert.equal(calls, 1); assert.equal(result.status, 'failed');
  assert.equal(env.journal().operations[0].createdPages[0].archiveState, 'archived');
});

test('uncertain archive callback durably changes the page archive state to unknown', async () => {
  const env = environment(); const d = await draft();
  const result = await execute(env, d, async op => {
    await op.write(async () => ({ id: ID }), { createdKind: 'beans' });
    try {
      await op.write(async () => { throw Object.assign(new Error('PRIVATE archive failure'), { writeState: 'unknown' }); }, { archiveId: ID });
    } catch { /* Recording uncertainty belongs to the state boundary. */ }
  });
  assert.equal(result.status, 'unknown');
  assert.deepEqual(env.journal().operations[0].createdPages, [{ kind: 'beans', id: ID, archiveState: 'unknown' }]);
});

test('corrupt/extra-field journal never overwritten or exposed', async () => {
  for (const bad of ['', '{', JSON.stringify({ schemaVersion: 1, activeConnectionRevision: REV, connectionGuard: null, operations: [], token: 'PRIVATE' })]) {
    const env = environment(); env.files.set(journalName, bad);
    await rejectsCode(async () => execute(env, await draft(), () => {}), 'journal-corrupt');
    assert.equal(env.files.get(journalName), bad);
  }
});
