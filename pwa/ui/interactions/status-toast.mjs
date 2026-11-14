import { make } from '../shared/dom.mjs';
import { actionIcon } from '../shared/icons.mjs';

const IN_PROGRESS_STATUS_TYPES = new Set(['startup-checking', 'checking', 'saving', 'loading']);
const COMPLETED_STATUS_TYPES = new Set(['saved', 'connected', 'resolved', 'loaded']);
const STATUS_DISPLAY_MS = 1000;
const ENTER_FALLBACK_MS = 420;
const EXIT_FALLBACK_MS = 300;

export function createStatusToast(document, page, { isPending, hideForDialog, onHide }) {
  let suppressPendingStatus = false;
  let statusType = '';
  let statusMessageText = '';
  let startupMessageText = '';
  let statusPopoverOpen = false;
  let statusPopoverUnsupported = false;
  let statusHideTimer;
  let motionFallbackTimer;
  let motionState = 'hidden';

  const status = make(document, 'p', '', 'app-status');
  status.hidden = true;
  status.dataset.motion = 'hidden';
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  status.setAttribute('popover', 'manual');
  const statusMessage = make(document, 'span', '', 'status-message');
  const statusIcon = make(document, 'span', undefined, 'button-icon status-icon');
  statusIcon.hidden = true;
  statusIcon.dataset.state = 'idle';
  statusIcon.setAttribute('aria-hidden', 'true');
  statusIcon.append(actionIcon(document, 'check'));
  status.append(statusMessage, statusIcon);
  page.append(status);

  function prefersReducedMotion() {
    try {
      return Boolean(document.defaultView?.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches);
    } catch {
      return false;
    }
  }

  function cancelMotionTimer() {
    clearTimeout(motionFallbackTimer);
    motionFallbackTimer = undefined;
  }

  function setMotionState(nextState) {
    motionState = nextState;
    status.dataset.motion = nextState;
  }

  function clearStoredMessage() {
    statusType = '';
    statusMessageText = '';
    startupMessageText = '';
    status.dataset.state = '';
  }

  function clearRenderedContent() {
    statusMessage.textContent = '';
    statusIcon.hidden = true;
    statusIcon.dataset.state = 'idle';
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    status.setAttribute('aria-busy', String(isPending()));
    status.dataset.pending = 'false';
  }

  function settleEnter() {
    if (motionState !== 'entering') return;
    cancelMotionTimer();
    setMotionState('visible');
  }

  function beginEnter() {
    cancelMotionTimer();
    if (prefersReducedMotion()) {
      setMotionState('visible');
      return;
    }
    setMotionState('entering');
    motionFallbackTimer = setTimeout(() => settleEnter(), ENTER_FALLBACK_MS);
  }

  function finishExit({ notify = true } = {}) {
    if (motionState === 'hidden') return;
    cancelMotionTimer();
    clearStoredMessage();
    clearRenderedContent();
    status.hidden = true;
    setMotionState('hidden');
    sync(false);
    if (notify) onHide?.();
  }

  function beginExit() {
    if (motionState === 'hidden' || motionState === 'exiting') return;
    cancelMotionTimer();
    if (prefersReducedMotion() || status.hidden) {
      finishExit();
      return;
    }
    setMotionState('exiting');
    motionFallbackTimer = setTimeout(() => finishExit(), EXIT_FALLBACK_MS);
  }

  function handleAnimationFinish(event) {
    if (event.target !== status) return;
    if (motionState === 'entering' && event.animationName === 'toast-in') settleEnter();
    else if (motionState === 'exiting' && event.animationName === 'toast-out') finishExit();
  }
  status.addEventListener('animationend', handleAnimationFinish);
  status.addEventListener('animationcancel', handleAnimationFinish);

  function sync(promote = false, { allowReenter = false } = {}) {
    const visible = !status.hidden;
    const statusHost = isPending() && statusType === 'startup-checking' ? document.body ?? page : page;
    const openDialog = [...page.querySelectorAll('dialog')].filter(dialog => dialog.open).at(-1);
    const actionRowRect = openDialog?.querySelector('.form-actions')?.getBoundingClientRect?.();
    const actionsRect = actionRowRect?.height > 0 ? actionRowRect
      : [...(openDialog?.querySelectorAll('button') ?? [])]
        .map(button => button.getBoundingClientRect?.()).find(rect => rect?.height > 0);
    const viewportHeight = document.documentElement?.clientHeight;
    const bottom = actionsRect && viewportHeight ? Math.max(104, viewportHeight - actionsRect.top + 8) : 104;
    status.style.setProperty('--toast-bottom', `${bottom}px`);
    if (!visible) {
      if (statusPopoverOpen) status.hidePopover();
      statusPopoverOpen = false;
      if (status.parentElement !== statusHost) statusHost.append(status);
      if (!statusPopoverUnsupported && typeof status.showPopover === 'function' && status.getAttribute('popover') !== 'manual') {
        status.setAttribute('popover', 'manual');
      }
      return;
    }

    if (hideForDialog(openDialog, statusType)) {
      if (statusPopoverOpen) status.hidePopover();
      statusPopoverOpen = false;
      cancelMotionTimer();
      if (motionState === 'exiting') {
        clearStoredMessage();
        clearRenderedContent();
      }
      setMotionState('hidden');
      status.hidden = true;
      status.removeAttribute('popover');
      if (status.parentElement !== statusHost) statusHost.append(status);
      return;
    }

    if (openDialog) {
      if (statusPopoverOpen) status.hidePopover();
      statusPopoverOpen = false;
      status.removeAttribute('popover');
      if (status.parentElement !== openDialog) {
        if (!allowReenter) {
          if (motionState === 'entering') settleEnter();
          else if (motionState === 'exiting') { finishExit({ notify: false }); return; }
        }
        openDialog.append(status);
      }
      return;
    }

    if (status.parentElement !== statusHost) {
      const fromDialog = status.parentElement?.tagName?.toLowerCase() === 'dialog';
      if (!allowReenter && fromDialog) {
        if (motionState === 'entering') settleEnter();
        else if (motionState === 'exiting') { finishExit({ notify: false }); return; }
      }
      if (statusPopoverOpen) {
        status.hidePopover();
        statusPopoverOpen = false;
      }
      statusHost.append(status);
    }
    if (statusPopoverUnsupported || typeof status.showPopover !== 'function' || typeof status.hidePopover !== 'function') {
      statusPopoverUnsupported = true;
      status.removeAttribute('popover');
      return;
    }
    if (status.getAttribute('popover') !== 'manual') status.setAttribute('popover', 'manual');
    if (statusPopoverOpen && !promote) return;
    if (statusPopoverOpen && !allowReenter && motionState !== 'visible') return;
    try {
      if (statusPopoverOpen) status.hidePopover();
      status.showPopover();
      statusPopoverOpen = true;
    } catch {
      statusPopoverOpen = false;
      statusPopoverUnsupported = true;
      status.removeAttribute('popover');
    }
  }

  function render(routeLoading, promoteToast) {
    const pending = isPending();
    const activeBeforeInterrupt = pending && statusType !== 'startup-checking' && !suppressPendingStatus;
    if (motionState === 'exiting') {
      if (activeBeforeInterrupt || routeLoading) {
        cancelMotionTimer();
        clearStoredMessage();
      } else {
        sync(false);
        return;
      }
    }

    const startupChecking = statusType === 'startup-checking';
    const assertiveStatus = ['validation-error', 'connection-error', 'resolution-error'].includes(statusType);
    const pendingStatusActive = pending && !startupChecking;
    const active = pendingStatusActive && !suppressPendingStatus;
    const hasStatusMessage = !!statusMessageText || (startupChecking && !!startupMessageText);
    const shouldShow = active || routeLoading || hasStatusMessage;
    status.dataset.pending = String(pendingStatusActive);
    statusMessage.textContent = statusMessageText || (startupChecking ? startupMessageText : '') ||
      (active ? '불러오는 중…' : routeLoading ? '화면을 불러오는 중…' : '');
    const completed = COMPLETED_STATUS_TYPES.has(statusType) && !!statusMessageText;
    const loadingStatus = IN_PROGRESS_STATUS_TYPES.has(statusType) || ((active || routeLoading) && !statusMessageText);
    statusIcon.hidden = !completed && !loadingStatus;
    statusIcon.dataset.state = completed ? 'success' : loadingStatus ? 'saving' : 'idle';
    status.setAttribute('role', assertiveStatus ? 'alert' : 'status');
    status.setAttribute('aria-live', assertiveStatus ? 'assertive' : 'polite');
    status.setAttribute('aria-busy', String(pending || routeLoading));
    if (!shouldShow) {
      cancelMotionTimer();
      status.hidden = true;
      setMotionState('hidden');
      sync(promoteToast);
      return;
    }
    const shouldEnter = motionState === 'hidden' || motionState === 'exiting';
    status.hidden = false;
    if (shouldEnter) beginEnter();
    sync(promoteToast, { allowReenter: shouldEnter });
  }

  function scheduleHide() {
    cancelHide();
    if (isPending() || !COMPLETED_STATUS_TYPES.has(statusType) || !statusMessageText) return;
    statusHideTimer = setTimeout(() => {
      if (isPending() || !COMPLETED_STATUS_TYPES.has(statusType) || !statusMessageText) return;
      if (motionState === 'exiting') return;
      if (motionState === 'hidden') {
        clearStoredMessage();
        onHide?.();
        return;
      }
      beginExit();
    }, STATUS_DISPLAY_MS);
  }
  globalThis.addEventListener?.('resize', () => sync());
  globalThis.visualViewport?.addEventListener('resize', () => sync());
  page.addEventListener('scroll', () => sync(), true);

  function setMessage(value) {
    cancelHide();
    const wasExiting = motionState === 'exiting';
    if (wasExiting) {
      cancelMotionTimer();
      setMotionState('hidden');
    }
    const nextStatusType = value?.type ?? '';
    suppressPendingStatus = false;
    const checking = nextStatusType === 'startup-checking';
    const nextMessage = checking || nextStatusType === 'ready' ? '' : value?.message ?? '';
    const nextStartupMessage = checking ? value?.message ?? '' : '';
    const changed = wasExiting || statusType !== nextStatusType || statusMessageText !== nextMessage || startupMessageText !== nextStartupMessage;
    statusType = nextStatusType;
    statusMessageText = nextMessage;
    startupMessageText = nextStartupMessage;
    status.dataset.state = statusType;
    return changed;
  }

  function clearMessage() {
    cancelHide();
    cancelMotionTimer();
    setMotionState('hidden');
    clearStoredMessage();
    suppressPendingStatus = isPending();
  }

  function cancelHide() {
    clearTimeout(statusHideTimer);
    statusHideTimer = undefined;
  }

  return {
    sync, render, setMessage, clearMessage, cancelHide, scheduleHide,
    get startupChecking() { return statusType === 'startup-checking'; },
    allowPendingMessage() { suppressPendingStatus = false; },
  };
}
