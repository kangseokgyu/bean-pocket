import { isCurrentRecord } from '../domain.mjs';

const make = (document, tag, text, className) => {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = String(text);
  if (className) node.className = className;
  return node;
};

const label = (document, title, name, type = 'text', required = false, attrs = {}) => {
  const wrap = make(document, 'label', undefined, 'form-field');
  wrap.append(make(document, 'span', title, 'form-field-label'));
  const input = make(document, type === 'textarea' ? 'textarea' : type === 'select' ? 'select' : 'input');
  input.name = name;
  if (type !== 'textarea' && type !== 'select') input.type = type;
  input.required = required;
  for (const [key, value] of Object.entries(attrs)) input[key] = value;
  wrap.append(input);
  return wrap;
};

const button = (document, text, type = 'submit', action) => {
  const node = make(document, 'button', text, 'button');
  node.type = type;
  if (action) node.dataset.action = action;
  return node;
};

const ACTION_ICON_PATHS = Object.freeze({
  save: 'M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2ZM17 21v-8H7v8ZM7 3v5h8',
  x: 'M18 6 6 18M6 6l12 12',
  check: 'M4 12l5 5 11-11',
  trash: 'M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7',
});

function actionIcon(document, name) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', ACTION_ICON_PATHS[name]);
  if (name === 'check') path.setAttribute('pathLength', '1');
  svg.append(path);
  return svg;
}

function decorativeSvg(document, viewBox, className, pathData) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', viewBox);
  svg.setAttribute('class', className);
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  for (const entry of pathData) {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', typeof entry === 'string' ? entry : entry.d);
    if (typeof entry !== 'string' && entry.marker) path.setAttribute(`data-${entry.marker}`, '');
    svg.append(path);
  }
  return svg;
}

function actionButton(document, text, type, icon, action) {
  const node = button(document, '', type, action);
  node.className = `button action-button action-${icon === 'x' ? 'cancel' : 'save'}`;
  const iconNode = make(document, 'span', undefined, 'button-icon');
  iconNode.dataset.icon = icon;
  iconNode.dataset.state = 'idle';
  iconNode.setAttribute('aria-hidden', 'true');
  iconNode.append(actionIcon(document, icon));
  const labelNode = make(document, 'span', text, 'button-label');
  labelNode.dataset.actionLabel = '';
  node.append(iconNode, labelNode);
  node.dataset.state = 'idle';
  node.setAttribute('aria-busy', 'false');
  return node;
}

function setActionButton(buttonNode, text, state, icon = state === 'success' ? 'check' : 'save') {
  const labelNode = buttonNode.querySelector('[data-action-label]');
  if (labelNode) labelNode.textContent = text;
  buttonNode.dataset.state = state;
  buttonNode.setAttribute('aria-busy', String(state === 'saving'));
  const iconNode = buttonNode.querySelector('.button-icon');
  if (!iconNode) return;
  iconNode.dataset.state = state;
  if (iconNode.dataset.icon !== icon) {
    iconNode.dataset.icon = icon;
    iconNode.replaceChildren(actionIcon(buttonNode.ownerDocument, icon));
  }
}

const iconButton = (document, icon, title, action) => {
  const node = button(document, '', 'button', action);
  node.className = 'button icon-button';
  node.setAttribute('aria-label', title);
  node.title = title;
  const glyph = make(document, 'span', icon);
  glyph.setAttribute('aria-hidden', 'true');
  node.append(glyph);
  return node;
};

function trashButton(document, kind, id, name) {
  const action = { beans: 'delete-bean', recipes: 'delete-recipe', records: 'delete-record' }[kind];
  const remove = iconButton(document, '', `${name} 삭제`, action);
  remove.className += ' entity-delete';
  remove.dataset.id = id;
  remove.dataset.name = name;
  const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  icon.setAttribute('viewBox', '0 0 24 24');
  icon.setAttribute('aria-hidden', 'true');
  icon.setAttribute('focusable', 'false');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', 'M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7');
  icon.append(path);
  remove.replaceChildren(icon);
  return remove;
}

function recordName(record, recipe, snapshotRecipe) {
  return `${record.date || '추출 기록'} · ${recipe?.name || snapshotRecipe?.name || '추출 기록'}`;
}

const showNativeDialog = dialog => {
  if (typeof dialog.showModal === 'function') dialog.showModal();
  else dialog.open = true;
};

const makeSpinner = document => {
  const spinner = make(document, 'span', undefined, 'pull-refresh-spinner');
  spinner.setAttribute('aria-hidden', 'true');
  for (let index = 0; index < 12; index++) {
    const spoke = make(document, 'span', undefined, 'pull-refresh-spoke');
    spoke.setAttribute('style', `transform: rotate(${index * 30}deg); opacity: ${(index + 1) / 12}`);
    spinner.append(spoke);
  }
  return spinner;
};

const idOf = value => String(value ?? '');
const FORM_KINDS = new Set(['beans', 'recipes', 'records']);
const IN_PROGRESS_STATUS_TYPES = new Set(['startup-checking', 'checking', 'saving', 'loading']);
const COMPLETED_STATUS_TYPES = new Set(['saved', 'connected', 'resolved', 'loaded']);
const STATUS_DISPLAY_MS = 1000;
const SOURCE_FIELDS = Object.freeze([
  ['beans', '원두'], ['recipes', '레시피'],
  ['steps', '레시피 단계'], ['records', '추출 기록'],
]);

function routePath(route) {
  const path = String(route ?? '/home').split('?', 1)[0];
  return path || '/home';
}

function routeParams(route) {
  return new URLSearchParams(String(route ?? '').split('?').slice(1).join('?'));
}

function normalizeRoute(route) {
  const value = typeof route === 'string' ? route.trim() : '';
  const [rawPath, ...queryParts] = value.split('?');
  const path = rawPath || '/home';
  if (!path.startsWith('/') || path === '/') return '/home';
  const normalizedPath = path.length > 1 ? path.replace(/\/+$/, '') : path;
  const query = queryParts.join('?');
  return query ? `${normalizedPath}?${query}` : normalizedPath;
}

