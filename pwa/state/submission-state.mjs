import { createConnectionFile } from '../platform/connection-file.mjs';

const DIRECTORY = 'bean-pocket-private-v1';
const FILE = 'submission-journal.json';
const LOCK = 'bean-pocket-write-v1';
const SOURCES = ['beans', 'bags', 'recipes', 'steps', 'records'];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HASH = /^[0-9a-f]{64}$/;
const KIND = /^[a-z][a-z0-9-]{0,63}$/;
const STATUSES = ['not-submitted', 'processing', 'succeeded', 'failed', 'unknown', 'partial'];
const ARCHIVE_STATES = ['active', 'archived', 'unknown'];
const DELETE_TARGET_KIND = Object.freeze({
  'delete-bean': 'beans', 'delete-bag': 'bags', 'delete-recipe': 'recipes', 'delete-record': 'records',
});
const SAFE_RESULT_CODES = ['delete-in-use', 'delete-dependency-unknown'];
const drafts = new WeakSet();
const failures = new WeakSet();
const unresolved = operation => ['processing', 'unknown', 'partial'].includes(operation.status);

function fail(code, writeState = 'not-sent') {
  const value = Object.freeze({ code, writeState });
  failures.add(value);
  return value;
}
function safe(error, fallback) {
  return error !== null && typeof error === 'object' && failures.has(error) ? error : fail(fallback);
}
function uuid(value) {
  if (typeof value !== 'string' || !UUID.test(value)) throw fail('invalid-input');
  return value.toLowerCase();
}
function exact(value, keys) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null) return false;
  const own = Reflect.ownKeys(value);
  return own.length === keys.length && keys.every(key => {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return descriptor && Object.hasOwn(descriptor, 'value') && descriptor.enumerable;
  });
}
function frozen(value) {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) frozen(child);
    Object.freeze(value);
  }
  return value;
}
function canonical(value, ancestors = new Set()) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (!value || typeof value !== 'object' || ancestors.has(value)) throw fail('invalid-input');
  ancestors.add(value);
  let result;
  if (Array.isArray(value)) {
    if (Reflect.ownKeys(value).length !== value.length + 1) throw fail('invalid-input');
    result = Array.from({ length: value.length }, (_, index) => {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (!descriptor || !Object.hasOwn(descriptor, 'value')) throw fail('invalid-input');
      return canonical(descriptor.value, ancestors);
    });
  } else {
    const keys = Reflect.ownKeys(value);
    if (keys.some(key => typeof key !== 'string') || !exact(value, keys)) throw fail('invalid-input');
    result = Object.fromEntries(keys.sort().map(key => [key, canonical(Object.getOwnPropertyDescriptor(value, key).value, ancestors)]));
  }
  ancestors.delete(value);
  return result;
}
function normalizedSources(value) {
  if (!exact(value, SOURCES)) throw fail('invalid-input');
  return Object.fromEntries(SOURCES.map(key => [key, uuid(value[key])]));
}
async function fingerprint(value, cryptoImpl) {
  const digest = await cryptoImpl.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(canonical(value))));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}
function normalizedConnection(value) {
  const copy = canonical(value);
  if (!exact(copy, ['schemaVersion', 'revision', 'token', 'dataSources']) || copy.schemaVersion !== 1 ||
      typeof copy.token !== 'string' || !copy.token.trim() || /[\u0000-\u001f\u007f-\u009f]/.test(copy.token)) throw fail('connection-invalid');
  return frozen({ schemaVersion: 1, revision: uuid(copy.revision), token: copy.token, dataSources: normalizedSources(copy.dataSources) });
}

