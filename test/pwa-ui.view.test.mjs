import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createAppView } from '../pwa/ui/view.mjs';
import { createAppController } from '../pwa/ui/controller.mjs';
import { validateRecipe } from '../lib/domain.mjs';

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
    return Object.fromEntries(fields.map(field => [field.name, field]));
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

function createBeanView(document) {
  const view = createAppView(document);
  view.renderRoute('/beans');
  return view;
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

test('startup checking shows one body overlay until retry is needed', () => {
  const document = new TestDocument();
  const { body, page } = mountInPage(document);
  const view = createBeanView(document);
  view.setState({ pending: true, frozen: false, unresolved: false });
  view.showConnection({ connected: false, checkingInitialization: true });
  view.showStatus({ type: 'startup-checking', message: '저장된 연결 확인 중' });
  const status = document.root.querySelector('.app-status');
  const loading = body.querySelector('.startup-loading');
  const spinner = loading?.querySelector('.startup-spinner');
  assert.ok(spinner);
  assert.equal(spinner.getAttribute('aria-hidden'), 'true');
  assert.equal(spinner.children.length, 12);
  assert.equal(loading.hidden, false);
  assert.equal(loading.parentElement === body, true);
  assert.equal(loading.getAttribute('aria-hidden'), null);
  assert.equal(status.hidden, true);
  assert.equal(page.inert, true);
  const shades = spinner.children.map(spoke => Number(spoke.getAttribute('style').match(/opacity: ([\d.]+)/)?.[1]));
  assert.ok(shades.every(shade => shade > 0 && shade <= 1));
  assert.equal(new Set(shades).size, 12, 'stepped rotation needs fading spokes to remain visible');
  assert.equal(loading.getAttribute('role'), 'status');
  assert.equal(loading.querySelector('.visually-hidden').textContent, '저장된 연결 확인 중');
  assert.equal(document.root.querySelector('.connection-panel').hidden, true);
  assert.equal(document.root.querySelector('.connection-details').hidden, true);
  assert.equal(document.root.querySelector('.startup-retry-panel').hidden, true);
  assert.equal(document.root.querySelector('.connection-toggle').disabled, true);

  view.showStatus({ type: 'startup-busy', message: '잠시 후 다시 시도해 주세요.' });
  view.showConnection({ connected: false, retryInitialization: true });
  assert.equal(loading.querySelector('.startup-spinner'), null);
  assert.ok(loading.querySelector('.operation-spinner'));
  assert.equal(loading.hidden, false, 'the shared overlay stays until pending cleanup');
  assert.equal(status.textContent, '잠시 후 다시 시도해 주세요.');
  assert.equal(page.inert, false);
  assert.equal(document.root.querySelector('.startup-retry-panel').hidden, false);
  view.setState({ pending: false, frozen: false, unresolved: false });
  assert.equal(loading.hidden, true);

  view.setState({ pending: true, frozen: false, unresolved: false });
  view.showConnection({ connected: false, checkingInitialization: true });
  view.showStatus({ type: 'startup-checking', message: '저장된 연결 확인 중' });
  assert.ok(loading.querySelector('.startup-spinner'));
  assert.equal(document.root.querySelector('.startup-retry-panel').hidden, true);
  view.showConnection({ connected: false });
  view.showStatus({ type: 'disconnected', message: 'Notion 연결 정보를 입력해 주세요.' });
  view.setState({ pending: false, frozen: false, unresolved: false });
  assert.equal(loading.querySelector('.pull-refresh-spinner'), null);
  assert.equal(loading.hidden, true);
  assert.equal(page.inert, false);
  assert.equal(document.root.querySelector('.connection-details').hidden, false);
  assert.equal(document.root.querySelector('.connection-toggle').disabled, false);
});

for (const outcome of ['saved', 'missing', 'error', 'recovery', 'busy', 'read-error']) {
  test(`initialization spinner ends on ${outcome}`, async () => {
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
    const initializing = app.initialize();
    const status = document.root.querySelector('.app-status');
    const loading = body.querySelector('.startup-loading');
    assert.ok(loading?.querySelector('.startup-spinner'));
    assert.equal(document.root.querySelector('.startup-retry-panel').hidden, true);
    assert.equal(document.root.querySelector('.connection-panel').hidden, true);
    finishRead();
    assert.equal(await initializing, ['saved', 'read-error'].includes(outcome) ? true : outcome === 'missing' ? null : false);
    assert.equal(loading?.querySelector('.startup-spinner'), null);
    assert.equal(loading.hidden, true);
    assert.equal(page.inert, false);
    assert.equal(status.hidden, outcome === 'saved');
    if (outcome === 'saved') assert.equal(status.textContent, '');
    assert.equal(status.dataset.state, { saved: 'ready', missing: 'disconnected', error: 'connection-error',
      recovery: 'connection-error', busy: 'startup-busy', 'read-error': 'read-error' }[outcome]);
    assert.equal(document.root.querySelector('.startup-retry-panel').hidden, outcome !== 'busy');
    assert.equal(document.root.querySelector('.repair-panel').hidden, outcome !== 'recovery');
    assert.equal(document.root.querySelector('.connection-details').hidden, outcome === 'busy');
  });
}

test('shared loading overlay stays outside transformed page through ready completion', () => {
  const document = new TestDocument();
  const { body, page } = mountInPage(document);
  const view = createBeanView(document);
  const loading = body.querySelector('.startup-loading');
  assert.ok(loading, 'overlay belongs to body, outside pull-to-refresh transforms');
  assert.equal(loading.parentElement === body, true);
  assert.equal(page.style.transform, 'matrix(1, 0, 0, 1, 0, 0)');
  assert.equal(page.dataset.pullState, 'idle');
  assert.equal(loading.hidden, true);
  view.setState({ pending: true, frozen: false, unresolved: false });
  view.showStatus({ type: 'startup-checking', message: '저장된 연결 확인 중' });
  assert.equal(loading.hidden, false);
  view.showStatus({ type: 'ready', message: '' });
  assert.equal(loading.hidden, false, 'ready must not end pending work');
  assert.ok(loading.querySelector('.operation-spinner'));
  assert.equal(loading.querySelector('.pull-refresh-spinner').parentElement === loading, true);
  view.setState({ pending: false, frozen: false, unresolved: false });
  assert.equal(loading.hidden, true);
  assert.equal(loading.children.length, 0);
  assert.equal(page.inert, false);
  const status = document.root.querySelector('.app-status');
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

test('successful status messages stay visible for three seconds then hide', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const document = new TestDocument();
  const view = createBeanView(document);
  const status = document.root.querySelector('.app-status');
  for (const type of ['connected', 'saved', 'resolved', 'cancelled']) {
    view.showStatus({ type, message: '완료했습니다.' });
    assert.equal(status.hidden, false);
    assert.equal(status.textContent, '완료했습니다.');
    t.mock.timers.tick(2999);
    assert.equal(status.hidden, false);
    t.mock.timers.tick(1);
    assert.equal(status.hidden, true, type);
    assert.equal(status.popoverOpen, false, type);
  }
});

test('errors, recovery notices and pending work stay visible after replacing success', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const document = new TestDocument();
  const view = createBeanView(document);
  const status = document.root.querySelector('.app-status');
  for (const type of ['error', 'read-error', 'connection-error', 'validation-error', 'resolution-error',
    'saved-read-error', 'unknown', 'partial', 'failed', 'resolution-required', 'startup-busy',
    'disconnected', 'checking', 'saving']) {
    view.showStatus({ type: 'connected', message: '완료' });
    t.mock.timers.tick(1000);
    view.showStatus({ type, message: '확인이 필요합니다.' });
    t.mock.timers.tick(10000);
    assert.equal(status.hidden, false, type);
    assert.equal(status.popoverOpen, true, type);
    assert.equal(status.textContent, '확인이 필요합니다.');
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

test('operation spinner stays in body overlay outside the touch-transformed page', () => {
  const stylesheet = readFileSync(new URL('../pwa/styles.css', import.meta.url), 'utf8');
  const overlayRule = stylesheet.match(/\.startup-loading\s*\{([^}]*)\}/s);
  assert.ok(overlayRule, 'the shared body overlay must have a viewport rule');
  assert.match(overlayRule[1], /position:\s*fixed/);
  assert.match(overlayRule[1], /inset:\s*0/);
  assert.match(stylesheet, /\.startup-loading \.operation-spinner\s*\{\s*animation:\s*pull-refresh-spin 0\.8s steps\(12\) infinite;/);
  assert.match(stylesheet, /\.startup-loading \.operation-spinner\s*\{ animation: none; \}/);

  const document = new TestDocument();
  const { body, page } = mountInPage(document);
  const view = createBeanView(document);
  const status = document.root.querySelector('.app-status');
  const loading = body.querySelector('.startup-loading');
  view.setState({ pending: true, frozen: false, unresolved: false });
  view.showStatus({ type: 'startup-checking', message: '저장된 연결 확인 중' });
  const spinner = loading.querySelector('.startup-spinner');
  assert.ok(spinner);
  view.showStatus({ type: 'saving', message: '저장 중입니다.' });
  const operationSpinner = loading.querySelector('.operation-spinner');
  assert.equal(operationSpinner === spinner, true, 'startup and operation states reuse one spinner node');
  assert.equal(loading.hidden, false);
  assert.equal(loading.parentElement === body, true);
  assert.equal(loading.querySelectorAll('.pull-refresh-spinner').length, 1);
  assert.equal(page.querySelector('.operation-spinner'), null);
  assert.equal(page.dataset.pullState, 'idle');
  assert.equal(page.style.transform, 'matrix(1, 0, 0, 1, 0, 0)');
  assert.equal(operationSpinner.hidden, false);
  assert.equal(operationSpinner.getAttribute('aria-hidden'), 'true');
  assert.equal(status.getAttribute('role'), 'status');
  assert.equal(status.getAttribute('aria-live'), 'polite');
  assert.equal(status.getAttribute('aria-busy'), 'true');
  assert.equal(loading.getAttribute('aria-hidden'), 'true', 'the live status remains the sole operation announcement');
});

test('operation spinner stays visible through success, ready and timeout, then clears on completion or failure', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const document = new TestDocument();
  const { body } = mountInPage(document);
  const view = createBeanView(document);
  const status = document.root.querySelector('.app-status');
  const loading = body.querySelector('.startup-loading');
  let spinner;
  const assertPendingSpinner = state => {
    assert.equal(spinner.hidden, false, `spinner stays visible during ${state}`);
    assert.equal(spinner.parentElement === loading, true);
    assert.equal(loading.hidden, false);
    assert.equal(status.getAttribute('aria-busy'), 'true');
    assert.equal(status.hidden, false);
  };

  view.setState({ pending: true, frozen: false, unresolved: false });
  view.showStatus({ type: 'saving', message: '저장 중입니다.' });
  spinner = loading.querySelector('.operation-spinner');
  assert.equal(spinner.getAttribute('aria-hidden'), 'true');
  assert.equal(spinner.children.length, 12);
  assertPendingSpinner('saving');
  view.showStatus({ type: 'saved', message: '저장했습니다. 최신 목록을 다시 불러옵니다.' });
  assertPendingSpinner('saved');
  t.mock.timers.tick(3500);
  assertPendingSpinner('saved after status timeout');
  view.showStatus({ type: 'ready', message: '' });
  t.mock.timers.tick(3500);
  assertPendingSpinner('ready after status timeout');
  view.setState({ pending: false, frozen: false, unresolved: false });
  assert.equal(spinner.hidden, true);
  assert.equal(loading.hidden, true);
  assert.equal(status.getAttribute('aria-busy'), 'false');
  assert.equal(status.hidden, true);

  view.setState({ pending: true, frozen: false, unresolved: false });
  view.showStatus({ type: 'saving', message: '저장 중입니다.' });
  view.showStatus({ type: 'validation-error', message: '입력 내용을 확인해 주세요.' });
  t.mock.timers.tick(3500);
  assertPendingSpinner('failed operation before cleanup');
  view.setState({ pending: false, frozen: false, unresolved: false });
  assert.equal(spinner.hidden, true);
  assert.equal(loading.hidden, true);
  assert.equal(status.getAttribute('aria-busy'), 'false');
  assert.equal(status.hidden, false);
  assert.equal(status.textContent, '입력 내용을 확인해 주세요.');
});

test('a new success gets a full display interval and empty messages hide immediately', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const document = new TestDocument();
  const view = createBeanView(document);
  const status = document.root.querySelector('.app-status');
  view.showStatus({ type: 'saved', message: '저장했습니다.' });
  t.mock.timers.tick(2000);
  view.showStatus({ type: 'connected', message: '연결했습니다.' });
  t.mock.timers.tick(1000);
  assert.equal(status.hidden, false);
  t.mock.timers.tick(2000);
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
  assert.equal(recordForm.elements.beanId.required, true);
  assert.equal(recordForm.elements.recipeId.required, true);
  assert.equal(recordForm.elements.rating.required, true);

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
  const tableIndex = detail.children.findIndex(child => child.className === 'table-scroll');
  const guideIndex = detail.children.indexOf(guide);
  const recordsIndex = detail.children.findIndex(child => child.tagName === 'h4' && child.textContent === '추출 기록');
  assert.ok(tableIndex < guideIndex);
  assert.ok(guideIndex < recordsIndex);

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

test('bean cards expose a labelled trash button and require confirmation before deleting', async () => {
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
  const original = globalThis.confirm;
  try {
    globalThis.confirm = message => { assert.ok(message.includes('원두 <안전>')); return false; };
    for (const listener of document.root.firstElementChild.listeners.get('click')) await listener({ target: trash });
    assert.equal(calls.length, 0);
    globalThis.confirm = () => true;
    for (const listener of document.root.firstElementChild.listeners.get('click')) await listener({ target: trash });
    assert.deepEqual(calls, [['delete-bean', { id: BEAN }]]);
    for (const state of [{ pending: true }, { frozen: true }, { unresolved: true }]) {
      view.setState(state);
      assert.equal(trash.disabled, true);
    }
  } finally {
    if (original === undefined) delete globalThis.confirm; else globalThis.confirm = original;
  }
});

test('recipe and record cards expose named trash controls and confirm each item before submission', async () => {
  const document = new TestDocument(), view = createBeanView(document);
  view.showConnection({ connected: true });
  view.renderData(data());
  const calls = [];
  const confirmations = [];
  view.bind({ getState: () => ({ pending: false, frozen: false, unresolved: false }),
    submit: async (...args) => calls.push(args) });
  const original = globalThis.confirm;
  assert.equal(Boolean(document.root.querySelector('[data-action="delete-bag"]')), false);
  const cases = [
    ['/recipes', 'delete-recipe', 'V60', 'V60'],
    ['/records', 'delete-record', '2026-06-15 · V60', '2026-06-15 · V60'],
  ];
  try {
    globalThis.confirm = message => { confirmations.push(message); return false; };
    for (const [route, action, name] of cases) {
      view.renderRoute(route);
      const trash = document.root.querySelector(`[data-action="${action}"]`);
      assert.ok(trash, `${action} control exists`);
      assert.equal(trash.type, 'button');
      assert.equal(trash.getAttribute('aria-label'), `${name} 삭제`);
      assert.ok(trash.querySelector('svg'));
      assert.equal(trash.dataset.name, name);
      assert.match(trash.parentElement.className, /entity-card-header/);
      for (const listener of document.root.firstElementChild.listeners.get('click')) await listener({ target: trash });
      assert.equal(calls.length, 0, 'cancelled confirmation sends no request');
    }
    globalThis.confirm = message => { confirmations.push(message); return true; };
    for (const [route, action, name, promptName] of cases) {
      view.renderRoute(route);
      const trash = document.root.querySelector(`[data-action="${action}"]`);
      for (const listener of document.root.firstElementChild.listeners.get('click')) await listener({ target: trash });
      assert.match(confirmations.at(-1), new RegExp(promptName));
      assert.match(confirmations.at(-1), /Notion 휴지통으로 이동/);
    }
    assert.deepEqual(calls, [
      ['delete-recipe', { id: RECIPE }],
      ['delete-record', { id: '66666666-6666-4666-8666-666666666666' }],
    ]);
  } finally {
    if (original === undefined) delete globalThis.confirm; else globalThis.confirm = original;
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
    assert.ok(form.querySelector('[data-action="cancel-form"]'));
    assert.ok(form.querySelectorAll('button').some(control => control.type === 'submit'));
    await click(form.querySelector('[data-action="cancel-form"]'));
    assert.equal(document.root.querySelector(`dialog[data-entry-dialog="${kind}"]`).open, false);
    assert.equal(writes, 0, 'cancelling an entry never submits it');
  }
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

test('reduced motion overrides modal entrance and blocking spinner animations', () => {
  const css = readFileSync(new URL('../pwa/styles.css', import.meta.url), 'utf8');
  const reduceAt = css.lastIndexOf('@media (prefers-reduced-motion: reduce)');
  for (const rule of [
    '.entry-dialog[open] { animation: entry-dialog-in',
    '.startup-loading .operation-spinner { animation: pull-refresh-spin',
  ]) assert.ok(reduceAt > css.indexOf(rule), 'reduced motion must win the cascade for ' + rule);
  const reduced = css.slice(reduceAt);
  assert.match(reduced, /\.entry-dialog\[open\].*animation: none/s);
  assert.match(reduced, /\.startup-loading \.operation-spinner\s*\{ animation: none;/);
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
  const status = document.root.querySelector('.app-status');
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
  const original = globalThis.confirm;
  try {
    globalThis.confirm = () => false;
    for (const listener of document.root.firstElementChild.listeners.get('click')) await listener({ target: trash.querySelector('svg') });
    assert.ok(document.root.querySelector('.bean-card'));
    assert.equal(document.root.querySelectorAll('h4').some(node => node.textContent === '이 원두의 추출 기록'), false);
  } finally {
    if (original === undefined) delete globalThis.confirm; else globalThis.confirm = original;
  }
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
  assert.ok(card.textContent.includes('15g · 93℃ · 물 250g'));
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
  view.bind({ submit: (...args) => calls.push(args) });
  const trash = document.root.querySelector('[data-action="delete-recipe"]');
  const original = globalThis.confirm;
  try {
    for (const confirmed of [false, true]) {
      globalThis.confirm = () => confirmed;
      for (const listener of document.root.firstElementChild.listeners.get('click')) await listener({ target: trash.querySelector('svg') });
      assert.equal(document.root.querySelector('[data-action="copy-recipe"]'), null);
    }
    assert.deepEqual(calls, [['delete-recipe', { id: RECIPE }]]);
  } finally {
    if (original === undefined) delete globalThis.confirm; else globalThis.confirm = original;
  }
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


test('home is the default and root route, with the requested hero and four menu destinations', () => {
  const document = new TestDocument();
  const view = createAppView(document);
  view.renderData({ beans: [], recipes: [], records: [] });

  assert.equal(view.currentRoute(), '/home');
  const hero = document.root.querySelector('.home-hero');
  assert.ok(hero);
  assert.match(hero.textContent, /오늘의 한 잔을 시작해 보세요\./);
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
