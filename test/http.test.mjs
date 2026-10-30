import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createApp } from '../server.mjs';
import { DATA_SOURCES } from './fixtures/notion-config.mjs';

function fakeNotion({ recordBeanRelation = true } = {}) {
  const rows = [];
  const calls = [];
  let sequence = 0;
  const mock = {
    rows,
    calls,
    rejectToken: null,
    failStep: false,
    beforeRequest: null,
    beforeCreateStep: null,
    fetch: async (url, options) => {
      const path = new URL(url).pathname;
      const body = options.body ? JSON.parse(options.body) : {};
      calls.push({ path, method: options.method, token: options.headers.Authorization });
      const intercepted = await mock.beforeRequest?.(path, options, body);
      if (intercepted) return intercepted;
      if (options.headers.Authorization === `Bearer ${mock.rejectToken}`) {
        return Response.json({ message: mock.rejectToken }, { status: 401 });
      }
      if (path.startsWith('/v1/data_sources/')) {
        const id = path.split('/')[3];
        if (!Object.values(DATA_SOURCES).includes(id)) return Response.json({}, { status: 404 });
        if (options.method === 'GET') {
          const properties = {};
          if (id === DATA_SOURCES.recipes) properties['추출 가이드'] = { type: 'rich_text' };
          if (id === DATA_SOURCES.records && recordBeanRelation) {
            properties['원두'] = { type: 'relation', relation: { data_source_id: DATA_SOURCES.beans } };
          }
          return Response.json({ id, properties });
        }
        return Response.json({ results: rows.filter(row => row.parent.data_source_id === id && !row.archived), has_more: false });
      }
      if (path === '/v1/pages') {
        if (body.parent.data_source_id === DATA_SOURCES.steps) await mock.beforeCreateStep?.();
        if (mock.failStep && body.parent.data_source_id === DATA_SOURCES.steps) {
          return Response.json({}, { status: 400 });
        }
        const row = { id: 'page-' + (++sequence), parent: body.parent, properties: body.properties };
        rows.push(row);
        return Response.json(row);
      }
      if (options.method === 'PATCH') {
        const row = rows.find(row => row.id === path.split('/').at(-1));
        row.archived = body.archived;
        return Response.json(row);
      }
      return Response.json({}, { status: 404 });
    },
  };
  return mock;
}

