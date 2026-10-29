import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createAppView } from '../pwa/ui/view.mjs';
import { createAppController } from '../pwa/ui/controller.mjs';
import { validateRecipe } from '../lib/domain.mjs';
import { buildRecordsInsights } from '../pwa/ui/records-insights.mjs';

const BEAN = '11111111-1111-4111-8111-111111111111';
const RECIPE = '33333333-3333-4333-8333-333333333333';

class TestElement {
  constructor(tagName, ownerDocument) {
    this.tagName = tagName.toLowerCase();
    this.ownerDocument = ownerDocument;
    this.children = [];
    this.parentElement = null;
    this.dataset = {};
    this.attributes = new Map();
    this.value = '';
    this.disabled = false;
    this.hidden = false;
    this.open = false;
    this.selected = false;
    this.text = '';
    this.listeners = new Map();
    this.style = { setProperty(name, value) { this[name] = value; } };
  }
  append(...nodes) {
    for (const node of nodes) {
      if (node.parentElement) node.parentElement.children = node.parentElement.children.filter(child => child !== node);
      node.parentElement = this;
      this.children.push(node);
    }
  }
  insertBefore(node, reference) {
    if (node === reference) return node;
    if (node.parentElement) node.parentElement.children = node.parentElement.children.filter(child => child !== node);
    const index = reference ? this.children.indexOf(reference) : -1;
    node.parentElement = this;
    if (index < 0) this.children.push(node);
    else this.children.splice(index, 0, node);
    return node;
  }
  replaceChildren(...nodes) {
    for (const child of this.children) child.parentElement = null;
    this.children = [];
    this.append(...nodes);
  }
  set textContent(value) { this.text = String(value); this.replaceChildren(); }
  get textContent() { return this.text + this.children.map(child => child.textContent).join(''); }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  showModal() {
    this.open = true;
    this.ownerDocument.topLayerOrder += 1;
    this.topLayerOrder = this.ownerDocument.topLayerOrder;
  }
  close() {
    this.open = false;
  }
  showPopover() {
    this.popoverOpen = true;
    this.ownerDocument.topLayerOrder += 1;
    this.topLayerOrder = this.ownerDocument.topLayerOrder;
  }
  hidePopover() {
    this.popoverOpen = false;
  }
  focus() { this.ownerDocument.activeElement = this; }
  reset() { for (const field of this.querySelectorAll('input[name],textarea[name],select[name]')) field.value = ''; }
  remove() { if (this.parentElement) this.parentElement.children = this.parentElement.children.filter(child => child !== this); this.parentElement = null; }
  addEventListener(type, listener) {
    const listeners = this.listeners.get(type) ?? [];
    listeners.push(listener);
    this.listeners.set(type, listeners);
  }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
  removeAttribute(name) { this.attributes.delete(name); }
  querySelector(selector) { return this.querySelectorAll(selector)[0] ?? null; }
  querySelectorAll(selector) {
    const selectors = selector.split(',').map(value => value.trim());
    const result = [];
    const visit = node => {
      for (const child of node.children) {
        if (selectors.some(item => child.matches(item))) result.push(child);
        visit(child);
      }
    };
    visit(this);
    return result;
  }
  matches(selector) {
    const attr = selector.match(/\[([^\]=]+)(?:="([^"]*)")?\]/);
    const tag = selector.match(/^[a-z][a-z0-9-]*/i)?.[0]?.toLowerCase();
    const classes = [...selector.matchAll(/\.([a-z0-9_-]+)/gi)].map(match => match[1]);
    if (tag && this.tagName !== tag) return false;
    if (classes.some(name => !String(this.className ?? '').split(/\s+/).includes(name))) return false;
    if (!attr) return true;
    const [, name, expected] = attr;
    let actual;
    if (name.startsWith('data-')) actual = this.dataset[name.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase())];
    else if (name === 'name') actual = this.name;
    else actual = this.getAttribute(name);
    if (actual === undefined || actual === null) return false;
    return expected === undefined || String(actual) === expected;
  }
  closest(selector) {
    let current = this;
    while (current) { if (current.matches(selector)) return current; current = current.parentElement; }
    return null;
  }
  get elements() {
    const fields = this.querySelectorAll('input[name],textarea[name],select[name]');
    const entries = Object.fromEntries(fields.map(field => [field.name, field]));
    for (const name of new Set(fields.filter(field => field.type === 'radio').map(field => field.name))) {
      const radios = fields.filter(field => field.name === name);
      entries[name] = {
        get value() { return radios.find(field => field.checked)?.value ?? ''; },
        set value(value) { for (const field of radios) field.checked = field.value === value; },
      };
    }
    return entries;
  }
  get options() { return this.children.filter(child => child.tagName === 'option'); }
  get form() { return this.closest('form'); }
  get firstElementChild() { return this.children[0] ?? null; }
  get lastElementChild() { return this.children.at(-1) ?? null; }
  get childrenLength() { return this.children.length; }
}

class TestDocument {
  constructor() { this.root = new TestElement('main', this); this.root.id = 'app-root'; this.topLayerOrder = 0; }
  createElement(tagName) { return new TestElement(tagName, this); }
  createElementNS(namespace, tagName) {
    const node = new TestElement(tagName, this);
    node.namespaceURI = namespace;
    return node;
  }
  querySelector(selector) { return selector === '#app-root' ? this.root : this.root.querySelector(selector); }
  querySelectorAll(selector) { return this.root.querySelectorAll(selector); }
}

function mountInPage(document) {
  const body = document.createElement('body');
  const page = document.createElement('div');
  page.className = 'page';
  page.dataset.pullState = 'idle';
  page.style.transform = 'matrix(1, 0, 0, 1, 0, 0)';
  page.append(document.root);
  body.append(page);
  document.body = body;
  const querySelector = document.querySelector.bind(document);
  document.querySelector = selector => selector === '.page' ? page : querySelector(selector);
  return { body, page };
}

function createBeanView(document, options) {
  const view = createAppView(document, options);
  view.renderRoute('/beans');
  return view;
}

async function clickViewTarget(document, target) {
  const page = document.root.firstElementChild;
  for (const listener of page.listeners.get('click') ?? []) await listener({ target });
}

const data = () => ({
  beans: [{ id: BEAN, name: '원두 <안전>', origin: '시다마 · 테스트 농장', roaster: '로스터리', variety: '74110', process: '워시드', tastingNotes: '복숭아' }],
  bags: [{ id: '22222222-2222-4222-8222-222222222222', name: '6월 봉지', beanId: BEAN, roastedOn: '2026-06-01' }],
  recipes: [{ id: RECIPE, name: 'V60', beanId: BEAN, dripper: 'V60', dose: 15, grind: '중간보다 가늘게', grinder: 'Comandante', grinderSetting: '24클릭', microns: 450, temperature: 93, totalWater: 250,
    extractionGuide: '교반 없음\n목표 추출 완료 시간: 2분 30초',
    stats: { count: 0, average: null }, steps: [
      { id: '44444444-4444-4444-8444-444444444444', name: '뜸', seconds: 0, interval: 0, water: 50, cumulativeWater: 50 },
      { id: '55555555-5555-4555-8555-555555555555', name: '붓기', seconds: 70, interval: 40, water: 200, cumulativeWater: 250 },
    ] }],
  records: [{ id: '66666666-6666-4666-8666-666666666666', beanId: BEAN, beanResolution: 'relation', recipeId: RECIPE, date: '2026-06-15', rating: 5, cupNote: '꿀, 살구', snapshotStatus: 'valid', snapshot: { version: 1, recordGeneration: 'bagless-v1', id: RECIPE, beanId: BEAN, name: 'V60', dripper: 'V60', dose: 15, temperature: 93, totalWater: 250, steps: [{ name: '뜸', seconds: 0, water: 50, cumulativeWater: 50 }] } }],
});

const CONNECTION = { token: 'test-only-token', dataSources: {} };

test('connection settings open only after no saved connection is found', () => {
  const document = new TestDocument();
  const view = createBeanView(document);
  const panel = document.root.querySelector('.connection-panel');
  assert.equal(panel.hidden, true);
  view.showConnection({ connected: false, retryInitialization: true });
  assert.equal(document.root.querySelector('.connection-details').hidden, true);
  view.showConnection({ connected: false });
  assert.equal(panel.hidden, false);
  assert.equal(panel.open, true);
});

test('startup checking shows the status toast outside the locked page until retry is needed', () => {
  const document = new TestDocument();
  const { body, page } = mountInPage(document);
  const view = createBeanView(document);
  const status = document.root.querySelector('.app-status');
  view.setState({ pending: true, frozen: false, unresolved: false });
  view.showConnection({ connected: false, checkingInitialization: true });
  view.showStatus({ type: 'startup-checking', message: '저장된 연결 확인 중' });
  assert.equal(Boolean(body.querySelector('.startup-loading')), false, 'startup must not add a viewport overlay');
  assert.equal(status.hidden, false);
  assert.equal(status.textContent, '저장된 연결 확인 중');
  assert.equal(status.parentElement === body, true, 'the toast stays outside the inert startup surface');
  assert.equal(status.getAttribute('aria-busy'), 'true');
  assert.equal(status.getAttribute('role'), 'status');
  assert.equal(status.querySelector('.status-icon').dataset.state, 'saving');
  assert.equal(page.inert, true);
  assert.equal(document.root.querySelector('.connection-panel').hidden, true);
  assert.equal(document.root.querySelector('.connection-details').hidden, true);
  assert.equal(document.root.querySelector('.startup-retry-panel').hidden, true);
  assert.equal(document.root.querySelector('.connection-toggle').disabled, true);

  view.showStatus({ type: 'startup-busy', message: '잠시 후 다시 시도해 주세요.' });
  view.showConnection({ connected: false, retryInitialization: true });
  assert.equal(Boolean(body.querySelector('.startup-loading')), false);
  assert.equal(status.textContent, '잠시 후 다시 시도해 주세요.');
  assert.equal(page.inert, false);
  assert.equal(status.getAttribute('aria-busy'), 'true', 'startup stays pending until cleanup');
  assert.equal(document.root.querySelector('.startup-retry-panel').hidden, false);
  view.setState({ pending: false, frozen: false, unresolved: false });
  assert.equal(status.getAttribute('aria-busy'), 'false');

  view.setState({ pending: true, frozen: false, unresolved: false });
  view.showConnection({ connected: false, checkingInitialization: true });
  view.showStatus({ type: 'startup-checking', message: '저장된 연결 확인 중' });
  assert.equal(status.parentElement === body, true);
  assert.equal(status.hidden, false);
  assert.equal(page.inert, true);
  assert.equal(document.root.querySelector('.startup-retry-panel').hidden, true);
  view.showConnection({ connected: false });
  view.showStatus({ type: 'disconnected', message: 'Notion 연결 정보를 입력해 주세요.' });
  view.setState({ pending: false, frozen: false, unresolved: false });
  assert.equal(Boolean(body.querySelector('.startup-loading')), false);
  assert.equal(page.inert, false);
  assert.equal(status.parentElement === document.root.firstElementChild ||
    status.parentElement === document.root.querySelector('.connection-panel'), true);
  assert.equal(status.textContent, 'Notion 연결 정보를 입력해 주세요.');
  assert.equal(document.root.querySelector('.connection-details').hidden, false);
  assert.equal(document.root.querySelector('.connection-toggle').disabled, false);
});

for (const outcome of ['saved', 'missing', 'error', 'recovery', 'busy', 'read-error']) {
  test(`initialization toast reaches the ${outcome} outcome and releases startup lock`, async () => {
    const document = new TestDocument();
    const { body, page } = mountInPage(document);
    const view = createBeanView(document);
    let finishRead;
    const connectionRead = new Promise(resolve => { finishRead = resolve; });
    const context = {
      async inspect() { return { initialized: true, blocked: false }; },
      async readJournal() { return { operations: [], activeConnectionRevision: 1 }; },
    };
    const app = createAppController({ view,
      state: { withWriteLock: action => action(context) },
      file: { async readConnection() {
        await connectionRead;
        if (outcome === 'error') throw { code: 'read-failed' };
        if (outcome === 'busy') throw { code: 'lock-busy' };
        if (outcome === 'missing') return null;
        return { ...CONNECTION, revision: outcome === 'recovery' ? 2 : 1 };
      } },
      makeClient: () => ({ async verify() {} }),
      makeRepository: () => ({ async listBeans() {
        if (outcome === 'read-error') throw { code: 'read-failed' };
        return { items: data().beans, nextCursor: null, hasMore: false, complete: true };
      }, async readAll() { return data(); } }),
      makeCommands: () => ({}),
    });
    const status = document.root.querySelector('.app-status');
    const initializing = app.initialize();
    assert.equal(Boolean(body.querySelector('.startup-loading')), false);
    assert.equal(status.hidden, false);
    assert.equal(status.textContent, '저장된 연결 확인 중');
    assert.equal(status.parentElement === body, true);
    assert.equal(status.getAttribute('aria-busy'), 'true');
    assert.equal(page.inert, true);
    assert.equal(document.root.querySelector('.startup-retry-panel').hidden, true);
    assert.equal(document.root.querySelector('.connection-panel').hidden, true);
    finishRead();
    assert.equal(await initializing, ['saved', 'read-error'].includes(outcome) ? true : outcome === 'missing' ? null : false);
    assert.equal(Boolean(body.querySelector('.startup-loading')), false);
    assert.equal(page.inert, false);
    assert.equal(status.hidden, false);
    assert.equal(status.getAttribute('aria-busy'), 'false');
    assert.equal(status.parentElement === document.root.firstElementChild ||
      status.parentElement === document.root.querySelector('.connection-panel'), true);
    if (outcome === 'saved') {
      assert.equal(status.textContent, '화면을 불러왔습니다.');
      assert.equal(status.querySelector('.status-icon').dataset.state, 'success');
    }
    assert.equal(status.dataset.state, { saved: 'loaded', missing: 'disconnected', error: 'connection-error',
      recovery: 'connection-error', busy: 'startup-busy', 'read-error': 'read-error' }[outcome]);
    assert.equal(document.root.querySelector('.startup-retry-panel').hidden, !['busy', 'error'].includes(outcome));
    assert.equal(document.root.querySelector('.repair-panel').hidden, outcome !== 'recovery');
    assert.equal(document.root.querySelector('.connection-details').hidden, ['busy', 'error', 'recovery'].includes(outcome));
  });
}

test('pending work keeps its toast and startup lock through ready completion', () => {
  const document = new TestDocument();
  const { body, page } = mountInPage(document);
  const view = createBeanView(document);
  const status = document.root.querySelector('.app-status');
  assert.equal(Boolean(body.querySelector('.startup-loading')), false);
  assert.equal(page.style.transform, 'matrix(1, 0, 0, 1, 0, 0)');
  assert.equal(page.dataset.pullState, 'idle');
  view.setState({ pending: true, frozen: false, unresolved: false });
  view.showStatus({ type: 'startup-checking', message: '저장된 연결 확인 중' });
  assert.equal(page.inert, true);
  assert.equal(status.parentElement === body, true);
  assert.equal(status.textContent, '저장된 연결 확인 중');
  view.showStatus({ type: 'ready', message: '' });
  assert.equal(status.hidden, false, 'ready must not end pending work');
  assert.equal(status.getAttribute('aria-busy'), 'true');
  assert.equal(status.querySelector('.status-icon').dataset.state, 'saving');
  assert.equal(status.parentElement === document.root.firstElementChild, true);
  view.setState({ pending: false, frozen: false, unresolved: false });
  assert.equal(Boolean(body.querySelector('.startup-loading')), false);
  assert.equal(page.inert, false);
  assert.equal(status.hidden, true);
  assert.equal(status.textContent, '');
});

test('saved connection opens settings modally and closing discards unsaved secrets', async () => {
  const document = new TestDocument();
  const tools = document.createElement('div');
  const querySelector = document.querySelector.bind(document);
  document.querySelector = selector => selector === '#connection-tools' ? tools : querySelector(selector);
  const view = createBeanView(document);
  const icon = tools.querySelector('button');
  assert.ok(icon, 'settings icon belongs in the header slot before build information');
  assert.equal(icon.getAttribute('aria-label'), 'Notion 연결 설정');
  const panel = document.root.querySelector('.connection-panel');
  assert.equal(icon.disabled, true);
  view.showConnection({ connected: true });
  assert.equal(panel.hidden, true);
  assert.equal(icon.getAttribute('aria-expanded'), 'false');
  for (const listener of icon.listeners.get('click')) await listener();
  assert.equal(panel.hidden, false);
  assert.equal(icon.getAttribute('aria-expanded'), 'true');
  const token = panel.querySelector('input[name="token"]');
  token.value = 'unsaved-test-token';
  for (const listener of icon.listeners.get('click')) await listener();
  assert.equal(panel.hidden, true);
  for (const listener of icon.listeners.get('click')) await listener();
  assert.equal(panel.hidden, false);
  assert.equal(token.value, '');
  view.showConnection({ connected: true });
  assert.equal(panel.hidden, true, 'successful save collapses settings again');
  view.showConnection({ connected: false, needsRecovery: true });
  assert.equal(panel.hidden, false);
  assert.equal(panel.querySelector('.repair-panel').hidden, false);
});

for (const outcome of ['navigation', 'refresh', 'error', 'cancelled']) {
  test(`controller screen loading toast reaches the ${outcome} outcome`, async t => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    const document = new TestDocument();
    const view = createBeanView(document);
    let completeRead;
    let failRead;
    let markStarted;
    let deferRead = false;
    const started = new Promise(resolve => { markStarted = resolve; });
    const pageResult = { items: [], complete: true, hasMore: false };
    const read = () => {
      if (!deferRead) return Promise.resolve(pageResult);
      markStarted();
      return new Promise((resolve, reject) => { completeRead = resolve; failRead = reject; });
    };
    const context = {
      async inspect() { return { initialized: false, blocked: false }; },
      async readJournal() { return { operations: [], connectionGuard: null }; },
      async beginConnectionChange() {}, async commitConnectionChange() {},
    };
    const app = createAppController({ view,
      state: { withWriteLock: action => action(context) }, file: {},
      makeClient: () => ({ async verify() {} }),
      makeRepository: () => ({ listBeans: read, listRecipeSummaries: read }),
      makeCommands: () => ({}), uuid: () => 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    });
    await app.connect({ token: 'fake-only', dataSources: { beans: BEAN, recipes: RECIPE, steps: BEAN, records: RECIPE } });
    deferRead = true;
    if (outcome !== 'refresh') view.renderRoute('/recipes');
    const loading = outcome === 'refresh' ? app.refresh() : app.loadRoute('/recipes', { force: true });
    const result = loading.catch(error => error);
    await started;
    const status = document.root.querySelector('.app-status');
    const icon = status.querySelector('.status-icon');
    assert.equal(status.hidden, false);
    assert.equal(icon.hidden, false);
    assert.equal(icon.dataset.state, 'saving', 'a fresh screen load replaces a previous completion icon');
    if (outcome === 'error' || outcome === 'cancelled') failRead({ code: outcome === 'cancelled' ? 'read-cancelled' : 'read-failed' });
    else completeRead(pageResult);
    await result;
    assert.equal(status.hidden, false, 'the outcome remains visible after loading finishes');
    if (outcome === 'error' || outcome === 'cancelled') {
      assert.equal(icon.hidden, true);
      assert.notEqual(icon.dataset.state, 'success');
    } else {
      assert.equal(status.textContent, '화면을 불러왔습니다.');
      assert.equal(icon.hidden, false);
      assert.equal(icon.dataset.state, 'success');
      assert.equal(status.getAttribute('aria-busy'), 'false');
    }
    t.mock.timers.tick(999);
    assert.equal(status.hidden, false);
    t.mock.timers.tick(1);
    assert.equal(status.hidden, true);
  });
}

test('toast trailing icon changes from loading to completion without replacing its message', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const document = new TestDocument();
  const view = createBeanView(document);
  const status = document.root.querySelector('.app-status');
  const icon = status.querySelector('.status-icon');
  assert.ok(icon, 'toast includes a trailing status icon');
  assert.equal(status.children.at(-1), icon);
  assert.equal(icon.getAttribute('aria-hidden'), 'true');
  assert.equal(icon.hidden, true);
  for (const [loading, completed] of [['saving', 'saved'], ['checking', 'connected'], ['saving', 'resolved']]) {
    view.setState({ pending: true });
    view.showStatus({ type: loading, message: '저장 중입니다.' });
    assert.equal(icon.hidden, false);
    assert.equal(icon.dataset.state, 'saving');
    assert.equal(status.querySelector('.status-message').textContent, '저장 중입니다.');
    view.showStatus({ type: completed, message: '완료했습니다.' });
    assert.equal(status.querySelector('.status-icon'), icon);
    assert.equal(icon.dataset.state, 'success', 'completed work shows a check even during list refresh');
    assert.equal(icon.querySelector('path').getAttribute('d'), 'M4 12l5 5 11-11');
    assert.equal(status.textContent, '완료했습니다.');
    view.setState({ pending: false });
    t.mock.timers.tick(999);
    assert.equal(status.hidden, false);
    t.mock.timers.tick(1);
    assert.equal(status.hidden, true);
    assert.equal(icon.hidden, true);
  }
});

test('toast loading fallback resets on errors and neutral messages', () => {
  const document = new TestDocument();
  const view = createBeanView(document);
  const status = document.root.querySelector('.app-status');
  const icon = status.querySelector('.status-icon');
  assert.ok(icon);
  view.setRouteReadState('loading');
  assert.equal(icon.dataset.state, 'saving');
  assert.equal(icon.hidden, false);
  view.setRouteReadState('ready');
  for (const type of ['validation-error', 'connection-error', 'saved-read-error', 'cancelled', 'disconnected']) {
    view.showStatus({ type: 'saved', message: '저장했습니다.' });
    view.showStatus({ type, message: '확인해 주세요.' });
    assert.equal(icon.hidden, true, type);
    assert.equal(icon.dataset.state, 'idle', type);
  }
});

test('successful status messages stay visible for one second then hide', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const document = new TestDocument();
  const view = createBeanView(document);
  const status = document.root.querySelector('.app-status');
  for (const type of ['connected', 'saved', 'resolved', 'cancelled']) {
    view.showStatus({ type, message: '완료했습니다.' });
    assert.equal(status.hidden, false);
    assert.equal(status.textContent, '완료했습니다.');
    t.mock.timers.tick(999);
    assert.equal(status.hidden, false);
    t.mock.timers.tick(1);
    assert.equal(status.hidden, true, type);
    assert.equal(status.popoverOpen, false, type);
  }
});

test('errors and recovery notices hide one second after replacing success', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const document = new TestDocument();
  const view = createBeanView(document);
  const status = document.root.querySelector('.app-status');
  for (const type of ['error', 'read-error', 'connection-error', 'validation-error', 'resolution-error',
    'saved-read-error', 'unknown', 'partial', 'failed', 'resolution-required', 'startup-busy',
    'disconnected']) {
    view.showStatus({ type: 'connected', message: '완료' });
    t.mock.timers.tick(500);
    view.showStatus({ type, message: '확인이 필요합니다.' });
    t.mock.timers.tick(999);
    assert.equal(status.hidden, false, type);
    assert.equal(status.textContent, '확인이 필요합니다.');
    t.mock.timers.tick(1);
    assert.equal(status.hidden, true, type);
    assert.equal(status.popoverOpen, false, type);
  }
});

test('checking and saving feedback stays visible while work is in progress', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const document = new TestDocument();
  const view = createBeanView(document);
  for (const type of ['checking', 'saving', 'loading']) {
    view.showStatus({ type, message: '진행 중…' });
    t.mock.timers.tick(10000);
    assert.equal(document.root.querySelector('.app-status').hidden, false);
  }
});