export async function createSubmissionDraft(kind, validatedPayload, { connectionRevision, dataSources, cryptoImpl = globalThis.crypto } = {}) {
  try {
    if (typeof kind !== 'string' || !KIND.test(kind)) throw fail('invalid-draft');
    const payload = canonical(validatedPayload);
    const revision = uuid(connectionRevision);
    const targets = normalizedSources(dataSources);
    const key = uuid(cryptoImpl.randomUUID());
    const value = frozen({ key, kind, connectionRevision: revision, payload,
      payloadFingerprint: await fingerprint(payload, cryptoImpl), targetFingerprint: await fingerprint(targets, cryptoImpl) });
    drafts.add(value);
    return value;
  } catch { throw fail('invalid-draft'); }
}

function parseJournal(text) {
  try {
    const value = JSON.parse(text);
    if (!exact(value, ['schemaVersion', 'activeConnectionRevision', 'connectionGuard', 'operations']) || value.schemaVersion !== 1 || !Array.isArray(value.operations)) throw 0;
    if (value.activeConnectionRevision !== null) value.activeConnectionRevision = uuid(value.activeConnectionRevision);
    const guard = value.connectionGuard;
    if (guard !== null && (!exact(guard, ['phase', 'candidateRevision', 'targetFingerprint']) ||
        !['processing', 'unknown'].includes(guard.phase) || !HASH.test(guard.targetFingerprint))) throw 0;
    if (guard) guard.candidateRevision = uuid(guard.candidateRevision);
    if (value.activeConnectionRevision === null && (!guard || value.operations.length)) throw 0;
    const keys = new Set();
    for (const op of value.operations) {
      if (!exact(op, ['key', 'kind', 'connectionRevision', 'targetFingerprint', 'payloadFingerprint', 'status', 'createdPages', 'updatedAt', ...(Object.hasOwn(op, 'deleteTarget') ? ['deleteTarget'] : [])]) ||
          !KIND.test(op.kind) || !HASH.test(op.targetFingerprint) || !HASH.test(op.payloadFingerprint) ||
          !STATUSES.includes(op.status) || !Array.isArray(op.createdPages) || typeof op.updatedAt !== 'string' ||
          !Number.isFinite(Date.parse(op.updatedAt))) throw 0;
      op.key = uuid(op.key); op.connectionRevision = uuid(op.connectionRevision);
      if (keys.has(op.key)) throw 0;
      keys.add(op.key);
      const deleteKind = DELETE_TARGET_KIND[op.kind];
      if (deleteKind) {
        const target = op.deleteTarget;
        if (!exact(target, ['kind', 'id', 'archiveState']) || target.kind !== deleteKind ||
            !ARCHIVE_STATES.includes(target.archiveState) || op.createdPages.length) throw 0;
        target.id = uuid(target.id);
      } else if (Object.hasOwn(op, 'deleteTarget')) throw 0;
      const ids = new Set();
      for (const page of op.createdPages) {
        if (!exact(page, ['kind', 'id', 'archiveState']) || !SOURCES.includes(page.kind) || !ARCHIVE_STATES.includes(page.archiveState)) throw 0;
        const id = page.id = uuid(page.id);
        if (ids.has(id)) throw 0;
        ids.add(id);
      }
    }
    return value;
  } catch { throw fail('journal-corrupt'); }
}
function errorName(error) {
  try { return error?.name; } catch { return undefined; }
}
function storageCode(error) {
  switch (errorName(error)) {
    case 'NotAllowedError': case 'SecurityError': return 'permission';
    case 'QuotaExceededError': return 'quota';
    case 'NotSupportedError': return 'unsupported';
    case 'TypeMismatchError': return 'path-conflict';
    default: return 'storage-error';
  }
}

