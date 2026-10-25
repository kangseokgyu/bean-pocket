const BUILD_VERSION = '__BUILD_VERSION__';
const SCOPE_KEY = encodeURIComponent(new URL(self.registration.scope).pathname);
const CACHE_PREFIX = `bean-pocket-shell-${SCOPE_KEY}-`;
const CACHE_NAME = `${CACHE_PREFIX}${BUILD_VERSION}`;
const APP_FILES = ["./", "./index.html", "./app.mjs", "./commands/index.mjs", "./ui/controller.mjs", "./ui/view.mjs", "./data/notion-client.mjs", "./data/notion-properties.mjs", "./data/read-repository.mjs", "./domain.mjs", "./platform/app-lifecycle.mjs", "./platform/connection-file.mjs", "./platform/update-coordinator.mjs", "./state/submission-state.mjs", "./styles.css", "./manifest.webmanifest", "./icons/icon-192.png", "./icons/icon-512.png", "./icons/bp-logo.png"];

const UPDATE_PROTOCOL = 'bean-pocket-update-v1';
const UPDATE_TIMEOUT_MS = 5000;
let safeApplyPromise;
let activeAttempt;

self.addEventListener('install', event => {
  const APP_REQUESTS = APP_FILES.map(file => new Request(new URL(file, self.registration.scope), { cache: 'reload' }));
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_REQUESTS)).then(() => requestSafeApply()));
});

function clientMessage(client, type, generation, attempt) {
  return new Promise(resolve => {
    const channel = new MessageChannel();
    let settled = false;
    const finish = value => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (type !== 'prepare') channel.port1.close();
      resolve(value);
    };
    const timer = setTimeout(() => finish(null), UPDATE_TIMEOUT_MS);
    channel.port1.onmessage = event => {
      const data = event.data;
      if (data?.protocol === UPDATE_PROTOCOL && data.generation === generation && data.type === 'invalidate') {
        attempt.invalid = true;
        return;
      }
      finish(data);
    };
    attempt.ports.push(channel.port1);
    try { client.postMessage({ protocol: UPDATE_PROTOCOL, type, generation, buildVersion: BUILD_VERSION,
      activeTransition: attempt.active === true }, [channel.port2]); }
    catch { finish(null); }
  });
}

function requestSafeApply(recover = false) {
  if (safeApplyPromise) return safeApplyPromise;
  if (activeAttempt) return Promise.resolve();
  safeApplyPromise = (async () => {
    let active = false;
    if (recover) {
      const result = await recoverAbandonedSessions();
      if (!result.ready || (result.active && !result.needsTransition)) return;
      active = result.active;
    }
    await performSafeApply(active);
  })().finally(() => { safeApplyPromise = undefined; });
  return safeApplyPromise;
}

async function recoverAbandonedSessions() {
  const recovery = { generation: crypto.randomUUID(), clients: await scopedWindowClients(), ports: [], invalid: false };
  try {
    // Page state survives a worker global restart. Query it without changing it,
    // then abort only the exact generation reported by the same worker owner.
    const statuses = await Promise.all(recovery.clients.map(client => clientMessage(client, 'recover', recovery.generation, recovery)));
    if (!statuses.every(status => validAck(status, recovery.generation))) return { ready: false };
    const aborts = await Promise.all(statuses.map((status, index) => typeof status.ownedGeneration === 'string' && status.phase !== 'navigating'
      ? clientMessage(recovery.clients[index], 'abort', status.ownedGeneration, recovery)
        .then(ack => validAck(ack, status.ownedGeneration)) : true));
    return { ready: aborts.every(Boolean) && !statuses.some(status => status.phase === 'navigating'),
      active: statuses.some(status => status.active === true),
      needsTransition: statuses.some(status => status.needsTransition === true) };
  } finally { for (const port of recovery.ports) port.close(); }
}