async function setup(t) {
  const fake = fakeNotion();
  const server = createApp({ fetchImpl: fake.fetch, initialToken: '', dataSources: DATA_SOURCES });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  t.after(() => new Promise(resolve => server.close(resolve)));
  const origin = 'http://127.0.0.1:' + server.address().port;
  const request = async (path, body, headers = {}) => {
    const response = await fetch(origin + path, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { Origin: origin, 'Content-Type': 'application/json', ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: response.status, body: await response.json() };
  };
  return { fake, request, origin };
}

function recipeInput() {
  return {
    name: 'V60', dripper: 'V60', dose: 15, totalWater: 250, temperature: 93,
    extractionGuide: '교반 없음\n목표 추출 완료 시간: 2분 30초',
    steps: [
      { name: '뜸', time: '0:00', water: 50 },
      { name: '1차', time: '0:30', water: 100 },
      { name: '2차', time: '1:10', water: 100 },
    ],
  };
}

test('임의의 호스트에서 조회와 같은 출처의 연결 요청을 허용한다', async t => {
  const { origin } = await setup(t);
  const port = new URL(origin).port;
  for (const host of ['127.0.0.1', 'localhost', 'app.example.test', 'other.example.test']) {
    for (const method of ['GET', 'POST']) {
      const status = await new Promise((resolve, reject) => {
        const req = http.request(origin + (method === 'GET' ? '/api/status' : '/api/connect'), {
          method,
          headers: { Host: `${host}:${port}`, Origin: `http://${host}:${port}`, 'Content-Type': 'application/json' },
        }, response => {
          response.resume();
          response.on('end', () => resolve(response.statusCode));
        });
        req.on('error', reject);
        req.end(method === 'POST' ? JSON.stringify({ token: 'test-token' }) : undefined);
      });
      assert.equal(status, 200, `${method} ${host}`);
    }
  }
});

test('공개 HTTP 흐름: 연결→원두→레시피→평가→재조회, 봉지 쓰기는 비활성화', async t => {
  const { fake, request } = await setup(t);
  assert.equal((await request('/api/status')).body.connected, false);
  const connected = await request('/api/connect', { token: 'secret-test' });
  assert.equal(connected.status, 200);
  assert.equal(JSON.stringify(connected.body).includes('secret-test'), false);
  const bean = (await request('/api/beans', { name: '에티오피아' })).body;
  assert.ok(bean.id);
  const bagWrite = await request('/api/bags', { name: '구버전 봉지', beanId: bean.id, roastedOn: '2026-10-01' });
  assert.equal(bagWrite.status, 410);
  assert.equal(fake.rows.some(row => row.parent.data_source_id === DATA_SOURCES.bags), false);
  const input = recipeInput();
  const first = await request('/api/recipes', input, { 'Idempotency-Key': 'one' });
  assert.equal(first.status, 201);
  const duplicate = await request('/api/recipes', input, { 'Idempotency-Key': 'one' });
  assert.equal(duplicate.body.id, first.body.id);
  assert.equal(fake.rows.filter(row => row.parent.data_source_id === DATA_SOURCES.recipes).length, 1);
  const recipe = first.body;
  assert.equal(recipe.extractionGuide, input.extractionGuide);
  for (const rating of [4, 4.3, 5]) {
    const result = await request('/api/records', {
      beanId: bean.id, recipeId: recipe.id, date: '2026-10-15', rating,
      snapshot: { temperature: 1 }, temperature: 1,
    });
    assert.equal(result.status, 201);
    assert.equal(result.body.snapshot.version, 2);
    assert.equal(result.body.snapshot.bean.name, '에티오피아');
    assert.equal(result.body.snapshot.recipe.temperature, 93);
    assert.equal(result.body.snapshot.recipe.extractionGuide, input.extractionGuide);
    assert.deepEqual(result.body.snapshot.recipe.steps.map(step => step.water), [50, 100, 100]);
  }
  const before = (await request('/api/data')).body;
  assert.equal(before.beans.length, 1);
  assert.equal(Object.hasOwn(before, 'bags'), false);
  assert.equal(before.recipes[0].steps[2].interval, 40);
  assert.equal(before.recipes[0].steps[2].cumulativeWater, 250);
  assert.deepEqual(before.recipes[0].stats, { count: 3, average: 13.3 / 3 });
  assert.ok(before.records.some(record => record.rating === 4.3), 'a decimal rating survives storage and reload');
  assert.equal(before.records.length, 3);

  // Simulate a direct edit in Notion; old snapshots must stay intact.
  fake.rows.find(row => row.id === recipe.id).properties['물 온도(℃)'].number = 90;
  const firstStep = fake.rows.find(row => row.parent.data_source_id === DATA_SOURCES.steps);
  firstStep.properties['단계 이름'].title[0].text.content = '노션에서 바꾼 이름';
  const after = (await request('/api/data')).body;
  assert.equal(after.recipes[0].temperature, 90);
  assert.equal(after.records[0].snapshot.recipe.temperature, 93);
  assert.equal(after.records[0].snapshot.recipe.steps[0].name, '뜸');
  const newRecord = await request('/api/records', { beanId: bean.id, recipeId: recipe.id, date: '2026-10-15', rating: 1 });
  assert.equal(newRecord.body.snapshot.recipe.temperature, 90);
  assert.equal(newRecord.body.snapshot.recipe.steps[0].name, '노션에서 바꾼 이름');
  const copy = await request('/api/recipes', { ...input, name: '복사', temperature: 90, copyFromId: recipe.id });
  assert.equal(copy.status, 201);
  assert.notEqual(copy.body.id, recipe.id);
  assert.notEqual(copy.body.steps[0].id, recipe.steps[0].id);
  const final = (await request('/api/data')).body;
  assert.equal(final.recipes.find(item => item.id === copy.body.id).stats.count, 0);
  assert.equal(final.records.length, 4);
});

test('다른 Origin과 Host·Origin 불일치 및 잘못된 Content-Type 거부', async t => {
  const { request, origin } = await setup(t);
  assert.equal((await request('/api/connect', { token: 'secret' }, { Origin: 'https://evil.test' })).status, 403);
  assert.equal((await request('/api/connect', { token: 'secret' }, { 'Content-Type': 'text/plain' })).status, 415);
  const hostileHostStatus = await new Promise((resolve, reject) => {
    const req = http.request(origin + '/api/connect', {
      method: 'POST',
      headers: { Host: 'evil.test', Origin: origin, 'Content-Type': 'application/json' },
    }, response => {
      response.resume();
      resolve(response.statusCode);
    });
    req.on('error', reject);
    req.end(JSON.stringify({ token: 'secret' }));
  });
  assert.equal(hostileHostStatus, 403);
});

test('기록의 bagId 제거, 날짜·별점 검증 및 독립 레시피 생성', async t => {
  const { fake, request } = await setup(t);
  await request('/api/connect', { token: 'secret' });
  assert.equal((await request('/api/bags', { beanId: 'foreign', name: 'x' })).status, 410);
  const bean = (await request('/api/beans', { name: 'a' })).body;
  const recipe = (await request('/api/recipes', recipeInput())).body;
  const record = { beanId: bean.id, recipeId: recipe.id, date: '2026-10-15', rating: 4 };
  assert.equal((await request('/api/records', { ...record, bagId: null })).status, 400);
  assert.equal((await request('/api/records', { ...record, bagId: 'legacy-page-id' })).status, 400);
  assert.equal((await request('/api/records', { ...record, recipeId: 'not-a-recipe' })).status, 400);
  assert.equal((await request('/api/records', { ...record, date: '2026-02-30' })).status, 400);
  for (const rating of [0, 5.1, 1.51, null, [4], true]) {
    assert.equal((await request('/api/records', { ...record, rating })).status, 400);
  }
  for (const rating of [0.1, 1, 1.5, 5]) assert.equal((await request('/api/records', { ...record, rating })).status, 201);
  const independent = await request('/api/recipes', { ...recipeInput(), beanId: 'not-a-bean' });
  assert.equal(independent.status, 201);
  assert.deepEqual(fake.rows.find(row => row.id === independent.body.id).properties['원두'], undefined);
});

test('legacy bagId=null 추출 요청은 Notion 읽기/쓰기 전에 거부한다', async t => {
  const { fake, request } = await setup(t);
  await request('/api/connect', { token: 'secret' });
  const bean = (await request('/api/beans', { name: '원두' })).body;
  const recipe = (await request('/api/recipes', recipeInput())).body;
  const before = fake.rows.length;
  const rejected = await request('/api/records', {
    beanId: bean.id, recipeId: recipe.id, bagId: null, date: '2026-10-22', rating: 4,
  });
  assert.equal(rejected.status, 400);
  assert.equal(fake.rows.length, before);
});

test('records.bean 관계가 없는 개인 스키마에서는 legacy 조회를 허용하고 신규 기록 쓰기를 보호한다', async t => {
  const fake = fakeNotion({ recordBeanRelation: false });
  const server = createApp({ fetchImpl: fake.fetch, initialToken: '', dataSources: DATA_SOURCES });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  t.after(() => new Promise(resolve => server.close(resolve)));
  const origin = 'http://127.0.0.1:' + server.address().port;
  const request = async (path, body) => {
    const response = await fetch(origin + path, { method: body === undefined ? 'GET' : 'POST',
      headers: { Origin: origin, 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
    return { status: response.status, body: await response.json() };
  };
  assert.equal((await request('/api/connect', { token: 'legacy-schema' })).status, 200);
  assert.deepEqual((await request('/api/data')).body, { beans: [], recipes: [], records: [] });
  const bean = (await request('/api/beans', { name: '원두' })).body;
  const recipe = (await request('/api/recipes', recipeInput())).body;
  assert.equal(recipe.id !== undefined, true);
  const beforeWrites = fake.rows.length;
  const saved = await request('/api/records', { beanId: bean.id, recipeId: recipe.id, date: '2026-10-22', rating: 4 });
  assert.equal(saved.status, 400);
  assert.match(saved.body.error, /records 데이터베이스에 원두 관계가 필요/);
  assert.equal(fake.rows.length, beforeWrites);
});

test('연결 검증 실패 시 기존 연결 유지·토큰 미노출·진짜 빈 DB는 빈 목록', async t => {
  const { fake, request } = await setup(t);
  await request('/api/connect', { token: 'good-token' });
  assert.deepEqual((await request('/api/data')).body, { beans: [], recipes: [], records: [] });
  assert.equal(fake.calls.filter(call => call.method === 'GET').length, 4);
  fake.rejectToken = 'bad-private-token';
  const failure = await request('/api/connect', { token: fake.rejectToken });
  assert.equal(failure.status, 502);
  assert.equal(JSON.stringify(failure.body).includes(fake.rejectToken), false);
  const status = await request('/api/status');
  assert.equal(status.body.connected, true);
  assert.equal(JSON.stringify(status.body).includes('good-token'), false);
  assert.equal((await request('/api/beans', { name: '기존 토큰으로 저장' })).status, 201);
  assert.equal(fake.calls.at(-1).token, 'Bearer good-token');
});

test('동시 중복 POST는 한 번 저장하고 다른 내용의 같은 키는 충돌', async t => {
  const { request } = await setup(t);
  await request('/api/connect', { token: 'secret' });
  const headers = { 'Idempotency-Key': 'same-bean' };
  const results = await Promise.all([
    request('/api/beans', { name: '한 원두' }, headers),
    request('/api/beans', { name: '한 원두' }, headers),
  ]);
  assert.equal(results[0].body.id, results[1].body.id);
  assert.equal((await request('/api/data')).body.beans.length, 1);
  assert.equal((await request('/api/beans', { name: '다른 원두' }, headers)).status, 409);
});

test('HTTP 단계 저장 실패는 성공으로 응답하지 않고 노출된 부분 저장을 취소', async t => {
  const { fake, request } = await setup(t);
  await request('/api/connect', { token: 'secret' });
  const bean = (await request('/api/beans', { name: '원두' })).body;
  fake.failStep = true;
  const result = await request('/api/recipes', recipeInput(bean.id), { 'Idempotency-Key': 'failed-recipe' });
  assert.equal(result.status, 502);
  assert.match(result.body.error, /취소/);
  assert.equal((await request('/api/data')).body.recipes.length, 0);
  const replay = await request('/api/recipes', recipeInput(bean.id), { 'Idempotency-Key': 'failed-recipe' });
  assert.equal(replay.status, 502);
  assert.equal(fake.rows.filter(row => row.parent.data_source_id === DATA_SOURCES.recipes).length, 2);
});

test('회귀 1: 중간 단계 삭제는 새 요청 키, 같은 전체 payload는 같은 키로 저장', async t => {
  const { createSubmissionKeys } = await import('../public/submission.mjs');
  const keys = createSubmissionKeys();
  const { request } = await setup(t);
  await request('/api/connect', { token: 'secret' });
  const bean = (await request('/api/beans', { name: '원두' })).body;
  const invalid = { ...recipeInput(bean.id), totalWater: 150 };
  const invalidKey = keys.forPayload(invalid);
  assert.equal((await request('/api/recipes', invalid, { 'Idempotency-Key': invalidKey })).status, 400);
  const corrected = { ...invalid, steps: [invalid.steps[0], invalid.steps[2]] };
  const correctedKey = keys.forPayload(corrected);
  assert.notEqual(correctedKey, invalidKey);
  assert.equal(keys.forPayload(structuredClone(corrected)), correctedKey);
  const saved = await request('/api/recipes', corrected, { 'Idempotency-Key': correctedKey });
  assert.equal(saved.status, 201);
  const replay = await request('/api/recipes', corrected, { 'Idempotency-Key': keys.forPayload(corrected) });
  assert.equal(replay.body.id, saved.body.id);
  assert.equal((await request('/api/data')).body.recipes.length, 1);
});

test('회귀 2: 429와 저장 전 조회 실패는 같은 키로 복구되며 불확실 쓰기는 중복 금지', async t => {
  const { fake, request } = await setup(t);
  await request('/api/connect', { token: 'secret' });
  let rejected = false;
  fake.beforeRequest = async path => {
    if (path === '/v1/pages' && !rejected) {
      rejected = true;
      return Response.json({}, { status: 429 });
    }
  };
  const headers = { 'Idempotency-Key': 'rate-limit' };
  assert.equal((await request('/api/beans', { name: '한 원두' }, headers)).status, 429);
  const saved = await request('/api/beans', { name: '한 원두' }, headers);
  assert.equal(saved.status, 201);
  assert.equal((await request('/api/data')).body.beans.length, 1);

  const recipe = (await request('/api/recipes', recipeInput())).body;
  fake.beforeRequest = async path => {
    if (path.includes('/query')) throw Error('조회 연결 실패');
  };
  const record = { beanId: saved.body.id, recipeId: recipe.id, date: '2026-10-22', rating: 4 };
  const queryHeaders = { 'Idempotency-Key': 'query-failure' };
  assert.equal((await request('/api/records', record, queryHeaders)).status, 502);
  fake.beforeRequest = null;
  assert.equal((await request('/api/records', record, queryHeaders)).status, 201);

  let writes = 0;
  fake.beforeRequest = async path => {
    if (path === '/v1/pages') {
      writes++;
      throw Error('쓰기 응답 유실');
    }
  };
  const uncertainHeaders = { 'Idempotency-Key': 'uncertain-write' };
  assert.equal((await request('/api/beans', { name: '불확실' }, uncertainHeaders)).status, 502);
  fake.beforeRequest = null;
  assert.equal((await request('/api/beans', { name: '불확실' }, uncertainHeaders)).status, 502);
  assert.equal(writes, 1);
  assert.equal((await request('/api/data')).body.beans.length, 1);
});

test('회귀 3: 생성 중인 레시피는 조회·평가에서 제외하고 완료 후 전체 단계를 보존', async t => {
  const { fake, request } = await setup(t);
  await request('/api/connect', { token: 'secret' });
  const bean = (await request('/api/beans', { name: '원두' })).body;
  let releaseStep;
  let notifyStepStarted;
  const stepStarted = new Promise(resolve => { notifyStepStarted = resolve; });
  const stepReleased = new Promise(resolve => { releaseStep = resolve; });
  fake.beforeCreateStep = async () => {
    notifyStepStarted();
    await stepReleased;
  };
  const savingRecipe = request('/api/recipes', recipeInput(bean.id));
  let during;
  let blockedRecord;
  try {
    const started = await Promise.race([
      stepStarted.then(() => true),
      savingRecipe.then(result => {
        assert.equal(result.status, 201, 'recipe request must reach its ordered step writes');
        return false;
      }),
    ]);
    assert.equal(started, true);
    const recipeId = fake.rows.find(row => row.parent.data_source_id === DATA_SOURCES.recipes).id;
    during = await request('/api/data');
    blockedRecord = await request('/api/records', { recipeId, date: '2026-10-15', rating: 4 });
  } finally {
    releaseStep();
  }
  const saved = await savingRecipe;
  assert.equal(during.body.recipes.length, 0);
  assert.equal(blockedRecord.status, 400);
  assert.equal(saved.status, 201);
  const complete = (await request('/api/data')).body;
  assert.equal(complete.recipes[0].steps.length, 3);
  const record = await request('/api/records', { beanId: bean.id, recipeId: saved.body.id, date: '2026-10-15', rating: 4 });
  assert.equal(record.status, 201);
  assert.deepEqual(record.body.snapshot.recipe.steps.map(step => step.water), [50, 100, 100]);
});

test('회귀 3 추가: 직접 편집된 빈 단계·순서·총량 불일치는 조회·평가에서 제외', async t => {
  const { fake, request } = await setup(t);
  await request('/api/connect', { token: 'secret' });
  const bean = (await request('/api/beans', { name: '원두' })).body;
  const recipe = (await request('/api/recipes', recipeInput(bean.id))).body;
  const stages = fake.rows.filter(row => row.parent.data_source_id === DATA_SOURCES.steps);
  for (const defect of ['empty', 'order', 'total', 'derived']) {
    const originals = stages.map(row => structuredClone(row.properties));
    if (defect === 'empty') stages.forEach(row => { row.archived = true; });
    if (defect === 'order') stages[1].properties['순서'].number = 3;
    if (defect === 'total') stages[1].properties['이번에 붓는 물 양(g)'].number = 99;
    if (defect === 'derived') stages[1].properties['누적 물 양(g)'].number = 99;
    assert.equal((await request('/api/data')).body.recipes.length, 0, defect);
    assert.equal((await request('/api/records', { beanId: bean.id, recipeId: recipe.id, date: '2026-10-15', rating: 4 })).status, 400, defect);
    stages.forEach((row, index) => { row.properties = originals[index]; row.archived = false; });
  }
  assert.equal((await request('/api/data')).body.recipes.length, 1);
});

test('회귀 2·3 추가: 단계 응답 유실과 취소 실패 후에도 재쓰기·미완성 노출 금지', async t => {
  const { fake, request } = await setup(t);
  await request('/api/connect', { token: 'secret' });
  const bean = (await request('/api/beans', { name: '원두' })).body;
  let stepWrites = 0;
  fake.beforeRequest = async (path, options, body) => {
    if (path === '/v1/pages' && body.parent.data_source_id === DATA_SOURCES.steps) {
      stepWrites++;
      fake.rows.push({ id: 'lost-step', parent: body.parent, properties: body.properties });
      throw Error('페이지 생성 후 응답 유실');
    }
    if (options.method === 'PATCH') return Response.json({}, { status: 500 });
  };
  const input = { ...recipeInput(bean.id), steps: [{ name: '한 단계', time: '0:00', water: 250 }] };
  const headers = { 'Idempotency-Key': 'uncertain-stage' };
  const failure = await request('/api/recipes', input, headers);
  assert.equal(failure.status, 502);
  assert.match(failure.body.error, /복구에 실패/);
  fake.beforeRequest = null;
  assert.equal((await request('/api/recipes', input, headers)).status, 502);
  assert.equal(stepWrites, 1);
  // Even valid-looking stages cannot expose a recipe with failed rollback in this repository.
  assert.equal((await request('/api/data')).body.recipes.length, 0);
});

test('회귀 2 추가: 쓰기 5xx·성공 응답 JSON 유실은 같은 키에 재전송 금지', async t => {
  const { fake, request } = await setup(t);
  await request('/api/connect', { token: 'secret' });
  for (const failure of ['server', 'json']) {
    let writes = 0;
    fake.beforeRequest = async path => {
      if (path !== '/v1/pages') return;
      writes++;
      return failure === 'server'
        ? Response.json({}, { status: 500 })
        : new Response('broken json', { status: 200 });
    };
    const headers = { 'Idempotency-Key': 'uncertain-' + failure };
    assert.equal((await request('/api/beans', { name: failure }, headers)).status, 502);
    fake.beforeRequest = null;
    assert.equal((await request('/api/beans', { name: failure }, headers)).status, 502);
    assert.equal(writes, 1);
  }
});
