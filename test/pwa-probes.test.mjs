import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createNotionProbe, bootstrap as notionBootstrap } from '../pwa/probes/notion/probe.mjs';
import { createStorageProbe, bootstrap as storageBootstrap } from '../pwa/probes/storage/probe.mjs';

// Synthetic IDs only: never load private configuration or environment files.
const DS = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';
const PAGE = '33333333-3333-4333-8333-333333333333';
const TOKEN = 'fake-unit-test-credential';
const schema = id => ({ object: 'data_source', id, title: [{ plain_text: '원두' }], properties: Object.fromEntries([
  ['원두 이름', 'title'], ['로스터리', 'rich_text'], ['원산지·농장', 'rich_text'], ['품종', 'rich_text'], ['가공 방식', 'rich_text'], ['로스터리 향미 노트', 'rich_text'], ['원두 봉지', 'relation'], ['레시피', 'relation'],
].map(([name, type]) => [name, { type }])) });
const response = (status, data = {}) => ({ status, ok: status >= 200 && status < 300, async json() { return data; } });
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
function harness(handler = () => response(200, schema(DS)), timeoutMs = 100) {
  const calls = [];
  const probe = createNotionProbe({ timeoutMs, fetchImpl: async (url, options) => {
    calls.push({ url, options }); return handler(url, options, calls.length);
  } });
  probe.configure({ token: TOKEN, dataSourceId: DS });
  return { probe, calls };
}
async function arm(probe) { assert.equal((await probe.read()).code, 'read-ok'); probe.confirmTarget(true); assert.equal(probe.getState().canCreate, true); }

test('조회와 401 실험은 생성 없이 독립 실행되고 정상 스키마와 명시 확인이 생성 조건이다', async () => {
  const { probe, calls } = harness((url) => url.endsWith('/users/me') ? response(401) : response(200, schema(DS)));
  assert.equal((await probe.create()).code, 'not-ready');
  assert.equal((await probe.testInvalidAuth()).code, 'auth-401');
  assert.equal((await probe.read()).code, 'read-ok');
  assert.equal(probe.getState().canCreate, false);
  probe.confirmTarget(true);
  assert.equal(probe.getState().canCreate, true);
  assert.equal(calls.length, 2);
  assert.ok(calls.every(c => c.options.method === 'GET'));
  assert.notEqual(calls[0].options.headers.Authorization, 'Bearer ' + TOKEN);
});

test('UUID 외 입력과 다른 스키마는 차단하고 설정은 복사한다', async () => {
  const { probe, calls } = harness();
  const input = { token: TOKEN, dataSourceId: DS }; probe.configure(input); input.dataSourceId = OTHER; input.token = 'changed';
  assert.equal((await probe.read()).code, 'read-ok');
  assert.ok(calls[0].url.endsWith(DS));
  assert.equal(calls[0].options.headers.Authorization, 'Bearer ' + TOKEN);
  for (const bad of ['../pages', DS + '?x=1', 'https://example.invalid/' + DS, '']) {
    probe.configure({ token: TOKEN, dataSourceId: bad });
    assert.equal((await probe.read()).code, 'invalid-config');
  }
  assert.equal(calls.length, 1);
  const wrong = harness(() => response(200, { ...schema(DS), properties: { '원두 이름': { type: 'rich_text' } } }));
  wrong.probe.confirmTarget(true);
  assert.equal((await wrong.probe.read()).code, 'schema-mismatch');
  assert.equal(wrong.probe.getState().canCreate, false);
});

