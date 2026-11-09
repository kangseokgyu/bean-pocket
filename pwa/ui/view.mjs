import { make } from './shared/dom.mjs';
import { actionIcon, navigationIcon, settingsIcon } from './shared/icons.mjs';
import { button, actionButton, setActionButton, iconButton } from './shared/buttons.mjs';
import { label } from './shared/form-fields.mjs';
import { showNativeDialog, makeEntryDialog } from './shared/dialogs.mjs';
import { renderHome } from './screens/home.mjs';
import { renderBeans, renderBeanDetail } from './screens/beans.mjs';
import { renderRecipes, renderRecipeDetail } from './screens/recipes.mjs';
import { buildBeanForm } from './forms/bean-form.mjs';
import { addStep, buildRecipeForm, setSteps, updatePreview } from './forms/recipe-form.mjs';
import { parseInputTime } from './shared/recipe-presentation.mjs';
import { addBrewStage, brewOptionScope, cachedBrewOptionPage,
  renderBrewFlow, renderBrewOptionResults, renderUnavailableRoute, updateBrewConditions } from './screens/brew.mjs';
import { renderRecords } from './screens/records.mjs';
import { buildRecordForm, recordFlowKey } from './forms/record-form.mjs';
import { routePath, routeParams, normalizeRoute } from './shared/route.mjs';
import { bindEvents } from './interactions/events.mjs';
import { createStatusToast } from './interactions/status-toast.mjs';
import { bindPullToRefresh } from './interactions/pull-to-refresh.mjs';
import { findSearchPicker, hydrateRecordPickers, renderSearchPicker, syncSearchPickerTrigger,
  updatePickerOptions } from './interactions/search-picker.mjs';

const NAVIGATION_ITEMS = Object.freeze([
  { kind: 'route', route: '/home', label: '홈', icon: 'home' },
  { kind: 'route', route: '/beans', label: '원두', icon: 'beans' },
  { kind: 'action', action: 'start-brew', label: '추출 시작', icon: 'brew' },
  { kind: 'route', route: '/recipes', label: '레시피', icon: 'recipes' },
  { kind: 'route', route: '/records', label: '추출 기록', icon: 'records' },
]);

const TOKEN_VALIDATION_STATUSES = new Set(['idle', 'checking', 'valid', 'invalid', 'unavailable']);
const TOKEN_VALIDATION_MESSAGES = Object.freeze({
  idle: '입력을 마치면 1초 뒤 자동으로 확인합니다.',
  checking: 'Notion 토큰 확인 중…',
  valid: 'Notion 토큰을 확인했습니다.',
  invalid: '토큰이 유효하지 않습니다. 값을 다시 확인해 주세요.',
  unavailable: '확인할 수 없습니다. 네트워크나 Notion 권한을 확인한 뒤 다시 시도해 주세요.',
});
const SOURCE_FIELDS = Object.freeze([
  ['beans', '원두'], ['recipes', '레시피'],
  ['steps', '레시피 단계'], ['records', '추출 기록'],
]);