test('status messages share one bottom safe-area toast above native modal dialogs', () => {
  const stylesheet = readFileSync(new URL('../pwa/styles.css', import.meta.url), 'utf8');
  const toastRule = stylesheet.match(/\.connection-note,\s*\.app-status\s*\{([^}]*)\}/s);
  assert.ok(toastRule, 'the startup note and app status share toast positioning');
  const document = new TestDocument();
  const view = createBeanView(document);
  const status = document.root.querySelector('.app-status');
  assert.equal(status.getAttribute('popover'), 'manual');

  view.showStatus({ type: 'error', message: '저장 오류' });
  assert.equal(status.popoverOpen, true);
  const initialToastOrder = status.topLayerOrder;
  view.renderData(data());
  view.showBeanForm();
  const dialog = document.root.querySelector('dialog[data-entry-dialog="beans"]');
  assert.equal(dialog.open, true);
  assert.equal(status.parentElement, dialog, 'the active toast is placed inside a modal top-layer dialog');
  assert.equal(status.getAttribute('popover'), null);
  assert.equal(status.popoverOpen, false);
  assert.ok(dialog.children.at(-1) === status && dialog.topLayerOrder > initialToastOrder,
    'the active toast is the dialog’s last child and the dialog enters the top layer after the prior toast');

  view.showStatus({ type: 'connection-error', message: '연결 오류' });
  assert.equal(status.parentElement, dialog);
  assert.equal(status.textContent, '연결 오류');
  assert.equal(document.root.querySelectorAll('.app-status').length, 1);
  view.showStatus({ type: 'connection-error', message: '연결 오류' });
  assert.equal(document.root.querySelectorAll('.app-status').length, 1, 'repeated status reuses the same toast');
  view.renderRoute('/bags');
  assert.equal(document.root.querySelectorAll('.app-status').length, 1, 'route replacement must retain a persistent toast');
  assert.equal(status.parentElement, document.root.firstElementChild, 'a removed entry dialog returns the toast to the app layer');
  assert.equal(status.textContent, '연결 오류');

  view.showConnection({ connected: false });
  const connectionDialog = document.root.querySelector('dialog.connection-panel');
  view.showStatus({ type: 'checking', message: '연결 확인 및 저장 중…' });
  assert.equal(status.parentElement, connectionDialog, 'connection-settings modal also hosts the shared toast');
  assert.equal(connectionDialog.querySelector('[data-connection-status]'), null, 'connection feedback has no duplicate inline row');
  view.showStatus({ type: 'connection-error', message: '연결 오류' });
  assert.equal(status.parentElement, connectionDialog);
  assert.equal(status.getAttribute('role'), 'alert');
  assert.equal(status.getAttribute('aria-live'), 'assertive');
  assert.match(toastRule[1], /position:\s*fixed/);
  assert.match(toastRule[1], /safe-area-inset-bottom/);
  assert.match(toastRule[1], /safe-area-inset-left/);
  assert.match(toastRule[1], /safe-area-inset-right/);
  assert.match(toastRule[1], /pointer-events:\s*none/);
  assert.match(toastRule[1], /calc\(var\(--toast-bottom, 104px\) \+ env\(safe-area-inset-bottom/,
    'toast clears both stacked action buttons on narrow screens');
  assert.match(toastRule[1], /width:\s*fit-content/);
  assert.match(toastRule[1], /max-width:\s*min\(480px/);
  assert.match(toastRule[1], /box-shadow:/);
});

test('toast clears the actual action row of a centered modal', () => {
  const document = new TestDocument();
  document.documentElement = { clientHeight: 900 };
  const view = createBeanView(document);
  view.renderData(data());
  view.showBeanForm();
  const actions = document.root.querySelector('dialog[data-entry-dialog="beans"]').querySelector('.form-actions');
  actions.getBoundingClientRect = () => ({ top: 648, height: 76 });
  view.showStatus({ type: 'validation-error', message: '확인해 주세요.' });
  assert.equal(document.root.querySelector('.app-status').style['--toast-bottom'], '260px');
  actions.getBoundingClientRect = () => ({ top: 827, height: 72 });
  view.showStatus({ type: 'validation-error', message: '확인해 주세요.' });
  assert.equal(document.root.querySelector('.app-status').style['--toast-bottom'], '104px',
    'bottom-sheet toast sits lower while remaining above the actions');
  actions.getBoundingClientRect = () => ({ top: 0, height: 0 });
  const retry = document.root.querySelector('dialog[data-entry-dialog="beans"]').querySelector('button');
  retry.getBoundingClientRect = () => ({ top: 600, height: 44 });
  view.showStatus({ type: 'read-error', message: '다시 시도해 주세요.' });
  assert.equal(document.root.querySelector('.app-status').style['--toast-bottom'], '308px',
    'a hidden form row falls back to the visible recovery buttons');
});

test('native form validation marks its field and reports the error in the shared toast', () => {
  const document = new TestDocument();
  const view = createBeanView(document);
  view.renderData(data());
  view.bind({ setDirty() {}, getState: () => ({}) });
  const form = document.root.querySelector('form[data-form="beans"]');
  const field = form.elements.name;
  const page = document.root.firstElementChild;

  for (const listener of page.listeners.get('invalid')) listener({ target: field });

  const status = document.root.querySelector('.app-status');
  assert.equal(field.getAttribute('aria-invalid'), 'true');
  assert.equal(form.querySelector('.field-error'), null);
  assert.equal(status.textContent, '필수 입력과 입력 범위를 확인해 주세요.');
  assert.equal(status.getAttribute('role'), 'alert');
  assert.equal(status.getAttribute('aria-live'), 'assertive');
  assert.equal(status.popoverOpen, true);
});

test('pending operations use the existing toast and retain the top pull-to-refresh spinner', () => {
  const stylesheet = readFileSync(new URL('../pwa/styles.css', import.meta.url), 'utf8');
  assert.doesNotMatch(stylesheet, /\.startup-loading/, 'no viewport loading overlay styles remain');
  assert.match(stylesheet, /\.pull-refresh\[data-state="reloading"\] \.pull-refresh-spinner[\s\S]*?animation:\s*pull-refresh-spin 0\.8s steps\(12\) infinite;/,
    'the local pull-to-refresh gesture keeps its spinner');

  const document = new TestDocument();
  const { body, page } = mountInPage(document);
  const view = createBeanView(document);
  const status = document.root.querySelector('.app-status');
  const connectionToggle = document.root.querySelector('.connection-toggle');
  view.setState({ pending: true, frozen: false, unresolved: false });
  view.showStatus({ type: 'startup-checking', message: '저장된 연결 확인 중' });
  assert.equal(Boolean(body.querySelector('.startup-loading')), false);
  assert.equal(status.parentElement === body, true);
  assert.equal(status.textContent, '저장된 연결 확인 중');
  assert.equal(page.inert, true);
  view.showStatus({ type: 'saving', message: '저장 중입니다.' });
  assert.equal(Boolean(body.querySelector('.startup-loading')), false);
  assert.equal(status.parentElement === document.root.firstElementChild, true);
  assert.equal(status.querySelector('.pull-refresh-spinner'), null, 'pending status has no standalone spinner node');
  assert.equal(page.dataset.pullState, 'idle');
  assert.equal(page.style.transform, 'matrix(1, 0, 0, 1, 0, 0)');
  assert.equal(status.hidden, false);
  assert.equal(status.textContent, '저장 중입니다.');
  assert.equal(status.querySelector('.status-icon').dataset.state, 'saving');
  assert.equal(status.getAttribute('role'), 'status');
  assert.equal(status.getAttribute('aria-live'), 'polite');
  assert.equal(status.getAttribute('aria-busy'), 'true');
  assert.equal(page.inert, false, 'the toast is not hidden behind the startup-only inert lock');
  assert.equal(connectionToggle.disabled, true, 'pending work still disables connection controls');
});

test('pending toast stays visible through success, ready and timeout, then clears after completion or failure', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const document = new TestDocument();
  const { body, page } = mountInPage(document);
  const view = createBeanView(document);
  const status = document.root.querySelector('.app-status');
  const assertPendingToast = state => {
    assert.equal(status.hidden, false, `status stays visible during ${state}`);
    assert.equal(status.getAttribute('aria-busy'), 'true');
    assert.equal(Boolean(body.querySelector('.startup-loading')), false);
  };

  view.setState({ pending: true, frozen: false, unresolved: false });
  view.showStatus({ type: 'saving', message: '저장 중입니다.' });
  assertPendingToast('saving');
  view.showStatus({ type: 'saved', message: '저장했습니다. 최신 목록을 다시 불러옵니다.' });
  assertPendingToast('saved');
  assert.equal(status.querySelector('.status-icon').dataset.state, 'success');
  t.mock.timers.tick(3500);
  assertPendingToast('saved after status timeout');
  view.showStatus({ type: 'ready', message: '' });
  t.mock.timers.tick(3500);
  assertPendingToast('ready after status timeout');
  view.setState({ pending: false, frozen: false, unresolved: false });
  assert.equal(Boolean(body.querySelector('.startup-loading')), false);
  assert.equal(status.getAttribute('aria-busy'), 'false');
  assert.equal(status.hidden, true);
  assert.equal(page.inert, false);

  view.setState({ pending: true, frozen: false, unresolved: false });
  view.showStatus({ type: 'saving', message: '저장 중입니다.' });
  view.showStatus({ type: 'validation-error', message: '입력 내용을 확인해 주세요.' });
  t.mock.timers.tick(3500);
  assertPendingToast('failed operation before cleanup');
  view.setState({ pending: false, frozen: false, unresolved: false });
  assert.equal(Boolean(body.querySelector('.startup-loading')), false);
  assert.equal(status.getAttribute('aria-busy'), 'false');
  assert.equal(status.hidden, false);
  assert.equal(status.textContent, '입력 내용을 확인해 주세요.');
  t.mock.timers.tick(999);
  assert.equal(status.hidden, false);
  t.mock.timers.tick(1);
  assert.equal(status.hidden, true);
});

test('clearing successful operation progress does not restore it after pending work or modal close', () => {
  const document = new TestDocument();
  const view = createBeanView(document);
  const status = document.root.querySelector('.app-status');
  view.setState({ pending: true });
  view.showStatus({ type: 'saving', message: '저장 중입니다.' });
  assert.equal(status.hidden, false);

  view.clearStatus();
  assert.equal(status.hidden, true, 'successful inline feedback clears the stale saving toast');
  view.setState({ pending: true });
  assert.equal(status.hidden, true, 'pending fallback does not restore the completed saving status');
  view.setRouteReadState('loading');
  assert.equal(status.hidden, false, 'an active screen read can still announce loading');
  assert.equal(status.textContent, '화면을 불러오는 중…');
  view.setRouteReadState('ready');
  view.clearStatus();
  view.setState({ pending: false });
  assert.equal(status.hidden, true, 'after read and pending completion, no status returns');

  view.showStatus({ type: 'saved-read-error', message: '저장은 성공했지만 목록을 불러오지 못했습니다.' });
  assert.equal(status.hidden, false, 'recovery messages remain visible after clearing progress');
  assert.equal(status.textContent, '저장은 성공했지만 목록을 불러오지 못했습니다.');
});

test('a new success gets a full display interval and empty messages hide immediately', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const document = new TestDocument();
  const view = createBeanView(document);
  const status = document.root.querySelector('.app-status');
  view.showStatus({ type: 'saved', message: '저장했습니다.' });
  t.mock.timers.tick(500);
  view.showStatus({ type: 'connected', message: '연결했습니다.' });
  t.mock.timers.tick(500);
  assert.equal(status.hidden, false);
  t.mock.timers.tick(500);
  assert.equal(status.hidden, true);
  view.showStatus({ type: 'error', message: '오류' });
  assert.equal(status.hidden, false);
  view.showStatus();
  assert.equal(status.hidden, true);
});

function controllerFor(view) {
  const context = {
    async inspect() { return { initialized: false, blocked: false }; },
    async readJournal() { return { operations: [], connectionGuard: null }; },
    async beginConnectionChange() {},
    async commitConnectionChange() {},
  };
  return createAppController({
    view,
    state: { withWriteLock: action => action(context) },
    file: {},
    makeClient: () => ({ async verify() {} }),
    makeRepository: () => ({ async listBeans() { return { items: data().beans, nextCursor: null, hasMore: false, complete: true }; },
      async readAll() { return data(); } }),
    makeCommands: () => ({}),
    uuid: () => 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  });
}

test('draft values survive tab navigation and a fresh data render', () => {
  const document = new TestDocument();
  const view = createBeanView(document);
  view.renderData(data());
  let form = document.root.querySelector('form[data-form="beans"]');
  form.elements.name.value = '보존 검증 초안';
  form.elements.origin.value = '시다마 · 새 농장';

  view.renderRoute('/bags');
  view.renderRoute('/beans');
  form = document.root.querySelector('form[data-form="beans"]');
  assert.equal(form.elements.name.value, '보존 검증 초안');
  assert.equal(form.elements.origin.value, '시다마 · 새 농장');

  view.renderData(data());
  form = document.root.querySelector('form[data-form="beans"]');
  assert.equal(form.elements.name.value, '보존 검증 초안');
});

test('bean, recipe, and record detail text is rendered as text and retains brew details', () => {
  const document = new TestDocument();
  const view = createBeanView(document);
  view.renderData(data());
  view.renderRoute(`/beans/${BEAN}`);
  assert.match(document.root.textContent, /원두 <안전>/);
  assert.equal(document.root.querySelector('img'), null);
  assert.match(document.root.textContent, /V60/);

  view.renderRoute(`/recipes/${RECIPE}`);
  const detail = document.root.querySelector('.recipe-card');
  assert.match(detail.textContent, /중간보다 가늘게/);
  assert.match(detail.textContent, /Comandante/);
  assert.match(detail.textContent, /24클릭/);
  assert.match(detail.textContent, /450μm/);
  assert.match(detail.textContent, /40초/);
  assert.match(detail.textContent, /평가 없음 · 0회/);
  assert.match(detail.textContent, /꿀, 살구/);
});

test('pour tables group cumulative values before interval and current water in three columns', () => {
  const document = new TestDocument();
  const view = createBeanView(document);
  const current = data();
  current.recipes[0].steps = [
    { name: '뜸 <안전>', seconds: 0, interval: 0, water: 30, cumulativeWater: 30 },
    { name: '1차', seconds: 30, interval: 30, water: 30, cumulativeWater: 60 },
    { name: '2차', seconds: 70, interval: 40, water: 90.5, cumulativeWater: 150.5 },
  ];
  view.renderData(current);
  for (const route of [`/recipes/${RECIPE}`]) {
    view.renderRoute(route);
    const tables = document.root.querySelectorAll('.steps-table');
    const table = tables[0];
    assert.deepEqual(table.querySelectorAll('th').map(cell => cell.textContent), ['단계', '누적 시간 (간격)', '누적 물 (이번 물)']);
    assert.ok(table.querySelectorAll('th').every(cell => cell.getAttribute('scope') === 'col'));
    assert.equal(tables.length, 2, 'live recipe and historical snapshot share the compact table');
    const rows = table.querySelector('tbody').querySelectorAll('tr');
    assert.deepEqual(rows.map(row => row.querySelectorAll('td').map(cell => cell.textContent)), [
      ['뜸 <안전>', '0:00 (0초)', '30g (30g)'],
      ['1차', '0:30 (30초)', '60g (30g)'],
      ['2차', '1:10 (40초)', '150.5g (90.5g)'],
    ]);
    assert.equal(table.querySelector('img'), null);
    assert.equal(tables[1].querySelector('tbody').textContent, '뜸0:00 (0초)50g (50g)');
  }
});

test('damaged historical records are excluded from bagless recipe views', () => {
  const document = new TestDocument();
  const view = createBeanView(document);
  const current = data();
  current.records[0].snapshot.steps = { broken: true };
  current.records[0].snapshotStatus = 'damaged';
  view.renderData(current);

  assert.doesNotThrow(() => view.renderRoute(`/recipes/${RECIPE}`));
  const detail = document.root.querySelector('.recipe-card');
  assert.equal(detail.querySelectorAll('.record-summary-header').length, 0);
  assert.match(detail.textContent, /기록 없음/);
});

test('invalid stored date and rating remain visible with field-specific warnings', () => {
  const document = new TestDocument();
  const view = createBeanView(document);
  const current = data();
  current.records[0].date = 'not-a-date';
  current.records[0].rating = 6;
  current.records[0].invalidFields = ['date', 'rating'];
  view.renderData(current);
  view.renderRoute('/records');

  const card = document.root.querySelector('.record-card');
  assert.match(card.textContent, /not-a-date/);
  assert.match(card.textContent, /6\/5/);
  assert.match(card.textContent, /기록 오류: 날짜, 별점\(정수 1~5\)/);
  assert.doesNotMatch(card.textContent, /6\/5 ★/);
});

test('recipes have no bean selector and records require both bean and shared recipe with browse filters', () => {
  const document = new TestDocument();
  const view = createBeanView(document);
  view.renderData(data());

  view.renderRoute('/recipes/new');
  const recipeForm = document.root.querySelector('form[data-form="recipes"]');
  assert.equal(recipeForm.elements.beanId, undefined);

  view.renderRoute('/records/new');
  const recordForm = document.root.querySelector('form[data-form="records"]');
  assert.ok(recordForm.elements.beanId);
  assert.ok(recordForm.elements.recipeId);
  assert.equal(recordForm.elements.beanId.required, false, 'hidden select validation is handled by its visible picker');
  assert.equal(recordForm.elements.recipeId.required, false, 'hidden select validation is handled by its visible picker');
  assert.equal(recordForm.querySelector('[data-search-picker]').querySelector('[data-action="open-search-picker"]')
    .getAttribute('aria-required'), 'true');
  assert.ok(recordForm.querySelectorAll('input[name="rating"]').every(input => input.required));

  view.renderRoute('/records');
  assert.ok(document.root.querySelector('[data-record-filter="beanId"]'));
  assert.ok(document.root.querySelector('[data-record-filter="recipeId"]'));
  assert.match(document.root.querySelector('[data-record-list]').textContent, /원두 <안전>/);
  assert.match(document.root.querySelector('[data-record-list]').textContent, /레시피: V60/);
  assert.match(document.root.querySelector('[data-record-list]').textContent, /5\/5/);
});

test('resolution controls follow the native journal page-list contract', () => {
  const document = new TestDocument();
  const view = createBeanView(document);

  view.showUnresolved([{ kind: 'beans', status: 'partial', knownPageCount: 1, resolve() {} }]);

  const form = document.root.querySelector('.resolution-form');
  assert.equal(Boolean(form.elements.pageIds), false);
  assert.equal(form.elements.decision.querySelectorAll('option').some(option => option.value === 'not-saved'), false);

  view.showUnresolved([{ kind: 'beans', status: 'unknown', knownPageCount: 0, resolve() {} }]);
  const unknownForm = document.root.querySelector('.resolution-form');
  assert.ok(unknownForm.elements.pageIds);
  assert.equal(unknownForm.elements.decision.querySelectorAll('option').some(option => option.value === 'not-saved'), true);
});

test('recipe step time permits a keyboard with colon while retaining minute-second validation', () => {
  const document = new TestDocument();
  const view = createBeanView(document);
  view.renderData(data());
  view.renderRoute('/recipes/new');
  const input = document.root.querySelector('[name="time"]');
  assert.ok(input);
  assert.equal(input.inputMode, 'text');
  const pattern = new RegExp(`^(?:${input.pattern})$`);
  assert.equal(pattern.test('0:30'), true);
  assert.equal(pattern.test('1:10'), true);
  assert.equal(pattern.test('030'), false);
  assert.equal(pattern.test('0:60'), false);
});

test('the bean origin label uses user-facing wording rather than the storage field name', () => {
  const document = new TestDocument();
  const view = createBeanView(document);
  view.renderData(data());
  const fieldLabel = document.root.querySelector('form[data-form="beans"]').elements.origin.closest('label');

  assert.match(fieldLabel.textContent, /원산지·농장/);
  assert.doesNotMatch(fieldLabel.textContent, /\(origin\)/);
});

test('the record date default follows the device calendar across the KST UTC boundary', () => {
  const RealDate = globalThis.Date;
  const originalTimezone = process.env.TZ;
  process.env.TZ = 'Asia/Seoul';
  globalThis.Date = class extends RealDate {
    constructor(...args) { super(...(args.length ? args : ['2026-01-01T00:30:00+09:00'])); }
  };
  try {
    const document = new TestDocument();
    const view = createBeanView(document);
    view.renderData(data());
    view.renderRoute('/records/new');

    assert.equal(document.root.querySelector('form[data-form="records"]').elements.date.value, '2026-01-01');
  } finally {
    globalThis.Date = RealDate;
    if (originalTimezone === undefined) delete process.env.TZ;
    else process.env.TZ = originalTimezone;
  }
});

test('checked connection-recovery checkbox reaches the current-connection verifier', async () => {
  const document = new TestDocument();
  const view = createBeanView(document);
  let confirmations = 0;
  view.bind({ confirmCurrent: async checked => { assert.equal(checked, true); confirmations++; } });
  view.showConnection({ connected: false, needsRecovery: true });
  document.root.querySelector('input[name="originalConfirmed"]').checked = true;
  const button = document.root.querySelector('button[data-action="confirm-connection"]');
  const page = document.root.firstElementChild;

  for (const listener of page.listeners.get('click')) await listener({ target: button });

  assert.equal(confirmations, 1);
});

test('startup lock contention hides connection entry and retries the saved connection read', async () => {
  const document = new TestDocument();
  const view = createBeanView(document);
  let retries = 0;
  view.bind({ initialize: async () => { retries++; } });
  view.showConnection({ connected: false, retryInitialization: true });

  assert.equal(document.root.querySelector('.connection-details').hidden, true);
  assert.equal(document.root.querySelector('.startup-retry-panel').hidden, false);
  assert.equal(document.root.querySelector('nav.tabs').hidden, true);
  assert.equal(document.root.querySelector('.data-panel').hidden, true);
  const retry = document.root.querySelector('button[data-action="retry-initialize"]');
  assert.match(document.root.textContent, /연결 정보를 입력하지 말고 다시 시도/);
  for (const listener of document.root.firstElementChild.listeners.get('click')) await listener({ target: retry });
  assert.equal(retries, 1);

  view.showConnection({ connected: false });
  assert.equal(document.root.querySelector('.startup-retry-panel').hidden, true);
  assert.equal(document.root.querySelector('.connection-details').hidden, false);
});

test('successful connection replacement preserves the active product draft', async () => {
  const document = new TestDocument();
  const view = createBeanView(document);
  const app = controllerFor(view);
  await app.connect(CONNECTION);
  document.root.querySelector('form[data-form="beans"]').elements.name.value = 'active unsaved bean';
  app.setDirty(true, 'beans');

  await app.connect(CONNECTION);

  assert.equal(document.root.querySelector('form[data-form="beans"]').elements.name.value, 'active unsaved bean');
});

test('successful connection replacement preserves hidden drafts and their dirty signal', async () => {
  const document = new TestDocument();
  const view = createBeanView(document);
  const app = controllerFor(view);
  await app.connect(CONNECTION);
  document.root.querySelector('form[data-form="beans"]').elements.name.value = 'hidden unsaved bean';
  app.setDirty(true, 'beans');
  view.renderRoute('/bags');

  await app.connect(CONNECTION);
  view.renderRoute('/beans');

  assert.equal(document.root.querySelector('form[data-form="beans"]').elements.name.value, 'hidden unsaved bean');
  assert.equal(app.getState().dirty, true);
  assert.equal(app.setFrozen(true), false);
});

test('recipe input minimums allow every positive sub-cent value accepted by the domain', () => {
  const document = new TestDocument();
  const view = createBeanView(document);
  view.renderData(data());
  view.renderRoute('/recipes/new');
  const form = document.root.querySelector('form[data-form="recipes"]');
  const valid = validateRecipe({ name: 'small-positive', beanId: BEAN, dose: 0.005,
    totalWater: 0.005, temperature: 0.005, microns: 0.005,
    steps: [{ time: '0:00', water: 0.005 }] });
  assert.equal(valid.dose, 0.005);

  for (const name of ['dose', 'temperature', 'totalWater', 'microns', 'water']) {
    assert.ok(Number(form.elements[name].min) <= 0.005,
      `${name} must not use a native minimum above the domain's positive-number boundary`);
  }
});

test('recipe history never displays legacy bag relations', () => {
  const document = new TestDocument();
  const view = createBeanView(document);
  const rows = data();
  rows.bags.push({ id: 'second-bag', name: '7월 봉지', beanId: BEAN });
  rows.records = [
    { ...rows.records[0], bagId: rows.bags[0].id },
    { ...rows.records[0], id: 'second-record', bagId: 'second-bag' },
    { ...rows.records[0], id: 'unselected-record', bagId: null },
    { ...rows.records[0], id: 'unavailable-record', bagId: 'missing-bag' },
  ];
  view.renderData(rows);
  view.renderRoute(`/recipes/${RECIPE}`);
  const detail = document.root.querySelector('.recipe-card');
  assert.equal(detail.querySelectorAll('.record-bag').length, 0);
  assert.doesNotMatch(detail.textContent, /봉지|로스팅 날짜/);
});

