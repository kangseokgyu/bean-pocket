import test from 'node:test';
import assert from 'node:assert/strict';
import { createAppView } from '../../../pwa/ui/view.mjs';

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


import { createAppController } from '../../../pwa/ui/controller.mjs';
import { validateRecipe } from '../../../lib/domain.mjs';

// Independent expected-behavior regressions. Reuses only the existing test DOM double.
function connected(document) {
  const view = createAppView(document);
  const context = {
    inspect: async () => ({ initialized: true, blocked: false }),
    readJournal: async () => ({ operations: [], connectionGuard: null }),
    beginConnectionChange: async () => {}, commitConnectionChange: async () => {},
  };
  const app = createAppController({ view, state: { withWriteLock: action => action(context) },
    file: {}, makeClient: () => ({ verify: async () => true }),
    makeRepository: () => ({ readAll: async () => data(), async listBeans() {
      return { items: data().beans, nextCursor: null, hasMore: false, complete: true };
    } }), makeCommands: () => ({}),
    uuid: () => 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  });
  app.bind();
  return { app, view };
}
const connection = { token: 'test-only-token', dataSources: {} };

test('C3-R1 checked connection-recovery checkbox reaches confirmCurrent', async () => {
  const document = new TestDocument();
  const view = createAppView(document);
  let confirmations = 0;
  view.bind({ confirmCurrent: async value => { assert.equal(value, true); confirmations++; } });
  view.showConnection({ connected: false, needsRecovery: true });
  const check = document.root.querySelector('input[name="originalConfirmed"]');
  check.checked = true;
  const target = document.root.querySelector('button[data-action="confirm-connection"]');
  const page = document.root.firstElementChild;
  for (const listener of page.listeners.get('click')) await listener({ target });
  assert.equal(confirmations, 1, 'checked recovery must invoke controller fresh verification');
});

test('C3-R2 successful token replacement preserves the active unsaved product form', async () => {
  const document = new TestDocument();
  const { app, view } = connected(document);
  view.renderRoute('/beans');
  await app.connect(connection);
  document.root.querySelector('form[data-form="beans"]').elements.name.value = 'must survive token replacement';
  app.setDirty(true, 'beans');
  await app.connect(connection);
  assert.equal(document.root.querySelector('form[data-form="beans"]').elements.name.value,
    'must survive token replacement');
});

test('C3-R2b hidden drafts must still prevent update freezing after token replacement', async () => {
  const document = new TestDocument();
  const { app, view } = connected(document);
  view.renderRoute('/beans');
  await app.connect(connection);
  document.root.querySelector('form[data-form="beans"]').elements.name.value = 'hidden unsaved draft';
  app.setDirty(true, 'beans');
  view.renderRoute('/bags');
  await app.connect(connection);
  view.renderRoute('/beans');
  assert.equal(document.root.querySelector('form[data-form="beans"]').elements.name.value, 'hidden unsaved draft');
  assert.equal(app.getState().dirty, true, 'surviving hidden draft must stay dirty');
  assert.equal(app.setFrozen(true), false);
});

test('C3-R3 positive sub-cent values accepted by domain remain valid UI input', () => {
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
      `${name}: native rangeUnderflow blocks a contract-valid positive decimal`);
  }
});

import { NotionClient } from '../../../pwa/data/notion-client.mjs';
import { createReadRepository } from '../../../pwa/data/read-repository.mjs';
import { createCommands } from '../../../pwa/commands/index.mjs';
import { createSubmissionState } from '../../../pwa/state/submission-state.mjs';
import { memoryPlatform, fakePwaNotion, testConnection } from '../../../test/fixtures/pwa-environment.mjs';

function nativeHarness() {
  const native = memoryPlatform();
  const fake = fakePwaNotion();
  const app = createAppController({ view: {}, state: createSubmissionState(native),
    file: { readConnection: async () => JSON.parse(native.files.get('connection.json')) },
    makeClient: connection => new NotionClient(connection.token, { dataSources: connection.dataSources,
      connectionRevision: connection.revision, fetchImpl: fake.fetch }),
    makeRepository: client => createReadRepository(client), makeCommands: options => createCommands(options) });
  return { native, fake, app };
}

test('C3-R4 incomplete partial recipe cannot be confirmed as fully saved', async () => {
  const { native, fake, app } = nativeHarness();
  await app.connect(testConnection());
  const bean = await app.submit('beans', { name: 'partial recipe bean' });
  let creates = 0;
  fake.intercept = ({ pathname, method }) => {
    if (pathname === '/v1/pages' && method === 'POST' && ++creates === 2) return Response.json({}, { status: 400 });
    if (method === 'PATCH') return Response.json({}, { status: 403 });
    return null;
  };
  const recipe = await app.submit('recipes', { name: 'incomplete recipe', beanId: bean.value.id,
    dose: 15, totalWater: 250, temperature: 93, steps: [{ time: '0:00', water: 250 }] });
  assert.equal(recipe.status, 'partial');
  const operation = native.journal().operations.find(op => op.status === 'partial');
  assert.equal(operation.createdPages.length, 1);
  fake.intercept = null;
  const connection = JSON.parse(native.files.get('connection.json'));
  const client = new NotionClient(connection.token, { dataSources: connection.dataSources,
    connectionRevision: connection.revision, fetchImpl: fake.fetch });
  assert.equal((await createReadRepository(client).readAll()).recipes.length, 0,
    'parent without its step is excluded by real repository');
  await assert.rejects(app.resolveOperation(operation.key, { originalConfirmed: true, decision: 'saved' }),
    'saved resolution must reject an incomplete recipe rather than persist succeeded');
});

test('C3-native fresh-read failure keeps unknown journal locked', async () => {
  const { native, fake, app } = nativeHarness();
  await app.connect(testConnection());
  fake.intercept = ({ pathname, method }) => pathname === '/v1/pages' && method === 'POST'
    ? Promise.reject(new TypeError('lost synthetic response')) : null;
  await app.submit('beans', { name: 'unknown bean' });
  const operation = native.journal().operations.find(op => op.status === 'unknown');
  fake.intercept = () => Response.json({}, { status: 503 });
  await assert.rejects(app.resolveOperation(operation.key, { originalConfirmed: true, decision: 'not-saved' }));
  assert.equal(native.journal().operations.find(op => op.key === operation.key).status, 'unknown');
  assert.equal(app.getState().unresolved, true);
});
