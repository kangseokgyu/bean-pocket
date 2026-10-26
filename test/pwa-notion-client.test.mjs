import test from 'node:test';
import assert from 'node:assert/strict';
import { NotionClient, validateCreatePayload } from '../pwa/data/notion-client.mjs';
import { schemas, encodeProperties, decodePage } from '../pwa/data/notion-properties.mjs';
import { encodeProperties as serverEncode, decodePage as serverDecode } from '../lib/notion.mjs';

// 전부 합성 값이다. 환경 파일·비공개 설정·실제 API를 사용하지 않는다.
const uuid = n => n.toString(16).padStart(8, '0') + '-1111-4111-8111-111111111111';
const kinds = ['beans', 'bags', 'recipes', 'steps', 'records'];
const SOURCES = Object.fromEntries(kinds.map((kind, i) => [kind, uuid(i + 1)]));
const REVISION = uuid(10), PAGE = uuid(20), OTHER = uuid(21);
const TOKEN = 'unit-credential-only', RAW = 'private-response-sentinel';
const RELATIONS = { bags: { beanId: 'beans' }, recipes: { beanId: 'beans' }, steps: { recipeId: 'recipes' }, records: { beanId: 'beans', recipeId: 'recipes', bagId: 'bags' } };
function source(kind) {
  return { object: 'data_source', id: SOURCES[kind], properties: Object.fromEntries(Object.entries(schemas[kind] || {}).map(([key, [name, type]]) =>
    [name, { type, ...(type === 'relation' ? { relation: { data_source_id: SOURCES[RELATIONS[kind][key]] } } : {}) }])) };
}
function page(id = PAGE, kind = 'beans', extra = {}) {
  return { object: 'page', id, properties: {}, parent: { type: 'data_source_id', data_source_id: SOURCES[kind] }, in_trash: false, archived: false, ...extra };
}
function list(results = [], has_more = false, next_cursor = null, extra = {}) {
  return { object: 'list', results, has_more, next_cursor, ...extra };
}
const response = (status, body, retryAfter) => ({
  status, ok: status >= 200 && status < 300,
  headers: { get: () => retryAfter ?? null },
  async json() { return body; },
});
function harness(handler = () => response(200, page()), options = {}) {
  const calls = [];
  const client = new NotionClient(TOKEN, {
    dataSources: { ...SOURCES }, connectionRevision: REVISION,
    fetchImpl: async (url, init) => { calls.push({ url, init }); return handler(url, init, calls.length); },
    timeoutMs: 100, ...options,
  });
  return { client, calls };
}
async function recordsHarness(handler = () => response(200, page(PAGE, 'records')), options = {}) {
  const { fetchImpl, ...clientOptions } = options;
  const h = harness((url, init, index) => {
    const kind = kinds.find(key => init.method === 'GET' && url.endsWith('/data_sources/' + SOURCES[key]));
    if (kind) return response(200, source(kind));
    return fetchImpl ? fetchImpl(url, init, index) : handler(url, init, index);
  }, clientOptions);
  await h.client.verify();
  h.calls.length = 0;
  return h;
}
function safe(error, state, code) {
  assert.ok(Object.isFrozen(error));
  assert.ok(!(error instanceof Error));
  const allowed = ['code', 'httpStatus', 'writeState', 'retryAfterSeconds'];
  assert.ok(Object.getOwnPropertyNames(error).every(key => allowed.includes(key)));
  assert.equal(typeof error.code, 'string'); assert.equal(error.writeState, state);
  if (code) assert.equal(error.code, code);
  assert.doesNotMatch(JSON.stringify(error), new RegExp(TOKEN + '|' + RAW + '|' + PAGE + '|' + SOURCES.beans + '|https?:|stack|cause|message'));
  return true;
}
const rejected = (promise, state, code) => assert.rejects(promise, error => safe(error, state, code));

