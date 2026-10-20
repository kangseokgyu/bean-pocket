import { createUpdateCoordinator } from './update-coordinator.mjs';

const PROTOCOL = 'bean-pocket-update-v1';

export function createAppLifecycle({ getState, setFrozen, submissionState, serviceWorker,
  document = globalThis.document, window = globalThis.window,
  navigate = () => { if (!window?.location?.reload) return false; window.location.reload(); return true; },
  timeoutMs = 5000 } = {}) {
  if (typeof getState !== 'function' || typeof setFrozen !== 'function' ||
      typeof submissionState?.withWriteLock !== 'function' || !serviceWorker) {
    throw new TypeError('앱 수명 관리에 필요한 의존성을 확인해 주세요.');
  }
  let started = false;
  let frozen = false;
  let registration;
  let coordinator;
  let retryTask;
  let retryRequested = false;
  let retryWorker;
  let retryOwner;
  let updateTask;
  let startTask;
  let generation = 0;
  let installingWorker;
  let installingListener;
  let pageVisible = !document || document.visibilityState === 'visible';

  async function freeze(value, details) {
    let result = false;
    try { result = await setFrozen(value, details); } catch { result = false; }
    frozen = value ? result === true : false;
    return value ? frozen : true;
  }

  function detachInstallingWorker() {
    if (installingWorker && installingListener) {
      installingWorker.removeEventListener?.('statechange', installingListener);
    }
    installingWorker = undefined;
    installingListener = undefined;
  }

  function observeInstallingWorker() {
    detachInstallingWorker();
    const worker = registration?.installing;
    if (!worker) return;
    installingWorker = worker;
    installingListener = () => {
      if (worker.state === 'installed') {
        detachInstallingWorker();
        void notifyStateChange(worker);
      } else if (worker.state === 'redundant') detachInstallingWorker();
    };
    worker.addEventListener?.('statechange', installingListener);
    if (worker.state === 'installed') installingListener();
  }

  function detachRegistration() {
    registration?.removeEventListener?.('updatefound', onUpdateFound);
    detachInstallingWorker();
  }

  function rememberRegistration(value) {
    if (!value || value === registration) return registration;
    detachRegistration();
    registration = value;
    registration.addEventListener?.('updatefound', onUpdateFound);
    observeInstallingWorker();
    return registration;
  }

  function onUpdateFound() {
    if (started) observeInstallingWorker();
  }

  async function discoverRegistration() {
    if (registration) return registration;
    try {
      const found = await serviceWorker.getRegistration?.();
      if (started && !registration && found) return rememberRegistration(found);
      return registration ?? found;
    } catch { return undefined; }
  }

  async function notifyStateChange(installedWorker) {
    const owner = coordinator?.notifyStateChange();
    if (!started) return;
    retryRequested = true;
    if (installedWorker) retryWorker = installedWorker;
    retryOwner = owner;
    if (retryTask) return retryTask;
    retryTask = (async () => {
      while (retryRequested && started) {
        retryRequested = false;
        const preferredWorker = retryWorker;
        const recoveryOwner = retryOwner;
        retryWorker = undefined;
        retryOwner = undefined;
        try {
          const current = registration ?? await discoverRegistration();
          if (!started || !current) continue;
          const waiting = current.waiting ?? (preferredWorker?.state === 'installed' ? preferredWorker : undefined);
          if (waiting) waiting.postMessage({ protocol: PROTOCOL, type: 'retry' });
          else if ((frozen || recoveryOwner === current.active) && current.active) {
            current.active.postMessage({ protocol: PROTOCOL, type: 'retry' });
          }
        } catch { /* Retry on the next lifecycle or state notification. */ }
      }
    })().finally(() => {
      retryTask = undefined;
      if (retryRequested && started) void notifyStateChange();
    });
    return retryTask;
  }

  function checkForUpdate() {
    if (!started) return Promise.resolve();
    if (updateTask) {
      if (updateTask.generation === generation) return updateTask.promise;
      return updateTask.promise.then(() => started ? checkForUpdate() : undefined);
    }
    const currentGeneration = generation;
    const task = (async () => {
      const current = registration ?? await discoverRegistration();
      if (!started || !current || typeof current.update !== 'function') return;
      try { await current.update(); } catch { return; }
      if (!started || currentGeneration !== generation) return;
      observeInstallingWorker();
    })();
    const record = { generation: currentGeneration };
    record.promise = task.catch(() => undefined).finally(() => {
      if (updateTask === record) updateTask = undefined;
    });
    updateTask = record;
    return record.promise;
  }

  function onVisible() {
    if (!started) return;
    return Promise.all([notifyStateChange(), checkForUpdate()]);
  }

  function onControllerChange() { void notifyStateChange(); }
  function onVisibilityChange() {
    if (!document || document.visibilityState !== 'visible') {
      pageVisible = false;
      return;
    }
    if (pageVisible) return;
    pageVisible = true;
    return onVisible();
  }
  function onPageHide() { pageVisible = false; }
  function onPageShow() {
    if (!started || pageVisible) return;
    pageVisible = true;
    return onVisible();
  }

  return Object.freeze({
    start(knownRegistration) {
      if (!started) {
        started = true;
        generation++;
        coordinator = createUpdateCoordinator({ getState, setFrozen: freeze, submissionState, serviceWorker, navigate, timeoutMs });
        coordinator.start();
        serviceWorker.addEventListener?.('controllerchange', onControllerChange);
        document?.addEventListener?.('visibilitychange', onVisibilityChange);
        window?.addEventListener?.('pagehide', onPageHide);
        window?.addEventListener?.('pageshow', onPageShow);
      }
      if (knownRegistration) rememberRegistration(knownRegistration);
      if (startTask) return startTask;
      const task = (async () => {
        if (!registration) await discoverRegistration();
        if (!started) return;
        await notifyStateChange();
        if (started) await checkForUpdate();
      })();
      const tracked = task.finally(() => { if (startTask === tracked) startTask = undefined; });
      startTask = tracked;
      return tracked;
    },
    async stop() {
      started = false;
      generation++;
      await coordinator?.stop();
      coordinator = undefined;
      serviceWorker.removeEventListener?.('controllerchange', onControllerChange);
      document?.removeEventListener?.('visibilitychange', onVisibilityChange);
      window?.removeEventListener?.('pagehide', onPageHide);
      window?.removeEventListener?.('pageshow', onPageShow);
      detachRegistration();
      registration = undefined;
      startTask = undefined;
      retryRequested = false;
      retryWorker = undefined;
      retryOwner = undefined;
      pageVisible = !document || document.visibilityState === 'visible';
    },
    isFrozen() { return frozen; },
    notifyStateChange,
  });
}