export function createAppView(document = globalThis.document, { schedule = setTimeout, cancelSchedule = clearTimeout } = {}) {
  const root = document.querySelector('#app-root');
  if (!root) throw new Error('앱 화면을 만들 수 없습니다.');
  const page = make(document, 'div', undefined, 'app-content');
  root.replaceChildren(page);

  let currentState = { frozen: false, pending: false, unresolved: false };
  let routeReadStatus = 'idle';
  let suppressPendingStatus = false;
  let statusType = '';
  let statusMessageText = '';
  let startupMessageText = '';
  let statusPopoverOpen = false;
  let statusPopoverUnsupported = false;
  function syncStatusToast(promote = false) {
    const visible = !status.hidden;
    const statusHost = currentState.pending && statusType === 'startup-checking' ? document.body ?? page : page;
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

    const entrySubmit = activeEntryKind ? entryDialogFor(activeEntryKind)?.querySelector('[data-entry-submit]') : null;
    const deleteIcon = confirmDeleteButton.querySelector('.button-icon');
    const modalHasInlineProgress = currentState.pending && statusType === 'saving' && (
      (openDialog === deleteDialog && deleteRequestPending && deleteIcon?.dataset.state === 'saving') ||
      (openDialog === entryDialogFor(activeEntryKind) && entrySubmit?.dataset.state === 'saving')
    );
    if ((openDialog === deleteDialog && !currentState.pending) || modalHasInlineProgress) {
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
  function renderStatus({ promoteToast = false } = {}) {
    const startupChecking = statusType === 'startup-checking';
    const assertiveStatus = ['validation-error', 'connection-error', 'resolution-error'].includes(statusType);
    const initialSkeletonHidden = !currentState.pending || !!currentData ||
      (!startupChecking && connection.dataset.connected !== 'true');
    skeletons.hidden = routeReadStatus === 'loading' ? false : routeReadStatus === 'idle' ? initialSkeletonHidden : true;
    const routeLoading = routeReadStatus === 'loading';
    const pendingStatusActive = currentState.pending && !startupChecking;
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
    status.setAttribute('aria-busy', String(currentState.pending || routeLoading));
    status.hidden = !active && !routeLoading && !hasStatusMessage;
    syncStatusToast(promoteToast);

    loadingSurface.inert = currentState.pending && startupChecking;
  }
  function scheduleStatusHide() {
    clearTimeout(statusHideTimer);
    if (currentState.pending || IN_PROGRESS_STATUS_TYPES.has(statusType) || !statusMessageText) return;
    statusHideTimer = setTimeout(() => {
      if (currentState.pending) return;
      statusMessageText = '';
      renderStatus();
    }, STATUS_DISPLAY_MS);
  }
  globalThis.addEventListener?.('resize', () => syncStatusToast());
  globalThis.visualViewport?.addEventListener('resize', () => syncStatusToast());
  page.addEventListener('scroll', () => syncStatusToast(), true);
  let currentData = null;
  let route = normalizeRoute(globalThis.location?.hash?.slice(1) || '/home');
  let routeNeedsDataRender = true;
  const routeHiddenChildren = new Set();
  let routeChangeListener = null;
  const drafts = new Map();
  const optionPages = new Map();
  const optionStates = new Map();
  let beanFormOpen = false;
  let recipeFormOpen = routePath(route) === '/recipes/new';
  let recordFormOpen = routePath(route) === '/records/new';
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

  const loadingSurface = document.querySelector('.page') ?? page;
  function finishStartup() {
    if (currentState.pending) return;
    loadingSurface.inert = false;
  }

  const connection = make(document, 'dialog', undefined, 'entry-dialog connection-panel');
  connection.id = 'connection-settings';
  connection.hidden = true;
  connection.setAttribute('aria-modal', 'true');
  connection.setAttribute('aria-labelledby', 'connection-settings-title');
  const connectionTitle = make(document, 'h2', 'Notion 연결 설정');
  connectionTitle.id = 'connection-settings-title';
  connection.append(connectionTitle);
  let connectionPhase = 'idle';
  let connectionAvailable = false;
  let connectionTimer = null;
  let connectionFocusPending = false;
  const connectionToggle = iconButton(document, '⚙', 'Notion 연결 설정', 'toggle-connection');
  connectionToggle.className = 'button icon-button connection-toggle';
  connectionToggle.setAttribute('aria-controls', connection.id);
  connectionToggle.setAttribute('aria-expanded', 'false');
  connectionToggle.disabled = true;
  (document.querySelector('#connection-tools') ?? page).append(connectionToggle);
  function showConnectionPanel(visible) {
    connection.hidden = !visible;
    connectionToggle.setAttribute('aria-expanded', String(visible));
    if (!visible) {
      if (connection.open) {
        if (typeof connection.close === 'function') connection.close();
        else connection.open = false;
      }
      return;
    }
    if (!connection.open) {
      showNativeDialog(connection);
      syncStatusToast();
      const focus = !startupRetry.hidden ? startupRetry.querySelector('button')
        : !repair.hidden ? originalConnectionCheck.querySelector('input')
          : connectionForm.elements.token;
      focus?.focus?.();
    }
  }
  connectionToggle.addEventListener('click', () => {
    if (connectionToggle.disabled) return;
    if (connection.open) view.cancelConnection();
    else showConnectionPanel(true);
  });
  connection.addEventListener('cancel', event => {
    event.preventDefault();
    view.cancelConnection();
  });
  const connectionDetails = make(document, 'section', undefined, 'connection-details');
  const connectionForm = make(document, 'form', undefined, 'form-grid');
  connectionForm.dataset.form = 'connection';
  connectionForm.append(label(document, '통합 토큰', 'token', 'password', true, { autocomplete: 'off' }));
  for (const [key, title] of SOURCE_FIELDS) {
    connectionForm.append(label(document, title + ' 데이터 소스 ID', key, 'text', true,
      { autocomplete: 'off', spellcheck: false, autocapitalize: 'off' }));
  }
  const connectionActions = make(document, 'div', undefined, 'form-actions');
  const connectionCancel = actionButton(document, '취소', 'button', 'x', 'cancel-connection');
  const connectionSubmit = actionButton(document, '연결 확인 및 저장', 'submit', 'save');
  connectionActions.append(connectionCancel, connectionSubmit);
  connectionForm.append(connectionActions);
  connectionDetails.append(make(document, 'p', '연결 정보는 이 기기의 앱 저장소에 보관됩니다.', 'muted-note'));
  connectionDetails.append(connectionForm);

  function resetConnectionForm() {
    connectionForm.querySelectorAll('input,select,textarea').forEach(field => { field.value = ''; });
  }

  function syncConnectionState() {
    const busy = connectionPhase === 'checking';
    const succeeded = connectionPhase === 'success';
    connection.dataset.saveState = connectionPhase;
    connection.setAttribute('aria-busy', String(busy));
    connectionToggle.disabled = !connectionAvailable || currentState.pending || currentState.frozen || busy || succeeded;
    if (connectionFocusPending && !connectionToggle.disabled && !connection.open) {
      connectionFocusPending = false;
      connectionToggle.focus?.();
    }
    connection.querySelectorAll('input,button,select,textarea').forEach(control => {
      const blockedForm = control.closest('form') === connectionForm && currentState.unresolved && control.dataset.action !== 'cancel-connection';
      control.disabled = currentState.pending || currentState.frozen || busy || succeeded || blockedForm;
    });
    setActionButton(connectionSubmit,
      succeeded ? '연결 저장 완료' : busy ? '연결 확인·저장 중…' : '연결 확인 및 저장',
      succeeded ? 'success' : busy ? 'saving' : 'idle');
  }

  const startupRetry = make(document, 'section', undefined, 'startup-retry-panel');
  startupRetry.hidden = true;
  startupRetry.append(make(document, 'h2', '저장된 연결을 확인하지 못했습니다'));
  startupRetry.append(make(document, 'p', '저장소·네트워크·Notion 권한을 확인해 주세요. 다른 창이 저장소를 사용 중이면 잠시 기다린 뒤, 연결 정보를 입력하지 말고 다시 시도해 주세요.'));
  startupRetry.append(button(document, '저장된 연결 다시 읽기', 'button', 'retry-initialize'));
  const editConnection = button(document, '연결 설정 수정', 'button', 'edit-connection');
  editConnection.hidden = true;
  startupRetry.append(editConnection);
  startupRetry.append(button(document, '닫기', 'button', 'cancel-connection'));
  connection.append(startupRetry);

  const repair = make(document, 'section', undefined, 'repair-panel');
  repair.hidden = true;
  repair.append(make(document, 'h2', '연결 저장 확인'));
  repair.append(make(document, 'p', '원본 연결 파일을 직접 확인한 뒤에만 복구할 수 있습니다. 확인이 끝나면 아래 항목을 선택해 주세요.'));
  const originalConnectionCheck = label(document, '원본 연결 파일의 현재 내용을 직접 확인했습니다.', 'originalConfirmed', 'checkbox', true);
  repair.append(originalConnectionCheck);
  repair.append(button(document, '현재 연결을 다시 검증', 'button', 'confirm-connection'));
  connection.append(repair, connectionDetails);
  page.append(connection);

  const nav = make(document, 'nav', undefined, 'tabs');
  nav.setAttribute('aria-label', '커피 기록 메뉴');
  for (const [key, title] of [
    ['home', '홈'], ['beans', '원두'], ['recipes', '레시피'], ['records', '추출 기록'],
  ]) {
    const item = button(document, '', 'button', 'navigate');
    item.setAttribute('aria-label', title);
    item.title = title;
    item.append(make(document, 'span', title, 'nav-label'));
    item.dataset.route = `/${key}`;
    nav.append(item);
  }
  const header = document.querySelector('.site-header');
  const headerTools = header?.querySelector('.header-tools');
  if (headerTools) header.insertBefore(nav, headerTools);
  else (header ?? page).append(nav);

  function applyViewState() {
    applyState(page, currentState);
    applyState(nav, currentState);
    syncEntryDialogState();
    syncConnectionState();
    syncDeleteDialogState();
  }

  const unresolved = make(document, 'section', undefined, 'unresolved-panel');
  unresolved.hidden = true;
  unresolved.dataset.count = '0';
  unresolved.setAttribute('aria-labelledby', 'unresolved-title');
  unresolved.append(make(document, 'h2', '확인 대기 중인 저장', 'unresolved-title'));
  page.append(unresolved);

  const skeletons = make(document, 'div', undefined, 'card-skeletons');
  skeletons.hidden = true;
  skeletons.setAttribute('aria-hidden', 'true');
  const skeletonHeader = make(document, 'div', undefined, 'list-header');
  skeletonHeader.append(make(document, 'span', undefined, 'skeleton-line skeleton-heading'));
  skeletons.append(skeletonHeader);
  for (let index = 0; index < 3; index++) {
    const card = make(document, 'div', undefined, 'skeleton-card');
    for (const shape of ['title', 'metadata', 'metadata', 'action']) {
      card.append(make(document, 'span', undefined, `skeleton-line skeleton-${shape}`));
    }
    skeletons.append(card);
  }
  page.append(skeletons);

  const content = make(document, 'section', undefined, 'data-panel');
  content.setAttribute('aria-label', '커피 기록');
  page.append(content);
  let entryActions = null;
  let activeEntryKind = null;
  let entryPhase = 'idle';
  let entryTimer = null;

  const deleteDialog = make(document, 'dialog', undefined, 'entry-dialog delete-confirm-dialog');
  deleteDialog.id = 'delete-confirm-dialog';
  deleteDialog.setAttribute('role', 'dialog');
  deleteDialog.setAttribute('aria-modal', 'true');
  deleteDialog.setAttribute('aria-labelledby', 'delete-confirm-title');
  deleteDialog.setAttribute('aria-describedby', 'delete-confirm-description');
  deleteDialog.setAttribute('aria-busy', 'false');
  const deleteHeading = make(document, 'div', undefined, 'delete-confirm-heading');
  const deleteSymbol = make(document, 'span', undefined, 'delete-confirm-symbol');
  deleteSymbol.setAttribute('aria-hidden', 'true');
  deleteSymbol.append(actionIcon(document, 'trash'));
  const deleteTitle = make(document, 'h2', '항목을 삭제할까요?');
  deleteTitle.id = 'delete-confirm-title';
  deleteHeading.append(deleteSymbol, deleteTitle);
  const deleteTarget = make(document, 'p', '', 'delete-confirm-target');
  const deleteDescription = make(document, 'p', '', 'delete-confirm-description');
  deleteDescription.id = 'delete-confirm-description';
  const deleteFeedback = make(document, 'p', '', 'delete-confirm-feedback');
  deleteFeedback.setAttribute('role', 'status');
  deleteFeedback.setAttribute('aria-live', 'polite');
  deleteFeedback.hidden = true;
  const deleteActions = make(document, 'div', undefined, 'form-actions delete-confirm-actions');
  deleteActions.setAttribute('role', 'group');
  deleteActions.setAttribute('aria-label', '삭제 확인');
  const cancelDeleteButton = actionButton(document, '취소', 'button', 'x', 'cancel-delete');
  const confirmDeleteButton = actionButton(document, '삭제', 'button', 'trash', 'confirm-delete');
  confirmDeleteButton.className = 'button action-button action-delete';
  deleteActions.append(cancelDeleteButton, confirmDeleteButton);
  deleteDialog.append(deleteHeading, deleteTarget, deleteDescription, deleteFeedback, deleteActions);
  page.append(deleteDialog);
  page.tabIndex = -1;
  let activeDelete = null;
  let deleteRequestPending = false;
  let deleteCloseTimer = null;

  function entryDialogFor(kind) {
    return content.querySelector(`dialog[data-entry-dialog="${kind}"]`);
  }
  function bindEntryDialogCancels() {
    for (const dialog of content.querySelectorAll('dialog[data-entry-dialog]')) {
      if (dialog.dataset.cancelBound) continue;
      dialog.dataset.cancelBound = 'true';
      dialog.addEventListener('cancel', event => {
        event.preventDefault();
        const kind = dialog.dataset.entryDialog;
        if (currentState.pending || currentState.frozen || currentState.unresolved || entryPhase === 'success') return;
        view.clearDraft(kind);
        entryActions?.setDirty(false, kind);
        view.showStatus({ type: 'cancelled', message: '입력을 취소했습니다.' });
      });
    }
  }
  function syncEntryDialogState() {
    for (const dialog of content.querySelectorAll('dialog[data-entry-dialog]')) {
      const active = dialog.dataset.entryDialog === activeEntryKind;
      const phase = active ? entryPhase : 'idle';
      const saving = active && currentState.pending && phase !== 'success';
      dialog.dataset.saveState = phase;
      dialog.setAttribute('aria-busy', String(saving));
      if (phase === 'success') {
        dialog.querySelectorAll('input,button,select,textarea').forEach(control => { control.disabled = true; });
      }
      const submit = dialog.querySelector('[data-entry-submit]');
      const cancel = dialog.querySelector('[data-action="cancel-form"]');
      if (submit) {
        submit.disabled = currentState.pending || currentState.frozen || currentState.unresolved || phase === 'success';
        setActionButton(submit, phase === 'success' ? '저장 완료' : saving ? '저장 중…' : submit.dataset.idleLabel || '저장',
          phase === 'success' ? 'success' : saving ? 'saving' : 'idle');
      }
      if (cancel) {
        cancel.disabled = currentState.pending || currentState.frozen || phase === 'success';
        setActionButton(cancel, '취소', 'idle', 'x');
      }
    }
  }
  function finishContentRender() {
    for (const dialog of content.querySelectorAll('dialog[data-entry-dialog]')) {
      if (dialog.dataset.open === 'true' && !dialog.open) {
        showNativeDialog(dialog);
        activeEntryKind = dialog.dataset.entryDialog;
        renderStatus({ promoteToast: true });
      }
    }
    bindEntryDialogCancels();
    syncStatusToast();
  }
  function renderCurrentContent() {
    renderPane(content, currentData, document, route, drafts, optionPages,
      beanFormOpen, recipeFormOpen, recordFormOpen, optionStates);
    finishContentRender();
    applyViewState();
  }
  function restoreEntryFocus(kind) {
    const action = { beans: 'show-bean-form', recipes: 'show-recipe-form', records: 'show-record-form' }[kind];
    (content.querySelector(`[data-action="${action}"]`) ?? nav.querySelector('[data-route="/beans"]'))?.focus?.();
  }

  function syncDeleteDialogState() {
    if (!deleteDialog.open || !activeDelete) return;
    if (deleteRequestPending) {
      cancelDeleteButton.disabled = true;
      confirmDeleteButton.disabled = true;
      return;
    }
    const resultIsFinal = ['succeeded', 'unknown', 'partial'].includes(activeDelete.resultStatus);
    confirmDeleteButton.disabled = currentState.pending || currentState.frozen || currentState.unresolved || resultIsFinal;
    cancelDeleteButton.disabled = currentState.pending || currentState.frozen;
  }

  function closeDeleteDialog() {
    if (!activeDelete || deleteRequestPending) return false;
    if (deleteCloseTimer !== null) {
      cancelSchedule(deleteCloseTimer);
      deleteCloseTimer = null;
    }
    const cancelledBeforeRequest = activeDelete.resultStatus === null;
    const trigger = activeDelete.trigger;
    activeDelete = null;
    if (deleteDialog.open && typeof deleteDialog.close === 'function') deleteDialog.close();
    else deleteDialog.open = false;
    deleteDialog.setAttribute('aria-busy', 'false');
    renderStatus();
    if (trigger?.parentElement && trigger.isConnected !== false) trigger.focus?.();
    else (content.querySelector('.entity-delete') ?? page).focus?.();
    return cancelledBeforeRequest ? 'cancelled' : 'dismissed';
  }

  function openDeleteDialog(trigger, action) {
    if (!trigger || deleteDialog.open || currentState.pending || currentState.frozen || currentState.unresolved) return false;
    const nouns = { 'delete-bean': '원두를', 'delete-recipe': '레시피를', 'delete-record': '추출 기록을' };
    const descriptions = {
      'delete-bean': '삭제한 원두는 Notion 휴지통으로 이동합니다. 연결된 추출 기록이 있으면 삭제할 수 없습니다.',
      'delete-recipe': '삭제한 레시피는 Notion 휴지통으로 이동합니다. 추출 기록에서 사용 중인 레시피는 먼저 해당 추출 기록을 삭제해야 합니다.',
      'delete-record': '해당 추출 기록만 Notion 휴지통으로 이동합니다.',
    };
    const noun = nouns[action];
    if (!noun) return false;
    activeDelete = { action, id: trigger.dataset.id, trigger, resultReported: false, resultStatus: null };
    deleteTitle.textContent = `${noun} 삭제할까요?`;
    deleteTarget.textContent = trigger.dataset.name ?? '';
    deleteDescription.textContent = descriptions[action];
    deleteFeedback.textContent = '';
    deleteFeedback.hidden = true;
    deleteFeedback.dataset.state = '';
    deleteDialog.setAttribute('aria-busy', 'false');
    cancelDeleteButton.disabled = false;
    confirmDeleteButton.disabled = false;
    setActionButton(cancelDeleteButton, '취소', 'idle', 'x');
    setActionButton(confirmDeleteButton, '삭제', 'idle', 'trash');
    showNativeDialog(deleteDialog);
    syncStatusToast();
    cancelDeleteButton.focus?.();
    return true;
  }

  function showDeleteResult(result = {}) {
    if (!activeDelete || !deleteDialog.open) return false;
    activeDelete.resultReported = true;
    activeDelete.resultStatus = result.status ?? 'failed';
    deleteRequestPending = false;
    deleteDialog.setAttribute('aria-busy', 'false');
    deleteFeedback.hidden = false;
    deleteFeedback.textContent = result.message ?? (result.status === 'succeeded'
      ? '삭제했습니다.' : '삭제하지 못했습니다. 목록을 새로고침해 주세요.');
    deleteFeedback.dataset.state = result.status === 'succeeded' ? 'success'
      : ['unknown', 'partial'].includes(result.status) ? 'uncertain' : 'error';

    if (result.status === 'succeeded') {
      setActionButton(confirmDeleteButton, '삭제 완료', 'success', 'check');
      confirmDeleteButton.disabled = true;
      cancelDeleteButton.disabled = false;
      setActionButton(cancelDeleteButton, '닫기', 'idle', 'x');
      const request = activeDelete;
      deleteCloseTimer = schedule(() => {
        deleteCloseTimer = null;
        if (activeDelete === request) closeDeleteDialog();
      }, 900);
    } else if (['unknown', 'partial'].includes(result.status)) {
      setActionButton(confirmDeleteButton, '확인 필요', 'idle', 'trash');
      confirmDeleteButton.disabled = true;
      cancelDeleteButton.disabled = false;
      setActionButton(cancelDeleteButton, '닫기', 'idle', 'x');
      cancelDeleteButton.focus?.();
    } else {
      setActionButton(confirmDeleteButton, '삭제', 'idle', 'trash');
      confirmDeleteButton.disabled = false;
      cancelDeleteButton.disabled = false;
      setActionButton(cancelDeleteButton, '취소', 'idle', 'x');
      confirmDeleteButton.focus?.();
    }
    syncDeleteDialogState();
    syncStatusToast();
    return true;
  }

  async function submitDelete() {
    if (!activeDelete || deleteRequestPending) return;
    const state = entryActions?.getState?.() ?? currentState;
    if (state.pending || state.frozen || state.unresolved) return;
    const request = activeDelete;
    request.resultReported = false;
    request.resultStatus = 'pending';
    deleteRequestPending = true;
    deleteDialog.setAttribute('aria-busy', 'true');
    deleteFeedback.textContent = '';
    deleteFeedback.hidden = true;
    confirmDeleteButton.disabled = true;
    cancelDeleteButton.disabled = true;
    setActionButton(confirmDeleteButton, '삭제 중…', 'saving', 'trash');
    try {
      const result = await entryActions.submit(request.action, { id: request.id });
      if (!request.resultReported) {
        const status = result?.status ?? 'failed';
        const message = result?.message ?? (status === 'succeeded' ? '삭제했습니다.'
          : status === 'unknown' ? '삭제 여부 확인이 필요합니다. 다시 삭제하지 말고 Notion 원본을 확인해 주세요.'
            : status === 'partial' ? '일부 항목의 삭제 결과를 확인해야 합니다. Notion 원본을 확인해 주세요.'
              : '삭제하지 못했습니다. 목록을 새로고침해 주세요.');
        showDeleteResult({ status, message });
      }
    } catch {
      if (!request.resultReported) {
        showDeleteResult({ status: 'failed', message: '삭제하지 못했습니다. 연결과 목록을 확인해 주세요.' });
      }
    }
  }

  deleteDialog.addEventListener('cancel', event => {
    event.preventDefault();
    if (deleteRequestPending) return;
    if (closeDeleteDialog() === 'cancelled') view.showStatus({ type: 'cancelled', message: '삭제를 취소했습니다.' });
  });

  function openEntryForm(kind, action, fieldName) {
    const form = content.querySelector('form[data-form="' + kind + '"]');
    const dialog = entryDialogFor(kind);
    if (!form || !dialog || currentState.pending || currentState.frozen || currentState.unresolved) return;
    if (kind === 'beans') beanFormOpen = true;
    if (kind === 'recipes') recipeFormOpen = true;
    if (kind === 'records') recordFormOpen = true;
    activeEntryKind = kind;
    entryPhase = 'idle';
    const opener = content.querySelector('[data-action="' + action + '"]');
    dialog.dataset.open = 'true';
    if (!dialog.open) showNativeDialog(dialog);
    renderStatus({ promoteToast: true });
    opener?.setAttribute('aria-expanded', 'true');
    form.elements[fieldName]?.focus?.();
    syncEntryDialogState();
  }

  const view = {
    finishStartup,
    showStatus(value) {
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
      renderStatus({ promoteToast: changed });
      scheduleStatusHide();
    },
    clearStatus() {
      clearTimeout(statusHideTimer);
      statusType = '';
      statusMessageText = '';
      startupMessageText = '';
      status.dataset.state = '';
      suppressPendingStatus = currentState.pending;
      renderStatus();
    },
    showDeleteResult,
    showConnection(value) {
      const connected = !!value?.connected;
      const retryInitialization = !!value?.retryInitialization;
      const checkingInitialization = !!value?.checkingInitialization;
      connection.dataset.connected = connected ? 'true' : 'false';
      connectionAvailable = !checkingInitialization;
      connectionDetails.hidden = retryInitialization || checkingInitialization || !!value?.needsRecovery;
      startupRetry.hidden = !retryInitialization;
      editConnection.hidden = !retryInitialization || !value?.canEditConnection;
      repair.hidden = !value?.needsRecovery;
      nav.hidden = !connected;
      unresolved.hidden = !connected || unresolved.dataset.count === '0';
      content.hidden = !connected;
      const keepFeedback = connection.open && (currentState.pending || connectionPhase !== 'idle');
      showConnectionPanel(!checkingInitialization && (!connected || !!value?.needsRecovery || retryInitialization || keepFeedback));
      syncConnectionState();
      renderStatus();
    },
    clearSecret() { connectionForm.elements.token.value = ''; },
    beginConnectionSave() {
      if (currentState.pending || currentState.frozen || currentState.unresolved || connectionPhase !== 'idle') return false;
      connectionPhase = 'checking';
      syncConnectionState();
      return true;
    },
    finishConnectionSave() {
      if (connectionPhase === 'checking') connectionPhase = 'idle';
      syncConnectionState();
    },
    editConnection() {
      if (editConnection.hidden || currentState.pending || currentState.frozen) return false;
      startupRetry.hidden = true;
      connectionDetails.hidden = false;
      connectionForm.elements.token.focus?.();
      return true;
    },
    cancelConnection() {
      if (currentState.pending || currentState.frozen || connectionPhase !== 'idle') return false;
      resetConnectionForm();
      originalConnectionCheck.querySelector('input').checked = false;
      showConnectionPanel(false);
      entryActions?.setDirty?.(false, 'connection');
      syncConnectionState();
      renderStatus();
      connectionToggle.focus?.();
      return true;
    },
    showConnectionSuccess() {
      if (!connection.open) return false;
      connectionForm.elements.token.value = '';
      connectionPhase = 'success';
      syncConnectionState();
      if (connectionTimer !== null) cancelSchedule(connectionTimer);
      connectionTimer = schedule(() => {
        connectionTimer = null;
        resetConnectionForm();
        originalConnectionCheck.querySelector('input').checked = false;
        connectionPhase = 'idle';
        showConnectionPanel(false);
        connectionFocusPending = true;
        syncConnectionState();
        renderStatus();
      }, 1000);
      return true;
    },
    setState(value) {
      const wasPending = currentState.pending;
      currentState = {
        frozen: !!value.frozen,
        pending: !!value.pending,
        unresolved: !!value.unresolved,
      };
      if (!currentState.pending) suppressPendingStatus = false;
      if (currentState.pending && activeEntryKind && entryPhase !== 'success') entryPhase = 'saving';
      else if (!currentState.pending && entryPhase === 'saving') entryPhase = 'idle';
      renderStatus();
      applyViewState();
      if (currentState.pending) clearTimeout(statusHideTimer);
      else if (wasPending) scheduleStatusHide();
    },
    setFrozen(value) {
      currentState.frozen = !!value;
      page.dataset.frozen = value ? 'true' : 'false';
      applyViewState();
    },
    clearForm(kind) {
      drafts.delete(kind);
      const form = content.querySelector(`form[data-form="${kind}"]`);
      form?.reset();
    },
    clearDraft(kind) {
      drafts.delete(kind);
      const wasOpen = activeEntryKind === kind;
      if (entryDialogFor(kind)?.open) entryDialogFor(kind).close();
      if (kind === 'beans') beanFormOpen = false;
      if (kind === 'recipes') recipeFormOpen = false;
      if (kind === 'records') recordFormOpen = false;
      if (wasOpen) activeEntryKind = null;
      if (currentData) renderCurrentContent();
      if (wasOpen) {
        entryPhase = 'idle';
        renderStatus({ promoteToast: true });
        restoreEntryFocus(kind);
      }
    },
    setRouteReadState(nextStatus) {
      if (!['loading', 'ready', 'error', 'cancelled'].includes(nextStatus)) return;
      routeReadStatus = nextStatus;
      const pane = content.querySelector('.list-view');
      const activeDialog = Array.from(content.querySelectorAll('dialog[data-entry-dialog]')).find(dialog => dialog.open);

      if (nextStatus === 'loading') {
        content.setAttribute('aria-busy', 'true');
        if (activeDialog && pane) {
          content.hidden = false;
          for (const child of pane.children) {
            if (child !== activeDialog && !child.hidden) {
              routeHiddenChildren.add(child);
              child.hidden = true;
            }
          }
        } else content.hidden = true;
      } else {
        content.hidden = false;
        content.removeAttribute('aria-busy');
        for (const child of routeHiddenChildren) child.hidden = false;
        routeHiddenChildren.clear();
        if (nextStatus === 'error' || nextStatus === 'cancelled') {
          const message = make(document, 'p', nextStatus === 'cancelled'
            ? '목록 조회가 취소되었습니다.' : '목록을 불러오지 못했습니다. 연결과 권한을 확인해 주세요.', 'route-read-error');
          if (activeDialog && pane) {
            for (const child of [...pane.children]) {
              if (child !== activeDialog) child.remove();
            }
            pane.append(message);
          } else content.replaceChildren(message);
        }
      }
      renderStatus();
    },
    renderData(nextData) {
      saveActiveDraft(content, drafts);
      currentData = nextData;
      skeletons.hidden = true;
      const routeNeedsRender = routeNeedsDataRender;
      routeNeedsDataRender = false;
      const activeDialog = activeEntryKind ? entryDialogFor(activeEntryKind) : null;
      if (activeDialog?.open) {
        if (routeNeedsRender && activeEntryKind === 'records' && currentData.screen?.error &&
            currentData.screen.route === route) {
          activeDialog.close();
          renderCurrentContent();
          return;
        }
        if (routeNeedsRender) {
          // Refresh the list around the live top-layer dialog without detaching it.
          const refreshed = make(document, 'section');
          renderPane(refreshed, currentData, document, route, new Map(), optionPages,
            beanFormOpen, recipeFormOpen, recordFormOpen, optionStates);
          if (activeEntryKind === 'records') {
            hydrateRecordPickers(activeDialog.querySelector('form'),
              refreshed.querySelector('form[data-form="records"]'), currentData, optionPages, optionStates, document);
          }
          const pane = activeDialog.parentElement;
          for (const child of [...pane.children]) {
            if (child !== activeDialog) child.remove();
          }
          for (const child of [...refreshed.querySelector('.list-view').children]) {
            if (child.dataset.entryDialog === activeEntryKind) continue;
            pane.insertBefore(child, activeDialog);
          }
          finishContentRender();
          applyViewState();
        }
        return;
      }
      renderCurrentContent();
    },
    currentRoute() { return route; },
    onRouteChange(handler) { routeChangeListener = typeof handler === 'function' ? handler : null; },
    renderRoute(nextRoute) {
      const next = normalizeRoute(nextRoute || '/home');
      if (next !== route) routeNeedsDataRender = true;
      route = next;
      if (routePath(route) === '/recipes/new') recipeFormOpen = true;
      if (routePath(route) === '/records/new') recordFormOpen = true;
      if (currentData) {
        saveActiveDraft(content, drafts);
        renderCurrentContent();
      }
      routeChangeListener?.(route);
    },
    resolveRecordDraft(startNew = false) {
      const previousRoute = drafts.get('records')?.route ?? '/records';
      if (startNew) {
        drafts.delete('records');
        renderCurrentContent();
      }
      return previousRoute;
    },
    showBeanForm() { openEntryForm('beans', 'show-bean-form', 'name'); },
    showRecipeForm() { openEntryForm('recipes', 'show-recipe-form', 'name'); },
    showRecordForm() { openEntryForm('records', 'show-record-form', 'date'); },
    setSearchOptions(target, kind, page, append = false, query = '') {
      const optionKey = `${target}:${kind}`;
      const cachedPage = optionPages.get(optionKey);
      let previousPage = cachedPage;
      if (target === 'brew') {
        const sameScope = cachedPage?.scope === brewOptionScope(route, kind);
        previousPage = sameScope && cachedPage?.query === query ? cachedPage : null;
        if (!previousPage && query === (routeParams(route).get('q') ?? '')) {
          previousPage = { items: currentData?.[kind] ?? [] };
        }
      } else if (!previousPage && query === '') {
        const initialPage = target === 'form'
          ? currentData?.options?.[kind]
          : currentData?.options?.[kind === 'beans' ? 'filterBeans' : 'filterRecipes'];
        previousPage = initialPage ?? null;
      }
      const keepPreviousPage = append && (target === 'brew' || previousPage && (previousPage.query ?? '') === query);
      const seen = new Set();
      const optionItems = [...(keepPreviousPage ? previousPage?.items ?? [] : []), ...(page.items ?? [])]
        .filter(item => {
          if (seen.has(item.id)) return false;
          seen.add(item.id);
          return true;
        });
      if (target === 'brew') {
        optionPages.set(optionKey, { ...page, items: optionItems, query, scope: brewOptionScope(route, kind), savedAt: Date.now() });
        if (currentData) renderCurrentContent();
        return;
      }
      const select = Array.from(content.querySelectorAll('[data-option-select-kind]'))
        .find(item => item.dataset.optionTarget === target && item.dataset.optionSelectKind === kind);
      if (!select) return;
      const filterKey = kind === 'beans' ? 'beanId' : 'recipeId';
      const previousValue = select.value || (target === 'filters' ? currentData?.screen?.filters?.[filterKey] : '');
      const previousOption = Array.from(select.options).find(option => option.value === previousValue);
      const placeholder = select.options[0]?.textContent ?? (kind === 'beans' ? '원두를 선택해 주세요.' : '레시피를 선택해 주세요.');
      const optional = target === 'filters';
      const selectedItem = previousValue && previousOption && !optionItems.some(item => idOf(item.id) === previousValue)
        ? { id: previousValue, name: previousOption.textContent, status: 'ready' }
        : null;
      optionPages.set(optionKey, { ...page, items: optionItems, selectedItem, query, savedAt: Date.now() });
      optionStates.set(optionKey, { status: 'ready', query, append: false });
      if (keepPreviousPage) {
        const known = new Set(Array.from(select.options, option => option.value));
        for (const item of page.items ?? []) {
          if (known.has(idOf(item.id))) continue;
          const option = document.createElement('option');
          option.value = idOf(item.id);
          option.textContent = item.name;
          option.disabled = item.status === 'error';
          select.append(option);
          known.add(option.value);
        }
      } else {
        fillSelect(select, page.items ?? [], placeholder, optional);
        if (previousValue && !Array.from(select.options).some(option => option.value === previousValue) && previousOption) {
          const preserved = document.createElement('option');
          preserved.value = previousOption.value;
          preserved.textContent = previousOption.textContent;
          select.append(preserved);
        }
      }
      if (previousValue && Array.from(select.options).some(option => option.value === previousValue)) select.value = previousValue;
      select.dataset.optionQuery = query;
      select.dataset.optionLoaded = 'true';
      select.dataset.nextCursor = page.nextCursor ?? '';
      const search = Array.from(content.querySelectorAll('[data-option-search-kind]'))
        .find(item => item.dataset.optionSearchKind === kind && item.dataset.optionTarget === target);
      if (search && search.value !== query) search.value = query;
      if (search) {
        search.dataset.optionLoaded = 'true';
        search.dataset.optionQuery = query;
      }
      const more = Array.from(content.querySelectorAll('[data-option-more]'))
        .find(item => item.dataset.optionTarget === target && item.dataset.optionKind === kind);
      if (more) {
        more.hidden = !page.hasMore;
        more.dataset.nextCursor = page.nextCursor ?? '';
      }
      const picker = findSearchPicker(content, target, kind);
      if (picker) {
        renderSearchPicker(picker, optionPages.get(optionKey), optionStates.get(optionKey), currentData, document);
        syncSearchPickerTrigger(picker, currentData);
      }
    },
    setSearchOptionsState(target, kind, state) {
      if (target === 'brew') return;
      const optionKey = `${target}:${kind}`;
      const nextState = { status: state?.status ?? 'idle', query: state?.query ?? '', append: !!state?.append };
      optionStates.set(optionKey, nextState);
      const search = Array.from(content.querySelectorAll('[data-option-search-kind]'))
        .find(item => item.dataset.optionSearchKind === kind && item.dataset.optionTarget === target);
      if (search) {
        if (!nextState.append) search.value = nextState.query;
        search.dataset.optionLoaded = ['ready', 'loading'].includes(nextState.status) || nextState.append ? 'true' : 'false';
        search.dataset.optionQuery = nextState.query;
      }
      const picker = findSearchPicker(content, target, kind);
      if (picker) renderSearchPicker(picker, optionPages.get(optionKey), nextState, currentData, document);
    },
    clearSearchOptions(kind) {
      for (const key of optionPages.keys()) if (!kind || key.endsWith(`:${kind}`)) optionPages.delete(key);
      for (const key of optionStates.keys()) if (!kind || key.endsWith(`:${kind}`)) optionStates.delete(key);
    },
    showEntrySuccess(kind) {
      if (activeEntryKind !== kind || !entryDialogFor(kind)?.open) return false;
      drafts.delete(kind);
      entryPhase = 'success';
      syncEntryDialogState();
      if (entryTimer !== null) cancelSchedule(entryTimer);
      entryTimer = schedule(() => {
        entryTimer = null;
        if (activeEntryKind !== kind || entryPhase !== 'success') return;
        view.clearForm(kind);
        view.clearDraft(kind);
      }, 1000);
      return true;
    },
    showUnresolved(items = []) {
      unresolved.replaceChildren(make(document, 'h2', '확인 대기 중인 저장', 'unresolved-title'));
      unresolved.dataset.count = String(items.length);
      unresolved.hidden = items.length === 0;
      for (const item of items) unresolved.append(buildResolutionForm(document, item));
      applyViewState();
    },
    bind(actions) {
      entryActions = actions;
      bindEvents({ page, connectionForm, originalConnectionCheck, repair, nav, content,
        unresolved, actions, document, view, openDeleteDialog, closeDeleteDialog, submitDelete });
      bindPullToRefresh({ page, document, actions });
    },
  };
  return view;
}

function bindPullToRefresh({ page, document, actions }) {
  const surface = document.documentElement ?? page;
  const pullContent = document.querySelector('.page') ?? page;
  const indicator = make(document, 'div', undefined, 'pull-refresh');
  indicator.setAttribute('role', 'status');
  indicator.setAttribute('aria-live', 'polite');
  const spinner = makeSpinner(document);
  const spokes = [...spinner.children];
  const label = make(document, 'span', '', 'pull-refresh-label');
  indicator.append(spinner, label);
  indicator.hidden = true;
  (document.body ?? page).append(indicator);
  const threshold = 240;
  let start;
  let distance = 0;
  let dragging = false;
  let reloading = false;
  const atTop = () => (document.scrollingElement?.scrollTop ?? 0) <= 0;
  const blocked = () => {
    const state = actions.getState?.();
    return state?.pending || state?.frozen;
  };
  const available = () => !reloading && !blocked();
  const showPull = distance => {
    const progress = Math.min(distance / threshold, 1);
    pullContent.dataset.pullState = 'pulling';
    pullContent.style.setProperty('--pull-offset', `${Math.min(distance * 0.65, 96)}px`);
    indicator.style.setProperty('--pull-progress', String(progress));
    spinner.style.setProperty('--pull-angle', `${progress * 180}deg`);
    spokes.forEach((spoke, index) => { spoke.style.opacity = String(Math.max(0, Math.min(1, progress * 12 - index))); });
    indicator.dataset.state = progress >= 1 ? 'armed' : 'pulling';
    indicator.hidden = false;
    const message = progress >= 1 ? '놓으면 새로고침합니다.' : '아래로 당겨 새로고침';
    if (label.textContent !== message) label.textContent = message;
  };
  const reset = () => {
    start = undefined;
    distance = 0;
    dragging = false;
    if (!reloading) {
      indicator.hidden = true;
      pullContent.dataset.pullState = 'idle';
      pullContent.style.setProperty('--pull-offset', '0px');
    }
  };
  const scrolledInside = target => {
    for (let node = target; node && node !== document.body && node !== surface; node = node.parentElement) {
      if (node.scrollHeight > node.clientHeight && node.scrollTop > 0) return true;
    }
    return false;
  };

  surface.addEventListener('touchstart', event => {
    reset();
    if (!available() || !atTop() || event.touches.length !== 1 || scrolledInside(event.target)) return;
    const touch = event.touches[0];
    start = { id: touch.identifier, x: touch.clientX, y: touch.clientY };
  }, { passive: true });

  surface.addEventListener('touchmove', event => {
    if (!start) return;
    if (!available() || !atTop() || scrolledInside(event.target) || event.touches.length !== 1 || !event.cancelable) return reset();
    const touch = event.touches[0];
    if (touch.identifier !== start.id) return reset();
    const dx = Math.abs(touch.clientX - start.x);
    const dy = touch.clientY - start.y;
    if (dy < -8 || (dx > 8 && dx >= dy)) return reset();
    distance = Math.max(0, dy);
    if (!dragging && dy <= 8) return;
    if (dy <= 0 || dy <= dx) {
      indicator.hidden = true;
      pullContent.dataset.pullState = 'idle';
      pullContent.style.setProperty('--pull-offset', '0px');
      return;
    }
    dragging = true;
    event.preventDefault();
    showPull(distance);
  }, { passive: false });

  surface.addEventListener('touchend', event => {
    const touch = Array.from(event.changedTouches).find(item => item.identifier === start?.id);
    const shouldReload = start && touch && event.touches.length === 0 && available() && atTop() &&
      distance >= threshold && touch.clientY - start.y >= threshold;
    // A drag on a control must not become a tap when released below the refresh threshold.
    if (start && dragging && event.cancelable) event.preventDefault();
    reset();
    if (!shouldReload) return;
    if (event.cancelable) event.preventDefault();
    reloading = true;
    indicator.dataset.state = 'reloading';
    label.textContent = '새로고침 중…';
    pullContent.dataset.pullState = 'reloading';
    pullContent.style.setProperty('--pull-offset', '56px');
    indicator.style.setProperty('--pull-progress', '1');
    spokes.forEach((spoke, index) => { spoke.style.opacity = String((index + 1) / 12); });
    indicator.hidden = false;
    // Let the rotating spinner paint before replacing the document.
    document.defaultView.requestAnimationFrame(() => {
      document.defaultView.setTimeout(() => {
        if (blocked()) {
          reloading = false;
          reset();
          return;
        }
        document.defaultView.location.reload();
      }, 240);
    });
  }, { passive: false });
  surface.addEventListener('touchcancel', reset, { passive: true });
}

function applyState(page, state) {
  const globallyDisabled = state.frozen || state.pending;
  page.querySelectorAll('input,button,select,textarea').forEach(control => {
    control.disabled = globallyDisabled;
  });
  if (globallyDisabled || !state.unresolved) return;
  page.querySelectorAll('[data-action="delete-bean"], [data-action="delete-recipe"], [data-action="delete-record"]').forEach(control => { control.disabled = true; });

  page.querySelectorAll('form[data-form]').forEach(form => {
    form.querySelectorAll('input,button,select,textarea').forEach(control => {
      if (control.dataset.action !== 'cancel-form' && control.dataset.action !== 'cancel-connection') {
        control.disabled = true;
      }
    });
  });
}

function addFieldset(document, parent, title, fields, className = '') {
  const set = make(document, 'fieldset', undefined, `form-fieldset ${className}`.trim());
  set.append(make(document, 'legend', title));
  for (const field of fields) set.append(label(document, ...field));
  parent.append(set);
}

function formBase(document, kind, title) {
  const form = make(document, 'form', undefined, 'form-grid');
  form.dataset.form = kind;
  const heading = make(document, 'h2', title);
  heading.id = `${kind}-form-title`;
  form.append(heading);
  return form;
}

function makeEntryDialog(document, kind, form, open) {
  const dialog = make(document, 'dialog', undefined, 'entry-dialog');
  dialog.id = `${kind}-entry-dialog`;
  dialog.dataset.entryDialog = kind;
  dialog.dataset.open = String(open);
  dialog.setAttribute('aria-modal', 'true');
  dialog.setAttribute('aria-labelledby', `${kind}-form-title`);
  dialog.append(form);
  return dialog;
}

function renderHome(pane, document) {
  pane.className = 'list-view home-view';
  const hero = make(document, 'section', undefined, 'home-hero');
  hero.setAttribute('aria-labelledby', 'home-hero-title');
  const content = make(document, 'div', undefined, 'home-hero-content');
  const eyebrow = make(document, 'p', undefined, 'home-hero-eyebrow');
  eyebrow.append(make(document, 'span', 'GOOD COFFEE'), make(document, 'span', 'BRIGHTER DAYS'));
  const title = make(document, 'h1', '오늘의 한 잔을 시작해 보세요.');
  title.id = 'home-hero-title';
  content.append(eyebrow, title,
    make(document, 'p', '좋아하는 원두로, 나만의 방식으로. 기록할수록 더 맛있는 커피가 됩니다.', 'home-hero-copy'));
  const start = button(document, '추출 시작', 'button', 'start-brew');
  start.className = 'button primary-button home-start-button';
  start.textContent = '';
  start.append(
    decorativeSvg(document, '0 0 24 24', 'home-start-cup', [
      'M3 7h14v7a5 5 0 0 1-5 5H8a5 5 0 0 1-5-5V7Zm14 2h2a3 3 0 1 1 0 6h-3M3 22h18',
    ]),
    make(document, 'span', '추출 시작'),
    decorativeSvg(document, '0 0 24 24', 'home-start-arrow', ['M5 12h13m-6-6 6 6-6 6']),
  );
  content.append(start);
  const artwork = make(document, 'img', undefined, 'home-hero-art');
  artwork.setAttribute('src', './icons/home-brew.png');
  artwork.setAttribute('alt', '');
  artwork.setAttribute('width', '1254');
  artwork.setAttribute('height', '1254');
  artwork.alt = '';
  artwork.dataset.heroArt = 'true';
  artwork.setAttribute('aria-hidden', 'true');
  hero.append(content, artwork);
  pane.append(hero);
}

function routeButton(document, title, route, action = 'navigate') {
  const control = button(document, title, 'button', action);
  control.dataset.route = route;
  return control;
}

function brewOptionScope(route, kind) {
  return kind === 'recipes' ? routeParams(route).get('beanId') ?? '' : 'beans';
}

function brewOptionPage(data, optionPages, kind, routeQuery, route) {
  const cached = optionPages.get(`brew:${kind}`);
  if (cached && Date.now() - cached.savedAt < 60000 && cached.scope === brewOptionScope(route, kind) && (!routeQuery || cached.query === routeQuery)) return cached;
  return { items: kind === 'beans' ? data.beans ?? [] : data.recipes ?? [],
    nextCursor: data.screen?.nextCursor ?? null, hasMore: !!data.screen?.hasMore,
    complete: data.screen?.complete !== false, query: routeQuery };
}

function renderUnavailableRoute(pane, document, route, error) {
  const path = routePath(route);
  const params = routeParams(route);
  pane.append(make(document, 'h1', '선택한 항목을 확인할 수 없습니다.'));
  pane.append(make(document, 'p', error === 'recipe-unavailable'
    ? '레시피가 없거나 추출 단계가 유효하지 않습니다. 최신 목록에서 다시 선택해 주세요.'
    : error === 'bean-required' ? '추출에 사용할 원두를 먼저 선택해 주세요.'
      : '선택한 원두가 없거나 주소가 올바르지 않습니다. 원두 목록을 새로 확인해 주세요.', 'record-warning'));
  const beanId = params.get('beanId');
  if (path === '/brew/run' && beanId) {
    pane.append(routeButton(document, '레시피 다시 선택', `/brew/recipe?beanId=${encodeURIComponent(beanId)}`));
  } else if (path === '/records/new' && beanId) {
    pane.append(routeButton(document, '추출 다시 선택', `/brew/recipe?beanId=${encodeURIComponent(beanId)}`));
  } else {
    pane.append(routeButton(document, '원두 선택으로', '/brew/bean'));
  }
  pane.append(routeButton(document, '홈으로', '/home'));
}

function renderBrewOptions(pane, data, document, route, optionPages, kind, selectedBean, params) {
  const isBeans = kind === 'beans';
  const selectedId = params.get(isBeans ? 'selectedBeanId' : 'selectedRecipeId') ?? '';
  const routeQuery = params.get('q') ?? '';
  const page = brewOptionPage(data, optionPages, kind, routeQuery, route);
  const title = isBeans ? '원두 선택' : '레시피 선택';
  pane.append(routeButton(document, isBeans ? '홈으로' : '원두 선택으로', isBeans ? '/home'
    : `/brew/bean?selectedBeanId=${encodeURIComponent(selectedBean.id)}`, isBeans ? 'navigate' : 'back-to-beans'));
  pane.append(make(document, 'h1', title));
  if (selectedBean) pane.append(make(document, 'p', `선택한 원두: ${selectedBean.name}`, 'brew-selected-bean'));
  const search = make(document, 'input');
  search.type = 'search';
  search.setAttribute('aria-label', isBeans ? '원두 검색' : '레시피 검색');
  search.setAttribute('autocomplete', 'off');
  search.dataset.optionSearchKind = kind;
  search.dataset.optionTarget = 'brew';
  search.dataset.optionLoaded = 'true';
  search.value = page.query ?? routeQuery;
  pane.append(search);

  const items = page.items ?? [];
  if (!items.length) {
    const stillLoading = page.hasMore || page.complete === false;
    const message = isBeans
      ? search.value ? '검색한 원두가 없습니다.' : '원두가 아직 등록되지 않았습니다. 원두를 먼저 등록한 뒤 추출을 시작해 주세요.'
      : search.value ? '검색한 레시피가 없습니다.' : '등록된 레시피가 없습니다. 레시피를 등록한 뒤 다시 선택해 주세요.';
    pane.append(make(document, 'p', stillLoading ? `${message} 다른 항목도 계속 확인할 수 있습니다.` : message, 'empty-state'));
    if (isBeans) {
      pane.append(routeButton(document, '원두 등록하기', '/beans'));
      pane.append(routeButton(document, '홈으로 돌아가기', '/home'));
    } else {
      pane.append(routeButton(document, '레시피 메뉴에서 등록하기', '/recipes'));
      pane.append(routeButton(document, '원두 다시 선택', `/brew/bean?selectedBeanId=${encodeURIComponent(selectedBean.id)}`, 'back-to-beans'));
    }
  }

  const list = make(document, 'div', undefined, 'brew-option-list');
  for (const item of items) {
    const card = make(document, 'article', undefined, 'brew-option-card');
    const control = button(document, item.name, 'button', isBeans ? 'select-brew-bean' : 'select-brew-recipe');
    control.dataset[isBeans ? 'beanId' : 'recipeId'] = item.id;
    if (!isBeans) control.dataset.beanId = selectedBean.id;
    control.setAttribute('aria-pressed', String(item.id === selectedId));
    const ready = isBeans || item.status === 'ready' || item.validationStatus === 'ready' ||
      (item.status === undefined && item.validationStatus === undefined && Array.isArray(item.steps) && item.steps.length > 0);
    control.disabled = !ready;
    card.append(control);
    if (isBeans) {
      const details = [item.origin, item.roaster].filter(Boolean).join(' · ');
      if (details) card.append(make(document, 'p', details, 'muted-note'));
      if (item.id === selectedId) card.append(make(document, 'p', '선택한 원두', 'brew-selected-label'));
    } else {
      card.append(make(document, 'p', `${item.dose}g · ${item.temperature}℃ · 물 ${item.totalWater}g · ${item.steps?.length ?? 0}단계`));
      if (!ready) card.append(make(document, 'p', item.status === 'error' || item.validationStatus === 'error'
        ? '레시피를 확인할 수 없어 선택할 수 없습니다.' : '레시피 단계를 확인 중입니다.', 'muted-note'));
      if (item.id === selectedId) card.append(make(document, 'p', '선택한 레시피', 'brew-selected-label'));
    }
    list.append(card);
  }
  if (items.length) pane.append(list);
  if (page.hasMore) {
    const more = routeButton(document, '더 불러오기', '', 'more-options');
    more.className = 'button page-load-more';
    more.dataset.optionTarget = 'brew';
    more.dataset.optionKind = kind;
    more.dataset.nextCursor = page.nextCursor ?? '';
    pane.append(more);
  } else if (page.complete === false) {
    pane.append(make(document, 'p', '전체 목록을 확인하지 못했습니다. 다시 조회해 주세요.', 'record-warning'));
  }
}

function renderBrewRun(pane, data, document, route, params) {
  const beanId = params.get('beanId');
  const recipeId = params.get('recipeId');
  const bean = data.beans?.find(item => item.id === beanId);
  const recipe = data.recipes?.find(item => item.id === recipeId);
  if (!bean || !recipe || !Array.isArray(recipe.steps) || !recipe.steps.length) {
    renderUnavailableRoute(pane, document, route, 'recipe-unavailable');
    return;
  }
  pane.append(routeButton(document, '레시피 선택으로',
    `/brew/recipe?beanId=${encodeURIComponent(bean.id)}&selectedRecipeId=${encodeURIComponent(recipe.id)}`,
    'back-to-recipes'));
  pane.append(make(document, 'h1', '추출 안내'));
  pane.append(make(document, 'p', `원두: ${bean.name} · 레시피: ${recipe.name}`, 'brew-selected-bean'));
  const conditions = make(document, 'dl', undefined, 'brew-conditions');
  for (const [title, value] of [
    ['드리퍼', recipe.dripper], ['원두량', `${recipe.dose}g`], ['분쇄도', recipe.grind],
    ['그라인더', recipe.grinder], ['그라인더 설정', recipe.grinderSetting],
    ['물 온도', `${recipe.temperature}℃`], ['총 물 양', `${recipe.totalWater}g`],
  ]) {
    if (value !== undefined && value !== null && value !== '') conditions.append(make(document, 'dt', title), make(document, 'dd', value));
  }
  pane.append(conditions, make(document, 'h2', '붓기 단계'), makeStepTable(document, recipe.steps));
  if (typeof recipe.extractionGuide === 'string' && recipe.extractionGuide.trim()) {
    pane.append(make(document, 'h2', '추출 가이드'), make(document, 'p', recipe.extractionGuide, 'brew-extraction-guide'));
  }
  const complete = button(document, '추출 완료', 'button', 'complete-brew');
  complete.className = 'button primary-button';
  complete.dataset.beanId = bean.id;
  complete.dataset.recipeId = recipe.id;
  pane.append(complete);
}

function renderBrewFlow(parent, data, document, route, optionPages) {
  const path = routePath(route);
  const params = routeParams(route);
  const pane = make(document, 'section', undefined, 'brew-flow-pane');
  if (path === '/brew/run') pane.className += ' brew-run-pane';
  if (data.screen?.error) {
    renderUnavailableRoute(pane, document, route, data.screen.error);
  } else if (path === '/brew/bean') {
    renderBrewOptions(pane, data, document, route, optionPages, 'beans', null, params);
  } else if (path === '/brew/recipe') {
    const beanId = params.get('beanId');
    const bean = data.beans?.find(item => item.id === beanId);
    if (!bean) renderUnavailableRoute(pane, document, route, 'bean-unavailable');
    else renderBrewOptions(pane, data, document, route, optionPages, 'recipes', bean, params);
  } else if (path === '/brew/run') {
    renderBrewRun(pane, data, document, route, params);
  } else {
    renderUnavailableRoute(pane, document, route, 'bean-unavailable');
  }
  parent.replaceChildren(pane);
}

function renderPane(parent, data, document, route = '/home', drafts = new Map(), optionPages = new Map(),
  beanFormOpen = false, recipeFormOpen = false, recordFormOpen = false, optionStates = new Map()) {
  const path = routePath(route);
  const parts = path.split('/').filter(Boolean);
  const section = parts[0] ?? 'home';
  const pane = make(document, 'div', undefined, 'list-view');
  pane.dataset.section = section;
  if (path === '/home') {
    renderHome(pane, document);
    parent.dataset.section = 'home';
    parent.replaceChildren(pane);
    updateNavigationCurrent(parent.ownerDocument, route);
    return;
  }
  if (section === 'brew') {
    renderBrewFlow(pane, data, document, route, optionPages);
    parent.dataset.section = 'home';
    parent.replaceChildren(pane);
    updateNavigationCurrent(parent.ownerDocument, route);
    return;
  }
  if (section === 'records' && parts[1] === 'new' && data.screen?.error) {
    renderUnavailableRoute(pane, document, route, data.screen.error);
    parent.dataset.section = 'records';
    parent.replaceChildren(pane);
    updateNavigationCurrent(parent.ownerDocument, route);
    return;
  }
  const titles = { beans: '원두', recipes: '레시피', records: '추출 기록' };
  const header = make(document, 'div', undefined, 'list-header');
  header.append(make(document, 'h2', titles[section] ?? '커피 기록'));
  const actions = make(document, 'div', undefined, 'list-actions');
  if (section === 'beans' && !parts[1]) {
    const add = iconButton(document, '+', '새 원두 추가', 'show-bean-form');
    add.setAttribute('aria-controls', 'beans-entry-dialog');
    add.setAttribute('aria-expanded', String(beanFormOpen));
    actions.append(add);
  }
  if (section === 'recipes' && (!parts[1] || parts[1] === 'new')) {
    const add = iconButton(document, '+', '새 레시피 추가', 'show-recipe-form');
    add.setAttribute('aria-controls', 'recipes-entry-dialog');
    add.setAttribute('aria-expanded', String(recipeFormOpen));
    actions.append(add);
  }
  if (section === 'records') {
    const add = iconButton(document, '+', '새 추출 기록 추가', 'show-record-form');
    add.setAttribute('aria-controls', 'records-entry-dialog');
    add.setAttribute('aria-expanded', String(recordFormOpen));
    actions.append(add);
  }
  header.append(actions);
  pane.append(header);

  if (section === 'beans' && parts[1]) {
    renderBeanDetail(pane, data, document, parts[1]);
  } else if (section === 'recipes' && parts[1] && parts[1] !== 'new') {
    renderRecipeDetail(pane, data, document, parts[1]);
  } else if (section === 'beans') {
    renderBeans(pane, data, document, beanFormOpen);
  } else if (section === 'recipes') {
    const form = buildRecipeForm(document, data);
    form.id = 'new-recipe-form';
    pane.append(makeEntryDialog(document, 'recipes', form, recipeFormOpen));
    addStep(pane, document);
    updatePreview(pane);
    if (!data.recipes.length) pane.append(make(document, 'p', data.screen?.hasMore
      ? '레시피를 더 확인 중입니다. 더 보기로 계속 확인해 주세요.'
      : data.screen?.complete === false ? '레시피 목록을 끝까지 확인하지 못했습니다. 새로고침해 주세요.'
        : '등록된 레시피가 없습니다.', 'empty-state'));
    for (const recipe of data.recipes) {
      const card = make(document, 'article', undefined, 'recipe-card recipe-summary-card');
      const recipeHeader = make(document, 'div', undefined, 'entity-card-header');
      const title = make(document, 'h3');
      const link = make(document, 'a', recipe.name, 'recipe-card-link');
      link.setAttribute('href', `#/recipes/${recipe.id}`);
      link.setAttribute('aria-label', `${recipe.name} 상세 보기`);
      link.dataset.action = 'navigate';
      link.dataset.route = `/recipes/${recipe.id}`;
      title.append(link);
      recipeHeader.append(title, trashButton(document, 'recipes', recipe.id, recipe.name));
      card.append(recipeHeader);
      card.append(make(document, 'p', `${recipe.dose}g · ${recipe.temperature}℃ · 물 ${recipe.totalWater}g`));
      if (recipe.validationStatus === 'checking') card.append(make(document, 'p', '레시피 단계를 확인 중입니다.', 'muted-note'));
      if (recipe.validationStatus === 'error') card.append(make(document, 'p', '레시피 단계 확인에 실패했습니다.', 'record-warning'));
      pane.append(card);
    }
  } else if (section === 'records') {
    const draft = drafts.get('records');
    if (parts[1] === 'new' && draft && draft.flowKey !== recordFlowKey(route)) {
      const conflict = make(document, 'section', undefined, 'record-draft-conflict');
      conflict.setAttribute('role', 'status');
      conflict.append(make(document, 'h3', '저장하지 않은 추출 기록이 있습니다.'));
      conflict.append(make(document, 'p', `${draft.values.date} · 별점 ${draft.values.rating || '미입력'} · ${draft.values.cupNote || '컵노트 없음'}`));
      conflict.append(button(document, '이전 기록 이어쓰기', 'button', 'resume-record-draft'));
      conflict.append(button(document, '이전 초안을 버리고 새 기록 작성', 'button', 'start-new-record'));
      pane.append(conflict);
    } else {
      renderRecords(pane, data, document, recordFormOpen, optionPages, optionStates, route);
    }
  } else {
    pane.append(make(document, 'p', '화면을 찾을 수 없습니다. 메뉴에서 이동해 주세요.'));
  }

  if (data.screen?.hasMore) {
    const more = button(document, '더 불러오기', 'button', 'load-more');
    more.className = 'button page-load-more';
    pane.append(more);
  } else if (data.screen?.complete === false) {
    pane.append(make(document, 'p', '전체 목록을 확인하지 못했습니다. 새로고침해 주세요.', 'record-warning'));
  }

  parent.dataset.section = section;
  parent.replaceChildren(pane);
  const form = pane.querySelector('form[data-form]');
  if (form) restoreDraft(form, drafts.get(form.dataset.form), data);
  updateNavigationCurrent(parent.ownerDocument, route);
}

function renderBeans(pane, data, document, formOpen) {
  const form = formBase(document, 'beans', '새 원두');
  form.id = 'new-bean-form';
  addFieldset(document, form, '원두 정보', [
    ['원두 이름', 'name', 'text', true, { autocomplete: 'off' }],
    ['로스터리', 'roaster', 'text', false],
    ['원산지·농장', 'origin', 'text', false],
    ['품종', 'variety', 'text', false],
    ['가공 방식', 'process', 'text', false],
    ['향미 노트', 'tastingNotes', 'textarea', false],
  ]);
  addFormActions(document, form);
  pane.append(makeEntryDialog(document, 'beans', form, formOpen));

  if (!data.beans.length) pane.append(make(document, 'p', data.screen?.hasMore
    ? '원두를 더 확인 중입니다. 더 보기로 계속 확인해 주세요.'
    : data.screen?.complete === false ? '원두 목록을 끝까지 확인하지 못했습니다. 새로고침해 주세요.'
      : '등록된 원두가 없습니다.', 'empty-state'));
  for (const bean of data.beans) {
    const card = make(document, 'article', undefined, 'bean-card');
    const header = make(document, 'div', undefined, 'entity-card-header');
    const title = make(document, 'h3');
    const link = make(document, 'a', bean.name, 'bean-card-link');
    link.setAttribute('href', `#/beans/${bean.id}`);
    link.setAttribute('aria-label', `${bean.name} 추출 기록 보기`);
    link.dataset.action = 'navigate';
    link.dataset.route = `/beans/${bean.id}`;
    title.append(link);
    header.append(title, trashButton(document, 'beans', bean.id, bean.name));
    card.append(header);
    const metadata = make(document, 'dl', undefined, 'bean-metadata');
    for (const [label, value] of [
      ['로스터리', bean.roaster],
      ['산지·농장', bean.origin],
      ['품종', bean.variety],
      ['프로세싱', bean.process],
      ['향미 노트', bean.tastingNotes],
    ]) {
      metadata.append(make(document, 'dt', label), make(document, 'dd', value || '기록 없음'));
    }
    card.append(metadata);
    const records = currentRecords(data).filter(record => record.beanId === bean.id);
    const count = bean.recordCount;
    const countLabel = count?.status === 'ready' ? `${count.count}개`
      : count?.status === 'error' ? '확인하지 못함'
        : count?.status === 'loading' ? '확인 중' : `${records.length}개`;
    card.append(make(document, 'p', `추출 기록 ${countLabel}`));
    pane.append(card);
  }
}

function renderBeanDetail(pane, data, document, beanId) {
  const bean = data.beans.find(row => row.id === beanId);
  const back = button(document, '원두 목록으로', 'button', 'navigate');
  back.dataset.route = '/beans';
  pane.append(back);
  if (!bean) {
    pane.append(make(document, 'p', '원두를 찾을 수 없습니다. 최신 목록을 새로고침해 주세요.'));
    return;
  }
  pane.append(make(document, 'h3', bean.name));
  if (bean.origin) pane.append(make(document, 'p', `원산지·농장: ${bean.origin}`));
  const records = currentRecords(data).filter(record => record.beanId === bean.id).sort((a, b) => String(b.date ?? '').localeCompare(String(a.date ?? '')));
  pane.append(make(document, 'h4', '이 원두의 추출 기록'));
  if (!records.length) pane.append(make(document, 'p', data.screen?.hasMore
    ? '기록을 더 확인 중입니다. 더 보기로 계속 확인해 주세요.'
    : data.screen?.complete === false ? '전체 기록을 확인하지 못했습니다. 새로고침해 주세요.'
      : '등록된 추출 기록이 없습니다.'));
  for (const record of records) pane.append(recordCard(document, record, data));
}

function renderRecipeDetail(pane, data, document, recipeId) {
  const recipe = data.recipes.find(row => row.id === recipeId);
  const back = button(document, '레시피 목록으로 돌아가기', 'button', 'navigate');
  back.dataset.route = '/recipes';
  pane.append(back);
  if (!recipe) {
    pane.append(make(document, 'p', '레시피를 찾을 수 없습니다. 최신 목록을 새로고침해 주세요.'));
    return;
  }
  pane.append(recipeCard(document, recipe, data, true));
}

function recipeCard(document, recipe, data, detailed = false) {
  const article = make(document, 'article', undefined, 'recipe-card');
  const header = make(document, 'div', undefined, 'entity-card-header');
  header.append(make(document, 'h3', recipe.name), trashButton(document, 'recipes', recipe.id, recipe.name));
  article.append(header);
  article.append(make(document, 'p', `${recipe.dripper || '드리퍼 미기록'} · ${recipe.dose}g · ${recipe.temperature}℃ · 물 ${recipe.totalWater}g`));
  const details = [
    ['분쇄도', recipe.grind], ['그라인더', recipe.grinder],
    ['그라인더 설정', recipe.grinderSetting], ['분쇄 입자', recipe.microns === null || recipe.microns === '' ? '' : `${recipe.microns}μm`],
  ].filter(([, value]) => value !== undefined && value !== null && value !== '');
  for (const [title, value] of details) article.append(make(document, 'p', `${title}: ${value}`));

  const stats = recipe.stats ?? { count: 0, average: null };
  article.append(make(document, 'p', stats.status === 'loading' ? '평가 통계를 확인 중입니다.'
    : stats.status === 'error' ? '평가 통계를 확인하지 못했습니다.'
      : stats.count ? `평가 ${stats.count}회 · 평균 ${Number(stats.average).toFixed(1)}점` : '평가 없음 · 0회'));
  article.append(makeStepTable(document, recipe.steps));
  if (typeof recipe.extractionGuide === 'string' && recipe.extractionGuide.trim()) {
    const guide = make(document, 'section', undefined, 'recipe-extraction-guide');
    guide.append(make(document, 'h4', '추출 가이드'), make(document, 'p', recipe.extractionGuide));
    article.append(guide);
  }

  const records = currentRecords(data).filter(record => record.recipeId === recipe.id).sort((a, b) => String(b.date ?? '').localeCompare(String(a.date ?? '')));
  article.append(make(document, 'h4', '추출 기록'));
  if (!records.length) article.append(make(document, 'p', data.screen?.hasMore
    ? '기록을 더 확인 중입니다. 더 보기로 계속 확인해 주세요.'
    : data.screen?.complete === false ? '전체 기록을 확인하지 못했습니다.' : '기록 없음'));
  for (const record of records) {
    const bean = data.beans.find(item => item.id === record.beanId);
    const validRating = Number.isInteger(record.rating) && record.rating >= 1 && record.rating <= 5;
    const validSnapshot = record.snapshotStatus === 'valid' ? record.snapshot : null;
    const snapshot = validSnapshot?.version === 2 ? validSnapshot.recipe : validSnapshot;
    const recordHeader = make(document, 'div', undefined, 'entity-card-header record-summary-header');
    recordHeader.append(make(document, 'p', `${record.date || '날짜 확인 필요'} · 원두: ${bean?.name || '원두 확인 필요'} · ${record.rating ?? '별점 확인 필요'}/5 ${validRating ? '★'.repeat(record.rating) : ''}`),
      trashButton(document, 'records', record.id, recordName(record, data.recipes.find(item => item.id === record.recipeId), snapshot)));
    article.append(recordHeader);
    const invalidLabels = [
      ...(record.invalidFields?.includes('date') ? ['날짜'] : []),
      ...(record.invalidFields?.includes('rating') ? ['별점(정수 1~5)'] : []),
    ];
    if (invalidLabels.length) article.append(make(document, 'p', `기록 오류: ${invalidLabels.join(', ')}`, 'record-warning'));
    if (record.snapshotStatus === 'damaged') article.append(make(document, 'p', '스냅샷이 손상되어 당시 조건을 표시할 수 없습니다.', 'record-warning'));
    if (record.cupNote) article.append(make(document, 'p', `컵노트: ${record.cupNote}`));
    if (Array.isArray(snapshot?.steps)) {
      article.append(make(document, 'p', `기록 당시 조건: ${snapshot.dripper || '드리퍼 미기록'} · ${snapshot.dose}g · ${snapshot.temperature}℃ · 물 ${snapshot.totalWater}g`));
      article.append(make(document, 'h5', '당시 단계'));
      article.append(makeStepTable(document, snapshot.steps));
      if (typeof snapshot.extractionGuide === 'string' && snapshot.extractionGuide.trim()) {
        article.append(make(document, 'p', `기록 당시 추출 가이드: ${snapshot.extractionGuide}`, 'record-extraction-guide'));
      }
    }
  }
  if (detailed) {
    const record = button(document, '이 레시피로 추출 기록', 'button', 'new-record');
    record.dataset.id = recipe.id;
    record.disabled = !recipeReady(recipe);
    article.append(record);
  }
  const copy = button(document, '이 레시피 복사', 'button', 'copy-recipe');
  copy.dataset.id = recipe.id;
  copy.disabled = !recipeReady(recipe);
  article.append(copy);
  return article;
}

function makeStepTable(document, steps) {
  const wrap = make(document, 'div', undefined, 'table-scroll');
  wrap.setAttribute('role', 'region');
  wrap.setAttribute('aria-label', '레시피 단계 표');
  const table = make(document, 'table', undefined, 'steps-table');
  const head = make(document, 'thead');
  const header = make(document, 'tr');
  for (const [title, detail] of [['단계'], ['누적 시간', '간격'], ['누적 물', '이번 물']]) {
    const cell = make(document, 'th', title);
    if (detail) cell.append(make(document, 'span', ` (${detail})`, 'step-current'));
    cell.setAttribute('scope', 'col');
    header.append(cell);
  }
  head.append(header);
  table.append(head);
  const body = make(document, 'tbody');
  for (const [index, step] of steps.entries()) {
    const row = make(document, 'tr');
    row.append(make(document, 'td', step.name));
    const interval = step.interval ?? (index === 0 ? 0 : step.seconds - steps[index - 1].seconds);
    for (const [total, current] of [[formatTime(step.seconds), `${interval}초`], [`${step.cumulativeWater}g`, `${step.water}g`]]) {
      const cell = make(document, 'td');
      cell.append(make(document, 'span', total, 'step-total'), make(document, 'span', ` (${current})`, 'step-current'));
      row.append(cell);
    }
    body.append(row);
  }
  table.append(body);
  wrap.append(table);
  return wrap;
}

function buildRecipeForm(document, data) {
  const form = formBase(document, 'recipes', '새 레시피');
  addFieldset(document, form, '기본 조건', [
    ['레시피 이름', 'name', 'text', true],
    ['드리퍼', 'dripper', 'text', false],
    ['원두 사용량 (g)', 'dose', 'number', true, { step: 'any', min: 0 }],
    ['분쇄도', 'grind', 'text', false],
    ['그라인더', 'grinder', 'text', false],
    ['그라인더 설정', 'grinderSetting', 'text', false],
    ['분쇄 입자 (μm, 선택)', 'microns', 'number', false, { step: 'any', min: 0 }],
    ['물 온도 (℃)', 'temperature', 'number', true, { step: 'any', min: 0, max: 100 }],
    ['총 물 양 (g)', 'totalWater', 'number', true, { step: 'any', min: 0 }],
  ]);
  form.append(label(document, '추출 가이드 (선택)', 'extractionGuide', 'textarea', false, {
    rows: 4,
    placeholder: '예: 교반 없음, 목표 2분 30초 완성',
  }));
  const steps = make(document, 'div', undefined, 'recipe-steps');
  steps.dataset.steps = '';
  form.append(steps);
  form.append(button(document, '단계 추가', 'button', 'add-step'));
  const preview = make(document, 'div', undefined, 'recipe-preview');
  preview.setAttribute('aria-live', 'polite');
  preview.setAttribute('aria-label', '단계 입력 미리보기');
  form.append(preview);
  addFormActions(document, form);
  return form;
}

function hydrateRecordPickers(form, freshForm, data, optionPages, optionStates, document) {
  if (!form || !freshForm) return;
  const initial = JSON.parse(form.dataset.initialValues || '{}');
  for (const name of ['beanId', 'recipeId']) {
    const select = form.elements[name];
    const freshSelect = freshForm.elements[name];
    const defaultValue = freshSelect.value;
    const selectedValue = select.value === initial[name] ? defaultValue : select.value;
    if (selectedValue && !Array.from(freshSelect.options).some(option => option.value === selectedValue)) {
      const previous = Array.from(select.options).find(option => option.value === selectedValue);
      const option = make(form.ownerDocument, 'option', previous?.textContent ?? '이전 선택 항목');
      option.value = selectedValue;
      freshSelect.append(option);
    }
    select.replaceChildren(...freshSelect.options);
    select.value = selectedValue;
    Object.assign(select.dataset, freshSelect.dataset);
    const search = select.parentElement.querySelector('[data-option-search-kind]');
    const freshSearch = freshSelect.parentElement.querySelector('[data-option-search-kind]');
    if (search.value === freshSearch.value) Object.assign(search.dataset, freshSearch.dataset);
    select.parentElement.querySelector('[data-option-more]').hidden =
      freshSelect.parentElement.querySelector('[data-option-more]').hidden;
    const picker = select.closest('[data-search-picker]');
    const target = picker.dataset.optionTarget;
    const kind = picker.dataset.optionKind;
    renderSearchPicker(picker, optionPages.get(`${target}:${kind}`), optionStates.get(`${target}:${kind}`), data, document);
    syncSearchPickerTrigger(picker, data);
    initial[name] = defaultValue;
  }
  form.dataset.initialValues = JSON.stringify(initial);
}

function starRating(document) {
  const group = make(document, 'fieldset', undefined, 'star-rating');
  group.append(make(document, 'legend', '별점 (1~5)', 'form-field-label'));
  const choices = make(document, 'div', undefined, 'rating-options');
  for (let score = 1; score <= 5; score += 1) {
    const option = make(document, 'label', undefined, 'rating-option');
    const input = make(document, 'input');
    input.type = 'radio';
    input.name = 'rating';
    input.value = String(score);
    input.required = true;
    input.setAttribute('aria-label', `${score}점`);
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', 'm12 3 2.78 5.63L21 9.54l-4.5 4.39 1.06 6.2L12 17.2l-5.56 2.93 1.06-6.2L3 9.54l6.22-.91Z');
    svg.append(path);
    option.append(input, svg);
    choices.append(option);
  }
  group.append(choices);
  return group;
}

function buildRecordForm(document, data, optionPages, route, optionStates) {
  const form = formBase(document, 'records', '추출 후 빠른 기록');
  const fields = make(document, 'fieldset', undefined, 'form-fieldset');
  const params = routeParams(route);
  const beanPicker = searchPicker(document, '원두', 'beans', 'form', preferredOptionPage(data.options?.beans, optionPages.get('form:beans')),
    '원두를 선택해 주세요.', false, optionStates.get('form:beans'));
  const recipePicker = searchPicker(document, '레시피', 'recipes', 'form', preferredOptionPage(data.options?.recipes, optionPages.get('form:recipes')),
    '레시피를 선택해 주세요.', false, optionStates.get('form:recipes'));
  fields.append(make(document, 'legend', '기록'), beanPicker, recipePicker);
  for (const [picker, name] of [[beanPicker, 'beanId'], [recipePicker, 'recipeId']]) {
    const selectedId = params.get(name);
    const select = picker.querySelector('select');
    if (selectedId && Array.from(select.options).some(option => option.value === selectedId)) select.value = selectedId;
    syncSearchPickerTrigger(picker, data);
  }
  fields.append(label(document, '날짜', 'date', 'date', true));
  fields.append(starRating(document));
  fields.append(label(document, '컵노트 (선택)', 'cupNote', 'textarea', false));
  form.append(fields);
  addFormActions(document, form);
  const requestedDate = params.get('date');
  form.elements.date.value = isIsoDate(requestedDate) ? requestedDate : localDate();
  form.dataset.draftRoute = route;
  form.dataset.draftFlow = recordFlowKey(route);
  form.dataset.initialValues = JSON.stringify(Object.fromEntries(
    ['beanId', 'recipeId', 'date', 'rating', 'cupNote'].map(name => [name, form.elements[name].value])));
  return form;
}

function buildSearchPickerResult(document, item, kind, target, selected, data) {
  const row = make(document, 'li', undefined, 'search-picker-result');
  const option = button(document, '', 'button', 'select-search-option');
  option.dataset.optionId = idOf(item.id);
  option.dataset.optionTarget = target;
  option.dataset.optionKind = kind;
  option.setAttribute('aria-pressed', String(selected));
  const summary = make(document, 'span', undefined, 'search-picker-result-copy');
  summary.append(make(document, 'span', item.name, 'search-picker-result-name'));
  const details = optionDetails(item, kind, data);
  if (details) summary.append(make(document, 'span', details, 'search-picker-result-details'));
  if (item.status === 'error') {
    option.disabled = true;
    option.setAttribute('aria-label', `${item.name}, 선택할 수 없습니다.`);
    summary.append(make(document, 'span', '선택할 수 없는 항목', 'search-picker-result-details'));
  }
  option.append(summary);
  option.append(make(document, 'span', selected ? '선택됨' : '선택', 'search-picker-result-action'));
  row.append(option);
  return row;
}

function searchPicker(document, title, kind, target, page, placeholder, optional, state) {
  const wrap = make(document, 'div', undefined, 'form-field search-picker');
  wrap.dataset.searchPicker = '';
  wrap.dataset.optionKind = kind;
  wrap.dataset.optionTarget = target;
  const heading = make(document, 'span', title, 'form-field-label');
  heading.id = `${target}-${kind}-picker-label`;
  wrap.append(heading);

  const select = make(document, 'select');
  select.className = 'search-picker-select visually-hidden';
  select.name = kind === 'beans' ? 'beanId' : 'recipeId';
  select.required = false;
  select.setAttribute('aria-hidden', 'true');
  select.setAttribute('tabindex', '-1');
  select.setAttribute('aria-label', title);
  select.dataset.optionSelectKind = kind;
  select.dataset.optionTarget = target;
  fillSelect(select, page?.items ?? [], placeholder, optional);
  const selectedItem = page?.selectedItem;
  if (selectedItem?.id && !Array.from(select.options).some(option => option.value === idOf(selectedItem.id))) {
    const selectedOption = make(document, 'option', selectedItem.name ?? '선택 항목');
    selectedOption.value = idOf(selectedItem.id);
    select.append(selectedOption);
  }
  if (page) {
    select.dataset.optionLoaded = 'true';
    select.dataset.nextCursor = page.nextCursor ?? '';
    select.dataset.optionQuery = page.query ?? '';
  }
  wrap.append(select);

  const emptyLabel = target === 'form' ? `${kind === 'beans' ? '원두' : '레시피'} 선택` : placeholder;
  wrap.dataset.emptyLabel = emptyLabel;
  const trigger = button(document, '', 'button', 'open-search-picker');
  trigger.className = 'button search-picker-trigger';
  trigger.setAttribute('aria-haspopup', 'dialog');
  trigger.setAttribute('aria-expanded', 'false');
  trigger.setAttribute('aria-labelledby', `${heading.id} ${target}-${kind}-picker-value`);
  if (!optional) trigger.setAttribute('aria-required', 'true');
  const value = make(document, 'span', emptyLabel, 'search-picker-value');
  value.id = `${target}-${kind}-picker-value`;
  const summary = make(document, 'span', '', 'search-picker-selection-details');
  const chevron = make(document, 'span', '', 'search-picker-chevron');
  chevron.setAttribute('aria-hidden', 'true');
  trigger.append(value, summary, chevron);
  wrap.append(trigger);

  const dialog = make(document, 'dialog', undefined, 'option-picker-dialog');
  dialog.dataset.optionPicker = '';
  dialog.dataset.optionTarget = target;
  dialog.dataset.optionKind = kind;
  dialog.id = `${target}-${kind}-option-picker`;
  dialog.setAttribute('aria-modal', 'true');
  dialog.setAttribute('aria-labelledby', `${dialog.id}-title`);
  const dialogHeader = make(document, 'div', undefined, 'option-picker-header');
  const optionTitle = kind === 'beans' ? '원두 선택' : '레시피 선택';
  const dialogTitle = make(document, 'h2', optionTitle);
  dialogTitle.id = `${dialog.id}-title`;
  const close = button(document, '닫기', 'button', 'close-search-picker');
  close.className = 'button search-picker-close';
  dialogHeader.append(dialogTitle, close);

  const search = make(document, 'input');
  search.type = 'search';
  search.setAttribute('aria-label', `${optionTitle} 이름 검색`);
  search.setAttribute('autocomplete', 'off');
  search.setAttribute('placeholder', '이름으로 검색');
  search.dataset.optionSearchKind = kind;
  search.dataset.optionTarget = target;
  search.dataset.optionPickerSearch = '';
  const query = state?.query ?? (typeof page?.query === 'string' ? page.query : '');
  search.value = query;
  search.dataset.optionQuery = query;
  search.dataset.optionLoaded = page && (page.query ?? '') === query ? 'true' : 'false';
  const clearSearch = button(document, '검색어 지우기', 'button', 'clear-option-search');
  clearSearch.className = 'button search-picker-clear';
  clearSearch.hidden = !query;

  const results = make(document, 'ul', undefined, 'search-picker-results');
  results.dataset.optionResults = '';
  results.setAttribute('aria-label', `${optionTitle} 검색 결과`);
  const status = make(document, 'p', '', 'search-picker-status');
  status.dataset.optionStatus = '';
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  status.hidden = true;
  const retry = button(document, '다시 시도', 'button', 'retry-search-options');
  retry.dataset.optionTarget = target;
  retry.dataset.optionKind = kind;
  retry.hidden = true;
  const register = button(document, kind === 'beans' ? '원두 등록하기' : '레시피 등록하기', 'button', 'register-search-option');
  register.dataset.optionTarget = target;
  register.dataset.optionKind = kind;
  register.hidden = true;
  const more = button(document, '이름 더 보기', 'button', 'more-options');
  more.className = 'button search-picker-more';
  more.dataset.optionMore = '';
  more.dataset.optionTarget = target;
  more.dataset.optionKind = kind;
  more.hidden = !page?.hasMore;

  dialog.append(dialogHeader, search, clearSearch, status, retry, results, more, register);
  dialog.addEventListener('cancel', event => {
    event.preventDefault();
    closeSearchPicker(wrap);
  });
  wrap.append(dialog);
  renderSearchPicker(wrap, page, state, null, document);
  syncSearchPickerTrigger(wrap, null);
  return wrap;
}

function findSearchPicker(root, target, kind) {
  return Array.from(root.querySelectorAll('[data-search-picker]'))
    .find(picker => picker.dataset.optionTarget === target && picker.dataset.optionKind === kind) ?? null;
}

function closeSearchPicker(picker) {
  const dialog = picker?.querySelector('[data-option-picker]');
  if (dialog?.open) dialog.close();
  const trigger = picker?.querySelector('[data-action="open-search-picker"]');
  trigger?.setAttribute('aria-expanded', 'false');
  trigger?.focus?.();
}

function optionDetails(item, kind, data) {
  if (kind === 'beans') {
    const bean = data?.beans?.find(candidate => candidate.id === item.id);
    return [bean?.origin, bean?.process, bean?.roaster].filter(Boolean).join(' · ');
  }
  const recipe = data?.recipes?.find(candidate => candidate.id === item.id);
  if (recipe) return [recipe.dripper, recipe.dose ? `${recipe.dose}g` : '', recipe.temperature ? `${recipe.temperature}℃` : '']
    .filter(Boolean).join(' · ');
  if (item.beanId) return data?.beans?.find(bean => bean.id === item.beanId)?.name ?? '';
  return '';
}

function syncSearchPickerTrigger(picker, data) {
  const trigger = picker?.querySelector('[data-action="open-search-picker"]');
  const select = picker?.querySelector('select');
  if (!trigger || !select) return;
  const selected = Array.from(select.options).find(option => option.value === select.value);
  const item = Array.from(picker.querySelector('[data-option-results]')?.children ?? [])
    .map(row => row.querySelector('[data-option-id]'))
    .find(option => option?.dataset.optionId === select.value);
  const current = select.value ? selected?.textContent ?? item?.textContent ?? '선택 항목' : picker.dataset.emptyLabel;
  const value = trigger.querySelector('.search-picker-value');
  const details = trigger.querySelector('.search-picker-selection-details');
  const optionData = data?.[picker.dataset.optionKind]?.find(entry => entry.id === select.value);
  value.textContent = current;
  details.textContent = select.value ? optionDetails(optionData ?? { id: select.value }, picker.dataset.optionKind, data) : '';
  trigger.setAttribute('aria-label', select.value ? `${current}${details.textContent ? `, ${details.textContent}` : ''}` : picker.dataset.emptyLabel);
}

function renderSearchPicker(picker, page, state, data, document) {
  const target = picker.dataset.optionTarget;
  const kind = picker.dataset.optionKind;
  const dialog = picker.querySelector('[data-option-picker]');
  const search = dialog.querySelector('[data-option-search-kind]');
  const results = dialog.querySelector('[data-option-results]');
  const status = dialog.querySelector('[data-option-status]');
  const retry = dialog.querySelector('[data-action="retry-search-options"]');
  const register = dialog.querySelector('[data-action="register-search-option"]');
  const more = dialog.querySelector('[data-option-more]');
  const select = picker.querySelector('select');
  const requestState = state ?? { status: page ? 'ready' : 'idle', query: page?.query ?? '', append: false };
  const query = requestState.query ?? page?.query ?? '';
  const currentPage = page && (page.query ?? '') === query ? page : null;
  search.value = query;
  dialog.querySelector('[data-action="clear-option-search"]').hidden = !query;
  const loading = requestState.status === 'loading';
  const error = requestState.status === 'error';
  const items = (loading && !requestState.append) || (error && !currentPage) ? [] : currentPage?.items ?? [];
  results.replaceChildren(...items.map(item => buildSearchPickerResult(document, item, kind, target,
    idOf(select.value) === idOf(item.id), data)));
  retry.hidden = !error;
  register.hidden = true;
  more.hidden = !currentPage?.hasMore;
  more.disabled = loading && !!requestState.append;
  more.dataset.nextCursor = currentPage?.nextCursor ?? '';
  more.textContent = loading && requestState.append ? '더 불러오는 중…' : '이름 더 보기';
  status.hidden = false;
  if (loading) status.textContent = requestState.append ? '이름을 더 불러오는 중…' : `${kind === 'beans' ? '원두' : '레시피'} 목록을 불러오는 중…`;
  else if (error) status.textContent = `${kind === 'beans' ? '원두' : '레시피'}를 불러오지 못했습니다. 다시 시도해 주세요.`;
  else if (!items.length && query.trim()) status.textContent = currentPage?.hasMore
    ? '검색 결과가 없습니다. 다음 항목도 확인할 수 있습니다.' : '검색 결과가 없습니다.';
  else if (!items.length && currentPage?.hasMore) status.textContent = '항목을 더 확인할 수 있습니다.';
  else if (!items.length && requestState.status === 'ready' && currentPage?.complete !== false) {
    status.textContent = `등록된 ${kind === 'beans' ? '원두' : '레시피'}가 없습니다.`;
    register.hidden = false;
  } else if (!items.length) status.textContent = '이름을 검색하거나 목록을 불러와 주세요.';
  else status.hidden = true;
}

function recipeReady(recipe) {
  if (recipe.validationStatus !== undefined) return recipe.validationStatus === 'ready';
  return Array.isArray(recipe.steps) && recipe.steps.length > 0;
}

function preferredOptionPage(serverPage, cachedPage) {
  return cachedPage && Date.now() - cachedPage.savedAt < 60000 ? cachedPage : serverPage;
}

function renderRecords(pane, data, document, formOpen, optionPages, optionStates, route = '/records/new') {
  const form = buildRecordForm(document, data, optionPages, route, optionStates);
  form.id = 'new-record-form';
  pane.append(makeEntryDialog(document, 'records', form, formOpen));

  const filters = make(document, 'fieldset', undefined, 'record-filters');
  filters.append(make(document, 'legend', '기록 필터'));
  const beanPicker = searchPicker(document, '원두별 조회', 'beans', 'filters', preferredOptionPage(data.options?.filterBeans, optionPages.get('filters:beans')),
    '모든 원두', true, optionStates.get('filters:beans'));
  const beanSearch = beanPicker.querySelector('[data-option-search-kind]');
  beanSearch.dataset.recordFilterSearch = 'beanId';
  beanPicker.querySelector('select').dataset.recordFilter = 'beanId';
  const recipePicker = searchPicker(document, '레시피별 조회', 'recipes', 'filters', preferredOptionPage(data.options?.filterRecipes, optionPages.get('filters:recipes')),
    '모든 레시피', true, optionStates.get('filters:recipes'));
  const recipeSearch = recipePicker.querySelector('[data-option-search-kind]');
  recipeSearch.dataset.recordFilterSearch = 'recipeId';
  recipePicker.querySelector('select').dataset.recordFilter = 'recipeId';
  const selectedFilters = data.screen?.filters ?? {};
  filters.append(beanPicker, recipePicker);
  const beanSelect = beanPicker.querySelector('select');
  const recipeSelect = recipePicker.querySelector('select');
  if (selectedFilters.beanId) beanSelect.value = selectedFilters.beanId;
  if (selectedFilters.recipeId) recipeSelect.value = selectedFilters.recipeId;
  syncSearchPickerTrigger(beanPicker, data);
  syncSearchPickerTrigger(recipePicker, data);
  const reset = button(document, '필터 초기화', 'button', 'clear-record-filters');
  reset.className = 'button record-filter-reset';
  reset.disabled = !selectedFilters.beanId && !selectedFilters.recipeId;
  filters.append(reset);
  pane.append(filters);

  const list = make(document, 'div', undefined, 'record-list');
  list.dataset.recordList = '';
  pane.append(list);
  renderRecordRows(list, data, selectedFilters.beanId ?? '', selectedFilters.recipeId ?? '');
}

function currentRecords(data) {
  return Array.isArray(data?.records) ? data.records.filter(isCurrentRecord) : [];
}

function renderRecordRows(list, data, beanId, recipeId) {
  const visibleRecords = currentRecords(data);
  const records = visibleRecords
    .filter(record => (!beanId || record.beanId === beanId) && (!recipeId || record.recipeId === recipeId))
    .sort((a, b) => String(b.date ?? '').localeCompare(String(a.date ?? '')));
  list.replaceChildren();
  if (!records.length) {
    const pending = data.screen?.hasMore || data.screen?.complete === false;
    list.append(make(list.ownerDocument, 'p', pending ? '기록을 더 확인 중입니다. 더 보기를 눌러 계속 확인해 주세요.'
      : visibleRecords.length ? '선택한 조건에 맞는 기록이 없습니다.' : '새 버전에서 작성한 추출 기록이 없습니다.', 'empty-state'));
    return;
  }
  for (const record of records) list.append(recordCard(list.ownerDocument, record, data));
}

function recordCard(document, record, data) {
  const card = make(document, 'article', undefined, 'record-card');
  const bean = data.beans.find(item => item.id === record.beanId);
  const recipe = data.recipes.find(item => item.id === record.recipeId);
  const validSnapshot = record.snapshotStatus === 'valid' ? record.snapshot : null;
  const snapshotBean = validSnapshot?.version === 2 ? validSnapshot.bean : null;
  const snapshotRecipe = validSnapshot?.version === 2 ? validSnapshot.recipe : validSnapshot;
  const validRating = Number.isInteger(record.rating) && record.rating >= 1 && record.rating <= 5;
  const beanName = bean?.name || snapshotBean?.name || (record.beanNameStatus === 'loading'
    ? '원두 이름 확인 중' : record.beanNameStatus === 'error' ? '원두 이름 불러오기 실패' : '원두 확인 필요');
  const recipeName = recipe?.name || snapshotRecipe?.name || (record.recipeNameStatus === 'loading'
    ? '레시피 이름 확인 중' : record.recipeNameStatus === 'error' ? '레시피 이름 불러오기 실패' : '확인할 수 없는 레시피');
  const header = make(document, 'div', undefined, 'entity-card-header');
  header.append(make(document, 'h3', `${record.date || '날짜 확인 필요'} · ${beanName}`),
    trashButton(document, 'records', record.id, recordName(record, recipe, snapshotRecipe)));
  card.append(header);
  card.append(make(document, 'p', `레시피: ${recipeName} · ${record.rating ?? '별점 확인 필요'}/5 ${validRating ? '★'.repeat(record.rating) : ''}`));
  const nameNotes = [
    recordParentNameNote('beans', record.beanNameStatus, snapshotBean?.name),
    recordParentNameNote('recipes', record.recipeNameStatus, snapshotRecipe?.name),
  ].filter(Boolean);
  for (const note of nameNotes) card.append(make(document, 'p', note, 'muted-note'));
  if (record.beanResolution === 'needs-confirmation') card.append(make(document, 'p', '과거 원두 관계를 확인해야 합니다.', 'record-warning'));
  const invalidLabels = [
    ...(record.invalidFields?.includes('date') ? ['날짜'] : []),
    ...(record.invalidFields?.includes('rating') ? ['별점(정수 1~5)'] : []),
  ];
  if (invalidLabels.length) card.append(make(document, 'p', `기록 오류: ${invalidLabels.join(', ')}`, 'record-warning'));
  if (record.snapshotStatus === 'damaged') card.append(make(document, 'p', '스냅샷이 손상되어 당시 조건을 표시할 수 없습니다.', 'record-warning'));
  if (record.cupNote) card.append(make(document, 'p', `컵노트: ${record.cupNote}`));
  return card;
}

function recordParentNameNote(kind, status, snapshotName) {
  const name = kind === 'beans' ? '원두' : '레시피';
  if (status === 'loading') return snapshotName
    ? `기록 당시 ${name} 이름을 표시하며 현재 이름을 확인 중입니다.`
    : `현재 ${name} 이름을 확인 중입니다.`;
  if (status === 'snapshot') return `기록 당시 ${name} 이름을 표시합니다.`;
  if (status === 'unavailable') return `${name} 이름을 확인할 수 없습니다.`;
  if (status === 'error') return snapshotName
    ? `현재 ${name} 이름을 불러오지 못해 기록 당시 이름을 표시합니다.`
    : `현재 ${name} 이름을 불러오지 못했습니다.`;
  return '';
}

function addFormActions(document, form) {
  const actions = make(document, 'div', undefined, 'form-actions');
  const cancel = actionButton(document, '취소', 'button', 'x', 'cancel-form');
  const submit = actionButton(document, '저장', 'submit', 'save');
  submit.dataset.entrySubmit = '';
  submit.dataset.idleLabel = '저장';
  actions.append(cancel, submit);
  form.append(actions);
}

function fillSelect(select, rows, placeholder, optional = false) {
  select.replaceChildren();
  const first = select.ownerDocument.createElement('option');
  first.value = '';
  first.textContent = placeholder;
  first.disabled = !optional;
  first.selected = true;
  select.append(first);
  for (const row of rows) {
    const option = select.ownerDocument.createElement('option');
    option.value = idOf(row.id);
    option.textContent = row.name;
    option.disabled = row.status === 'error';
    select.append(option);
  }
}

function buildResolutionForm(document, operation) {
  const deleting = operation.kind.startsWith('delete-');
  const deleteNames = { beans: '원두', recipes: '레시피', records: '추출 기록' };
  const names = { beans: '원두', recipes: '레시피', records: '추출 기록' };
  const targetName = deleteNames[operation.targetKind] ?? '항목';
  const hasKnownPages = deleting || operation.knownPageCount > 0;
  const card = make(document, 'article', undefined, 'resolution-card');
  const status = deleting ? '삭제 여부 확인 필요' : operation.status === 'partial' ? '일부 저장' : '저장 여부 확인 필요';
  card.append(make(document, 'h3', `${deleting ? `${targetName} 삭제` : names[operation.kind] ?? '저장'} · ${status}`));
  card.append(make(document, 'p', deleting ? `Notion 원본에서 삭제 대상(${targetName})의 휴지통 이동 여부를 직접 확인해 주세요. 확인 과정에서는 삭제를 다시 요청하지 않습니다.` : hasKnownPages
    ? `확인된 항목 ${operation.knownPageCount}개. 원본에서 이 항목의 상태를 확인해 저장됨 또는 모두 보관 취소됨을 선택해 주세요.`
    : 'Notion 원본을 직접 확인하고, 이번 작업의 결과에 맞는 선택을 해 주세요.'));
  if (!hasKnownPages) card.append(make(document, 'p', '저장됨을 선택할 때는 이번 작업으로 새로 만들어진 모든 페이지의 ID를 입력해 주세요. ID는 상태 메시지에 표시하지 않습니다.', 'muted-note'));

  const form = make(document, 'form', undefined, 'form-grid resolution-form');
  const confirmed = label(document, 'Notion 원본에서 이번 작업의 결과를 직접 확인했습니다.', 'originalConfirmed', 'checkbox', true);
  form.append(confirmed);
  const decision = label(document, '확인 결과', 'decision', 'select', true);
  const select = decision.querySelector('select');
  const decisions = deleting ? [
    ['saved', `${targetName}: 휴지통에 있음을 확인함`],
    ['not-saved', `${targetName}: 삭제되지 않고 남아 있음을 확인함`],
  ] : [
    ['saved', '이번 작업의 저장을 확인함'],
    ['cancelled', '이번 작업의 새 항목을 모두 보관 취소함'],
  ];
  if (!hasKnownPages) decisions.splice(1, 0, ['not-saved', '이번 작업이 저장되지 않았음을 확인함']);
  for (const [value, title] of decisions) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = title;
    select.append(option);
  }
  form.append(decision);
  if (!hasKnownPages) form.append(label(document, '확인한 새 페이지 ID (저장됨이면 쉼표로 구분)', 'pageIds', 'text', false,
    { autocomplete: 'off', autocapitalize: 'off', spellcheck: false }));
  const submit = actionButton(document, '확인 결과 저장', 'submit', 'save');
  let resolving = false;
  form.append(submit);
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (resolving || submit.disabled) return;
    resolving = true;
    submit.disabled = true;
    setActionButton(submit, '저장 중…', 'saving');
    try {
      const resolved = await operation.resolve({
        originalConfirmed: confirmed.querySelector('input').checked,
        decision: select.value,
        pageIds: form.elements.pageIds?.value,
      });
      if (resolved === true) setActionButton(submit, '확인 완료', 'success');
      else {
        resolving = false;
        submit.disabled = false;
        setActionButton(submit, '확인 결과 저장', 'idle');
      }
    } catch {
      // Controller status is deliberately fixed text and never includes IDs, tokens, or API bodies.
      resolving = false;
      submit.disabled = false;
      setActionButton(submit, '확인 결과 저장', 'idle');
    }
  });
  card.append(form);
  return card;
}

