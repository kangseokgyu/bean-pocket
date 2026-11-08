import test from 'node:test';
import assert from 'node:assert/strict';
import { createAppController } from '../pwa/ui/controller.mjs';
import { encodeProperties } from '../pwa/data/notion-properties.mjs';
import { recipeEditState, recipeFingerprint, recipePageValues, stepPageValues } from '../pwa/recipe-edit.mjs';

const RECIPE = '33333333-3333-4333-8333-333333333333';
const REVISION = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const dataSources = Object.fromEntries(['beans', 'recipes', 'steps', 'records'].map((kind, index) =>
  [kind, `${index + 1}1111111-1111-4111-8111-111111111111`]));
const recipe = () => ({
  id: RECIPE, name: 'Before', beanId: null, favorite: false, dripper: 'V60', dose: 15,
  grind: 'medium', grinder: 'C40', grinderSetting: '24', microns: 700,
  temperature: 92, totalWater: 250, extractionGuide: 'steady pour',
  steps: [{ id: '44444444-4444-4444-8444-444444444444', name: 'Bloom', order: 1, seconds: 0, interval: 0, water: 50, cumulativeWater: 50 },
    { id: '55555555-5555-4555-8555-555555555555', name: 'Pour', order: 2, seconds: 60, interval: 60, water: 200, cumulativeWater: 250 }],
});

function harness(executeStatus = 'succeeded', prepareError = null) {
  let currentRoute = `/recipes/${RECIPE}/edit`;
  let currentRecipe = recipe();
  let journal = { operations: [], activeConnectionRevision: REVISION, connectionGuard: null };
  let rawSteps = [];
  const pageMap = new Map();
  let currentData = null;
  const calls = { prepare: [], execute: 0, detailReads: 0, invalidatedParents: [], clearedOptions: [], clearedDrafts: [], pageReads: [], statuses: [] };
  const connection = { schemaVersion: 1, revision: REVISION, token: 'test-only-token', dataSources };
  const context = {
    async inspect() { return { initialized: true, blocked: false }; },
    async readJournal() { return journal; },
    async confirmResolution(key, options) {
      const operation = journal.operations.find(item => item.key === key);
      if (!operation) throw Object.assign(new Error(), { code: 'invalid-resolution' });
      const evidence = await options.freshRead(operation);
      journal = { ...journal, operations: journal.operations.filter(item => item.key !== key) };
      return evidence;
    },
    async beginConnectionChange() {},
    async commitConnectionChange() {},
  };
  const view = {
    currentRoute: () => currentRoute,
    setState() {}, showStatus(status) { calls.statuses.push(status); }, clearStatus() {}, showConnection() {}, setRouteReadState() {},
    renderData(value) { currentData = value; },
    clearSearchOptions(kind) { calls.clearedOptions.push(kind); },
    clearForm(kind) { calls.clearedForm = kind; },
    clearDraft(...args) { calls.clearedDrafts.push(args); },
    showEntrySuccess() { return false; },
    showUnresolved(items) { calls.unresolved = items; },
  };
  const app = createAppController({
    view,
    state: { withWriteLock: action => action(context) },
    file: { async readConnection() { return connection; } },
    makeClient: () => ({
      async verify() {}, beanFavoriteSupported: true, recipeFavoriteSupported: true,
      async queryAll(kind) { return kind === 'steps' ? structuredClone(rawSteps) : []; },
      async getPage(id) { calls.pageReads.push(id); return structuredClone(pageMap.get(id)); },
    }),
    makeRepository: () => ({
      async getRecipeDetail() { calls.detailReads++; return structuredClone(currentRecipe); },
      async readAll() { return { beans: [], recipes: [structuredClone(currentRecipe)], records: [], steps: rawSteps }; },
      async listRecords() { return { items: [], beans: [], recipes: [], nextCursor: null, hasMore: false, complete: true }; },
      invalidateRecordParentCache(kind) { calls.invalidatedParents.push(kind); },
    }),
    makeCommands: () => ({
      async prepareEditRecipe(...args) {
        if (prepareError) throw prepareError;
        calls.prepare.push(args);
        return { args };
      },
      async execute(draft) {
        calls.execute++;
        if (executeStatus === 'succeeded') {
          currentRecipe = { ...currentRecipe, ...draft.args[2] };
          return { status: 'succeeded', value: { id: RECIPE } };
        }
        const status = executeStatus;
        journal = { ...journal, operations: [{ key: 'edit-operation', kind: 'edit-recipe', status,
          connectionRevision: REVISION, targetFingerprint: 'private-target-fingerprint', createdPages: [],
          editTarget: { recipeId: RECIPE, pages: [{ action: 'update' }, { action: 'create' }] } }] };
        return { status, code: status };
      },
    }),
  });
  function setRecovery(operation, nextRecipe, pages, steps) {
    journal = { ...journal, operations: [operation] };
    currentRecipe = structuredClone(nextRecipe);
    rawSteps = structuredClone(steps);
    pageMap.clear();
    for (const page of pages) pageMap.set(page.id, structuredClone(page));
  }
  return { app, calls, data: () => currentData, route: () => currentRoute, setRecovery };
}

