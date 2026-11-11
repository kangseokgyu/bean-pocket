const DIRECTORY = 'bean-pocket-private-v1';
const FILE_PREFIX = 'form-drafts-v1-';
const LOCK_PREFIX = 'bean-pocket-form-drafts-v1:';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HASH = /^[0-9a-f]{64}$/i;
const FORM_KEY = /^(beans|recipes|records|brews|recipe-edit:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;
const PRIVATE_FIELD = /(?:token|secret|password|credential|authori[sz]ation)/i;
const MAX_DRAFT_LENGTH = 128 * 1024;

function isRecord(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function hasPrivateField(value, ancestors = new Set()) {
  if (!value || typeof value !== 'object') return false;
  if (ancestors.has(value)) return true;
  ancestors.add(value);
  const privateField = Object.keys(value).some(key => PRIVATE_FIELD.test(key) || hasPrivateField(value[key], ancestors));
  ancestors.delete(value);
  return privateField;
}

function validScope(scope) {
  if (!isRecord(scope) || Object.keys(scope).length !== 2 ||
      !Object.hasOwn(scope, 'revision') || !Object.hasOwn(scope, 'targetFingerprint') ||
      !UUID.test(scope.revision) || !HASH.test(scope.targetFingerprint)) {
    throw new TypeError('Invalid form draft scope');
  }
  return FILE_PREFIX + scope.revision.toLowerCase() + '-' + scope.targetFingerprint.toLowerCase() + '.json';
}

function validDraftKey(key) {
  return typeof key === 'string' && FORM_KEY.test(key);
}

function validDraft(value) {
  if (!isRecord(value) || !Object.hasOwn(value, 'values') || !Object.hasOwn(value, 'steps') ||
      !isRecord(value.values) || !Array.isArray(value.steps) || hasPrivateField(value)) return false;
  if (Object.hasOwn(value, 'edited') && typeof value.edited !== 'boolean') return false;
  if (Object.keys(value.values).some(key => !/^[A-Za-z][A-Za-z0-9]*$/.test(key) ||
      typeof value.values[key] !== 'string')) return false;
  if (value.steps.some(step => !isRecord(step) || Object.keys(step).some(key =>
    !['id', 'stepName', 'time', 'water'].includes(key) || typeof step[key] !== 'string'))) return false;
  if (Object.hasOwn(value, 'copyId') && value.copyId !== null &&
      (typeof value.copyId !== 'string' || !UUID.test(value.copyId))) return false;
  if (Object.hasOwn(value, 'route') && (typeof value.route !== 'string' || value.route.length > 512)) return false;
  if (Object.hasOwn(value, 'flowKey') && (typeof value.flowKey !== 'string' || value.flowKey.length > 512)) return false;
  if (Object.hasOwn(value, 'baseline')) {
    if (typeof value.baseline !== 'string' || value.baseline.length > MAX_DRAFT_LENGTH) return false;
    try {
      if (hasPrivateField(JSON.parse(value.baseline))) return false;
    } catch { return false; }
  }
  return true;
}

function parseDraftFile(text) {
  if (typeof text !== 'string' || text.length > MAX_DRAFT_LENGTH) return null;
  let record;
  try { record = JSON.parse(text); } catch { return null; }
  if (!isRecord(record) || record.schemaVersion !== 1 || Object.keys(record).length !== 2 ||
      !Object.hasOwn(record, 'drafts') || !isRecord(record.drafts)) return null;
  const drafts = new Map();
  for (const [key, draft] of Object.entries(record.drafts)) {
    if (validDraftKey(key) && validDraft(draft)) drafts.set(key, draft);
  }
  return drafts;
}

function errorName(error) {
  try { return error?.name; } catch { return ''; }
}

export function createFormDraftStore(options = {}) {
  let storage = options?.storage;
  let locks = options?.locks;
  if (!options || !Object.hasOwn(options, 'storage')) {
    try { storage = globalThis.navigator?.storage; } catch { storage = null; }
  }
  if (!options || !Object.hasOwn(options, 'locks')) {
    try { locks = globalThis.navigator?.locks; } catch { locks = null; }
  }

  const cache = new Map();
  let writes = Promise.resolve();

  async function readStored(fileName) {
    if (typeof storage?.getDirectory !== 'function') return null;
    try {
      const root = await storage.getDirectory();
      let directory;
      try { directory = await root.getDirectoryHandle(DIRECTORY, { create: false }); }
      catch (error) {
        if (errorName(error) === 'NotFoundError') return new Map();
        throw error;
      }
      let handle;
      try { handle = await directory.getFileHandle(fileName, { create: false }); }
      catch (error) {
        if (errorName(error) === 'NotFoundError') return new Map();
        throw error;
      }
      return parseDraftFile(await (await handle.getFile()).text());
    } catch { return null; }
  }

  async function writeStored(fileName, drafts) {
    if (typeof storage?.getDirectory !== 'function') return false;
    const serialized = JSON.stringify({ schemaVersion: 1, drafts: Object.fromEntries(drafts) });
    if (serialized.length > MAX_DRAFT_LENGTH) return false;
    let writable;
    let closeStarted = false;
    try {
      const root = await storage.getDirectory();
      const directory = await root.getDirectoryHandle(DIRECTORY, { create: true });
      const handle = await directory.getFileHandle(fileName, { create: true });
      writable = await handle.createWritable();
      await writable.write(serialized);
      closeStarted = true;
      await writable.close();
      if (await (await handle.getFile()).text() !== serialized) return false;
      return true;
    } catch {
      if (!closeStarted) {
        try { await writable?.abort(); } catch { /* Preserve the storage failure. */ }
      }
      return false;
    }
  }

  function withLock(fileName, action) {
    if (typeof locks?.request !== 'function') return action();
    return locks.request(LOCK_PREFIX + fileName, { mode: 'exclusive' }, action);
  }

  function enqueue(fileName, update) {
    const task = writes.then(async () => {
      try {
        return await withLock(fileName, async () => {
          const current = await readStored(fileName);
          if (!current) return false;
          const next = new Map(current);
          update(next);
          const saved = await writeStored(fileName, next);
          if (saved) cache.set(fileName, next);
          return saved;
        });
      } catch { return false; }
    });
    writes = task.then(() => undefined, () => undefined);
    return task;
  }

  async function read(scope) {
    const fileName = validScope(scope);
    await writes;
    if (cache.has(fileName)) return new Map(cache.get(fileName));
    const stored = await readStored(fileName);
    const drafts = stored ?? new Map();
    cache.set(fileName, drafts);
    return new Map(drafts);
  }

  async function save(scope, formKey, draft) {
    const fileName = validScope(scope);
    if (!validDraftKey(formKey) || !validDraft(draft)) throw new TypeError('Invalid form draft');
    const next = new Map(cache.get(fileName) ?? []);
    next.set(formKey, draft);
    const serialized = JSON.stringify({ schemaVersion: 1, drafts: Object.fromEntries(next) });
    if (serialized.length > MAX_DRAFT_LENGTH) return Promise.resolve(false);
    cache.set(fileName, next);
    return enqueue(fileName, drafts => drafts.set(formKey, draft));
  }

  function remove(scope, formKey) {
    const fileName = validScope(scope);
    if (!validDraftKey(formKey)) return Promise.resolve(false);
    const next = new Map(cache.get(fileName) ?? []);
    next.delete(formKey);
    cache.set(fileName, next);
    return enqueue(fileName, drafts => drafts.delete(formKey));
  }

  async function flush() {
    await writes;
  }

  return Object.freeze({ read, save, remove, flush });
}