function bindEvents({ page, nav, connectionForm, originalConnectionCheck, content, actions, document, view,
  openDeleteDialog, closeDeleteDialog, submitDelete }) {
  connectionForm.addEventListener('input', event => {
    if (!event.target.disabled) actions.setDirty(true, 'connection');
  });
  connectionForm.addEventListener('submit', async event => {
    event.preventDefault();
    const form = event.currentTarget;
    if (form.querySelector('button[type="submit"]')?.disabled || form.elements.token.disabled) return;
    const formData = new FormData(form);
    if (!view.beginConnectionSave()) return;
    try {
      await actions.connect({
        token: formData.get('token'),
        dataSources: Object.fromEntries(SOURCE_FIELDS.map(([key]) => [key, formData.get(key)])),
      });
    } catch { /* Safe status text is supplied by the controller. */ }
    finally { view.finishConnectionSave(); }
  });

  globalThis.window?.addEventListener?.('hashchange', () => view.renderRoute(globalThis.window.location.hash.slice(1)));

  const optionSearchTimers = new Map();
  const loadOptions = (target, kind, query = '', cursor = null, append = false) => {
    void actions.loadSearchOptions?.(kind, query, cursor, target, append);
  };
  const openSearchPicker = picker => {
    const state = actions.getState?.() ?? {};
    if (!picker || state.pending || state.frozen || state.unresolved) return;
    for (const openPicker of content.querySelectorAll('[data-option-picker]')) {
      if (!openPicker.open || openPicker === picker.querySelector('[data-option-picker]')) continue;
      closeSearchPicker(openPicker.closest('[data-search-picker]'));
    }
    const dialog = picker.querySelector('[data-option-picker]');
    const trigger = picker.querySelector('[data-action="open-search-picker"]');
    const search = picker.querySelector('[data-option-search-kind]');
    showNativeDialog(dialog);
    trigger?.setAttribute('aria-expanded', 'true');
    search?.focus?.();
  };
  const updateRecordFilters = () => {
    if (!windowData) return;
    const beanId = content.querySelector('[data-record-filter="beanId"]')?.value ?? '';
    const recipeId = content.querySelector('[data-record-filter="recipeId"]')?.value ?? '';
    const reset = content.querySelector('[data-action="clear-record-filters"]');
    if (reset) reset.disabled = !beanId && !recipeId;
    const update = actions.setRecordFilters?.({ beanId, recipeId });
    if (update?.catch) void update.catch(() => {});
  };
  const navigateTo = (next, replaceCurrent = null) => {
    const currentWindow = globalThis.window;
    if (!currentWindow?.location) { view.renderRoute(next); return; }
    if (replaceCurrent && currentWindow.history?.replaceState) {
      const base = `${currentWindow.location.pathname ?? ''}${currentWindow.location.search ?? ''}`;
      currentWindow.history.replaceState(null, '', `${base}#${replaceCurrent}`);
    }
    currentWindow.location.hash = next;
  };

  const handleClick = async event => {
    const openDialog = event.target.closest?.('[data-option-picker]');
    if (openDialog && event.target === openDialog) {
      closeSearchPicker(openDialog.closest('[data-search-picker]'));
      return;
    }
    const target = event.target.closest('[data-action]');
    const action = target?.dataset.action;
    if (!action || target.disabled) return;
    if (action === 'open-search-picker') {
      openSearchPicker(target.closest('[data-search-picker]'));
      return;
    }
    if (action === 'close-search-picker') {
      closeSearchPicker(target.closest('[data-search-picker]'));
      return;
    }
    if (action === 'select-search-option') {
      const picker = target.closest('[data-search-picker]');
      const select = picker?.querySelector('select');
      const optionId = target.dataset.optionId;
      if (!select || !optionId || target.disabled) return;
      if (!Array.from(select.options).some(option => option.value === optionId)) {
        const selectedOption = document.createElement('option');
        selectedOption.value = optionId;
        selectedOption.textContent = target.querySelector('.search-picker-result-name')?.textContent ?? '선택 항목';
        select.append(selectedOption);
      }
      select.value = optionId;
      syncSearchPickerTrigger(picker, windowData);
      closeSearchPicker(picker);
      const form = select.form;
      if (FORM_KINDS.has(form?.dataset.form)) actions.setDirty(true, form.dataset.form);
      if (select.matches('[data-record-filter]')) updateRecordFilters();
      return;
    }
    if (action === 'clear-option-search') {
      const picker = target.closest('[data-search-picker]');
      const search = picker?.querySelector('[data-option-search-kind]');
      if (!search) return;
      search.value = '';
      view.setSearchOptionsState?.(search.dataset.optionTarget, search.dataset.optionSearchKind,
        { status: 'loading', query: '' });
      search.focus?.();
      loadOptions(search.dataset.optionTarget, search.dataset.optionSearchKind, '');
      return;
    }
    if (action === 'retry-search-options') {
      const picker = target.closest('[data-search-picker]');
      const search = picker?.querySelector('[data-option-search-kind]');
      if (search) loadOptions(search.dataset.optionTarget, search.dataset.optionSearchKind, search.value);
      return;
    }
    if (action === 'register-search-option') {
      const picker = target.closest('[data-search-picker]');
      const kind = target.dataset.optionKind;
      if (!picker || !['beans', 'recipes'].includes(kind)) return;
      closeSearchPicker(picker);
      navigateTo(kind === 'beans' ? '/beans' : '/recipes');
      return;
    }
    if (action === 'clear-record-filters') {
      for (const select of content.querySelectorAll('[data-record-filter]')) {
        select.value = '';
        syncSearchPickerTrigger(select.closest('[data-search-picker]'), windowData);
      }
      target.disabled = true;
      updateRecordFilters();
      return;
    }
    if (action === 'cancel-delete') {
      if (closeDeleteDialog() === 'cancelled') view.showStatus({ type: 'cancelled', message: '삭제를 취소했습니다.' });
      return;
    }
    if (action === 'confirm-delete') {
      await submitDelete();
      return;
    }
    if (action === 'edit-connection') {
      view.editConnection();
      return;
    }
    if (action === 'retry-initialize') {
      try { await actions.initialize(); } catch { /* Safe status text is supplied by the controller. */ }
      return;
    }
    if (action === 'navigate' || action === 'back-to-beans' || action === 'back-to-recipes') {
      navigateTo(target.dataset.route);
      return;
    }
    if (action === 'resume-record-draft') {
      navigateTo(view.resolveRecordDraft());
      return;
    }
    if (action === 'start-new-record') {
      view.resolveRecordDraft(true);
      return;
    }
    if (action === 'start-brew') {
      navigateTo('/brew/bean');
      return;
    }
    if (action === 'select-brew-bean') {
      const beanId = target.dataset.beanId;
      if (!beanId) return;
      navigateTo(`/brew/recipe?beanId=${encodeURIComponent(beanId)}`,
        `/brew/bean?selectedBeanId=${encodeURIComponent(beanId)}`);
      return;
    }
    if (action === 'select-brew-recipe') {
      const { beanId, recipeId } = target.dataset;
      if (!beanId || !recipeId) return;
      navigateTo(`/brew/run?beanId=${encodeURIComponent(beanId)}&recipeId=${encodeURIComponent(recipeId)}`,
        `/brew/recipe?beanId=${encodeURIComponent(beanId)}&selectedRecipeId=${encodeURIComponent(recipeId)}`);
      return;
    }
    if (action === 'complete-brew') {
      const { beanId, recipeId } = target.dataset;
      if (!beanId || !recipeId) return;
      navigateTo(`/records/new?beanId=${encodeURIComponent(beanId)}&recipeId=${encodeURIComponent(recipeId)}&date=${localDate()}`);
      return;
    }
    if (action === 'cancel-connection') {
      if (view.cancelConnection()) view.showStatus({ type: 'cancelled', message: '연결 입력을 취소했습니다.' });
      return;
    }
    if (['delete-bean', 'delete-recipe', 'delete-record'].includes(action)) {
      const state = actions.getState?.() ?? {};
      if (target.disabled || state.pending || state.frozen || state.unresolved) return;
      openDeleteDialog(target, action);
      return;
    }
    if (action === 'show-bean-form') {
      view.showBeanForm();
      return;
    }
    if (action === 'show-recipe-form') {
      view.showRecipeForm();
      return;
    }
    if (action === 'show-record-form') {
      view.showRecordForm();
      loadOptions('form', 'beans');
      loadOptions('form', 'recipes');
      return;
    }
    if (action === 'load-more') {
      try { await actions.loadMore?.(); } catch { /* Controller supplies a safe status. */ }
      return;
    }
    if (action === 'more-options') {
      const { optionTarget: targetName, optionKind: kind } = target.dataset;
      const picker = target.closest('.form-field') ?? target.closest('.brew-flow-pane');
      const search = picker?.querySelector('[data-option-search-kind]');
      const select = picker?.querySelector('select');
      loadOptions(targetName, kind, search?.value ?? '', target.dataset.nextCursor || select?.dataset.nextCursor || null, true);
      return;
    }
    if (action === 'cancel-form') {
      const kind = target.closest('form')?.dataset.form;
      const state = actions.getState?.() ?? {};
      if (state.pending || state.frozen || target.closest('dialog')?.dataset.saveState === 'success') return;
      if (kind && FORM_KINDS.has(kind)) {
        view.clearDraft(kind);
        actions.setDirty(false, kind);
        view.showStatus({ type: 'cancelled', message: '입력을 취소했습니다.' });
      }
      return;
    }
    if (action === 'new-record') {
      const recipeId = target.dataset.id;
      const form = navigateAndGetForm(view, content, '/records/new', 'records');
      if (form) {
        const option = document.createElement('option');
        const recipe = windowData?.recipes.find(item => item.id === recipeId);
        option.value = recipeId;
        option.textContent = recipe?.name ?? '선택한 레시피';
        if (!Array.from(form.elements.recipeId.options).some(item => item.value === recipeId)) form.elements.recipeId.append(option);
        form.elements.recipeId.value = recipeId;
        syncSearchPickerTrigger(form.elements.recipeId.closest('[data-search-picker]'), windowData);
        actions.setDirty(true, 'records');
      }
      return;
    }
    if (action === 'confirm-connection') {
      if (!originalConnectionCheck.querySelector('input[name="originalConfirmed"]')?.checked) {
        view.showStatus({ type: 'resolution-required', message: '원본 연결 파일을 직접 확인한 뒤 복구를 진행해 주세요.' });
        return;
      }
      try { await actions.confirmCurrent(true); } catch { /* Controller uses a fixed safe message. */ }
      return;
    }
    if (action === 'add-step') {
      addStep(content, document);
      updatePreview(content);
      actions.setDirty(true, 'recipes');
      return;
    }
    if (action === 'remove-step') {
      target.closest('.step-row')?.remove();
      renumberSteps(content);
      updatePreview(content);
      actions.setDirty(true, 'recipes');
      return;
    }
    if (action === 'copy-recipe') {
      const source = windowData?.recipes.find(item => item.id === target.dataset.id);
      if (!source) return;
      const form = navigateAndGetForm(view, content, '/recipes/new', 'recipes');
      if (!form) return;
      for (const key of ['name', 'dripper', 'dose', 'grind', 'grinder', 'grinderSetting', 'extractionGuide', 'microns', 'temperature', 'totalWater']) {
        if (form.elements[key]) form.elements[key].value = source[key] ?? '';
      }
      form.elements.name.value = `${source.name} 복사`;
      form.dataset.copyId = source.id;
      setSteps(form, source.steps);
      actions.setDirty(true, 'recipes');
    }
  };
  page.addEventListener('click', handleClick);
  if (nav.parentElement !== page) nav.addEventListener('click', handleClick);

  content.addEventListener('input', event => {
    if (event.target.disabled) return;
    if (event.target.matches('[data-option-search-kind]')) {
      const { optionSearchKind: kind, optionTarget: targetName } = event.target.dataset;
      const key = `${targetName}:${kind}`;
      const searchRoute = view.currentRoute();
      event.target.dataset.optionLoaded = 'false';
      view.setSearchOptionsState?.(targetName, kind, { status: 'loading', query: event.target.value });
      clearTimeout(optionSearchTimers.get(key));
      optionSearchTimers.set(key, setTimeout(() => {
        if (view.currentRoute() === searchRoute) loadOptions(targetName, kind, event.target.value);
      }, 250));
      return;
    }
    const form = event.target.form;
    if (FORM_KINDS.has(form?.dataset.form)) actions.setDirty(true, form.dataset.form);
    updatePreview(content);
    event.target.removeAttribute('aria-invalid');
  });
  content.addEventListener('change', event => {
    if (event.target.disabled) return;
    if (event.target.matches('[data-record-filter]')) updateRecordFilters();
    updatePreview(content);
  });
  content.addEventListener('focusin', event => {
    const select = event.target.closest('[data-option-select-kind]');
    const search = event.target.closest('[data-option-search-kind]');
    const control = search ?? select;
    if (!control || control.dataset.optionLoaded === 'true') return;
    loadOptions(control.dataset.optionTarget, control.dataset.optionSearchKind ?? control.dataset.optionSelectKind,
      search?.value ?? '');
  });
  content.addEventListener('submit', async event => {
    const form = event.target;
    const kind = form.dataset.form;
    if (!FORM_KINDS.has(kind)) return;
    event.preventDefault();
    const state = actions.getState?.() ?? {};
    if (state.pending || state.frozen || state.unresolved || form.closest('dialog')?.dataset.saveState === 'success') return;
    if (kind === 'records') {
      const missingName = [['beanId', '원두'], ['recipeId', '레시피']]
        .find(([name]) => !form.elements[name]?.value);
      if (missingName) {
        const picker = Array.from(form.querySelectorAll('[data-search-picker]'))
          .find(item => item.dataset.optionKind === (missingName[0] === 'beanId' ? 'beans' : 'recipes'));
        view.showStatus({ type: 'validation-error', message: `${missingName[1]}를 선택해 주세요.` });
        openSearchPicker(picker);
        return;
      }
    }
    clearInvalidFields(form);
    let payload;
    try {
      payload = kind === 'recipes' ? recipePayload(form) : Object.fromEntries(new FormData(form));
    } catch {
      view.showStatus({ type: 'validation-error', message: '입력값이나 최신 원본 관계를 확인해 주세요.' });
      return;
    }
    try {
      if (kind === 'recipes' && form.dataset.copyId) {
        await actions.submit('copy', { recipeId: form.dataset.copyId, changes: payload });
      } else {
        await actions.submit(kind, payload);
      }
    } catch {
      // Controller status is the single user-facing report for a failed operation.
    }
  });
  page.addEventListener('invalid', event => {
    const field = event.target;
    if (field?.form) {
      markInvalidField(field.form, field);
      view.showStatus({ type: 'validation-error', message: '필수 입력과 입력 범위를 확인해 주세요.' });
    }
  }, true);

  let windowData = null;
  const originalRender = view.renderData;
  view.renderData = data => {
    windowData = data;
    originalRender(data);
  };
}

