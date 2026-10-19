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
  let retrying = false;

  async function freeze(value, details) {
    let result = false;
    try { result = await setFrozen(value, details); } catch { result = false; }
    frozen = value ? result === true : false;
    return value ? frozen : true;
  }
  async function notifyStateChange() {
    const recoveryOwner = coordinator?.notifyStateChange();
    if (!started || retrying) return;
    retrying = true;
    try {
      registration ??= await serviceWorker.getRegistration?.();
      if (registration?.waiting) {
        registration.waiting.postMessage({ protocol: PROTOCOL, type: 'retry' });
      } else if ((frozen || recoveryOwner === registration?.active) && registration?.active) {
        registration.active.postMessage({ protocol: PROTOCOL, type: 'retry' });
      }
    } catch { /* Retry on the next lifecycle or state notification. */ }
    finally { retrying = false; }
  }
  function onControllerChange() { void notifyStateChange(); }
  function onVisibilityChange() { if (!document || document.visibilityState === 'visible') void notifyStateChange(); }

  return Object.freeze({
    async start() {
      if (started) return;
      started = true;
      coordinator = createUpdateCoordinator({ getState, setFrozen: freeze, submissionState, serviceWorker, navigate, timeoutMs });
      coordinator.start();
      serviceWorker.addEventListener?.('controllerchange', onControllerChange);
      document?.addEventListener?.('visibilitychange', onVisibilityChange);
      window?.addEventListener?.('pageshow', onVisibilityChange);
      await notifyStateChange();
    },
    async stop() {
      started = false;
      await coordinator?.stop();
      coordinator = undefined;
      serviceWorker.removeEventListener?.('controllerchange', onControllerChange);
      document?.removeEventListener?.('visibilitychange', onVisibilityChange);
      window?.removeEventListener?.('pageshow', onVisibilityChange);
    },
    isFrozen() { return frozen; },
    notifyStateChange,
  });
}