export function createAppView(document = globalThis.document, {
  schedule = setTimeout,
  cancelSchedule = clearTimeout,
  validateToken,
} = {}) {
  const root = document.querySelector('#app-root');
  if (!root) throw new Error('앱 화면을 만들 수 없습니다.');
  const page = make(document, 'div', undefined, 'app-content');
  page.setAttribute('tabindex', '-1');
  root.replaceChildren(page);

  let currentState = { frozen: false, pending: false, unresolved: false, connectionRevision: null };
  let routeReadStatus = 'idle';
  function renderStatus({ promoteToast = false } = {}) {
    const startupChecking = toast.startupChecking;
    const initialSkeletonHidden = !currentState.pending || !!currentData ||
      (!startupChecking && connection.dataset.connected !== 'true');
    skeletons.hidden = routeReadStatus === 'loading' ? false : routeReadStatus === 'idle' ? initialSkeletonHidden : true;
    toast.render(routeReadStatus === 'loading', promoteToast);
    loadingSurface.inert = currentState.pending && startupChecking;
  }
  let currentData = null;
  let renderedConnectionRevision = null;
  let route = normalizeRoute(globalThis.location?.hash?.slice(1) || '/home');
  let routeNeedsDataRender = true;
  const routeHiddenChildren = new Set();
  let routeChangeListener = null;
  const drafts = new Map();
  const optionPages = new Map();
  const optionStates = new Map();
  let insightRecipeFilter = '';
  let insightRatingFilter = '';
  let insightComparisonSort = 'date-desc';
  let insightCompareRoute = '';
  let insightCompareBeanId = '';
  let insightCompareLeftId = '';
  let insightCompareRightId = '';
  let insightCompareRouteDefaultsPending = false;
  let recordManagementOpen = false;
  let beanFormOpen = false;
  let recipeFormOpen = routePath(route) === '/recipes/new';
  let recordFormOpen = routePath(route) === '/records/new';
  const toast = createStatusToast(document, page, {
    isPending: () => currentState.pending,
    onHide: () => renderStatus(),
    hideForDialog(openDialog, statusType) {
      const entrySubmit = activeEntryKind ? entryDialogFor(activeEntryKind)?.querySelector('[data-entry-submit]') : null;
      const deleteIcon = confirmDeleteButton.querySelector('.button-icon');
      const modalHasInlineProgress = currentState.pending && statusType === 'saving' && (
        (openDialog === deleteDialog && deleteRequestPending && deleteIcon?.dataset.state === 'saving') ||
        (openDialog === entryDialogFor(activeEntryKind) && entrySubmit?.dataset.state === 'saving')
      );
      return (openDialog === deleteDialog && !currentState.pending) || modalHasInlineProgress;
    },
  });

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
  const connectionToggle = iconButton(document, '', 'Notion 연결 설정', 'toggle-connection');
  connectionToggle.className = 'button icon-button connection-toggle';
  connectionToggle.replaceChildren(settingsIcon(document));
  connectionToggle.setAttribute('aria-controls', connection.id);
  connectionToggle.setAttribute('aria-expanded', 'false');
  connectionToggle.disabled = true;
  (document.querySelector('#connection-tools') ?? page).append(connectionToggle);
  function showConnectionPanel(visible) {
    connection.hidden = !visible;
    connectionToggle.setAttribute('aria-expanded', String(visible));
    if (!visible) {
      resetTokenValidation();
      if (connection.open) {
        if (typeof connection.close === 'function') connection.close();
        else connection.open = false;
      }
      return;
    }
    if (!connection.open) {
      showNativeDialog(connection);
      toast.sync();
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
  const tokenField = label(document, '통합 토큰', 'token', 'password', true, { autocomplete: 'off' });
  tokenField.className += ' form-field--connection';
  const tokenInput = tokenField.querySelector('input');
  const tokenLabel = tokenField.querySelector('.form-field-label');
  const tokenControl = make(document, 'div', undefined, 'token-input-control');
  const tokenValidationIcon = make(document, 'span', undefined, 'token-validation-icon');
  tokenValidationIcon.dataset.tokenStatusIcon = '';
  tokenValidationIcon.dataset.state = 'idle';
  tokenValidationIcon.dataset.icon = 'check';
  tokenValidationIcon.setAttribute('aria-hidden', 'true');
  tokenValidationIcon.append(actionIcon(document, 'check'));
  tokenInput.id = 'connection-token';
  const tokenValidationText = make(document, 'span', TOKEN_VALIDATION_MESSAGES.idle, 'visually-hidden');
  tokenValidationText.dataset.tokenStatus = '';
  tokenValidationText.dataset.tokenStatusText = '';
  tokenValidationText.dataset.state = 'idle';
  tokenValidationText.id = 'connection-token-status';
  tokenValidationText.setAttribute('role', 'status');
  tokenValidationText.setAttribute('aria-live', 'polite');
  tokenInput.setAttribute('aria-describedby', tokenValidationText.id);
  tokenControl.dataset.state = 'idle';
  tokenControl.append(tokenInput, tokenValidationIcon);
  tokenField.replaceChildren(tokenLabel, tokenControl, tokenValidationText);
  connectionForm.append(tokenField);
  for (const [key, title] of SOURCE_FIELDS) {
    const sourceField = label(document, title + ' 데이터 소스 ID', key, 'text', true,
      { autocomplete: 'off', spellcheck: false, autocapitalize: 'off' });
    sourceField.className += ' form-field--connection';
    connectionForm.append(sourceField);
  }
  const connectionActions = make(document, 'div', undefined, 'form-actions');
  const connectionCancel = actionButton(document, '취소', 'button', 'x', 'cancel-connection');
  const connectionSubmit = actionButton(document, '연결 확인 및 저장', 'submit', 'save');
  connectionActions.append(connectionCancel, connectionSubmit);
  connectionForm.append(connectionActions);
  connectionDetails.append(make(document, 'p', '연결 정보는 이 기기의 앱 저장소에 보관됩니다.', 'muted-note'));
  connectionDetails.append(connectionForm);

  let tokenValidation = { status: 'idle' };
  function renderTokenValidation() {
    const { status } = tokenValidation;
    tokenControl.dataset.state = status;
    tokenValidationText.dataset.state = status;
    tokenValidationText.textContent = TOKEN_VALIDATION_MESSAGES[status];
    tokenValidationIcon.dataset.state = status;
    const icon = status === 'valid' ? 'check' : ['invalid', 'unavailable'].includes(status) ? 'warning' : 'check';
    if (tokenValidationIcon.dataset.icon !== icon) {
      tokenValidationIcon.dataset.icon = icon;
      tokenValidationIcon.replaceChildren(actionIcon(document, icon));
    }
  }

  function resetTokenValidation() {
    if (tokenValidation.timer !== undefined && tokenValidation.timer !== null) cancelSchedule(tokenValidation.timer);
    tokenValidation.controller?.abort();
    tokenValidation = { status: 'idle' };
    renderTokenValidation();
  }

  function runTokenValidation(token, waitingState) {
    if (tokenValidation !== waitingState || tokenInput.value.trim() !== token) return;
    if (typeof validateToken !== 'function') return;
    const controller = new AbortController();
    tokenValidation = { status: 'checking', controller };
    renderTokenValidation();
    let result;
    try { result = validateToken(token, { signal: controller.signal }); }
    catch { result = 'unavailable'; }
    Promise.resolve(result).then(status => {
      if (tokenValidation.status !== 'checking' || tokenValidation.controller !== controller ||
          tokenInput.value.trim() !== token) return;
      tokenValidation = { status: TOKEN_VALIDATION_STATUSES.has(status) && status !== 'checking' ? status : 'unavailable' };
      renderTokenValidation();
    }).catch(() => {
      if (tokenValidation.status !== 'checking' || tokenValidation.controller !== controller ||
          tokenInput.value.trim() !== token) return;
      tokenValidation = { status: 'unavailable' };
      renderTokenValidation();
    });
  }

  function scheduleTokenValidation(token) {
    if (!token) return;
    const waitingState = { status: 'idle', timer: null };
    tokenValidation = waitingState;
    waitingState.timer = schedule(() => {
      if (tokenValidation !== waitingState || tokenInput.value.trim() !== token) return;
      waitingState.timer = null;
      runTokenValidation(token, waitingState);
    }, 1000);
  }

  function resetConnectionForm() {
    resetTokenValidation();
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
  repair.append(button(document, '현재 연결을 다시 검증', 'button', 'confirm-connection', 'primary'));
  connection.append(repair, connectionDetails);
  page.append(connection);

  const nav = make(document, 'nav', undefined, 'tabs');
  nav.setAttribute('aria-label', '커피 기록 메뉴');
  for (const entry of NAVIGATION_ITEMS) {
    const action = entry.kind === 'route' ? 'navigate' : entry.action;
    const item = button(document, '', 'button', action);
    item.className = `button nav-item${entry.kind === 'action' ? ' tabs-start-brew' : ''}`;
    item.dataset.navKind = entry.kind;
    item.setAttribute('aria-label', entry.label);
    item.title = entry.label;
    item.append(navigationIcon(document, entry.icon), make(document, 'span', entry.label, 'nav-label'));
    if (entry.kind === 'route') item.dataset.route = entry.route;
    nav.append(item);
  }
  const header = document.querySelector('.site-header');
  const headerTools = header?.querySelector('.header-tools');
  const narrowNavigation = document.defaultView?.matchMedia?.('(max-width: 600px)');
  function placeNavigation() {
    if (narrowNavigation?.matches && document.body) {
      document.body.append(nav);
      return;
    }
    if (headerTools) {
      header.insertBefore(nav, headerTools);
      return;
    }
    (header ?? page).append(nav);
  }
  placeNavigation();
  narrowNavigation?.addEventListener?.('change', placeNavigation);

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
  const discardEditDialog = make(document, 'dialog', undefined, 'entry-dialog edit-discard-dialog');
  discardEditDialog.setAttribute('role', 'dialog');
  discardEditDialog.setAttribute('aria-modal', 'true');
  discardEditDialog.setAttribute('aria-labelledby', 'edit-discard-title');
  const discardEditTitle = make(document, 'h2', '수정 내용을 버릴까요?');
  discardEditTitle.id = 'edit-discard-title';
  discardEditDialog.append(discardEditTitle);
  discardEditDialog.append(make(document, 'p', '저장하지 않은 레시피 수정 내용이 사라집니다.'));
  const discardEditActions = make(document, 'div', undefined, 'form-actions');
  const keepEditButton = button(document, '계속 수정', 'button', 'keep-recipe-edit', 'utility');
  const discardEditButton = button(document, '수정 내용 버리기', 'button', 'discard-recipe-edit', 'primary');
  discardEditActions.append(keepEditButton, discardEditButton);
  discardEditDialog.append(discardEditActions);
  page.append(discardEditDialog);
  let resolveDiscardEdit = null;
  const finishDiscardEdit = discard => {
    const resolve = resolveDiscardEdit;
    resolveDiscardEdit = null;
    if (discardEditDialog.open && typeof discardEditDialog.close === 'function') discardEditDialog.close();
    else discardEditDialog.open = false;
    resolve?.(discard);
  };
  keepEditButton.addEventListener('click', () => finishDiscardEdit(false));
  discardEditButton.addEventListener('click', () => finishDiscardEdit(true));
  discardEditDialog.addEventListener('cancel', event => {
    event.preventDefault();
    finishDiscardEdit(false);
  });
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
    toast.sync();
  }
  function syncInsightComparisonSelection() {
    if (routePath(route) !== '/records') {
      insightCompareRoute = '';
      insightCompareBeanId = '';
      insightCompareLeftId = '';
      insightCompareRightId = '';
      insightCompareRouteDefaultsPending = false;
      return;
    }
    if (insightCompareRoute !== route) {
      const params = routeParams(route);
      insightCompareLeftId = params.get('compareSourceRecordId') || params.get('compareLeftId') || '';
      insightCompareRightId = params.get('compareRecordId') || params.get('compareRightId') || '';
      insightCompareRouteDefaultsPending = !!(insightCompareLeftId && insightCompareRightId);
      insightCompareRoute = route;
      insightCompareBeanId = currentData?.recordInsights?.selectedBeanId ?? '';
    }
    const state = currentData?.recordInsights;
    const selectedBeanId = state?.selectedBeanId ?? '';
    const records = state?.comparisonRecords ?? [];
    if (insightCompareBeanId && selectedBeanId && insightCompareBeanId !== selectedBeanId &&
        !insightCompareRouteDefaultsPending) {
      insightCompareLeftId = '';
      insightCompareRightId = '';
    }
    insightCompareBeanId = selectedBeanId;
    const availableIds = new Set(records.map(record => record.id));
    if (insightCompareRouteDefaultsPending && availableIds.has(insightCompareLeftId) &&
        availableIds.has(insightCompareRightId)) insightCompareRouteDefaultsPending = false;
    if (!insightCompareLeftId && !insightCompareRightId && records.length >= 2) {
      insightCompareLeftId = records.at(-1).id;
      insightCompareRightId = records[0].id;
    }
  }
  function refreshBrewOptionResults() {
    const path = routePath(route);
    const kind = path === '/brew/bean' ? 'beans' : path === '/brew/recipe' ? 'recipes' : null;
    if (!kind || currentData?.screen?.error) return false;
    const pane = content.querySelector('.brew-flow-pane');
    const results = pane?.querySelector('.brew-option-results');
    const search = pane?.querySelector(`[data-option-search-kind="${kind}"]`);
    if (!results || !search) return false;
    if (search.dataset.optionComposing === 'true') return true;

    const params = routeParams(route);
    const routeQuery = params.get('q') ?? '';
    const query = search.value;
    const cachedPage = cachedBrewOptionPage(optionPages, kind, route);
    const hasMatchingPage = cachedPage?.query === query;
    if (!hasMatchingPage && query !== routeQuery) return true;
    const page = hasMatchingPage ? cachedPage : {
      items: kind === 'beans' ? currentData.beans ?? [] : currentData.recipes ?? [],
      nextCursor: currentData.screen?.nextCursor ?? null,
      hasMore: !!currentData.screen?.hasMore,
      complete: currentData.screen?.complete !== false,
      query: routeQuery,
    };
    const selectedBean = kind === 'recipes'
      ? currentData.beans?.find(item => item.id === params.get('beanId'))
      : null;
    if (kind === 'recipes' && !selectedBean) return false;
    const selectedId = params.get(kind === 'beans' ? 'selectedBeanId' : 'selectedRecipeId') ?? '';
    const updated = renderBrewOptionResults(document, kind, selectedBean, selectedId, query, page);
    results.replaceChildren(...updated.children);
    if (hasMatchingPage) {
      search.dataset.optionLoaded = 'true';
      search.dataset.optionQuery = query;
    }
    return true;
  }
  function renderCurrentContent() {
    syncInsightComparisonSelection();
    renderPane(content, currentData, document, route, drafts, optionPages,
      beanFormOpen, recipeFormOpen, recordFormOpen, optionStates, insightRecipeFilter, insightRatingFilter,
      insightComparisonSort, insightCompareLeftId, insightCompareRightId, recordManagementOpen,
      open => { recordManagementOpen = open; }, currentState.connectionRevision);
    renderedConnectionRevision = currentState.connectionRevision;
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
    toast.sync();
    cancelDeleteButton.focus?.();
    return true;
  }

  function showDeleteResult(result = {}) {
    if (!activeDelete || !deleteDialog.open) return false;
    activeDelete.resultReported = true;
    activeDelete.resultStatus = result.status ?? 'failed';
    deleteRequestPending = false;
    deleteDialog.setAttribute('aria-busy', 'false');
    const message = result.message ?? (result.status === 'succeeded'
      ? '삭제했습니다.' : '삭제하지 못했습니다. 목록을 새로고침해 주세요.');
    const hideRecipeSuccess = activeDelete.action === 'delete-recipe'
      && result.status === 'succeeded' && message === '삭제했습니다.';
    deleteFeedback.hidden = hideRecipeSuccess;
    deleteFeedback.textContent = hideRecipeSuccess ? '' : message;
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
    toast.sync();
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
      const changed = toast.setMessage(value);
      renderStatus({ promoteToast: changed });
      toast.scheduleHide();
    },
    clearStatus() {
      toast.clearMessage();
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
    clearSecret() {
      connectionForm.elements.token.value = '';
      resetTokenValidation();
    },
    beginConnectionSave() {
      if (currentState.pending || currentState.frozen || currentState.unresolved || connectionPhase !== 'idle') return false;
      resetTokenValidation();
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
      resetTokenValidation();
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
      const connectionRevision = Object.hasOwn(value, 'connectionRevision')
        ? value.connectionRevision : currentState.connectionRevision;
      currentState = {
        frozen: !!value.frozen,
        pending: !!value.pending,
        unresolved: !!value.unresolved,
        connectionRevision,
      };
      if (!currentState.pending) toast.allowPendingMessage();
      if (currentState.pending && activeEntryKind && entryPhase !== 'success') entryPhase = 'saving';
      else if (!currentState.pending && entryPhase === 'saving') entryPhase = 'idle';
      renderStatus();
      applyViewState();
      if (currentState.pending) toast.cancelHide();
      else if (wasPending) toast.scheduleHide();
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
    clearDraft(kind, recipeId = null) {
      drafts.delete(recipeId && kind === 'recipes' ? `recipe-edit:${recipeId}` : kind);
      const wasOpen = !recipeId && activeEntryKind === kind;
      if (entryDialogFor(kind)?.open) entryDialogFor(kind).close();
      if (kind === 'beans') beanFormOpen = false;
      if (kind === 'recipes' && !recipeId) recipeFormOpen = false;
      if (kind === 'records') recordFormOpen = false;
      if (wasOpen) activeEntryKind = null;
      if (currentData) renderCurrentContent();
      if (wasOpen) {
        entryPhase = 'idle';
        renderStatus({ promoteToast: true });
        restoreEntryFocus(kind);
      }
    },
    confirmDiscardEdit() {
      if (resolveDiscardEdit) return Promise.resolve(false);
      return new Promise(resolve => {
        resolveDiscardEdit = resolve;
        showNativeDialog(discardEditDialog);
        keepEditButton.focus?.();
      });
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
      syncInsightComparisonSelection();
      const insightRecipeOptions = currentData.recordInsights?.recipeOptions;
      if (insightRecipeFilter && Array.isArray(insightRecipeOptions) &&
          !insightRecipeOptions.some(recipe => recipe.id === insightRecipeFilter)) insightRecipeFilter = '';
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
          syncInsightComparisonSelection();
          renderPane(refreshed, currentData, document, route, new Map(), optionPages,
            beanFormOpen, recipeFormOpen, recordFormOpen, optionStates, insightRecipeFilter, insightRatingFilter,
            insightComparisonSort, insightCompareLeftId, insightCompareRightId, recordManagementOpen,
            open => { recordManagementOpen = open; }, currentState.connectionRevision);
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
      if (renderedConnectionRevision === currentState.connectionRevision && refreshBrewOptionResults()) {
        finishContentRender();
        applyViewState();
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
        const search = Array.from(content.querySelectorAll('[data-option-search-kind]'))
          .find(item => item.dataset.optionTarget === target && item.dataset.optionSearchKind === kind);
        if (!search || search.dataset.optionComposing === 'true' || search.value !== query) return;
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
        const search = Array.from(content.querySelectorAll('[data-option-search-kind]'))
          .find(item => item.dataset.optionTarget === target && item.dataset.optionSearchKind === kind);
        if (search) {
          search.dataset.optionLoaded = 'true';
          search.dataset.optionQuery = query;
        }
        if (currentData) {
          refreshBrewOptionResults();
          finishContentRender();
          applyViewState();
        }
        return;
      }
      const select = Array.from(content.querySelectorAll('[data-option-select-kind]'))
        .find(item => item.dataset.optionTarget === target && item.dataset.optionSelectKind === kind);
      if (!select) return;
      const filterKey = kind === 'beans' ? 'beanId' : 'recipeId';
      const previousValue = select.value || (target === 'filters' ? currentData?.screen?.filters?.[filterKey] : '');
      const previousOption = Array.from(select.options).find(option => option.value === previousValue);
      const selectedItem = previousValue && previousOption && !optionItems.some(item => String(item.id ?? '') === previousValue)
        ? { id: previousValue, name: previousOption.textContent, status: 'ready' }
        : null;
      optionPages.set(optionKey, { ...page, items: optionItems, selectedItem, query, savedAt: Date.now() });
      optionStates.set(optionKey, { status: 'ready', query, append: false });
      updatePickerOptions(content, select, target, kind, page, { previousValue, previousOption, keepPreviousPage, query });
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
      bindEvents({ page, connectionForm, tokenInput, scheduleTokenValidation, resetTokenValidation,
        originalConnectionCheck, sourceFields: SOURCE_FIELDS, nav, content,
        actions, document, view, openDeleteDialog, closeDeleteDialog, submitDelete,
        setInsightRecipeFilter(value) { insightRecipeFilter = value; if (currentData) view.renderData(currentData); },
        setInsightRatingFilter(value) { insightRatingFilter = value; if (currentData) view.renderData(currentData); },
        setInsightComparisonSort(value) { insightComparisonSort = value; if (currentData) view.renderData(currentData); },
        setInsightCompareLeft(value) {
          insightCompareLeftId = value;
          insightCompareRouteDefaultsPending = false;
          if (currentData) view.renderData(currentData);
        },
        setInsightCompareRight(value) {
          insightCompareRightId = value;
          insightCompareRouteDefaultsPending = false;
          if (currentData) view.renderData(currentData);
        } });
      bindPullToRefresh({ page, document, actions });
    },
  };
  return view;
}

function applyState(page, state) {
  const globallyDisabled = state.frozen || state.pending;
  page.querySelectorAll('input,button,select,textarea').forEach(control => {
    control.disabled = globallyDisabled || control.dataset.optionReady === 'false' ||
      control.dataset.actionDisabled === 'true';
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

function renderPane(parent, data, document, route = '/home', drafts = new Map(), optionPages = new Map(),
  beanFormOpen = false, recipeFormOpen = false, recordFormOpen = false, optionStates = new Map(),
  insightRecipeFilter = '', insightRatingFilter = '', insightComparisonSort = 'date-desc',
  insightCompareLeftId = '', insightCompareRightId = '',
  recordManagementOpen = false, setRecordManagementOpen = () => {}, connectionRevision = null) {
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
  const beanDetail = section === 'beans' && parts[1];
  const recipePage = section === 'recipes' && parts[1] && parts[1] !== 'new';
  const recipeEdit = recipePage && parts[2] === 'edit';
  const recipeDetail = recipePage && !recipeEdit;
  if (beanDetail || recipeDetail) {
    const label = `${titles[section]} 목록`;
    const back = button(document, label, 'button', 'navigate', 'back');
    back.dataset.route = `/${section}`;
    back.append(make(document, 'span', label));
    header.append(back);
  } else {
    header.append(make(document, 'h2', titles[section] ?? '커피 기록'));
  }
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
  if (!recipeEdit) pane.append(header);

  if (beanDetail) {
    renderBeanDetail(pane, actions, data, document, parts[1]);
  } else if (recipeEdit) {
    const recipe = data.recipes?.find(row => row.id === parts[1]);
    if (data.screen?.error || !recipe || !Array.isArray(recipe.steps)) {
      pane.append(make(document, 'h1', '레시피를 수정할 수 없습니다.'));
      pane.append(make(document, 'p', '최신 레시피와 모든 단계를 확인하지 못했습니다. 레시피 목록을 새로고침한 뒤 다시 열어 주세요.', 'record-warning'));
      const back = button(document, '레시피 목록으로', 'button', 'navigate', 'back');
      back.dataset.route = '/recipes';
      pane.append(back);
    } else {
      const form = buildRecipeForm(document, data, recipe);
      form.id = `edit-recipe-form-${recipe.id}`;
      form.dataset.draftRoute = route;
      form.dataset.editBaseline = JSON.stringify(recipe);
      pane.append(form);
      setSteps(form, recipe.steps);
      updatePreview(pane);
    }
  } else if (recipeDetail) {
    renderRecipeDetail(pane, actions, data, document, parts[1]);
  } else if (section === 'beans') {
    const form = buildBeanForm(document);
    form.id = 'new-bean-form';
    pane.append(makeEntryDialog(document, 'beans', form, beanFormOpen));
    renderBeans(pane, data, document);
  } else if (section === 'recipes') {
    const form = buildRecipeForm(document, data);
    form.id = 'new-recipe-form';
    pane.append(makeEntryDialog(document, 'recipes', form, recipeFormOpen));
    addStep(pane, document);
    updatePreview(pane);
    renderRecipes(pane, data, document);
  } else if (section === 'records') {
    const draft = drafts.get('records');
    if (parts[1] === 'new' && draft && draft.flowKey !== recordFlowKey(route)) {
      const conflict = make(document, 'section', undefined, 'record-draft-conflict');
      conflict.setAttribute('role', 'status');
      conflict.append(make(document, 'h3', '저장하지 않은 추출 기록이 있습니다.'));
      conflict.append(make(document, 'p', `${draft.values.date} · 별점 ${draft.values.rating || '미입력'} · ${draft.values.cupNote || '컵노트 없음'}`));
      conflict.append(button(document, '이전 기록 이어쓰기', 'button', 'resume-record-draft', 'primary'));
      conflict.append(button(document, '이전 초안을 버리고 새 기록 작성', 'button', 'start-new-record'));
      pane.append(conflict);
    } else {
      const form = buildRecordForm(document, data, optionPages, route, optionStates, connectionRevision);
      if (parts[1] === 'new') {
        form.id = 'new-record-form';
        pane.append(makeEntryDialog(document, 'records', form, recordFormOpen));
      } else {
        renderRecords(pane, data, document, form, recordFormOpen, optionPages, optionStates,
          insightRecipeFilter, insightRatingFilter, insightComparisonSort, insightCompareLeftId,
          insightCompareRightId, recordManagementOpen, setRecordManagementOpen);
      }
    }
  } else {
    pane.append(make(document, 'p', '화면을 찾을 수 없습니다. 메뉴에서 이동해 주세요.'));
  }

  if (data.screen?.hasMore) {
    const more = button(document, '더 불러오기', 'button', 'load-more', 'pagination');
    more.className = 'button button--pagination page-load-more';
    const target = section === 'records' ? pane.querySelector('[data-record-page-more]') : null;
    (target ?? pane).append(more);
  } else if (data.screen?.complete === false) {
    const warning = make(document, 'p', '전체 목록을 확인하지 못했습니다. 새로고침해 주세요.', 'record-warning');
    const target = section === 'records' ? pane.querySelector('[data-record-page-more]') : null;
    (target ?? pane).append(warning);
  }

  parent.dataset.section = section;
  parent.replaceChildren(pane);
  const form = pane.querySelector('form[data-form]');
  if (form) restoreDraft(form, drafts.get(draftKey(form)), data);
  updateNavigationCurrent(parent.ownerDocument, route);
}

function buildResolutionForm(document, operation) {
  const deleting = operation.kind.startsWith('delete-');
  const favoriting = operation.kind.startsWith('favorite-');
  const editing = operation.kind === 'edit-recipe';
  const deleteNames = { beans: '원두', recipes: '레시피', records: '추출 기록' };
  const names = { beans: '원두', recipes: '레시피', records: '추출 기록' };
  const targetName = deleteNames[operation.targetKind] ?? '항목';
  const hasKnownPages = deleting || favoriting || editing || operation.knownPageCount > 0;
  const card = make(document, 'article', undefined, 'resolution-card');
  const status = deleting ? '삭제 여부 확인 필요' : editing ? '수정 결과 확인 필요' : operation.status === 'partial' ? '일부 저장' : '저장 여부 확인 필요';
  card.append(make(document, 'h3', `${deleting ? `${targetName} 삭제` : editing ? '레시피 수정' : names[operation.kind] ?? '저장'} · ${status}`));
  card.append(make(document, 'p', favoriting ? 'Notion 원본의 즐겨찾기 체크 상태를 확인해 주세요. 확인 과정에서는 저장을 다시 요청하지 않습니다.' : deleting ? `Notion 원본에서 삭제 대상(${targetName})의 휴지통 이동 여부를 직접 확인해 주세요. 확인 과정에서는 삭제를 다시 요청하지 않습니다.` : editing
    ? '레시피와 모든 단계가 수정 전 상태 또는 수정 후 상태와 정확히 일치하는지 확인해 주세요. 일부만 반영되었거나 다른 내용이면 이 화면을 닫지 말고 Notion에서 레시피와 단계를 한쪽 상태로 맞춰 주세요. 저장을 다시 요청하지 마세요.' : hasKnownPages
    ? `확인된 항목 ${operation.knownPageCount}개. 원본에서 이 항목의 상태를 확인해 저장됨 또는 모두 보관 취소됨을 선택해 주세요.`
    : 'Notion 원본을 직접 확인하고, 이번 작업의 결과에 맞는 선택을 해 주세요.'));
  if (!hasKnownPages) card.append(make(document, 'p', '저장됨을 선택할 때는 이번 작업으로 새로 만들어진 모든 페이지의 ID를 입력해 주세요. ID는 상태 메시지에 표시하지 않습니다.', 'muted-note'));

  const form = make(document, 'form', undefined, 'form-grid resolution-form');
  const confirmed = label(document, 'Notion 원본에서 이번 작업의 결과를 직접 확인했습니다.', 'originalConfirmed', 'checkbox', true);
  form.append(confirmed);
  const decision = label(document, '확인 결과', 'decision', 'select', true);
  const select = decision.querySelector('select');
  const decisions = editing ? [['saved', '레시피와 모든 단계가 수정 후 상태와 일치함'], ['not-saved', '레시피와 모든 단계가 수정 전 상태와 일치함']] : favoriting ? [['saved', `즐겨찾기가 요청한 상태(${operation.favorite ? '추가' : '해제'})임을 확인함`], ['not-saved', '즐겨찾기가 요청한 상태와 다름을 확인함']] : deleting ? [
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

function saveActiveDraft(content, drafts) {
  const form = content.querySelector('form[data-form]');
  if (!form || form.closest('dialog')?.dataset.saveState === 'success') return;
  const values = {};
  for (const field of form.querySelectorAll('input[name],textarea[name],select[name]')) {
    if (field.closest('.step-row, .brew-stage-row') || (field.type === 'radio' && !field.checked)) continue;
    values[field.name] = field.value;
  }
  if (form.dataset.form === 'records') {
    values.rating = form.elements.rating.value;
    const initial = JSON.parse(form.dataset.initialValues || '{}');
    if (Object.keys(initial).every(name => values[name] === initial[name])) {
      drafts.delete(form.dataset.form);
      return;
    }
  }
  const steps = [...form.querySelectorAll('.step-row, .brew-stage-row')].map(row => ({
    ...(row.dataset.stepId ? { id: row.dataset.stepId } : {}),
    ...Object.fromEntries([...row.querySelectorAll('[name]')].map(field => [field.name, field.value])),
  }));
  const draft = { values, steps, copyId: form.dataset.copyId || null,
    route: form.dataset.draftRoute, flowKey: form.dataset.draftFlow };
  if (form.dataset.editId) draft.baseline = form.dataset.editBaseline;
  drafts.set(draftKey(form), draft);
}

function draftKey(form) {
  return form.dataset.editId ? `recipe-edit:${form.dataset.editId}` : form.dataset.form;
}

function restoreDraft(form, draft, data) {
  if (!draft) return;
  if (form.dataset.editId && draft.baseline) form.dataset.editBaseline = draft.baseline;
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
    form.elements.rating?.dispatchEvent(new Event('input'));
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
      if (values.id) row.dataset.stepId = values.id;
      for (const [name, value] of Object.entries(values)) {
        const field = row.querySelector(`[name="${name}"]`);
        if (field) field.value = value;
      }
    }
    updatePreview(panel);
  }
  if (form.dataset.form === 'brews' && draft.steps?.length) {
    const wrap = form.querySelector('[data-brew-stages]');
    wrap.replaceChildren();
    for (const values of draft.steps) {
      const row = addBrewStage(form.ownerDocument, wrap, {
        name: values.stepName, seconds: parseInputTime(values.time) ?? 0, water: values.water,
      }, wrap.children.length);
      for (const [name, value] of Object.entries(values)) {
        const field = row.querySelector(`[name="${name}"]`);
        if (field) field.value = value;
      }
    }
    updateBrewConditions(form);
  }
  if (draft.copyId) form.dataset.copyId = draft.copyId;
}

function updateNavigationCurrent(document, route) {
  const section = routePath(route).split('/').filter(Boolean)[0] ?? 'home';
  document.querySelectorAll('.tabs .nav-item').forEach(item => {
    const key = item.dataset.navKind === 'action' ? 'brew' : item.dataset.route.split('/').filter(Boolean)[0];
    if (key === section) item.setAttribute('aria-current', 'page');
    else item.removeAttribute('aria-current');
  });
}