function navigateAndGetForm(view, content, nextRoute, kind) {
  if (globalThis.window?.location) globalThis.window.location.hash = nextRoute;
  view.renderRoute(nextRoute);
  return content.querySelector(`form[data-form="${kind}"]`);
}

function addStep(content, document) {
  const form = content.querySelector('form[data-form="recipes"]');
  if (!form) return;
  const wrap = form.querySelector('[data-steps]');
  const index = wrap.children.length + 1;
  const row = make(document, 'fieldset', undefined, 'step-row');
  row.append(make(document, 'legend', `단계 ${index}`));
  row.append(label(document, '단계 이름 (선택)', 'stepName', 'text', false));
  row.append(label(document, '누적 시간 (분:초)', 'time', 'text', true,
    { placeholder: index === 1 ? '0:00' : '0:30', inputMode: 'text', pattern: '\\d+:[0-5]\\d' }));
  row.append(label(document, '이번 물 양 (g)', 'water', 'number', true, { min: 0, step: 'any' }));
  row.append(button(document, '단계 제거', 'button', 'remove-step'));
  wrap.append(row);
}

function setSteps(form, steps) {
  const panel = form.closest('.data-panel');
  const wrap = form.querySelector('[data-steps]');
  wrap.replaceChildren();
  for (const step of steps) {
    addStep(panel, form.ownerDocument);
    const row = wrap.lastElementChild;
    row.querySelector('[name="stepName"]').value = step.name;
    row.querySelector('[name="time"]').value = formatTime(step.seconds);
    row.querySelector('[name="water"]').value = step.water;
  }
  updatePreview(panel);
}