test('validateCreatePayload reuses the create transport limits without issuing a request', () => {
  assert.equal(validateCreatePayload('beans', { name: '원두' }, SOURCES), true);
  for (const [kind, data, sources] of [
    ['unknown', { name: '원두' }, SOURCES],
    ['beans', { name: '원두' }, { ...SOURCES, beans: 'invalid' }],
    ['beans', { name: '가'.repeat(200001) }, SOURCES],
    ['beans', { name: 'a'.repeat(500000) }, SOURCES],
    ['recipes', { temperature: Number.NaN }, SOURCES],
  ]) {
    assert.throws(() => validateCreatePayload(kind, data, sources), error => safe(error, 'not-sent'));
  }
});

test('verify는 설정된 다섯 스키마와 forward 관계 타입·대상을 읽기만 검증한다', async () => {
  const { client, calls } = harness(url => {
    const kind = kinds.find(k => url.endsWith(SOURCES[k]));
    return response(200, source(kind));
  });
  assert.equal(await client.verify(), true);
  assert.equal(calls.length, 5);
  assert.deepEqual(calls.map(c => c.url), kinds.map(k => 'https://api.notion.com/v1/data_sources/' + SOURCES[k]));
  assert.ok(calls.every(c => c.init.method === 'GET' && c.init.body === undefined));
});

test('verify는 object/id/속성 누락·다른 타입·관계의 다른 데이터 소스를 거부한다', async () => {
  for (const mutate of [
    s => { s.object = 'database'; },
    s => { s.id = OTHER; },
    s => { delete s.properties; },
    s => { delete s.properties['원두 이름']; },
    s => { s.properties['원두 이름'].type = 'rich_text'; },
  ]) {
    const { client } = harness(() => { const s = source('beans'); mutate(s); return response(200, s); });
    await rejected(client.verify(), 'not-sent', 'invalid-response');
  }
  for (const kind of Object.keys(RELATIONS)) {
    const { client } = harness(url => {
      const key = kinds.find(k => url.endsWith(SOURCES[k]));
      const s = source(key);
      if (key === kind) {
        const field = Object.keys(RELATIONS[key])[0], name = schemas[key][field][0];
        s.properties[name].relation.data_source_id = OTHER;
      }
      return response(200, s);
    });
    await rejected(client.verify(), 'not-sent', 'invalid-response');
  }
});

test('legacy 설정은 records.bean 관계 없이 조회 검증을 통과하지만 기록 쓰기는 보내지 않는다', async () => {
  const { client, calls } = harness(url => {
    const kind = kinds.find(key => url.endsWith(SOURCES[key]));
    const sourceValue = source(kind);
    if (kind === 'recipes') delete sourceValue.properties['원두'];
    if (kind === 'records') delete sourceValue.properties['원두'];
    return response(200, sourceValue);
  });
  assert.equal(await client.verify(), true);
  assert.equal(client.recordBeanRelationSupported, false);
  await assert.rejects(client.createPage('records', { beanId: PAGE, recipeId: OTHER, rating: 4, snapshot: { version: 2, recordGeneration: 'bagless-v1' } }), error => {
    assert.equal(error.code, 'schema-unsupported');
    assert.equal(error.writeState, 'not-sent');
    return true;
  });
  assert.equal(calls.filter(call => call.init.method === 'POST').length, 0);
});

test('설정을 복사·정규화하고 client revision·데이터 소스를 불변 캡처한다', async () => {
  const input = { ...SOURCES, beans: ' ' + SOURCES.beans.toUpperCase() + ' ' };
  const { client, calls } = harness(() => response(200, list()), { dataSources: input, connectionRevision: REVISION.toUpperCase() });
  input.beans = OTHER;
  assert.equal(client.connectionRevision, REVISION);
  assert.ok(Object.isFrozen(client.dataSources));
  assert.throws(() => { client.dataSources.beans = OTHER; }, TypeError);
  assert.throws(() => { client.connectionRevision = OTHER; }, TypeError);
  await client.queryAll('beans');
  assert.equal(calls[0].url, 'https://api.notion.com/v1/data_sources/' + SOURCES.beans + '/query');
  assert.equal(calls[0].init.headers.Authorization, 'Bearer ' + TOKEN);
  assert.equal(JSON.stringify(client), '{}', '공개 객체 열거로 비밀 설정을 노출하지 않는다');
});

