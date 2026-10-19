const PROTOCOL = 'bean-pocket-update-v1';

export function createUpdateCoordinator({ getState, setFrozen, submissionState, serviceWorker,
  navigate = () => false, timeoutMs = 5000 } = {}) {
  if (typeof getState !== 'function' || typeof setFrozen !== 'function' ||
      typeof submissionState?.withWriteLock !== 'function' || !serviceWorker?.addEventListener) {
    throw new TypeError('업데이트 조정기에 필요한 의존성을 확인해 주세요.');
  }
  const tombstones = new Map();
  let current;
  let transitionOwner;
  let started = false;
  let listening = false;
  let freezeQueue = Promise.resolve();

  function changeFrozen(value, details) {
    const task = freezeQueue.then(() => setFrozen(value, details));
    freezeQueue = task.catch(() => undefined);
    return task;
  }

  function clean() {
    const state = getState();
    return state?.dirty === false && state.pending === false;
  }
  function tombstone(source, generation) {
    if (!tombstones.has(source)) tombstones.set(source, new Set());
    tombstones.get(source).add(generation);
  }
  function cancelled(source, generation) { return tombstones.get(source)?.has(generation); }
  async function trusted(source) {
    try {
      const registration = await serviceWorker.getRegistration();
      const expected = new URL('sw.js', registration.scope).href;
      return source?.scriptURL === expected &&
        [registration.installing, registration.waiting, registration.active].includes(source) ? registration : null;
    } catch { return null; }
  }
  function post(port, value) { try { port?.postMessage(value); } catch { /* Closed peer. */ } }
  function invalidate(session) {
    if (session.invalid) return;
    session.invalid = true;
    tombstone(session.source, session.generation);
    post(session.control, { protocol: PROTOCOL, type: 'invalidate', generation: session.generation });
    // An ACK is a promise to retain freeze/lock until the worker's terminal decision.
    // Local notifications and TTLs must never silently revoke that promise.
  }
  function valid(session) { return current === session && !session.invalid && clean(); }
  function armTimeout(session) {
    clearTimeout(session.timer);
    session.timer = setTimeout(() => {
      invalidate(session);
      if (!session.accepted) void terminate(session);
      else {
        // Wake a potentially restarted owner. Only its explicit generation abort
        // can release an ACKed freeze/lock; elapsed time is not release authority.
        try { session.source.postMessage({ protocol: PROTOCOL, type: 'retry' }); } catch { /* Retry on the next lifecycle event. */ }
      }
    }, timeoutMs);
    session.timer.unref?.();
  }
  async function thaw(session) {
    if (current !== session) return;
    try { return await changeFrozen(false, { generation: session.generation }) === true; }
    catch { return false; }
  }
  function terminate(session) {
    if (session.termination) return session.termination;
    tombstone(session.source, session.generation);
    session.invalid = true;
    session.terminal = true;
    clearTimeout(session.timer);
    session.release?.();
    session.termination = (async () => {
      // Wait for freeze and lock work before thawing, so late completions cannot reacquire them.
      await session.freezeTask?.catch(() => undefined);
      await session.lockTask?.catch(() => undefined);
      if (!await thaw(session)) {
        session.termination = undefined;
        return false;
      }
      if (current === session) current = undefined;
      if (!started && !current && listening) {
        serviceWorker.removeEventListener?.('message', handle);
        listening = false;
      }
      return true;
    })();
    return session.termination;
  }
  async function handle(event) {
    const message = event?.data;
    const source = event?.source;
    const port = event?.ports?.[0];
    if (message?.protocol !== PROTOCOL || typeof message.generation !== 'string' || !port) return;
    const { type, generation } = message;
    const registration = await trusted(source);
    const ownsSession = current?.source === source && current.generation === generation;
    if (!registration && !(type === 'abort' && ownsSession)) return;
    const ack = (ok, extra = {}) => post(port, { protocol: PROTOCOL, type: 'ack', generation, ok, ...extra });
    let session = current;
    if (type === 'recover') {
      // Inquiry only: a delayed recovery request must not thaw a newer session.
      const owned = session?.source === source ? session : undefined;
      if (owned && registration.active === source && owned.phase !== 'navigating') transitionOwner = source;
      ack(true, { active: registration.active === source,
        ownedGeneration: owned?.generation ?? null, phase: owned?.phase ?? null,
        needsTransition: transitionOwner === source });
      return;
    }
    if (type === 'abort') {
      tombstone(source, generation);
      const closed = session?.source === source && session.generation === generation
        ? await terminate(session) : true;
      ack(closed === true);
      return;
    }
    if (type === 'prepare') {
      // An already active worker will not receive another activate event after
      // skipWaiting(), so it cannot start an install-only frozen transaction.
      const active = registration.active === source;
      if (!started || current || cancelled(source, generation) ||
          (active && message.activeTransition !== true) ||
          (!active && message.activeTransition === true)) { ack(false); return; }
      session = { source, generation, control: port, phase: 'preparing', invalid: false };
      current = session;
      armTimeout(session);
      try {
        session.freezeTask = changeFrozen(true, { generation });
        const frozen = await session.freezeTask;
        if (frozen !== true || session.terminal || !started || !valid(session)) throw new Error('cancelled');
        const status = await submissionState.withWriteLock(context => context.inspect());
        if (status?.blocked !== false || session.terminal || !started || !valid(session)) throw new Error('blocked');
        session.phase = 'prepared';
        session.accepted = true;
        // The worker owns expiry after ACK; expiry now requests an explicit abort, retaining the lock.
        ack(true, { frozen: true, clean: true });
      } catch {
        await terminate(session);
        ack(false, { frozen: false, clean: false });
      }
      return;
    }
    if (!session || session.source !== source || session.generation !== generation || !valid(session)) {
      ack(false); return;
    }
    if (type === 'lock') {
      if (session.context || session.lockTask) { ack(false); return; }
      const released = new Promise(resolve => { session.release = resolve; });
      session.lockTask = submissionState.withWriteLock(async context => {
        session.context = context;
        const status = await context.inspect();
        if (status?.blocked !== false || !valid(session)) { ack(false); return; }
        ack(true, { frozen: true, clean: true });
        await released;
      }).catch(() => { invalidate(session); ack(false); });
      return;
    }
    if (!['recheck', 'commit', 'activate', 'navigate'].includes(type)) return;
    try {
      if (session.context) {
        const status = await session.context.inspect();
        if (status?.blocked !== false) invalidate(session);
      }
      if (!valid(session)) { ack(false); return; }
      if (type === 'commit') {
        if (session.phase !== 'prepared') { ack(false); return; }
        session.phase = 'committed';
        // Document transition intent outlives this disposable generation. An
        // activation membership abort may thaw it before any recovery inquiry.
        transitionOwner = source;
        armTimeout(session);
      }
      if (type === 'activate') {
        if (session.phase !== 'committed' || registration.active !== source) {
          ack(false); return;
        }
        session.phase = 'active';
      }
      if (type === 'navigate') {
        if (session.phase !== 'active') { ack(false); return; }
        // No await between the final local check and starting the conditional navigation.
        const result = navigate({ generation, buildVersion: message.buildVersion });
        if (result !== true) { invalidate(session); ack(false); return; }
        session.phase = 'navigating';
        clearTimeout(session.timer);
        session.release?.();
        tombstone(source, generation);
        // Keep old inputs frozen until the document is replaced.
      }
      ack(true, { frozen: true, clean: true });
    } catch { invalidate(session); ack(false); }
  }
  return Object.freeze({
    start() {
      started = true;
      if (!listening) { serviceWorker.addEventListener('message', handle); listening = true; }
    },
    async stop() {
      started = false;
      if (current) {
        invalidate(current);
        if (!current.accepted || current.phase === 'navigating') await terminate(current);
      }
      if (!current && listening) { serviceWorker.removeEventListener?.('message', handle); listening = false; }
    },
    notifyStateChange() {
      if (current && !clean()) invalidate(current);
      return transitionOwner;
    },
  });
}