function recipePayload(form) {
  const values = Object.fromEntries(new FormData(form));
  for (const key of ['dose', 'temperature', 'totalWater']) values[key] = Number(values[key]);
  values.microns = values.microns === '' ? '' : Number(values.microns);
  values.steps = [...form.querySelectorAll('.step-row')].map(row => ({
    name: row.querySelector('[name="stepName"]').value,
    time: row.querySelector('[name="time"]').value,
    water: Number(row.querySelector('[name="water"]').value),
  }));
  return values;
}

function updatePreview(content) {
  const form = content.querySelector('form[data-form="recipes"]');
  if (!form) return;
  const preview = form.querySelector('.recipe-preview');
  const rows = [...form.querySelectorAll('.step-row')];
  if (!rows.length) {
    preview.textContent = '단계를 추가해 주세요.';
    return;
  }
  const table = make(content.ownerDocument, 'table', undefined, 'steps-preview-table');
  const head = make(content.ownerDocument, 'thead');
  const heading = make(content.ownerDocument, 'tr');
  for (const title of ['누적 시간', '간격', '이번 물 양', '누적 물 양']) heading.append(make(content.ownerDocument, 'th', title));
  head.append(heading);
  table.append(head);
  const body = make(content.ownerDocument, 'tbody');
  let previous = null;
  let cumulative = 0;
  for (const [index, row] of rows.entries()) {
    const seconds = parseInputTime(row.querySelector('[name="time"]').value);
    const waterText = row.querySelector('[name="water"]').value;
    const water = Number(waterText);
    if (Number.isFinite(water) && water > 0) cumulative += water;
    const tr = make(content.ownerDocument, 'tr');
    const values = [
      seconds === null ? '시간 확인' : formatTime(seconds),
      seconds === null ? '—' : `${index === 0 ? 0 : seconds - (previous ?? seconds)}초`,
      waterText ? `${waterText}g` : '—',
      `${Number(cumulative.toFixed(6))}g`,
    ];
    for (const value of values) tr.append(make(content.ownerDocument, 'td', value));
    body.append(tr);
    if (seconds !== null) previous = seconds;
  }
  table.append(body);
  preview.replaceChildren(table);
  preview.append(make(content.ownerDocument, 'p', `단계 물 합계 ${Number(cumulative.toFixed(6))}g`, 'preview-total'));
}

