import {
  InputError,
  recordValidationIssues,
  summarizeRatings,
  validateStoredRecipe,
  validateStoredSnapshot,
} from './domain.mjs';
import { encodeProperties, decodePage } from '../pwa/data/notion-properties.mjs';
export { encodeProperties, decodePage } from '../pwa/data/notion-properties.mjs';

const dataSourceVariables = Object.freeze({
  beans: 'NOTION_BEANS_DATA_SOURCE_ID',
  bags: 'NOTION_BAGS_DATA_SOURCE_ID',
  recipes: 'NOTION_RECIPES_DATA_SOURCE_ID',
  steps: 'NOTION_STEPS_DATA_SOURCE_ID',
  records: 'NOTION_RECORDS_DATA_SOURCE_ID',
});

function relationIds(page, propertyName) {
  const relation = page?.properties?.[propertyName]?.relation;
  return Array.isArray(relation)
    ? [...new Set(relation.map(item => item?.id).filter(value => typeof value === 'string' && value))]
    : [];
}

function relationState(page, propertyName) {
  const property = page?.properties?.[propertyName];
  const present = property !== undefined && property !== null;
  const valid = property?.type === 'relation' && Array.isArray(property.relation)
    && typeof property.has_more === 'boolean';
  return {
    ids: relationIds(page, propertyName),
    complete: !present || (valid && property.has_more === false),
    present,
  };
}

function combineRelationStates(states) {
  const presentStates = states.filter(state => state?.present);
  return {
    ids: [...new Set(presentStates.flatMap(state => state.ids))],
    complete: presentStates.every(state => state.complete),
    present: presentStates.length > 0,
  };
}

function readRecordSnapshot(snapshot, recipeId) {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) return null;
  const snapshotRecipeId = snapshot.version === 2 ? snapshot.recipe?.id : snapshot.id;
  if (typeof recipeId !== 'string' || snapshotRecipeId !== recipeId) return null;
  try { return validateStoredSnapshot(snapshot); }
  catch { return null; }
}

function snapshotWasStored(page) {
  const property = page?.properties?.['당시 레시피 스냅샷'];
  if (property === undefined || property === null) return false;
  if (property.type !== 'rich_text' || !Array.isArray(property.rich_text)) return true;
  return property.rich_text.some(item =>
    (typeof item?.plain_text === 'string' && item.plain_text.length > 0)
    || (typeof item?.text?.content === 'string' && item.text.content.length > 0));
}

