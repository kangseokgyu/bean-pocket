import test from 'node:test';
import assert from 'node:assert/strict';
import { createAppController } from '../pwa/ui/controller.mjs';
import { NotionClient } from '../pwa/data/notion-client.mjs';
import { createReadRepository } from '../pwa/data/read-repository.mjs';
import { createCommands } from '../pwa/commands/index.mjs';
import { createSubmissionState } from '../pwa/state/submission-state.mjs';
import { DATA_SOURCES, memoryPlatform, fakePwaNotion, testConnection } from './fixtures/pwa-environment.mjs';
import { readFile } from 'node:fs/promises';

const validRecipe = beanId => ({ name: 'V60', beanId, dose: 15, totalWater: 250, temperature: 93,
  steps: [{ time: '0:00', water: 50 }, { time: '0:30', water: 100 }, { time: '1:10', water: 100 }] });

function startupApp({ native = memoryPlatform(), fake = fakePwaNotion(), route = '/home', readConnection } = {}) {
  const connectionStates = [];
  const statuses = [];
  const entrySuccesses = [];
  const deleteResults = [];
  let unresolvedOperations = [];
  const rendered = [];
  const searchOptions = [];
  let currentRoute = route;
  const state = createSubmissionState(native);
  const readSavedConnection = readConnection ?? (async () => {
    const source = native.files.get('connection.json');
    return source == null ? null : JSON.parse(source);
  });
  const app = createAppController({ view: {
    currentRoute() { return currentRoute; },
    showConnection(value) { connectionStates.push(value); },
    showStatus(value) { statuses.push(value); },
    renderData(value) { rendered.push(value); }, setSearchOptions(...args) { searchOptions.push(args); }, setState() {}, showUnresolved(items) { unresolvedOperations = items; },
    showEntrySuccess(kind) { entrySuccesses.push(kind); return true; },
    showDeleteResult(result) { deleteResults.push(result); },
  }, state, file: { readConnection: readSavedConnection },
  makeClient: connection => new NotionClient(connection.token, { dataSources: connection.dataSources,
    connectionRevision: connection.revision, fetchImpl: fake.fetch }),
  makeRepository: client => createReadRepository(client),
  makeCommands: options => createCommands(options) });
  return { app, native, fake, connectionStates, statuses, entrySuccesses, deleteResults, rendered, searchOptions,
    get unresolvedOperations() { return unresolvedOperations; },
    setRoute(value) { currentRoute = value; } };
}

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

test('record replay loads the saved actual snapshot even when its source recipe was deleted', async () => {
  const setup = startupApp({ route: '/records' });
  const { app, fake, setRoute } = setup;
  await app.connect(testConnection());
  const bean = await app.submit('beans', { name: '케냐', origin: '키리냐가' });
  const recipe = await app.submit('recipes', validRecipe(bean.value.id));
  const actualRecipe = { ...validRecipe(bean.value.id), name: 'V60 조정', dose: 18, temperature: 89 };
  const saved = await app.submit('brews', { beanId: bean.value.id, sourceRecipeId: recipe.value.id,
    sourceRecordId: null, actualRecipe, date: '2026-11-04', rating: '4.3', cupNote: '자두' });
  assert.equal(saved.status, 'succeeded');
  const sourceRow = fake.rows.find(row => row.id === recipe.value.id);
  sourceRow.in_trash = true;

  const route = `/brew/run?recordId=${encodeURIComponent(saved.value.id)}`;
  setRoute(route);
  const replay = await app.loadRoute(route, { force: true });

  assert.equal(replay.screen.error, undefined, 'deleted source template does not block replay');
  assert.equal(replay.beans[0].id, bean.value.id, 'bean identity comes from the saved snapshot');
  assert.equal(replay.records[0].id, saved.value.id);
  assert.equal(replay.records[0].snapshot.recipe.dose, 18);
  assert.equal(replay.records[0].snapshot.recipe.temperature, 89);
  assert.equal(replay.records[0].snapshot.recipe.name, 'V60 조정');
});