async function abortAttempt(attempt) {
  attempt.invalid = true;
  await Promise.all(attempt.clients.map(client => clientMessage(client, 'abort', attempt.generation, attempt)));
  for (const port of attempt.ports) port.close();
  if (activeAttempt === attempt) activeAttempt = undefined;
}

async function phase(attempt, type, clients = attempt.clients) {
  const acks = await Promise.all(clients.map(client => clientMessage(client, type, attempt.generation, attempt)));
  return !attempt.invalid && acks.every(ack => validAck(ack, attempt.generation, type !== 'abort'));
}

async function performSafeApply(active = false) {
  const attempt = { generation: crypto.randomUUID(), clients: [], ports: [], invalid: false, committed: false, active };
  activeAttempt = attempt;
  try {
    const first = await scopedWindowClients();
    if (!first.length) return;
    const ids = first.map(client => client.id).sort();
    for (const client of first) {
      // Include every contacted client, even when its prepare ACK is lost or delayed.
      attempt.clients.push(client);
      if (!await phase(attempt, 'prepare', [client])) return;
    }
    if (!await phase(attempt, 'lock', [first[0]])) return;
    if (!sameClients(ids, await scopedWindowClients())) return;
    if (!await phase(attempt, 'recheck')) return;
    if (!sameClients(ids, await scopedWindowClients())) return;
    // Commit seals the generation; every participant retains freeze and the leader lock.
    // Invalidation uses the retained prepare channel and never locally drops that lock.
    if (!await phase(attempt, 'commit')) return;
    if (attempt.invalid) return;
    attempt.committed = true;
    if (attempt.active) await transitionOpenApps();
    else await self.skipWaiting();
  } catch { attempt.committed = false; }
  finally { if (!attempt.committed) await abortAttempt(attempt); }
}

async function scopedWindowClients() {
  const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  return clients.filter(sourceInScope);
}

function sourceInScope(source) {
  try {
    const scope = new URL(self.registration.scope);
    const url = new URL(source.url);
    return url.origin === scope.origin && url.pathname.startsWith(scope.pathname);
  } catch { return false; }
}

function validAck(ack, generation, needsClean = false) {
  return ack?.protocol === UPDATE_PROTOCOL && ack.type === 'ack' && ack.generation === generation &&
    ack.ok === true && (!needsClean || (ack.frozen === true && ack.clean === true));
}

function sameClients(ids, clients) {
  const current = clients.map(client => client.id).sort();
  return ids.length === current.length && ids.every((id, index) => id === current[index]);
}

self.addEventListener('message', event => {
  if (event.data?.protocol === UPDATE_PROTOCOL && event.data.type === 'retry' && sourceInScope(event.source)) {
    event.waitUntil?.(requestSafeApply(true));
  }
});

self.addEventListener('activate', event => {
  event.waitUntil(Promise.all([
    caches.keys().then(names => Promise.all(names
      .filter(name => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME)
      .map(name => caches.delete(name)))),
    transitionOpenApps(),
  ]));
});

async function transitionOpenApps() {
  const attempt = activeAttempt;
  // A restarted worker cannot authorize navigation from lost commit evidence.
  // Recover the exact page-owned generation explicitly instead of leaving it locked.
  if (!attempt?.committed) { await requestSafeApply(true); return; }
  try {
    const ids = attempt.clients.map(client => client.id).sort();
    if (attempt.invalid || !sameClients(ids, await scopedWindowClients())) return;
    if (!await phase(attempt, 'activate')) return;
    if (!await phase(attempt, 'navigate')) return;
    attempt.finished = true;
    for (const port of attempt.ports) port.close();
  } finally {
    if (!attempt.finished) await abortAttempt(attempt);
  }
}

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  const appUrls = APP_FILES.map(file => new URL(file, self.registration.scope).href);
  if (request.method !== 'GET' || url.origin !== self.location.origin || !appUrls.includes(url.href)) return;

  event.respondWith(caches.open(CACHE_NAME).then(async cache => {
    const cached = await cache.match(request);
    return cached || fetch(request);
  }));
});