test('명시 생성 한 번에 POST 한 번, 처리 중 중복과 설정 변경을 막고 요청을 고정한다', async () => {
  const gate = deferred();
  const { probe, calls } = harness((url, options) => options.method === 'POST' ? gate.promise : response(200, url.includes('/pages/') ? { object: 'page', id: PAGE } : schema(DS)));
  await arm(probe);
  const saving = probe.create();
  assert.equal(probe.getState().busy, true);
  assert.equal((await probe.create()).code, 'busy');
  assert.equal(probe.configure({ token: 'replacement', dataSourceId: OTHER }).code, 'busy');
  const post = calls.find(c => c.options.method === 'POST');
  assert.ok(Object.isFrozen(post.options) && Object.isFrozen(post.options.headers));
  assert.equal(JSON.parse(post.options.body).parent.data_source_id, DS);
  gate.resolve(response(200, { object: 'page', id: PAGE }));
  assert.equal((await saving).code, 'created');
  assert.equal(calls.filter(c => c.options.method === 'POST').length, 1);
  assert.ok(calls.every(c => ['GET', 'POST'].includes(c.options.method)));
  assert.equal(probe.getState().locked, true);
  assert.equal((await probe.create()).code, 'not-ready');
});

for (const failure of ['network', 'timeout', 'json', 'server', 'http408']) {
  test('불확실 생성 ' + failure + '는 설정 교체로 풀리지 않으며 원본 확인 뒤 정상 재조회만 잠금을 푼다', async () => {
    const { probe, calls } = harness((url, options) => {
      if (options.method !== 'POST') return response(200, schema(url.endsWith(OTHER) ? OTHER : DS));
      if (failure === 'network') throw new TypeError('private raw response ' + TOKEN + DS);
      if (failure === 'timeout') return new Promise(() => {});
      if (failure === 'server') return response(503);
      if (failure === 'http408') return response(408);
      return { ...response(200), async json() { throw new SyntaxError('raw secret'); } };
    }, failure === 'timeout' ? 5 : 100);
    await arm(probe);
    const result = await probe.create();
    assert.equal(result.code, 'confirmation-required');
    assert.equal(probe.getState().locked, true);
    assert.equal(probe.configure({ token: 'replacement', dataSourceId: OTHER }).code, 'confirmation-required');
    probe.confirmTarget(true);
    assert.equal((await probe.read()).code, 'read-ok');
    assert.equal(probe.getState().locked, true);
    assert.equal((await probe.create()).code, 'not-ready');
    probe.confirmOriginal(true);
    assert.equal((await probe.read()).code, 'read-ok');
    assert.equal(probe.getState().locked, false);
    assert.ok(calls.filter(c => c.url.includes('/data_sources/')).every(c => c.url.endsWith(DS)), '잠금 해제 재조회는 원래 설정을 사용해야 한다');
    assert.equal(calls.filter(c => c.options.method === 'POST').length, 1);
    assert.doesNotMatch(JSON.stringify({ result, state: probe.getState() }), new RegExp(TOKEN + '|' + DS + '|raw secret|https?:'));
  });
}

test('원본 확인 후 실패한 재조회나 401 실험은 불확실 잠금을 풀지 않는다', async () => {
  let failingRead = false;
  const { probe } = harness((url, options) => options.method === 'POST' ? response(500) : response(failingRead ? 403 : 200, schema(DS)));
  await arm(probe); await probe.create(); probe.confirmOriginal(true); failingRead = true;
  assert.equal((await probe.read()).code, 'read-rejected');
  await probe.testInvalidAuth();
  assert.equal(probe.getState().locked, true);
});

test('생성 성공 후 재조회 실패는 저장 성공으로 남고 자동 재전송하지 않는다', async () => {
  const { probe, calls } = harness((url, options) => options.method === 'POST' ? response(200, { object: 'page', id: PAGE }) : url.includes('/pages/') ? response(503) : response(200, schema(DS)));
  await arm(probe);
  const result = await probe.create();
  assert.equal(result.code, 'created-readback-failed'); assert.equal(result.saved, true);
  assert.equal(probe.getState().locked, true);
  assert.equal(calls.filter(c => c.options.method === 'POST').length, 1);
});

