import { InputError, summarizeRatings, validateStoredRecipe } from './domain.mjs';

const dataSourceVariables = Object.freeze({
  beans: 'NOTION_BEANS_DATA_SOURCE_ID',
  bags: 'NOTION_BAGS_DATA_SOURCE_ID',
  recipes: 'NOTION_RECIPES_DATA_SOURCE_ID',
  steps: 'NOTION_STEPS_DATA_SOURCE_ID',
  records: 'NOTION_RECORDS_DATA_SOURCE_ID',
});

export function readDataSources(env = process.env) {
  return Object.freeze(Object.fromEntries(
    Object.entries(dataSourceVariables).map(([kind, name]) => [kind, (env[name] || '').trim()]),
  ));
}

// Only writable properties appear here. Formula and rollup fields stay untouched.
const schemas = {
  beans: {
    name: ['원두 이름', 'title'],
    roaster: ['로스터리', 'rich_text'],
    origin: ['원산지·농장', 'rich_text'],
    variety: ['품종', 'rich_text'],
    process: ['가공 방식', 'rich_text'],
    tastingNotes: ['로스터리 향미 노트', 'rich_text'],
  },
  bags: {
    name: ['봉지 이름', 'title'],
    beanId: ['원두', 'relation'],
    roastedOn: ['로스팅 날짜', 'date'],
  },
  recipes: {
    name: ['레시피 이름', 'title'],
    beanId: ['원두', 'relation'],
    dripper: ['드리퍼', 'rich_text'],
    dose: ['원두 사용량(g)', 'number'],
    grind: ['분쇄도', 'rich_text'],
    grinder: ['그라인더 이름', 'rich_text'],
    grinderSetting: ['그라인더 설정값', 'rich_text'],
    microns: ['분쇄 입자 굵기(μm)', 'number'],
    temperature: ['물 온도(℃)', 'number'],
    totalWater: ['총 물 양(g)', 'number'],
  },
  steps: {
    name: ['단계 이름', 'title'],
    recipeId: ['레시피', 'relation'],
    order: ['순서', 'number'],
    seconds: ['누적 시간(초)', 'number'],
    interval: ['간격(초)', 'number'],
    water: ['이번에 붓는 물 양(g)', 'number'],
    cumulativeWater: ['누적 물 양(g)', 'number'],
  },
  records: {
    name: ['기록 이름', 'title'],
    recipeId: ['레시피', 'relation'],
    bagId: ['원두 봉지', 'relation'],
    date: ['날짜', 'date'],
    rating: ['별점', 'number'],
    cupNote: ['컵노트', 'rich_text'],
    snapshot: ['당시 레시피 스냅샷', 'rich_text'],
  },
};

function richText(value) {
  const text = String(value ?? '');
  const chunks = [];
  for (let index = 0; index < text.length; index += 2000) {
    chunks.push({ type: 'text', text: { content: text.slice(index, index + 2000) } });
  }
  return chunks;
}

export function encodeProperties(kind, data) {
  const properties = {};
  for (const [key, [name, type]] of Object.entries(schemas[kind])) {
    const value = data[key];
    let encoded;
    if (type === 'title' || type === 'rich_text') {
      encoded = richText(key === 'snapshot' ? JSON.stringify(value ?? null) : value);
    } else if (type === 'relation') {
      encoded = value ? [{ id: value }] : [];
    } else if (type === 'date') {
      encoded = value ? { start: value } : null;
    } else {
      encoded = value ?? null;
    }
    properties[name] = { [type]: encoded };
  }
  return properties;
}

export function decodePage(kind, page) {
  const result = { id: page.id };
  for (const [key, [name, type]] of Object.entries(schemas[kind])) {
    const property = page.properties?.[name] ?? {};
    if (type === 'title' || type === 'rich_text') {
      const text = (property[type] ?? []).map(item => item.plain_text ?? item.text?.content ?? '').join('');
      if (key === 'snapshot') {
        try {
          result[key] = JSON.parse(text);
        } catch {
          result[key] = null;
        }
      } else {
        result[key] = text;
      }
    } else if (type === 'relation') {
      result[key] = property.relation?.length === 1 ? property.relation[0].id : null;
    } else if (type === 'date') {
      result[key] = property.date?.start ?? null;
    } else {
      result[key] = property.number ?? null;
    }
  }
  return result;
}

export class NotionError extends Error {
  constructor(message, status = 502, safeToRetry = false) {
    super(message);
    this.status = status;
    this.safeToRetry = safeToRetry;
  }
}

export class NotionClient {
  constructor(token, { fetchImpl = globalThis.fetch, timeoutMs = 15000, dataSources = readDataSources() } = {}) {
    this.dataSources = dataSources;
    this.token = token;
    this.fetchImpl = fetchImpl;
    this.timeoutMs = timeoutMs;
  }

