import test from 'node:test';
import assert from 'node:assert/strict';
import { createAppController } from '../pwa/ui/controller.mjs';
import { NotionClient } from '../pwa/data/notion-client.mjs';
import { createReadRepository } from '../pwa/data/read-repository.mjs';
import { createCommands } from '../pwa/commands/index.mjs';
import { createSubmissionState } from '../pwa/state/submission-state.mjs';
import { memoryPlatform, fakePwaNotion, testConnection } from './fixtures/pwa-environment.mjs';
import { readFile } from 'node:fs/promises';

const validRecipe = beanId => ({ name: 'V60', beanId, dose: 15, totalWater: 250, temperature: 93,
  steps: [{ time: '0:00', water: 50 }, { time: '0:30', water: 100 }, { time: '1:10', water: 100 }] });

test('the shipped page has a real UI mount point', async () => {
  const html = await readFile(new URL('../pwa/index.html', import.meta.url), 'utf8');
  assert.match(html, /id="app-root"/);
  assert.match(html, /class="connection-note" role="status"/);
});

test('controller public flows use real Notion, repository, commands and journal adapters', async () => {
  const native = memoryPlatform({ initialized: false });
  const fake = fakePwaNotion();
  const state = createSubmissionState(native);
  let route = '/beans';
  const events = [];
  const entrySuccesses = [];
  const clearedForms = [];
  const view = { showConnection: value => events.push(['connection', value]), showStatus: value => events.push(['status', value]),
    currentRoute: () => route, renderData: value => events.push(['data', value]), clearSecret() {}, clearForm: kind => clearedForms.push(kind),
    showEntrySuccess(kind) { entrySuccesses.push(kind); return true; }, setState() {} };
  const app = createAppController({ view, state, file: { readConnection: async () => null },
    uuid: () => 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    makeClient: connection => new NotionClient(connection.token, { dataSources: connection.dataSources, connectionRevision: connection.revision, fetchImpl: fake.fetch }),
    makeRepository: client => createReadRepository(client),
    makeCommands: options => createCommands(options) });
  app.bind();
  const connected = await app.connect(testConnection());
  assert.equal(connected, true);
  const bean = await app.submit('beans', { name: '에티오피아', origin: '시다마 · 테스트 농장', tastingNotes: '복숭아' });
  assert.equal(bean.status, 'succeeded');
  const recipe = await app.submit('recipes', validRecipe(bean.value.id));
  assert.equal(recipe.status, 'succeeded');
  const copied = await app.submit('copy', { recipeId: recipe.value.id, changes: { name: '복사 레시피', temperature: 91 } });
  assert.equal(copied.status, 'succeeded');
  const record = await app.submit('records', { beanId: bean.value.id, recipeId: copied.value.id,
    date: '2026-06-15', rating: '5', cupNote: '꿀, 살구' });
  assert.equal(record.status, 'succeeded');
  const beanPage = events.filter(([type]) => type === 'data').at(-1)[1];
  assert.equal(beanPage.beans[0].origin, '시다마 · 테스트 농장');
  assert.deepEqual(beanPage.recipes, [], 'the beans route does not load recipes');
  assert.deepEqual(beanPage.records, [], 'the beans route does not load records');

  route = `/recipes/${copied.value.id}`;
  await app.loadRoute(route, { force: true });
  const deadline = Date.now() + 10000;
  let latest = events.filter(([type]) => type === 'data').at(-1)[1];
  while (latest.recipes[0]?.stats?.status === 'loading' && Date.now() < deadline) {
    await new Promise(resolve => setTimeout(resolve, 25));
    latest = events.filter(([type]) => type === 'data').at(-1)[1];
  }
  assert.deepEqual(latest.recipes[0].stats, { status: 'ready', complete: true, count: 1, average: 5 });
  assert.equal(latest.records[0].snapshot.recipe.steps.length, 3);
  assert.deepEqual(entrySuccesses, ['beans', 'recipes', 'recipes', 'records']);
  assert.deepEqual(clearedForms, [], 'the view keeps each confirmed entry open for its success feedback');
  assert.ok(native.journal().operations.every(operation => operation.status === 'succeeded'));
});

