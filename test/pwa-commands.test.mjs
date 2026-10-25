import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { createSnapshot, validateRecipe } from '../lib/domain.mjs';
import { encodeProperties } from '../pwa/data/notion-properties.mjs';
import { createReadRepository } from '../pwa/data/read-repository.mjs';
import { createSubmissionState } from '../pwa/state/submission-state.mjs';
import { createCommands } from '../pwa/commands/index.mjs';

const REVISION = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const DATA_SOURCES = Object.freeze({
  beans: '11111111-1111-4111-8111-111111111111',
  bags: '22222222-2222-4222-8222-222222222222',
  recipes: '33333333-3333-4333-8333-333333333333',
  steps: '44444444-4444-4444-8444-444444444444',
  records: '55555555-5555-4555-8555-555555555555',
});
const IDS = Object.freeze({
  bean: 'aaaaaaaa-1111-4111-8111-111111111111',
  otherBean: 'aaaaaaaa-1111-4111-8111-222222222222',
  bag: 'bbbbbbbb-2222-4222-8222-111111111111',
  otherBag: 'bbbbbbbb-2222-4222-8222-222222222222',
  recipe: 'cccccccc-3333-4333-8333-111111111111',
  secondRecipe: 'cccccccc-3333-4333-8333-222222222222',
});
const CONNECTION_FILE = 'connection.json';
const JOURNAL_FILE = 'submission-journal.json';

function namedError(name) { return Object.assign(new Error('synthetic storage error'), { name }); }

function stateHarness() {
  const files = new Map([
    [CONNECTION_FILE, JSON.stringify({ schemaVersion: 1, revision: REVISION, token: 'synthetic-token', dataSources: DATA_SOURCES })],
    [JOURNAL_FILE, JSON.stringify({ schemaVersion: 1, activeConnectionRevision: REVISION, connectionGuard: null, operations: [] })],
  ]);
  let locked = false;
  const storage = {
    async getDirectory() {
      return { async getDirectoryHandle() {
        return { async getFileHandle(name, options) {
          if (!files.has(name)) {
            if (!options.create) throw namedError('NotFoundError');
            files.set(name, '');
          }
          return {
            async getFile() { return { async text() { return files.get(name); } }; },
            async createWritable() {
              let next;
              return {
                async write(value) { next = value; },
                async close() { files.set(name, next); },
                async abort() {},
              };
            },
          };
        } };
      } };
    },
  };
  const locks = { async request(_name, _options, action) {
    if (locked) return action(null);
    locked = true;
    try { return await action({}); } finally { locked = false; }
  } };
  const submissionState = createSubmissionState({ storage, locks, cryptoImpl: webcrypto });
  return { files, submissionState, isLocked: () => locked, journal: () => JSON.parse(files.get(JOURNAL_FILE)) };
}

function bean(id = IDS.bean, overrides = {}) {
  return { id, name: '에티오피아 구지', roaster: '샘플 로스터리', origin: '구지·함벨라', variety: '헤이룸', process: '워시드', tastingNotes: '복숭아', ...overrides };
}

function recipeInput(beanId = IDS.bean, overrides = {}) {
  return {
    name: 'V60 기본', beanId, dripper: 'V60', dose: 15, grind: '중간', grinder: '그라인더', grinderSetting: '20',
    microns: null, temperature: 93, totalWater: 250,
    steps: [
      { name: '뜸', time: '0:00', water: 50 },
      { name: '1차', time: '0:30', water: 100 },
      { name: '2차', time: '1:10', water: 100 },
    ],
    ...overrides,
  };
}

function storedRecipe(id = IDS.recipe, overrides = {}) {
  return { id, ...validateRecipe(recipeInput()), stats: { count: 2, average: 4 }, ...overrides };
}