test('bean creation starts hidden, opens from the plus button, and closes on cancel', async () => {
  const document = new TestDocument();
  const view = createBeanView(document);
  const dirty = [];
  view.bind({ setDirty: (...args) => dirty.push(args) });
  view.renderData(data());
  const click = async target => {
    for (const listener of document.root.firstElementChild.listeners.get('click')) await listener({ target });
  };
  let form = document.root.querySelector('form[data-form="beans"]');
  assert.equal(document.root.querySelector('dialog[data-entry-dialog=\"beans\"]').open, false);
  let add = document.root.querySelector('[data-action="show-bean-form"]');
  assert.ok(add);
  assert.equal(add.getAttribute('aria-label'), '새 원두 추가');
  assert.equal(add.getAttribute('aria-controls'), document.root.querySelector('dialog[data-entry-dialog=\"beans\"]').id);
  assert.equal(add.getAttribute('aria-expanded'), 'false');
  await click(add);
  assert.equal(document.root.querySelector('dialog[data-entry-dialog=\"beans\"]').open, true);
  assert.equal(add.getAttribute('aria-expanded'), 'true');
  assert.equal(dirty.length, 0);
  form.elements.name.value = '보존할 원두';
  view.renderData(data());
  view.renderRoute('/bags');
  view.renderRoute('/beans');
  form = document.root.querySelector('form[data-form="beans"]');
  assert.equal(document.root.querySelector('dialog[data-entry-dialog=\"beans\"]').open, true);
  assert.equal(form.elements.name.value, '보존할 원두');
  await click(form.querySelector('[data-action="cancel-form"]'));
  form = document.root.querySelector('form[data-form="beans"]');
  assert.equal(document.root.querySelector('dialog[data-entry-dialog=\"beans\"]').open, false);
  assert.equal(form.elements.name.value, '');
  assert.deepEqual(dirty, [[false, 'beans']]);
});

test('bag route has no entry, delete or relation selection surface', () => {
  const document = new TestDocument();
  const view = createBeanView(document);
  view.renderData(data());
  view.renderRoute('/bags');
  assert.equal(Boolean(document.root.querySelector('[data-route="/bags"]')), false);
  assert.equal(Boolean(document.root.querySelector('form[data-form="bags"]')), false);
  assert.equal(Boolean(document.root.querySelector('[data-action="show-bag-form"]')), false);
  assert.equal(Boolean(document.root.querySelector('[data-action="delete-bag"]')), false);
  view.renderRoute('/records/new');
  assert.equal(document.root.querySelector('form[data-form="records"]').elements.bagId, undefined);
});

test('recipe creation opens from plus, preserves drafts, and closes on cancel', async () => {
  const document = new TestDocument();
  const view = createBeanView(document);
  const dirty = [];
  view.bind({ setDirty: (...args) => dirty.push(args) });
  view.renderData(data());
  const tab = document.root.querySelector('.tabs').querySelectorAll('[data-route]')
    .find(item => item.dataset.route === '/recipes');
  assert.ok(tab);
  assert.equal(tab.getAttribute('aria-label'), '레시피');
  const click = async target => {
    for (const listener of document.root.firstElementChild.listeners.get('click')) await listener({ target });
  };
  await click(tab);
  let form = document.root.querySelector('form[data-form="recipes"]');
  assert.equal(document.root.querySelector('dialog[data-entry-dialog=\"recipes\"]').open, false);
  const add = document.root.querySelector('[data-action="show-recipe-form"]');
  assert.equal(add.getAttribute('aria-label'), '새 레시피 추가');
  assert.equal(add.getAttribute('aria-controls'), document.root.querySelector('dialog[data-entry-dialog=\"recipes\"]').id);
  assert.equal(add.getAttribute('aria-expanded'), 'false');
  assert.ok(document.root.querySelector('.recipe-card'));
  await click(add);
  assert.equal(document.root.querySelector('dialog[data-entry-dialog=\"recipes\"]').open, true);
  assert.equal(add.getAttribute('aria-expanded'), 'true');
  assert.equal(dirty.length, 0);
  assert.equal(form.elements.extractionGuide.tagName, 'textarea');
  form.elements.extractionGuide.value = '교반 없음 · 목표 2분 30초';
  form.elements.name.value = '보존할 레시피';
  form.querySelector('[name="stepName"]').value = '뜸 보존';
  view.renderData(data());
  view.renderRoute('/beans');
  view.renderRoute('/recipes');
  form = document.root.querySelector('form[data-form="recipes"]');
  assert.equal(document.root.querySelector('dialog[data-entry-dialog="recipes"]').open, true);
  assert.equal(form.elements.extractionGuide.value, '교반 없음 · 목표 2분 30초');
  assert.equal(form.elements.name.value, '보존할 레시피');
  assert.equal(form.querySelector('[name="stepName"]').value, '뜸 보존');
  await click(form.querySelector('[data-action="cancel-form"]'));
  form = document.root.querySelector('form[data-form="recipes"]');
  assert.equal(document.root.querySelector('dialog[data-entry-dialog=\"recipes\"]').open, false);
  assert.equal(form.elements.name.value, '');
  assert.deepEqual(dirty, [[false, 'recipes']]);
  view.renderRoute('/recipes/new');
  assert.equal(document.root.querySelector('dialog[data-entry-dialog="recipes"]').open, true);
  view.setState({ pending: true });
  assert.equal(document.root.querySelector('[data-action="show-recipe-form"]').disabled, true);
  view.setState({ pending: false });
  view.clearDraft('recipes');
  assert.equal(document.root.querySelector('dialog[data-entry-dialog="recipes"]').open, false);
  view.renderData({ ...data(), recipes: [] });
  assert.equal(document.root.querySelector('.empty-state').textContent, '등록된 레시피가 없습니다.');
  view.renderRoute(`/recipes/${RECIPE}`);
  assert.equal(document.root.querySelector('[data-action="show-recipe-form"]'), null);
});

test('recipe validation state remains visible in list and detail views', () => {
  const document = new TestDocument();
  const view = createBeanView(document);
  const current = data();
  for (const [status, selector, message] of [
    ['checking', '.muted-note', '레시피 단계를 확인 중입니다.'],
    ['error', '.record-warning', '레시피 단계 확인에 실패했습니다.'],
  ]) {
    current.recipes[0].validationStatus = status;
    view.renderData(current);
    view.renderRoute('/recipes');
    assert.equal(document.root.querySelector('.recipe-summary-card').querySelector(selector).textContent, message);
    view.renderRoute(`/recipes/${RECIPE}`);
    assert.equal(document.root.querySelector('.recipe-card').querySelector(selector).textContent, message);
  }
});

test('recipe summaries separate the primary values, ratio, step count, and guide preview', () => {
  const document = new TestDocument();
  const view = createBeanView(document);
  const current = data();
  current.recipes[0].extractionGuide = '<img src=x> 천천히 붓기';
  view.renderData(current);
  view.renderRoute('/recipes');

  const card = document.root.querySelector('.recipe-summary-card');
  assert.deepEqual(card.querySelectorAll('.recipe-metric').map(metric => [
    metric.dataset.metric, metric.querySelector('dt').textContent, metric.querySelector('dd').textContent,
  ]), [
    ['dose', '원두량', '15g'], ['water', '물 양', '250g'],
    ['temperature', '물 온도', '93℃'], ['ratio', '추출 비율', '1 : 16.7'],
  ]);
  assert.equal(card.querySelector('.recipe-dripper').textContent, '드리퍼V60');
  assert.equal(card.querySelector('.recipe-step-count').textContent, '2단계');
  assert.equal(card.querySelector('.recipe-guide-preview').textContent, '<img src=x> 천천히 붓기');
  assert.equal(card.querySelector('img'), null, 'guide preview remains text, not markup');
});

test('recipe screens show zero and missing values distinctly and omit an invalid ratio', () => {
  const document = new TestDocument();
  const view = createBeanView(document);
  const current = data();
  Object.assign(current.recipes[0], { dripper: '', dose: 0, totalWater: null, temperature: 0,
    grind: '', grinder: '', grinderSetting: '', microns: '', steps: [], extractionGuide: '' });
  view.renderData(current);
  view.renderRoute('/recipes');
  const summary = document.root.querySelector('.recipe-summary-card');
  const summaryMetrics = Object.fromEntries(summary.querySelectorAll('.recipe-metric').map(metric => [
    metric.dataset.metric, metric.querySelector('dd').textContent,
  ]));
  assert.deepEqual(summaryMetrics, { dose: '0g', water: '—', temperature: '0℃' });
  assert.equal(summary.querySelector('.recipe-dripper').textContent, '드리퍼미기록');
  assert.equal(summary.querySelector('.recipe-step-count').textContent, '0단계');
  assert.equal(summary.querySelector('.recipe-guide-preview'), null);

  view.renderRoute(`/recipes/${RECIPE}`);
  const detail = document.root.querySelector('.recipe-card');
  const detailMetrics = Object.fromEntries(detail.querySelectorAll('.recipe-metric').map(metric => [
    metric.dataset.metric, metric.querySelector('dd').textContent,
  ]));
  assert.deepEqual(detailMetrics, summaryMetrics);
  assert.equal(detail.querySelector('.recipe-conditions'), null, 'empty optional conditions are omitted');
});

test('recipe detail groups conditions, pour steps, guide, and records in reading order', () => {
  const document = new TestDocument();
  const view = createBeanView(document);
  view.renderData(data());
  view.renderRoute(`/recipes/${RECIPE}`);

  const detail = document.root.querySelector('.recipe-card');
  const sections = detail.querySelectorAll('.recipe-detail-section');
  assert.deepEqual(sections.map(section => section.querySelector('h4')?.textContent),
    ['추출 조건', '붓기 단계', '추출 가이드', '추출 기록']);
  assert.ok(detail.querySelector('.recipe-steps-section').querySelector('.steps-table'));
  assert.ok(detail.querySelector('.recipe-records').querySelector('.record-summary-header'));
  assert.equal(detail.querySelector('.recipe-card-actions').querySelectorAll('button').length, 2);
});

test('recipe detail places the guide below the pour table and copy preserves its text', async () => {
  const document = new TestDocument();
  const view = createBeanView(document);
  view.bind({ setDirty() {} });
  view.renderData(data());
  view.renderRoute(`/recipes/${RECIPE}`);

  const detail = document.root.querySelector('.recipe-card');
  const guide = detail.querySelector('.recipe-extraction-guide');
  assert.ok(guide);
  assert.match(guide.textContent, /교반 없음/);
  assert.match(guide.textContent, /목표 추출 완료 시간: 2분 30초/);
  const steps = detail.querySelector('.recipe-steps-section');
  const records = detail.querySelector('.recipe-records');
  assert.ok(steps.querySelector('.steps-table'));
  assert.ok(detail.children.indexOf(steps) < detail.children.indexOf(guide));
  assert.ok(detail.children.indexOf(guide) < detail.children.indexOf(records));

  const click = async target => {
    for (const listener of document.root.firstElementChild.listeners.get('click')) await listener({ target });
  };
  await click(detail.querySelector('[data-action="copy-recipe"]'));
  const copyForm = document.root.querySelector('form[data-form="recipes"]');
  assert.equal(copyForm.elements.extractionGuide.value, data().recipes[0].extractionGuide);
});

test('record creation opens from plus, preserves drafts, and closes on cancel or save', async () => {
  const document = new TestDocument();
  const view = createBeanView(document);
  const dirty = [];
  view.bind({ setDirty: (...args) => dirty.push(args) });
  view.renderData(data());
  const click = async target => {
    for (const listener of document.root.firstElementChild.listeners.get('click')) await listener({ target });
  };
  const tab = document.root.querySelector('.tabs').querySelectorAll('[data-route]')
    .find(item => item.getAttribute('aria-label') === '추출 기록');
  assert.equal(tab.dataset.route, '/records');
  await click(tab);
  let form = document.root.querySelector('form[data-form="records"]');
  assert.equal(document.root.querySelector('dialog[data-entry-dialog=\"records\"]').open, false);
  const add = document.root.querySelector('[data-action="show-record-form"]');
  assert.equal(add.getAttribute('aria-label'), '새 추출 기록 추가');
  assert.equal(add.querySelector('[aria-hidden="true"]').textContent, '+');
  assert.equal(add.getAttribute('aria-controls'), document.root.querySelector('dialog[data-entry-dialog=\"records\"]').id);
  assert.equal(add.getAttribute('aria-expanded'), 'false');
  await click(add);
  assert.equal(document.root.querySelector('dialog[data-entry-dialog=\"records\"]').open, true);
  assert.equal(add.getAttribute('aria-expanded'), 'true');
  assert.equal(dirty.length, 0);
  form.elements.cupNote.value = '보존할 컵노트';
  view.renderData(data());
  view.renderRoute('/beans');
  view.renderRoute('/records');
  form = document.root.querySelector('form[data-form="records"]');
  assert.equal(document.root.querySelector('dialog[data-entry-dialog=\"records\"]').open, true);
  assert.equal(form.elements.cupNote.value, '보존할 컵노트');
  await click(form.querySelector('[data-action="cancel-form"]'));
  form = document.root.querySelector('form[data-form="records"]');
  assert.equal(document.root.querySelector('dialog[data-entry-dialog=\"records\"]').open, false);
  assert.equal(form.elements.cupNote.value, '');
  assert.deepEqual(dirty, [[false, 'records']]);
  view.renderRoute('/records/new');
  assert.equal(document.root.querySelector('dialog[data-entry-dialog="records"]').open, true);
  view.setState({ pending: true });
  assert.equal(document.root.querySelector('[data-action="show-record-form"]').disabled, true);
  view.setState({ pending: false });
  view.clearDraft('records');
  assert.equal(document.root.querySelector('dialog[data-entry-dialog="records"]').open, false);
  assert.equal(document.root.querySelector('[data-action="show-record-form"]').getAttribute('aria-expanded'), 'false');
  view.renderRoute(`/recipes/${RECIPE}`);
  await click(document.root.querySelector('[data-action="new-record"]'));
  form = document.root.querySelector('form[data-form="records"]');
  assert.equal(document.root.querySelector('dialog[data-entry-dialog=\"records\"]').open, true);
  assert.equal(form.elements.recipeId.value, RECIPE);
  assert.match(form.querySelectorAll('[data-action="open-search-picker"]')[1].textContent, /V60/);
});

test('background data updates defer pane replacement while an entry dialog is open', () => {
  const document = new TestDocument();
  const view = createBeanView(document);
  view.renderRoute('/records');
  view.renderData(data());
  view.showRecordForm();
  const form = document.root.querySelector('form[data-form="records"]');
  const cupNote = form.elements.cupNote;
  const assertFormPreserved = label => {
    const current = document.root.querySelector('form[data-form="records"]');
    assert.ok(current === form, `${label} must not replace the open form`);
    assert.ok(current?.elements.cupNote === cupNote, `${label} must not replace the form controls`);
  };
  try {
    const parentUpdate = structuredClone(data());
    parentUpdate.records[0].beanNameStatus = 'live';
    parentUpdate.beans[0].name = 'Live bean';
    view.renderData(parentUpdate);
    assertFormPreserved('parent-name hydration');

    const countUpdate = { ...parentUpdate, beans: parentUpdate.beans.map(bean => ({ ...bean,
      recordCount: { status: 'ready', count: 2 } })) };
    view.renderData(countUpdate);
    assertFormPreserved('deferred counts');

    const stageUpdate = { ...countUpdate, recipes: countUpdate.recipes.map(recipe => ({ ...recipe,
      validationStatus: 'ready' })) };
    view.renderData(stageUpdate);
    assertFormPreserved('deferred recipe validation');

    view.setSearchOptions('filters', 'beans', { items: [{ id: BEAN, name: 'Loaded bean' }],
      nextCursor: null, hasMore: false }, false, 'Ethiopia');
    assertFormPreserved('picker results');
    const beanFilter = document.root.querySelector('[data-record-filter="beanId"]');
    assert.equal(beanFilter.options.some(option => option.textContent === 'Loaded bean'), true);
    const beanSearch = document.root.querySelectorAll('[data-option-search-kind]')
      .find(input => input.dataset.optionSearchKind === 'beans' && input.dataset.optionTarget === 'filters');
    assert.equal(beanSearch.value, 'Ethiopia');

    view.renderRoute('/records/new');
    const routedForm = document.root.querySelector('form[data-form="records"]');
    assert.notEqual(routedForm.elements.cupNote, cupNote, 'an intentional route transition renders the new route');
    const routeUpdate = structuredClone(stageUpdate);
    routeUpdate.records[0].cupNote = 'updated route data';
    view.renderData(routeUpdate);
    assert.match(document.root.querySelector('.record-card').textContent, /updated route data/,
      'the first data result after a route transition is rendered');
  } finally {
    view.clearDraft('records');
  }
});

test('collection headers omit refresh and retain their add buttons', () => {
  const document = new TestDocument();
  const view = createBeanView(document);
  view.renderData(data());
  for (const [section, kind] of [['beans', 'bean'], ['recipes', 'recipe'], ['records', 'record']]) {
    view.renderRoute(`/${section}`);
    assert.ok(document.root.querySelector('[data-action="refresh"]') === null, `${section}: refresh button must be absent`);
    assert.ok(document.root.querySelector(`[data-action="show-${kind}-form"]`), section);
    view.setState({ pending: true });
    assert.equal(document.root.querySelector(`[data-action="show-${kind}-form"]`).disabled, true, section);
    view.setState({ pending: false });
  }
});

function pullHarness() {
  const document = new TestDocument();
  document.documentElement = new TestElement('html', document);
  document.documentElement.append(document.root);
  document.scrollingElement = { scrollTop: 0 };
  let reloads = 0;
  let reads = 0;
  const frames = [];
  const timers = [];
  const state = { pending: false, frozen: false, dirty: false };
  document.defaultView = { location: { reload() { reloads++; } },
    requestAnimationFrame(callback) { frames.push(callback); },
    setTimeout(callback, delay) { timers.push({ callback, delay }); } };
  const view = createBeanView(document);
  view.renderData(data());
  view.bind({ getState: () => state, refresh: async () => { reads++; } });
  const fire = (type, x = 20, y = 100, options = {}) => {
    const touch = { identifier: 1, clientX: x, clientY: y };
    const event = { target: document.root, cancelable: true, defaultPrevented: false,
      touches: type === 'touchend' || type === 'touchcancel' ? [] : [touch],
      changedTouches: [touch], preventDefault() { this.defaultPrevented = true; }, ...options };
    for (const listener of document.documentElement.listeners.get(type) ?? []) listener(event);
    return event;
  };
  const paint = () => frames.splice(0).forEach(callback => callback());
  const finishReload = () => { paint(); timers.splice(0).forEach(timer => timer.callback()); };
  const pull = () => { fire('touchstart'); fire('touchmove', 20, 350); fire('touchend', 20, 350); finishReload(); };
  return { document, view, state, fire, pull, get reloads() { return reloads; }, get reads() { return reads; },
    paint, finishReload, timers,
    indicator: () => document.root.querySelector('.pull-refresh') };
}

test('pulling from the top reloads the entire page once on release', () => {
  const env = pullHarness();
  env.state.dirty = true;
  env.fire('touchstart');
  assert.equal(env.fire('touchmove', 20, 140).defaultPrevented, true);
  assert.equal(env.indicator().hidden, false);
  assert.match(env.indicator().textContent, /아래로 당겨/);
  env.fire('touchmove', 20, 350);
  assert.match(env.indicator().textContent, /놓으면/);
  assert.equal(env.reloads, 0);
  env.fire('touchend', 20, 350);
  assert.equal(env.reloads, 0, 'the spinning state must paint before navigation');
  assert.equal(env.indicator().dataset.state, 'reloading');
  env.paint();
  assert.equal(env.reloads, 0);
  assert.equal(env.timers[0].delay, 240);
  env.finishReload();
  assert.equal(env.reloads, 1);
  assert.equal(env.reads, 0);
  assert.match(env.indicator().textContent, /새로고침 중/);
  env.pull();
  assert.equal(env.reloads, 1);
});

test('pulling progressively reveals a twelve-spoke spinner and moves the page down', () => {
  const env = pullHarness();
  const indicator = env.indicator();
  const spinner = indicator.querySelector('.pull-refresh-spinner');
  assert.ok(spinner);
  assert.equal(spinner.getAttribute('aria-hidden'), 'true');
  assert.equal(spinner.children.length, 12);
  env.fire('touchstart');
  env.fire('touchmove', 20, 120);
  assert.equal(indicator.dataset.state, 'pulling');
  const earlyOffset = Number.parseFloat(env.document.root.firstElementChild.style['--pull-offset']);
  const earlyOpacity = Number(spinner.children[6].style.opacity);
  env.fire('touchmove', 20, 350);
  assert.equal(indicator.dataset.state, 'armed');
  assert.ok(Number.parseFloat(env.document.root.firstElementChild.style['--pull-offset']) > earlyOffset);
  assert.ok(Number(spinner.children[6].style.opacity) > earlyOpacity);
  assert.match(indicator.querySelector('.pull-refresh-label').textContent, /놓으면/);
  env.fire('touchmove', 20, 125);
  assert.equal(indicator.dataset.state, 'pulling');
  env.fire('touchcancel');
  assert.equal(indicator.hidden, true);
  assert.equal(env.document.root.firstElementChild.style['--pull-offset'], '0px');
});

test('work starting while the released spinner paints cancels the scheduled reload', () => {
  for (const field of ['pending', 'frozen']) {
    const env = pullHarness();
    env.fire('touchstart');
    env.fire('touchmove', 20, 350);
    env.fire('touchend', 20, 350);
    env.state[field] = true;
    env.finishReload();
    assert.equal(env.reloads, 0, field);
    assert.equal(env.indicator().hidden, true);
    assert.equal(env.document.root.firstElementChild.style['--pull-offset'], '0px');
    env.state[field] = false;
    env.pull();
    assert.equal(env.reloads, 1);
  }
});

test('short pulls, retracted pulls and cancelled gestures do not reload', () => {
  for (const ending of ['short', 'retracted', 'cancelled']) {
    const env = pullHarness();
    env.fire('touchstart');
    env.fire('touchmove', 20, ending === 'short' ? 140 : 350);
    if (ending === 'retracted') env.fire('touchmove', 20, 140);
    env.fire(ending === 'cancelled' ? 'touchcancel' : 'touchend', 20, 140);
    assert.equal(env.reloads, 0, ending);
    assert.equal(env.indicator().hidden, true, ending);
    env.pull();
    assert.equal(env.reloads, 1);
  }
});

test('normal scrolling and horizontal or upward swipes do not trigger reload', () => {
  for (const scenario of ['scrolled', 'horizontal', 'upward', 'scroll-during-pull', 'uncancelable']) {
    const env = pullHarness();
    if (scenario === 'scrolled') env.document.scrollingElement.scrollTop = 50;
    env.fire('touchstart');
    if (scenario === 'scroll-during-pull') env.document.scrollingElement.scrollTop = 50;
    const event = env.fire('touchmove', scenario === 'horizontal' ? 400 : 20,
      scenario === 'upward' ? 60 : 350, { cancelable: scenario !== 'uncancelable' });
    env.fire('touchend', 20, 350);
    assert.equal(event.defaultPrevented, false, scenario);
    assert.equal(env.reloads, 0, scenario);
  }
});

test('multitouch never reloads and a later single finger gesture can refresh', () => {
  const env = pullHarness();
  env.fire('touchstart');
  env.fire('touchmove', 20, 350);
  env.fire('touchstart', 20, 350, { touches: [{ identifier: 1 }, { identifier: 2 }] });
  env.fire('touchend', 20, 350);
  assert.equal(env.reloads, 0);
  assert.equal(env.indicator().hidden, true);
  env.pull();
  assert.equal(env.reloads, 1);
});

test('downward pulls from controls and their child elements reload the whole page', () => {
  for (const kind of ['input', 'textarea', 'select', 'button', 'a', 'summary', 'editable', 'button-child', 'table', 'scroll']) {
    const env = pullHarness();
    const target = env.document.createElement(['table', 'scroll', 'editable'].includes(kind) ? 'div' : kind === 'button-child' ? 'button' : kind);
    if (kind === 'editable') target.setAttribute('contenteditable', 'true');
    if (kind === 'table') target.className = 'table-scroll';
    if (['scroll', 'textarea'].includes(kind)) { target.scrollHeight = 300; target.clientHeight = 100; target.scrollTop = 0; }
    env.document.root.append(target);
    let origin = target;
    if (kind === 'button-child') { origin = env.document.createElement('span'); target.append(origin); }
    const options = { target: origin };
    assert.equal(env.fire('touchstart', 20, 100, options).defaultPrevented, false, kind);
    assert.equal(env.fire('touchmove', 20, 350, options).defaultPrevented, true, kind);
    assert.equal(env.fire('touchend', 20, 350, options).defaultPrevented, true, kind);
    env.finishReload();
    assert.equal(env.reloads, 1, kind);
  }
});