function rawStep(step, archived = false) {
  const properties = encodeProperties('steps', { ...step, recipeId: RECIPE });
  properties['레시피'].type = 'relation';
  properties['레시피'].has_more = false;
  return { id: step.id, parent: { type: 'data_source_id', data_source_id: dataSources.steps },
    in_trash: archived, archived, properties };
}

function rawRecipe(values, number = null) {
  const properties = encodeProperties('recipes', values);
  properties['분쇄 입자 굵기(μm)'] = { number };
  return { id: RECIPE, parent: { type: 'data_source_id', data_source_id: dataSources.recipes },
    in_trash: false, archived: false, properties };
}

test('successful recipe edit reaches the controller and reloads the latest full recipe', async () => {
  const h = harness();
  await h.app.initialize();
  const baseline = h.data().recipes.find(item => item.id === RECIPE);
  const result = await h.app.submit('edit-recipe', { recipeId: RECIPE, baseline,
    changes: { ...baseline, name: 'After' } });

  assert.equal(result.status, 'succeeded');
  assert.equal(h.calls.prepare.length, 1);
  assert.equal(h.calls.prepare[0][0], RECIPE);
  assert.equal(h.calls.prepare[0][1].name, 'Before');
  assert.equal(h.calls.prepare[0][2].name, 'After');
  assert.equal(h.calls.execute, 1);
  assert.equal(h.data().recipes[0].name, 'After', 'the route is read again after the write');
  assert.ok(h.calls.detailReads >= 2, 'a fresh full detail read verifies the post-write view');
  assert.deepEqual(h.calls.invalidatedParents, ['recipes']);
  assert.ok(h.calls.clearedOptions.includes('recipes'));
  assert.equal(h.calls.clearedForm, 'recipes');
  assert.deepEqual(h.calls.clearedDrafts, [['recipes', RECIPE]]);
});

test('unsupported range reports the missing Notion rich_text property', async () => {
  const h = harness('succeeded', Object.freeze({ code: 'micron-range-unsupported', writeState: 'not-sent' }));
  await h.app.initialize();
  const baseline = recipe();
  await assert.rejects(h.app.submit('edit-recipe', { recipeId: RECIPE, baseline,
    changes: { ...baseline, microns: '900~1000' } }), error => error.code === 'micron-range-unsupported');
  assert.match(h.calls.statuses.at(-1).message, /분쇄 입자 범위\(μm\).*rich_text/);
});

for (const status of ['unknown', 'partial']) {
  test(`${status} recipe edit remains unresolved and cannot be blindly resubmitted`, async () => {
    const h = harness(status);
    await h.app.initialize();
    const baseline = h.data().recipes.find(item => item.id === RECIPE);
    const result = await h.app.submit('edit-recipe', { recipeId: RECIPE, baseline,
      changes: { ...baseline, name: 'After' } });

    assert.equal(result.status, status);
    assert.equal(h.calls.execute, 1);
    assert.equal(h.calls.unresolved.length, 1);
    assert.equal(h.calls.unresolved[0].kind, 'edit-recipe');
    await assert.rejects(h.app.submit('edit-recipe', { recipeId: RECIPE, baseline,
      changes: { ...baseline, name: 'After' } }), error => error.code === 'unresolved-operation');
    assert.equal(h.calls.execute, 1, 'the unresolved result is never retried automatically');
  });
}

test('edit recovery checks every journaled step page state before resolving an exact after-state', async () => {
  const h = harness();
  await h.app.initialize();
  const before = recipe();
  const after = { ...before, steps: [{ ...before.steps[0], name: 'Changed bloom' }] };
  const beforeStep = stepPageValues(before.steps[0]);
  const afterStep = stepPageValues(after.steps[0]);
  const target = { recipeId: RECIPE,
    beforeFingerprint: await recipeFingerprint(recipeEditState(before, before.steps.map(step => step.id))),
    afterFingerprint: await recipeFingerprint(recipeEditState(after, before.steps.map(step => step.id))),
    beforeStepIds: before.steps.map(step => step.id),
    pages: [
      { kind: 'steps', id: before.steps[0].id, action: 'update',
        beforeFingerprint: await recipeFingerprint(beforeStep), afterFingerprint: await recipeFingerprint(afterStep), state: 'unknown' },
      { kind: 'steps', id: before.steps[1].id, action: 'archive',
        beforeFingerprint: await recipeFingerprint(stepPageValues(before.steps[1])), afterFingerprint: null, state: 'unknown' },
    ],
  };
  const operation = { key: 'edit-operation', kind: 'edit-recipe', status: 'unknown', connectionRevision: REVISION,
    targetFingerprint: await recipeFingerprint(dataSources), createdPages: [], editTarget: target };
  const pages = [rawStep(after.steps[0]), rawStep(before.steps[1], true)];
  h.setRecovery(operation, after, pages, pages);

  await h.app.resolveOperation(operation.key, { originalConfirmed: true, decision: 'saved' });
  assert.deepEqual(h.calls.pageReads, before.steps.map(step => step.id), 'the update and archive ledger entries are each reread');
});