function recordFlowKey(route) {
  const params = routeParams(route);
  if (routePath(route) !== '/records/new') return '';
  return JSON.stringify([params.get('beanId') ?? '', params.get('recipeId') ?? '', params.get('date') || localDate()]);
}

function saveActiveDraft(content, drafts) {
  const form = content.querySelector('form[data-form]');
  if (!form || form.closest('dialog')?.dataset.saveState === 'success') return;
  const values = {};
  for (const field of form.querySelectorAll('input[name],textarea[name],select[name]')) {
    if (field.closest('.step-row') || (field.type === 'radio' && !field.checked)) continue;
    values[field.name] = field.value;
  }
  if (form.dataset.form === 'records') {
    values.rating = form.elements.rating.value;
    const initial = JSON.parse(form.dataset.initialValues || '{}');
    if (Object.keys(initial).every(name => values[name] === initial[name])) return;
  }
  const steps = [...form.querySelectorAll('.step-row')].map(row =>
    Object.fromEntries([...row.querySelectorAll('[name]')].map(field => [field.name, field.value])));
  drafts.set(form.dataset.form, { values, steps, copyId: form.dataset.copyId || null,
    route: form.dataset.draftRoute, flowKey: form.dataset.draftFlow });
}

function restoreDraft(form, draft, data) {
  if (!draft) return;
  for (const [name, value] of Object.entries(draft.values)) {
    const field = form.elements[name];
    if (field?.tagName?.toLowerCase() === 'select' && value &&
        !Array.from(field.options).some(option => option.value === value)) {
      const kind = name === 'beanId' ? 'beans' : 'recipes';
      const selected = data[kind]?.find(item => item.id === value);
      const option = make(form.ownerDocument, 'option', selected?.name ?? (kind === 'beans' ? '이전 선택 원두' : '이전 선택 레시피'));
      option.value = value;
      field.append(option);
    }
    if (field) field.value = value;
  }
  if (form.dataset.form === 'records') {
    for (const name of ['beanId', 'recipeId']) {
      const picker = form.elements[name]?.closest('[data-search-picker]');
      if (picker) syncSearchPickerTrigger(picker, data);
    }
  }
  if (form.dataset.form === 'recipes' && draft.steps?.length) {
    const panel = form.closest('.data-panel');
    const wrap = form.querySelector('[data-steps]');
    wrap.replaceChildren();
    for (const values of draft.steps) {
      addStep(panel, form.ownerDocument);
      const row = wrap.lastElementChild;
      for (const [name, value] of Object.entries(values)) {
        const field = row.querySelector(`[name="${name}"]`);
        if (field) field.value = value;
      }
    }
    updatePreview(panel);
  }
  if (draft.copyId) form.dataset.copyId = draft.copyId;
}