test('control taps keep their normal action and short drags suppress accidental taps', async () => {
  const env = pullHarness();
  const target = env.document.root.querySelector('[data-action="show-bean-form"]');
  assert.equal(env.fire('touchstart', 20, 100, { target }).defaultPrevented, false);
  assert.equal(env.fire('touchmove', 20, 105, { target }).defaultPrevented, false);
  assert.equal(env.fire('touchend', 20, 105, { target }).defaultPrevented, false);
  for (const listener of env.document.root.firstElementChild.listeners.get('click')) await listener({ target });
  assert.equal(env.document.root.querySelector('form[data-form="beans"]').hidden, false);
  assert.equal(env.reads, 0);
  assert.equal(env.reloads, 0);
  env.fire('touchstart', 20, 100, { target });
  env.fire('touchmove', 20, 140, { target });
  assert.equal(env.fire('touchend', 20, 140, { target }).defaultPrevented, true);
  env.finishReload();
  assert.equal(env.reloads, 0);
});

test('horizontal gestures and scrollable controls away from their top keep native scrolling', () => {
  for (const kind of ['table', 'input', 'textarea', 'scroll', 'scrolled-parent']) {
    const env = pullHarness();
    const target = env.document.createElement(['table', 'scroll', 'scrolled-parent'].includes(kind) ? 'div' : kind);
    if (kind === 'table') target.className = 'table-scroll';
    const horizontal = ['table', 'input'].includes(kind);
    if (!horizontal) { target.scrollHeight = 300; target.clientHeight = 100; target.scrollTop = 50; }
    env.document.root.append(target);
    let origin = target;
    if (kind === 'scrolled-parent') { origin = env.document.createElement('button'); target.append(origin); }
    const options = { target: origin };
    env.fire('touchstart', 20, 100, options);
    const event = env.fire('touchmove', horizontal ? 400 : 20, 350, options);
    env.fire('touchend', horizontal ? 400 : 20, 350, options);
    env.finishReload();
    assert.equal(event.defaultPrevented, false, kind);
    assert.equal(env.reloads, 0, kind);
  }
});

test('saving and update freeze prevent a reload even when they begin during a pull', () => {
  for (const field of ['pending', 'frozen']) {
    for (const duringPull of [false, true]) {
      const env = pullHarness();
      env.state[field] = !duringPull;
      env.fire('touchstart');
      env.fire('touchmove', 20, 350);
      env.state[field] = true;
      env.fire('touchend', 20, 350);
      assert.equal(env.reloads, 0, field);
      env.state[field] = false;
      env.pull();
      assert.equal(env.reloads, 1, field);
    }
  }
});


test('refresh requires a 240px downward pull and checks the release position', () => {
  for (const distance of [80, 90, 239, 240, 241]) {
    const env = pullHarness();
    env.fire('touchstart');
    env.fire('touchmove', 20, 100 + distance);
    assert.equal(env.indicator().dataset.state, distance >= 240 ? 'armed' : 'pulling', String(distance));
    env.fire('touchend', 20, 100 + distance);
    env.finishReload();
    assert.equal(env.reloads, distance >= 240 ? 1 : 0, String(distance));
  }
  const env = pullHarness();
  env.fire('touchstart');
  env.fire('touchmove', 20, 350);
  env.fire('touchend', 20, 339);
  env.finishReload();
  assert.equal(env.reloads, 0, 'retracting below 240px at release must cancel');
});


test('navigation uses text-only menus with accessible names', () => {
  const document = new TestDocument();
  createBeanView(document);
  const items = document.root.querySelector('nav.tabs').querySelectorAll('button');
  const expected = [['home', '홈'], ['beans', '원두'], ['recipes', '레시피'], ['records', '추출 기록']];
  assert.equal(items.length, expected.length);
  items.forEach((item, index) => {
    const [key, title] = expected[index];
    assert.equal(item.dataset.route, `/${key}`);
    assert.equal(item.dataset.action, 'navigate');
    assert.equal(item.type, 'button');
    assert.equal(item.getAttribute('aria-label'), title);
    assert.equal(item.title, title);
    assert.equal(item.textContent, title, 'menu labels remain visible');
    assert.equal(item.querySelector('svg'), null, 'navigation contains text only');
  });
});

test('bean deletion opens a safe native dialog and restores focus after cancel or Escape', async () => {
  const document = new TestDocument(), view = createBeanView(document);
  view.showConnection({ connected: true });
  view.renderData(data());
  const calls = [];
  view.bind({ getState: () => ({ pending: false, frozen: false, unresolved: false }), submit: async (...args) => calls.push(args) });
  const trash = document.root.querySelector('[data-action="delete-bean"]');
  assert.ok(trash);
  assert.equal(trash.type, 'button');
  assert.equal(trash.getAttribute('aria-label'), '원두 <안전> 삭제');
  assert.ok(trash.querySelector('svg'));
  assert.equal(trash.dataset.id, BEAN);
  const dialog = document.root.querySelector('.delete-confirm-dialog');
  assert.ok(dialog);

  await clickViewTarget(document, trash);

  assert.equal(dialog.open, true);
  assert.equal(dialog.getAttribute('role'), 'dialog');
  assert.equal(dialog.getAttribute('aria-modal'), 'true');
  assert.equal(dialog.querySelector('h2').textContent, '원두를 삭제할까요?');
  assert.equal(dialog.querySelector('.delete-confirm-target').textContent, '원두 <안전>');
  assert.equal(dialog.querySelector('.delete-confirm-target').children.length, 0, 'the name is rendered as text');
  assert.match(dialog.querySelector('.delete-confirm-description').textContent, /연결된 추출 기록이 있으면 삭제할 수 없습니다/);
  assert.equal(document.activeElement, dialog.querySelector('[data-action="cancel-delete"]'));
  assert.equal(calls.length, 0, 'opening the dialog does not send a delete request');

  await clickViewTarget(document, dialog.querySelector('[data-action="cancel-delete"]'));
  assert.equal(dialog.open, false);
  assert.equal(document.activeElement, trash);
  assert.equal(document.root.querySelector('.app-status').textContent, '삭제를 취소했습니다.');

  await clickViewTarget(document, trash);
  let prevented = false;
  for (const listener of dialog.listeners.get('cancel') ?? []) listener({ preventDefault() { prevented = true; } });
  assert.equal(prevented, true, 'Escape is handled by the dialog cancel event');
  assert.equal(dialog.open, false);
  assert.equal(document.activeElement, trash);
  assert.equal(document.root.querySelector('.app-status').textContent, '삭제를 취소했습니다.');
  assert.equal(calls.length, 0);

  for (const state of [{ pending: true }, { frozen: true }, { unresolved: true }]) {
    view.setState(state);
    assert.equal(trash.disabled, true);
  }
});

test('dismissing a deletion result preserves its notice for button and Escape', async t => {
  const results = [
    { status: 'unknown', toastType: 'unknown', message: '삭제 여부 확인이 필요합니다. Notion 원본을 확인해 주세요.' },
    { status: 'partial', toastType: 'partial', message: '일부 삭제 결과를 확인해야 합니다. Notion 원본을 확인해 주세요.' },
    { status: 'succeeded', toastType: 'deleted-read-error', message: '삭제는 성공했지만 최신 목록을 불러오지 못했습니다. 목록을 새로고침해 주세요.' },
  ];

  for (const result of results) {
    for (const dismissal of ['button', 'Escape']) {
      await t.test(`${result.status} result dismissed with ${dismissal}`, async () => {
        const scheduled = [];
        const document = new TestDocument();
        const view = createBeanView(document, { schedule: callback => scheduled.push(callback) });
        view.renderData(data());
        view.bind({ getState: () => ({ pending: false, frozen: false, unresolved: false }),
          submit: async () => {
            view.showStatus({ type: result.toastType, message: result.message });
            return { status: result.status, message: result.message };
          } });
        const trash = document.root.querySelector('[data-action="delete-bean"]');
        const dialog = document.root.querySelector('.delete-confirm-dialog');
        await clickViewTarget(document, trash);
        await clickViewTarget(document, dialog.querySelector('[data-action="confirm-delete"]'));
        assert.equal(dialog.open, true);
        assert.equal(document.root.querySelector('.app-status').textContent, result.message);

        if (dismissal === 'button') {
          await clickViewTarget(document, dialog.querySelector('[data-action="cancel-delete"]'));
        } else {
          for (const listener of dialog.listeners.get('cancel') ?? []) listener({ preventDefault() {} });
        }

        assert.equal(dialog.open, false);
        assert.equal(document.root.querySelector('.app-status').textContent, result.message);
        assert.notEqual(result.message, '삭제를 취소했습니다.');
        assert.equal(scheduled.length, result.status === 'succeeded' ? 1 : 0);
      });
    }
  }
});

test('bean, recipe, and record deletes submit only after the custom dialog is confirmed', async () => {
  const document = new TestDocument(), view = createBeanView(document);
  view.showConnection({ connected: true });
  view.renderData(data());
  const calls = [];
  view.bind({ getState: () => ({ pending: false, frozen: false, unresolved: false }),
    submit: async (...args) => { calls.push(args); return { status: 'succeeded' }; } });
  assert.equal(Boolean(document.root.querySelector('[data-action="delete-bag"]')), false);
  const cases = [
    ['/beans', 'delete-bean', '원두 <안전>', BEAN, '원두를 삭제할까요?'],
    ['/recipes', 'delete-recipe', 'V60', RECIPE, '레시피를 삭제할까요?'],
    ['/records', 'delete-record', '2026-06-15 · V60', '66666666-6666-4666-8666-666666666666', '추출 기록을 삭제할까요?'],
  ];
  for (const [route, action, name, id, heading] of cases) {
    view.renderRoute(route);
    const trash = document.root.querySelector(`[data-action="${action}"]`);
    assert.ok(trash, `${action} control exists`);
    assert.equal(trash.type, 'button');
    assert.equal(trash.getAttribute('aria-label'), `${name} 삭제`);
    assert.ok(trash.querySelector('svg'));
    assert.equal(trash.dataset.name, name);
    assert.match(trash.parentElement.className, /entity-card-header/);

    const dialog = document.root.querySelector('.delete-confirm-dialog');
    await clickViewTarget(document, trash.querySelector('svg'));
    assert.equal(dialog.open, true);
    assert.equal(dialog.querySelector('h2').textContent, heading);
    assert.equal(dialog.querySelector('.delete-confirm-target').textContent, name);
    assert.equal(calls.length, cases.indexOf(cases.find(item => item[0] === route)));
    await clickViewTarget(document, dialog.querySelector('[data-action="confirm-delete"]'));
    assert.deepEqual(calls.at(-1), [action, { id }]);
    assert.equal(dialog.querySelector('[data-action="confirm-delete"]').querySelector('.button-label').textContent, '삭제 완료');
    assert.equal(dialog.querySelector('[data-action="confirm-delete"]').querySelector('.button-icon').dataset.icon, 'check');
    assert.match(dialog.querySelector('.delete-confirm-feedback').textContent, /삭제/);
    await clickViewTarget(document, dialog.querySelector('[data-action="cancel-delete"]'));
    assert.equal(dialog.open, false);
  }
  assert.deepEqual(calls, cases.map(([, action, , id]) => [action, { id }]));
});

test('bean delete button spinner replaces its progress toast, locks duplicates, and renders failures', async () => {
  const document = new TestDocument(), view = createBeanView(document);
  view.renderData(data());
  let release;
  const pending = new Promise(resolve => { release = resolve; });
  const calls = [];
  view.bind({ getState: () => ({ pending: false, frozen: false, unresolved: false }),
    submit: (...args) => {
      calls.push(args);
      view.setState({ pending: true, frozen: false, unresolved: false });
      view.showStatus({ type: 'saving', message: '삭제 중입니다.' });
      return pending;
    } });
  const trash = document.root.querySelector('[data-action="delete-bean"]');
  const dialog = document.root.querySelector('.delete-confirm-dialog');
  await clickViewTarget(document, trash);

  const confirming = clickViewTarget(document, dialog.querySelector('[data-action="confirm-delete"]'));
  assert.equal(dialog.getAttribute('aria-busy'), 'true');
  assert.equal(dialog.querySelector('[data-action="confirm-delete"]').getAttribute('aria-busy'), 'true');
  assert.equal(dialog.querySelector('[data-action="confirm-delete"]').disabled, true);
  assert.equal(dialog.querySelector('[data-action="cancel-delete"]').disabled, true);
  const status = document.root.querySelector('.app-status');
  assert.equal(status.hidden, true, 'the bean delete button carries the only progress feedback');
  assert.equal(dialog.querySelector('[data-action="confirm-delete"]').querySelector('.button-icon').dataset.state, 'saving');
  await clickViewTarget(document, dialog.querySelector('[data-action="confirm-delete"]'));
  assert.equal(calls.length, 1, 'a second click cannot dispatch another deletion');

  view.showStatus({ type: 'validation-error', message: '이 레시피를 사용하는 기록이 있습니다.' });
  view.showDeleteResult({ status: 'failed', message: '이 레시피를 사용하는 기록이 있습니다.' });
  assert.equal(status.hidden, false, 'the final error notification stays visible');
  assert.equal(status.textContent, '이 레시피를 사용하는 기록이 있습니다.');
  view.setState({ pending: false, frozen: false, unresolved: false });
  release({ status: 'failed', code: 'delete-in-use' });
  await confirming;
  assert.equal(dialog.getAttribute('aria-busy'), 'false');
  assert.equal(dialog.querySelector('[data-action="confirm-delete"]').disabled, false);
  assert.equal(dialog.querySelector('[data-action="cancel-delete"]').disabled, false);
  assert.equal(dialog.querySelector('.delete-confirm-feedback').textContent, '이 레시피를 사용하는 기록이 있습니다.');
});

test('recipe and record delete spinners replace only their progress toast', async () => {
  for (const [route, action] of [['/recipes', 'delete-recipe'], ['/records', 'delete-record']]) {
    const document = new TestDocument(), view = createBeanView(document);
    view.showConnection({ connected: true });
    view.renderData(data());
    view.renderRoute(route);
    let release;
    const pending = new Promise(resolve => { release = resolve; });
    view.bind({ getState: () => ({ pending: false, frozen: false, unresolved: false }),
      submit: () => {
        view.setState({ pending: true, frozen: false, unresolved: false });
        view.showStatus({ type: 'saving', message: '삭제 중입니다.' });
        return pending;
      } });
    await clickViewTarget(document, document.root.querySelector(`[data-action="${action}"]`));
    const dialog = document.root.querySelector('.delete-confirm-dialog');
    const confirming = clickViewTarget(document, dialog.querySelector('[data-action="confirm-delete"]'));
    const status = document.root.querySelector('.app-status');
    assert.equal(status.hidden, true, `${action} button carries the progress feedback`);
    assert.equal(dialog.querySelector('[data-action="confirm-delete"]').querySelector('.button-icon').dataset.state, 'saving');
    view.showStatus({ type: 'failed', message: '삭제하지 못했습니다.' });
    view.showDeleteResult({ status: 'failed', message: '삭제하지 못했습니다.' });
    assert.equal(status.hidden, false, `${action} final failure remains visible`);
    assert.equal(status.textContent, '삭제하지 못했습니다.');
    assert.equal(status.parentElement, dialog);
    release({ status: 'failed', message: '삭제하지 못했습니다.' });
    await confirming;
    view.setState({ pending: false, frozen: false, unresolved: false });
  }
});


test('bean cards pair each metadata value with its own visible label', () => {
  const document = new TestDocument();
  const view = createBeanView(document);
  view.renderData(data());
  const card = document.root.querySelector('.bean-card');
  assert.deepEqual(card.querySelectorAll('dt').map(node => node.textContent),
    ['로스터리', '산지·농장', '품종', '프로세싱', '향미 노트']);
  assert.deepEqual(card.querySelectorAll('dd').map(node => node.textContent),
    ['로스터리', '시다마 · 테스트 농장', '74110', '워시드', '복숭아']);
});

test('bean cards keep missing metadata explicit and render values as text', () => {
  const document = new TestDocument();
  const view = createBeanView(document);
  const rows = data();
  rows.beans = [{ id: BEAN, name: '최소 원두', roaster: '<img src=x onerror=alert(1)>' }];
  view.renderData(rows);
  const card = document.root.querySelector('.bean-card');
  assert.deepEqual(card.querySelectorAll('dd').map(node => node.textContent),
    ['<img src=x onerror=alert(1)>', '기록 없음', '기록 없음', '기록 없음', '기록 없음']);
  assert.equal(card.querySelector('img'), null);
});


test('header navigation changes routes and remains locked while work is pending', async () => {
  const document = new TestDocument();
  const header = document.createElement('header');
  header.className = 'site-header';
  const querySelector = document.querySelector.bind(document);
  document.querySelector = selector => selector === '.site-header' ? header : querySelector(selector);
  const view = createBeanView(document);
  const nav = header.querySelector('nav.tabs');
  assert.ok(nav, 'primary navigation belongs in the site header');
  assert.equal(document.root.querySelector('nav.tabs'), null);
  assert.deepEqual(nav.children.map(item => item.textContent), ['홈', '원두', '레시피', '추출 기록']);
  view.bind({});
  view.renderData(data());
  view.showConnection({ connected: true });
  const recipes = nav.children.find(item => item.dataset.route === '/recipes');
  for (const listener of nav.listeners.get('click') ?? []) await listener({ target: recipes });
  assert.ok(document.root.querySelector('form[data-form="recipes"]'));
  view.setState({ pending: true });
  assert.ok(nav.children.every(item => item.disabled));
  view.setState({ pending: false });
  assert.ok(nav.children.every(item => !item.disabled));
  view.setFrozen(true);
  assert.ok(nav.children.every(item => item.disabled));
  view.showConnection({ connected: false });
  assert.equal(nav.hidden, true);
});

test('bean entry opens and closes as a native modal without saving on cancel', async () => {
  const document = new TestDocument();
  let writes = 0;
  const dirty = [];
  const view = createBeanView(document);
  view.bind({ setDirty: (...args) => dirty.push(args), submit: async () => { writes += 1; return { status: 'succeeded' }; } });
  view.renderData(data());
  view.renderRoute('/beans');
  const page = document.root.firstElementChild;
  await page.listeners.get('click')[0]({ target: document.root.querySelector('[data-action="show-bean-form"]') });
  const dialog = document.root.querySelector('dialog[data-entry-dialog="beans"]');
  assert.equal(dialog.open, true);
  assert.equal(dialog.getAttribute('aria-modal'), 'true');
  const form = dialog.querySelector('form[data-form="beans"]');
  assert.equal(document.activeElement, form.elements.name, 'opening moves focus into the modal');
  let prevented = false;
  for (const listener of dialog.listeners.get('cancel')) listener({ preventDefault() { prevented = true; } });
  assert.equal(prevented, true);
  assert.equal(document.root.querySelector('dialog[data-entry-dialog="beans"]').open, false);
  assert.equal(document.activeElement, document.root.querySelector('[data-action="show-bean-form"]'), 'closing restores focus to the launcher');
  assert.deepEqual(dirty, [[false, 'beans']]);
  assert.equal(writes, 0);
});

test('available entry forms open as native dialogs and cancel without submitting', async () => {
  const cases = [
    ['/beans', 'show-bean-form', 'beans'],
    ['/recipes', 'show-recipe-form', 'recipes'],
    ['/records', 'show-record-form', 'records'],
  ];
  let writes = 0;
  for (const [route, action, kind] of cases) {
    const document = new TestDocument();
    const view = createBeanView(document);
    view.bind({ setDirty() {}, submit: async () => { writes += 1; return { status: 'succeeded' }; } });
    view.renderData(data());
    view.renderRoute(route);
    const click = async target => {
      for (const listener of document.root.firstElementChild.listeners.get('click')) await listener({ target });
    };

    const add = document.root.querySelector(`[data-action="${action}"]`);
    const before = document.root.querySelector(`dialog[data-entry-dialog="${kind}"]`);
    assert.ok(before, `${kind} has a dialog wrapper`);
    assert.equal(before.open, false);
    await click(add);

    const dialog = document.root.querySelector(`dialog[data-entry-dialog="${kind}"]`);
    const form = dialog.querySelector(`form[data-form="${kind}"]`);
    assert.equal(dialog.open, true, `${kind} opens modally`);
    assert.equal(dialog.getAttribute('aria-modal'), 'true');
    assert.equal(dialog.getAttribute('aria-labelledby'), form.querySelector('h2').id);
    assert.equal(form.querySelector('[data-action="cancel-form"]').textContent, '취소');
    assert.equal(form.querySelectorAll('button').find(control => control.type === 'submit').textContent, '저장');
    await click(form.querySelector('[data-action="cancel-form"]'));
    assert.equal(document.root.querySelector(`dialog[data-entry-dialog="${kind}"]`).open, false);
    assert.equal(writes, 0, 'cancelling an entry never submits it');
  }
});

test('save and cancel actions use the compact save and close icons across product forms', () => {
  const document = new TestDocument();
  const view = createBeanView(document);
  view.renderData(data());
  view.renderRoute('/beans');
  view.showBeanForm();

  const form = document.root.querySelector('form[data-form="beans"]');
  const save = form.querySelector('[data-entry-submit]');
  const cancel = form.querySelector('[data-action="cancel-form"]');
  const assertAction = (control, label, icon) => {
    assert.equal(control.textContent, label);
    assert.ok(control.className.includes(`action-${icon === 'x' ? 'cancel' : 'save'}`));
    const iconElement = control.querySelector('.button-icon');
    assert.equal(iconElement.getAttribute('aria-hidden'), 'true');
    assert.equal(iconElement.dataset.icon, icon);
    assert.ok(iconElement.querySelector('svg'));
  };

  assertAction(save, '저장', 'save');
  assertAction(cancel, '취소', 'x');

  view.showConnection({ connected: false });
  const connection = document.root.querySelector('form[data-form="connection"]');
  assertAction(connection.querySelectorAll('button').find(control => control.type === 'submit'), '연결 확인 및 저장', 'save');
  assertAction(connection.querySelector('[data-action="cancel-connection"]'), '취소', 'x');

  view.showUnresolved([{ kind: 'beans', status: 'unknown', knownPageCount: 0, resolve() {} }]);
  assertAction(document.root.querySelector('.resolution-form').querySelectorAll('button').find(control => control.type === 'submit'),
    '확인 결과 저장', 'save');
});

test('save buttons show loading and success only when their async operation changes state', () => {
  const document = new TestDocument();
  const view = createBeanView(document);
  view.bind({ setDirty() {} });
  view.renderData(data());
  view.renderRoute('/beans');
  view.showBeanForm();

  const dialog = document.root.querySelector('dialog[data-entry-dialog="beans"]');
  const save = dialog.querySelector('[data-entry-submit]');
  view.setState({ pending: true });
  assert.equal(save.textContent, '저장 중…');
  assert.equal(save.dataset.state, 'saving');
  assert.equal(save.getAttribute('aria-busy'), 'true');
  assert.equal(save.querySelector('.button-icon').dataset.state, 'saving');

  view.setState({ pending: false });
  assert.equal(view.showEntrySuccess('beans'), true);
  assert.equal(save.textContent, '저장 완료');
  assert.equal(save.dataset.state, 'success');
  assert.equal(save.querySelector('.button-icon').dataset.icon, 'check');
  assert.equal(save.getAttribute('aria-busy'), 'false');

  view.showConnection({ connected: false });
  const connectionSave = document.querySelector('form[data-form="connection"]')
    .querySelectorAll('button').find(control => control.type === 'submit');
  assert.equal(view.beginConnectionSave(), true);
  assert.equal(connectionSave.dataset.state, 'saving');
  assert.equal(connectionSave.getAttribute('aria-busy'), 'true');
  view.finishConnectionSave();
  assert.equal(connectionSave.dataset.state, 'idle');
  assert.equal(connectionSave.querySelector('.button-icon').dataset.icon, 'save');
});