function notionPage(kind, id, data) {
  const properties = {};
  for (const [name, typed] of Object.entries(encodeProperties(kind, data))) {
    const [type, value] = Object.entries(typed)[0];
    properties[name] = { id: `property-${kind}-${name}`, type, [type]: structuredClone(value) };
    if (type === 'relation') properties[name].has_more = false;
  }
  return {
    object: 'page', id, parent: { type: 'data_source_id', data_source_id: DATA_SOURCES[kind] },
    archived: false, in_trash: false, last_edited_time: '2026-10-19T00:00:00.000Z', properties,
  };
}

function blankRows() { return { beans: [], bags: [], recipes: [], records: [] }; }

function harness({ rows = blankRows(), revision = REVISION } = {}) {
  const state = stateHarness();
  const calls = [], archives = [];
  const failures = new Map();
  let sequence = 0;
  const nextId = () => `dddddddd-dddd-4ddd-8ddd-${String(++sequence).padStart(12, '0')}`;
  const repository = {
    async readAll() {
      assert.equal(state.isLocked(), true, 'fresh relation reads must run under the write lock');
      return structuredClone(rows);
    },
    async readRecipeForSnapshot(id) {
      const found = rows.recipes.find(item => item.id.toLowerCase() === id.toLowerCase());
      if (!found) throw Object.freeze({ code: 'recipe-unavailable', writeState: 'not-sent' });
      return structuredClone(found);
    },
  };
  const client = {
    connectionRevision: revision,
    dataSources: DATA_SOURCES,
    recordBeanRelationSupported: true,
    async createPage(kind, data) {
      assert.equal(state.isLocked(), true, 'Notion create must run under the write lock');
      const operation = state.journal().operations.at(-1);
      assert.equal(operation?.status, 'processing', 'journal processing must be durable before a create');
      const call = { kind, data: structuredClone(data) };
      calls.push(call);
      const failure = failures.get(calls.length);
      if (failure) throw failure;
      const id = nextId();
      call.id = id;
      if (kind === 'beans' || kind === 'bags' || kind === 'records') rows[kind].push({ ...structuredClone(data), id });
      if (kind === 'recipes') rows.recipes.push({ ...structuredClone(data), id, steps: [], stats: { count: 0, average: null } });
      if (kind === 'steps') {
        const recipe = rows.recipes.find(item => item.id === data.recipeId);
        if (recipe) recipe.steps.unshift({ ...structuredClone(data), id });
      }
      return { id };
    },
    async archiveCreatedPage(id) {
      assert.equal(state.isLocked(), true, 'internal archive must run under the write lock');
      const operation = state.journal().operations.at(-1);
      assert.equal(operation?.status, 'processing');
      archives.push(id);
      const failure = failures.get(`archive:${id}`);
      if (failure) throw failure;
      for (const kind of ['beans', 'bags', 'recipes', 'records']) rows[kind] = rows[kind].filter(item => item.id !== id);
      for (const recipe of rows.recipes) recipe.steps = recipe.steps.filter(item => item.id !== id);
      return { id, in_trash: true };
    },
  };
  return { ...state, rows, calls, archives, failures, repository, client, commands: createCommands({ client, repository, submissionState: state.submissionState }) };
}

const rejected = writeState => Object.freeze({ code: 'http-rejected', writeState: writeState ?? 'rejected' });
const unknown = Object.freeze({ code: 'network-unconfirmed', writeState: 'unknown' });

