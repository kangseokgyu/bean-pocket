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
const AUTO_HIDE_STATUS_TYPES = new Set(['connected', 'saved', 'resolved', 'cancelled']);
const STATUS_DISPLAY_MS = 3000;
const SOURCE_FIELDS = Object.freeze([
  ['beans', '원두'], ['recipes', '레시피'],
  ['steps', '레시피 단계'], ['records', '추출 기록'],
]);

export function createAppView(document = globalThis.document, { schedule = setTimeout, cancelSchedule = clearTimeout } = {}) {
  const root = document.querySelector('#app-root');
  if (!root) throw new Error('앱 화면을 만들 수 없습니다.');
  const page = make(document, 'div', undefined, 'app-content');
  root.replaceChildren(page);

  let currentState = { frozen: false, pending: false, unresolved: false };
  let statusType = '';
  let statusMessageText = '';
  let startupMessageText = '';
  let statusPopoverOpen = false;
  let statusPopoverUnsupported = false;
  function syncStatusToast(promote = false) {
    const visible = !status.hidden;
    const openDialog = [...page.querySelectorAll('dialog')].find(dialog => dialog.open);
    if (!visible) {
      if (statusPopoverOpen) status.hidePopover();
      statusPopoverOpen = false;
      if (status.parentElement !== page) page.append(status);
      if (!statusPopoverUnsupported && typeof status.showPopover === 'function' && status.getAttribute('popover') !== 'manual') {
        status.setAttribute('popover', 'manual');
      }
      return;
    }

    if (openDialog) {
      if (statusPopoverOpen) status.hidePopover();
      statusPopoverOpen = false;
      status.removeAttribute('popover');
      if (status.parentElement !== openDialog) openDialog.append(status);
      return;
    }

    if (status.parentElement !== page) page.append(status);
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
    skeletons.hidden = !currentState.pending || !!currentData ||
      (!startupChecking && connection.dataset.connected !== 'true');
    const active = currentState.pending && !startupChecking;
    status.dataset.pending = String(active);
    statusMessage.textContent = statusMessageText || (active ? '불러오는 중…' : '');
    status.setAttribute('role', assertiveStatus ? 'alert' : 'status');
    status.setAttribute('aria-live', assertiveStatus ? 'assertive' : 'polite');
    status.setAttribute('aria-busy', String(currentState.pending));
    status.hidden = startupChecking || (!active && !statusMessageText);
    syncStatusToast(promoteToast);

    loadingSpinner.className = `pull-refresh-spinner ${startupChecking ? 'startup-spinner' : 'operation-spinner'}`;
    loadingSpinner.hidden = !currentState.pending;
    loading.hidden = !currentState.pending;
    loadingSurface.inert = currentState.pending && startupChecking;
    if (!currentState.pending) {
      loading.replaceChildren();
      loading.removeAttribute('aria-hidden');
      loading.removeAttribute('aria-busy');
    } else if (startupChecking) {
      loading.removeAttribute('aria-hidden');
      loading.setAttribute('aria-busy', 'true');
      loadingStartupMessage.textContent = startupMessageText;
      loading.replaceChildren(loadingSpinner, loadingStartupMessage);
    } else {
      loading.setAttribute('aria-hidden', 'true');
      loading.setAttribute('aria-busy', 'true');
      loading.replaceChildren(loadingSpinner);
    }
  }
  function scheduleStatusHide() {
    clearTimeout(statusHideTimer);
    if (currentState.pending || !AUTO_HIDE_STATUS_TYPES.has(statusType) || !statusMessageText) return;
    statusHideTimer = setTimeout(() => {
      if (currentState.pending) return;
      statusMessageText = '';
      renderStatus();
    }, STATUS_DISPLAY_MS);
  }
  let currentData = null;
  let route = globalThis.location?.hash?.slice(1) || '/beans';
  let routeChangeListener = null;
  const drafts = new Map();
  const optionPages = new Map();
  let beanFormOpen = false;
  let recipeFormOpen = route === '/recipes/new';
  let recordFormOpen = route === '/records/new';
  let statusHideTimer;

  const status = make(document, 'p', '', 'app-status');
  status.hidden = true;
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  status.setAttribute('popover', 'manual');
  const statusMessage = make(document, 'span', '', 'status-message');
  status.append(statusMessage);
  page.append(status);

  const loading = make(document, 'div', undefined, 'startup-loading');
  loading.hidden = true;
  loading.setAttribute('role', 'status');
  loading.setAttribute('aria-live', 'polite');
  const loadingSpinner = makeSpinner(document);
  loadingSpinner.hidden = true;
  const loadingStartupMessage = make(document, 'span', undefined, 'visually-hidden');
  (document.body ?? page).append(loading);
  const loadingSurface = document.querySelector('.page') ?? page;
  function finishStartup() {
    if (currentState.pending) return;
    loading.hidden = true;
    loading.replaceChildren();
    loading.removeAttribute('aria-hidden');
    loading.removeAttribute('aria-busy');
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
  const connectionCancel = button(document, '연결 입력 취소', 'button', 'cancel-connection');
  const connectionSubmit = button(document, '연결 확인 및 저장');
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
    connectionSubmit.textContent = succeeded ? '연결 저장 완료' : busy ? '연결 확인·저장 중…' : '연결 확인 및 저장';
  }

  const startupRetry = make(document, 'section', undefined, 'startup-retry-panel');
  startupRetry.hidden = true;
  startupRetry.append(make(document, 'h2', '저장된 연결을 확인하지 못했습니다'));
  startupRetry.append(make(document, 'p', '다른 창이 저장소를 사용 중이면 잠시 기다린 뒤, 연결 정보를 입력하지 말고 다시 시도해 주세요.'));
  startupRetry.append(button(document, '저장된 연결 다시 읽기', 'button', 'retry-initialize'));
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
    ['beans', '원두'], ['recipes', '레시피'], ['records', '추출 기록'],
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
        if (phase === 'success') submit.textContent = '저장 완료';
        else if (saving) submit.textContent = '저장 중…';
        else submit.textContent = submit.dataset.idleLabel || '저장';
      }
      if (cancel) cancel.disabled = currentState.pending || currentState.frozen || phase === 'success';
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
      beanFormOpen, recipeFormOpen, recordFormOpen);
    finishContentRender();
    applyViewState();
  }
  function restoreEntryFocus(kind) {
    const action = { beans: 'show-bean-form', recipes: 'show-recipe-form', records: 'show-record-form' }[kind];
    (content.querySelector(`[data-action="${action}"]`) ?? nav.querySelector('[data-route="/beans"]'))?.focus?.();
  }

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
    showConnection(value) {
      const connected = !!value?.connected;
      const retryInitialization = !!value?.retryInitialization;
      const checkingInitialization = !!value?.checkingInitialization;
      connection.dataset.connected = connected ? 'true' : 'false';
      connectionAvailable = !checkingInitialization;
      connectionDetails.hidden = retryInitialization || checkingInitialization;
      startupRetry.hidden = !retryInitialization;
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
    renderData(nextData) {
      saveActiveDraft(content, drafts);
      currentData = nextData;
      skeletons.hidden = true;
      renderCurrentContent();
    },
    currentRoute() { return route; },
    onRouteChange(handler) { routeChangeListener = typeof handler === 'function' ? handler : null; },
    renderRoute(nextRoute) {
      route = nextRoute || '/beans';
      if (route === '/recipes/new') recipeFormOpen = true;
      if (route === '/records/new') recordFormOpen = true;
      if (currentData) {
        saveActiveDraft(content, drafts);
        renderCurrentContent();
      }
      routeChangeListener?.(route);
    },
    showBeanForm() { openEntryForm('beans', 'show-bean-form', 'name'); },
    showRecipeForm() { openEntryForm('recipes', 'show-recipe-form', 'name'); },
    showRecordForm() { openEntryForm('records', 'show-record-form', 'date'); },
    setSearchOptions(target, kind, page, append = false, query = '') {
      const select = target === 'filters'
        ? content.querySelector(`[data-record-filter="${kind === 'beans' ? 'beanId' : 'recipeId'}"]`)
        : content.querySelector(`form[data-form="records"] [data-option-select-kind="${kind}"]`);
      if (!select) return;
      const filterKey = kind === 'beans' ? 'beanId' : 'recipeId';
      const previousValue = select.value || (target === 'filters' ? currentData?.screen?.filters?.[filterKey] : '');
      const previousOption = Array.from(select.options).find(option => option.value === previousValue);
      const placeholder = select.options[0]?.textContent ?? (kind === 'beans' ? '원두를 선택해 주세요.' : '레시피를 선택해 주세요.');
      const optional = target === 'filters';
      const optionKey = `${target}:${kind}`;
      const previousPage = optionPages.get(optionKey);
      const optionItems = append && previousPage
        ? [...previousPage.items, ...(page.items ?? []).filter(item => !previousPage.items.some(existing => existing.id === item.id))]
        : [...(page.items ?? [])];
      if (previousValue && !optionItems.some(item => item.id === previousValue)) {
        optionItems.push({ id: previousValue, name: previousOption?.textContent ?? '선택한 항목', status: 'ready' });
      }
      optionPages.set(optionKey, { ...page, items: optionItems, query, savedAt: Date.now() });
      if (append) {
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
      if (more) more.hidden = !page.hasMore;
    },
    clearSearchOptions(kind) {
      for (const key of optionPages.keys()) if (!kind || key.endsWith(`:${kind}`)) optionPages.delete(key);
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
        unresolved, actions, document, view });
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

function renderPane(parent, data, document, route = '/beans', drafts = new Map(), optionPages = new Map(),
  beanFormOpen = false, recipeFormOpen = false, recordFormOpen = false) {
  const parts = route.split('/').filter(Boolean);
  const section = parts[0] ?? 'beans';
  const pane = make(document, 'div', undefined, 'list-view');
  pane.dataset.section = section;
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
    renderRecords(pane, data, document, recordFormOpen, optionPages);
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
  addFormActions(document, form, 'beans');
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
  addFormActions(document, form, 'recipes');
  return form;
}

function buildRecordForm(document, data, optionPages) {
  const form = formBase(document, 'records', '추출 후 빠른 기록');
  const fields = make(document, 'fieldset', undefined, 'form-fieldset');
  fields.append(make(document, 'legend', '기록'));
  fields.append(searchPicker(document, '원두', 'beans', 'form', preferredOptionPage(data.options?.beans, optionPages.get('form:beans')),
    '원두를 선택해 주세요.', false));
  fields.append(searchPicker(document, '레시피', 'recipes', 'form', preferredOptionPage(data.options?.recipes, optionPages.get('form:recipes')),
    '레시피를 선택해 주세요.', false));
  fields.append(label(document, '날짜', 'date', 'date', true));
  fields.append(label(document, '별점 (1~5)', 'rating', 'number', true, { min: 1, max: 5, step: 1 }));
  fields.append(label(document, '컵노트 (선택)', 'cupNote', 'textarea', false));
  form.append(fields);
  addFormActions(document, form, 'records');
  form.elements.date.value = localDate();
  return form;
}

function searchPicker(document, title, kind, target, page, placeholder, optional) {
  const wrap = make(document, 'div', undefined, 'form-field');
  wrap.append(make(document, 'span', title, 'form-field-label'));
  const search = make(document, 'input');
  search.type = 'search';
  search.setAttribute('aria-label', `${title} 검색`);
  search.setAttribute('autocomplete', 'off');
  search.dataset.optionSearchKind = kind;
  search.dataset.optionTarget = target;
  wrap.append(search);
  const select = make(document, 'select');
  select.name = kind === 'beans' ? 'beanId' : 'recipeId';
  select.required = !optional;
  select.setAttribute('aria-label', title);
  select.dataset.optionSelectKind = kind;
  select.dataset.optionTarget = target;
  fillSelect(select, page?.items ?? [], placeholder, optional);
  if (page) {
    select.dataset.optionLoaded = 'true';
    select.dataset.nextCursor = page.nextCursor ?? '';
    search.dataset.optionLoaded = 'true';
    search.dataset.optionQuery = '';
  }
  wrap.append(select);
  const more = button(document, '이름 더 보기', 'button', 'more-options');
  more.dataset.optionMore = '';
  more.dataset.optionTarget = target;
  more.dataset.optionKind = kind;
  more.hidden = !page?.hasMore;
  wrap.append(more);
  return wrap;
}

function recipeReady(recipe) {
  if (recipe.validationStatus !== undefined) return recipe.validationStatus === 'ready';
  return Array.isArray(recipe.steps) && recipe.steps.length > 0;
}

function preferredOptionPage(serverPage, cachedPage) {
  return cachedPage && Date.now() - cachedPage.savedAt < 60000 ? cachedPage : serverPage;
}

function renderRecords(pane, data, document, formOpen, optionPages) {
  const form = buildRecordForm(document, data, optionPages);
  form.id = 'new-record-form';
  pane.append(makeEntryDialog(document, 'records', form, formOpen));

  const filters = make(document, 'fieldset', undefined, 'record-filters');
  filters.append(make(document, 'legend', '기록 필터'));
  const beanPicker = searchPicker(document, '원두별 조회', 'beans', 'filters', preferredOptionPage(data.options?.filterBeans, optionPages.get('filters:beans')),
    '모든 원두', true);
  const beanSearch = beanPicker.querySelector('[data-option-search-kind]');
  beanSearch.dataset.recordFilterSearch = 'beanId';
  beanPicker.querySelector('select').dataset.recordFilter = 'beanId';
  const recipePicker = searchPicker(document, '레시피별 조회', 'recipes', 'filters', preferredOptionPage(data.options?.filterRecipes, optionPages.get('filters:recipes')),
    '모든 레시피', true);
  const recipeSearch = recipePicker.querySelector('[data-option-search-kind]');
  recipeSearch.dataset.recordFilterSearch = 'recipeId';
  recipePicker.querySelector('select').dataset.recordFilter = 'recipeId';
  const selectedFilters = data.screen?.filters ?? {};
  filters.append(beanPicker, recipePicker);
  const beanSelect = beanPicker.querySelector('select');
  const recipeSelect = recipePicker.querySelector('select');
  if (selectedFilters.beanId) beanSelect.value = selectedFilters.beanId;
  if (selectedFilters.recipeId) recipeSelect.value = selectedFilters.recipeId;
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
  const snapshotRecipe = validSnapshot?.version === 2 ? validSnapshot.recipe : validSnapshot;
  const validRating = Number.isInteger(record.rating) && record.rating >= 1 && record.rating <= 5;
  const header = make(document, 'div', undefined, 'entity-card-header');
  header.append(make(document, 'h3', `${record.date || '날짜 확인 필요'} · ${bean?.name || '원두 확인 필요'}`),
    trashButton(document, 'records', record.id, recordName(record, recipe, snapshotRecipe)));
  card.append(header);
  card.append(make(document, 'p', `레시피: ${recipe?.name || snapshotRecipe?.name || '확인할 수 없는 레시피'} · ${record.rating ?? '별점 확인 필요'}/5 ${validRating ? '★'.repeat(record.rating) : ''}`));
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

function addFormActions(document, form, kind) {
  const nouns = { beans: '원두', recipes: '레시피', records: '기록' };
  const actions = make(document, 'div', undefined, 'form-actions');
  const cancel = button(document, '입력 취소', 'button', 'cancel-form');
  const submit = button(document, nouns[kind] + ' 저장');
  submit.dataset.entrySubmit = '';
  submit.dataset.idleLabel = nouns[kind] + ' 저장';
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
  const submit = button(document, '확인 결과 저장');
  form.append(submit);
  form.addEventListener('submit', async event => {
    event.preventDefault();
    try {
      await operation.resolve({
        originalConfirmed: confirmed.querySelector('input').checked,
        decision: select.value,
        pageIds: form.elements.pageIds?.value,
      });
    } catch {
      // Controller status is deliberately fixed text and never includes IDs, tokens, or API bodies.
    }
  });
  card.append(form);
  return card;
}

function bindEvents({ page, nav, connectionForm, originalConnectionCheck, content, actions, document, view }) {
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

  const handleClick = async event => {
    const target = event.target.closest('[data-action]');
    const action = target?.dataset.action;
    if (!action || target.disabled) return;
    if (action === 'retry-initialize') {
      try { await actions.initialize(); } catch { /* Safe status text is supplied by the controller. */ }
      return;
    }
    if (action === 'navigate') {
      const next = target.dataset.route;
      if (next && globalThis.window?.location) globalThis.window.location.hash = next;
      else view.renderRoute(next);
      return;
    }
    if (action === 'cancel-connection') {
      if (view.cancelConnection()) view.showStatus({ type: 'cancelled', message: '연결 입력을 취소했습니다.' });
      return;
    }
    if (['delete-bean', 'delete-recipe', 'delete-record'].includes(action)) {
      const state = actions.getState?.() ?? {};
      if (target.disabled || state.pending || state.frozen || state.unresolved) return;
      const nouns = { 'delete-bean': '원두를', 'delete-recipe': '레시피를', 'delete-record': '추출 기록을' };
      const dependencies = {
        'delete-bean': '연결된 추출 기록이 있으면 삭제할 수 없습니다.',
        'delete-recipe': '추출 기록에서 사용 중인 레시피는 먼저 해당 추출 기록을 삭제해야 합니다.',
        'delete-record': '해당 기록만 휴지통으로 이동합니다.',
      };
      if (!globalThis.confirm?.(`“${target.dataset.name}” ${nouns[action]} 삭제할까요?\nNotion 휴지통으로 이동합니다. ${dependencies[action]}`)) return;
      try { await actions.submit(action, { id: target.dataset.id }); }
      catch { /* Controller supplies a safe message. */ }
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
      const picker = target.closest('.form-field');
      const search = picker?.querySelector('[data-option-search-kind]');
      const select = picker?.querySelector('select');
      loadOptions(targetName, kind, search?.value ?? '', select?.dataset.nextCursor || null, true);
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
    if (event.target.matches('[data-record-filter]') && windowData) {
      const beanId = content.querySelector('[data-record-filter="beanId"]')?.value ?? '';
      const recipeId = content.querySelector('[data-record-filter="recipeId"]')?.value ?? '';
      const update = actions.setRecordFilters?.({ beanId, recipeId });
      if (update?.catch) void update.catch(() => {});
    }
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

function saveActiveDraft(content, drafts) {
  const form = content.querySelector('form[data-form]');
  if (!form || form.closest('dialog')?.dataset.saveState === 'success') return;
  const values = {};
  for (const field of form.querySelectorAll('input[name],textarea[name],select[name]')) {
    if (field.closest('.step-row')) continue;
    values[field.name] = field.value;
  }
  const steps = [...form.querySelectorAll('.step-row')].map(row =>
    Object.fromEntries([...row.querySelectorAll('[name]')].map(field => [field.name, field.value])));
  drafts.set(form.dataset.form, { values, steps, copyId: form.dataset.copyId || null });
}

function restoreDraft(form, draft, data) {
  if (!draft) return;
  for (const [name, value] of Object.entries(draft.values)) {
    const field = form.elements[name];
    if (field) field.value = value;
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
  const selected = route.split('/').filter(Boolean)[0] ?? 'beans';
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

function localDate() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