test('inline entry and delete success stay in their dialogs without completion toasts after close', async () => {
  const scheduled = [];
  const document = new TestDocument();
  const view = createAppView(document, {
    schedule: (callback, delay) => { scheduled.push({ callback, delay }); return scheduled.length; },
    cancelSchedule() {},
  });
  view.renderData(data());
  view.renderRoute('/beans');
  view.bind({ getState: () => ({ pending: false, frozen: false, unresolved: false }),
    submit: async () => ({ status: 'succeeded', message: '삭제했습니다.' }) });
  const status = document.root.querySelector('.app-status');

  view.showBeanForm();
  const entryDialog = document.root.querySelector('dialog[data-entry-dialog="beans"]');
  assert.equal(view.showEntrySuccess('beans'), true);
  assert.equal(entryDialog.querySelector('[data-entry-submit]').querySelector('.button-label').textContent, '저장 완료');
  assert.equal(status.hidden, true, 'entry success uses the button completion state without a toast');
  scheduled.find(item => item.delay === 1000).callback();
  assert.equal(entryDialog.open, false, 'the entry success dialog closes after its normal delay');
  assert.equal(status.hidden, true, 'closing the entry dialog does not restore a completion toast');

  for (const dismissal of ['automatic', 'manual']) {
    const trash = document.root.querySelector('[data-action="delete-bean"]');
    await clickViewTarget(document, trash);
    const dialog = document.root.querySelector('.delete-confirm-dialog');
    await clickViewTarget(document, dialog.querySelector('[data-action="confirm-delete"]'));
    assert.equal(dialog.querySelector('[data-action="confirm-delete"]').querySelector('.button-label').textContent, '삭제 완료');
    assert.equal(dialog.querySelector('.delete-confirm-feedback').textContent, '삭제했습니다.');
    assert.equal(status.hidden, true, 'delete success stays in the confirmation dialog');
    if (dismissal === 'automatic') {
      scheduled.filter(item => item.delay === 900).at(-1).callback();
    } else {
      await clickViewTarget(document, dialog.querySelector('[data-action="cancel-delete"]'));
    }
    assert.equal(dialog.open, false, `${dismissal} dismissal closes the confirmation dialog`);
    assert.equal(status.hidden, true, `${dismissal} dismissal does not restore a completion toast`);
  }
});

test('entry save spinners replace only saving toasts across beans, recipes, records, and recipe copies', async () => {
  for (const [kind, open] of [
    ['beans', 'showBeanForm'], ['recipes', 'showRecipeForm'], ['records', 'showRecordForm'],
  ]) {
    const document = new TestDocument();
    const view = createAppView(document, { schedule: () => 1 });
    view.bind({ setDirty() {} });
    view.renderData(data());
    view.renderRoute('/' + kind);
    view[open]();
    const dialog = document.root.querySelector(`dialog[data-entry-dialog="${kind}"]`);
    const save = dialog.querySelector('[data-entry-submit]');

    view.setState({ pending: true });
    view.showStatus({ type: 'saving', message: '저장 중입니다.' });
    const status = document.root.querySelector('.app-status');
    assert.equal(save.dataset.state, 'saving', `${kind} submit button shows its spinner`);
    assert.equal(save.getAttribute('aria-busy'), 'true');
    assert.equal(status.hidden, true, `${kind} spinner replaces the duplicate progress toast`);

    assert.equal(view.showEntrySuccess(kind), true);
    view.showStatus({ type: 'saved', message: '저장했습니다.' });
    assert.equal(status.hidden, false, `${kind} success notification replaces the hidden progress toast`);
    view.setState({ pending: false });
    assert.equal(status.hidden, false, `${kind} success notification stays visible after pending clears`);
    assert.equal(status.textContent, '저장했습니다.');
    for (const [type, message] of [
      ['failed', '저장하지 못했습니다.'],
      ['validation-error', '입력값을 확인해 주세요.'],
      ['unknown', '저장 여부 확인이 필요합니다.'],
      ['partial', '일부 저장 결과를 확인해야 합니다.'],
      ['saved-read-error', '저장은 성공했지만 최신 목록을 불러오지 못했습니다.'],
    ]) {
      view.showStatus({ type, message });
      assert.equal(status.hidden, false, `${kind} final ${type} notification remains visible`);
      assert.equal(status.textContent, message);
      assert.equal(status.parentElement, dialog);
    }
  }

  const document = new TestDocument(), view = createBeanView(document);
  view.bind({ setDirty() {} });
  view.renderData(data());
  view.renderRoute(`/recipes/${RECIPE}`);
  await clickViewTarget(document, document.root.querySelector('[data-action="copy-recipe"]'));
  const copyForm = document.root.querySelector('form[data-form="recipes"]');
  const copyDialog = copyForm.closest('dialog');
  assert.ok(copyDialog?.open, 'copy opens the recipe form dialog');
  assert.equal(copyForm.dataset.copyId, RECIPE, 'copy submits through the recipe form');
  view.setState({ pending: true });
  view.showStatus({ type: 'saving', message: '저장 중입니다.' });
  assert.equal(copyDialog.querySelector('[data-entry-submit]').dataset.state, 'saving');
  assert.equal(document.root.querySelector('.app-status').hidden, true,
    'recipe copy uses the recipe save spinner and hides the duplicate progress toast');
});

test('saving progress remains visible when no matching modal spinner is active', () => {
  const document = new TestDocument(), view = createBeanView(document);
  view.renderData(data());
  view.setState({ pending: true });
  view.showStatus({ type: 'saving', message: '저장 중입니다.' });
  const status = document.root.querySelector('.app-status');
  assert.equal(status.hidden, false, 'without an open entry or delete dialog, the toast is the only progress feedback');
  assert.equal(status.textContent, '저장 중입니다.');
});

test('confirmation-result save disables duplicate submits and reflects its resolved result', async () => {
  let finishResolution;
  let resolutions = 0;
  const document = new TestDocument();
  const view = createBeanView(document);
  view.showUnresolved([{ kind: 'beans', status: 'unknown', knownPageCount: 0, resolve: async () => {
    resolutions++;
    await new Promise(resolve => { finishResolution = resolve; });
    return true;
  } }]);
  const form = document.root.querySelector('.resolution-form');
  const save = form.querySelectorAll('button').find(control => control.type === 'submit');
  const submit = () => Promise.all(form.listeners.get('submit').map(listener => listener({
    target: form,
    preventDefault() {},
  })));

  const firstSubmit = submit();
  await Promise.resolve();
  assert.equal(save.disabled, true);
  assert.equal(save.dataset.state, 'saving');
  await submit();
  assert.equal(resolutions, 1, 'a pending confirmation cannot be submitted twice');
  finishResolution();
  await firstSubmit;
  assert.equal(save.dataset.state, 'success');
  assert.equal(save.querySelector('.button-icon').dataset.icon, 'check');
});

test('pending entry saves lock controls and Escape; success stays visible until the 1000ms close', async () => {
  const scheduled = [];
  const document = new TestDocument();
  const view = createAppView(document, { schedule: (callback, delay) => scheduled.push({ callback, delay }) });
  let duplicateSubmissions = 0;
  view.bind({ setDirty() {}, getState: () => ({ pending: true }), submit: async () => { duplicateSubmissions += 1; return { status: 'succeeded' }; } });
  view.renderData(data());
  view.renderRoute('/beans');
  const click = async target => {
    for (const listener of document.root.firstElementChild.listeners.get('click')) await listener({ target });
  };
  await click(document.root.querySelector('[data-action="show-bean-form"]'));
  const dialog = document.root.querySelector('dialog[data-entry-dialog="beans"]');
  const form = dialog.querySelector('form[data-form="beans"]');

  view.setState({ pending: true });
  assert.equal(form.querySelectorAll('button').find(control => control.type === 'submit').disabled, true);
  assert.equal(form.querySelector('[data-action="cancel-form"]').disabled, true);
  assert.equal(dialog.querySelector('[data-action="cancel-form"]').disabled, true);
  let prevented = false;
  for (const listener of dialog.listeners.get('cancel')) listener({ preventDefault() { prevented = true; } });
  assert.equal(prevented, true);
  assert.equal(dialog.open, true);
  const pendingSubmit = { target: form, preventDefault() {} };
  await Promise.all(document.root.querySelector('.data-panel').listeners.get('submit').map(listener => listener(pendingSubmit)));
  assert.equal(duplicateSubmissions, 0, 'a second submit cannot reach storage while pending');

  view.setState({ pending: false });
  assert.equal(view.showEntrySuccess('beans'), true);
  assert.equal(dialog.dataset.saveState, 'success');
  assert.equal(dialog.querySelector('[data-save-status]'), null, 'save and success text use the shared toast');
  view.showStatus({ type: 'saved', message: '저장했습니다.' });
  assert.equal(document.root.querySelector('.app-status').textContent, '저장했습니다.');
  assert.equal(document.root.querySelector('.app-status').parentElement, dialog);
  assert.equal(dialog.open, true);
  assert.equal(scheduled.length, 1);
  assert.equal(scheduled[0].delay, 1000);
  scheduled[0].callback();
  assert.equal(dialog.open, false);
  assert.equal(document.root.querySelector('.app-status').parentElement, document.root.firstElementChild,
    'the toast returns to the app layer when its modal closes');
  assert.equal(document.activeElement, document.root.querySelector('[data-action="show-bean-form"]'));
});

test('a failed modal save preserves its fields and enables a retry', async () => {
  const originalFormData = globalThis.FormData;
  class TestFormData {
    constructor(form) {
      this.fields = form.querySelectorAll('input[name],textarea[name],select[name]')
        .filter(field => field.type !== 'radio' || field.checked)
        .map(field => [field.name, field.value]);
    }
    [Symbol.iterator]() { return this.fields[Symbol.iterator](); }
  }
  globalThis.FormData = TestFormData;
  try {
    const scheduled = [];
    const document = new TestDocument();
    const view = createAppView(document, { schedule: (callback, delay) => scheduled.push({ callback, delay }) });
    let attempts = 0;
    let finishFailure;
    view.bind({
      setDirty() {},
      setState: state => view.setState(state),
      submit: async () => {
        attempts += 1;
        view.setState({ pending: true });
        if (attempts === 1) {
          await new Promise(resolve => { finishFailure = resolve; });
          view.setState({ pending: false });
          view.showStatus({ type: 'failed', message: '저장하지 못했습니다. 입력값을 보존했습니다.' });
          return { status: 'failed' };
        }
        view.setState({ pending: false });
        view.showEntrySuccess('beans');
        return { status: 'succeeded' };
      },
    });
    view.renderData(data());
    view.renderRoute('/beans');
    const click = async target => {
      for (const listener of document.root.firstElementChild.listeners.get('click')) await listener({ target });
    };
    await click(document.root.querySelector('[data-action="show-bean-form"]'));
    const dialog = document.root.querySelector('dialog[data-entry-dialog="beans"]');
    const form = dialog.querySelector('form[data-form="beans"]');
    form.elements.name.value = '입력 보존 원두';
    const submit = async () => {
      const event = { target: form, preventDefault() {} };
      return Promise.all(document.root.querySelector('.data-panel').listeners.get('submit').map(listener => listener(event)));
    };

    const firstAttempt = submit();
    await Promise.resolve();
    assert.equal(form.querySelectorAll('button').find(control => control.type === 'submit').disabled, true);
    finishFailure();
    await firstAttempt;
    assert.equal(form.elements.name.value, '입력 보존 원두');
    assert.equal(form.querySelector('.field-error'), null);
    assert.equal(document.root.querySelector('.app-status').textContent, '저장하지 못했습니다. 입력값을 보존했습니다.');
    assert.equal(document.root.querySelector('.app-status').parentElement, dialog);
    assert.equal(document.root.querySelector('.app-status').getAttribute('popover'), null);
    assert.equal(form.querySelectorAll('button').find(control => control.type === 'submit').disabled, false);
    assert.equal(dialog.open, true);

    await submit();
    assert.equal(attempts, 2);
    assert.equal(dialog.dataset.saveState, 'success');
    scheduled[0].callback();
  } finally {
    if (originalFormData === undefined) delete globalThis.FormData;
    else globalThis.FormData = originalFormData;
  }
});

test('success delay locks every entry field and recipe step after refresh finishes', async () => {
  for (const [kind, open] of [
    ['beans', 'showBeanForm'], ['recipes', 'showRecipeForm'], ['records', 'showRecordForm'],
  ]) {
    const document = new TestDocument();
    const view = createAppView(document, { schedule: () => 1 });
    view.bind({ setDirty() {} });
    view.renderData(data());
    view.renderRoute('/' + kind);
    view[open]();
    view.setState({ pending: true });
    view.showEntrySuccess(kind);
    view.renderData(data());
    view.setState({ pending: false });
    const form = document.root.querySelector('form[data-form="' + kind + '"]');
    for (const control of form.querySelectorAll('input,button,select,textarea')) {
      assert.equal(control.disabled, true, kind + ' success delay must lock ' + (control.name || control.dataset.action || control.tagName));
    }
    if (kind === 'recipes') {
      const steps = form.querySelectorAll('.step-row').length;
      const add = form.querySelector('[data-action="add-step"]');
      for (const listener of document.root.firstElementChild.listeners.get('click')) await listener({ target: add });
      assert.equal(form.querySelectorAll('.step-row').length, steps);
    }
  }
});

test('success delay ignores late input events and closes without a dirty draft', () => {
  const document = new TestDocument();
  const callbacks = [];
  let dirty = false;
  const view = createAppView(document, { schedule: callback => { callbacks.push(callback); return 1; } });
  view.renderRoute('/beans');
  view.bind({ setDirty: value => { dirty = value; } });
  view.renderData(data());
  view.showBeanForm();
  view.showEntrySuccess('beans');
  view.setState({ pending: false });
  const field = document.root.querySelector('form[data-form="beans"]').elements.name;
  for (const listener of document.root.querySelector('.data-panel').listeners.get('input')) listener({ target: field });
  callbacks[0]();
  assert.equal(dirty, false);
  assert.equal(document.root.querySelector('dialog[data-entry-dialog="beans"]').open, false);
});

test('reduced motion overrides modal entrance and the pull-to-refresh spinner', () => {
  const css = readFileSync(new URL('../pwa/styles.css', import.meta.url), 'utf8');
  const reduceAt = css.lastIndexOf('@media (prefers-reduced-motion: reduce)');
  for (const rule of [
    '.entry-dialog[open] { animation: entry-dialog-in',
    '.pull-refresh[data-state="reloading"] .pull-refresh-spinner { animation: pull-refresh-spin',
  ]) assert.ok(reduceAt > css.indexOf(rule), 'reduced motion must win the cascade for ' + rule);
  const reduced = css.slice(reduceAt);
  assert.match(reduced, /\.entry-dialog\[open\].*animation: none/s);
  assert.match(reduced, /\.pull-refresh\[data-state="reloading"\] \.pull-refresh-spinner[\s\S]*?animation: none;/);
});


test('first route data keeps an open recipe modal node and focus while updating its list', async () => {
  const document = new TestDocument();
  const view = createAppView(document);
  let resolveRecipes;
  let markStarted;
  let markReady;
  const started = new Promise(resolve => { markStarted = resolve; });
  const ready = new Promise(resolve => { markReady = resolve; });
  const context = {
    async inspect() { return { initialized: false, blocked: false }; },
    async readJournal() { return { operations: [], connectionGuard: null }; },
    async beginConnectionChange() {}, async commitConnectionChange() {},
  };
  const app = createAppController({ view,
    state: { withWriteLock: action => action(context) }, file: {},
    makeClient: () => ({ async verify() {} }),
    makeRepository: () => ({
      async listBeans() { return { items: data().beans, complete: true, hasMore: false }; },
      listRecipeSummaries() {
        markStarted();
        return new Promise(resolve => { resolveRecipes = resolve; });
      },
    }),
    makeCommands: () => ({}), uuid: () => 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  });
  app.bind();
  await app.connect({ token: 'fake-only', dataSources: { beans: BEAN, recipes: RECIPE, steps: BEAN, records: RECIPE } });
  const setRouteReadState = view.setRouteReadState;
  view.setRouteReadState = status => {
    setRouteReadState(status);
    if (status === 'ready') markReady();
  };
  view.renderRoute('/recipes/new');
  await started;
  const panel = document.root.querySelector('.data-panel');
  const dialog = panel.querySelector('dialog[data-entry-dialog="recipes"]');
  const form = panel.querySelector('form[data-form="recipes"]');
  const name = form.elements.name;
  name.value = 'critic draft';
  name.focus();
  resolveRecipes({ items: [{ ...data().recipes[0], name: 'Fresh recipe' }], complete: true, hasMore: false });
  await ready;

  assert.equal(panel.querySelector('dialog[data-entry-dialog="recipes"]') === dialog, true, 'dialog DOM survives first response');
  assert.equal(panel.querySelector('form[data-form="recipes"]') === form, true, 'form DOM survives first response');
  assert.equal(document.activeElement === name, true, 'input keeps focus');
  assert.equal(name.value, 'critic draft');
  assert.match(panel.querySelector('.recipe-card').textContent, /Fresh recipe/);
  assert.equal(panel.querySelector('.recipe-card').hidden, false);
  view.clearDraft('recipes');
  assert.match(panel.querySelector('.recipe-card').textContent, /Fresh recipe/);
});

test('route loading-ready restores only list siblings hidden for the open modal', () => {
  const document = new TestDocument();
  const view = createAppView(document);
  view.renderData(data());
  view.renderRoute('/recipes/new');

  const panel = document.root.querySelector('.data-panel');
  const dialog = panel.querySelector('dialog[data-entry-dialog="recipes"]');
  const siblings = () => [...panel.querySelector('.list-view').children].filter(child => child !== dialog);
  assert.equal(dialog.open, true);
  assert.ok(siblings().every(child => !child.hidden));

  const intentionallyHidden = document.createElement('p');
  intentionallyHidden.hidden = true;
  panel.querySelector('.list-view').append(intentionallyHidden);
  view.setRouteReadState('loading');
  view.setRouteReadState('loading');
  assert.ok(siblings().every(child => child.hidden));
  view.setRouteReadState('ready');
  assert.equal(dialog.open, true);
  assert.ok(siblings().filter(child => child !== intentionallyHidden).every(child => !child.hidden));
  assert.equal(intentionallyHidden.hidden, true, 'pre-existing hidden state survives');

  view.clearDraft('recipes');
  const paneAfterClose = panel.querySelector('.list-view');
  assert.ok([...paneAfterClose.children].every(child => !child.hidden), 'closing the modal leaves the list visible');
});

test('initial card load shows decorative skeletons until real data replaces them', () => {
  const document = new TestDocument();
  const view = createBeanView(document);
  view.setState({ pending: true });
  view.showConnection({ connected: false, checkingInitialization: true });
  view.showStatus({ type: 'startup-checking', message: '저장된 연결 확인 중' });
  const skeleton = document.root.querySelector('.card-skeletons');
  assert.ok(skeleton);
  assert.equal(skeleton.hidden, false);
  assert.equal(skeleton.getAttribute('aria-hidden'), 'true');
  assert.equal(skeleton.querySelectorAll('.skeleton-card').length, 3);
  assert.equal(skeleton.querySelectorAll('button,input,a').length, 0);
  view.showConnection({ connected: true });
  assert.equal(skeleton.hidden, false);
  view.renderData(data());
  assert.equal(skeleton.hidden, true);
  assert.ok(document.root.querySelector('.bean-card'));
  view.setState({ pending: false });
  view.setState({ pending: true });
  assert.equal(skeleton.hidden, true, 'refresh retains existing cards');
  assert.ok(document.root.querySelector('.bean-card'));
  view.setState({ pending: false });
});

test('route transition skeleton hides stale data and exposes an error until a fresh page arrives', () => {
  const document = new TestDocument();
  const view = createAppView(document);
  view.renderData(data());
  view.renderRoute('/recipes');

  const panel = document.root.querySelector('.data-panel');
  const skeleton = document.root.querySelector('.card-skeletons');
  const recordsTab = document.root.querySelector('.tabs').children.find(item => item.dataset.route === '/records');
  view.setRouteReadState('loading');
  assert.equal(skeleton.hidden, false);
  assert.equal(panel.hidden, true, 'the previous route cannot expose a false empty state');
  assert.equal(recordsTab.disabled, false, 'route reads do not disable navigation');

  view.setRouteReadState('error');
  assert.equal(skeleton.hidden, true);
  assert.equal(panel.hidden, false);
  assert.match(panel.textContent, /목록을 불러오지 못했습니다/);
  assert.equal(panel.querySelector('.empty-state'), null);
  assert.equal(panel.querySelector('.recipe-card'), null);

  view.setRouteReadState('loading');
  view.renderData(data());
  view.setRouteReadState('ready');
  assert.equal(skeleton.hidden, true);
  assert.equal(panel.hidden, false);
  assert.ok(panel.querySelector('.recipe-card'));
});

test('route loading preserves an open modal, draft DOM, and focus', () => {
  const document = new TestDocument();
  const view = createAppView(document);
  view.renderData(data());
  view.renderRoute('/records/new');
  view.showRecordForm();

  const panel = document.root.querySelector('.data-panel');
  const dialog = panel.querySelector('dialog[data-entry-dialog="records"]');
  const form = panel.querySelector('form[data-form="records"]');
  const note = form.elements.cupNote;
  note.value = 'draft stays in place';
  note.focus();

  view.setRouteReadState('loading');
  assert.equal(panel.hidden, false, 'an open modal remains visible above the skeleton');
  assert.equal(dialog.open, true);
  assert.strictEqual(panel.querySelector('dialog[data-entry-dialog="records"]'), dialog);
  assert.strictEqual(panel.querySelector('form[data-form="records"]'), form);
  assert.equal(note.value, 'draft stays in place');
  assert.strictEqual(document.activeElement, note);

  view.setRouteReadState('cancelled');
  assert.equal(dialog.open, true);
  assert.strictEqual(document.activeElement, note);
  assert.equal(note.value, 'draft stays in place');
});

for (const type of ['disconnected', 'startup-busy', 'connection-error', 'read-error']) {
  test(`card skeleton clears after ${type}`, () => {
    const document = new TestDocument();
    const view = createBeanView(document);
    view.setState({ pending: true });
    view.showStatus({ type: 'startup-checking', message: '연결 확인 중' });
    const skeleton = document.root.querySelector('.card-skeletons');
    assert.equal(skeleton?.hidden, false);
    view.showStatus({ type, message: '확인해 주세요' });
    view.setState({ pending: false });
    assert.equal(skeleton.hidden, true);
  });
}

test('persistent error toast follows the settings modal opened and closed without a new status', () => {
  const document = new TestDocument();
  const view = createBeanView(document);
  view.showConnection({ connected: true });
  const page = document.root.firstElementChild;
  const toggle = document.root.querySelector('.connection-toggle');
  const status = document.root.querySelector('.app-status');
  view.showStatus({ type: 'read-error', message: '조회 오류를 확인해 주세요.' });
  assert.equal(status.parentElement === page, true);
  assert.equal(status.popoverOpen, true);

  const clickSettings = () => toggle.listeners.get('click').forEach(listener => listener());
  clickSettings();
  const dialog = document.root.querySelector('dialog.connection-panel');
  assert.equal(dialog.open, true);
  assert.equal(status.parentElement === dialog, true, 'opening settings moves the existing toast into the modal');
  assert.equal(status.popoverOpen, false);
  assert.equal(status.getAttribute('popover'), null);
  assert.equal(status.textContent, '조회 오류를 확인해 주세요.');

  clickSettings();
  assert.equal(dialog.open, false);
  assert.equal(status.parentElement === page, true, 'closing settings returns the existing toast to the app layer');
  assert.equal(status.popoverOpen, true);
  assert.equal(status.textContent, '조회 오류를 확인해 주세요.');
});

test('connection modal opens from settings and Escape clears secrets, draft and restores focus', async () => {
  const document = new TestDocument();
  const dirty = [];
  const view = createBeanView(document);
  view.bind({ setDirty: (...args) => dirty.push(args) });
  view.showConnection({ connected: true });
  const toggle = document.root.querySelector('.connection-toggle');
  for (const listener of toggle.listeners.get('click')) listener();
  const dialog = document.root.querySelector('dialog.connection-panel');
  assert.ok(dialog, 'settings must be a native modal');
  assert.equal(dialog.open, true);
  assert.equal(dialog.getAttribute('aria-modal'), 'true');
  const form = dialog.querySelector('form[data-form="connection"]');
  assert.equal(document.activeElement, form.elements.token);
  form.elements.token.value = 'test-only-discard';
  form.elements.beans.value = 'discard-source';
  for (const listener of dialog.listeners.get('cancel')) listener({ preventDefault() {} });
  assert.equal(dialog.open, false);
  assert.equal(form.elements.token.value, '');
  assert.equal(form.elements.beans.value, '');
  assert.deepEqual(dirty.at(-1), [false, 'connection']);
  assert.equal(document.activeElement, toggle);
  for (const listener of toggle.listeners.get('click')) listener();
  assert.equal(form.elements.token.value, '');
});

