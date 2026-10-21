import test from 'node:test';
import assert from 'node:assert/strict';
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
    this.selected = false;
    this.text = '';
    this.listeners = new Map();
    this.style = { setProperty(name, value) { this[name] = value; } };
  }
  append(...nodes) {
    for (const node of nodes) {
      node.parentElement = this;
      this.children.push(node);
    }
  }
  replaceChildren(...nodes) {
    for (const child of this.children) child.parentElement = null;
    this.children = [];
    this.append(...nodes);
  }
  set textContent(value) { this.text = String(value); this.replaceChildren(); }
  get textContent() { return this.text + this.children.map(child => child.textContent).join(''); }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
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
    const tag = selector.match(/^[a-z]+/i)?.[0]?.toLowerCase();
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
  constructor() { this.root = new TestElement('main', this); this.root.id = 'app-root'; }
  createElement(tagName) { return new TestElement(tagName, this); }
  createElementNS(namespace, tagName) {
    const node = new TestElement(tagName, this);
    node.namespaceURI = namespace;
    return node;
  }
  querySelector(selector) { return selector === '#app-root' ? this.root : this.root.querySelector(selector); }
  querySelectorAll(selector) { return this.root.querySelectorAll(selector); }
}

const data = () => ({
  beans: [{ id: BEAN, name: '원두 <안전>', origin: '시다마 · 테스트 농장', roaster: '로스터리', variety: '74110', process: '워시드', tastingNotes: '복숭아' }],
  bags: [{ id: '22222222-2222-4222-8222-222222222222', name: '6월 봉지', beanId: BEAN, roastedOn: '2026-06-01' }],
  recipes: [{ id: RECIPE, name: 'V60', beanId: BEAN, dripper: 'V60', dose: 15, grind: '중간보다 가늘게', grinder: 'Comandante', grinderSetting: '24클릭', microns: 450, temperature: 93, totalWater: 250,
    stats: { count: 0, average: null }, steps: [
      { id: '44444444-4444-4444-8444-444444444444', name: '뜸', seconds: 0, interval: 0, water: 50, cumulativeWater: 50 },
      { id: '55555555-5555-4555-8555-555555555555', name: '붓기', seconds: 70, interval: 40, water: 200, cumulativeWater: 250 },
    ] }],
  records: [{ id: '66666666-6666-4666-8666-666666666666', recipeId: RECIPE, date: '2026-06-15', rating: 5, cupNote: '꿀, 살구', snapshot: { dripper: 'V60', dose: 15, temperature: 93, totalWater: 250, steps: [{ name: '뜸', seconds: 0, water: 50, cumulativeWater: 50 }] } }],
});

const CONNECTION = { token: 'test-only-token', dataSources: {} };

test('connection settings open only after no saved connection is found', () => {
  const document = new TestDocument();
  const view = createAppView(document);
  const panel = document.root.querySelector('.connection-panel');
  assert.equal(panel.hidden, true);
  view.showConnection({ connected: false, retryInitialization: true });
  assert.equal(document.root.querySelector('.connection-details').hidden, true);
  view.showConnection({ connected: false });
  assert.equal(panel.hidden, false);
  assert.equal(document.root.querySelector('.connection-details').open, true);
});

test('saved connection leaves a header icon that toggles settings without losing input', async () => {
  const document = new TestDocument();
  const tools = document.createElement('div');
  const querySelector = document.querySelector.bind(document);
  document.querySelector = selector => selector === '#connection-tools' ? tools : querySelector(selector);
  const view = createAppView(document);
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
  assert.equal(token.value, 'unsaved-test-token');
  view.showConnection({ connected: true });
  assert.equal(panel.hidden, true, 'successful save collapses settings again');
  view.showConnection({ connected: false, needsRecovery: true });
  assert.equal(panel.hidden, false);
  assert.equal(panel.querySelector('.repair-panel').hidden, false);
});

test('successful status messages stay visible for three seconds then hide', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const document = new TestDocument();
  const view = createAppView(document);
  const status = document.root.querySelector('.app-status');
  for (const type of ['ready', 'connected', 'saved', 'resolved', 'cancelled']) {
    view.showStatus({ type, message: '완료했습니다.' });
    assert.equal(status.hidden, false);
    assert.equal(status.textContent, '완료했습니다.');
    t.mock.timers.tick(2999);
    assert.equal(status.hidden, false);
    t.mock.timers.tick(1);
    assert.equal(status.hidden, true, type);
  }
});