test('edit recovery checks all ledger pages for an exact before-state and rejects an extra active new step', async () => {
  const h = harness();
  await h.app.initialize();
  const before = recipe();
  const after = { ...before, steps: [{ ...before.steps[0], name: 'Changed bloom' }] };
  const target = { recipeId: RECIPE,
    beforeFingerprint: await recipeFingerprint(recipeEditState(before, before.steps.map(step => step.id))),
    afterFingerprint: await recipeFingerprint(recipeEditState(after, before.steps.map(step => step.id))),
    beforeStepIds: before.steps.map(step => step.id),
    pages: [
      { kind: 'steps', id: before.steps[0].id, action: 'update',
        beforeFingerprint: await recipeFingerprint(stepPageValues(before.steps[0])),
        afterFingerprint: await recipeFingerprint(stepPageValues(after.steps[0])), state: 'unknown' },
      { kind: 'steps', id: before.steps[1].id, action: 'archive',
        beforeFingerprint: await recipeFingerprint(stepPageValues(before.steps[1])), afterFingerprint: null, state: 'unknown' },
    ],
  };
  const operation = { key: 'edit-operation', kind: 'edit-recipe', status: 'unknown', connectionRevision: REVISION,
    targetFingerprint: await recipeFingerprint(dataSources), createdPages: [], editTarget: target };
  const pages = before.steps.map(step => rawStep(step));
  h.setRecovery(operation, before, pages, pages);

  await h.app.resolveOperation(operation.key, { originalConfirmed: true, decision: 'not-saved' });
  assert.deepEqual(h.calls.pageReads, before.steps.map(step => step.id), 'before-state confirmation also rereads every updated or archived page');

  const hWithStray = harness();
  await hWithStray.app.initialize();
  const stray = rawStep({ id: '66666666-6666-4666-8666-666666666666', name: 'Unplanned', order: 3,
    seconds: 90, interval: 30, water: 10, cumulativeWater: 260 });
  const extraPages = [...pages, stray];
  hWithStray.setRecovery(operation, before, extraPages, extraPages);
  await assert.rejects(hWithStray.app.resolveOperation(operation.key, { originalConfirmed: true, decision: 'not-saved' }),
    error => error.code === 'edit-state-mixed');
});

test('edit recovery rejects an archived step that remains active outside the full recipe projection', async () => {
  const h = harness();
  await h.app.initialize();
  const before = recipe();
  const after = { ...before, steps: [{ ...before.steps[0], name: 'Changed bloom' }] };
  const target = { recipeId: RECIPE,
    beforeFingerprint: await recipeFingerprint(recipeEditState(before, before.steps.map(step => step.id))),
    afterFingerprint: await recipeFingerprint(recipeEditState(after, before.steps.map(step => step.id))),
    beforeStepIds: before.steps.map(step => step.id),
    pages: [
      { kind: 'steps', id: before.steps[0].id, action: 'update',
        beforeFingerprint: await recipeFingerprint(stepPageValues(before.steps[0])),
        afterFingerprint: await recipeFingerprint(stepPageValues(after.steps[0])), state: 'unknown' },
      { kind: 'steps', id: before.steps[1].id, action: 'archive',
        beforeFingerprint: await recipeFingerprint(stepPageValues(before.steps[1])), afterFingerprint: null, state: 'unknown' },
    ],
  };
  const operation = { key: 'edit-operation', kind: 'edit-recipe', status: 'unknown', connectionRevision: REVISION,
    targetFingerprint: await recipeFingerprint(dataSources), createdPages: [], editTarget: target };
  const pages = [rawStep(after.steps[0]), rawStep(before.steps[1], false)];
  h.setRecovery(operation, after, pages, pages);

  await assert.rejects(h.app.resolveOperation(operation.key, { originalConfirmed: true, decision: 'saved' }),
    error => error.code === 'edit-state-mixed');
  assert.deepEqual(h.calls.pageReads, before.steps.map(step => step.id), 'the archived ledger page status is checked directly');
});

