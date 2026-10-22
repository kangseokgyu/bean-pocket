import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { buildPages } from '../scripts/build-pages.mjs';

const directory = await mkdtemp(path.join(os.tmpdir(), 'bean-pocket-domain-'));
after(() => rm(directory, { recursive: true, force: true }));
const outputDir = path.join(directory, 'dist');
const domainFile = path.join(outputDir, 'domain.mjs');
const originalDomain = await readFile(new URL('../lib/domain.mjs', import.meta.url), 'utf8');
const version = await buildPages({ outputDir });
async function loadDomain() {
  assert.ok(await readFile(domainFile).catch(() => null), '배포 폴더에 원본 도메인 모듈이 공급되어야 한다');
  return import(pathToFileURL(domainFile));
}
function recipe() {
  return {
    id: 'r', beanId: 'b', name: '드립', dose: 15, temperature: 93, totalWater: 250,
    steps: [{ time: '0:00', water: 50 }, { time: '0:30', water: 100 }, { time: '1:10', water: 100 }],
  };
}

test('배포된 domain.mjs는 lib/domain.mjs 원본과 바이트가 같다', async () => {
  assert.equal(await readFile(domainFile, 'utf8'), originalDomain);
});

test('공급한 원본 도메인 변경이 배포 버전에 반영된다', async () => {
  const domainSource = path.join(directory, 'alternate-domain.mjs');
  await writeFile(domainSource, originalDomain + '\n// domain revision\n');
  const changed = await buildPages({ outputDir: path.join(directory, 'changed'), domainSource });
  assert.notEqual(changed, version);
  assert.equal(await readFile(path.join(directory, 'changed/domain.mjs'), 'utf8'), originalDomain + '\n// domain revision\n');
});

test('정적 모듈의 시간·간격·누적 물 양과 입력 검증이 유지된다', async () => {
  const d = await loadDomain();
  assert.equal(d.formatTime(d.parseTime('1:10')), '1:10');
  assert.deepEqual(d.calculateSteps(recipe().steps).map(s => [s.seconds, s.interval, s.water, s.cumulativeWater]),
    [[0, 0, 50, 50], [30, 30, 100, 150], [70, 40, 100, 250]]);
  for (const steps of [[{ time: '0:10', water: 250 }], [{ time: '0:00', water: 0 }],
    [{ time: '0:00', water: 50 }, { time: '0:00', water: 200 }]]) {
    assert.throws(() => d.validateRecipe({ ...recipe(), steps }), d.InputError);
  }
  for (const patch of [{ dose: 0 }, { totalWater: 251 }, { temperature: 0 }, { temperature: 101 }, { microns: -1 }]) {
    assert.throws(() => d.validateRecipe({ ...recipe(), ...patch }), d.InputError);
  }
  assert.equal(d.validateRecipe({ ...recipe(), microns: 600 }).microns, 600);
  assert.equal(d.validateRecipe(recipe()).microns, null);
});

test('정적 모듈의 날짜·정수 별점·원두 관계와 빈 평균 의미가 유지된다', async () => {
  const d = await loadDomain();
  assert.equal(d.validateBean({ name: '원두' }).name, '원두');
  assert.equal(d.validateBag({ name: '봉지', beanId: 'b' }).roastedOn, null);
  assert.throws(() => d.validateDate('2026-02-30'), d.InputError);
  for (const rating of [0, 6, 1.5, '', [4]]) {
    assert.throws(() => d.validateRecord({ date: '2026-10-18', rating }, recipe(), { id: 'b' }), d.InputError);
  }
  assert.throws(() => d.validateRecord({ date: '2026-10-18', rating: 4 }, recipe(), { id: 'b' }, { beanId: 'other' }), d.InputError);
  assert.equal(d.validateRecord({ date: '2026-10-18', rating: 5 }, recipe(), { id: 'b' }).rating, 5);
  assert.deepEqual(d.summarizeRatings([], 'r'), { count: 0, average: null });
  assert.deepEqual(d.summarizeRatings([{ recipeId: 'r', rating: 1 }, { recipeId: 'r', rating: 5 },
    { recipeId: 'other', rating: 5 }], 'r'), { count: 2, average: 3 });
});

test('공급 모듈의 복사·스냅샷은 원본 조건·단계·평가를 공유하지 않는다', async () => {
  const d = await loadDomain();
  const source = { ...recipe(), stats: { count: 2, average: 3 } };
  source.steps[0].id = 'step';
  source.steps[0].recipeId = 'r';
  const copy = d.copyRecipe(source);
  const snapshot = d.createSnapshot({ id: 'b', name: '원두' }, source);
  copy.temperature = 90;
  copy.steps[0].water = 99;
  source.steps[1].water = 1;
  assert.equal(source.temperature, 93);
  assert.equal(source.steps[0].water, 50);
  assert.equal(copy.id, undefined);
  assert.equal(copy.stats, undefined);
  assert.equal(copy.steps[0].id, undefined);
  assert.equal(copy.steps[0].recipeId, undefined);
  assert.equal(snapshot.recipe.temperature, 93);
  assert.equal(snapshot.recipe.steps[1].water, 100);
  assert.equal(snapshot.recipe.stats, undefined);
  assert.equal(snapshot.version, 2);
});
