const DIRECTORY = 'bean-pocket-private-v1';
const FILE = 'connection.json';
const DATA_SOURCE_KEYS = Object.freeze(['beans', 'recipes', 'steps', 'records']);
const CONNECTION_KEYS = Object.freeze(['schemaVersion', 'revision', 'token', 'dataSources']);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f-\u009f]/;
const safeFailures = new WeakSet();

function failure(code, writeState, blockWrites = false) {
  const record = { code };
  if (writeState) record.writeState = writeState;
  if (blockWrites) record.blockWrites = true;
  Object.freeze(record);
  safeFailures.add(record);
  return record;
}

function isSafeFailure(value) {
  return value !== null && (typeof value === 'object' || typeof value === 'function') && safeFailures.has(value);
}

function errorName(error) {
  try { return error?.name; } catch { return undefined; }
}

function classify(error) {
  const name = errorName(error);
  if (name === 'NotAllowedError' || name === 'SecurityError') return 'permission';
  if (name === 'QuotaExceededError') return 'quota';
  if (name === 'NotSupportedError') return 'unsupported';
  if (name === 'TypeMismatchError') return 'path-conflict';
  return 'storage-error';
}

function exactDataObject(value, expectedKeys) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return false;
  const keys = Reflect.ownKeys(value);
  if (keys.length !== expectedKeys.length || keys.some(key => typeof key !== 'string')) return false;
  if (!expectedKeys.every(key => keys.includes(key))) return false;
  return expectedKeys.every(key => {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return descriptor && Object.hasOwn(descriptor, 'value') && descriptor.enumerable;
  });
}

function normalizedUuid(value) {
  if (typeof value !== 'string' || !UUID.test(value)) return null;
  return value.toLowerCase();
}
function validDataSources(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return false;
  const keys = Reflect.ownKeys(value);
  if (keys.some(key => typeof key !== 'string' || (!DATA_SOURCE_KEYS.includes(key) && key !== 'bags'))) return false;
  return DATA_SOURCE_KEYS.every(key => {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return descriptor && Object.hasOwn(descriptor, 'value') && descriptor.enumerable;
  });
}

function normalizeConnection(value, invalidCode) {
  try {
    if (!exactDataObject(value, CONNECTION_KEYS)) throw new TypeError();
    if (value.schemaVersion !== 1) throw new TypeError();
    const revision = normalizedUuid(value.revision);
    if (!revision || typeof value.token !== 'string' || value.token.trim().length === 0 || CONTROL_CHARACTERS.test(value.token)) {
      throw new TypeError();
    }
    if (!validDataSources(value.dataSources)) throw new TypeError();
    const dataSources = {};
    for (const key of DATA_SOURCE_KEYS) {
      const id = normalizedUuid(value.dataSources[key]);
      if (!id) throw new TypeError();
      dataSources[key] = id;
    }
    return Object.freeze({
      schemaVersion: 1,
      revision,
      token: value.token,
      dataSources: Object.freeze(dataSources),
    });
  } catch {
    throw failure(invalidCode, invalidCode === 'invalid-input' ? 'not-sent' : undefined);
  }
}

function parseConnection(text) {
  let parsed;
  try { parsed = JSON.parse(text); }
  catch { throw failure('corrupt'); }

  try {
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) throw new TypeError();
    if (Number.isInteger(parsed.schemaVersion) && parsed.schemaVersion !== 1) throw failure('unsupported-version');
  } catch (error) {
    if (isSafeFailure(error)) throw error;
    throw failure('corrupt');
  }
  return normalizeConnection(parsed, 'corrupt');
}

function sameConnection(left, right) {
  return left.schemaVersion === right.schemaVersion && left.revision === right.revision && left.token === right.token &&
    DATA_SOURCE_KEYS.every(key => left.dataSources[key] === right.dataSources[key]);
}

function storageAvailable(storage) {
  return typeof storage?.getDirectory === 'function';
}

export function createConnectionFile({ storage = globalThis.navigator?.storage } = {}) {
  async function readConnection() {
    if (!storageAvailable(storage)) throw failure('unsupported');
    try {
      const root = await storage.getDirectory();
      let directory;
      try { directory = await root.getDirectoryHandle(DIRECTORY, { create: false }); }
      catch (error) {
        if (errorName(error) === 'NotFoundError') return null;
        throw error;
      }
      let handle;
      try { handle = await directory.getFileHandle(FILE, { create: false }); }
      catch (error) {
        if (errorName(error) === 'NotFoundError') return null;
        throw error;
      }
      const file = await handle.getFile();
      return parseConnection(await file.text());
    } catch (error) {
      if (isSafeFailure(error)) throw error;
      throw failure(classify(error));
    }
  }

  async function writeConnection(candidate) {
    const normalized = normalizeConnection(candidate, 'invalid-input');
    const serialized = JSON.stringify(normalized);
    if (!storageAvailable(storage)) throw failure('unsupported', 'not-sent');

    let writable;
    let closeStarted = false;
    try {
      const root = await storage.getDirectory();
      const directory = await root.getDirectoryHandle(DIRECTORY, { create: true });
      const handle = await directory.getFileHandle(FILE, { create: true });
      writable = await handle.createWritable();
      await writable.write(serialized);
      closeStarted = true;
      await writable.close();
      const saved = await readConnection();
      if (saved === null || !sameConnection(normalized, saved)) throw failure('save-uncertain', 'unknown', true);
      return saved;
    } catch (error) {
      if (closeStarted) throw failure('save-uncertain', 'unknown', true);
      try { await writable?.abort(); } catch { /* Preserve the original failure classification. */ }
      if (isSafeFailure(error)) throw error;
      throw failure(classify(error), 'not-sent');
    }
  }

  // T14/T21 own active-connection state, journal coordination, and exclusive locking.
  // A save-uncertain record signals their caller to block writes after close/readback uncertainty.
  return Object.freeze({ readConnection, writeConnection });
}