test('constructor의 잘못된 설정은 원문 없는 not-sent 오류다', () => {
  const good = { dataSources: SOURCES, connectionRevision: REVISION, fetchImpl() {}, timeoutMs: 100 };
  for (const token of ['', '   ', null, {}, TOKEN + '\n', '\t' + TOKEN, TOKEN + '\u007f']) {
    assert.throws(() => new NotionClient(token, good), error => safe(error, 'not-sent', 'invalid-config'));
  }
  for (const options of [null, {}, { ...good, dataSources: {} }, { ...good, dataSources: { ...SOURCES, beans: '../pages' } },
    { ...good, dataSources: { ...SOURCES, beans: SOURCES.beans + '?x=1' } }, { ...good, connectionRevision: [] },
    { ...good, fetchImpl: 'not-a-function' }, ...[0, -1, NaN, Infinity, '100'].map(timeoutMs => ({ ...good, timeoutMs }))]) {
    assert.throws(() => new NotionClient(TOKEN, options), error => safe(error, 'not-sent', 'invalid-config'));
  }
});

test('조회는 전체 페이지의 원시 객체를 반환하고 cursor를 body로만 보낸다', async () => {
  const first = page(), second = page(OTHER);
  const { client, calls } = harness((url, init, n) => response(200, n === 1 ? list([first], true, 'opaque/cursor?one') : list([second])));
  assert.deepEqual(await client.queryAll('beans'), [first, second]);
  assert.deepEqual(calls.map(c => JSON.parse(c.init.body)), [{ page_size: 100 }, { page_size: 100, start_cursor: 'opaque/cursor?one' }]);
  for (const { url, init } of calls) {
    assert.equal(url, 'https://api.notion.com/v1/data_sources/' + SOURCES.beans + '/query');
    assert.equal(init.method, 'POST'); assert.equal(init.redirect, 'error');
    assert.equal(init.cache, 'no-store'); assert.equal(init.credentials, 'omit');
    assert.equal(init.headers['Notion-Version'], '2025-09-03');
    assert.ok(Object.isFrozen(init) && Object.isFrozen(init.headers));
  }
});

test('query는 매 page incomplete를 확인하며 has_more=false여도 부분 성공을 반환하지 않는다', async () => {
  for (const pageNumber of [1, 2]) {
    const { client, calls } = harness((url, init, n) => response(200, n === pageNumber
      ? list([], false, null, { request_status: { type: 'incomplete' } })
      : list([page()], true, 'next')));
    await rejected(client.queryAll('beans'), 'not-sent', 'query-incomplete');
    assert.equal(calls.length, pageNumber);
  }
});

test('query는 cursor 없음·공백·반복·순환을 끝내고 누적 배열을 반환하지 않는다', async () => {
  for (const cursors of [[null], [''], ['  '], ['a', 'a'], ['a', 'b', 'a']]) {
    const { client, calls } = harness((url, init, n) => response(200, list([page(uuid(n + 30))], true, cursors[n - 1])));
    await rejected(client.queryAll('beans'), 'not-sent', 'pagination-error');
    assert.equal(calls.length, cursors.length);
  }
});

test('query는 잘못된 목록·페이지·음수 개수 형태와 중간 HTTP 오류를 거부한다', async () => {
  for (const body of [
    {}, list(null), list([], -1), list([], false, 'unexpected'),
    list([{ ...page(), object: 'data_source' }]), list([{ ...page(), id: 'bad' }]),
    list([{ ...page(), properties: null }]), list(Array.from({ length: 101 }, () => page())),
    list([], false, null, { request_status: { type: 'unexpected' } }),
  ]) {
    const { client, calls } = harness(() => response(200, body));
    await rejected(client.queryAll('beans'), 'not-sent', 'invalid-response'); assert.equal(calls.length, 1);
  }
  const { client, calls } = harness((url, init, n) => n === 1 ? response(200, list([page()], true, 'next')) : response(503, { message: RAW }));
  await rejected(client.queryAll('beans'), 'not-sent'); assert.equal(calls.length, 2);
});