test('pre-upgrade edit journals still recognize the exact saved recipe fingerprint', async () => {
  const h = harness();
  await h.app.initialize();
  const before = recipe();
  const after = { ...before, microns: '900~1000', micronStorage: { number: null, range: '900~1000' } };
  const legacyFingerprint = async value => {
    const state = recipeEditState(value, value.steps.map(step => step.id));
    delete state.micronStorage;
    return recipeFingerprint(state);
  };
  const target = { recipeId: RECIPE,
    beforeFingerprint: await legacyFingerprint(before),
    afterFingerprint: await legacyFingerprint(after),
    beforeStepIds: before.steps.map(step => step.id),
    pages: [{ kind: 'recipes', id: RECIPE, action: 'update',
      beforeFingerprint: await recipeFingerprint(recipePageValues(before)),
      afterFingerprint: await recipeFingerprint(recipePageValues(after)), state: 'unknown' }] };
  const operation = { key: 'edit-operation', kind: 'edit-recipe', status: 'unknown', connectionRevision: REVISION,
    targetFingerprint: await recipeFingerprint(dataSources), createdPages: [], editTarget: target };
  h.setRecovery(operation, after, [rawRecipe(after)], []);

  await h.app.resolveOperation(operation.key, { originalConfirmed: true, decision: 'saved' });
  assert.deepEqual(h.calls.pageReads, [RECIPE]);
});

test('particle edit recovery rejects a stale numeric alternate on the first parent read', async () => {
  const h = harness();
  await h.app.initialize();
  const before = { ...recipe(), microns: 700 };
  const after = { ...before, microns: '900~1000', micronStorage: { number: null, range: '900~1000' } };
  const target = { recipeId: RECIPE,
    beforeFingerprint: await recipeFingerprint(recipeEditState(before, before.steps.map(step => step.id))),
    afterFingerprint: await recipeFingerprint(recipeEditState(after, before.steps.map(step => step.id))),
    beforeStepIds: before.steps.map(step => step.id),
    pages: [{ kind: 'recipes', id: RECIPE, action: 'update',
      beforeFingerprint: await recipeFingerprint(recipePageValues(before)),
      afterFingerprint: await recipeFingerprint(recipePageValues(after)), state: 'unknown' }],
    micronAssertion: { before: { number: 700, range: '' }, after: { number: null, range: '900~1000' } } };
  const operation = { key: 'edit-operation', kind: 'edit-recipe', status: 'unknown', connectionRevision: REVISION,
    targetFingerprint: await recipeFingerprint(dataSources), createdPages: [], editTarget: target };
  h.setRecovery(operation, { ...after, micronStorage: { number: 700, range: '900~1000' } }, [rawRecipe(after, 700)], []);

  await assert.rejects(h.app.resolveOperation(operation.key, { originalConfirmed: true, decision: 'saved' }),
    error => error.code === 'edit-state-mixed');
  assert.deepEqual(h.calls.pageReads, [], 'the first parent read rejects the stale alternate before direct page reads');
});

test('particle edit recovery rejects a stale numeric alternate on the direct parent GET', async () => {
  const h = harness();
  await h.app.initialize();
  const before = { ...recipe(), microns: 700 };
  const after = { ...before, microns: '900~1000', micronStorage: { number: null, range: '900~1000' } };
  const target = { recipeId: RECIPE,
    beforeFingerprint: await recipeFingerprint(recipeEditState(before, before.steps.map(step => step.id))),
    afterFingerprint: await recipeFingerprint(recipeEditState(after, before.steps.map(step => step.id))),
    beforeStepIds: before.steps.map(step => step.id),
    micronAssertion: { before: { number: 700, range: '' }, after: { number: null, range: '900~1000' } },
    pages: [{ kind: 'recipes', id: RECIPE, action: 'update',
      beforeFingerprint: await recipeFingerprint(recipePageValues(before)),
      afterFingerprint: await recipeFingerprint(recipePageValues(after)), state: 'unknown' }] };
  const operation = { key: 'edit-operation', kind: 'edit-recipe', status: 'unknown', connectionRevision: REVISION,
    targetFingerprint: await recipeFingerprint(dataSources), createdPages: [], editTarget: target };
  h.setRecovery(operation, after, [rawRecipe(after, 700)], before.steps.map(step => rawStep(step)));

  await assert.rejects(h.app.resolveOperation(operation.key, { originalConfirmed: true, decision: 'saved' }),
    error => error.code === 'edit-state-mixed');
  assert.deepEqual(h.calls.pageReads, [RECIPE], 'the fresh collection is clean; the direct GET exposes the stale alternate');
});