test('errors, recovery notices and pending work stay visible after replacing success', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const document = new TestDocument();
  const view = createAppView(document);
  const status = document.root.querySelector('.app-status');
  for (const type of ['error', 'read-error', 'connection-error', 'validation-error', 'resolution-error',
    'saved-read-error', 'unknown', 'partial', 'failed', 'resolution-required', 'startup-busy',
    'disconnected', 'checking', 'saving']) {
    view.showStatus({ type: 'ready', message: '완료' });
    t.mock.timers.tick(1000);
    view.showStatus({ type, message: '확인이 필요합니다.' });
    t.mock.timers.tick(10000);
    assert.equal(status.hidden, false, type);
    assert.equal(status.textContent, '확인이 필요합니다.');
  }
});

test('a new success gets a full display interval and empty messages hide immediately', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const document = new TestDocument();
  const view = createAppView(document);
  const status = document.root.querySelector('.app-status');
  view.showStatus({ type: 'saved', message: '저장했습니다.' });
  t.mock.timers.tick(2000);
  view.showStatus({ type: 'ready', message: '조회했습니다.' });
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
    makeRepository: () => ({ async readAll() { return data(); } }),
    makeCommands: () => ({}),
    uuid: () => 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  });
}

test('draft values survive tab navigation and a fresh data render', () => {
  const document = new TestDocument();
  const view = createAppView(document);
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
  const view = createAppView(document);
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

test('resolution controls follow the native journal page-list contract', () => {
  const document = new TestDocument();
  const view = createAppView(document);

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
  const view = createAppView(document);
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
  const view = createAppView(document);
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
    const view = createAppView(document);
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
  const view = createAppView(document);
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
  const view = createAppView(document);
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
  const view = createAppView(document);
  const app = controllerFor(view);
  await app.connect(CONNECTION);
  document.root.querySelector('form[data-form="beans"]').elements.name.value = 'active unsaved bean';
  app.setDirty(true, 'beans');

  await app.connect(CONNECTION);

  assert.equal(document.root.querySelector('form[data-form="beans"]').elements.name.value, 'active unsaved bean');
});

test('successful connection replacement preserves hidden drafts and their dirty signal', async () => {
  const document = new TestDocument();
  const view = createAppView(document);
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
  const view = createAppView(document);
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

test('recipe records distinguish selected bags, no selection, and unavailable bags', () => {
  const document = new TestDocument();
  const view = createAppView(document);
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
  const labels = detail.querySelectorAll('.record-bag').map(node => node.textContent);
  assert.deepEqual(labels, [
    '원두 봉지: 6월 봉지', '원두 봉지: 7월 봉지',
    '원두 봉지: 선택 안 함', '원두 봉지: 조회할 수 없는 봉지',
  ]);
});

test('bean creation starts hidden, opens from the plus button, and closes on cancel', async () => {
  const document = new TestDocument();
  const view = createAppView(document);
  const dirty = [];
  view.bind({ setDirty: (...args) => dirty.push(args) });
  view.renderData(data());
  const click = async target => {
    for (const listener of document.root.firstElementChild.listeners.get('click')) await listener({ target });
  };
  let form = document.root.querySelector('form[data-form="beans"]');
  assert.equal(form.hidden, true);
  let add = document.root.querySelector('[data-action="show-bean-form"]');
  assert.ok(add);
  assert.equal(add.getAttribute('aria-label'), '새 원두 추가');
  assert.equal(add.getAttribute('aria-controls'), form.id);
  assert.equal(add.getAttribute('aria-expanded'), 'false');
  await click(add);
  assert.equal(form.hidden, false);
  assert.equal(add.getAttribute('aria-expanded'), 'true');
  assert.equal(dirty.length, 0);
  form.elements.name.value = '보존할 원두';
  view.renderData(data());
  view.renderRoute('/bags');
  view.renderRoute('/beans');
  form = document.root.querySelector('form[data-form="beans"]');
  assert.equal(form.hidden, false);
  assert.equal(form.elements.name.value, '보존할 원두');
  await click(form.querySelector('[data-action="cancel-form"]'));
  form = document.root.querySelector('form[data-form="beans"]');
  assert.equal(form.hidden, true);
  assert.equal(form.elements.name.value, '');
  assert.deepEqual(dirty, [[false, 'beans']]);
});

test('bag creation starts hidden, opens from the plus button, and closes on cancel', async () => {
  const document = new TestDocument();
  const view = createAppView(document);
  const dirty = [];
  view.bind({ setDirty: (...args) => dirty.push(args) });
  view.renderData(data());
  view.renderRoute('/bags');
  const click = async target => {
    for (const listener of document.root.firstElementChild.listeners.get('click')) await listener({ target });
  };
  let form = document.root.querySelector('form[data-form="bags"]');
  assert.equal(form.hidden, true);
  let add = document.root.querySelector('[data-action="show-bag-form"]');
  assert.ok(add);
  assert.equal(add.getAttribute('aria-label'), '새 봉지 추가');
  assert.equal(add.getAttribute('aria-controls'), form.id);
  assert.equal(add.getAttribute('aria-expanded'), 'false');
  await click(add);
  assert.equal(form.hidden, false);
  assert.equal(add.getAttribute('aria-expanded'), 'true');
  assert.equal(dirty.length, 0);
  form.elements.name.value = '보존할 봉지';
  view.renderData(data());
  view.renderRoute('/beans');
  view.renderRoute('/bags');
  form = document.root.querySelector('form[data-form="bags"]');
  assert.equal(form.hidden, false);
  assert.equal(form.elements.name.value, '보존할 봉지');
  await click(form.querySelector('[data-action="cancel-form"]'));
  form = document.root.querySelector('form[data-form="bags"]');
  assert.equal(form.hidden, true);
  assert.equal(form.elements.name.value, '');
  assert.deepEqual(dirty, [[false, 'bags']]);
  await click(document.root.querySelector('[data-action="show-bag-form"]'));
  view.setState({ pending: true });
  assert.equal(document.root.querySelector('[data-action="show-bag-form"]').disabled, true);
  view.setState({ pending: false });
  view.clearDraft('bags');
  assert.equal(document.root.querySelector('form[data-form="bags"]').hidden, true);
  assert.equal(document.root.querySelector('[data-action="show-bag-form"]').getAttribute('aria-expanded'), 'false');
  view.renderData({ ...data(), bags: [] });
  assert.equal(document.root.querySelector('.empty-state').textContent, '등록된 봉지가 없습니다.');
});

test('recipe creation opens from plus, preserves drafts, and closes on cancel', async () => {
  const document = new TestDocument();
  const view = createAppView(document);
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
  assert.equal(form.hidden, true);
  const add = document.root.querySelector('[data-action="show-recipe-form"]');
  assert.equal(add.getAttribute('aria-label'), '새 레시피 추가');
  assert.equal(add.getAttribute('aria-controls'), form.id);
  assert.equal(add.getAttribute('aria-expanded'), 'false');
  assert.ok(document.root.querySelector('.recipe-card'));
  await click(add);
  assert.equal(form.hidden, false);
  assert.equal(add.getAttribute('aria-expanded'), 'true');
  assert.equal(dirty.length, 0);
  form.elements.name.value = '보존할 레시피';
  form.querySelector('[name="stepName"]').value = '뜸 보존';
  view.renderData(data());
  view.renderRoute('/beans');
  view.renderRoute('/recipes');
  form = document.root.querySelector('form[data-form="recipes"]');
  assert.equal(form.hidden, false);
  assert.equal(form.elements.name.value, '보존할 레시피');
  assert.equal(form.querySelector('[name="stepName"]').value, '뜸 보존');
  await click(form.querySelector('[data-action="cancel-form"]'));
  form = document.root.querySelector('form[data-form="recipes"]');
  assert.equal(form.hidden, true);
  assert.equal(form.elements.name.value, '');
  assert.deepEqual(dirty, [[false, 'recipes']]);
  view.renderRoute('/recipes/new');
  assert.equal(document.root.querySelector('form[data-form="recipes"]').hidden, false);
  view.setState({ pending: true });
  assert.equal(document.root.querySelector('[data-action="show-recipe-form"]').disabled, true);
  view.setState({ pending: false });
  view.clearDraft('recipes');
  assert.equal(document.root.querySelector('form[data-form="recipes"]').hidden, true);
  view.renderData({ ...data(), recipes: [] });
  assert.equal(document.root.querySelector('.empty-state').textContent, '등록된 레시피가 없습니다.');
  view.renderRoute(`/recipes/${RECIPE}`);
  assert.equal(document.root.querySelector('[data-action="show-recipe-form"]'), null);
});

test('record creation opens from plus, preserves drafts, and closes on cancel or save', async () => {
  const document = new TestDocument();
  const view = createAppView(document);
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
  assert.equal(form.hidden, true);
  const add = document.root.querySelector('[data-action="show-record-form"]');
  assert.equal(add.getAttribute('aria-label'), '새 추출 기록 추가');
  assert.equal(add.querySelector('[aria-hidden="true"]').textContent, '+');
  assert.equal(add.getAttribute('aria-controls'), form.id);
  assert.equal(add.getAttribute('aria-expanded'), 'false');
  await click(add);
  assert.equal(form.hidden, false);
  assert.equal(add.getAttribute('aria-expanded'), 'true');
  assert.equal(dirty.length, 0);
  form.elements.cupNote.value = '보존할 컵노트';
  view.renderData(data());
  view.renderRoute('/beans');
  view.renderRoute('/records');
  form = document.root.querySelector('form[data-form="records"]');
  assert.equal(form.hidden, false);
  assert.equal(form.elements.cupNote.value, '보존할 컵노트');
  await click(form.querySelector('[data-action="cancel-form"]'));
  form = document.root.querySelector('form[data-form="records"]');
  assert.equal(form.hidden, true);
  assert.equal(form.elements.cupNote.value, '');
  assert.deepEqual(dirty, [[false, 'records']]);
  view.renderRoute('/records/new');
  assert.equal(document.root.querySelector('form[data-form="records"]').hidden, false);
  view.setState({ pending: true });
  assert.equal(document.root.querySelector('[data-action="show-record-form"]').disabled, true);
  view.setState({ pending: false });
  view.clearDraft('records');
  assert.equal(document.root.querySelector('form[data-form="records"]').hidden, true);
  assert.equal(document.root.querySelector('[data-action="show-record-form"]').getAttribute('aria-expanded'), 'false');
  view.renderRoute(`/recipes/${RECIPE}`);
  await click(document.root.querySelector('[data-action="new-record"]'));
  form = document.root.querySelector('form[data-form="records"]');
  assert.equal(form.hidden, false);
  assert.equal(form.elements.recipeId.value, RECIPE);
});

test('refresh uses an accessible icon button and retains the refresh action', async () => {
  const document = new TestDocument();
  const view = createAppView(document);
  let refreshes = 0;
  view.bind({ refresh: async () => { refreshes++; } });
  view.renderData(data());
  const refresh = document.root.querySelector('[data-action="refresh"]');
  assert.equal(refresh.getAttribute('aria-label'), '최신 목록 새로고침');
  assert.equal(refresh.querySelector('[aria-hidden="true"]').textContent, '↻');
  for (const listener of document.root.firstElementChild.listeners.get('click')) await listener({ target: refresh });
  assert.equal(refreshes, 1);
  view.setState({ pending: true });
  assert.equal(refresh.disabled, true);
  assert.equal(document.root.querySelector('[data-action="show-bean-form"]').disabled, true);
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
  const view = createAppView(document);
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
  const target = env.document.root.querySelector('[data-action="refresh"]');
  assert.equal(env.fire('touchstart', 20, 100, { target }).defaultPrevented, false);
  assert.equal(env.fire('touchmove', 20, 105, { target }).defaultPrevented, false);
  assert.equal(env.fire('touchend', 20, 105, { target }).defaultPrevented, false);
  for (const listener of env.document.root.firstElementChild.listeners.get('click')) await listener({ target });
  assert.equal(env.reads, 1);
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


test('navigation uses four distinct decorative icons with accessible menu names', () => {
  const document = new TestDocument();
  createAppView(document);
  const items = document.root.querySelector('nav.tabs').querySelectorAll('button');
  const expected = [['beans', '원두'], ['bags', '봉지'], ['recipes', '레시피'], ['records', '추출 기록']];
  assert.equal(items.length, expected.length);
  const shapes = [];
  items.forEach((item, index) => {
    const [key, title] = expected[index];
    assert.equal(item.dataset.route, `/${key}`);
    assert.equal(item.dataset.action, 'navigate');
    assert.equal(item.type, 'button');
    assert.equal(item.getAttribute('aria-label'), title);
    assert.equal(item.title, title);
    assert.equal(item.textContent, '', 'visible text is replaced by an icon');
    const icon = item.querySelector('svg');
    assert.ok(icon, `${key} has an SVG icon`);
    assert.equal(icon.namespaceURI, 'http://www.w3.org/2000/svg');
    assert.equal(icon.getAttribute('aria-hidden'), 'true');
    assert.equal(icon.getAttribute('focusable'), 'false');
    shapes.push(icon.querySelector('path').getAttribute('d'));
  });
  assert.equal(new Set(shapes).size, 4, 'menus have distinguishable shapes');
});