test('unknown writes preserve the draft state and prevent a second UI submission', async () => {
  const native = memoryPlatform();
  const fake = fakePwaNotion();
  let clearCount = 0;
  const state = createSubmissionState(native);
  const app = createAppController({ view: { showConnection() {}, showStatus() {}, renderData() {}, clearSecret() {},
    clearForm() { clearCount++; }, setState() {} }, state, file: { readConnection: async () => null },
    makeClient: connection => new NotionClient(connection.token, { dataSources: connection.dataSources, connectionRevision: connection.revision, fetchImpl: fake.fetch }),
    makeRepository: client => createReadRepository(client), makeCommands: options => createCommands(options) });
  await app.connect(testConnection());
  fake.intercept = ({ pathname, method }) => pathname === '/v1/pages' && method === 'POST'
    ? Promise.reject(new TypeError('response lost')) : null;
  const outcome = await app.submit('beans', { name: '확인 필요' });
  assert.equal(outcome.status, 'unknown');
  assert.equal(clearCount, 0);
  const calls = fake.calls.length;
  await assert.rejects(app.submit('beans', { name: '재전송 금지' }));
  assert.equal(fake.calls.length, calls);
});

test('unknown write resolution requires explicit confirmation and a fresh read before writes resume', async () => {
  const native = memoryPlatform();
  const fake = fakePwaNotion();
  let unresolved = [];
  const state = createSubmissionState(native);
  const app = createAppController({ view: {
    showConnection() {}, showStatus() {}, renderData() {}, clearSecret() {}, clearForm() {}, setState() {},
    showUnresolved(items) { unresolved = items; },
  }, state, file: { readConnection: async () => JSON.parse(native.files.get('connection.json')) },
  makeClient: connection => new NotionClient(connection.token, { dataSources: connection.dataSources,
    connectionRevision: connection.revision, fetchImpl: fake.fetch }),
  makeRepository: client => createReadRepository(client),
  makeCommands: options => createCommands(options) });
  await app.connect(testConnection());
  fake.intercept = ({ pathname, method }) => pathname === '/v1/pages' && method === 'POST'
    ? Promise.reject(new TypeError('response lost')) : null;

  const outcome = await app.submit('beans', { name: '확인 필요' });

  assert.equal(outcome.status, 'unknown');
  assert.equal(unresolved.length, 1);
  assert.deepEqual({ kind: unresolved[0].kind, status: unresolved[0].status }, { kind: 'beans', status: 'unknown' });
  assert.equal('key' in unresolved[0], false);
  await assert.rejects(unresolved[0].resolve({ decision: 'not-saved', originalConfirmed: false, pageIds: [] }));
  assert.equal(native.journal().operations[0].status, 'unknown');

  await unresolved[0].resolve({ decision: 'not-saved', originalConfirmed: true, pageIds: [] });

  assert.equal(native.journal().operations[0].status, 'failed');
  assert.equal(unresolved.length, 0);
  fake.intercept = null;
  assert.equal((await app.submit('beans', { name: '확인 후 재시도' })).status, 'succeeded');
});

test('a second native UI client waits for startup lock release and reads the saved connection', async () => {
  const native = memoryPlatform();
  let releaseLeader;
  let markLeaderEntered;
  const leaderEntered = new Promise(resolve => { markLeaderEntered = resolve; });
  const leaderState = createSubmissionState(native);
  const followerState = createSubmissionState(native);
  const createClient = (state, verify) => createAppController({ view: {
    currentRoute() { return '/beans'; },
    showConnection() {}, showStatus() {}, renderData() {}, showUnresolved() {}, setState() {},
  }, state,
  file: { readConnection: async () => JSON.parse(native.files.get('connection.json')) },
  makeClient: () => ({ async verify() { await verify(); } }),
  makeRepository: () => ({ async listBeans() { return { items: [], nextCursor: null, hasMore: false, complete: true }; },
    async readAll() { return { beans: [], bags: [], recipes: [], records: [] }; } }),
  makeCommands: () => ({}) });
  const leader = createClient(leaderState, () => new Promise(resolve => {
    releaseLeader = resolve;
    markLeaderEntered();
  }));
  const follower = createClient(followerState, async () => {});
  const leaderReady = leader.initialize();
  await leaderEntered;
  const followerReady = follower.initialize();
  setTimeout(() => releaseLeader(), 20);

  assert.equal(await followerReady, true);
  assert.equal(await leaderReady, true);
  assert.equal(follower.getState().connected, true);
  assert.equal((await follower.refresh()).recipes.length, 0);
});