export function readDataSources(env = process.env) {
  return Object.freeze(Object.fromEntries(
    Object.entries(dataSourceVariables).map(([kind, name]) => [kind, (env[name] || '').trim()]),
  ));
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
    this.recipeExtractionGuideSupported = null;
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
    for (const [kind, id] of Object.entries(this.dataSources)) {
      const source = await this.request('/data_sources/' + id);
      if (kind === 'recipes') {
        const guide = source?.properties?.['추출 가이드'];
        if (guide !== undefined && guide?.type !== 'rich_text') {
          throw new InputError('노션 recipes의 추출 가이드 속성은 rich_text 유형이어야 합니다.');
        }
        this.recipeExtractionGuideSupported = guide?.type === 'rich_text';
      }
      if (kind === 'records') {
        const beanRelation = source?.properties?.['원두'];
        this.recordBeanRelationSupported = beanRelation?.type === 'relation' &&
          beanRelation.relation?.data_source_id === this.dataSources.beans;
      }
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
    const pagesByKind = {};
    for (const kind of Object.keys(this.dataSources)) {
      const pages = await this.client.queryAll(this.dataSources[kind]);
      pagesByKind[kind] = pages;
      data[kind] = pages.map(page => decodePage(kind, page));
    }
    const recipeBeanRelations = new Map(pagesByKind.recipes.map(page => [page.id, relationState(page, '원두')]));
    const bagBeanRelations = new Map(pagesByKind.bags.map(page => [page.id, relationState(page, '원두')]));
    data.recipes = data.recipes.map(recipe => ({
      ...recipe,
      steps: data.steps.filter(step => step.recipeId === recipe.id).sort((first, second) => first.order - second.order),
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
    const beanIds = new Set(data.beans.map(bean => bean.id));
    const bagsById = new Map(data.bags.map(bag => [bag.id, bag]));
    data.records = data.records.map((record, index) => {
      const page = pagesByKind.records[index];
      const sourceSnapshot = record.snapshot;
      const snapshotRecipeId = sourceSnapshot?.version === 2 ? sourceSnapshot.recipe?.id : sourceSnapshot?.id;
      const recipeState = relationState(page, '레시피');
      const rawRecipeIds = recipeState.ids;
      const recipeId = rawRecipeIds.length === 1 ? rawRecipeIds[0]
        : rawRecipeIds.length === 0 ? snapshotRecipeId
          : rawRecipeIds.includes(snapshotRecipeId) ? snapshotRecipeId : null;
      const snapshot = readRecordSnapshot(sourceSnapshot, recipeId);
      const rawBeanState = relationState(page, '원두');
      const rawBagState = relationState(page, '원두 봉지');
      const snapshotBeanId = snapshot?.version === 2 ? snapshot.bean?.id
        : snapshot?.version === 1 ? snapshot.beanId : null;
      const legacyRecipeIds = snapshot?.version === 2 ? []
        : rawRecipeIds.length ? rawRecipeIds : recipeId ? [recipeId] : [];
      const legacyRecipeBeanState = combineRelationStates(legacyRecipeIds
        .map(id => recipeBeanRelations.get(id)).filter(Boolean));
      const bagBeanState = combineRelationStates(rawBagState.ids
        .map(id => bagBeanRelations.get(id) ?? { ids: [], complete: false, present: true }));
      const rawBeanIds = rawBeanState.ids;
      const rawBagIds = rawBagState.ids;
      const bagBeanIds = bagBeanState.ids;
      const bagBeanId = bagsById.get(record.bagId)?.beanId ?? (bagBeanIds.length === 1 ? bagBeanIds[0] : null);
      const candidates = [...new Set([
        ...rawBeanIds,
        ...(snapshotBeanId ? [snapshotBeanId] : []),
        ...legacyRecipeBeanState.ids,
        ...bagBeanIds,
      ].filter(value => typeof value === 'string' && value))];
      const relationEvidence = {
        bean: rawBeanState,
        recipe: recipeState,
        bag: rawBagState,
        legacyRecipeBean: legacyRecipeBeanState,
        bagBean: bagBeanState,
      };
      const hasDirectBeanEvidence = rawBeanIds.length > 0 || Boolean(snapshotBeanId);
      const relationAmbiguous = [rawBeanState, legacyRecipeBeanState]
        .some(state => state.present && !state.complete)
        || (!hasDirectBeanEvidence && bagBeanState.present && !bagBeanState.complete);
      const beanId = candidates.length === 1 && !relationAmbiguous ? candidates[0] : null;
      const known = beanId !== null && beanIds.has(beanId);
      const bagConflict = bagBeanId !== null && beanId !== null && bagBeanId !== beanId;
      const beanResolution = candidates.length !== 1 || relationAmbiguous || !known
        || bagConflict ? 'needs-confirmation'
        : rawBeanIds.includes(beanId) ? 'relation'
          : snapshot?.version === 2 ? 'snapshot-v2'
            : snapshot?.version === 1 && snapshotBeanId === beanId ? 'snapshot-v1'
              : legacyRecipeBeanState.ids.includes(beanId) ? 'legacy-recipe' : 'bag';
      const sanitized = { ...record, recipeId, beanId, beanResolution,
        snapshot: snapshot ?? null,
        snapshotStatus: snapshot ? 'valid' : snapshotWasStored(page) ? 'damaged' : 'missing',
        relationEvidence,
        ...(rawRecipeIds.length > 1 || !recipeState.complete ? { recipeCandidates: rawRecipeIds } : {}),
        ...(!rawBagState.complete || rawBagIds.length > 1 ? { bagCandidates: rawBagIds } : {}),
        ...(candidates.length > 1 || relationAmbiguous ? { beanCandidates: candidates } : {}) };
      const invalidFields = recordValidationIssues(sanitized);
      if (invalidFields.length) sanitized.invalidFields = invalidFields;
      return sanitized;
    });
    for (const recipe of data.recipes) recipe.stats = summarizeRatings(data.records, recipe.id);
    delete data.steps;
    return data;
  }

  async create(kind, data) {
    if (kind === 'records' && this.client.recordBeanRelationSupported !== true) {
      throw new InputError('추출 기록을 저장하려면 노션 records 데이터베이스에 원두 관계가 필요합니다.');
    }
    const properties = encodeProperties(kind, data);
    if (kind === 'recipes' && this.client.recipeExtractionGuideSupported === false) {
      if (String(data.extractionGuide ?? '').trim()) {
        throw new InputError('추출 가이드를 저장하려면 노션 recipes 데이터베이스에 rich_text 속성을 추가해 주세요.');
      }
      delete properties['추출 가이드'];
    }
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
