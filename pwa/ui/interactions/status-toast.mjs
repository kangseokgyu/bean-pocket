import { make } from '../shared/dom.mjs';
import { actionIcon } from '../shared/icons.mjs';

const IN_PROGRESS_STATUS_TYPES = new Set(['startup-checking', 'checking', 'saving', 'loading']);
const COMPLETED_STATUS_TYPES = new Set(['saved', 'connected', 'resolved', 'loaded']);
const STATUS_DISPLAY_MS = 1000;

export function createStatusToast(document, page, { isPending, hideForDialog, onHide }) {
  let suppressPendingStatus = false;
  let statusType = '';
  let statusMessageText = '';
  let startupMessageText = '';
  let statusPopoverOpen = false;
  let statusPopoverUnsupported = false;
  let statusHideTimer;

  const status = make(document, 'p', '', 'app-status');
  status.hidden = true;
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

  function sync(promote = false) {
    const visible = !status.hidden;
    const statusHost = isPending() && statusType === 'startup-checking' ? document.body ?? page : page;
    const openDialog = [...page.querySelectorAll('dialog')].find(dialog => dialog.open);
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
      status.hidden = true;
      status.removeAttribute('popover');
      if (status.parentElement !== statusHost) statusHost.append(status);
      return;
    }

    if (openDialog) {
      if (statusPopoverOpen) status.hidePopover();
      statusPopoverOpen = false;
      status.removeAttribute('popover');
      if (status.parentElement !== openDialog) openDialog.append(status);
      return;
    }

    if (status.parentElement !== statusHost) statusHost.append(status);
    if (statusPopoverUnsupported || typeof status.showPopover !== 'function' || typeof status.hidePopover !== 'function') {
      statusPopoverUnsupported = true;
      status.removeAttribute('popover');
      return;
    }
    if (status.getAttribute('popover') !== 'manual') status.setAttribute('popover', 'manual');
    if (statusPopoverOpen && !promote) return;
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
    const startupChecking = statusType === 'startup-checking';
    const assertiveStatus = ['validation-error', 'connection-error', 'resolution-error'].includes(statusType);
    const pendingStatusActive = pending && !startupChecking;
    const active = pendingStatusActive && !suppressPendingStatus;
    const hasStatusMessage = !!statusMessageText || (startupChecking && !!startupMessageText);
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
    status.hidden = !active && !routeLoading && !hasStatusMessage;
    sync(promoteToast);
  }

  function scheduleHide() {
    cancelHide();
    if (isPending() || !COMPLETED_STATUS_TYPES.has(statusType) || !statusMessageText) return;
    statusHideTimer = setTimeout(() => {
      if (isPending()) return;
      statusMessageText = '';
      onHide();
    }, STATUS_DISPLAY_MS);
  }
  globalThis.addEventListener?.('resize', () => sync());
  globalThis.visualViewport?.addEventListener('resize', () => sync());
  page.addEventListener('scroll', () => sync(), true);

  function setMessage(value) {
    const nextStatusType = value?.type ?? '';
    suppressPendingStatus = false;
    const checking = nextStatusType === 'startup-checking';
    const nextMessage = checking || nextStatusType === 'ready' ? '' : value?.message ?? '';
    const nextStartupMessage = checking ? value?.message ?? '' : '';
    const changed = statusType !== nextStatusType || statusMessageText !== nextMessage || startupMessageText !== nextStartupMessage;
    statusType = nextStatusType;
    statusMessageText = nextMessage;
    startupMessageText = nextStartupMessage;
    status.dataset.state = statusType;
    return changed;
  }

  function clearMessage() {
    cancelHide();
    statusType = '';
    statusMessageText = '';
    startupMessageText = '';
    status.dataset.state = '';
    suppressPendingStatus = isPending();
  }

  function cancelHide() {
    clearTimeout(statusHideTimer);
  }

  return {
    sync, render, setMessage, clearMessage, cancelHide, scheduleHide,
    get startupChecking() { return statusType === 'startup-checking'; },
    allowPendingMessage() { suppressPendingStatus = false; },
  };
}
