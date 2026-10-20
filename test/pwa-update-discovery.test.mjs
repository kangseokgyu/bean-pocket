import test from 'node:test';
import assert from 'node:assert/strict';
import { createAppLifecycle } from '../pwa/platform/app-lifecycle.mjs';

const PROTOCOL = 'bean-pocket-update-v1';
const turn = () => new Promise(resolve => setImmediate(resolve));

function eventTarget(properties = {}) {
  const listeners = new Map();
  return Object.assign(properties, {
    addEventListener(type, listener) {
      const current = listeners.get(type) ?? new Set();
      current.add(listener);
      listeners.set(type, current);
    },
    removeEventListener(type, listener) { listeners.get(type)?.delete(listener); },
    listenerCount(type) { return listeners.get(type)?.size ?? 0; },
    async emit(type, event = {}) {
      return Promise.all([...(listeners.get(type) ?? [])].map(listener => listener(event)));
    },
  });
}

function worker(state) {
  return eventTarget({
    state,
    messages: [],
    postMessage(message) { this.messages.push(message); },
  });
}

function fixture({ update } = {}) {
  const active = worker('activated');
  const registration = eventTarget({
    scope: 'https://example.test/pwa/',
    installing: worker('installing'),
    waiting: null,
    active,
    updateCalls: 0,
    async update() {
      this.updateCalls++;
      await update?.(this);
    },
  });
  const serviceWorker = eventTarget();
  let getRegistrationCalls = 0;
  serviceWorker.getRegistration = async () => { getRegistrationCalls++; return registration; };
  const document = eventTarget({ visibilityState: 'visible' });
  const window = eventTarget();
  const lifecycle = createAppLifecycle({
    getState: () => ({ dirty: false, pending: false }),
    setFrozen: async () => true,
    submissionState: { async withWriteLock(action) { return action({ async inspect() { return { blocked: false }; } }); } },
    serviceWorker,
    document,
    window,
  });
  return { active, registration, serviceWorker, document, window, lifecycle,
    get getRegistrationCalls() { return getRegistrationCalls; } };
}

test('startup uses the register() result and checks for an update once', async () => {
  const app = fixture();
  await app.lifecycle.start(app.registration);
  assert.equal(app.getRegistrationCalls, 0);
  assert.equal(app.registration.updateCalls, 1);
  await app.lifecycle.stop();
});

test('installed worker retries safe apply after updatefound and statechange', async () => {
  const app = fixture();
  await app.lifecycle.start(app.registration);
  const installing = worker('installing');
  const waiting = worker('installed');
  app.registration.installing = installing;
  await app.registration.emit('updatefound');
  app.registration.waiting = waiting;
  installing.state = 'installed';
  await installing.emit('statechange');
  await turn();
  assert.deepEqual(waiting.messages, [{ protocol: PROTOCOL, type: 'retry' }]);
  await app.lifecycle.stop();
});

test('startup and one visibility return coalesce overlapping update checks', async () => {
  let releaseUpdate;
  let updateStarted;
  const started = new Promise(resolve => { updateStarted = resolve; });
  const app = fixture({ update: async () => {
    updateStarted();
    await new Promise(resolve => { releaseUpdate = resolve; });
  } });
  const starting = app.lifecycle.start(app.registration);
  await turn();
  assert.equal(app.registration.updateCalls, 1);
  await started;
  app.document.visibilityState = 'hidden';
  await app.document.emit('visibilitychange');
  app.document.visibilityState = 'visible';
  const visibilityChecks = [
    app.document.emit('visibilitychange'),
    app.window.emit('pageshow', { persisted: true }),
  ];
  assert.equal(app.registration.updateCalls, 1);
  releaseUpdate();
  await starting;
  await Promise.all(visibilityChecks);
  await turn();
  assert.equal(app.registration.updateCalls, 1);
  await app.lifecycle.stop();
});

test('a rejected update check can be retried after returning to the app', async () => {
  let attempts = 0;
  const app = fixture({ update: async () => {
    attempts++;
    if (attempts === 1) throw new Error('offline');
  } });
  await app.lifecycle.start(app.registration);
  app.document.visibilityState = 'hidden';
  await app.document.emit('visibilitychange');
  app.document.visibilityState = 'visible';
  await app.document.emit('visibilitychange');
  assert.equal(app.registration.updateCalls, 2);
  await app.lifecycle.stop();
});

test('stop removes registration and installing-worker listeners and closes a pending update race', async () => {
  let releaseUpdate;
  let updateStarted;
  const started = new Promise(resolve => { updateStarted = resolve; });
  const app = fixture({ update: async () => {
    updateStarted();
    await new Promise(resolve => { releaseUpdate = resolve; });
  } });
  const starting = app.lifecycle.start(app.registration);
  await turn();
  assert.equal(app.registration.updateCalls, 1);
  await started;
  const installing = app.registration.installing;
  await app.registration.emit('updatefound');
  await app.lifecycle.stop();
  assert.equal(app.registration.listenerCount('updatefound'), 0);
  assert.equal(installing.listenerCount('statechange'), 0);
  assert.equal(app.serviceWorker.listenerCount('controllerchange'), 0);
  assert.equal(app.document.listenerCount('visibilitychange'), 0);
  assert.equal(app.window.listenerCount('pagehide'), 0);
  assert.equal(app.window.listenerCount('pageshow'), 0);
  releaseUpdate();
  await starting;
  const waiting = worker('installed');
  app.registration.waiting = waiting;
  installing.state = 'installed';
  await installing.emit('statechange');
  await app.document.emit('visibilitychange');
  assert.deepEqual(waiting.messages, []);
  assert.equal(app.registration.updateCalls, 1);
});