test('kind와 UUID의 URL/path 주입은 fetch 전에 차단한다', async () => {
  const { client, calls } = harness();
  for (const kind of ['__proto__', 'toString', 'beans/query', '', null]) {
    await rejected(client.queryAll(kind), 'not-sent', 'invalid-input');
    await rejected(client.createPage(kind, {}), 'not-sent', 'invalid-input');
  }
  for (const id of ['../pages', PAGE + '?token=x', 'https://example.invalid/' + PAGE, '', null, [PAGE]]) {
    await rejected(client.getPage(id), 'not-sent', 'invalid-input');
    await rejected(client.archiveCreatedPage(id), 'not-sent', 'invalid-input');
  }
  assert.equal(calls.length, 0);
});

test('생성은 domain 입력을 공유 encode로 직렬화하며 호출 뒤 입력 변경과 분리한다', async () => {
  const calls = []; let finish;
  const fetchImpl = (url, init) => { calls.push({ url, init }); return new Promise(resolve => { finish = resolve; }); };
  const { client } = await recordsHarness(undefined, { fetchImpl });
  const input = { name: '기록', recipeId: OTHER, date: '2026-10-18', rating: 5, cupNote: '처음', snapshot: { version: 2, recordGeneration: 'bagless-v1', steps: [{ water: 50 }] } };
  const expected = encodeProperties('records', structuredClone(input));
  const pending = client.createPage('records', input);
  input.cupNote = '나중'; input.snapshot.steps[0].water = 100;
  assert.equal(Object.isFrozen(input), false);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://api.notion.com/v1/pages'); assert.equal(calls[0].init.method, 'POST');
  assert.deepEqual(JSON.parse(calls[0].init.body), { parent: { type: 'data_source_id', data_source_id: SOURCES.records }, properties: expected });
  finish(response(200, page(PAGE, 'records')));
  assert.equal((await pending).id, PAGE);
});

test('getPage 정규화와 archiveCreatedPage 고정 body·취소 확인', async () => {
  const { client, calls } = harness((url, init) => response(200, page(PAGE, 'recipes', { in_trash: init.method === 'PATCH' })));
  assert.equal((await client.getPage(PAGE.toUpperCase())).id, PAGE);
  assert.equal((await client.archiveCreatedPage(PAGE)).in_trash, true);
  assert.equal(calls[0].url, 'https://api.notion.com/v1/pages/' + PAGE);
  assert.deepEqual(JSON.parse(calls[1].init.body), { in_trash: true });
  assert.equal(calls[1].init.method, 'PATCH');
});

test('archivePage verifies the target data source for each user-deletable entity', async () => {
  for (const kind of ['beans', 'recipes', 'records']) {
    const { client, calls } = harness((url, init) => {
      const source = Object.keys(SOURCES).find(key => SOURCES[key] === page(PAGE, kind).parent.data_source_id);
      return response(200, page(PAGE, source, { in_trash: init.method === 'PATCH' }));
    });
    const archived = await client.archivePage(kind, PAGE);
    assert.equal(archived.in_trash, true, kind);
    assert.deepEqual(calls.map(call => call.init.method), ['GET', 'PATCH']);
    assert.deepEqual(JSON.parse(calls[1].init.body), { in_trash: true });
  }
  const { client: bagClient, calls: bagCalls } = harness();
  await rejected(bagClient.archivePage('bags', PAGE), 'not-sent', 'invalid-input');
  assert.equal(bagCalls.length, 0);
  for (const kind of ['beans', 'recipes', 'records']) {
    const wrongKind = kind === 'recipes' ? 'bags' : 'recipes';
    const { client, calls } = harness(() => response(200, page(PAGE, wrongKind)));
    await assert.rejects(client.archivePage(kind, PAGE));
    assert.equal(calls.length, 1, `${kind} refuses a page in ${wrongKind}`);
  }
});

