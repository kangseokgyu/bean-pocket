import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { NotionClient, NotionRepository, readDataSources } from './lib/notion.mjs';
import { InputError, validateBean, validateBag, validateRecipe, validateRecord, validateStoredRecipe, createSnapshot } from './lib/domain.mjs';

const publicDirectory = new URL('./public/', import.meta.url);
const staticFiles = {
  '/': ['index.html', 'text/html; charset=utf-8'],
  '/app.js': ['app.js', 'text/javascript; charset=utf-8'],
  '/submission.mjs': ['submission.mjs', 'text/javascript; charset=utf-8'],
  '/styles.css': ['styles.css', 'text/css; charset=utf-8'],
};

async function readJson(request) {
  if (request.headers['content-type']?.split(';')[0].trim() !== 'application/json') {
    const error = new InputError('JSON 형식으로 요청해 주세요.');
    error.status = 415;
    throw error;
  }
  let size = 0;
  const chunks = [];
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 1_000_000) {
      throw new InputError('입력 내용이 너무 큽니다.');
    }
    chunks.push(chunk);
  }
  try {
    const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (!body || Array.isArray(body) || typeof body !== 'object') throw Error();
    return body;
  } catch {
    throw new InputError('올바른 JSON 객체가 필요합니다.');
  }
}

export function createApp({ fetchImpl = globalThis.fetch, initialToken = process.env.NOTION_TOKEN || '', dataSources = readDataSources() } = {}) {
  let repository = null;
  let lastConnectionError = null;
  const submissions = new Map();
  const makeClient = token => new NotionClient(token, { fetchImpl, dataSources });
  const initialization = initialToken ? (async () => {
    try {
      const client = makeClient(initialToken);
      await client.verify();
      repository = new NotionRepository(client);
    } catch (error) {
      lastConnectionError = error.message;
    }
  })() : Promise.resolve();

  function requireItem(rows, id, label) {
    if (typeof id !== 'string') throw new InputError(`${label}을(를) 선택해 주세요.`);
    const item = rows.find(row => row.id === id);
    if (!item) throw new InputError(`이 데이터베이스에서 ${label}을(를) 찾을 수 없습니다.`);
    return item;
  }

  async function save(path, body, targetRepository) {
    if (!targetRepository) {
      const error = new InputError('먼저 노션을 연결해 주세요.');
      error.status = 503;
      throw error;
    }
    if (path === '/api/beans') return targetRepository.create('beans', validateBean(body));
    const data = await targetRepository.all();
    if (path === '/api/bags') {
      const bag = validateBag(body);
      requireItem(data.beans, bag.beanId, '원두');
      return targetRepository.create('bags', bag);
    }
    if (path === '/api/recipes') {
      requireItem(data.beans, body.beanId, '원두');
      if (body.copyFromId) {
        const original = requireItem(data.recipes, body.copyFromId, '복사할 레시피');
        if (original.beanId !== body.beanId) throw new InputError('같은 원두의 레시피를 복사해 주세요.');
      }
      return targetRepository.createRecipe(validateRecipe(body));
    }
    if (path === '/api/records') {
      const recipe = requireItem(data.recipes, body.recipeId, '레시피');
      validateStoredRecipe(recipe);
      const bag = body.bagId ? requireItem(data.bags, body.bagId, '원두 봉지') : null;
      const record = validateRecord(body, recipe, bag);
      record.name = `${record.date} · ${recipe.name}`;
      record.snapshot = createSnapshot(recipe);
      return targetRepository.create('records', record);
    }
    throw new InputError('지원하지 않는 저장 요청입니다.');
  }

  const server = http.createServer(async (request, response) => {
    const json = (status, data) => {
      response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
      response.end(JSON.stringify(data));
    };
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Referrer-Policy', 'no-referrer');
    response.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
    try {
      const origin = 'http://' + request.headers.host;
      const url = new URL(request.url, origin);
      if (request.method !== 'GET') {
        if (request.headers.origin !== origin || request.headers['sec-fetch-site'] === 'cross-site') {
          return json(403, { error: '같은 사이트에서만 변경할 수 있습니다.' });
        }
      }
      if (request.method === 'GET' && (staticFiles[url.pathname] || url.pathname === '/domain.mjs')) {
        const [name, type] = staticFiles[url.pathname] || ['../lib/domain.mjs', 'text/javascript; charset=utf-8'];
        const file = await readFile(new URL(name, publicDirectory));
        response.writeHead(200, { 'Content-Type': type });
        return response.end(file);
      }
      await initialization;
      if (request.method === 'GET' && url.pathname === '/api/status') {
        return json(200, { connected: Boolean(repository), error: lastConnectionError });
      }
      if (request.method === 'GET' && url.pathname === '/api/data') {
        if (!repository) return json(503, { error: '먼저 노션을 연결해 주세요.' });
        return json(200, await repository.all());
      }
      if (request.method === 'POST' && url.pathname === '/api/connect') {
        const body = await readJson(request);
        if (typeof body.token !== 'string' || !body.token.trim() || body.token.length > 1000) {
          throw new InputError('노션 통합 토큰을 입력해 주세요.');
        }
        const client = makeClient(body.token.trim());
        await client.verify();
        repository = new NotionRepository(client);
        submissions.clear();
        lastConnectionError = null;
        return json(200, { connected: true });
      }
      const saveRoutes = ['/api/beans', '/api/bags', '/api/recipes', '/api/records'];
      if (request.method === 'POST' && saveRoutes.includes(url.pathname)) {
        const body = await readJson(request);
        const key = request.headers['idempotency-key'];
        if (key && (typeof key !== 'string' || !/^[\w-]{1,100}$/.test(key))) {
          throw new InputError('올바른 중복 방지 키가 필요합니다.');
        }
        const fingerprint = createHash('sha256').update(url.pathname + JSON.stringify(body)).digest('hex');
        const existing = key && submissions.get(key);
        if (existing && existing.fingerprint !== fingerprint) {
          return json(409, { error: '이 요청 키는 다른 입력에 사용되었습니다. 새 양식을 열어 주세요.' });
        }
        let resultPromise = existing?.promise;
        if (!resultPromise) {
          if (key && submissions.size >= 1000) {
            return json(503, { error: '중복 저장 방지 메모리가 가득 찼습니다. 노션 결과를 확인한 후 서버를 재시작해 주세요.' });
          }
          resultPromise = save(url.pathname, body, repository).then(
            data => ({ status: 201, data }),
            error => {
              // Release only requests known to have produced no persistent write.
              if (key && error.safeToRetry === true && submissions.get(key)?.promise === resultPromise) {
                submissions.delete(key);
              }
              return {
                status: error.status || 500,
                data: { error: error.status ? error.message : '저장 중 오류가 발생했습니다. 노션에서 결과를 확인해 주세요.' },
              };
            },
          );
          if (key) submissions.set(key, { fingerprint, promise: resultPromise });
        }
        const result = await resultPromise;
        return json(result.status, result.data);
      }
      return json(404, { error: '요청한 경로를 찾을 수 없습니다.' });
    } catch (error) {
      return json(error.status || 500, { error: error.status ? error.message : '요청을 처리하지 못했습니다. 다시 확인해 주세요.' });
    }
  });
  server.requestTimeout = 30_000;
  server.headersTimeout = 10_000;
  return server;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 4173);
  createApp().listen(port, '0.0.0.0', () => {
    console.log(`bean-pocket: http://0.0.0.0:${port}`);
  });
}