export function createSubmissionState({ storage = globalThis.navigator?.storage, locks = globalThis.navigator?.locks,
  connectionFile = createConnectionFile({ storage }), cryptoImpl = globalThis.crypto, now = () => new Date().toISOString() } = {}) {
  let entered = false;
  let poisoned = false;
  const timestamp = () => {
    try {
      const value = now();
      if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) throw 0;
      return value;
    } catch { throw fail('clock-error'); }
  };
  async function readFile() {
    try {
      if (typeof storage?.getDirectory !== 'function') throw fail('unsupported');
      const root = await storage.getDirectory();
      let directory, handle;
      try { directory = await root.getDirectoryHandle(DIRECTORY, { create: false }); }
      catch (error) { if (errorName(error) === 'NotFoundError') return null; throw error; }
      try { handle = await directory.getFileHandle(FILE, { create: false }); }
      catch (error) { if (errorName(error) === 'NotFoundError') return null; throw error; }
      return parseJournal(await (await handle.getFile()).text());
    } catch (error) { throw safe(error, storageCode(error)); }
  }
  async function persist(journal) {
    let writable, closeStarted = false;
    try {
      const serialized = JSON.stringify(journal);
      parseJournal(serialized);
      const root = await storage.getDirectory();
      const directory = await root.getDirectoryHandle(DIRECTORY, { create: true });
      const handle = await directory.getFileHandle(FILE, { create: true });
      writable = await handle.createWritable();
      await writable.write(serialized);
      closeStarted = true;
      await writable.close();
      if (JSON.stringify(await readFile()) !== serialized) throw 0;
    } catch (error) {
      poisoned = true;
      if (!closeStarted) { try { await writable?.abort(); } catch { /* No fallback. */ } }
      throw fail(closeStarted ? 'save-uncertain' : storageCode(error), closeStarted ? 'unknown' : 'not-sent');
    }
  }

  async function withWriteLock(action) {
    if (entered) throw fail('lock-busy');
    if (typeof locks?.request !== 'function') throw fail('locks-unavailable');
    if (typeof action !== 'function') throw fail('invalid-input');
    entered = true;
    let callbackEntered = false;
    try {
      return await locks.request(LOCK, { mode: 'exclusive', ifAvailable: true }, async lock => {
        callbackEntered = true;
        if (!lock) throw fail('lock-busy');
        let active = true, accepting = true, busy = false, guardOwned = false;
        let candidate;
        const ownedKeys = new Set();
        const pending = new Set();
        const alive = () => { if (!active) throw fail('lock-expired'); };
        const admit = () => { if (!active || !accepting) throw fail('lock-expired'); };
        const unblocked = () => { if (poisoned) throw fail('state-blocked'); };
        async function load() {
          alive();
          let connection;
          try {
            const value = await connectionFile.readConnection();
            connection = value === null ? null : normalizedConnection(value);
          } catch { throw fail('connection-unreadable'); }
          const journal = await readFile();
          if (journal) {
            let changed = false;
            for (const operation of journal.operations) {
              if (operation.status === 'processing' && !ownedKeys.has(operation.key)) {
                operation.status = 'unknown'; operation.updatedAt = timestamp(); changed = true;
              }
            }
            if (journal.connectionGuard?.phase === 'processing' && !guardOwned) {
              journal.connectionGuard.phase = 'unknown'; changed = true;
            }
            if (changed) await persist(journal);
          }
          return { connection, journal };
        }
        function coherent({ connection, journal }, allowEmpty = false) {
          if (!connection && !journal && allowEmpty) return;
          if (!connection || !journal) throw fail('connection-mismatch');
          if (!journal.connectionGuard && connection.revision !== journal.activeConnectionRevision) throw fail('connection-mismatch');
        }
        function clear(journal, ownKey) {
          if (journal.connectionGuard) throw fail('unresolved-connection');
          if (journal.operations.some(op => unresolved(op) && !(op.key === ownKey && ownedKeys.has(ownKey) && op.status === 'processing'))) throw fail('unresolved-operation');
        }
        async function check(draft, clientRevision) {
          alive(); unblocked();
          const pair = await load(); coherent(pair);
          const { connection, journal } = pair;
          clear(journal, draft.key);
          if (connection.revision !== journal.activeConnectionRevision || draft.connectionRevision !== connection.revision ||
              clientRevision !== connection.revision || draft.targetFingerprint !== await fingerprint(connection.dataSources, cryptoImpl)) throw fail('stale-connection');
          const operation = journal.operations.find(op => op.key === draft.key);
          if (operation && (operation.payloadFingerprint !== draft.payloadFingerprint || operation.targetFingerprint !== draft.targetFingerprint ||
              operation.connectionRevision !== draft.connectionRevision || operation.kind !== draft.kind)) throw fail('key-conflict');
          return { journal, operation };
        }
        // Public context methods are serialized and admitted only until the action callback ends.
        function method(fn) {
          return (...args) => {
            try { admit(); }
            catch (error) {
              const task = Promise.reject(error);
              task.catch(() => {});
              return task;
            }
            const task = (async () => {
              alive(); if (busy) throw fail('context-busy'); busy = true;
              try { return await fn(...args); }
              catch (error) { throw safe(error, 'action-error'); }
              finally { busy = false; }
            })();
            pending.add(task);
            task.then(() => pending.delete(task), () => pending.delete(task));
            return task;
          };
        }
        async function runOperation(draft, clientRevision, execute) {
          if (!drafts.has(draft) || typeof execute !== 'function') throw fail('invalid-draft');
          const initial = await check(draft, clientRevision);
          if (initial.operation) throw fail('duplicate-operation');
          const operation = { key: draft.key, kind: draft.kind, connectionRevision: draft.connectionRevision,
            targetFingerprint: draft.targetFingerprint, payloadFingerprint: draft.payloadFingerprint, status: 'processing',
            createdPages: [], updatedAt: timestamp() };
          const deleteKind = DELETE_TARGET_KIND[draft.kind];
          if (deleteKind) {
            operation.deleteTarget = { kind: deleteKind, id: uuid(draft.payload.id), archiveState: 'active' };
          }
          initial.journal.operations.push(operation);
          await persist(initial.journal);
          ownedKeys.add(draft.key);
          let running = true, writing = false, dispatched = 0, confirmed = 0, uncertain = false, rejected = false;
          const writes = new Set();
          async function write(callback, options = {}) {
            if (!running) throw fail('operation-expired');
            if (writing) throw fail('write-busy');
            writing = true;
            let sent = false, journal, current;
            let archivedPage = null;
            try {
              if (uncertain) throw fail('unresolved-operation');
              if (typeof callback !== 'function' || !exact(options, Object.keys(options)) ||
                  Object.keys(options).some(key => !['createdKind', 'archiveId', 'deleteId', 'deleteKind'].includes(key)) ||
                  ([options.createdKind, options.archiveId, options.deleteId].filter(Boolean).length > 1) ||
                  (options.createdKind && !SOURCES.includes(options.createdKind)) ||
                  (options.deleteKind && !['beans', 'bags', 'recipes', 'records'].includes(options.deleteKind))) throw fail('invalid-write');
              const checked = await check(draft, clientRevision);
              journal = checked.journal; current = checked.operation;
              if (!current || current.status !== 'processing') throw fail('unresolved-operation');
              const deleteId = options.deleteId === undefined ? null : uuid(options.deleteId);
              if (current.deleteTarget) {
                const target = current.deleteTarget;
                if (!deleteId || target.id !== deleteId || target.archiveState !== 'active' ||
                    (options.deleteKind !== undefined && target.kind !== options.deleteKind) ||
                    (target.kind !== 'beans' && options.deleteKind !== target.kind)) throw fail('invalid-delete');
              } else if (deleteId || options.deleteKind) throw fail('invalid-delete');
              const archiveId = options.archiveId === undefined ? null : uuid(options.archiveId);
              archivedPage = archiveId ? current.createdPages.find(item => item.id === archiveId) : null;
              if (archiveId && (!archivedPage || archivedPage.archiveState !== 'active')) throw fail('invalid-archive');
              current.updatedAt = timestamp();
              await persist(journal);
              // Processing is durable/read back before invoking the only network hook.
              sent = true; dispatched++;
              const result = await callback();
              if (result instanceof Error) throw fail('invalid-write-response', 'unknown');
              if (options.createdKind) {
                let id;
                try { id = uuid(result?.id); } catch { throw fail('invalid-write-response', 'unknown'); }
                if (current.createdPages.some(item => item.id === id)) throw fail('invalid-write-response', 'unknown');
                current.createdPages.push({ kind: options.createdKind, id, archiveState: 'active' });
              }
              if (archiveId) {
                if (result?.id?.toLowerCase() !== archiveId || result?.in_trash !== true) throw fail('invalid-write-response', 'unknown');
                archivedPage.archiveState = 'archived';
              }
              if (deleteId) {
                if (result?.id?.toLowerCase() !== deleteId || result?.in_trash !== true) throw fail('invalid-write-response', 'unknown');
                current.deleteTarget.archiveState = 'archived';
              }
              confirmed++;
              current.updatedAt = timestamp();
              await persist(journal);
              return result;
            } catch (error) {
              if (sent) {
                let state;
                try { state = error?.writeState; } catch { /* Untrusted errors are unknown. */ }
                if (poisoned || !['not-sent', 'rejected'].includes(state)) {
                  uncertain = true;
                  if (current?.deleteTarget && !poisoned) {
                    current.deleteTarget.archiveState = 'unknown';
                    current.updatedAt = timestamp();
                    await persist(journal);
                  }
                  if (archivedPage && !poisoned) {
                    archivedPage.archiveState = 'unknown';
                    current.updatedAt = timestamp();
                    await persist(journal);
                  }
                }
                else rejected = true;
              }
              throw safe(error, sent ? 'write-error' : 'write-blocked');
            } finally { writing = false; }
          }
          const op = Object.freeze({ write: (...args) => {
            const task = write(...args); writes.add(task);
            task.then(() => writes.delete(task), () => writes.delete(task));
            return task;
          } });
          let value, callbackFailed = false, resultCode;
          try { value = await execute(op); }
          catch (error) {
            callbackFailed = true;
            try { if (SAFE_RESULT_CODES.includes(error?.code)) resultCode = error.code; } catch { /* Ignore untrusted error accessors. */ }
          }
          // Unawaited hooks still finish under this lock; none can run after callback return.
          running = false;
          if (writes.size) {
            const pendingWrites = await Promise.allSettled([...writes]);
            if (pendingWrites.some(result => result.status === 'rejected')) callbackFailed = true;
          }
          try {
            unblocked();
            const journal = await readFile();
            const current = journal?.operations.find(item => item.key === draft.key);
            if (!current || current.status !== 'processing') throw fail('state-blocked');
            const incomplete = callbackFailed || rejected;
            current.status = uncertain ? 'unknown' : incomplete ?
              (current.createdPages.some(page => page.archiveState !== 'archived') || (confirmed > 0 && !current.createdPages.length) ? 'partial' : 'failed') : 'succeeded';
            if (!dispatched && !callbackFailed) current.status = 'failed';
            current.updatedAt = timestamp();
            await persist(journal);
            return Object.freeze({ status: current.status, value, ...(current.status === 'failed' && resultCode ? { code: resultCode } : {}) });
          } finally { ownedKeys.delete(draft.key); }
        }
        async function beginConnectionChange(input) {
          unblocked();
          let next;
          try { next = normalizedConnection(input); } catch { throw fail('invalid-connection'); }
          const pair = await load(); coherent(pair, true);
          if (pair.journal) clear(pair.journal);
          if (pair.connection?.revision === next.revision || pair.journal?.operations.some(op => op.connectionRevision === next.revision)) throw fail('stale-connection');
          const journal = pair.journal ?? { schemaVersion: 1, activeConnectionRevision: null, connectionGuard: null, operations: [] };
          journal.connectionGuard = { phase: 'processing', candidateRevision: next.revision, targetFingerprint: await fingerprint(next.dataSources, cryptoImpl) };
          await persist(journal);
          candidate = next; guardOwned = true;
        }
        async function commitConnectionChange() {
          alive(); unblocked();
          if (!guardOwned || !candidate) throw fail('unresolved-connection');
          const { journal } = await load();
          if (journal?.connectionGuard?.candidateRevision !== candidate.revision || journal.connectionGuard.phase !== 'processing' ||
              journal.connectionGuard.targetFingerprint !== await fingerprint(candidate.dataSources, cryptoImpl)) throw fail('unresolved-connection');
          try {
            await connectionFile.writeConnection(candidate);
            const actual = normalizedConnection(await connectionFile.readConnection());
            if (JSON.stringify(actual) !== JSON.stringify(candidate)) throw 0;
            journal.activeConnectionRevision = candidate.revision; journal.connectionGuard = null;
            await persist(journal);
            candidate = undefined; guardOwned = false;
          } catch { poisoned = true; throw fail('connection-save-uncertain', 'unknown'); }
        }
        function resolutionPages(value) {
          try {
            if (!Array.isArray(value)) throw 0;
            const ids = new Set();
            return value.map(page => {
              if (!exact(page, ['kind', 'id', 'archiveState']) || !SOURCES.includes(page.kind) ||
                  !['active', 'archived'].includes(page.archiveState)) throw 0;
              const id = uuid(page.id);
              if (ids.has(id)) throw 0;
              ids.add(id);
              return { kind: page.kind, id, archiveState: page.archiveState };
            });
          } catch { throw fail('invalid-resolution'); }
        }
        async function confirmResolution(key, options) {
          const pair = await load(); coherent(pair);
          const { connection, journal } = pair;
          if (journal.connectionGuard || !options || options.originalConfirmed !== true ||
              !['saved', 'not-saved', 'cancelled'].includes(options.decision) || typeof options.freshRead !== 'function') throw fail('invalid-resolution');
          let operationKey;
          try { operationKey = uuid(key); } catch { throw fail('invalid-resolution'); }
          const op = journal.operations.find(item => item.key === operationKey);
          if (!op || !['unknown', 'partial'].includes(op.status)) throw fail('invalid-resolution');
          if (op.connectionRevision !== connection.revision || op.targetFingerprint !== await fingerprint(connection.dataSources, cryptoImpl)) throw fail('stale-connection');
          const journalSnapshot = JSON.stringify(journal);
          const connectionSnapshot = JSON.stringify(connection);
          const decision = options.decision;
          let evidence;
          try { evidence = await options.freshRead(frozen(canonical(op))); } catch { throw fail('resolution-read-failed'); }
          if (!evidence || evidence.connectionRevision !== op.connectionRevision || evidence.targetFingerprint !== op.targetFingerprint || evidence.outcome !== decision) throw fail('invalid-resolution');

          let resolvedPages;
          let resolvedDeleteTarget;
          if (DELETE_TARGET_KIND[op.kind]) {
            const target = evidence.deleteTarget;
            if (!exact(target, ['kind', 'id', 'archiveState']) || target.kind !== DELETE_TARGET_KIND[op.kind] ||
                target.id !== op.deleteTarget.id || decision === 'cancelled' ||
                target.archiveState !== (decision === 'saved' ? 'archived' : 'active')) throw fail('invalid-resolution');
            resolvedDeleteTarget = canonical(target);
          } else if (op.createdPages.length) {
            const freshPages = resolutionPages(evidence.createdPages);
            if (freshPages.length !== op.createdPages.length) throw fail('invalid-resolution');
            resolvedPages = canonical(op.createdPages);
            for (const page of resolvedPages) {
              const fresh = freshPages.find(item => item.id === page.id && item.kind === page.kind);
              if (!fresh || (decision !== 'saved' && fresh.archiveState !== 'archived')) throw fail('invalid-resolution');
              page.archiveState = fresh.archiveState;
            }
            if (decision === 'not-saved') throw fail('invalid-resolution');
          } else if (decision === 'saved') {
            // A lost creation response needs a known, verified ID before success.
            resolvedPages = resolutionPages(evidence.createdPages);
            if (!resolvedPages.length) throw fail('invalid-resolution');
          }

          // Compare both durable files with snapshots taken before the read callback.
          const latest = await load(); coherent(latest);
          if (JSON.stringify(latest.journal) !== journalSnapshot || JSON.stringify(latest.connection) !== connectionSnapshot) throw fail('resolution-changed');
          const resolvedOperation = latest.journal.operations.find(item => item.key === operationKey);
          if (!resolvedOperation) throw fail('resolution-changed');
          if (resolvedPages) resolvedOperation.createdPages = resolvedPages;
          if (resolvedDeleteTarget) resolvedOperation.deleteTarget = resolvedDeleteTarget;
          resolvedOperation.status = decision === 'saved' ? 'succeeded' : 'failed';
          resolvedOperation.updatedAt = timestamp();
          await persist(latest.journal); poisoned = false;
        }
        async function confirmConnection(options) {
          const { connection, journal } = await load();
          if (!connection || !journal || !journal.connectionGuard || !options || options.originalConfirmed !== true ||
              options.decision !== 'use-current' || typeof options.freshRead !== 'function' || journal.operations.some(unresolved)) throw fail('invalid-resolution');
          const guard = journal.connectionGuard;
          const target = await fingerprint(connection.dataSources, cryptoImpl);
          const candidateIsCurrent = connection.revision === guard.candidateRevision && target === guard.targetFingerprint;
          const recordedConnectionIsCurrent = journal.activeConnectionRevision !== null &&
            connection.revision === journal.activeConnectionRevision;
          if (!candidateIsCurrent && !recordedConnectionIsCurrent) throw fail('connection-mismatch');
          let evidence;
          try { evidence = await options.freshRead(Object.freeze({ connectionRevision: connection.revision, targetFingerprint: target })); }
          catch { throw fail('resolution-read-failed'); }
          if (evidence?.connectionRevision !== connection.revision || evidence?.targetFingerprint !== target || evidence?.outcome !== 'use-current') throw fail('invalid-resolution');
          const latest = await load();
          if (JSON.stringify(latest.journal) !== JSON.stringify(journal) || JSON.stringify(latest.connection) !== JSON.stringify(connection)) throw fail('resolution-changed');
          journal.activeConnectionRevision = connection.revision; journal.connectionGuard = null;
          await persist(journal); poisoned = false; candidate = undefined; guardOwned = false;
        }
        const ctx = Object.freeze({
          readJournal: method(async () => frozen(canonical((await load()).journal))),
          inspect: method(async () => {
            const pair = await load(); coherent(pair, true);
            return Object.freeze({ initialized: !!pair.connection && !!pair.journal,
              blocked: poisoned || !!pair.journal?.connectionGuard || !!pair.journal?.operations.some(unresolved) });
          }),
          recoverInterrupted: method(async () => { await load(); }),
          runOperation: method(runOperation), beginConnectionChange: method(beginConnectionChange),
          commitConnectionChange: method(commitConnectionChange), confirmResolution: method(confirmResolution), confirmConnection: method(confirmConnection),
        });
        try {
          let result = action(ctx);
          if (result !== null && (typeof result === 'object' || typeof result === 'function') && typeof result.then === 'function') {
            try { result = await result; }
            finally { accepting = false; }
          } else accepting = false;
          return result;
        }
        catch (error) { accepting = false; throw safe(error, 'action-error'); }
        finally {
          accepting = false;
          const admittedTasks = [...pending];
          if (admittedTasks.length) await Promise.allSettled(admittedTasks);
          active = false;
        }
      });
    } catch (error) { throw safe(error, callbackEntered ? 'action-error' : 'lock-error'); }
    finally { entered = false; }
  }
  return Object.freeze({ withWriteLock });
}