  async request(path, method = 'GET', body) {
    const writing = method !== 'GET' && (path === '/pages' || path.startsWith('/pages/'));
    let response;
    try {
      response = await this.fetchImpl('https://api.notion.com/v1' + path, {
        method,
        headers: {
          Authorization: `Bearer ${this.token}`,
          'Notion-Version': '2025-09-03',
          'Content-Type': 'application/json',
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        redirect: 'error',
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch {
      throw new NotionError(writing
        ? '노션 응답을 확인하지 못했습니다. 저장 여부가 불확실하므로 노션을 확인한 후 다시 시도해 주세요.'
        : '노션에 연결할 수 없습니다. 네트워크와 연결 설정을 확인해 주세요.', 502, !writing);
    }
    if (!response.ok) {
      const messages = {
        401: '노션 토큰이 올바르지 않습니다. 연결 설정을 확인해 주세요.',
        403: '노션 접근 권한이 없습니다. 통합에 페이지를 공유해 주세요.',
        404: '노션 데이터베이스를 찾을 수 없습니다. 커피 레시피 북 페이지를 통합에 공유해 주세요.',
        429: '노션 요청이 많습니다. 잠시 기다린 후 다시 시도해 주세요.',
      };
      throw new NotionError(messages[response.status]
        ?? '노션 요청을 처리하지 못했습니다. 속성과 연결 설정을 확인해 주세요.', response.status === 429 ? 429 : 502, !writing || (response.status >= 400 && response.status < 500));
    }
    try {
      return await response.json();
    } catch {
      throw new NotionError('노션 응답을 읽지 못했습니다. 저장 요청이었다면 노션에서 결과를 확인해 주세요.', 502, !writing);
    }
  }

  async verify() {
    for (const [kind, name] of Object.entries(dataSourceVariables)) {
      if (!this.dataSources[kind]?.trim()) {
        throw new InputError(`${name} 설정이 필요합니다. .env.local 또는 서버 환경변수를 확인해 주세요.`);
      }
    }
    for (const id of Object.values(this.dataSources)) {
      await this.request('/data_sources/' + id);
    }
  }

  async queryAll(id) {
    const rows = [];
    const seenCursors = new Set();
    let cursor;
    do {
      const response = await this.request(`/data_sources/${id}/query`, 'POST', {
        page_size: 100,
        ...(cursor ? { start_cursor: cursor } : {}),
      });
      rows.push(...response.results);
      cursor = response.has_more ? response.next_cursor : null;
      if (response.has_more && (!cursor || seenCursors.has(cursor))) {
        throw new NotionError('노션 페이지네이션 응답이 올바르지 않습니다.', 502, true);
      }
      seenCursors.add(cursor);
    } while (cursor);
    return rows;
  }

  createPage(id, properties) {
    return this.request('/pages', 'POST', {
      parent: { type: 'data_source_id', data_source_id: id },
      properties,
    });
  }

  archivePage(id) {
    return this.request('/pages/' + encodeURIComponent(id), 'PATCH', { archived: true });
  }
}

export class NotionRepository {
  constructor(client) {
    this.client = client;
    this.dataSources = client.dataSources ?? readDataSources();
    this.creatingRecipeIds = new Set();
    this.incompleteRecipeIds = new Set();
  }

  async all() {
    const data = {};
    for (const kind of Object.keys(this.dataSources)) {
      const pages = await this.client.queryAll(this.dataSources[kind]);
      data[kind] = pages.map(page => decodePage(kind, page));
    }
    data.recipes = data.recipes.map(recipe => ({
      ...recipe,
      steps: data.steps.filter(step => step.recipeId === recipe.id).sort((first, second) => first.order - second.order),
      stats: summarizeRatings(data.records, recipe.id),
    })).filter(recipe => {
      if (this.creatingRecipeIds.has(recipe.id) || this.incompleteRecipeIds.has(recipe.id)) return false;
      try {
        validateStoredRecipe(recipe);
        return true;
      } catch (error) {
        if (error instanceof InputError) return false;
        throw error;
      }
    });
    delete data.steps;
    return data;
  }

  async create(kind, data) {
    const properties = encodeProperties(kind, data);
    const page = await this.client.createPage(this.dataSources[kind], properties);
    if (typeof page.id !== 'string' || !page.id) {
      throw new NotionError('생성 페이지의 식별자를 확인하지 못했습니다. 노션에서 저장 여부를 확인해 주세요.');
    }
    return { ...data, id: page.id };
  }

  async createRecipe(data) {
    const createdIds = [];
    let recipeId = null;
    try {
      const recipe = await this.create('recipes', data);
      recipeId = recipe.id;
      this.creatingRecipeIds.add(recipeId);
      createdIds.push(recipeId);
      const steps = [];
      for (const step of data.steps) {
        const createdStep = await this.create('steps', { ...step, recipeId: recipe.id });
        createdIds.push(createdStep.id);
        steps.push(createdStep);
      }
      return { ...recipe, steps, stats: { count: 0, average: null } };
    } catch (error) {
      if (recipeId) this.incompleteRecipeIds.add(recipeId);
      let rollbackFailed = false;
      for (const id of createdIds.reverse()) {
        try {
          await this.client.archivePage(id);
        } catch {
          rollbackFailed = true;
        }
      }
      const rollbackMessage = rollbackFailed
        ? '일부 생성 페이지의 복구에 실패했습니다. 노션을 확인해 주세요.'
        : '확인된 생성 페이지는 보관하여 취소했습니다.';
      const safeToRetry = error.safeToRetry === true && !rollbackFailed;
      const uncertaintyMessage = safeToRetry
        ? '다시 저장할 수 있습니다.'
        : '응답이 유실된 생성 페이지는 남을 수 있습니다. 자동 재시도하지 않습니다.';
      throw new NotionError(`${error.message} ${rollbackMessage} ${uncertaintyMessage}`, error.status || 502, safeToRetry);
    } finally {
      if (recipeId) this.creatingRecipeIds.delete(recipeId);
    }
  }
}