test('source and result pair loads directly when the source record is outside the current page', async () => {
  const setup = startupApp({ route: '/beans' });
  const { app, fake, setRoute } = setup;
  await app.connect(testConnection());
  const bean = await app.submit('beans', { name: '두 기록 비교 원두' });
  const recipe = await app.submit('recipes', validRecipe(bean.value.id));
  const source = await app.submit('brews', { beanId: bean.value.id, sourceRecipeId: recipe.value.id,
    sourceRecordId: null, actualRecipe: validRecipe(bean.value.id), date: '2026-11-01', rating: '4.1', cupNote: '자두' });
  const result = await app.submit('brews', { beanId: bean.value.id, sourceRecipeId: recipe.value.id,
    sourceRecordId: source.value.id, actualRecipe: { ...validRecipe(bean.value.id), dose: 18 },
    date: '2026-11-04', rating: '4.6', cupNote: '복숭아' });
  fake.intercept = async call => {
    if (call.pathname !== `/v1/data_sources/${DATA_SOURCES.records}/query` || call.method !== 'POST') return null;
    return Response.json({ object: 'list', results: fake.rows.filter(row => row.parent.data_source_id === DATA_SOURCES.records &&
      row.id !== source.value.id), has_more: false, next_cursor: null });
  };

  const route = `/records?compareSourceRecordId=${source.value.id}&compareRecordId=${result.value.id}`;
  setRoute(route);
  const page = await app.loadRoute(route, { force: true });

  assert.ok(page.recordInsights.comparisonRecords.some(record => record.id === source.value.id),
    'the source record is included for the requested pair even though the listing page omitted it');
  assert.ok(page.recordInsights.comparisonRecords.some(record => record.id === result.value.id));
  assert.ok(fake.calls.some(call => call.pathname === `/v1/pages/${source.value.id}` && call.method === 'GET'),
    'the source snapshot is checked by direct record ID lookup');
});

test('successful entity writes keep inline completion and omit saved or post-write loaded toasts', async () => {
  const setup = startupApp({ route: '/beans' });
  const { app, statuses, entrySuccesses, deleteResults, setRoute } = setup;
  await app.connect(testConnection());
  assert.ok(statuses.some(status => status.type === 'connected'), 'connection success keeps its own notice');
  statuses.length = 0;
  await app.refresh();
  assert.ok(statuses.some(status => status.type === 'loaded'), 'a user requested refresh still announces completion');

  const completedToastTypes = new Set(['saved', 'loaded']);
  const completionAnnouncements = [];
  const submitSuccessfully = async (label, kind, payload) => {
    statuses.length = 0;
    const result = await app.submit(kind, payload);
    assert.equal(result.status, 'succeeded', `${label} succeeds`);
    completionAnnouncements.push([label, statuses.filter(status => completedToastTypes.has(status.type))]);
    return result;
  };

  const bean = await submitSuccessfully('bean creation', 'beans', { name: '토스트 없는 원두' });
  setRoute('/recipes/new');
  const recipe = await submitSuccessfully('recipe save after route change', 'recipes', validRecipe(bean.value.id));
  const copied = await submitSuccessfully('recipe copy', 'copy', {
    recipeId: recipe.value.id, changes: { name: '토스트 없는 복사 레시피' },
  });
  setRoute('/records/new');
  const record = await submitSuccessfully('record save after route change', 'records', {
    beanId: bean.value.id, recipeId: copied.value.id, date: '2026-06-15', rating: '5', cupNote: '꿀, 살구',
  });

  setRoute('/records');
  await submitSuccessfully('record deletion', 'delete-record', { id: record.value.id });
  setRoute('/recipes');
  await submitSuccessfully('copied recipe deletion', 'delete-recipe', { id: copied.value.id });
  await submitSuccessfully('recipe deletion', 'delete-recipe', { id: recipe.value.id });
  setRoute('/beans');
  await submitSuccessfully('bean deletion', 'delete-bean', { id: bean.value.id });

  assert.deepEqual(entrySuccesses, ['beans', 'recipes', 'recipes', 'records'],
    'inline success feedback remains active for entry saves and recipe copies');
  assert.deepEqual(deleteResults.map(result => result.status), ['succeeded', 'succeeded', 'succeeded', 'succeeded'],
    'delete confirmation success feedback remains active for every entity');
  assert.deepEqual(completionAnnouncements.flatMap(([label, notices]) => notices.map(notice => ({ label, type: notice.type }))), [],
    'entity operations do not show saved or automatic loaded completion toasts');
});