test('createCommands prepares an isolated bean draft and saves optional origin through the shared field', async () => {
  const env = harness();
  const input = { name: '  에티오피아  ', roaster: ' 로스터리 ', origin: '구지·함벨라 농장', variety: '', process: '워시드', tastingNotes: '복숭아' };
  const original = structuredClone(input);
  const draft = await env.commands.prepareBean(input);
  input.name = 'changed outside draft';
  const result = await env.commands.execute(draft);
  assert.equal(result.status, 'succeeded');
  assert.deepEqual(env.calls.map(call => call.kind), ['beans']);
  assert.deepEqual(env.calls[0].data, {
    name: '에티오피아', roaster: '로스터리', origin: '구지·함벨라 농장',
    variety: '', process: '워시드', tastingNotes: '복숭아',
  });
  assert.equal(env.calls[0].data.name, '에티오피아');
  assert.equal(env.calls[0].data.origin, '구지·함벨라 농장');
  assert.deepEqual(original, { name: '  에티오피아  ', roaster: ' 로스터리 ', origin: '구지·함벨라 농장', variety: '', process: '워시드', tastingNotes: '복숭아' });
  assert.equal(env.rows.beans[0].name, '에티오피아');
  assert.equal(env.journal().operations[0].status, 'succeeded');
});

test('bean name is required before any operation is submitted', async () => {
  const env = harness();
  await assert.rejects(env.commands.prepareBean({ name: '  ' }));
  assert.equal(env.calls.length, 0);
  assert.equal(env.journal().operations.length, 0);
});

test('bean name alone is sufficient and absent optional fields stay empty', async () => {
  const env = harness();
  const draft = await env.commands.prepareBean({ name: '케냐 키리냐가' });
  const result = await env.commands.execute(draft);
  assert.equal(result.status, 'succeeded');
  assert.deepEqual(env.calls[0].data, {
    name: '케냐 키리냐가', roaster: '', origin: '', variety: '', process: '', tastingNotes: '',
  });
});

test('bean writes distinguish a clear rejection from an uncertain response', async t => {
  for (const [writeState, expected] of [['rejected', 'failed'], ['unknown', 'unknown']]) {
    await t.test(writeState, async () => {
      const env = harness();
      env.failures.set(1, writeState === 'unknown' ? unknown : rejected());
      const draft = await env.commands.prepareBean({ name: '원두' });
      const result = await env.commands.execute(draft);
      assert.equal(result.status, expected);
      assert.equal(env.journal().operations[0].status, expected);
      assert.equal(env.calls.length, 1);
      await assert.rejects(env.commands.execute(draft), error => error.code === (expected === 'unknown' ? 'unresolved-operation' : 'duplicate-operation'));
      assert.equal(env.calls.length, 1, 'a failed or uncertain key is never retransmitted');
    });
  }
});

test('bag relation is checked from the latest repository snapshot inside the write lock', async () => {
  const env = harness({ rows: { ...blankRows(), beans: [bean()] } });
  const draft = await env.commands.prepareBag({ name: '봄 봉지', beanId: IDS.bean, roastedOn: '2026-10-01' });
  env.rows.beans = [];
  const result = await env.commands.execute(draft);
  assert.equal(result.status, 'failed');
  assert.deepEqual(env.calls, []);
  assert.equal(env.journal().operations[0].status, 'failed');
});

test('bag saves its own optional roast date and rejects malformed dates before write', async () => {
  const env = harness({ rows: { ...blankRows(), beans: [bean()] } });
  const draft = await env.commands.prepareBag({ name: '봄 봉지', beanId: IDS.bean, roastedOn: '2026-10-01' });
  const result = await env.commands.execute(draft);
  assert.equal(result.status, 'succeeded');
  assert.equal(env.calls[0].kind, 'bags');
  assert.equal(env.calls[0].data.roastedOn, '2026-10-01');
  await assert.rejects(env.commands.prepareBag({ name: '잘못된 봉지', beanId: IDS.bean, roastedOn: '2026-02-30' }));
  assert.equal(env.calls.length, 1);
});