test('확정 4xx 거부는 안전한 상태로 표시하고 원문·토큰·ID를 노출하지 않는다', async () => {
  const { probe } = harness((url, options) => options.method === 'POST' ? response(403, { message: TOKEN + DS, url: url }) : response(200, schema(DS)));
  await arm(probe); const result = await probe.create();
  assert.equal(result.code, 'create-rejected'); assert.equal(result.saved, false);
  assert.equal(probe.getState().schemaVerified, false);
  assert.doesNotMatch(JSON.stringify(result), new RegExp(TOKEN + '|' + DS + '|https?:'));
  const network = harness(() => { throw new TypeError('<img onerror=bad> ' + TOKEN); });
  const error = await network.probe.read(); assert.equal(error.code, 'network-unconfirmed');
  assert.match(error.message, /구분할 수 없/); assert.doesNotMatch(error.message, /<img|fake-unit/);
});

function mockOpfs() {
  const files = new Map(), calls = []; let error = null; let gate = null;
  const missing = () => Object.assign(new Error('private raw file content'), { name: 'NotFoundError' });
  const storage = { async getDirectory() {
    calls.push('root'); if (error) throw error;
    return { async getDirectoryHandle(dir, opts) {
      calls.push({ dir, opts });
      if (!opts.create && !files.has('directory')) throw missing();
      if (opts.create) files.set('directory', true);
      return { async getFileHandle(name, options) {
        calls.push({ name, options });
        if (!options.create && !files.has('data')) throw missing();
        return {
          async createWritable() { let draft; return { async write(text) { if (gate) await gate.promise; draft = text; }, async close() { files.set('data', draft); }, async abort() {} }; },
          async getFile() { return { size: (files.get('data') || '').length, async text() { return files.get('data'); } }; },
        };
      } };
    } };
  } };
  return { storage, files, calls, setError(value) { error = value; }, setGate(value) { gate = value; } };
}

test('OPFS는 전용 하위 경로에 시험 문자열의 버전 JSON만 쓰고 읽기는 생성하지 않는다', async () => {
  const fs = mockOpfs(), probe = createStorageProbe({ storage: fs.storage });
  assert.equal((await probe.read()).code, 'missing');
  assert.equal(fs.files.size, 0);
  assert.equal((await probe.write('T07-DEMO-session-1')).code, 'written');
  const data = JSON.parse(fs.files.get('data'));
  assert.equal(data.schemaVersion, 1); assert.equal(data.marker, 'T07-DEMO-session-1');
  assert.equal(data.purpose, 'bean-pocket-t07-retention-probe');
  assert.ok(fs.calls.find(c => c.dir && c.dir.includes('t07')));
  assert.ok(fs.calls.find(c => c.name && c.name !== 'probe-config.json'));
  const read = await probe.read(); assert.equal(read.code, 'read-ok');
  assert.doesNotMatch(JSON.stringify(read), /T07-DEMO-session-1|schemaVersion|savedAt/);
  assert.ok(fs.calls.filter(c => c.opts?.create === false).length > 0);
});

for (const [name, code] of [['QuotaExceededError', 'quota'], ['NotAllowedError', 'permission'], ['SecurityError', 'permission'], ['NotSupportedError', 'unsupported'], ['TypeMismatchError', 'path-conflict'], ['UnknownError', 'storage-error']]) {
  test('OPFS 오류 분류 ' + name, async () => {
    const fs = mockOpfs(); fs.setError(Object.assign(new Error(TOKEN), { name }));
    const result = await createStorageProbe({ storage: fs.storage }).write('T07-DEMO-session-1');
    assert.equal(result.code, code); assert.doesNotMatch(result.message, /fake-unit/);
  });
}