test('successful write refetch failures keep save and delete recovery notices', async () => {
  const setup = startupApp({ route: '/beans' });
  const { app, fake, statuses } = setup;
  await app.connect(testConnection());
  statuses.length = 0;

  let created = false;
  fake.intercept = ({ pathname, method }) => {
    if (created && method === 'POST' && pathname.startsWith('/v1/data_sources/')) {
      return Response.json({}, { status: 503 });
    }
    if (pathname === '/v1/pages' && method === 'POST') created = true;
    return null;
  };
  const bean = await app.submit('beans', { name: '저장 후 재조회 실패 원두' });
  assert.equal(bean.status, 'succeeded', 'the write itself succeeded');
  assert.ok(statuses.some(status => status.type === 'saved-read-error'),
    `save refetch failure remains visible: ${statuses.map(status => status.type).join(', ')}`);
  assert.equal(statuses.some(status => ['saved', 'loaded'].includes(status.type)), false);

  fake.intercept = null;
  statuses.length = 0;
  await app.refresh();
  statuses.length = 0;
  let archived = false;
  fake.intercept = ({ pathname, method }) => {
    if (archived && method === 'POST' && pathname.startsWith('/v1/data_sources/')) {
      return Response.json({}, { status: 503 });
    }
    if (method === 'PATCH') archived = true;
    return null;
  };
  const deletion = await app.submit('delete-bean', { id: bean.value.id });
  assert.equal(deletion.status, 'succeeded', 'the deletion itself succeeded');
  assert.ok(statuses.some(status => status.type === 'deleted-read-error'), 'delete refetch failure remains visible');
  assert.equal(statuses.some(status => ['saved', 'loaded'].includes(status.type)), false);
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

test('lost best relation response is resolved by rereading the bean and record from Notion', async () => {
  const setup = startupApp({ route: '/beans' });
  const { app, fake, native } = setup;
  await app.connect(testConnection());
  const bean = await app.submit('beans', { name: '베스트 테스트 원두' });
  const recipe = await app.submit('recipes', validRecipe(bean.value.id));
  const record = await app.submit('records', { beanId: bean.value.id, recipeId: recipe.value.id,
    date: '2026-11-03', rating: '4.7', cupNote: '복숭아' });
  fake.intercept = async call => {
    if (call.pathname !== `/v1/pages/${bean.value.id}` || call.method !== 'PATCH' || !call.body?.properties?.['베스트 추출']) return null;
    const page = fake.rows.find(item => item.id === bean.value.id);
    const relation = call.body.properties['베스트 추출'];
    page.properties['베스트 추출'] = { type: 'relation', ...relation, has_more: false };
    return Promise.reject(new TypeError('lost update response'));
  };
  const outcome = await app.submit('set-best-record', { beanId: bean.value.id, recordId: record.value.id });
  assert.equal(outcome.status, 'unknown');
  assert.equal(setup.unresolvedOperations.length, 1);
  assert.equal(setup.unresolvedOperations[0].kind, 'set-best-record');
  await setup.unresolvedOperations[0].resolve({ originalConfirmed: true, decision: 'saved' });
  assert.equal(native.journal().operations.at(-1).status, 'succeeded');
  assert.equal(setup.unresolvedOperations.length, 0);
  assert.deepEqual(fake.rows.find(item => item.id === bean.value.id).properties['베스트 추출'].relation,
    [{ id: record.value.id }]);
});

test('bean detail resolves its persisted best record by ID instead of deriving it from the loaded history page', async () => {
  const setup = startupApp({ route: '/beans' });
  const { app, fake, setRoute } = setup;
  await app.connect(testConnection());
  const bean = await app.submit('beans', { name: '베스트 상세 원두' });
  const recipe = await app.submit('recipes', validRecipe(bean.value.id));
  const record = await app.submit('records', { beanId: bean.value.id, recipeId: recipe.value.id,
    date: '2026-11-02', rating: '4.4', cupNote: '자몽' });
  const bestWrite = await app.submit('set-best-record', { beanId: bean.value.id, recordId: record.value.id });
  assert.equal(bestWrite.status, 'succeeded');
  fake.intercept = async call => {
    if (call.pathname !== `/v1/data_sources/${DATA_SOURCES.records}/query` || call.method !== 'POST') return null;
    return Response.json({ object: 'list', results: [], has_more: false, next_cursor: null });
  };

  const route = `/beans/${bean.value.id}`;
  setRoute(route);
  const detail = await app.loadRoute(route, { force: true });

  assert.equal(detail.beans[0].bestRecordStatus, 'ready');
  assert.equal(detail.beans[0].bestRecord.id, record.value.id);
  assert.equal(detail.beans[0].bestRecord.cupNote, '자몽');
  assert.ok(fake.calls.some(call => call.pathname === `/v1/pages/${record.value.id}` && call.method === 'GET'),
    'the persisted relation is resolved by direct record ID even when the loaded history page omits it');
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

test('home startup verifies a saved connection through the real Notion client', async () => {
  const { app, fake } = startupApp();

  assert.equal(await app.initialize(), true);
  assert.equal(app.getState().connected, true);
  const reads = fake.calls.filter(call => call.pathname.startsWith('/v1/data_sources/'));
  assert.equal(reads.length, 4);
  assert.ok(reads.every(call => call.method === 'GET'));
});

test('home startup keeps the saved settings on a temporary verify failure and restores them on retry', async () => {
  const setup = startupApp();
  const { app, native, fake, connectionStates, statuses } = setup;
  const savedConnection = native.files.get('connection.json');
  const savedJournal = native.files.get('submission-journal.json');
  fake.intercept = call => call.method === 'GET' && call.pathname.startsWith('/v1/data_sources/')
    ? Response.json({ message: 'private token and source id' }, { status: 503 }) : null;

  assert.equal(await app.initialize(), false);
  assert.equal(app.getState().connected, false);
  assert.equal(connectionStates.at(-1).retryInitialization, true);
  assert.equal(connectionStates.at(-1).canEditConnection, true);
  assert.match(statuses.at(-1).message, /저장된 연결/);
  assert.doesNotMatch(statuses.at(-1).message, /private token|source id/);
  assert.equal(native.files.get('connection.json'), savedConnection);
  assert.equal(native.files.get('submission-journal.json'), savedJournal);

  fake.intercept = null;
  assert.equal(await app.initialize(), true);
  assert.equal(app.getState().connected, true);
  assert.equal(native.files.get('connection.json'), savedConnection);
  assert.equal(native.files.get('submission-journal.json'), savedJournal);
});

test('home startup shows a safe retry state when saved connection storage cannot be read', async () => {
  const setup = startupApp({ readConnection: async () => { throw new Error('private token source id raw storage details'); } });
  const { app, connectionStates, statuses } = setup;

  assert.equal(await app.initialize(), false);
  assert.equal(app.getState().connected, false);
  assert.equal(connectionStates.at(-1).retryInitialization, true);
  assert.equal(connectionStates.at(-1).canEditConnection, false);
  assert.match(statuses.at(-1).message, /저장된 연결/);
  assert.doesNotMatch(statuses.at(-1).message, /private token|source id|raw storage details/);
});

test('home startup opens first-time connection entry only when the connection file is absent', async () => {
  const setup = startupApp({ native: memoryPlatform({ initialized: false }) });
  const { app, connectionStates, statuses } = setup;

  assert.equal(await app.initialize(), null);
  assert.equal(connectionStates.at(-1).retryInitialization, undefined);
  assert.equal(connectionStates.at(-1).needsRecovery, undefined);
  assert.match(statuses.at(-1).message, /연결 정보를 입력/);
});

test('saved connection authorization failures keep retry and settings edit entry available', async () => {
  const setup = startupApp();
  const { app, fake, connectionStates, statuses } = setup;
  fake.intercept = call => call.method === 'GET' && call.pathname.startsWith('/v1/data_sources/')
    ? Response.json({ message: 'private response' }, { status: 401 }) : null;

  assert.equal(await app.initialize(), false);
  assert.equal(app.getState().connected, false);
  assert.equal(connectionStates.at(-1).retryInitialization, true);
  assert.equal(connectionStates.at(-1).canEditConnection, true);
  assert.equal(statuses.at(-1).message, 'Notion 토큰을 확인해 주세요.');
  assert.doesNotMatch(statuses.at(-1).message, /private response/);
});

test('startup recovery guards remain repair-only and block connection replacement', async () => {
  for (const journalChange of [
    journal => { journal.connectionGuard = { phase: 'processing',
      candidateRevision: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', targetFingerprint: 'a'.repeat(64) }; },
    journal => { journal.activeConnectionRevision = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'; },
  ]) {
    const native = memoryPlatform();
    const journal = JSON.parse(native.files.get('submission-journal.json'));
    journalChange(journal);
    native.files.set('submission-journal.json', JSON.stringify(journal));
    const setup = startupApp({ native });
    const { app, fake, connectionStates } = setup;

    assert.equal(await app.initialize(), false);
    assert.equal(connectionStates.at(-1).needsRecovery, true);
    assert.equal(connectionStates.at(-1).retryInitialization, undefined);
    assert.equal(fake.calls.length, 0);
    await assert.rejects(app.connect(testConnection()), error =>
      ['unresolved-connection', 'connection-mismatch', 'action-error'].includes(error.code));
    assert.equal(fake.calls.length, 0);
  }
});

test('saved startup keeps route-specific verification and query loading lazy', async () => {
  const { app, fake } = startupApp({ route: '/beans' });
  assert.equal(await app.initialize(), true);
  assert.equal(fake.calls.filter(call => call.method === 'GET').length, 1);
  assert.ok(fake.calls.every(call => call.pathname.includes(testConnection().dataSources.beans)));
});

test('unreadable saved storage can recover on retry without replacing settings', async () => {
  const native = memoryPlatform();
  const original = native.files.get('connection.json');
  let unreadable = true;
  const { app, fake } = startupApp({ native, readConnection: async () => {
    if (unreadable) throw new Error('private storage details');
    return JSON.parse(original);
  } });
  assert.equal(await app.initialize(), false);
  assert.equal(fake.calls.length, 0);
  await assert.rejects(app.submit('beans', { name: 'blocked' }));
  assert.equal(fake.calls.length, 0);
  unreadable = false;
  assert.equal(await app.initialize(), true);
  assert.equal(native.files.get('connection.json'), original);
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

test('favorites persist through real adapters, remain out of copies and snapshots, and filter catalog and brew routes', async () => {
  const { app, fake, native, setRoute, entrySuccesses } = startupApp({ route: '/beans' });
  await app.connect(testConnection());
  const first = await app.submit('beans', { name: 'Favorite bean' });
  await app.submit('beans', { name: 'Other bean' });
  const recipe = await app.submit('recipes', validRecipe(first.value.id));
  assert.equal((await app.submit('favorite-bean', { id: first.value.id, favorite: true })).status, 'succeeded');
  assert.equal((await app.submit('favorite-recipe', { id: recipe.value.id, favorite: true })).status, 'succeeded');
  const loaded = await app.loadRoute('/beans?favorite=true', { force: true });
  assert.deepEqual(loaded.beans.map(item => item.id), [first.value.id]);
  assert.equal(loaded.beans[0].favorite, true);
  setRoute('/brew/bean?favorite=true');
  const brew = await app.loadRoute('/brew/bean?favorite=true', { force: true });
  assert.deepEqual(brew.beans.map(item => item.id), [first.value.id]);
  const copied = await app.submit('copy', { recipeId: recipe.value.id, changes: { name: 'Copy' } });
  const copyPage = fake.rows.find(row => row.id === copied.value.id);
  assert.equal(copyPage.properties['즐겨찾기'].checkbox, false);
  assert.deepEqual(native.journal().operations.filter(op => op.kind.startsWith('favorite-')).map(op => op.favoriteTarget.favorite), [true, true]);
  assert.equal(entrySuccesses.some(kind => kind.startsWith('favorite-')), false);
});

test('an uncertain favorite PATCH blocks writes and fresh original value resolves without another PATCH', async () => {
  const { app, fake, native } = startupApp({ route: '/beans' });
  await app.connect(testConnection());
  const bean = await app.submit('beans', { name: 'Recover favorite' });
  fake.intercept = call => {
    if (call.method !== 'PATCH' || !call.body?.properties?.['즐겨찾기']) return null;
    fake.rows.find(row => row.id === bean.value.id).properties['즐겨찾기'].checkbox = true;
    throw new TypeError('synthetic lost response');
  };
  const result = await app.submit('favorite-bean', { id: bean.value.id, favorite: true });
  assert.equal(result.status, 'unknown');
  assert.equal(app.getState().unresolved, true);
  await assert.rejects(app.submit('beans', { name: 'Blocked' }), error => error.code === 'unresolved-operation');
  const patchCount = fake.calls.filter(call => call.method === 'PATCH').length;
  const operation = native.journal().operations.at(-1);
  fake.intercept = null;
  await app.resolveOperation(operation.key, { originalConfirmed: true, decision: 'saved' });
  assert.equal(app.getState().unresolved, false);
  assert.equal(native.journal().operations.at(-1).status, 'succeeded');
  assert.equal(fake.calls.filter(call => call.method === 'PATCH').length, patchCount);
});

test('favorite recovery stays blocked when the original checkbox schema is removed', async () => {
  const { app, fake, native } = startupApp({ route: '/beans' });
  await app.connect(testConnection());
  const bean = await app.submit('beans', { name: 'Missing favorite schema' });
  fake.intercept = call => {
    if (call.method === 'PATCH') throw new TypeError('synthetic lost response');
    return null;
  };
  assert.equal((await app.submit('favorite-bean', { id: bean.value.id, favorite: false })).status, 'unknown');
  fake.intercept = call => {
    if (call.method !== 'GET' || call.pathname !== `/v1/data_sources/${testConnection().dataSources.beans}`) return null;
    return Response.json({ object: 'data_source', id: testConnection().dataSources.beans,
      properties: Object.fromEntries(Object.entries(fake.rows[0].properties)
        .filter(([name]) => name !== '즐겨찾기')) });
  };
  const operation = native.journal().operations.at(-1);
  await assert.rejects(app.resolveOperation(operation.key, { originalConfirmed: true, decision: 'saved' }),
    error => error.code === 'resolution-read-failed');
  assert.equal(native.journal().operations.at(-1).status, 'unknown');
  assert.equal(app.getState().unresolved, true);
});

for (const [httpStatus, code, message] of [
  [401, 'unauthorized', 'Notion 토큰을 확인해 주세요.'],
  [403, 'forbidden', '데이터 소스 접근 권한을 확인해 주세요.'],
  [429, 'rate-limited', '잠시'],
]) {
  test(`favorite PATCH HTTP ${httpStatus} preserves safe next-action guidance without retry`, async () => {
    const { app, fake, native, statuses } = startupApp({ route: '/beans' });
    await app.connect(testConnection());
    const bean = await app.submit('beans', { name: 'Rejected favorite' });
    fake.intercept = call => call.method === 'PATCH'
      ? Response.json({ message: 'private server diagnostic must not escape' }, { status: httpStatus }) : null;
    const result = await app.submit('favorite-bean', { id: bean.value.id, favorite: true });
    assert.equal(result.status, 'failed');
    assert.equal(result.code, code);
    assert.ok(statuses.some(status => status.message.includes(message)));
    assert.doesNotMatch(JSON.stringify(statuses), /private server diagnostic/);
    assert.equal(native.journal().operations.at(-1).status, 'failed');
    assert.equal(app.getState().unresolved, false);
    assert.equal(fake.calls.filter(call => call.method === 'PATCH').length, 1);
  });
}

for (const picker of [false, true]) {
  test(`late favorite ${picker ? 'picker' : 'catalog'} response cannot populate the replacement connection or cache`, async () => {
    const route = '/brew/bean?favorite=true';
    const { app, fake, rendered, searchOptions } = startupApp({ route });
    await app.connect(testConnection());
    const bean = await app.submit('beans', { name: 'Original favorite' });
    await app.submit('favorite-bean', { id: bean.value.id, favorite: true });
    let release;
    let started;
    const waiting = new Promise(resolve => { started = resolve; });
    fake.intercept = call => {
      if (call.method !== 'POST' || !call.pathname.endsWith('/query')) return null;
      const captured = structuredClone(fake.rows.filter(row => row.id === bean.value.id));
      started();
      return new Promise(resolve => { release = () => resolve(Response.json({ object: 'list', results: captured, has_more: false, next_cursor: null })); });
    };
    const oldRead = picker ? app.loadSearchOptions('beans', '', null, 'brew') : app.loadRoute(route, { force: true });
    await waiting;
    fake.intercept = null;
    fake.rows.find(row => row.id === bean.value.id).properties['즐겨찾기'].checkbox = false;
    const replacement = { ...testConnection(), revision: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' };
    await app.connect(replacement);
    const renderCount = rendered.length;
    const optionCount = searchOptions.length;
    release();
    await oldRead;
    assert.equal(rendered.length, renderCount);
    assert.equal(searchOptions.length, optionCount);
    assert.deepEqual(rendered.at(-1).beans, []);
    const fresh = await app.loadSearchOptions('beans', '', null, 'brew');
    assert.deepEqual(fresh.items, [], 'old favorite response must not poison the replacement option cache');
  });
}

test('unknown favorite recovery rejects changed connection revision and data-source identity', async () => {
  const { app, fake, native } = startupApp({ route: '/beans' });
  await app.connect(testConnection());
  const bean = await app.submit('beans', { name: 'Connection-bound favorite' });
  fake.intercept = call => { if (call.method === 'PATCH') throw new TypeError('lost response'); return null; };
  assert.equal((await app.submit('favorite-bean', { id: bean.value.id, favorite: true })).status, 'unknown');
  fake.intercept = null;
  const key = native.journal().operations.at(-1).key;
  for (const changed of [
    { ...testConnection(), revision: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' },
    { ...testConnection(), dataSources: { ...testConnection().dataSources, beans: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' } },
  ]) {
    native.files.set('connection.json', JSON.stringify(changed));
    await assert.rejects(app.resolveOperation(key, { originalConfirmed: true, decision: 'not-saved' }));
    assert.equal(native.journal().operations.at(-1).status, 'unknown');
    assert.equal(app.getState().unresolved, true);
  }
  assert.equal(fake.calls.filter(call => call.method === 'PATCH').length, 1);
});

test('favorite and best updates preserve each other and actual snapshots omit catalog preferences', async () => {
  const { app, fake, native } = startupApp({ route: '/beans' });
  await app.connect(testConnection());
  const bean = await app.submit('beans', { name: '즐겨찾기와 베스트 원두' });
  const recipeInput = validRecipe(bean.value.id);
  const recipe = await app.submit('recipes', recipeInput);
  assert.equal((await app.submit('favorite-bean', { id: bean.value.id, favorite: true })).status, 'succeeded');
  assert.equal((await app.submit('favorite-recipe', { id: recipe.value.id, favorite: true })).status, 'succeeded');
  const record = await app.submit('brews', { beanId: bean.value.id, sourceRecipeId: recipe.value.id,
    actualRecipe: recipeInput, date: '2026-11-04', rating: '4.6', cupNote: '살구' });
  assert.equal(record.status, 'succeeded');
  const stored = fake.rows.find(row => row.id === record.value.id);
  const snapshot = JSON.parse(stored.properties['당시 레시피 스냅샷'].rich_text.map(part => part.text.content).join(''));
  assert.equal(Object.hasOwn(snapshot.bean, 'favorite'), false);
  assert.equal(Object.hasOwn(snapshot.recipe, 'favorite'), false);
  assert.equal((await app.submit('set-best-record', { beanId: bean.value.id, recordId: record.value.id })).status, 'succeeded');
  const beanPage = fake.rows.find(row => row.id === bean.value.id);
  assert.equal(beanPage.properties['즐겨찾기'].checkbox, true);
  assert.equal((await app.submit('favorite-bean', { id: bean.value.id, favorite: false })).status, 'succeeded');
  assert.deepEqual(beanPage.properties['베스트 추출'].relation, [{ id: record.value.id }]);
  const patches = fake.calls.filter(call => call.method === 'PATCH');
  assert.ok(patches.every(call => Object.keys(call.body.properties).length === 1));
  const bestOperation = native.journal().operations.find(op => op.kind === 'set-best-record');
  assert.equal(bestOperation.updateTarget.nextRecordId, record.value.id);
  assert.equal(Object.hasOwn(bestOperation, 'favoriteTarget'), false);
  const favoriteOperation = native.journal().operations.find(op => op.kind === 'favorite-bean');
  assert.equal(favoriteOperation.favoriteTarget.favorite, true);
  assert.equal(Object.hasOwn(favoriteOperation, 'updateTarget'), false);
});

test('legacy schemas without optional properties keep catalogs and brew pickers readable', async () => {
  const missingProperties = { beans: ['즐겨찾기', '베스트 추출'], recipes: ['원두', '추출 가이드', '즐겨찾기'], records: ['원두'] };
  const fake = fakePwaNotion({ missingProperties, strictProjection: true });
  const { app, setRoute } = startupApp({ route: '/beans', fake });
  await app.connect(testConnection());
  const bean = await app.submit('beans', { name: 'Legacy bean' });
  const recipe = await app.submit('recipes', validRecipe(bean.value.id));
  assert.equal(bean.status, 'succeeded');
  assert.equal(recipe.status, 'succeeded');
  for (const [route, kind, id] of [
    ['/beans', 'beans', bean.value.id], ['/recipes', 'recipes', recipe.value.id],
    ['/brew/bean', 'beans', bean.value.id], [`/brew/recipe?beanId=${bean.value.id}`, 'recipes', recipe.value.id],
  ]) {
    setRoute(route);
    const result = await app.loadRoute(route, { force: true });
    assert.deepEqual(result[kind].map(item => item.id), [id], route);
    assert.equal(result[kind][0].favorite, false);
    assert.equal(result.favoriteSupport[kind], false);
    if (kind === 'beans') assert.equal(result.beans[0].bestRecordStatus, 'unsupported');
  }
  for (const kind of ['beans', 'recipes']) {
    const options = await app.loadSearchOptions(kind, '', null, 'brew');
    assert.equal(options.items.length, 1);
  }
  const sourceKind = id => Object.keys(testConnection().dataSources).find(kind => testConnection().dataSources[kind] === id);
  const queries = fake.calls.filter(call => call.method === 'POST' && call.pathname.endsWith('/query'));
  assert.ok(queries.length >= 6);
  for (const call of queries) {
    const kind = sourceKind(call.pathname.split('/')[3]);
    assert.ok(call.queryProperties.every(name => !missingProperties[kind]?.includes(name)), kind);
  }
});
