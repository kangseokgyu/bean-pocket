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

const idOf = value => String(value ?? '');
const FORM_KINDS = new Set(['beans', 'bags', 'recipes', 'records']);
const AUTO_HIDE_STATUS_TYPES = new Set(['ready', 'connected', 'saved', 'resolved', 'cancelled']);
const STATUS_DISPLAY_MS = 3000;
const SOURCE_FIELDS = Object.freeze([
  ['beans', '원두'], ['bags', '원두 봉지'], ['recipes', '레시피'],
  ['steps', '레시피 단계'], ['records', '추출 기록'],
]);

export function createAppView(document = globalThis.document) {
  const root = document.querySelector('#app-root');
  if (!root) throw new Error('앱 화면을 만들 수 없습니다.');
  const page = make(document, 'div', undefined, 'app-content');
  root.replaceChildren(page);

  let currentState = { frozen: false, pending: false, unresolved: false };
  let currentData = null;
  let route = globalThis.location?.hash?.slice(1) || '/beans';
  const drafts = new Map();
  let beanFormOpen = false;
  let bagFormOpen = false;
  let recipeFormOpen = route === '/recipes/new';
  let recordFormOpen = route === '/records/new';
  let statusHideTimer;

  const status = make(document, 'p', '연결 정보를 확인하고 있습니다.', 'app-status');
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  page.append(status);

  const connection = make(document, 'section', undefined, 'panel connection-panel');
  connection.id = 'connection-settings';
  connection.hidden = true;
  const connectionToggle = iconButton(document, '⚙', 'Notion 연결 설정', 'toggle-connection');
  connectionToggle.className = 'button icon-button connection-toggle';
  connectionToggle.setAttribute('aria-controls', connection.id);
  connectionToggle.setAttribute('aria-expanded', 'false');
  connectionToggle.disabled = true;
  (document.querySelector('#connection-tools') ?? page).append(connectionToggle);
  function showConnectionPanel(visible) {
    connection.hidden = !visible;
    connectionDetails.open = visible;
    connectionToggle.setAttribute('aria-expanded', String(visible));
  }
  connectionToggle.addEventListener('click', () => showConnectionPanel(connection.hidden));
  const connectionDetails = make(document, 'details', undefined, 'connection-details');
  connectionDetails.open = true;
  connectionDetails.append(make(document, 'summary', 'Notion 연결 설정'));
  const connectionForm = make(document, 'form', undefined, 'form-grid');
  connectionForm.dataset.form = 'connection';
  connectionForm.append(label(document, '통합 토큰', 'token', 'password', true, { autocomplete: 'off' }));
  for (const [key, title] of SOURCE_FIELDS) {
    connectionForm.append(label(document, `${title} 데이터 소스 ID`, key, 'text', true,
      { autocomplete: 'off', spellcheck: false, autocapitalize: 'off' }));
  }
  connectionForm.append(button(document, '연결 확인 및 저장'));
  connectionForm.append(button(document, '연결 입력 취소', 'button', 'cancel-connection'));
  connectionDetails.append(connectionForm);
  connectionDetails.append(make(document, 'p', '연결 정보는 이 기기의 앱 저장소에 보관됩니다.', 'muted-note'));
  connection.append(connectionDetails);

  const startupRetry = make(document, 'section', undefined, 'startup-retry-panel');
  startupRetry.hidden = true;
  startupRetry.append(make(document, 'h2', '저장된 연결 확인 중'));
  startupRetry.append(make(document, 'p', '기기 저장소의 연결 정보를 확인하고 있습니다. 다른 창이 저장소를 사용 중이면 잠시 기다립니다. 연결 정보를 입력하지 말고 다시 시도해 주세요.'));
  startupRetry.append(button(document, '저장된 연결 다시 읽기', 'button', 'retry-initialize'));
  connection.append(startupRetry);

  const repair = make(document, 'section', undefined, 'repair-panel');
  repair.hidden = true;
  repair.append(make(document, 'h2', '연결 저장 확인'));
  repair.append(make(document, 'p', '원본 연결 파일을 직접 확인한 뒤에만 복구할 수 있습니다. 확인이 끝나면 아래 항목을 선택해 주세요.'));
  const originalConnectionCheck = label(document, '원본 연결 파일의 현재 내용을 직접 확인했습니다.', 'originalConfirmed', 'checkbox', true);
  repair.append(originalConnectionCheck);
  repair.append(button(document, '현재 연결을 다시 검증', 'button', 'confirm-connection'));
  connection.append(repair);
  page.append(connection);

  const nav = make(document, 'nav', undefined, 'tabs');
  nav.setAttribute('aria-label', '커피 기록 메뉴');
  for (const [key, title] of [
    ['beans', '원두'], ['bags', '봉지'], ['recipes', '레시피'], ['records', '추출 기록'],
  ]) {
    const item = button(document, title, 'button', 'navigate');
    item.dataset.route = `/${key}`;
    nav.append(item);
  }
  page.append(nav);

  const unresolved = make(document, 'section', undefined, 'unresolved-panel');
  unresolved.hidden = true;
  unresolved.dataset.count = '0';
  unresolved.setAttribute('aria-labelledby', 'unresolved-title');
  unresolved.append(make(document, 'h2', '확인 대기 중인 저장', 'unresolved-title'));
  page.append(unresolved);

  const content = make(document, 'section', undefined, 'data-panel');
  content.setAttribute('aria-label', '커피 기록');
  page.append(content);

  const view = {
    showStatus(value) {
      clearTimeout(statusHideTimer);
      status.textContent = value?.message ?? '';
      status.dataset.state = value?.type ?? '';
      status.hidden = !status.textContent;
      if (!status.hidden && AUTO_HIDE_STATUS_TYPES.has(value?.type)) {
        statusHideTimer = setTimeout(() => { status.hidden = true; }, STATUS_DISPLAY_MS);
      }
    },
    showConnection(value) {
      const connected = !!value?.connected;
      const retryInitialization = !!value?.retryInitialization;
      connection.dataset.connected = connected ? 'true' : 'false';
      connectionToggle.disabled = retryInitialization;
      connectionDetails.hidden = retryInitialization;
      startupRetry.hidden = !retryInitialization;
      repair.hidden = !value?.needsRecovery;
      nav.hidden = !connected;
      unresolved.hidden = !connected || unresolved.dataset.count === '0';
      content.hidden = !connected;
      showConnectionPanel(!connected || !!value?.needsRecovery || retryInitialization);
      if (retryInitialization) connectionDetails.open = false;
    },
    clearSecret() { connectionForm.elements.token.value = ''; },
    setState(value) {
      currentState = {
        frozen: !!value.frozen,
        pending: !!value.pending,
        unresolved: !!value.unresolved,
      };
      applyState(page, currentState);
    },
    setFrozen(value) {
      currentState.frozen = !!value;
      page.dataset.frozen = value ? 'true' : 'false';
      applyState(page, currentState);
    },
    clearForm(kind) {
      drafts.delete(kind);
      const form = content.querySelector(`form[data-form="${kind}"]`);
      form?.reset();
    },
    clearDraft(kind) {
      drafts.delete(kind);
      if (kind === 'beans') beanFormOpen = false;
      if (kind === 'bags') bagFormOpen = false;
      if (kind === 'recipes') recipeFormOpen = false;
      if (kind === 'records') recordFormOpen = false;
      if (currentData) renderPane(content, currentData, document, route, drafts, beanFormOpen, recipeFormOpen, bagFormOpen, recordFormOpen);
      applyState(page, currentState);
    },
    renderData(nextData) {
      saveActiveDraft(content, drafts);
      currentData = nextData;
      renderPane(content, nextData, document, route, drafts, beanFormOpen, recipeFormOpen, bagFormOpen, recordFormOpen);
      applyState(page, currentState);
    },
    renderRoute(nextRoute) {
      route = nextRoute || '/beans';
      if (route === '/recipes/new') recipeFormOpen = true;
      if (route === '/records/new') recordFormOpen = true;
      if (currentData) {
        saveActiveDraft(content, drafts);
        renderPane(content, currentData, document, route, drafts, beanFormOpen, recipeFormOpen, bagFormOpen, recordFormOpen);
        applyState(page, currentState);
      }
    },
    showBeanForm() {
      const form = content.querySelector('form[data-form="beans"]');
      if (!form) return;
      beanFormOpen = true;
      form.hidden = false;
      content.querySelector('[data-action="show-bean-form"]')?.setAttribute('aria-expanded', 'true');
      form.elements.name.focus?.();
    },
    showBagForm() {
      const form = content.querySelector('form[data-form="bags"]');
      if (!form) return;
      bagFormOpen = true;
      form.hidden = false;
      content.querySelector('[data-action="show-bag-form"]')?.setAttribute('aria-expanded', 'true');
      form.elements.name.focus?.();
    },
    showRecipeForm() {
      const form = content.querySelector('form[data-form="recipes"]');
      if (!form) return;
      recipeFormOpen = true;
      form.hidden = false;
      content.querySelector('[data-action="show-recipe-form"]')?.setAttribute('aria-expanded', 'true');
      form.elements.name.focus?.();
    },
    showRecordForm() {
      const form = content.querySelector('form[data-form="records"]');
      if (!form) return;
      recordFormOpen = true;
      form.hidden = false;
      content.querySelector('[data-action="show-record-form"]')?.setAttribute('aria-expanded', 'true');
      form.elements.date.focus?.();
    },
    showUnresolved(items = []) {
      unresolved.replaceChildren(make(document, 'h2', '확인 대기 중인 저장', 'unresolved-title'));
      unresolved.dataset.count = String(items.length);
      unresolved.hidden = items.length === 0;
      for (const item of items) unresolved.append(buildResolutionForm(document, item));
      applyState(page, currentState);
    },
    bind(actions) {
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
  const spinner = make(document, 'span', undefined, 'pull-refresh-spinner');
  spinner.setAttribute('aria-hidden', 'true');
  const spokes = Array.from({ length: 12 }, (_, index) => {
    const spoke = make(document, 'span', undefined, 'pull-refresh-spoke');
    spoke.setAttribute('style', `transform: rotate(${index * 30}deg)`);
    spinner.append(spoke);
    return spoke;
  });
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
  form.append(make(document, 'h2', title));
  return form;
}

function renderPane(parent, data, document, route = '/beans', drafts = new Map(), beanFormOpen = false, recipeFormOpen = false, bagFormOpen = false, recordFormOpen = false) {
  const parts = route.split('/').filter(Boolean);
  const section = parts[0] ?? 'beans';
  const pane = make(document, 'div', undefined, 'list-view');
  pane.dataset.section = section;
  const titles = { beans: '원두', bags: '봉지', recipes: '레시피', records: '추출 기록' };
  const header = make(document, 'div', undefined, 'list-header');
  header.append(make(document, 'h2', titles[section] ?? '커피 기록'));
  const actions = make(document, 'div', undefined, 'list-actions');
  if (section === 'beans' && !parts[1]) {
    const add = iconButton(document, '+', '새 원두 추가', 'show-bean-form');
    add.setAttribute('aria-controls', 'new-bean-form');
    add.setAttribute('aria-expanded', String(beanFormOpen));
    actions.append(add);
  }
  if (section === 'bags') {
    const add = iconButton(document, '+', '새 봉지 추가', 'show-bag-form');
    add.setAttribute('aria-controls', 'new-bag-form');
    add.setAttribute('aria-expanded', String(bagFormOpen));
    actions.append(add);
  }
  if (section === 'recipes' && (!parts[1] || parts[1] === 'new')) {
    const add = iconButton(document, '+', '새 레시피 추가', 'show-recipe-form');
    add.setAttribute('aria-controls', 'new-recipe-form');
    add.setAttribute('aria-expanded', String(recipeFormOpen));
    actions.append(add);
  }
  if (section === 'records') {
    const add = iconButton(document, '+', '새 추출 기록 추가', 'show-record-form');
    add.setAttribute('aria-controls', 'new-record-form');
    add.setAttribute('aria-expanded', String(recordFormOpen));
    actions.append(add);
  }
  actions.append(iconButton(document, '↻', '최신 목록 새로고침', 'refresh'));
  header.append(actions);
  pane.append(header);

  if (section === 'beans' && parts[1]) {
    renderBeanDetail(pane, data, document, parts[1]);
  } else if (section === 'recipes' && parts[1] && parts[1] !== 'new') {
    renderRecipeDetail(pane, data, document, parts[1]);
  } else if (section === 'beans') {
    renderBeans(pane, data, document, beanFormOpen);
  } else if (section === 'bags') {
    renderBags(pane, data, document, bagFormOpen);
  } else if (section === 'recipes') {
    const form = buildRecipeForm(document, data);
    form.id = 'new-recipe-form';
    form.hidden = !recipeFormOpen;
    pane.append(form);
    addStep(pane, document);
    updatePreview(pane);
    if (!data.recipes.length) pane.append(make(document, 'p', '등록된 레시피가 없습니다.', 'empty-state'));
    for (const recipe of data.recipes) {
      const card = make(document, 'article', undefined, 'recipe-card');
      card.append(make(document, 'h3', recipe.name));
      card.append(make(document, 'p', `${recipe.dose}g · ${recipe.temperature}℃ · 물 ${recipe.totalWater}g`));
      const open = button(document, '레시피 상세 보기', 'button', 'navigate');
      open.dataset.route = `/recipes/${recipe.id}`;
      card.append(open);
      pane.append(card);
    }
  } else if (section === 'records') {
    const form = buildRecordForm(document, data);
    form.id = 'new-record-form';
    form.hidden = !recordFormOpen;
    pane.append(form);
  } else {
    pane.append(make(document, 'p', '화면을 찾을 수 없습니다. 메뉴에서 이동해 주세요.'));
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
  form.hidden = !formOpen;
  addFieldset(document, form, '원두 정보', [
    ['원두 이름', 'name', 'text', true, { autocomplete: 'off' }],
    ['로스터리', 'roaster', 'text', false],
    ['원산지·농장', 'origin', 'text', false],
    ['품종', 'variety', 'text', false],
    ['가공 방식', 'process', 'text', false],
    ['향미 노트', 'tastingNotes', 'textarea', false],
  ]);
  addFormActions(document, form, 'beans');
  pane.append(form);

  if (!data.beans.length) pane.append(make(document, 'p', '등록된 원두가 없습니다.', 'empty-state'));
  for (const bean of data.beans) {
    const card = make(document, 'article', undefined, 'bean-card');
    card.append(make(document, 'h3', bean.name));
    const info = [bean.roaster, bean.origin, bean.variety, bean.process].filter(Boolean).join(' · ');
    if (info) card.append(make(document, 'p', info));
    card.append(make(document, 'p', `향미 노트: ${bean.tastingNotes || '기록 없음'}`));
    const recipes = data.recipes.filter(recipe => recipe.beanId === bean.id);
    card.append(make(document, 'p', recipes.length ? `레시피 ${recipes.length}개` : '등록된 레시피가 없습니다.'));
    const open = button(document, '이 원두의 레시피 보기', 'button', 'navigate');
    open.dataset.route = `/beans/${bean.id}`;
    card.append(open);
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
  const recipes = data.recipes.filter(recipe => recipe.beanId === bean.id);
  if (!recipes.length) pane.append(make(document, 'p', '등록된 레시피가 없습니다.'));
  for (const recipe of recipes) {
    const card = make(document, 'article', undefined, 'recipe-card');
    card.append(make(document, 'h3', recipe.name));
    card.append(make(document, 'p', `${recipe.dose}g · ${recipe.temperature}℃ · 물 ${recipe.totalWater}g`));
    const open = button(document, '레시피 상세 보기', 'button', 'navigate');
    open.dataset.route = `/recipes/${recipe.id}`;
    card.append(open);
    pane.append(card);
  }
}

function renderRecipeDetail(pane, data, document, recipeId) {
  const recipe = data.recipes.find(row => row.id === recipeId);
  const back = button(document, '원두별 레시피로 돌아가기', 'button', 'navigate');
  back.dataset.route = recipe ? `/beans/${recipe.beanId}` : '/beans';
  pane.append(back);
  if (!recipe) {
    pane.append(make(document, 'p', '레시피를 찾을 수 없습니다. 최신 목록을 새로고침해 주세요.'));
    return;
  }
  pane.append(recipeCard(document, recipe, data, true));
}

function renderBags(pane, data, document, formOpen) {
  const form = formBase(document, 'bags', '새 봉지');
  form.id = 'new-bag-form';
  form.hidden = !formOpen;
  addFieldset(document, form, '봉지 정보', [
    ['봉지 이름', 'name', 'text', true],
    ['원두', 'beanId', 'select', true],
    ['로스팅 날짜 (선택)', 'roastedOn', 'date', false],
  ]);
  fillSelect(form.elements.beanId, data.beans, '원두를 선택해 주세요.');
  addFormActions(document, form, 'bags');
  pane.append(form);
  if (!data.bags.length) pane.append(make(document, 'p', '등록된 봉지가 없습니다.', 'empty-state'));
  for (const bean of data.beans) {
    const article = make(document, 'article', undefined, 'bag-group');
    article.append(make(document, 'h3', bean.name));
    const bags = data.bags.filter(item => item.beanId === bean.id);
    if (!bags.length) article.append(make(document, 'p', '등록된 봉지가 없습니다.'));
    for (const bag of bags) {
      article.append(make(document, 'p', `${bag.name}${bag.roastedOn ? ` · 로스팅 ${bag.roastedOn}` : ''}`));
    }
    pane.append(article);
  }
}

function recipeCard(document, recipe, data, detailed = false) {
  const article = make(document, 'article', undefined, 'recipe-card');
  article.append(make(document, 'h3', recipe.name));
  article.append(make(document, 'p', `${recipe.dripper || '드리퍼 미기록'} · ${recipe.dose}g · ${recipe.temperature}℃ · 물 ${recipe.totalWater}g`));
  const details = [
    ['분쇄도', recipe.grind], ['그라인더', recipe.grinder],
    ['그라인더 설정', recipe.grinderSetting], ['분쇄 입자', recipe.microns === null || recipe.microns === '' ? '' : `${recipe.microns}μm`],
  ].filter(([, value]) => value !== undefined && value !== null && value !== '');
  for (const [title, value] of details) article.append(make(document, 'p', `${title}: ${value}`));

  const stats = recipe.stats ?? { count: 0, average: null };
  article.append(make(document, 'p', stats.count ? `평가 ${stats.count}회 · 평균 ${Number(stats.average).toFixed(1)}점` : '평가 없음 · 0회'));
  article.append(makeStepTable(document, recipe.steps));

  const records = data.records.filter(record => record.recipeId === recipe.id).sort((a, b) => b.date.localeCompare(a.date));
  article.append(make(document, 'h4', '추출 기록'));
  if (!records.length) article.append(make(document, 'p', '기록 없음'));
  for (const record of records) {
    article.append(make(document, 'p', `${record.date} · ${'★'.repeat(record.rating)}${record.cupNote ? ` · 컵노트: ${record.cupNote}` : ''}`));
    const bag = data.bags.find(item => item.id === record.bagId);
    const bagName = record.bagId ? (bag?.name || '조회할 수 없는 봉지') : '선택 안 함';
    article.append(make(document, 'p', `원두 봉지: ${bagName}`, 'record-bag'));
    const snapshot = record.snapshot;
    if (snapshot) {
      article.append(make(document, 'p', `기록 당시 조건: ${snapshot.dripper || '드리퍼 미기록'} · ${snapshot.dose}g · ${snapshot.temperature}℃ · 물 ${snapshot.totalWater}g`));
      article.append(make(document, 'div', `당시 단계: ${snapshot.steps.map(step => `${step.name} ${formatTime(step.seconds)} · ${step.water}g · 누적 ${step.cumulativeWater}g`).join(' / ')}`, 'snapshot-steps'));
    }
  }
  if (detailed) {
    const record = button(document, '이 레시피로 추출 기록', 'button', 'new-record');
    record.dataset.id = recipe.id;
    article.append(record);
  }
  const copy = button(document, '이 레시피 복사', 'button', 'copy-recipe');
  copy.dataset.id = recipe.id;
  article.append(copy);
  return article;
}

function makeStepTable(document, steps) {
  const wrap = make(document, 'div', undefined, 'table-scroll');
  wrap.setAttribute('role', 'region');
  wrap.setAttribute('aria-label', '레시피 단계 표');
  wrap.setAttribute('tabindex', '0');
  const table = make(document, 'table', undefined, 'steps-table');
  const head = make(document, 'thead');
  const header = make(document, 'tr');
  for (const title of ['단계', '누적 시간', '간격', '이번 물 양', '누적 물 양']) header.append(make(document, 'th', title));
  head.append(header);
  table.append(head);
  const body = make(document, 'tbody');
  for (const step of steps) {
    const row = make(document, 'tr');
    for (const value of [step.name, formatTime(step.seconds), `${step.interval}초`, `${step.water}g`, `${step.cumulativeWater}g`]) {
      row.append(make(document, 'td', value));
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
    ['원두', 'beanId', 'select', true],
    ['드리퍼', 'dripper', 'text', false],
    ['원두 사용량 (g)', 'dose', 'number', true, { step: 'any', min: 0 }],
    ['분쇄도', 'grind', 'text', false],
    ['그라인더', 'grinder', 'text', false],
    ['그라인더 설정', 'grinderSetting', 'text', false],
    ['분쇄 입자 (μm, 선택)', 'microns', 'number', false, { step: 'any', min: 0 }],
    ['물 온도 (℃)', 'temperature', 'number', true, { step: 'any', min: 0, max: 100 }],
    ['총 물 양 (g)', 'totalWater', 'number', true, { step: 'any', min: 0 }],
  ]);
  fillSelect(form.elements.beanId, data.beans, '원두를 선택해 주세요.');
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

function buildRecordForm(document, data) {
  const form = formBase(document, 'records', '추출 후 빠른 기록');
  addFieldset(document, form, '기록', [
    ['날짜', 'date', 'date', true],
    ['레시피', 'recipeId', 'select', true],
    ['별점 (1~5)', 'rating', 'number', true, { min: 1, max: 5, step: 1 }],
    ['원두 봉지 (선택)', 'bagId', 'select', false],
    ['컵노트 (선택)', 'cupNote', 'textarea', false],
  ]);
  fillSelect(form.elements.recipeId, data.recipes, '레시피를 선택해 주세요.');
  fillSelect(form.elements.bagId, [], '봉지 선택 안 함', true);
  form.elements.date.value = localDate();
  addFormActions(document, form, 'records');
  return form;
}

function addFormActions(document, form, kind) {
  const actions = make(document, 'div', undefined, 'form-actions');
  actions.append(button(document, `${{ beans: '원두', bags: '봉지', recipes: '레시피', records: '기록' }[kind]} 저장`));
  actions.append(button(document, '입력 취소', 'button', 'cancel-form'));
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
    select.append(option);
  }
}

function buildResolutionForm(document, operation) {
  const names = { beans: '원두', bags: '원두 봉지', recipes: '레시피', records: '추출 기록' };
  const hasKnownPages = operation.knownPageCount > 0;
  const card = make(document, 'article', undefined, 'resolution-card');
  const status = operation.status === 'partial' ? '일부 저장' : '저장 여부 확인 필요';
  card.append(make(document, 'h3', `${names[operation.kind] ?? '저장'} · ${status}`));
  card.append(make(document, 'p', hasKnownPages
    ? `확인된 항목 ${operation.knownPageCount}개. 원본에서 이 항목의 상태를 확인해 저장됨 또는 모두 보관 취소됨을 선택해 주세요.`
    : 'Notion 원본을 직접 확인하고, 이번 작업의 결과에 맞는 선택을 해 주세요.'));
  if (!hasKnownPages) card.append(make(document, 'p', '저장됨을 선택할 때는 이번 작업으로 새로 만들어진 모든 페이지의 ID를 입력해 주세요. ID는 상태 메시지에 표시하지 않습니다.', 'muted-note'));

  const form = make(document, 'form', undefined, 'form-grid resolution-form');
  const confirmed = label(document, 'Notion 원본에서 이번 작업의 결과를 직접 확인했습니다.', 'originalConfirmed', 'checkbox', true);
  form.append(confirmed);
  const decision = label(document, '확인 결과', 'decision', 'select', true);
  const select = decision.querySelector('select');
  const decisions = [
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

function bindEvents({ page, connectionForm, originalConnectionCheck, content, actions, document, view }) {
  connectionForm.addEventListener('input', () => actions.setDirty(true, 'connection'));
  connectionForm.addEventListener('submit', async event => {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    try {
      await actions.connect({
        token: formData.get('token'),
        dataSources: Object.fromEntries(SOURCE_FIELDS.map(([key]) => [key, formData.get(key)])),
      });
    } catch { /* Safe status text is supplied by the controller. */ }
  });

  globalThis.window?.addEventListener?.('hashchange', () => view.renderRoute(globalThis.window.location.hash.slice(1)));

  page.addEventListener('click', async event => {
    const target = event.target.closest('[data-action]');
    const action = target?.dataset.action;
    if (!action) return;
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
      connectionForm.reset();
      actions.setDirty(false, 'connection');
      view.showStatus({ type: 'cancelled', message: '연결 입력을 취소했습니다.' });
      return;
    }
    if (action === 'show-bean-form') {
      view.showBeanForm();
      return;
    }
    if (action === 'show-bag-form') {
      view.showBagForm();
      return;
    }
    if (action === 'show-recipe-form') {
      view.showRecipeForm();
      return;
    }
    if (action === 'show-record-form') {
      view.showRecordForm();
      return;
    }
    if (action === 'cancel-form') {
      const kind = target.closest('form')?.dataset.form;
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
        form.elements.recipeId.value = recipeId;
        updateBagChoices(form, windowData);
        actions.setDirty(true, 'records');
      }
      return;
    }
    if (action === 'refresh') {
      try { await actions.refresh(); } catch { /* The status region explains read failures. */ }
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
      for (const key of ['name', 'beanId', 'dripper', 'dose', 'grind', 'grinder', 'grinderSetting', 'microns', 'temperature', 'totalWater']) {
        if (form.elements[key]) form.elements[key].value = source[key] ?? '';
      }
      form.elements.name.value = `${source.name} 복사`;
      form.dataset.copyId = source.id;
      setSteps(form, source.steps);
      actions.setDirty(true, 'recipes');
    }
  });

  content.addEventListener('input', event => {
    const form = event.target.form;
    if (FORM_KINDS.has(form?.dataset.form)) actions.setDirty(true, form.dataset.form);
    updatePreview(content);
    const fieldLabel = event.target.closest('label');
    fieldLabel?.querySelector('.field-error')?.remove();
    event.target.removeAttribute('aria-invalid');
  });
  content.addEventListener('change', event => {
    if (event.target.name === 'recipeId' && windowData) updateBagChoices(event.target.form, windowData);
    updatePreview(content);
  });
  content.addEventListener('submit', async event => {
    const form = event.target;
    const kind = form.dataset.form;
    if (!FORM_KINDS.has(kind)) return;
    event.preventDefault();
    clearFieldErrors(form);
    try {
      let payload;
      if (kind === 'recipes') {
        payload = recipePayload(form);
        if (form.dataset.copyId) await actions.submit('copy', { recipeId: form.dataset.copyId, changes: payload });
        else await actions.submit(kind, payload);
      } else {
        payload = Object.fromEntries(new FormData(form));
        await actions.submit(kind, payload);
      }
    } catch (error) {
      const message = error?.status === 400 || error?.code === 'input' || error?.code === 'stale-read'
        ? '입력값이나 최신 원본 관계를 확인해 주세요.'
        : error?.writeState === 'unknown' ? '저장 여부 확인이 필요합니다. 입력값을 보존했습니다.'
          : '저장하지 못했습니다. 입력값을 보존했습니다.';
      showFieldError(form, message);
    }
  });
  page.addEventListener('invalid', event => {
    const field = event.target;
    if (field?.form) showFieldError(field.form, '필수 입력과 입력 범위를 확인해 주세요.', field);
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

function updateBagChoices(form, data) {
  if (!form?.elements?.recipeId || !form.elements.bagId) return;
  const selectedBag = form.elements.bagId.value;
  const recipe = data.recipes.find(item => item.id === form.elements.recipeId.value);
  fillSelect(form.elements.bagId, data.bags.filter(bag => bag.beanId === recipe?.beanId), '봉지 선택 안 함', true);
  if ([...form.elements.bagId.options].some(option => option.value === selectedBag)) form.elements.bagId.value = selectedBag;
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
  if (!form) return;
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
    if (form.dataset.form === 'records' && name === 'bagId') continue;
    const field = form.elements[name];
    if (field) field.value = value;
  }
  if (form.dataset.form === 'records') {
    updateBagChoices(form, data);
    form.elements.bagId.value = draft.values.bagId ?? '';
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

function clearFieldErrors(form) {
  form.querySelectorAll('.field-error').forEach(item => item.remove());
  form.querySelectorAll('[aria-invalid="true"]').forEach(item => item.removeAttribute('aria-invalid'));
}

function showFieldError(form, message, field) {
  clearFieldErrors(form);
  const target = field || form.querySelector('[required]:invalid') || form.querySelector('input,select,textarea');
  if (!target) return;
  target.setAttribute('aria-invalid', 'true');
  const targetLabel = target.closest('label');
  const error = make(form.ownerDocument, 'span', message, 'field-error');
  error.setAttribute('role', 'alert');
  (targetLabel || target.parentElement).append(error);
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