test('connection modal protects pending and success phases across product rerenders', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const document = new TestDocument();
  const scheduled = [];
  const view = createAppView(document, { schedule: (callback, delay) => { scheduled.push({ callback, delay }); return 1; } });
  view.bind({ setDirty() {} });
  view.showConnection({ connected: false });
  const dialog = document.root.querySelector('dialog.connection-panel');
  assert.ok(dialog);
  assert.equal(view.beginConnectionSave(), true);
  view.setState({ pending: true });
  view.showStatus({ type: 'checking', message: 'Notion 연결을 확인하고 있습니다.' });
  const status = document.root.querySelector('.app-status');
  assert.equal(dialog.querySelectorAll('button').find(button => button.type === 'submit').dataset.state, 'saving');
  assert.equal(status.hidden, false, 'connection save keeps its checking toast');
  assert.equal(status.parentElement, dialog);
  assert.equal(view.beginConnectionSave(), false, 'duplicate connection submissions are ignored');
  assert.equal(view.cancelConnection(), false);
  for (const listener of dialog.listeners.get('cancel')) listener({ preventDefault() {} });
  assert.equal(dialog.open, true);
  view.showConnection({ connected: true });
  assert.equal(dialog.open, true, 'installing the verified connection does not close feedback');
  view.showConnectionSuccess();
  view.showStatus({ type: 'connected', message: '연결을 확인하고 저장했습니다.' });
  view.renderData(data());
  view.setState({ pending: false });
  for (const control of dialog.querySelectorAll('input,button,select,textarea')) assert.equal(control.disabled, true);
  assert.equal(dialog.querySelector('[data-connection-status]'), null, 'connection save feedback uses the shared toast');
  assert.equal(status.parentElement, dialog);
  assert.match(status.textContent, /저장/);
  assert.equal(scheduled[0].delay, 1000);
  scheduled[0].callback();
  assert.equal(dialog.open, false);
  assert.equal(status.parentElement, document.root.firstElementChild, 'success toast remains visible after the modal closes');
  assert.equal(status.hidden, false);
  t.mock.timers.tick(3000);
  assert.equal(status.hidden, true, 'the shared success toast keeps its existing auto-hide policy');
});

test('connection success closes at 1000ms and defers focus until settings is enabled', () => {
  const document = new TestDocument();
  const scheduled = [];
  const view = createAppView(document, { schedule: (callback, delay) => { scheduled.push({ callback, delay }); return 1; } });
  view.showConnection({ connected: false });
  const toggle = document.root.querySelector('.connection-toggle');
  let focusCalls = 0;
  toggle.focus = () => {
    focusCalls++;
    if (!toggle.disabled) document.activeElement = toggle;
  };
  view.beginConnectionSave();
  view.setState({ pending: true });
  view.showConnection({ connected: true });
  view.showConnectionSuccess();
  assert.equal(scheduled[0].delay, 1000);
  scheduled[0].callback();
  assert.equal(document.root.querySelector('dialog.connection-panel').open, false);
  assert.equal(toggle.disabled, true);
  assert.notEqual(document.activeElement, toggle, 'native disabled buttons cannot receive focus');
  view.setState({ pending: false, frozen: true });
  assert.notEqual(document.activeElement, toggle, 'focus waits while another lock remains');
  view.setFrozen(false);
  assert.ok(document.activeElement === toggle, 'focus returns when the settings button becomes enabled');
  const restoredCalls = focusCalls;
  view.renderData(data());
  view.setState({ pending: false });
  assert.equal(focusCalls, restoredCalls, 'later renders must not steal focus again');
});

test('connection modal preserves failed inputs for retry and exposes safe errors inside the dialog', async () => {
  const original = globalThis.FormData;
  globalThis.FormData = class {
    constructor(form) { this.form = form; }
    get(name) { return this.form.elements[name].value; }
  };
  try {
    const document = new TestDocument();
    const scheduled = [];
    const view = createAppView(document, { schedule: callback => { scheduled.push(callback); return 1; } });
    let calls = 0;
    view.bind({ setDirty() {}, connect: async () => {
      calls++;
      view.setState({ pending: true });
      if (calls === 1) {
        view.showStatus({ type: 'connection-error', message: '연결을 확인하지 못했습니다.' });
        view.showConnection({ connected: true });
        view.setState({ pending: false });
        throw new Error('private response must not be rendered');
      }
      view.showConnection({ connected: true });
      view.clearSecret();
      view.showConnectionSuccess();
      view.setState({ pending: false });
      return true;
    } });
    view.showConnection({ connected: false });
    const dialog = document.root.querySelector('dialog.connection-panel');
    assert.ok(dialog);
    const form = dialog.querySelector('form[data-form="connection"]');
    form.elements.token.value = 'test-only-retry';
    form.elements.beans.value = 'test-source';
    const submit = () => Promise.all(form.listeners.get('submit').map(listener => listener({ currentTarget: form, preventDefault() {} })));
    await submit();
    assert.equal(dialog.open, true);
    assert.equal(form.elements.token.value, 'test-only-retry');
    assert.equal(form.elements.beans.value, 'test-source');
    const status = document.root.querySelector('.app-status');
    assert.equal(status.parentElement, dialog);
    assert.match(status.textContent, /연결을 확인하지 못/);
    assert.equal(status.getAttribute('role'), 'alert');
    assert.equal(dialog.querySelector('[data-connection-status]'), null, 'errors are reported only in the shared toast');
    assert.equal(dialog.textContent.includes('private response'), false);
    assert.equal(form.elements.token.disabled, false);
    await submit();
    assert.equal(calls, 2);
    assert.equal(form.elements.token.value, '');
    assert.equal(dialog.dataset.saveState, 'success');
    scheduled[0]();
  } finally { globalThis.FormData = original; }
});

test('startup retry and recovery remain reachable after dismissing and reopening connection settings', () => {
  const document = new TestDocument();
  const view = createBeanView(document);
  view.bind({ initialize() {} });
  view.showConnection({ connected: false, retryInitialization: true });
  const dialog = document.root.querySelector('dialog.connection-panel');
  const toggle = document.root.querySelector('.connection-toggle');
  assert.equal(dialog.open, true);
  assert.equal(dialog.querySelector('.connection-details').hidden, true);
  assert.equal(dialog.querySelector('.startup-retry-panel').hidden, false);
  for (const listener of dialog.listeners.get('cancel')) listener({ preventDefault() {} });
  assert.equal(dialog.open, false);
  assert.equal(toggle.disabled, false, 'the safe retry panel must remain reopenable');
  for (const listener of toggle.listeners.get('click')) listener();
  assert.equal(dialog.open, true);
  assert.equal(dialog.querySelector('.connection-details').hidden, true);
  view.showConnection({ connected: false, needsRecovery: true });
  assert.equal(dialog.querySelector('.repair-panel').hidden, false);
  assert.equal(dialog.querySelector('[data-action="confirm-connection"]').disabled, false);
});

test('saved connection retry keeps the form closed and exposes editing only when allowed', async () => {
  const document = new TestDocument();
  const view = createBeanView(document);
  view.bind({ initialize() {} });
  view.showConnection({ connected: false, retryInitialization: true, canEditConnection: true });
  const dialog = document.root.querySelector('dialog.connection-panel');
  const details = dialog.querySelector('.connection-details');
  const retry = dialog.querySelector('.startup-retry-panel');
  const edit = dialog.querySelector('[data-action="edit-connection"]');

  assert.equal(details.hidden, true);
  assert.equal(retry.hidden, false);
  assert.equal(edit.hidden, false);
  for (const listener of document.root.firstElementChild.listeners.get('click')) await listener({ target: edit });
  assert.equal(details.hidden, false);

  view.showConnection({ connected: false, retryInitialization: true, canEditConnection: false });
  assert.equal(details.hidden, true);
  assert.equal(edit.hidden, true);
});

test('bean cards open their records through a full-card native link without a records button', async () => {
  const document = new TestDocument();
  const view = createBeanView(document);
  view.renderData(data());
  view.bind({});
  const card = document.root.querySelector('.bean-card');
  const link = card.querySelector('a');
  assert.ok(link, 'the bean title is a keyboard-accessible native link');
  assert.equal(link.getAttribute('href'), `#/beans/${BEAN}`);
  assert.equal(link.getAttribute('aria-label'), '원두 <안전> 추출 기록 보기');
  assert.equal(card.querySelectorAll('button').length, 1, 'only the delete button remains');
  assert.equal(card.querySelector('button').dataset.action, 'delete-bean');
  assert.ok(card.textContent.includes('추출 기록 1개'));
  const css = readFileSync(new URL('../pwa/styles.css', import.meta.url), 'utf8');
  assert.match(css, /\.bean-card-link::after\s*\{[^}]*inset:\s*0/s);
  for (const listener of document.root.firstElementChild.listeners.get('click')) await listener({ target: link });
  assert.ok(document.root.textContent.includes('이 원두의 추출 기록'));
  assert.ok(document.root.textContent.includes('꿀, 살구'));
});

test('bean card deletion never opens records, including clicks on its icon', async () => {
  const document = new TestDocument();
  const view = createBeanView(document);
  view.renderData(data());
  view.bind({});
  const trash = document.root.querySelector('[data-action="delete-bean"]');
  await clickViewTarget(document, trash.querySelector('svg'));
  assert.ok(document.root.querySelector('.bean-card'));
  assert.equal(document.root.querySelectorAll('h4').some(node => node.textContent === '이 원두의 추출 기록'), false);
  assert.equal(document.root.querySelector('.delete-confirm-dialog').open, true);
});

test('legacy extraction records remain in raw input but are hidden from current lists and details', () => {
  const document = new TestDocument();
  const view = createBeanView(document);
  const rows = data();
  rows.records[0].snapshot.recordGeneration = 'bagless-v1';
  const legacy = structuredClone(rows.records[0]);
  legacy.id = 'legacy-record';
  delete legacy.snapshot.recordGeneration;
  rows.records.push(legacy);
  view.renderData(rows);

  view.renderRoute('/records');
  assert.equal(rows.records.length, 2, 'rendering must not mutate or discard raw records');
  assert.equal(document.root.querySelectorAll('.record-card').length, 1);
  view.renderRoute(`/beans/${BEAN}`);
  assert.equal(document.root.querySelectorAll('.record-card').length, 1);
  view.renderRoute(`/recipes/${RECIPE}`);
  assert.equal(document.root.querySelectorAll('.record-summary-header').length, 1);
});

test('PWA removes bag navigation, entry and record selection or display surfaces', () => {
  const document = new TestDocument();
  const view = createBeanView(document);
  const rows = data();
  rows.records[0].snapshot.recordGeneration = 'bagless-v1';
  view.renderData(rows);

  assert.equal(Boolean(document.root.querySelector('[data-route="/bags"]')), false);
  view.renderRoute('/bags');
  assert.equal(Boolean(document.root.querySelector('form[data-form="bags"]')), false);
  assert.equal(Boolean(document.root.querySelector('[data-action="show-bag-form"]')), false);
  assert.equal(Boolean(document.root.querySelector('[data-action="delete-bag"]')), false);
  assert.doesNotMatch(document.root.querySelector('.data-panel').textContent, /봉지|로스팅 날짜/);

  view.renderRoute('/records/new');
  assert.equal(document.root.querySelector('form[data-form="records"]').elements.bagId, undefined);
  view.renderRoute(`/recipes/${RECIPE}`);
  assert.doesNotMatch(document.root.querySelector('.data-panel').textContent, /원두 봉지|6월 봉지/);
});

test('recipe list cards link their entire surface to details without a details button', async () => {
  const document = new TestDocument();
  const view = createBeanView(document);
  view.renderData(data());
  view.renderRoute('/recipes');
  view.bind({});
  const card = document.root.querySelector('.recipe-card');
  const link = card.querySelector('a');
  assert.ok(link, 'recipe title is a native keyboard-accessible link');
  assert.equal(link.getAttribute('href'), `#/recipes/${RECIPE}`);
  assert.equal(link.getAttribute('aria-label'), 'V60 상세 보기');
  assert.equal(card.querySelectorAll('button').length, 1, 'only delete remains');
  assert.equal(card.querySelector('button').dataset.action, 'delete-recipe');
  assert.deepEqual(Object.fromEntries(card.querySelectorAll('.recipe-metric').map(metric => [
    metric.dataset.metric, metric.querySelector('dd').textContent,
  ])), { dose: '15g', water: '250g', temperature: '93℃', ratio: '1 : 16.7' });
  for (const listener of document.root.firstElementChild.listeners.get('click')) await listener({ target: link });
  assert.ok(document.root.querySelector('[data-action="copy-recipe"]'));
  assert.ok(document.root.textContent.includes('교반 없음'));
  assert.equal(document.root.querySelector('.recipe-card-link'), null, 'detail card has no full-card overlay');
  assert.equal(document.root.querySelector('.recipe-summary-card'), null);
});

test('recipe list card delete icon stays independent of detail navigation', async () => {
  const document = new TestDocument();
  const view = createBeanView(document);
  view.renderData(data());
  view.renderRoute('/recipes');
  const calls = [];
  view.bind({ submit: async (...args) => { calls.push(args); return { status: 'succeeded' }; } });
  const trash = document.root.querySelector('[data-action="delete-recipe"]');
  await clickViewTarget(document, trash.querySelector('svg'));
  assert.equal(document.root.querySelector('[data-action="copy-recipe"]'), null);
  const dialog = document.root.querySelector('.delete-confirm-dialog');
  assert.equal(dialog.open, true);
  await clickViewTarget(document, dialog.querySelector('[data-action="confirm-delete"]'));
  assert.equal(document.root.querySelector('[data-action="copy-recipe"]'), null);
  assert.deepEqual(calls, [['delete-recipe', { id: RECIPE }]]);
});

test('view notifies the controller when the current route changes', () => {
  const document = new TestDocument();
  const view = createBeanView(document);
  const routes = [];
  view.onRouteChange(route => routes.push(route));

  view.renderRoute('/recipes');
  view.renderRoute('/records');

  assert.deepEqual(routes, ['/recipes', '/records']);
});

test('record page shows continuation state instead of claiming the database is empty', () => {
  const document = new TestDocument();
  const view = createBeanView(document);
  view.renderRoute('/records');
  view.renderData({ ...data(), records: [], screen: { complete: false, hasMore: true, nextCursor: 'next' } });

  assert.match(document.root.textContent, /더 확인/);
  assert.doesNotMatch(document.root.textContent, /새 버전에서 작성한 추출 기록이 없습니다/);
  assert.ok(document.root.querySelector('[data-action="load-more"]'));
});

test('records view keeps unfiltered bean insights separate from the filtered table and uses snapshot conditions', () => {
  const document = new TestDocument();
  const view = createBeanView(document);
  const current = data();
  const makeInsightRecord = ({ id, date, rating, beanId = BEAN, beanName = '당시 시다마' }) => ({
    id, beanId, beanResolution: 'relation', recipeId: RECIPE, date, rating, cupNote: `컵노트 ${id}`,
    snapshotStatus: 'valid', snapshot: { version: 2, recordGeneration: 'bagless-v1',
      bean: { id: beanId, name: beanName },
      recipe: { id: RECIPE, name: '기록 당시 V60', dose: 15, totalWater: 240, temperature: 92,
        dripper: 'V60', grinder: '당시 그라인더', grinderSetting: '20클릭', grind: '중간',
        steps: [{ name: '뜸', seconds: 40, interval: 40, water: 40, cumulativeWater: 40 }] } },
  });
  const older = makeInsightRecord({ id: 'insight-older', date: '2026-10-01', rating: 3 });
  const sameDay = makeInsightRecord({ id: 'insight-same-day', date: '2026-10-01', rating: 4 });
  const samePoint = makeInsightRecord({ id: 'insight-same-point', date: '2026-10-01', rating: 4 });
  const later = makeInsightRecord({ id: 'insight-later', date: '2026-10-09', rating: 5 });
  const otherBean = makeInsightRecord({ id: 'insight-other', date: '2026-10-10', rating: 2,
    beanId: '22222222-2222-4222-8222-222222222222', beanName: '다른 원두' });
  const allInsightRecords = [older, sameDay, samePoint, later, otherBean];
  const insights = { ...buildRecordsInsights(allInsightRecords, current.beans, BEAN), status: 'ready', loading: false,
    hasMore: true, nextCursor: 'insight-next' };
  current.recipes[0] = { ...current.recipes[0], name: '현재 레시피', dose: 18, temperature: 99,
    totalWater: 300, grinder: '현재 그라인더', grinderSetting: '40클릭',
    steps: [{ name: '현재 단계', seconds: 70, interval: 70, water: 250, cumulativeWater: 250 }] };
  view.renderData({ ...current, beans: [...current.beans, { id: otherBean.beanId, name: '다른 원두' }],
    records: [otherBean], recordInsights: insights,
    screen: { route: '/records', filters: { recipeId: RECIPE }, complete: true, hasMore: false } });
  view.renderRoute('/records');

  const insightSection = document.root.querySelector('.records-demo-layout');
  assert.ok(insightSection);
  assert.match(insightSection.querySelector('[data-insight-scope]').textContent, /불러온 기록 5건/);
  const points = insightSection.querySelectorAll('circle');
  assert.equal(points.length, 4);
  assert.equal(points[1].getAttribute('cx'), points[2].getAttribute('cx'),
    'same-day ratings occupy the actual same x coordinate');
  assert.equal(points[1].getAttribute('cy'), points[2].getAttribute('cy'),
    'duplicate same-day ratings share one chart coordinate');
  assert.match(insightSection.querySelector('.record-insight-best-record').textContent, /기록 당시 V60/);
  assert.match(insightSection.querySelector('.record-insight-best').textContent, /15g/);
  assert.match(insightSection.querySelector('.record-insight-best').textContent, /92℃/);
  assert.match(insightSection.querySelector('.record-insight-best').textContent, /240g/);
  assert.doesNotMatch(insightSection.querySelector('.record-insight-best-record').textContent, /현재 레시피|99℃|300g|40클릭/);
  assert.ok(insightSection.querySelector('svg[role="img"]'));
  assert.ok(insightSection.querySelector('#record-rating-chart-values'));
  assert.deepEqual(insightSection.querySelector('svg').querySelectorAll('text')
    .map(label => label.textContent).filter(label => label.endsWith('점')),
    ['3점', '4점', '5점'], 'each distinct date/rating point has a visible score label');
  const ratingFiveLabel = insightSection.querySelector('svg').querySelectorAll('text')
    .find(label => label.textContent === '5점');
  assert.ok(Number(ratingFiveLabel.getAttribute('y')) > 10, 'top-axis rating labels stay inside the chart viewBox');
  assert.match(insightSection.textContent, /날짜별 별점 추이/);
  assert.deepEqual(document.root.querySelectorAll('.record-card').map(card => card.textContent.includes('다른 원두')),
    [true], 'only the table respects the active recipe filter');
});

test('records page follows the demo hierarchy and keeps full record management collapsed below comparisons', () => {
  const document = new TestDocument();
  const view = createBeanView(document);
  const older = { ...data().records[0], id: 'demo-align-older', date: '2026-10-01', rating: 3 };
  const newer = { ...data().records[0], id: 'demo-align-newer', date: '2026-10-05', rating: 5 };
  const records = [older, newer];
  const insights = { ...buildRecordsInsights(records, data().beans, BEAN, data().recipes), status: 'ready',
    loading: false, hasMore: true };
  view.renderData({ ...data(), recordInsights: insights, screen: { route: '/records', complete: true, hasMore: true } });
  view.renderRoute('/records');

  const layout = document.root.querySelector('.records-demo-layout');
  assert.ok(layout);
  assert.equal(layout.children[0].tagName, 'aside');
  assert.equal(layout.children[0].className, 'record-insight-sidebar');
  assert.equal(layout.children[1].className, 'record-insights-content');
  assert.deepEqual(layout.children[1].children.map(child => child.className), [
    'record-insight-selected-bean', 'record-insight-trend-section', 'record-insight-best-section record-insight-best',
    'record-insight-comparisons', 'record-management',
  ]);
  const table = layout.querySelector('.record-insight-comparison-table');
  assert.ok(table);
  assert.deepEqual(table.querySelector('tbody').querySelectorAll('tr')
    .map(row => row.dataset.insightRecordId), ['demo-align-newer', 'demo-align-older']);
  assert.deepEqual(table.querySelector('thead').querySelectorAll('th').map(cell => cell.textContent),
    ['추출일', '레시피', '기록 당시 조건 · 분쇄 · 온도 · 도징 · 물', '평가', '컵노트']);
  const management = layout.querySelector('.record-management');
  assert.equal(management.open, false);
  assert.ok(management.querySelector('[data-record-filter="recipeId"]'));
  assert.ok(management.querySelector('[data-action="delete-record"]'));
});

test('legacy record management remains available when bounded insights have not loaded', () => {
  const document = new TestDocument();
  const view = createBeanView(document);
  view.renderData({ ...data(), recordInsights: undefined,
    screen: { route: '/records', complete: true, hasMore: false } });
  view.renderRoute('/records');

  const management = document.root.querySelector('.record-management');
  assert.ok(management);
  assert.equal(management.open, false);
  assert.ok(management.querySelector('[data-record-filter="beanId"]'));
  assert.ok(management.querySelector('[data-record-filter="recipeId"]'));
  assert.ok(management.querySelector('.record-card'));
});

test('insight bean cards expose visible summaries and selected state; empty or unrated trends have explicit text', () => {
  const document = new TestDocument();
  const view = createBeanView(document);
  const row = { ...data().records[0], id: 'unrated-record', rating: null };
  const model = buildRecordsInsights([row]);
  view.renderData({ ...data(), records: [row], recordInsights: { ...model, status: 'ready', loading: false },
    screen: { route: '/records', complete: true, hasMore: false } });
  view.renderRoute('/records');
  const selectedCard = document.root.querySelector('[data-action="select-insight-bean"]');
  assert.equal(selectedCard.tagName, 'button');
  assert.equal(selectedCard.type, 'button');
  assert.equal(selectedCard.getAttribute('aria-pressed'), 'true');
  assert.equal(selectedCard.dataset.beanId, row.beanId);
  assert.match(selectedCard.textContent, /2026-06-15/);
  assert.match(selectedCard.textContent, /V60/);
  assert.match(selectedCard.textContent, /별점 없음/);
  assert.match(document.root.querySelector('.record-insight-chart-empty').textContent, /유효한 별점 기록이 없습니다/);
  assert.match(document.root.querySelector('.record-insight-best').textContent, /최고 평가 기록이 없습니다/);

  const singleDocument = new TestDocument();
  const singleView = createBeanView(singleDocument);
  const singleModel = buildRecordsInsights([data().records[0]]);
  singleView.renderData({ ...data(), recordInsights: { ...singleModel, status: 'ready', loading: false },
    screen: { route: '/records', complete: true, hasMore: false } });
  singleView.renderRoute('/records');
  const singleChart = singleDocument.root.querySelectorAll('svg').find(svg => svg.getAttribute('role') === 'img');
  assert.equal(singleChart.querySelectorAll('circle').length, 1);
  assert.equal(singleChart.querySelector('path'), null,
    'a one-point trend displays a point without inventing a line');

  const emptyDocument = new TestDocument();
  const emptyView = createBeanView(emptyDocument);
  emptyView.renderData({ ...data(), records: [], recordInsights: { ...buildRecordsInsights([]), status: 'ready',
    loading: false }, screen: { route: '/records', complete: true, hasMore: false } });
  emptyView.renderRoute('/records');
  assert.match(emptyDocument.root.querySelector('.records-demo-layout').textContent, /최근 추출 기록이 있는 원두가 없습니다/);
});

