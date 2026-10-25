import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { buildPages } from '../scripts/build-pages.mjs';
import { memoryPlatform, fakePwaNotion, testConnection, DATA_SOURCES } from './fixtures/pwa-environment.mjs';

async function app(t) {
  const outputDir = await mkdtemp(path.join(os.tmpdir(), 'bean-pocket-product-'));
  t.after(() => rm(outputDir, { recursive: true, force: true }));
  await buildPages({ outputDir });
  const module = file => import(pathToFileURL(path.join(outputDir, file)).href);
  const [{ NotionClient }, { createReadRepository }, { createSubmissionState }, { createCommands }] = await Promise.all([
    module('data/notion-client.mjs'), module('data/read-repository.mjs'),
    module('state/submission-state.mjs'), module('commands/index.mjs'),
  ]);
  const native = memoryPlatform();
  const fake = fakePwaNotion();
  const connection = testConnection();
  const client = new NotionClient(connection.token, { dataSources: connection.dataSources,
    connectionRevision: connection.revision, fetchImpl: fake.fetch });
  const repository = createReadRepository(client);
  const submissionState = createSubmissionState(native);
  const commands = createCommands({ client, repository, submissionState });
  await client.verify();
  const save = async (kind, payload) => {
    const draft = await commands['prepare' + kind](payload);
    const result = await commands.execute(draft);
    assert.equal(result.status, 'succeeded');
    return result.value;
  };
  const restartCommands = () => createCommands({ client, repository, submissionState: createSubmissionState(native) });
  return { fake, native, client, repository, commands, save, restartCommands };
}

const recipeInput = beanId => ({ name: 'V60', beanId, dose: 15, totalWater: 250, temperature: 93,
  extractionGuide: '교반 없음\n목표 추출 완료 시간: 2분 30초',
  steps: [{ time: '0:00', water: 50 }, { time: '0:30', water: 100 }, { time: '1:10', water: 100 }] });

test('release modules: connection → beans/bags/recipe → copy → repeated records → fresh data', async t => {
  const { fake, native, repository, commands, save } = await app(t);
  const bean = await save('Bean', { name: '에티오피아', origin: '시다마 · 테스트 농장' });
  const firstBag = await save('Bag', { name: '첫 봉지', beanId: bean.id, roastedOn: '2026-10-01' });
  await save('Bag', { name: '두 번째 봉지', beanId: bean.id, roastedOn: '2026-10-15' });
  const recipe = await save('Recipe', recipeInput(bean.id));
  assert.equal(recipe.extractionGuide, '교반 없음\n목표 추출 완료 시간: 2분 30초');
  for (const rating of [1, 5]) await save('Record', { beanId: bean.id, recipeId: recipe.id, date: '2026-10-19', rating });
  let data = await repository.readAll();
  assert.equal(data.beans[0].origin, '시다마 · 테스트 농장');
  assert.equal(data.bags.length, 2);
  assert.equal(data.recipes[0].steps[2].interval, 40);
  assert.equal(data.recipes[0].steps[2].cumulativeWater, 250);
  assert.deepEqual(data.recipes[0].stats, { count: 2, average: 3 });
  const copied = await commands.execute(await commands.prepareCopy(recipe.id, { name: '복사', temperature: 90 }));
  assert.equal(copied.status, 'succeeded');
  assert.equal(copied.value.extractionGuide, recipe.extractionGuide);
  assert.notEqual(copied.value.id, recipe.id);
  assert.notEqual(copied.value.steps[0].id, recipe.steps[0].id);
  data = await repository.readAll();
  assert.deepEqual(data.recipes.find(item => item.id === copied.value.id).stats, { count: 0, average: null });
  assert.equal(data.recipes.find(item => item.id === recipe.id).temperature, 93);
  const original = fake.rows.find(row => row.id === recipe.id);
  original.properties['물 온도(℃)'].number = 91;
  original.last_edited_time = '2026-10-19T01:00:00.000Z';
  await save('Record', { beanId: bean.id, recipeId: recipe.id, bagId: firstBag.id, date: '2026-10-19', rating: 4 });
  data = await repository.readAll();
  assert.deepEqual(data.records.map(record => record.snapshot.recipe.temperature), [93, 93, 91]);
  assert.ok(data.records.every(record => record.snapshot.recipe.extractionGuide === recipe.extractionGuide));
  assert.ok(data.records.every(record => record.snapshot.recipe.steps.length === 3));
  assert.equal(native.journal().operations.every(operation => operation.status === 'succeeded'), true);
  assert.equal(JSON.stringify(native.journal()).includes('test-only-credential'), false);
});

test('release modules: partial recipe is hidden and rejected writes cancel only known new pages', async t => {
  const { fake, repository, commands, save, native } = await app(t);
  const bean = await save('Bean', { name: '테스트 원두' });
  fake.intercept = ({ pathname, method, body }) => {
    if (pathname === '/v1/pages' && method === 'POST' && body.parent.data_source_id === DATA_SOURCES.steps &&
        body.properties['순서'].number === 2) return Response.json({}, { status: 429 });
  };
  const result = await commands.execute(await commands.prepareRecipe(recipeInput(bean.id)));
  assert.equal(result.status, 'failed');
  assert.equal((await repository.readAll()).recipes.length, 0);
  assert.equal(fake.rows.find(row => row.id === bean.id).in_trash, false);
  assert.ok(native.journal().operations.at(-1).createdPages.every(page => page.archiveState === 'archived'));
});

test('release modules: lost response persists unknown and blocks a new intent after restart', async t => {
  const { fake, commands, native, save, restartCommands } = await app(t);
  await save('Bean', { name: '먼저 저장한 원두' });
  fake.intercept = ({ pathname, method }) => {
    if (pathname === '/v1/pages' && method === 'POST') throw new TypeError('Simulated response loss');
  };
  const result = await commands.execute(await commands.prepareBean({ name: '불확실 원두' }));
  assert.equal(result.status, 'unknown');
  const before = fake.calls.length;
  const restarted = restartCommands();
  await assert.rejects(restarted.execute(await restarted.prepareBean({ name: '새 요청으로 우회' })));
  assert.equal(fake.calls.length, before);
  assert.equal(native.journal().operations.at(-1).status, 'unknown');
});