test('old connection revision blocks even a prepared relation write', async () => {
  const env = harness({ rows: { ...blankRows(), beans: [bean()] }, revision: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' });
  const draft = await env.commands.prepareBag({ name: '봄 봉지', beanId: IDS.bean });
  await assert.rejects(env.commands.execute(draft), error => error.code === 'stale-connection' && error.writeState === 'not-sent');
  assert.equal(env.calls.length, 0);
});

test('recipe saves parent then all stages in reverse order after full preflight', async () => {
  const env = harness({ rows: { ...blankRows(), beans: [bean()] } });
  const draft = await env.commands.prepareRecipe(recipeInput());
  const result = await env.commands.execute(draft);
  assert.equal(result.status, 'succeeded');
  assert.deepEqual(env.calls.map(call => call.kind), ['recipes', 'steps', 'steps', 'steps']);
  assert.deepEqual(env.calls.slice(1).map(call => call.data.order), [3, 2, 1]);
  assert.ok(env.calls.slice(1).every(call => call.data.recipeId === env.calls[0].id));
  assert.deepEqual(env.rows.recipes[0].steps.map(step => step.order), [1, 2, 3]);
});

test('legacy recipe schema blocks a nonempty guide before journal creation for create and copy', async () => {
  const env = harness({ rows: { ...blankRows(), recipes: [storedRecipe()] } });
  env.client.recipeExtractionGuideSupported = false;
  for (const action of [
    () => env.commands.prepareRecipe(recipeInput(IDS.bean, { extractionGuide: '교반 없음' })),
    () => env.commands.prepareCopy(IDS.recipe, { extractionGuide: '교반 없음' }),
  ]) {
    await assert.rejects(action(), error => error.code === 'recipe-guide-unsupported' && error.writeState === 'not-sent');
  }
  assert.equal(env.calls.length, 0);
  assert.equal(env.journal().operations.length, 0);
});

test('any recipe payload over a Notion transport limit is rejected before the parent write', async () => {
  const env = harness({ rows: { ...blankRows(), beans: [bean()] } });
  const input = recipeInput(IDS.bean, { steps: [
    { name: '뜸', time: '0:00', water: 50 },
    { name: '1차', time: '0:30', water: 100 },
    { name: '2차 ' + '0'.repeat(200001), time: '1:10', water: 100 },
  ] });
  const draft = await env.commands.prepareRecipe(input);
  const result = await env.commands.execute(draft);
  assert.equal(result.status, 'failed');
  assert.equal(env.calls.length, 0);
  assert.equal(env.journal().operations[0].status, 'failed');
});

test('known stage rejection archives the confirmed parent before known stages in reverse order', async () => {
  const env = harness({ rows: { ...blankRows(), beans: [bean()] } });
  env.failures.set(4, rejected()); // parent, steps 3 and 2 succeed; step 1 is clearly rejected.
  const draft = await env.commands.prepareRecipe(recipeInput());
  const result = await env.commands.execute(draft);
  assert.equal(result.status, 'failed');
  assert.deepEqual(env.calls.map(call => call.kind), ['recipes', 'steps', 'steps', 'steps']);
  assert.deepEqual(env.archives, [env.calls[0].id, env.calls[2].id, env.calls[1].id]);
  assert.equal(env.rows.recipes.length, 0);
  assert.deepEqual(env.journal().operations[0].createdPages.map(page => page.archiveState), ['archived', 'archived', 'archived']);
});

test('unknown stage response stops immediately without further create or cleanup writes', async () => {
  const env = harness({ rows: { ...blankRows(), beans: [bean()] } });
  env.failures.set(3, unknown); // parent and step 3 succeed; response for step 2 is unknown.
  const draft = await env.commands.prepareRecipe(recipeInput());
  const result = await env.commands.execute(draft);
  assert.equal(result.status, 'unknown');
  assert.equal(env.calls.length, 3);
  assert.deepEqual(env.archives, []);
  assert.equal(env.journal().operations[0].status, 'unknown');
});

test('failed parent archive prevents child cleanup and preserves the partial recipe', async () => {
  const env = harness({ rows: { ...blankRows(), beans: [bean()] } });
  env.failures.set(4, rejected());
  const draft = await env.commands.prepareRecipe(recipeInput());
  // The generated parent ID is deterministic; the first archive is attempted after the rejection.
  env.failures.set(`archive:dddddddd-dddd-4ddd-8ddd-000000000001`, rejected());
  const result = await env.commands.execute(draft);
  assert.equal(result.status, 'partial');
  assert.equal(env.archives.length, 1);
  assert.equal(env.archives[0], env.calls[0].id);
  assert.ok(env.rows.recipes.length > 0);
});

test('a rejected child archive leaves only that child active and still cleans later known children', async () => {
  const env = harness({ rows: { ...blankRows(), beans: [bean()] } });
  env.failures.set(4, rejected());
  env.failures.set('archive:dddddddd-dddd-4ddd-8ddd-000000000003', rejected());
  const draft = await env.commands.prepareRecipe(recipeInput());
  const result = await env.commands.execute(draft);
  assert.equal(result.status, 'partial');
  assert.deepEqual(env.archives, [
    'dddddddd-dddd-4ddd-8ddd-000000000001',
    'dddddddd-dddd-4ddd-8ddd-000000000003',
    'dddddddd-dddd-4ddd-8ddd-000000000002',
  ]);
  assert.deepEqual(env.journal().operations[0].createdPages.map(page => page.archiveState), ['archived', 'archived', 'active']);
});

test('copy creates a new independent recipe with changed values and rejects a stale source snapshot', async () => {
  const source = storedRecipe();
  source.steps = source.steps.map((step, index) => ({
    ...step,
    id: `eeeeeeee-eeee-4eee-8eee-${String(index + 1).padStart(12, '0')}`,
    recipeId: IDS.recipe,
  }));
  const env = harness({ rows: { ...blankRows(), beans: [bean()], recipes: [source] } });
  const changes = { temperature: 90 };
  const draft = await env.commands.prepareCopy(IDS.recipe, changes);
  changes.temperature = 80;
  assert.equal(draft.payload.temperature, 90);
  assert.equal(draft.payload.steps[0].water, 50);
  assert.ok(draft.payload.steps.every(step => !Object.hasOwn(step, 'id') && !Object.hasOwn(step, 'recipeId')));
  assert.equal(source.steps[0].water, 50);
  const result = await env.commands.execute(draft);
  assert.equal(result.status, 'succeeded');
  assert.equal(env.calls[0].data.temperature, 90);
  assert.deepEqual(env.calls.slice(1).map(call => call.data.order), [3, 2, 1]);
  assert.ok(env.calls.slice(1).every(call => call.data.recipeId === env.calls[0].id));
  assert.equal('stats' in env.calls[0].data, false);
  assert.deepEqual(env.rows.recipes.find(item => item.id === IDS.recipe).steps, source.steps);
  assert.equal(env.rows.recipes.find(item => item.id === IDS.recipe).temperature, 93);

  const stale = await env.commands.prepareCopy(IDS.recipe, { temperature: 92 });
  env.rows.recipes[0].temperature = 94;
  const staleResult = await env.commands.execute(stale);
  assert.equal(staleResult.status, 'failed');
  assert.equal(env.calls.filter(call => call.kind === 'recipes').length, 1);
});

test('copy blocks when only the source extraction guide changes after preparation', async () => {
  const env = harness({ rows: { ...blankRows(), recipes: [storedRecipe(IDS.recipe, { extractionGuide: '교반 없음' })] } });
  const draft = await env.commands.prepareCopy(IDS.recipe, {});
  env.rows.recipes[0].extractionGuide = '교반 한 번';

  const result = await env.commands.execute(draft);
  assert.equal(result.status, 'failed');
  assert.equal(env.calls.length, 0, 'a stale guide must be rejected before the recipe or stages are written');
});

test('copy treats legacy undefined and empty extraction guides as equivalent', async () => {
  for (const [prepared, latest] of [[undefined, ''], ['', undefined]]) {
    const source = storedRecipe();
    if (prepared === undefined) delete source.extractionGuide;
    else source.extractionGuide = prepared;
    const env = harness({ rows: { ...blankRows(), recipes: [source] } });
    const draft = await env.commands.prepareCopy(IDS.recipe, {});

    if (latest === undefined) delete env.rows.recipes[0].extractionGuide;
    else env.rows.recipes[0].extractionGuide = latest;
    const result = await env.commands.execute(draft);

    assert.equal(result.status, 'succeeded');
    assert.equal(env.calls.filter(call => call.kind === 'recipes').length, 1);
    assert.equal(env.calls.find(call => call.kind === 'recipes').data.extractionGuide, '');
  }
});

test('copied recipes stay independent of the legacy bean relation', async () => {
  const env = harness({ rows: { ...blankRows(), beans: [bean(), bean(IDS.otherBean)], recipes: [storedRecipe()] } });
  const copy = await env.commands.prepareCopy(IDS.recipe, { beanId: IDS.otherBean });
  const saved = await env.commands.execute(copy);
  assert.equal(saved.status, 'succeeded');
  assert.equal(Object.hasOwn(env.calls.find(call => call.kind === 'recipes').data, 'beanId'), false);
  await assert.rejects(env.commands.prepareCopy(IDS.secondRecipe, {}));
  env.repository.readRecipeForSnapshot = async () => ({ ...storedRecipe(), steps: [] });
  await assert.rejects(env.commands.prepareCopy(IDS.recipe, {}));
  assert.equal(env.calls.filter(call => call.kind === 'recipes').length, 1);
});

test('a recipe can be created without selecting or storing a bean', async () => {
  const env = harness();
  const draft = await env.commands.prepareRecipe(recipeInput(null));
  const result = await env.commands.execute(draft);
  assert.equal(result.status, 'succeeded');
  assert.equal(Object.hasOwn(env.calls.find(call => call.kind === 'recipes').data, 'beanId'), false);
});

test('record stores a fresh complete recipe snapshot and permits repeated same-day intent', async () => {
  const recipe = storedRecipe();
  const selectedBean = bean(IDS.otherBean);
  const env = harness({ rows: { ...blankRows(), beans: [bean(), selectedBean], bags: [{ id: IDS.bag, beanId: IDS.otherBean, name: '봄 봉지', roastedOn: '2026-10-01' }], recipes: [recipe] } });
  const input = { beanId: IDS.otherBean, recipeId: IDS.recipe, bagId: IDS.bag, date: '2026-10-19', rating: 5, cupNote: '복숭아와 꿀' };
  const first = await env.commands.prepareRecord(input);
  const second = await env.commands.prepareRecord(input);
  assert.notEqual(first.key, second.key);
  const a = await env.commands.execute(first);
  const b = await env.commands.execute(second);
  assert.equal(a.status, 'succeeded');
  assert.equal(b.status, 'succeeded');
  assert.equal(env.rows.records.length, 2);
  for (const record of env.rows.records) {
    assert.equal(record.name, '2026-10-19 · V60 기본');
    assert.equal(record.rating, 5);
    assert.equal(record.beanId, IDS.otherBean);
    assert.equal(record.bagId, IDS.bag);
    assert.deepEqual(record.snapshot, createSnapshot(selectedBean, storedRecipe()));
  }
  assert.equal(recipe.temperature, 93);
});

test('record blocks a freshly selected bag that belongs to a different bean', async () => {
  const env = harness({ rows: {
    ...blankRows(), beans: [bean(), bean(IDS.otherBean)], bags: [{ id: IDS.otherBag, beanId: IDS.otherBean, name: '다른 봉지', roastedOn: null }],
    recipes: [storedRecipe()],
  } });
  const draft = await env.commands.prepareRecord({ beanId: IDS.bean, recipeId: IDS.recipe, bagId: IDS.otherBag, date: '2026-10-19', rating: 4 });
  const result = await env.commands.execute(draft);
  assert.equal(result.status, 'failed');
  assert.equal(env.calls.length, 0);
});

test('record requires a valid date and an integer rating from one to five', async () => {
  const env = harness();
  for (const input of [
    { beanId: IDS.bean, recipeId: IDS.recipe, date: '2026-02-30', rating: 4 },
    { beanId: IDS.bean, recipeId: IDS.recipe, date: '2026-10-19', rating: 0 },
    { beanId: IDS.bean, recipeId: IDS.recipe, date: '2026-10-19', rating: 4.5 },
  ]) await assert.rejects(env.commands.prepareRecord(input));
  await assert.rejects(env.commands.prepareRecord({ recipeId: IDS.recipe, date: '2026-10-19', rating: 4 }));
  assert.equal(env.calls.length, 0);
});

test('old record drafts without a bean and unresolved journal entries cannot be resent', async () => {
  const env = harness({ rows: { ...blankRows(), beans: [bean()], recipes: [storedRecipe()] } });
  const oldPayload = { recipeId: IDS.recipe, date: '2026-10-19', rating: 4 };
  await assert.rejects(env.commands.prepareRecord(oldPayload), error => error instanceof Error && /원두/.test(error.message));
  assert.equal(env.calls.length, 0);
  assert.equal(env.journal().operations.length, 0);

  env.failures.set(1, unknown);
  const interrupted = await env.commands.execute(await env.commands.prepareRecord({ ...oldPayload, beanId: IDS.bean }));
  assert.equal(interrupted.status, 'unknown');
  const callsAfterUnknown = env.calls.length;
  await assert.rejects(env.commands.prepareRecord(oldPayload), error => error instanceof Error && /원두/.test(error.message));
  await assert.rejects(env.commands.execute(await env.commands.prepareRecord({ ...oldPayload, beanId: IDS.bean })),
    error => error.code === 'unresolved-operation');
  assert.equal(env.calls.length, callsAfterUnknown);
  assert.equal(env.journal().operations.filter(operation => operation.kind === 'records').length, 1);
});

test('records writes fail before journal creation when the connected legacy schema lacks records.bean', async () => {
  const env = harness({ rows: { ...blankRows(), beans: [bean()], recipes: [storedRecipe()] } });
  env.client.recordBeanRelationSupported = false;
  await assert.rejects(env.commands.prepareRecord({ beanId: IDS.bean, recipeId: IDS.recipe, date: '2026-10-19', rating: 4 }),
    error => error.code === 'schema-unsupported' && error.writeState === 'not-sent');
  assert.equal(env.calls.length, 0);
  assert.equal(env.journal().operations.length, 0);
});

test('T20 rereads the real T15 repository under lock and the saved record round-trips its snapshot', async () => {
  const state = stateHarness();
  const sourceRecipe = validateRecipe(recipeInput());
  const { steps, ...recipeFields } = sourceRecipe;
  const rows = {
    beans: [notionPage('beans', IDS.bean, { name: '에티오피아', roaster: '', origin: '구지', variety: '', process: '', tastingNotes: '' })],
    bags: [],
    recipes: [notionPage('recipes', IDS.recipe, recipeFields)],
    steps: steps.map((step, index) => notionPage('steps', `eeeeeeee-eeee-4eee-8eee-${String(index + 1).padStart(12, '0')}`, { ...step, recipeId: IDS.recipe })),
    records: [],
  };
  let sequence = 0;
  const client = {
    connectionRevision: REVISION,
    dataSources: DATA_SOURCES,
    recordBeanRelationSupported: true,
    async queryAll(kind) { return structuredClone(rows[kind]); },
    async getPage(id) {
      const page = rows.recipes.find(item => item.id === id);
      if (!page) throw Object.freeze({ code: 'read-failed', writeState: 'not-sent' });
      return structuredClone(page);
    },
    async createPage(kind, data) {
      assert.equal(state.isLocked(), true);
      assert.equal(state.journal().operations.at(-1).status, 'processing');
      const id = `dddddddd-dddd-4ddd-8ddd-${String(++sequence).padStart(12, '0')}`;
      rows[kind].push(notionPage(kind, id, data));
      return { id };
    },
    async archiveCreatedPage(id) { return { id, in_trash: true }; },
  };
  const repository = createReadRepository(client);
  const commands = createCommands({ client, repository, submissionState: state.submissionState });
  const draft = await commands.prepareRecord({ beanId: IDS.bean, recipeId: IDS.recipe, date: '2026-10-19', rating: 5, cupNote: '복숭아' });
  rows.recipes[0] = notionPage('recipes', IDS.recipe, { ...recipeFields, temperature: 91 });
  const snapshotBean = { id: IDS.bean, name: '에티오피아', roaster: '', origin: '구지', variety: '', process: '', tastingNotes: '' };
  const firstSnapshot = createSnapshot(snapshotBean, await repository.readRecipeForSnapshot(IDS.recipe));
  const saved = await commands.execute(draft);
  assert.equal(saved.status, 'succeeded');

  const repeat = await commands.prepareRecord({ beanId: IDS.bean, recipeId: IDS.recipe, date: '2026-10-19', rating: 1 });
  rows.recipes[0] = notionPage('recipes', IDS.recipe, { ...recipeFields, temperature: 88 });
  const secondSnapshot = createSnapshot(snapshotBean, await repository.readRecipeForSnapshot(IDS.recipe));
  const repeated = await commands.execute(repeat);
  assert.equal(repeated.status, 'succeeded');

  const reread = await repository.readAll();
  assert.equal(reread.records.length, 2);
  assert.equal(reread.records[0].rating + reread.records[1].rating, 6);
  assert.deepEqual(reread.records.find(record => record.rating === 5).snapshot, firstSnapshot);
  assert.deepEqual(reread.records.find(record => record.rating === 1).snapshot, secondSnapshot);
  assert.equal(firstSnapshot.recipe.temperature, 91);
  assert.equal(secondSnapshot.recipe.temperature, 88);
  assert.deepEqual(reread.recipes[0].stats, { count: 2, average: 3 });
});

test('T18 partial recipe remains hidden by the real T15 completeness check', async () => {
  const state = stateHarness();
  const rows = {
    beans: [notionPage('beans', IDS.bean, { name: '에티오피아', roaster: '', origin: '구지', variety: '', process: '', tastingNotes: '' })],
    bags: [], recipes: [], steps: [], records: [],
  };
  let sequence = 0;
  const calls = [], archives = [];
  const client = {
    connectionRevision: REVISION,
    dataSources: DATA_SOURCES,
    async queryAll(kind) { return structuredClone(rows[kind]); },
    async getPage(id) {
      const page = rows.recipes.find(item => item.id === id);
      if (!page) throw Object.freeze({ code: 'read-failed', writeState: 'not-sent' });
      return structuredClone(page);
    },
    async createPage(kind, data) {
      calls.push({ kind, data: structuredClone(data) });
      if (kind === 'steps' && data.order === 1) throw rejected();
      const id = `dddddddd-dddd-4ddd-8ddd-${String(++sequence).padStart(12, '0')}`;
      rows[kind].push(notionPage(kind, id, data));
      return { id };
    },
    async archiveCreatedPage(id) {
      archives.push(id);
      throw rejected();
    },
  };
  const repository = createReadRepository(client);
  const commands = createCommands({ client, repository, submissionState: state.submissionState });
  const draft = await commands.prepareRecipe(recipeInput());
  const result = await commands.execute(draft);
  assert.equal(result.status, 'partial');
  assert.deepEqual(calls.slice(1).map(call => call.data.order), [3, 2, 1]);
  assert.equal(archives.length, 1, 'a rejected parent archive prevents child cancellation');
  const reread = await repository.readAll();
  assert.equal(reread.recipes.length, 0);
  assert.equal(reread.excluded.recipes, 1);
});