test('insight bean cards, comparison filter, and sort controls update the production view through delegated events', async () => {
  const document = new TestDocument();
  const view = createBeanView(document);
  const alternateRecipe = '44444444-4444-4444-8444-444444444444';
  const rows = [
    { ...data().records[0], id: 'comparison-old', date: '2026-10-01', rating: 3 },
    { ...data().records[0], id: 'comparison-high', date: '2026-10-05', rating: 5 },
    { ...data().records[0], id: 'comparison-mid', recipeId: alternateRecipe, date: '2026-10-09', rating: 4,
      snapshot: { ...data().records[0].snapshot, id: alternateRecipe, name: 'Origami' } },
    { ...data().records[0], id: 'comparison-other', beanId: 'other-bean', date: '2026-10-10', rating: 2,
      snapshot: { ...data().records[0].snapshot, beanId: 'other-bean', name: '다른 당시 원두' } },
  ];
  const beanId = rows[0].beanId;
  const insights = { ...buildRecordsInsights(rows, [], beanId), status: 'ready', loading: false, hasMore: true };
  view.renderData({ ...data(), records: rows, recordInsights: insights,
    screen: { route: '/records', complete: true, hasMore: false } });
  view.renderRoute('/records');
  const selected = [];
  let loadMoreCalls = 0;
  view.bind({ setRecordInsightsBean(id) { selected.push(id); }, loadMoreInsights() { loadMoreCalls += 1; } });
  const content = document.root.querySelector('.data-panel');
  const change = target => { for (const listener of content.listeners.get('change') ?? []) listener({ target }); };
  const comparisonIds = () => document.root.querySelector('.record-insight-comparison-table')
    .querySelector('tbody').querySelectorAll('tr').map(row => row.dataset.insightRecordId);

  const beanCard = content.querySelectorAll('[data-action="select-insight-bean"]')
    .find(card => card.dataset.beanId === beanId);
  assert.ok(beanCard, 'a recent bean must be visible as an individually selectable summary card');
  await clickViewTarget(document, beanCard);
  assert.deepEqual(selected, [beanId], 'button activation reaches the controller selection action');
  assert.equal(beanCard.getAttribute('aria-pressed'), 'true');

  const recipe = content.querySelector('[data-insight-recipe-filter]');
  recipe.value = alternateRecipe;
  change(recipe);
  assert.deepEqual(comparisonIds(), ['comparison-mid'], 'recipe filtering changes only selected-bean comparison rows');
  assert.equal(document.root.querySelectorAll('circle').length, 3,
    'the trend remains on the full loaded selected-bean scope');
  assert.equal(document.root.querySelector('.record-insight-best-record').dataset.insightRecordId, 'comparison-high',
    'the best record remains on the full loaded selected-bean scope');
  recipe.value = '';
  change(recipe);

  const sort = content.querySelector('[data-insight-comparison-sort]');
  sort.value = 'date-asc';
  change(sort);
  assert.deepEqual(comparisonIds(), ['comparison-old', 'comparison-high', 'comparison-mid']);
  sort.value = 'rating-desc';
  change(sort);
  assert.deepEqual(comparisonIds(),
    ['comparison-high', 'comparison-mid', 'comparison-old']);

  const rating = content.querySelector('[data-insight-rating-filter]');
  rating.value = '4';
  change(rating);
  assert.deepEqual(comparisonIds(),
    ['comparison-mid']);

  await clickViewTarget(document, content.querySelector('[data-action="load-more-insights"]'));
  assert.equal(loadMoreCalls, 1, 'the separate insight cursor is reachable from the page control');
});

test('changing the selected bean clears a recipe filter that does not belong to the new bean', async () => {
  const document = new TestDocument();
  const view = createBeanView(document);
  const otherBeanId = '77777777-7777-4777-8777-777777777777';
  const otherRecipeId = '88888888-8888-4888-8888-888888888888';
  const original = data();
  const otherRecord = { ...original.records[0], id: 'other-bean-record', beanId: otherBeanId,
    recipeId: otherRecipeId, date: '2026-06-20', rating: 3, cupNote: '코코아',
    snapshot: { ...original.records[0].snapshot, beanId: otherBeanId, id: otherRecipeId, name: 'Kalita' } };
  const rows = [...original.records, otherRecord];
  const beans = [...original.beans, { id: otherBeanId, name: '콜롬비아' }];
  const recipes = [...original.recipes, { id: otherRecipeId, name: 'Kalita', beanId: otherBeanId, dripper: 'Kalita',
    dose: 16, grind: '중간', grinder: '테스트', grinderSetting: '20', temperature: 92, totalWater: 240, steps: [] }];
  let currentData = { ...original, beans, recipes, records: rows,
    recordInsights: { ...buildRecordsInsights(rows, beans, BEAN, recipes), status: 'ready', loading: false },
    screen: { route: '/records', complete: true, hasMore: false } };
  view.renderData(currentData);
  view.renderRoute('/records');
  const selected = [];
  view.bind({ setRecordInsightsBean(beanId) {
    selected.push(beanId);
    currentData = { ...currentData, recordInsights: { ...buildRecordsInsights(rows, beans, beanId, recipes),
      status: 'ready', loading: false } };
    view.renderData(currentData);
  } });

  let content = document.root.querySelector('.data-panel');
  const comparisonIds = () => {
    const table = content.querySelector('.record-insight-comparison-table');
    return table ? table.querySelector('tbody').querySelectorAll('tr').map(row => row.dataset.insightRecordId) : [];
  };
  const filter = content.querySelector('[data-insight-recipe-filter]');
  filter.value = RECIPE;
  for (const listener of content.listeners.get('change') ?? []) listener({ target: filter });
  assert.deepEqual(comparisonIds(), [original.records[0].id]);
  assert.equal(content.querySelectorAll('circle').length, 1);

  await clickViewTarget(document, content.querySelector(`[data-action="select-insight-bean"][data-bean-id="${otherBeanId}"]`));
  content = document.root.querySelector('.data-panel');
  assert.deepEqual(selected, [otherBeanId]);
  assert.equal(content.querySelector('[data-insight-recipe-filter]').value, '',
    'the comparison filter control resets when its recipe is unavailable for the selected bean');
  assert.deepEqual(comparisonIds(), [otherRecord.id],
  'the new bean comparison shows its records instead of a stale empty result');
  const selectedSummary = content.querySelector('.record-insight-selected-bean');
  assert.equal(selectedSummary.querySelector('h3').textContent, '콜롬비아');
  const summaryStats = selectedSummary.querySelector('.record-insight-bean-stats').querySelectorAll('dd');
  assert.equal(summaryStats[0].textContent, '1건');
  assert.equal(summaryStats[1].textContent, '3.0점');
  assert.equal(content.querySelectorAll('circle').length, 1);
  assert.equal(content.querySelector('.record-insight-best-record').dataset.insightRecordId, otherRecord.id);
});

test('removing the last record for the filtered recipe resets comparison controls and rows together', () => {
  const document = new TestDocument();
  const view = createBeanView(document);
  const original = data();
  const alternateRecipeId = '88888888-8888-4888-8888-888888888888';
  const remaining = { ...original.records[0], id: 'remaining-recipe-record', recipeId: alternateRecipeId,
    snapshot: { ...original.records[0].snapshot, id: alternateRecipeId, name: 'Kalita' } };
  const renderRecords = records => view.renderData({ ...original, records,
    recordInsights: { ...buildRecordsInsights(records, original.beans, BEAN, original.recipes),
      status: 'ready', loading: false }, screen: { route: '/records', complete: true, hasMore: false } });
  renderRecords([...original.records, remaining]);
  view.renderRoute('/records');
  view.bind({});
  const content = document.root.querySelector('.data-panel');
  const filter = content.querySelector('[data-insight-recipe-filter]');
  filter.value = RECIPE;
  for (const listener of content.listeners.get('change') ?? []) listener({ target: filter });
  renderRecords([remaining]);
  assert.equal(content.querySelector('[data-insight-recipe-filter]').value, '');
  const table = content.querySelector('.record-insight-comparison-table');
  assert.deepEqual(table?.querySelector('tbody').querySelectorAll('tr').map(row => row.dataset.insightRecordId),
    [remaining.id], 'removing a recipe option must not leave an invisible comparison filter');
});

test('production records insight DOM refreshes after a real controller save and confirmed delete', async () => {
  const originalFormData = globalThis.FormData;
  globalThis.FormData = class {
    constructor(form) {
      this.fields = form.querySelectorAll('input[name],textarea[name],select[name]')
        .filter(field => field.type !== 'radio' || field.checked)
        .map(field => [field.name, field.value]);
    }
    [Symbol.iterator]() { return this.fields[Symbol.iterator](); }
  };
  try {
    const scheduled = [];
    const document = new TestDocument();
    const view = createAppView(document, { schedule: callback => { scheduled.push(callback); return scheduled.length; } });
    view.renderRoute('/records');
    const stateContext = {
      async inspect() { return { initialized: false, blocked: false }; },
      async readJournal() { return { connectionGuard: null, operations: [] }; },
      async beginConnectionChange() {}, async commitConnectionChange() {},
    };
    let records = [...data().records];
    const repository = {
      async listRecords(options = {}) {
        const items = records.filter(record => (!options.beanId || record.beanId === options.beanId) &&
          (!options.recipeId || record.recipeId === options.recipeId));
        return { items, beans: data().beans, recipes: data().recipes, nextCursor: null, hasMore: false, complete: true };
      },
    };
    const controller = createAppController({
      view,
      state: { async withWriteLock(action) { return action(stateContext); } },
      file: { async readConnection() { return null; } },
      makeClient: () => ({ async verify() {} }),
      makeRepository: () => repository,
      makeCommands: () => ({
        async prepareRecord(payload) { return { kind: 'records', payload }; },
        async prepareDeleteRecord(payload) { return { kind: 'delete-record', payload }; },
        async execute(draft) {
          if (draft.kind === 'records') {
            const created = { ...data().records[0], id: 'view-created-record', beanId: draft.payload.beanId,
              recipeId: draft.payload.recipeId, date: draft.payload.date, rating: Number(draft.payload.rating),
              cupNote: draft.payload.cupNote, snapshot: { ...data().records[0].snapshot, recordGeneration: 'bagless-v1' } };
            records = [created, ...records];
            return { status: 'succeeded', value: created };
          }
          records = records.filter(record => record.id !== draft.payload.id);
          return { status: 'succeeded' };
        },
      }),
    });
    controller.bind();
    await controller.connect({ token: 'test-only', dataSources: {} });

    const content = document.root.querySelector('.data-panel');
    assert.match(content.querySelector('.record-insight-scope').textContent, /불러온 기록 1건/);
    await clickViewTarget(document, content.querySelector('[data-action="show-record-form"]'));
    const form = content.querySelector('form[data-form="records"]');
    form.elements.beanId.value = BEAN;
    form.elements.recipeId.value = RECIPE;
    form.elements.date.value = '2026-10-15';
    form.elements.rating.value = '5';
    form.elements.cupNote.value = '브라우저 통합 컵노트';
    const submit = { target: form, preventDefault() {} };
    await Promise.all(content.listeners.get('submit').map(listener => listener(submit)));
    assert.equal(scheduled.length, 2, 'connection and save confirmations stay in their respective dialogs');
    scheduled.at(-1)();
    assert.match(content.querySelector('.record-insight-scope').textContent, /불러온 기록 2건/);
    assert.ok(content.querySelector('[data-insight-record-id="view-created-record"]'));

    const card = content.querySelector('.record-card');
    await clickViewTarget(document, card.querySelector('[data-action="delete-record"]'));
    const confirmation = document.root.querySelector('.delete-confirm-dialog');
    await clickViewTarget(document, confirmation.querySelector('[data-action="confirm-delete"]'));
    assert.equal(records.some(record => record.id === 'view-created-record'), false);
    await clickViewTarget(document, confirmation.querySelector('[data-action="cancel-delete"]'));
    assert.match(content.querySelector('.record-insight-scope').textContent, /불러온 기록 1건/);
    assert.equal(content.querySelector('[data-insight-record-id="view-created-record"]'), null);
  } finally {
    if (originalFormData === undefined) delete globalThis.FormData;
    else globalThis.FormData = originalFormData;
  }
});

test('record cards show snapshot names while current parent names are loading', () => {
  const document = new TestDocument();
  const view = createBeanView(document);
  view.renderRoute('/records');
  const record = { ...data().records[0], beanNameStatus: 'loading', recipeNameStatus: 'loading',
    snapshot: { version: 2, recordGeneration: 'bagless-v1',
      bean: { id: BEAN, name: 'Snapshot bean' }, recipe: { id: RECIPE, name: 'Snapshot recipe' } } };
  view.renderData({ ...data(), beans: [], recipes: [], records: [record], screen: { complete: true, hasMore: false } });
  const card = document.root.querySelector('.record-card');

  assert.match(card.querySelector('h3').textContent, /Snapshot bean/);
  assert.match(card.textContent, /레시피: Snapshot recipe/);
  assert.match(card.textContent, /기록 당시 원두 이름을 표시하며 현재 이름을 확인 중입니다/);
  assert.match(card.textContent, /기록 당시 레시피 이름을 표시하며 현재 이름을 확인 중입니다/);
  assert.doesNotMatch(card.textContent, /원두 확인 필요|확인할 수 없는 레시피/);
});

test('record name pickers load on focus and preserve filter selection across option pages', () => {
  const document = new TestDocument();
  const view = createBeanView(document);
  view.renderRoute('/records');
  view.renderData({ ...data(), records: [], screen: { complete: false, hasMore: true,
    nextCursor: 'records-next', filters: { beanId: BEAN, recipeId: '' } } });
  const content = document.root.querySelector('.data-panel');
  const beanFilter = content.querySelector('[data-record-filter="beanId"]');
  assert.equal(beanFilter.options.length, 1, 'filter options are not fetched with the record page');
  const beanSearch = content.querySelectorAll('[data-option-search-kind]')
    .find(input => input.dataset.optionSearchKind === 'beans' && input.dataset.optionTarget === 'filters');
  assert.ok(beanSearch);
  const requested = [];
  view.bind({ loadSearchOptions(...args) { requested.push(args); }, setDirty() {}, getState() { return {}; } });
  for (const listener of content.listeners.get('focusin') ?? []) listener({ target: beanSearch });
  assert.deepEqual(requested, [['beans', '', null, 'filters', false]]);

  view.setSearchOptions('filters', 'beans', { items: [{ id: BEAN, name: '원두 선택' }],
    nextCursor: 'names-next', hasMore: true }, false, 'Search Ethiopia');
  assert.equal(beanFilter.value, BEAN);
  assert.equal(beanFilter.options.length, 2);
  assert.equal(beanSearch.value, 'Search Ethiopia');
  const beanMore = content.querySelectorAll('[data-option-more]')
    .find(control => control.dataset.optionTarget === 'filters' && control.dataset.optionKind === 'beans');
  assert.equal(beanMore.hidden, false);
  assert.equal(beanFilter.dataset.nextCursor, 'names-next');

  view.setSearchOptions('filters', 'beans', { items: [{ id: '77777777-7777-4777-8777-777777777777', name: '다음 원두' }],
    nextCursor: null, hasMore: false }, true, 'Search Ethiopia');
  assert.equal(beanFilter.options.length, 3);
  assert.equal(beanFilter.value, BEAN);

  view.renderData({ ...data(), records: [], options: { filterBeans: { items: [{ id: BEAN, name: '원두 선택' }],
    nextCursor: 'names-next', hasMore: true } }, screen: { complete: true, hasMore: false,
    filters: { beanId: BEAN, recipeId: '' } } });
  const refreshedFilter = document.root.querySelector('[data-record-filter="beanId"]');
  const refreshedSearch = document.root.querySelectorAll('[data-option-search-kind]')
    .find(input => input.dataset.optionSearchKind === 'beans' && input.dataset.optionTarget === 'filters');
  assert.equal(refreshedFilter.options.length, 3, 'loaded options survive an unrelated page rerender');
  assert.equal(refreshedFilter.value, BEAN);
  assert.equal(refreshedSearch.value, 'Search Ethiopia', 'the active query survives an unrelated page rerender');
});

test('record form uses accessible searchable picker dialogs and restores focus without closing its parent', async () => {
  const document = new TestDocument();
  const view = createBeanView(document);
  const requested = [];
  const dirty = [];
  view.bind({ loadSearchOptions(...args) { requested.push(args); }, setDirty(...args) { dirty.push(args); }, getState() { return {}; } });
  view.renderData(data());
  view.renderRoute('/records/new');
  const entryDialog = document.root.querySelector('[data-entry-dialog="records"]');
  const form = document.root.querySelector('form[data-form="records"]');
  const beanPicker = form.querySelector('[data-search-picker]');
  const beanTrigger = beanPicker.querySelector('[data-action="open-search-picker"]');
  const beanSelect = beanPicker.querySelector('[data-option-select-kind="beans"]');
  const pickerDialog = beanPicker.querySelector('[data-option-picker]');
  const search = pickerDialog.querySelector('[data-option-search-kind="beans"]');

  assert.equal(beanTrigger.textContent, '원두 선택');
  assert.equal(beanTrigger.getAttribute('aria-required'), 'true');
  assert.equal(beanSelect.required, false, 'the clipped form control uses submit-time validation');
  assert.equal(beanSelect.getAttribute('aria-hidden'), 'true');
  assert.equal(form.elements.recipeId.getAttribute('aria-hidden'), 'true');
  assert.equal(pickerDialog.getAttribute('aria-modal'), 'true');

  await clickViewTarget(document, beanTrigger);
  assert.equal(entryDialog.open, true, 'the record entry dialog remains underneath the picker');
  assert.equal(pickerDialog.open, true);
  assert.equal(document.activeElement, search);
  for (const listener of document.root.querySelector('.data-panel').listeners.get('focusin') ?? []) listener({ target: search });
  assert.deepEqual(requested, [['beans', '', null, 'form', false]]);

  view.setSearchOptions('form', 'beans', { items: [{ id: BEAN, name: '원두 <안전>', status: 'ready' }],
    nextCursor: null, hasMore: false, complete: true }, false, '');
  const result = pickerDialog.querySelector(`[data-option-id="${BEAN}"]`);
  assert.ok(result);
  assert.match(result.textContent, /원두 <안전>/, 'option text is inserted as text, not interpreted as markup');
  await clickViewTarget(document, result);

  assert.equal(beanSelect.value, BEAN);
  assert.equal(beanTrigger.textContent.includes('원두 <안전>'), true);
  assert.match(beanTrigger.textContent, /시다마/);
  assert.equal(pickerDialog.open, false);
  assert.equal(entryDialog.open, true);
  assert.equal(document.activeElement, beanTrigger);
  assert.deepEqual(dirty, [[true, 'records']]);

  await clickViewTarget(document, beanTrigger);
  let prevented = false;
  for (const listener of pickerDialog.listeners.get('cancel') ?? []) listener({ preventDefault() { prevented = true; } });
  assert.equal(prevented, true, 'the picker handles Escape before the parent dialog can close');
  assert.equal(pickerDialog.open, false);
  assert.equal(entryDialog.open, true);
  assert.equal(document.activeElement, beanTrigger);
});

test('record filters share the picker, reset both selections, and expose search loading, errors, empty states, and paging', async () => {
  const document = new TestDocument();
  const view = createBeanView(document);
  const recordData = { ...data(), records: [], options: {
    filterBeans: { items: [{ id: BEAN, name: '원두 <안전>', status: 'ready' }], nextCursor: null, hasMore: false, complete: true },
    filterRecipes: { items: [{ id: RECIPE, name: 'V60', beanId: BEAN, status: 'ready' }], nextCursor: null, hasMore: false, complete: true },
  }, screen: { complete: true, hasMore: false, filters: { beanId: BEAN, recipeId: RECIPE } } };
  const calls = [];
  const filterUpdates = [];
  view.bind({ loadSearchOptions(...args) { calls.push(args); }, setRecordFilters(value) { filterUpdates.push(value); }, getState() { return {}; } });
  view.renderRoute('/records');
  view.renderData(recordData);
  const content = document.root.querySelector('.data-panel');
  const beanPicker = content.querySelectorAll('[data-search-picker]').find(item => item.dataset.optionTarget === 'filters' && item.dataset.optionKind === 'beans');
  const beanTrigger = beanPicker.querySelector('[data-action="open-search-picker"]');
  const beanSelect = beanPicker.querySelector('[data-record-filter="beanId"]');
  const dialog = beanPicker.querySelector('[data-option-picker]');
  assert.match(beanTrigger.textContent, /원두 <안전>/);
  await clickViewTarget(document, beanTrigger);
  const search = dialog.querySelector('[data-option-search-kind="beans"]');
  assert.equal(search.type, 'search');
  assert.match(dialog.querySelector('h2').textContent, /원두 선택/);

  view.setSearchOptionsState('filters', 'beans', { status: 'loading', query: '' });
  assert.match(dialog.querySelector('[data-option-status]').textContent, /불러오는 중/);
  view.setSearchOptionsState('filters', 'beans', { status: 'error', query: '' });
  assert.match(dialog.querySelector('[data-option-status]').textContent, /불러오지 못했습니다/);
  await clickViewTarget(document, dialog.querySelector('[data-action="retry-search-options"]'));
  assert.deepEqual(calls.at(-1), ['beans', '', null, 'filters', false]);

  search.value = '에티오피아';
  view.setSearchOptionsState('filters', 'beans', { status: 'error', query: '에티오피아' });
  const clearSearch = dialog.querySelector('[data-action="clear-option-search"]');
  assert.equal(clearSearch.hidden, false);
  await clickViewTarget(document, clearSearch);
  assert.equal(search.value, '');
  assert.deepEqual(calls.at(-1), ['beans', '', null, 'filters', false]);

  view.setSearchOptions('filters', 'beans', { items: [], nextCursor: 'next-page', hasMore: true, complete: false }, false, '검색');
  assert.match(dialog.querySelector('[data-option-status]').textContent, /검색 결과가 없습니다/);
  const more = dialog.querySelector('[data-option-more]');
  assert.equal(more.hidden, false);
  await clickViewTarget(document, more);
  assert.deepEqual(calls.at(-1), ['beans', '검색', 'next-page', 'filters', true]);

  view.setSearchOptions('filters', 'beans', { items: [], nextCursor: null, hasMore: false, complete: true }, false, '');
  assert.match(dialog.querySelector('[data-option-status]').textContent, /등록된 원두가 없습니다/);
  assert.ok(dialog.querySelector('[data-action="register-search-option"]'));

  const reset = content.querySelector('[data-action="clear-record-filters"]');
  assert.ok(reset);
  assert.equal(reset.disabled, false);
  await clickViewTarget(document, reset);
  assert.equal(beanSelect.value, '');
  assert.deepEqual(filterUpdates.at(-1), { beanId: '', recipeId: '' });
  assert.equal(beanTrigger.textContent, '모든 원두');
  assert.equal(content.querySelector('[data-record-filter="recipeId"]').value, '');
});

test('record picker validation focuses the first required selector without native hidden-select errors', async () => {
  const document = new TestDocument();
  const view = createBeanView(document);
  view.renderRoute('/records/new');
  view.renderData(data());
  const content = document.root.querySelector('.data-panel');
  const form = content.querySelector('form[data-form="records"]');
  const picker = form.querySelector('[data-search-picker]');
  const dialog = picker.querySelector('[data-option-picker]');
  let submitted = false;
  view.bind({ submit() { submitted = true; }, getState() { return {}; }, setDirty() {} });
  let prevented = false;
  for (const listener of content.listeners.get('submit') ?? []) {
    await listener({ target: form, preventDefault() { prevented = true; } });
  }
  assert.equal(prevented, true);
  assert.equal(submitted, false);
  assert.equal(dialog.open, true);
  assert.equal(document.activeElement, dialog.querySelector('[data-option-search-kind]'));
  assert.match(document.root.querySelector('.app-status').textContent, /원두를 선택/);
});


test('home is the default and root route, with the requested hero and four menu destinations', () => {
  const document = new TestDocument();
  const view = createAppView(document);
  view.renderData({ beans: [], recipes: [], records: [] });

  assert.equal(view.currentRoute(), '/home');
  const hero = document.root.querySelector('.home-hero');
  assert.ok(hero);
  assert.match(hero.textContent, /오늘의 한 잔을 시작해 보세요\./);
  assert.deepEqual(hero.querySelector('.home-hero-eyebrow').children.map(item => item.textContent), [
    'GOOD COFFEE', 'BRIGHTER DAYS',
  ]);
  assert.match(hero.textContent, /좋아하는 원두로, 나만의 방식으로\. 기록할수록 더 맛있는 커피가 됩니다\./);
  const artwork = hero.querySelector('[data-hero-art]');
  assert.equal(artwork.getAttribute('src'), './icons/home-brew.png');
  assert.equal(artwork.getAttribute('alt'), '');
  assert.equal(artwork.getAttribute('aria-hidden'), 'true');
  assert.equal(hero.querySelector('[data-action="start-brew"]').textContent, '추출 시작');
  assert.deepEqual(document.root.querySelector('nav.tabs').children.map(item => [item.dataset.route, item.textContent]), [
    ['/home', '홈'], ['/beans', '원두'], ['/recipes', '레시피'], ['/records', '추출 기록'],
  ]);

  view.renderRoute('/');
  assert.equal(view.currentRoute(), '/home');
  assert.ok(document.root.querySelector('.home-hero'));
});