test('OPFS 미지원·손상·다른 스키마·실제 비밀 형태를 구분하고 기존 파일을 보존한다', async () => {
  assert.equal((await createStorageProbe({ storage: {} }).read()).code, 'unsupported');
  const fs = mockOpfs(), probe = createStorageProbe({ storage: fs.storage });
  await probe.write('T07-DEMO-session-1'); const original = fs.files.get('data');
  for (const value of ['secret_123456789012345', 'ntn_123456789012345', TOKEN, '<script>', '']) {
    assert.equal((await probe.write(value)).code, 'invalid-marker'); assert.equal(fs.files.get('data'), original);
  }
  for (const value of ['not-json', '{}', JSON.stringify({ ...JSON.parse(original), schemaVersion: 9 }), JSON.stringify({ ...JSON.parse(original), token: TOKEN }), JSON.stringify({ ...JSON.parse(original), marker: TOKEN })]) {
    fs.files.set('data', value); const result = await probe.read(); assert.equal(result.code, 'corrupt'); assert.doesNotMatch(JSON.stringify(result), /fake-unit|not-json/);
  }
});

test('OPFS 처리 중 중복 쓰기를 막는다', async () => {
  const fs = mockOpfs(), gate = deferred(); fs.setGate(gate); const probe = createStorageProbe({ storage: fs.storage });
  const pending = probe.write('T07-DEMO-session-1');
  assert.equal((await probe.write('T07-DEMO-session-2')).code, 'busy');
  gate.resolve(); assert.equal((await pending).code, 'written');
  assert.equal(JSON.parse(fs.files.get('data')).marker, 'T07-DEMO-session-1');
});