test('legacy bag journals stay unresolved after startup and never auto-send', async () => {
  for (const [kind, status] of [['bags', 'processing'], ['delete-bag', 'unknown']]) {
    const native = memoryPlatform();
    const operation = {
      key: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', kind,
      connectionRevision: testConnection().revision,
      targetFingerprint: 'a'.repeat(64), payloadFingerprint: 'b'.repeat(64),
      status, createdPages: [], updatedAt: '2026-10-26T00:00:00.000Z',
    };
    if (kind === 'delete-bag') operation.deleteTarget = {
      kind: 'bags', id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', archiveState: 'unknown',
    };
    native.files.set('submission-journal.json', JSON.stringify({ schemaVersion: 1,
      activeConnectionRevision: testConnection().revision, connectionGuard: null, operations: [operation] }));
    const fake = fakePwaNotion();
    const unresolved = [];
    const state = createSubmissionState(native);
    const app = createAppController({ view: {
      currentRoute() { return '/beans'; }, showConnection() {}, showStatus() {}, renderData() {}, clearSecret() {}, setState() {},
      showUnresolved(items) { unresolved.push(...items); },
    }, state, file: { readConnection: async () => JSON.parse(native.files.get('connection.json')) },
    makeClient: connection => new NotionClient(connection.token, { dataSources: connection.dataSources,
      connectionRevision: connection.revision, fetchImpl: fake.fetch }),
    makeRepository: client => createReadRepository(client),
    makeCommands: options => createCommands(options) });

    assert.equal(await app.initialize(), true);
    assert.equal(native.journal().operations[0].status, 'unknown');
    assert.deepEqual(unresolved.map(item => [item.kind, item.status]), [[kind, 'unknown']]);
    assert.equal(app.getState().unresolved, true);
    await assert.rejects(app.submit('bags', { name: '자동 재전송 금지' }), error => error.code === 'unresolved-operation');
    assert.equal(fake.calls.some(call => (call.pathname === '/v1/pages' && call.method === 'POST') ||
      (call.pathname.startsWith('/v1/pages/') && call.method === 'PATCH')), false);
    assert.equal(native.journal().operations[0].status, 'unknown');
  }
});

test('saved resolution rejects a recipe parent that is absent from the complete fresh projection', async () => {
  const native = memoryPlatform();
  const fake = fakePwaNotion();
  const state = createSubmissionState(native);
  const app = createAppController({ view: {}, state,
    file: { readConnection: async () => JSON.parse(native.files.get('connection.json')) },
    makeClient: connection => new NotionClient(connection.token, { dataSources: connection.dataSources,
      connectionRevision: connection.revision, fetchImpl: fake.fetch }),
    makeRepository: client => createReadRepository(client),
    makeCommands: options => createCommands(options) });
  await app.connect(testConnection());
  const bean = await app.submit('beans', { name: 'partial recipe bean' });
  let creates = 0;
  fake.intercept = ({ pathname, method }) => {
    if (pathname === '/v1/pages' && method === 'POST' && ++creates === 2) return Response.json({}, { status: 400 });
    if (method === 'PATCH') return Response.json({}, { status: 403 });
    return null;
  };

  const outcome = await app.submit('recipes', { name: 'incomplete recipe', beanId: bean.value.id,
    dose: 15, totalWater: 250, temperature: 93, steps: [{ time: '0:00', water: 250 }] });

  assert.equal(outcome.status, 'partial');
  const operation = native.journal().operations.find(item => item.status === 'partial');
  assert.equal(operation.createdPages.length, 1);
  fake.intercept = null;
  await assert.rejects(app.resolveOperation(operation.key, { originalConfirmed: true, decision: 'saved' }));
  assert.equal(native.journal().operations.find(item => item.key === operation.key).status, 'partial');
  assert.equal(app.getState().unresolved, true);
});