test('brew routes preserve selected parents and show the saved recipe guide without an automatic timer', () => {
  const document = new TestDocument();
  const view = createBeanView(document);
  view.renderData(data());

  view.renderRoute('/brew/bean');
  const beanOption = document.root.querySelector('[data-action="select-brew-bean"]');
  assert.ok(beanOption);
  assert.equal(beanOption.dataset.beanId, BEAN);

  view.renderRoute(`/brew/recipe?beanId=${BEAN}&selectedRecipeId=${RECIPE}`);
  const recipeOption = document.root.querySelector('[data-action="select-brew-recipe"]');
  assert.ok(recipeOption);
  assert.equal(recipeOption.dataset.beanId, BEAN);
  assert.equal(recipeOption.dataset.recipeId, RECIPE);
  assert.equal(document.root.querySelector('[data-action="back-to-beans"]').dataset.route,
    `/brew/bean?selectedBeanId=${BEAN}`);

  view.renderRoute(`/brew/run?beanId=${BEAN}&recipeId=${RECIPE}`);
  const run = document.root.querySelector('.brew-run-pane');
  assert.ok(run);
  assert.match(run.textContent, /15g/);
  assert.match(run.textContent, /93℃/);
  assert.match(run.textContent, /250g/);
  assert.match(run.textContent, /교반 없음/);
  assert.match(run.textContent, /목표 추출 완료 시간: 2분 30초/);
  assert.equal(run.querySelectorAll('.steps-table').length, 1);
  assert.equal(run.querySelector('[data-action="start-timer"]'), null);
  const back = run.querySelector('[data-action="back-to-recipes"]');
  assert.equal(back.dataset.route, `/brew/recipe?beanId=${BEAN}&selectedRecipeId=${RECIPE}`);
  const complete = run.querySelector('[data-action="complete-brew"]');
  assert.equal(complete.dataset.beanId, BEAN);
  assert.equal(complete.dataset.recipeId, RECIPE);
});

test('empty bean selection explains registration and provides routes to register or return', () => {
  const document = new TestDocument();
  const view = createBeanView(document);
  view.renderData({ ...data(), beans: [], screen: { complete: true, hasMore: false } });
  view.renderRoute('/brew/bean');

  const pane = document.root.querySelector('.brew-flow-pane');
  assert.match(pane.textContent, /원두를 먼저 등록/);
  assert.equal(pane.querySelector('[data-route="/beans"]')?.textContent, '원두 등록하기');
  assert.ok(pane.querySelectorAll('[data-route="/home"]').some(item => item.textContent.includes('홈으로')));
});

test('brew search pages render validated options and keep pagination controls', () => {
  const document = new TestDocument();
  const view = createBeanView(document);
  view.renderData(data());
  view.renderRoute('/brew/bean');
  view.setSearchOptions('brew', 'beans', {
    items: [{ id: BEAN, name: '검색된 원두', status: 'ready' }],
    nextCursor: 'bean-next', hasMore: true, complete: false,
  }, false, '검색');

  const pane = document.root.querySelector('.brew-flow-pane');
  assert.equal(pane.querySelector('[data-option-search-kind="beans"]').value, '검색');
  assert.match(pane.textContent, /검색된 원두/);
  const more = pane.querySelector('[data-action="more-options"]');
  assert.ok(more);
  assert.equal(more.dataset.optionTarget, 'brew');
  assert.equal(more.dataset.optionKind, 'beans');
  assert.equal(more.dataset.nextCursor, 'bean-next');

  view.renderRoute(`/brew/recipe?beanId=${BEAN}`);
  view.setSearchOptions('brew', 'recipes', {
    items: [{ id: RECIPE, name: '검증된 레시피', status: 'ready', beanId: BEAN }],
    nextCursor: null, hasMore: false, complete: true,
  }, false, 'V60');
  assert.equal(document.root.querySelector('[data-action="select-brew-recipe"]').dataset.recipeId, RECIPE);
  assert.equal(document.root.querySelector('.brew-flow-pane').querySelector('[data-option-search-kind="recipes"]').value, 'V60');
});

test('brew completion preselects bean and recipe and defaults the record date to today', () => {
  const document = new TestDocument();
  const view = createBeanView(document);
  view.renderRoute(`/records/new?beanId=${BEAN}&recipeId=${RECIPE}`);
  const current = data();
  current.options = {
    beans: { items: [{ id: BEAN, name: '원두 <안전>', status: 'ready' }], nextCursor: null, hasMore: false },
    recipes: { items: [{ id: RECIPE, name: 'V60', status: 'ready' }], nextCursor: null, hasMore: false },
  };
  view.renderData(current);

  const dialog = document.root.querySelector('dialog[data-entry-dialog="records"]');
  const form = dialog.querySelector('form[data-form="records"]');
  assert.equal(dialog.open, true);
  assert.equal(form.elements.beanId.value, BEAN);
  assert.equal(form.elements.recipeId.value, RECIPE);
  const now = new Date();
  const expectedToday = [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0')].join('-');
  assert.equal(form.elements.date.value, expectedToday);
});


test('brew clicks preserve bean and recipe in browser history and complete into a prefilled record form', async () => {
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const previousLocation = Object.getOwnPropertyDescriptor(globalThis, 'location');
  let hash = '#/home';
  const replacements = [];
  const location = {
    pathname: '/index.html', search: '',
    get hash() { return hash; },
    set hash(value) { hash = value.startsWith('#') ? value : `#${value}`; },
  };
  const window = {
    location,
    history: { replaceState(_state, _title, url) {
      replacements.push(url);
      hash = `#${url.split('#').at(-1)}`;
    } },
    addEventListener() {},
  };
  Object.defineProperty(globalThis, 'window', { configurable: true, writable: true, value: window });
  Object.defineProperty(globalThis, 'location', { configurable: true, writable: true, value: location });
  try {
    const document = new TestDocument();
    const view = createAppView(document);
    const current = data();
    current.options = {
      beans: { items: [{ id: BEAN, name: current.beans[0].name, status: 'ready' }], hasMore: false },
      recipes: { items: [{ id: RECIPE, name: current.recipes[0].name, beanId: BEAN, status: 'ready' }], hasMore: false },
    };
    view.renderData(current);
    view.bind({});
    const click = async target => {
      for (const listener of document.root.firstElementChild.listeners.get('click') ?? []) await listener({ target });
    };
    const showHashRoute = () => view.renderRoute(location.hash.slice(1));

    await click(document.root.querySelector('[data-action="start-brew"]'));
    assert.equal(location.hash, '#/brew/bean');
    showHashRoute();
    await click(document.root.querySelector('[data-action="select-brew-bean"]'));
    assert.match(replacements.at(-1), new RegExp(`#/brew/bean\\?selectedBeanId=${BEAN}`));
    assert.equal(location.hash, `#/brew/recipe?beanId=${BEAN}`);

    hash = replacements.at(-1).slice(replacements.at(-1).indexOf('#'));
    showHashRoute();
    assert.equal(document.root.querySelector('[data-action="select-brew-bean"]').getAttribute('aria-pressed'), 'true');
    await click(document.root.querySelector('[data-action="select-brew-bean"]'));
    showHashRoute();
    await click(document.root.querySelector('[data-action="select-brew-recipe"]'));
    assert.match(replacements.at(-1), new RegExp(`#/brew/recipe\\?beanId=${BEAN}&selectedRecipeId=${RECIPE}`));
    assert.equal(location.hash, `#/brew/run?beanId=${BEAN}&recipeId=${RECIPE}`);

    hash = replacements.at(-1).slice(replacements.at(-1).indexOf('#'));
    showHashRoute();
    assert.equal(document.root.querySelector('[data-action="select-brew-recipe"]').getAttribute('aria-pressed'), 'true');
    await click(document.root.querySelector('[data-action="select-brew-recipe"]'));
    showHashRoute();
    await click(document.root.querySelector('[data-action="complete-brew"]'));
    assert.match(location.hash, new RegExp(`^#/records/new\\?beanId=${BEAN}&recipeId=${RECIPE}&date=\\d{4}-\\d{2}-\\d{2}$`));
    showHashRoute();
    const form = document.root.querySelector('form[data-form="records"]');
    assert.equal(form.elements.beanId.value, BEAN);
    assert.equal(form.elements.recipeId.value, RECIPE);
  } finally {
    if (previousWindow) Object.defineProperty(globalThis, 'window', previousWindow);
    else delete globalThis.window;
    if (previousLocation) Object.defineProperty(globalThis, 'location', previousLocation);
    else delete globalThis.location;
  }
});

test('critic: shared recipes remain selectable and usable with an explicitly selected bean', () => {
  const document = new TestDocument();
  const view = createBeanView(document);
  const current = data();
  current.recipes[0].beanId = null;
  current.options = {
    beans: { items: [{ id: BEAN, name: current.beans[0].name, status: 'ready' }] },
    recipes: { items: [{ id: RECIPE, name: current.recipes[0].name, status: 'ready' }] },
  };
  view.renderData(current);

  view.renderRoute('/brew/recipe?beanId=' + BEAN);
  assert.ok(document.root.querySelector('[data-action="select-brew-recipe"]'),
    'a recipe without a legacy bean relation is still public');

  view.renderRoute('/brew/run?beanId=' + BEAN + '&recipeId=' + RECIPE);
  assert.ok(document.root.querySelector('.brew-run-pane'));
  assert.equal(document.root.querySelector('.record-warning'), null);
});

test('critic: visiting the record list does not overwrite later brew prefill with an empty form', () => {
  const document = new TestDocument();
  const view = createBeanView(document);
  const current = data();
  current.options = {
    beans: { items: [{ id: BEAN, name: '원두 선택', status: 'ready' }] },
    recipes: { items: [{ id: RECIPE, name: 'V60', status: 'ready' }] },
  };
  view.renderData(current);
  view.renderRoute('/records');
  view.renderRoute('/home');
  view.renderRoute('/records/new?beanId=' + BEAN + '&recipeId=' + RECIPE);

  const form = document.root.querySelector('form[data-form="records"]');
  assert.equal(form.elements.beanId.value, BEAN);
  assert.equal(form.elements.recipeId.value, RECIPE);
});

test('record draft conflicts require an explicit resume or new-record choice', async () => {
  const document = new TestDocument();
  const view = createBeanView(document);
  const current = data();
  current.options = { beans: { items: current.beans }, recipes: { items: current.recipes } };
  view.renderData(current);
  view.renderRoute('/records');
  view.showRecordForm();
  const form = document.root.querySelector('form[data-form="records"]');
  form.elements.beanId.value = BEAN;
  form.elements.recipeId.value = RECIPE;
  form.elements.rating.value = '4';
  form.elements.cupNote.value = '이어 써야 하는 컵노트';

  view.renderRoute('/home');
  view.renderRoute('/records/new?beanId=99999999-9999-4999-8999-999999999999&recipeId=' + RECIPE);

  const conflict = document.root.querySelector('.record-draft-conflict');
  assert.ok(conflict, 'a meaningful draft must be protected from a different brew flow');
  assert.ok(conflict.querySelector('[data-action="resume-record-draft"]'));
  assert.ok(conflict.querySelector('[data-action="start-new-record"]'));
  assert.match(conflict.textContent, /이어 써야 하는 컵노트/);
  view.bind({});
  const click = async target => {
    for (const listener of document.root.firstElementChild.listeners.get('click') ?? []) await listener({ target });
  };
  await click(conflict.querySelector('[data-action="resume-record-draft"]'));
  let resumed = document.root.querySelector('form[data-form="records"]');
  assert.equal(resumed.elements.beanId.value, BEAN);
  assert.equal(resumed.elements.rating.value, '4');
  assert.equal(resumed.elements.cupNote.value, '이어 써야 하는 컵노트');
  view.renderRoute('/records/new?beanId=' + BEAN + '&recipeId=' + RECIPE);
  await click(document.root.querySelector('[data-action="start-new-record"]'));
  resumed = document.root.querySelector('form[data-form="records"]');
  assert.equal(resumed.elements.beanId.value, BEAN);
  assert.equal(resumed.elements.rating.value, '');
  assert.equal(resumed.elements.cupNote.value, '');
});

test('same brew record draft survives leaving and returning to its URL', () => {
  const document = new TestDocument();
  const view = createBeanView(document);
  const current = data();
  current.options = {
    beans: { items: [{ id: BEAN, name: current.beans[0].name, status: 'ready' }] },
    recipes: { items: [{ id: RECIPE, name: current.recipes[0].name, status: 'ready' }] },
  };
  const route = '/records/new?beanId=' + BEAN + '&recipeId=' + RECIPE + '&date=2026-10-27';
  view.renderData(current);
  view.renderRoute(route);
  let form = document.root.querySelector('form[data-form="records"]');
  form.elements.rating.value = '5';
  form.elements.cupNote.value = '같은 흐름';

  view.renderRoute('/home');
  view.renderRoute(route);
  form = document.root.querySelector('form[data-form="records"]');
  assert.equal(form.elements.beanId.value, BEAN);
  assert.equal(form.elements.recipeId.value, RECIPE);
  assert.equal(form.elements.rating.value, '5');
  assert.equal(form.elements.cupNote.value, '같은 흐름');
});

test('critic: initial and later brew pages append uniquely without leaking into a search', () => {
  const document = new TestDocument();
  const view = createBeanView(document);
  const secondBeanId = '77777777-7777-4777-8777-777777777777';
  const thirdBeanId = '88888888-8888-4888-8888-888888888888';
  const current = data();
  current.screen = { route: '/brew/bean', hasMore: true, nextCursor: 'bean-page-2', complete: false };
  view.renderData(current);
  view.renderRoute('/brew/bean');
  view.setSearchOptions('brew', 'beans', { items: [{ id: secondBeanId, name: '두 번째 원두', status: 'ready' }],
    nextCursor: 'bean-page-3', hasMore: true, complete: false }, true, '');
  assert.deepEqual(document.root.querySelectorAll('[data-action="select-brew-bean"]').map(item => item.dataset.beanId),
    [BEAN, secondBeanId]);

  view.setSearchOptions('brew', 'beans', { items: [
    { id: secondBeanId, name: '중복 원두', status: 'ready' },
    { id: thirdBeanId, name: '세 번째 원두', status: 'ready' },
    { id: thirdBeanId, name: '페이지 내부 중복', status: 'ready' },
  ], nextCursor: null, hasMore: false, complete: true }, true, '');
  assert.deepEqual(document.root.querySelectorAll('[data-action="select-brew-bean"]').map(item => item.dataset.beanId),
    [BEAN, secondBeanId, thirdBeanId]);

  view.setSearchOptions('brew', 'beans', { items: [{ id: secondBeanId, name: '검색 결과 1', status: 'ready' }],
    nextCursor: 'search-page-2', hasMore: true, complete: false }, false, '검색');
  view.setSearchOptions('brew', 'beans', { items: [
    { id: secondBeanId, name: '중복 검색 결과', status: 'ready' },
    { id: thirdBeanId, name: '검색 결과 2', status: 'ready' },
  ], nextCursor: null, hasMore: false, complete: true }, true, '검색');
  assert.deepEqual(document.root.querySelectorAll('[data-action="select-brew-bean"]').map(item => item.dataset.beanId),
    [secondBeanId, thirdBeanId], 'search pages replace the unfiltered repository page and deduplicate IDs');

  const recipePage = { ...data(), screen: { route: '/brew/recipe?beanId=' + BEAN,
    hasMore: true, nextCursor: 'recipe-page-2', complete: false } };
  recipePage.recipes = [{ ...recipePage.recipes[0], validationStatus: 'ready' }];
  view.renderData(recipePage);
  view.renderRoute('/brew/recipe?beanId=' + BEAN);
  view.setSearchOptions('brew', 'recipes', { items: [{ id: thirdBeanId, name: '두 번째 레시피', beanId: BEAN,
    dose: 15, temperature: 93, totalWater: 250, steps: [], validationStatus: 'ready' }],
  nextCursor: null, hasMore: false, complete: true }, true, '');
  assert.deepEqual(document.root.querySelectorAll('[data-action="select-brew-recipe"]').map(item => item.dataset.recipeId),
    [RECIPE, thirdBeanId], 'recipe pagination also appends its initial repository page');
});


test('record draft keeps selected IDs while its option pages reload after navigation', () => {
  const document = new TestDocument();
  const view = createBeanView(document);
  const current = data();
  current.options = { beans: { items: current.beans }, recipes: { items: current.recipes } };
  const route = '/records/new?beanId=' + BEAN + '&recipeId=' + RECIPE;
  view.renderData(current);
  view.renderRoute(route);
  const form = document.root.querySelector('form[data-form="records"]');
  form.elements.rating.value = '5';
  form.elements.cupNote.value = '옵션 로딩 중에도 유지';
  view.renderRoute('/home');
  view.renderData({ beans: [], recipes: [], records: [] });
  view.renderRoute(route);
  const restored = document.root.querySelector('form[data-form="records"]');
  assert.ok(restored.elements.beanId.options.some(option => option.value === BEAN), 'native selects need a matching option to retain a draft ID');
  assert.ok(restored.elements.recipeId.options.some(option => option.value === RECIPE));
  view.renderData(current);
  const loaded = document.root.querySelector('form[data-form="records"]');
  assert.equal(loaded.elements.beanId.value, BEAN);
  assert.equal(loaded.elements.recipeId.value, RECIPE);
  assert.equal(loaded.elements.cupNote.value, '옵션 로딩 중에도 유지');
});

for (const edited of [false, true]) {
  test(`integration: first record response hydrates prefills without replacing the live modal (edited=${edited})`, () => {
    const document = new TestDocument();
    const view = createAppView(document);
    view.renderData({ beans: [], recipes: [], records: [], screen: { route: '/home' } });
    const route = '/records/new?beanId=' + BEAN + '&recipeId=' + RECIPE + '&date=2026-10-27';
    view.renderRoute(route);
    const dialog = document.root.querySelector('dialog[data-entry-dialog="records"]');
    const form = dialog.querySelector('form');
    if (edited) {
      form.elements.rating.value = '4';
      form.elements.cupNote.value = '첫 응답 전 입력';
    }
    form.elements.cupNote.focus();
    view.setRouteReadState('loading');
    const current = data();
    current.screen = { route };
    current.options = { beans: { items: current.beans, hasMore: true, nextCursor: 'beans-next' },
      recipes: { items: current.recipes } };
    view.renderData(current);
    view.setRouteReadState('ready');
    assert.ok(document.root.querySelector('dialog[data-entry-dialog="records"]') === dialog);
    assert.ok(dialog.querySelector('form') === form);
    assert.ok(document.activeElement === form.elements.cupNote);
    assert.equal(form.elements.beanId.value, BEAN);
    assert.equal(form.elements.recipeId.value, RECIPE);
    assert.equal(form.elements.date.value, '2026-10-27');
    assert.equal(form.elements.rating.value, edited ? '4' : '');
    assert.equal(form.elements.cupNote.value, edited ? '첫 응답 전 입력' : '');
    assert.equal(form.elements.beanId.dataset.nextCursor, 'beans-next');
    assert.equal(dialog.open, true);
    assert.equal(document.root.querySelector('.card-skeletons').hidden, true);
    if (!edited) {
      view.renderRoute('/home');
      view.renderRoute('/records/new?beanId=' + BEAN + '&recipeId=' + RECIPE + '&date=2026-10-28');
      assert.equal(document.root.querySelector('.record-draft-conflict'), null, 'hydrated defaults alone are not a meaningful draft');
    }
  });
}

test('integration: invalid record prefill closes the initial modal and exposes the validated error', () => {
  const document = new TestDocument();
  const view = createAppView(document);
  view.renderData({ beans: [], recipes: [], records: [], screen: { route: '/home' } });
  const route = '/records/new?recipeId=' + RECIPE;
  view.renderRoute(route);
  assert.ok(document.root.querySelector('dialog[data-entry-dialog="records"]').open);
  view.renderData({ beans: [], recipes: [], records: [], screen: { route, error: 'bean-required' } });
  assert.ok(!document.root.querySelector('form[data-form="records"]'));
  assert.match(document.root.querySelector('.record-warning').textContent, /원두를 먼저/);
});


test('record rating offers five required native stars and preserves the selected score in drafts', () => {
  const document = new TestDocument();
  const view = createBeanView(document);
  view.renderData(data());
  view.renderRoute('/records/new');
  let form = document.root.querySelector('form[data-form="records"]');
  const stars = form.querySelectorAll('input[name="rating"]');
  assert.equal(stars.length, 5);
  assert.deepEqual(stars.map(star => star.value), ['1', '2', '3', '4', '5']);
  assert.ok(stars.every(star => star.type === 'radio' && star.required));
  assert.deepEqual(stars.map(star => star.getAttribute('aria-label')), ['1점', '2점', '3점', '4점', '5점']);
  assert.equal(form.elements.rating.value, '');
  assert.equal(form.querySelectorAll('.rating-option').length, 5);
  assert.equal(form.querySelectorAll('svg').filter(svg => svg.closest('.star-rating')).length, 5);
  form.elements.rating.value = '3';
  view.renderRoute('/home');
  view.renderRoute('/records/new');
  form = document.root.querySelector('form[data-form="records"]');
  assert.equal(form.elements.rating.value, '3');
  assert.deepEqual(form.querySelectorAll('input[name="rating"]').map(star => Boolean(star.checked)), [false, false, true, false, false]);
});

test('critic regression: initial server option page remains visible after loading the next picker page', () => {
  const document = new TestDocument();
  const view = createBeanView(document);
  const current = data();
  current.options = { filterBeans: { items: [{ id: BEAN, name: 'first' }], hasMore: true, nextCursor: 'p2', complete: false } };
  view.renderRoute('/records');
  view.renderData(current);
  view.setSearchOptions('filters', 'beans', { items: [{ id: 'second', name: 'second' }], hasMore: false, complete: true }, true, '');
  const picker = document.root.querySelectorAll('[data-search-picker]')
    .find(item => item.dataset.optionTarget === 'filters' && item.dataset.optionKind === 'beans');
  assert.equal(picker.querySelectorAll('[data-option-id]').length, 2);
});

test('critic regression: restored draft and route-prefilled IDs update visible picker labels', () => {
  const prefillDocument = new TestDocument();
  const prefillView = createBeanView(prefillDocument);
  const route = `/records/new?beanId=${BEAN}&recipeId=${RECIPE}`;
  prefillView.renderData({ beans: [], recipes: [], records: [], screen: { route: '/home' } });
  prefillView.renderRoute(route);
  const response = data();
  response.screen = { route };
  response.options = { beans: { items: response.beans }, recipes: { items: response.recipes } };
  prefillView.renderData(response);
  const prefilled = prefillDocument.root.querySelector('form[data-form="records"]');
  assert.equal(prefilled.elements.beanId.value, BEAN);
  assert.equal(prefilled.elements.recipeId.value, RECIPE);
  assert.match(prefilled.querySelector('[data-action="open-search-picker"]').textContent, /원두 <안전>/);
  assert.match(prefilled.querySelectorAll('[data-action="open-search-picker"]')[1].textContent, /V60/);

  const document = new TestDocument();
  const view = createBeanView(document);
  const current = data();
  current.options = { beans: { items: [{ id: BEAN, name: 'first' }] }, recipes: { items: [{ id: RECIPE, name: 'recipe' }] } };
  view.renderData(current);
  view.renderRoute('/records/new');
  let form = document.root.querySelector('form[data-form="records"]');
  form.elements.beanId.value = BEAN;
  form.elements.recipeId.value = RECIPE;
  form.elements.cupNote.value = 'draft';
  view.renderRoute('/home');
  view.renderRoute('/records/new');
  form = document.root.querySelector('form[data-form="records"]');
  assert.equal(form.elements.beanId.value, BEAN);
  assert.match(form.querySelector('[data-action="open-search-picker"]').textContent, /first/);
});

test('critic regression: selected filter options survive a search and unrelated rerender', () => {
  const document = new TestDocument();
  const view = createBeanView(document);
  const current = data();
  current.options = { filterBeans: { items: [{ id: BEAN, name: 'first' }], complete: true } };
  current.screen = { filters: { beanId: BEAN, recipeId: '' }, complete: true };
  view.renderRoute('/records');
  view.renderData(current);
  view.setSearchOptions('filters', 'beans', { items: [{ id: 'second', name: 'second' }], complete: true }, false, 'second');
  assert.equal(document.root.querySelector('[data-record-filter="beanId"]').value, BEAN);
  view.renderData(current);
  const select = document.root.querySelector('[data-record-filter="beanId"]');
  assert.ok(select.options.some(option => option.value === BEAN), 'matching selected option should remain in native select');
});