test('create/get/archive의 잘못된 성공 body·식별자는 성공으로 취급하지 않는다', async () => {
  for (const body of [{}, { ...page(), object: 'error' }, { ...page(), id: [PAGE] }, { ...page(), id: 'bad' }, { ...page(), properties: null }, page(PAGE, 'records')]) {
    const { client } = harness(() => response(200, body));
    await rejected(client.createPage('beans', { name: '원두' }), 'unknown', 'invalid-response');
  }
  for (const body of [{}, page(OTHER), { ...page(), in_trash: 'false' }]) {
    const { client } = harness(() => response(200, body));
    await rejected(client.getPage(PAGE), 'not-sent', 'invalid-response');
  }
  for (const body of [{}, page(), page(OTHER, 'beans', { in_trash: true })]) {
    const { client } = harness(() => response(200, body));
    await rejected(client.archiveCreatedPage(PAGE), 'unknown', 'invalid-response');
  }
});

for (const status of [400, 401, 403, 404, 409, 413, 415, 422, 429]) {
  test('HTTP ' + status + ' 쓰기는 rejected, query POST는 not-sent이며 오류 body를 읽지 않는다', async () => {
    let reads = 0;
    const { client, calls } = harness(() => ({ ...response(status, null, '7'), async json() { reads++; throw new Error(TOKEN + RAW); } }));
    for (const action of [() => client.createPage('beans', { name: '원두' }), () => client.archiveCreatedPage(PAGE)]) {
      await assert.rejects(action(), error => { safe(error, 'rejected'); assert.equal(error.httpStatus, status); assert.equal(error.retryAfterSeconds, 7); return true; });
    }
    await rejected(client.queryAll('beans'), 'not-sent');
    assert.equal(reads, 0); assert.equal(calls.length, 3);
  });
}

for (const status of [408, 500, 503, 599]) {
  test('HTTP ' + status + ' 쓰기는 unknown이고 재시도하지 않는다', async () => {
    const { client, calls } = harness(() => response(status, { message: RAW }));
    await rejected(client.createPage('beans', { name: '원두' }), 'unknown');
    assert.equal(calls.length, 1);
  });
}

test('Retry-After의 잘못된 값은 안전 오류에서 생략한다', async () => {
  for (const value of ['-1', 'Infinity', RAW, '1.5', 'Wed, 01 Jan 2030 00:00:00 GMT']) {
    const { client } = harness(() => response(429, null, value));
    await assert.rejects(client.createPage('beans', {}), error => { safe(error, 'rejected'); assert.equal(error.retryAfterSeconds, undefined); return true; });
  }
});

test('네트워크 예외와 JSON 해석 실패는 원문·cause 없이 요청 성격에 맞게 변환한다', async () => {
  for (const handler of [
    () => { throw Object.assign(new Error(TOKEN + RAW), { cause: { id: PAGE } }); },
    () => ({ ...response(200), async json() { throw new SyntaxError(TOKEN + RAW); } }),
  ]) {
    const { client, calls } = harness(handler);
    await rejected(client.getPage(PAGE), 'not-sent');
    await rejected(client.queryAll('beans'), 'not-sent');
    await rejected(client.createPage('beans', {}), 'unknown');
    await rejected(client.archiveCreatedPage(PAGE), 'unknown');
    assert.equal(calls.length, 4);
  }
});

for (const phase of ['fetch', 'json']) {
  for (const writing of [false, true]) {
    test('abort 무시 ' + phase + ' 대기도 전체 timeout 종료 / ' + (writing ? '쓰기' : '읽기'), async () => {
      const { client, calls } = harness(() => phase === 'fetch' ? new Promise(() => {}) : { ...response(200), json: () => new Promise(() => {}) }, { timeoutMs: 5 });
      await rejected(writing ? client.createPage('beans', {}) : client.queryAll('beans'), writing ? 'unknown' : 'not-sent', 'timeout');
      assert.equal(calls.length, 1); assert.equal(calls[0].init.signal.aborted, true);
    });
  }
}