function renumberSteps(content) {
  [...content.querySelectorAll('.step-row')].forEach((row, index) => {
    row.querySelector('legend').textContent = `단계 ${index + 1}`;
    row.querySelector('[name="time"]').placeholder = index === 0 ? '0:00' : '0:30';
  });
}

function clearInvalidFields(form) {
  form.querySelectorAll('[aria-invalid="true"]').forEach(item => item.removeAttribute('aria-invalid'));
}

function markInvalidField(form, field) {
  clearInvalidFields(form);
  const target = field || form.querySelector('[required]:invalid') || form.querySelector('input,select,textarea');
  target?.setAttribute('aria-invalid', 'true');
}

function updateNavigationCurrent(document, route) {
  const section = routePath(route).split('/').filter(Boolean)[0] ?? 'home';
  const selected = section === 'brew' ? 'home' : section;
  document.querySelectorAll('.tabs [data-route]').forEach(item => {
    const key = item.dataset.route.split('/').filter(Boolean)[0];
    if (key === selected) item.setAttribute('aria-current', 'page');
    else item.removeAttribute('aria-current');
  });
}

function parseInputTime(value) {
  const match = /^(\d+):([0-5]\d)$/.exec(value);
  if (!match) return null;
  const seconds = Number(match[1]) * 60 + Number(match[2]);
  return Number.isSafeInteger(seconds) ? seconds : null;
}

function formatTime(seconds) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

function isIsoDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value ?? '')) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function localDate() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