test('모듈은 DOM 없이 import되고 HTML은 외부 모듈·확인 UI·안전한 입력·버전 표식을 제공한다', async () => {
  assert.equal(notionBootstrap({ document: null }), null); assert.equal(storageBootstrap({ document: null }), null);
  for (const kind of ['notion', 'storage']) {
    const base = new URL('../pwa/probes/' + kind + '/', import.meta.url);
    const html = await readFile(new URL('index.html', base), 'utf8'), js = await readFile(new URL('probe.mjs', base), 'utf8');
    assert.match(html, /src="\.\/probe\.mjs"/); assert.match(html, /__BUILD_VERSION__/);
    assert.doesNotMatch(html + js, /innerHTML|outerHTML|removeEntry|localStorage|sessionStorage|indexedDB|dispatchEvent|CustomEvent|console\./);
    assert.doesNotMatch(js, /method:\s*['"](?:PATCH|DELETE)['"]|\.download\s*=/);
    assert.match(js, /textContent/); assert.match(js, /userAgent/); assert.match(js, /standalone/);
    if (kind === 'notion') { assert.match(html, /autocomplete="off"/); assert.match(html, /type="checkbox"/); }
  }
});

test('비정상 스키마 JSON은 스키마 불일치이다', async () => {
  const malformed = harness(() => response(200, { ...schema(DS), title: [null] }));
  assert.equal((await malformed.probe.read()).code, 'schema-mismatch');
});

test('비문자열 생성 ID는 확인 잠금이다', async () => {
  const created = harness((url, options) => options.method === 'POST' ? response(200, { object: 'page', id: [PAGE] }) : response(200, schema(DS)));
  await arm(created.probe);
  assert.equal((await created.probe.create()).code, 'confirmation-required');
  assert.equal(created.probe.getState().locked, true);
});

function fakeDocument(ids) {
  const nodes = new Map();
  function element() {
    const listeners = new Map();
    return {
      value: '', checked: false, disabled: false, textContent: '', children: [], attributes: {},
      set innerHTML(_) { throw new Error('Unsafe rendering'); },
      addEventListener(type, fn) { listeners.set(type, fn); },
      fire(type) { return listeners.get(type)?.(); },
      setAttribute(name, value) { this.attributes[name] = value; },
      appendChild(node) { this.children.push(node); },
    };
  }
  for (const id of ids) nodes.set(id, element());
  return { getElementById: id => nodes.get(id), createElement: () => element() };
}

test('Notion DOM은 별도 버튼과 확인을 적용하며 응답 오류를 안전한 텍스트로만 표시한다', async () => {
  const doc = fakeDocument(['token', 'dataSourceId', 'confirmTarget', 'confirmOriginal', 'btnRead', 'btnAuth', 'btnCreate', 'runtime', 'results', 'lockStatus']);
  const el = id => doc.getElementById(id), calls = [];
  const probe = notionBootstrap({ document: doc, navigator: { standalone: true, userAgent: '<img src=x onerror=bad>' }, fetchImpl: async (url, options) => {
    calls.push(options.method);
    return options.method === 'POST' ? response(503, { message: TOKEN + DS }) : response(200, schema(DS));
  } });
  el('token').value = TOKEN; el('dataSourceId').value = DS;
  assert.equal(el('btnCreate').disabled, true);
  await el('btnRead').fire('click');
  assert.equal(el('btnCreate').disabled, true);
  el('confirmTarget').checked = true; el('confirmTarget').fire('change');
  assert.equal(el('btnCreate').disabled, false);
  await el('btnCreate').fire('click');
  assert.equal(probe.getState().locked, true);
  assert.equal(el('btnCreate').disabled, true);
  assert.equal(el('token').disabled, true);
  assert.equal(el('confirmOriginal').disabled, false);
  assert.equal(calls.filter(x => x === 'POST').length, 1);
  assert.ok(el('results').children.length >= 2);
  assert.doesNotMatch(el('results').children.map(x => x.textContent).join(''), new RegExp(TOKEN + '|' + DS + '|https?:|<img'));
  assert.match(el('runtime').textContent, /standalone/);
  assert.match(el('runtime').textContent, /<img/); // Literal text; the fake DOM rejects markup sinks.
});

test('파일 DOM은 새 시험 확인으로만 쓰고 보관 재조회에는 바이트 변경이 없다', async () => {
  const doc = fakeDocument(['testData', 'confirmWrite', 'btnWrite', 'btnRead', 'runtime', 'results']);
  const el = id => doc.getElementById(id), fs = mockOpfs();
  storageBootstrap({ document: doc, storage: fs.storage, navigator: { userAgent: 'synthetic browser' }, matchMedia: () => ({ matches: true }) });
  el('testData').value = 'T07-DEMO-session-1';
  assert.equal(el('btnWrite').disabled, true);
  await el('btnWrite').fire('click'); assert.equal(fs.files.size, 0);
  el('confirmWrite').checked = true; el('confirmWrite').fire('change');
  assert.equal(el('btnWrite').disabled, false);
  await el('btnWrite').fire('click');
  assert.equal(el('confirmWrite').checked, false); assert.equal(el('btnWrite').disabled, true);
  const bytes = fs.files.get('data');
  await el('btnRead').fire('click'); assert.equal(fs.files.get('data'), bytes);
  const expectedFingerprint = createHash('sha256').update(bytes).digest('hex');
  assert.ok(el('results').children.every(node => node.textContent.includes('SHA-256: ' + expectedFingerprint)));
  assert.doesNotMatch(el('results').children.map(x => x.textContent).join(''), /T07-DEMO-session-1|schemaVersion|savedAt/);
  assert.match(el('runtime').textContent, /standalone/);
});

test('실행 환경 표시는 브라우저 API receiver를 보존하고 조회 불가에도 실험 UI를 유지한다', () => {
  for (const [boot, ids] of [
    [notionBootstrap, ['token', 'dataSourceId', 'confirmTarget', 'confirmOriginal', 'btnRead', 'btnAuth', 'btnCreate', 'runtime', 'results', 'lockStatus']],
    [storageBootstrap, ['testData', 'confirmWrite', 'btnWrite', 'btnRead', 'runtime', 'results']],
  ]) {
    const doc = fakeDocument(ids);
    assert.ok(boot({ document: doc, navigator: { userAgent: 'synthetic runtime' }, matchMedia: function () { assert.ok(this === globalThis, 'matchMedia receiver'); return { matches: true }; } }));
    assert.match(doc.getElementById('runtime').textContent, /standalone/);
    const unavailable = fakeDocument(ids);
    assert.ok(boot({ document: unavailable, navigator: { userAgent: 'synthetic runtime' }, matchMedia() { throw new Error('unavailable'); } }));
    assert.match(unavailable.getElementById('runtime').textContent, /확인 불가/);
  }
});

test('OPFS 작성·읽기·모듈 재생성의 지문은 같고 다른 유효 시험 파일은 구별한다', async t => {
  const fs = mockOpfs(), probe = createStorageProbe({ storage: fs.storage });
  const written = await probe.write('T07-DEMO-session-a');
  const bytes = fs.files.get('data');
  assert.match(written.fingerprint, /^[a-f0-9]{64}$/);
  assert.equal(written.fingerprint, createHash('sha256').update(bytes).digest('hex'));
  const read = await probe.read();
  assert.equal(read.fingerprint, written.fingerprint);
  const reopened = createStorageProbe({ storage: fs.storage });
  const reread = await reopened.read();
  assert.equal(reread.fingerprint, written.fingerprint);
  assert.equal(fs.files.get('data'), bytes, '지문 조회는 저장 파일을 바꾸지 않는다');
  const otherFile = { ...JSON.parse(bytes), marker: 'T07-DEMO-session-b' };
  fs.files.set('data', JSON.stringify(otherFile));
  const different = await reopened.read();
  assert.equal(different.code, 'read-ok');
  assert.match(different.fingerprint, /^[a-f0-9]{64}$/);
  assert.notEqual(different.fingerprint, written.fingerprint);
  t.diagnostic('SHA-256 write=' + written.fingerprint + ' read=' + read.fingerprint + ' reopened=' + reread.fingerprint + ' other=' + different.fingerprint);
  fs.files.set('data', JSON.stringify({ ...JSON.parse(bytes), savedAt: '2000-01-01T00:00:00.000Z' }));
  assert.notEqual((await reopened.read()).fingerprint, written.fingerprint, '같은 marker라도 다른 작성 내용은 구별한다');
  assert.doesNotMatch(JSON.stringify({ written, different }), /T07-DEMO-session|savedAt|schemaVersion/);
  const rewritten = await reopened.write('T07-DEMO-session-b');
  assert.equal((await reopened.read()).fingerprint, rewritten.fingerprint);
});

test('지문 기능 미지원·실패 때 원문으로 대체하지 않고 파일도 새로 쓰지 않는다', async () => {
  for (const subtle of [null, { async digest() { throw new Error(TOKEN); } }]) {
    const fs = mockOpfs();
    const probe = createStorageProbe({ storage: fs.storage, subtle });
    const result = await probe.write('T07-DEMO-session-a');
    assert.equal(result.code, 'fingerprint-unavailable');
    assert.equal(fs.files.size, 0);
    await createStorageProbe({ storage: fs.storage }).write('T07-DEMO-session-a');
    const bytes = fs.files.get('data');
    const read = await probe.read();
    assert.equal(read.code, 'fingerprint-unavailable');
    assert.equal(fs.files.get('data'), bytes);
    assert.doesNotMatch(JSON.stringify({ result, read }), /fake-unit|T07-DEMO-session/);
  }
});

test('가짜 marker는 끝 개행도 허용하지 않고 유효하지 않은 파일에는 지문을 제공하지 않는다', async () => {
  const fs = mockOpfs(), probe = createStorageProbe({ storage: fs.storage });
  await probe.write('T07-DEMO-session-a');
  const bytes = fs.files.get('data');
  for (const marker of ['T07-DEMO-session-a\n', 'T07-DEMO-session-a\r\n', 'T07-DEMO-' + 'a'.repeat(49)]) {
    assert.equal((await probe.write(marker)).code, 'invalid-marker');
    assert.equal(fs.files.get('data'), bytes);
    fs.files.set('data', JSON.stringify({ ...JSON.parse(bytes), marker }));
    const read = await probe.read();
    assert.equal(read.code, 'corrupt');
    assert.equal(read.fingerprint, undefined);
    fs.files.set('data', bytes);
  }
});