test('rich_text 100조각은 허용하고 101조각과 실제 wire의 2001자 text는 전송 전에 거부한다', async () => {
  const { client, calls } = harness();
  await client.createPage('beans', { name: 'a'.repeat(200000) });
  assert.equal(JSON.parse(calls[0].init.body).properties['원두 이름'].title.length, 100);
  await rejected(client.createPage('beans', { name: 'a'.repeat(200001) }), 'not-sent', 'payload-limit');
  await rejected(client.createPage('recipes', { dose: { toJSON() { return { type: 'text', text: { content: 'a'.repeat(2001) } }; } } }), 'not-sent', 'payload-limit');
  assert.equal(calls.length, 1);
});

test('배열·UTF-8 500000byte 한도와 stringify 오류는 fetch 전 안전하게 끝난다', async () => {
  const { client, calls } = harness();
  for (const input of [
    { dose: { toJSON() { return { nested: Array(101).fill(1) }; } } },
    { dose: 1n }, { dose: NaN }, { dose: { toJSON() { throw new Error(TOKEN + RAW); } } },
  ]) await rejected(client.createPage('recipes', input), 'not-sent');
  const { client: readyClient, calls: readyCalls } = await recordsHarness();
  await rejected(readyClient.createPage('records', { cupNote: '가'.repeat(170000), snapshot: { version: 2, recordGeneration: 'bagless-v1' } }), 'not-sent', 'payload-limit');
  const circular = { version: 2, recordGeneration: 'bagless-v1' }; circular.self = circular;
  await rejected(readyClient.createPage('records', { snapshot: circular }), 'not-sent');
  assert.equal(readyCalls.length, 0);
  assert.equal(calls.length, 0);
});

test('canonical 35속성·긴 snapshot 왕복과 기존 decode 의미·서버 함수 동일성을 유지한다', () => {
  assert.equal(Object.values(schemas).reduce((sum, fields) => sum + Object.keys(fields).length, 0), 35);
  assert.equal(serverEncode, encodeProperties); assert.equal(serverDecode, decodePage);
  const snapshot = { version: 1, name: '원본', steps: [{ order: 1, seconds: 0, water: 50 }], note: '가'.repeat(5000) };
  const properties = encodeProperties('records', { name: '기록', recipeId: PAGE, snapshot });
  assert.ok(properties['당시 레시피 스냅샷'].rich_text.length > 1);
  assert.ok(properties['당시 레시피 스냅샷'].rich_text.every(p => p.text.content.length <= 2000));
  assert.deepEqual(decodePage('records', { id: OTHER, properties }).snapshot, snapshot);
  assert.equal(decodePage('records', { id: OTHER, properties: {} }).snapshot, null);
  const multiple = { properties: { '원두': { relation: [{ id: PAGE }, { id: OTHER }] } } };
  assert.equal(decodePage('bags', multiple).beanId, null);
  assert.equal(decodePage('bags', { properties: {} }).roastedOn, null);
  assert.equal(decodePage('beans', { properties: {} }).name, '');
});

test('주입된 fetch는 브라우저 global receiver로 호출된다', async () => {
  const { client } = harness(undefined, { fetchImpl: function () {
    assert.ok(this === globalThis, '브라우저 fetch receiver');
    return Promise.resolve(response(200, page()));
  } });
  assert.equal((await client.getPage(PAGE)).id, PAGE);
});

test('5xx·408은 거절로 오해시키는 code가 아닌 http-error로 표시한다', async () => {
  for (const status of [408, 500, 503]) {
    const { client } = harness(() => response(status));
    await rejected(client.createPage('beans', {}), 'unknown', 'http-error');
  }
});

test('실제 wire payload의 500000byte 경계를 정확히 적용한다', async () => {
  const { client, calls } = await recordsHarness((url, init) => response(200, page(PAGE, 'records')));
  // request 내 JSON 키를 숫자 속성의 toJSON으로 넓혀 배열/텍스트 한도와 독립적으로 바이트 한도를 검증한다.
  const paddingInput = { rating: { toJSON() { return { padding: '' }; } }, snapshot: { version: 2, recordGeneration: 'bagless-v1' } };
  const overhead = new TextEncoder().encode(JSON.stringify({ parent: { type: 'data_source_id', data_source_id: SOURCES.records }, properties: encodeProperties('records', paddingInput) })).length;
  await client.createPage('records', { rating: { toJSON() { return { padding: 'a'.repeat(500000 - overhead) }; } }, snapshot: { version: 2, recordGeneration: 'bagless-v1' } });
  assert.equal(new TextEncoder().encode(calls[0].init.body).length, 500000);
  await rejected(client.createPage('records', { rating: { toJSON() { return { padding: 'a'.repeat(500001 - overhead) }; } }, snapshot: { version: 2, recordGeneration: 'bagless-v1' } }), 'not-sent', 'payload-limit');
  assert.equal(calls.length, 1);
});

test('잘못된 응답 getter·json 없음은 원문을 누설하지 않는다', async () => {
  for (const handler of [
    () => ({ get status() { throw new Error(TOKEN + RAW); } }),
    () => ({ status: 200, ok: true }),
    () => response(200, { object: 'page', get id() { throw new Error(TOKEN + RAW); } }),
  ]) {
    const { client } = harness(handler);
    await rejected(client.createPage('beans', {}), 'unknown', 'invalid-response');
  }
});

test('동기 JSON 해석이 timer를 지연해도 전체 기한을 넘기면 timeout이다', async () => {
  const { client, calls } = harness(() => ({
    ...response(200),
    json() {
      const started = Date.now();
      while (Date.now() - started < 12) { /* 동기 JSON 처리 지연을 모의한다. */ }
      return page();
    },
  }), { timeoutMs: 5 });
  await rejected(client.createPage('beans', {}), 'unknown', 'timeout');
  assert.equal(calls.length, 1); assert.equal(calls[0].init.signal.aborted, true);
});

test('client의 긴 스냅샷 wire 분할·응답 raw page·shared decode 왕복을 확인한다', async () => {
  const snapshot = { version: 2, recordGeneration: 'bagless-v1', name: '당시 조건', steps: [{ order: 1, seconds: 0, interval: 0, water: 50, cumulativeWater: 50 }], note: '가'.repeat(5000) };
  const { client, calls } = await recordsHarness((url, init) => response(200, page(PAGE, 'records', { properties: JSON.parse(init.body).properties })));
  const returned = await client.createPage('records', { name: '기록', recipeId: OTHER, date: '2026-10-18', rating: 5, snapshot });
  const wire = JSON.parse(calls[0].init.body);
  assert.equal(wire.properties['당시 레시피 스냅샷'].rich_text.length, 3);
  assert.deepEqual(decodePage('records', returned).snapshot, snapshot);
  assert.equal(returned.object, 'page');
});

test('bag source stays readable while bag create/archive and bagId record writes stop before fetch', async () => {
  const { client, calls } = await recordsHarness();
  await rejected(client.createPage('bags', { name: '구버전 봉지', beanId: PAGE }), 'not-sent');
  await rejected(client.createPage('records', {
    name: '기록', beanId: PAGE, recipeId: OTHER, bagId: PAGE,
    date: '2026-10-18', rating: 5, snapshot: { version: 2, recordGeneration: 'bagless-v1' },
  }), 'not-sent');
  await rejected(client.createPage('records', {
    name: '미완료 구버전 기록', beanId: PAGE, recipeId: OTHER,
    date: '2026-10-18', rating: 5, snapshot: { version: 2 },
  }), 'not-sent');
  await rejected(client.archivePage('bags', PAGE), 'not-sent');
  assert.equal(calls.length, 0);
});

test('bagless generation writes no legacy bag relation property', async () => {
  const { client, calls } = await recordsHarness((url, init) => response(200, page(PAGE, 'records', { properties: JSON.parse(init.body).properties })));
  await client.createPage('records', {
    name: '기록', beanId: PAGE, recipeId: OTHER, date: '2026-10-26', rating: 5,
    snapshot: { version: 2, recordGeneration: 'bagless-v1' },
  });
  const properties = JSON.parse(calls[0].init.body).properties;
  assert.equal(Object.hasOwn(properties, '원두 봉지'), false);
});
