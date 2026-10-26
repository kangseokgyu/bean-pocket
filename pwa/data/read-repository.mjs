import { decodePage, optionalProperties, schemas } from './notion-properties.mjs';
import {
  CURRENT_RECORD_GENERATION,
  isCurrentRecord,
  recordValidationIssues,
  summarizeRatings,
  validateStoredRecipe,
  validateStoredSnapshot,
} from '../domain.mjs';

const KINDS = Object.freeze(['beans', 'recipes', 'steps', 'records']);
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const RECORD_PAGE_STATE_TTL_MS = 10 * 60 * 1000;
const RECORD_PARENT_CACHE_TTL_MS = 60 * 1000;

const safeFailures = new WeakSet();

function safeFailure(code, writeState = 'not-sent', details = {}) {
  const failure = Object.freeze({ code, writeState, ...details });
  safeFailures.add(failure);
  return failure;
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function normalizeUuid(value) {
  if (typeof value !== 'string' || !UUID_REGEX.test(value)) return null;
  return value.toLowerCase();
}

function copySourceIds(dataSources) {
  if (!isRecord(dataSources)) return null;

  const sourceIds = {};
  for (const kind of KINDS) {
    if (!Object.hasOwn(dataSources, kind)) return null;
    sourceIds[kind] = normalizeUuid(dataSources[kind]);
    if (!sourceIds[kind]) return null;
  }
  if (new Set(Object.values(sourceIds)).size !== KINDS.length) return null;
  return Object.freeze(sourceIds);
}

function deepFreeze(value, seen = new Set()) {
  if (value === null || typeof value !== 'object' || seen.has(value)) return value;
  seen.add(value);
  Object.freeze(value);
  for (const child of Object.values(value)) {
    deepFreeze(child, seen);
  }
  return value;
}

function validateRawPage(page, expectedSourceId) {
  if (!isRecord(page)) return false;
  if (typeof page.archived !== 'boolean' || typeof page.in_trash !== 'boolean') return false;
  if (page.archived || page.in_trash) return false;
  if (!normalizeUuid(page.id)) return false;
  if (!isRecord(page.parent) || page.parent.type !== 'data_source_id') return false;
  if (normalizeUuid(page.parent.data_source_id) !== expectedSourceId) return false;
  if (!isRecord(page.properties)) return false;
  return typeof page.last_edited_time === 'string' && Number.isFinite(Date.parse(page.last_edited_time));
}

function isRichText(value) {
  return Array.isArray(value) && value.every(item => isRecord(item) &&
    (typeof item.plain_text === 'string' || typeof item.text?.content === 'string'));
}

function isRelation(value, property) {
  return Array.isArray(value) && typeof property.has_more === 'boolean' &&
    value.every(item => isRecord(item) && normalizeUuid(item.id));
}

function isDate(value) {
  return value === null || (isRecord(value) && typeof value.start === 'string');
}

function validateRawProperties(kind, page) {
  const fields = schemas[kind];
  if (!fields || !isRecord(page.properties)) return false;

  for (const [field, [name, type]] of Object.entries(fields)) {
    const property = page.properties[name];
    if (property === undefined && optionalProperties[kind]?.includes(field)) continue;
    if (!isRecord(property) || property.type !== type || !Object.hasOwn(property, type)) return false;

    const value = property[type];
    if ((type === 'title' || type === 'rich_text') && !isRichText(value)) return false;
    if (type === 'relation' && !isRelation(value, property)) return false;
    if (type === 'date' && !isDate(value)) return false;
    if (type === 'number' && value !== null && (typeof value !== 'number' || !Number.isFinite(value))) return false;
  }
  return true;
}

function extractSingleRelation(property) {
  if (!property || typeof property !== 'object') return null;
  if (property.has_more === true) return null;
  if (!Array.isArray(property.relation) || property.relation.length !== 1) return null;
  return normalizeUuid(property.relation[0]?.id);
}

function extractObservedRecipeIds(page) {
  if (!isRecord(page) || page.archived === true || page.in_trash === true || !isRecord(page.properties)) return [];
  const relation = page.properties['레시피']?.relation;
  if (!Array.isArray(relation)) return [];
  return [...new Set(relation.map(item => normalizeUuid(item?.id)).filter(Boolean))];
}

function relationIds(property) {
  if (!Array.isArray(property?.relation)) return [];
  return [...new Set(property.relation.map(item => normalizeUuid(item?.id)).filter(Boolean))];
}

function relationState(property) {
  const present = property !== undefined && property !== null;
  const valid = property?.type === 'relation' && Array.isArray(property.relation)
    && typeof property.has_more === 'boolean';
  return {
    ids: relationIds(property),
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

function getRecipeParentCriteria(page) {
  const decoded = decodePage('recipes', page);
  const beanRelation = relationState(page.properties['원두']);
  return {
    ...decoded,
    id: normalizeUuid(page.id),
    beanId: beanRelation.complete && beanRelation.ids.length === 1 ? beanRelation.ids[0] : null,
    beanRelation,
    sourceId: normalizeUuid(page.parent.data_source_id),
    lastEditedTime: page.last_edited_time,
  };
}

function readSnapshot(snapshot, recipeId) {
  if (!isRecord(snapshot)) return null;
  const snapshotRecipeId = normalizeUuid(snapshot.version === 2 ? snapshot.recipe?.id : snapshot.id);
  if (snapshotRecipeId !== recipeId) return null;
  try {
    const value = validateStoredSnapshot(snapshot);
    return {
      version: value.version,
      beanId: normalizeUuid(value.version === 2 ? value.bean.id : value.beanId),
      value,
    };
  } catch {
    return null;
  }
}

function snapshotWasStored(page) {
  const property = page.properties?.['당시 레시피 스냅샷'];
  if (property === undefined || property === null) return false;
  if (property.type !== 'rich_text' || !Array.isArray(property.rich_text)) return true;
  return property.rich_text.some(item =>
    (typeof item?.plain_text === 'string' && item.plain_text.length > 0)
    || (typeof item?.text?.content === 'string' && item.text.content.length > 0));
}

export function createReadRepository(client) {
  if (!isRecord(client)) throw safeFailure('invalid-input');

  let queryAll, queryPage, getPage, sourceIds;
  const pendingRecipePages = new Map();
  const validatedRecipes = new Map();
  const recordPageStates = new Map();
  const recordParentCache = { beans: new Map(), recipes: new Map() };
  let recordParentCacheRevision = client.connectionRevision ?? null;
  let recordPageSequence = 0;
  try {
    queryAll = client.queryAll;
    queryPage = client.queryPage;
    getPage = client.getPage;
    sourceIds = copySourceIds(client.dataSources);
  } catch {
    throw safeFailure('invalid-input');
  }
  if (typeof queryAll !== 'function' || typeof getPage !== 'function' || !sourceIds) {
    throw safeFailure('invalid-input');
  }

  function queryCursor(kind, query, cursor) {
    if (cursor == null) return null;
    try {
      if (typeof cursor !== 'string' || cursor.length > 8000) throw new Error();
      const value = JSON.parse(decodeURIComponent(cursor));
      if (value?.version !== 1 || value.kind !== kind ||
          value.revision !== (client.connectionRevision ?? null) ||
          JSON.stringify(value.query) !== JSON.stringify(query) ||
          value.cursor === undefined) throw new Error();
      return value.cursor;
    } catch { throw safeFailure('invalid-input'); }
  }

  function pageCursor(kind, query, cursor) {
    if (cursor == null) return null;
    return encodeURIComponent(JSON.stringify({ version: 1, revision: client.connectionRevision ?? null,
      kind, query, cursor }));
  }

  function pruneRecordPageStates(now = Date.now()) {
    for (const [id, entry] of recordPageStates) {
      if (now - entry.lastUsedAt > RECORD_PAGE_STATE_TTL_MS) recordPageStates.delete(id);
    }
  }

  function ensureRecordParentCacheRevision() {
    const revision = client.connectionRevision ?? null;
    if (revision === recordParentCacheRevision) return;
    recordParentCache.beans.clear();
    recordParentCache.recipes.clear();
    recordParentCacheRevision = revision;
  }

  function getRecordParentEntry(kind, id) {
    ensureRecordParentCacheRevision();
    const cache = recordParentCache[kind];
    const key = normalizeUuid(id);
    if (!cache || !key) return null;
    const entry = cache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.savedAt > RECORD_PARENT_CACHE_TTL_MS) {
      cache.delete(key);
      return null;
    }
    return entry;
  }

  function rememberRecordParent(kind, id, status, value = null) {
    ensureRecordParentCacheRevision();
    const key = normalizeUuid(id);
    const cache = recordParentCache[kind];
    if (!cache || !key) return;
    cache.set(key, { status, value: status === 'live' ? deepFreeze(value) : null, savedAt: Date.now() });
  }

  function cachedRecordParents(kind, ids) {
    const result = [];
    for (const id of new Set(ids.map(normalizeUuid).filter(Boolean))) {
      const entry = getRecordParentEntry(kind, id);
      if (entry?.status === 'live') result.push(entry.value);
    }
    return result;
  }

  function recordParentNameStatus(kind, id, snapshotName) {
    const key = normalizeUuid(id);
    if (!key) return snapshotName ? 'snapshot' : 'unavailable';
    const entry = getRecordParentEntry(kind, key);
    if (!entry) return 'loading';
    if (entry.status === 'live') return 'live';
    return snapshotName ? 'snapshot' : 'unavailable';
  }

  function invalidateRecordParentCache(kind = 'all', ids = null) {
    ensureRecordParentCacheRevision();
    const kinds = kind === 'all' ? ['beans', 'recipes'] : [kind];
    for (const currentKind of kinds) {
      const cache = recordParentCache[currentKind];
      if (!cache) continue;
      if (ids == null) cache.clear();
      else for (const id of ids) {
        const key = normalizeUuid(id);
        if (key) cache.delete(key);
      }
    }
  }

  function readError(error) {
    const allowed = new Set(['rate-limited', 'http-rejected', 'http-error', 'timeout',
      'network-unconfirmed', 'invalid-response', 'pagination-error', 'query-incomplete', 'read-cancelled']);
    const code = allowed.has(error?.code) ? error.code : 'read-failed';
    const details = {};
    if (Number.isInteger(error?.httpStatus)) details.httpStatus = error.httpStatus;
    if (Number.isInteger(error?.retryAfterSeconds) && error.retryAfterSeconds >= 0) {
      details.retryAfterSeconds = error.retryAfterSeconds;
    }
    return safeFailure(code, 'not-sent', details);
  }

  async function listBeans({ cursor = null, limit = 20, query: searchText = '', signal } = {}) {
    if (typeof queryPage !== 'function' || typeof searchText !== 'string' || searchText.length > 100) {
      throw safeFailure('invalid-input');
    }
    const filter = searchText.trim() ? { property: schemas.beans.name[0], title: { contains: searchText.trim() } } : undefined;
    const query = { filter, sorts: [{ property: schemas.beans.name[0], direction: 'ascending' }],
      properties: Object.values(schemas.beans).map(([name]) => name) };
    const startCursor = queryCursor('beans', query, cursor);
    if (startCursor !== null && (typeof startCursor !== 'string' || !startCursor.trim())) {
      throw safeFailure('invalid-input');
    }
    try {
      const page = await queryPage.call(client, 'beans', { cursor: startCursor, limit,
        ...(filter ? { filter } : {}), sorts: query.sorts, properties: query.properties, signal });
      if (!isRecord(page) || !Array.isArray(page.items) || typeof page.hasMore !== 'boolean' ||
          typeof page.complete !== 'boolean' ||
          (page.hasMore ? typeof page.nextCursor !== 'string' || !page.nextCursor.trim() : page.nextCursor !== null)) {
        throw safeFailure('invalid-response');
      }
      const items = [];
      for (const raw of page.items) {
        if (!validateRawPage(raw, sourceIds.beans) || !validateRawProperties('beans', raw)) continue;
        const bean = decodePage('beans', raw);
        bean.id = normalizeUuid(raw.id);
        rememberRecordParent('beans', bean.id, 'live', bean);
        items.push(bean);
      }
      return deepFreeze({ items, nextCursor: pageCursor('beans', query, page.nextCursor),
        hasMore: page.hasMore, complete: page.complete && !page.hasMore });
    } catch (error) {
      if (safeFailures.has(error)) throw error;
      throw readError(error);
    }
  }

  async function queryPageFor(kind, options = {}) {
    if (typeof queryPage !== 'function') throw safeFailure('read-failed');
    try {
      const page = await queryPage.call(client, kind, options);
      if (!isRecord(page) || !Array.isArray(page.items) || typeof page.hasMore !== 'boolean' ||
          typeof page.complete !== 'boolean' ||
          (page.hasMore ? typeof page.nextCursor !== 'string' || !page.nextCursor.trim() : page.nextCursor !== null)) {
        throw safeFailure('invalid-response');
      }
      return page;
    } catch (error) {
      if (safeFailures.has(error)) throw error;
      throw readError(error);
    }
  }

  async function collectPages(kind, { filter, properties, sorts, signal, cursor = null } = {}) {
    const rows = [];
    const cursors = new Set();
    let nextCursor = cursor;
    let pages = 0;
    while (true) {
      if (pages >= 100) throw safeFailure('query-incomplete');
      const page = await queryPageFor(kind, { cursor: nextCursor, limit: 100,
        ...(filter === undefined ? {} : { filter }), ...(sorts === undefined ? {} : { sorts }),
        ...(properties === undefined ? {} : { properties }), signal });
      rows.push(...page.items);
      pages++;
      if (!page.hasMore) {
        if (!page.complete) throw safeFailure('query-incomplete');
        return rows;
      }
      if (cursors.has(page.nextCursor)) throw safeFailure('pagination-error');
      cursors.add(page.nextCursor);
      nextCursor = page.nextCursor;
    }
  }

  function relationFilter(property, id) {
    return { property, relation: { contains: id } };
  }

  function stageRowsByRecipe(stepPages, ids) {
    const selected = new Set(ids);
    const steps = new Map(ids.map(id => [id, []]));
    const tainted = new Set();
    for (const page of stepPages) {
      const observed = extractObservedRecipeIds(page).filter(id => selected.has(id));
      const valid = validateRawPage(page, sourceIds.steps) && validateRawProperties('steps', page);
      const recipeId = valid ? extractSingleRelation(page.properties['레시피']) : null;
      if (!recipeId || !selected.has(recipeId)) {
        for (const id of observed) tainted.add(id);
        continue;
      }
      const step = decodePage('steps', page);
      step.id = normalizeUuid(page.id);
      step.recipeId = recipeId;
      steps.get(recipeId).push(step);
    }
    return { steps, tainted };
  }

  async function validateSelectedRecipe(parentPage, stepPages, signal) {
    if (!validateRawPage(parentPage, sourceIds.recipes) || !validateRawProperties('recipes', parentPage)) {
      throw safeFailure('recipe-unavailable');
    }
    const criteria = getRecipeParentCriteria(parentPage);
    const { steps: stepsByRecipeId, tainted } = stageRowsByRecipe(stepPages, [criteria.id]);
    if (tainted.has(criteria.id)) throw safeFailure('recipe-unavailable');
    const steps = stepsByRecipeId.get(criteria.id) ?? [];
    steps.sort((a, b) => a.order - b.order);
    if (!steps.length || steps[0].order !== 1) throw safeFailure('recipe-unavailable');
    const recipe = decodePage('recipes', parentPage);
    recipe.id = criteria.id;
    recipe.beanId = criteria.beanId;
    recipe.steps = steps;
    try { validateStoredRecipe(recipe); }
    catch { throw safeFailure('recipe-unavailable'); }

    let freshPage;
    try { freshPage = await getPage.call(client, criteria.id, { signal }); }
    catch { throw safeFailure('stale-read'); }
    if (!validateRawPage(freshPage, sourceIds.recipes) || !validateRawProperties('recipes', freshPage) ||
        JSON.stringify(criteria) !== JSON.stringify(getRecipeParentCriteria(freshPage))) {
      throw safeFailure('stale-read');
    }
    const currentParent = decodePage('recipes', freshPage);
    currentParent.id = criteria.id;
    rememberRecordParent('recipes', criteria.id, 'live', currentParent);
    recipe.validationStatus = 'ready';
    recipe.stats = { status: 'loading', count: null, average: null };
    const validated = deepFreeze(recipe);
    validatedRecipes.set(criteria.id, { recipe: validated, checkedAt: Date.now() });
    return validated;
  }

  async function listRecipeSummaries({ cursor = null, limit = 20, query: searchText = '', signal } = {}) {
    if (typeof queryPage !== 'function' || typeof searchText !== 'string' || searchText.length > 100) {
      throw safeFailure('invalid-input');
    }
    const filter = searchText.trim() ? { property: schemas.recipes.name[0], title: { contains: searchText.trim() } } : undefined;
    const query = { filter, sorts: [{ property: schemas.recipes.name[0], direction: 'ascending' }],
      properties: Object.values(schemas.recipes).map(([name]) => name) };
    const startCursor = queryCursor('recipes', query, cursor);
    if (startCursor !== null && (typeof startCursor !== 'string' || !startCursor.trim())) {
      throw safeFailure('invalid-input');
    }
    const page = await queryPageFor('recipes', { cursor: startCursor, limit,
      ...(filter ? { filter } : {}), sorts: query.sorts, properties: query.properties, signal });
    const items = [];
    for (const raw of page.items) {
      if (!validateRawPage(raw, sourceIds.recipes) || !validateRawProperties('recipes', raw)) continue;
      const recipe = decodePage('recipes', raw);
      recipe.id = normalizeUuid(raw.id);
      recipe.beanId = extractSingleRelation(raw.properties['원두']);
      recipe.steps = [];
      recipe.validationStatus = 'checking';
      recipe.stats = { status: 'loading', count: null, average: null };
      items.push(recipe);
      pendingRecipePages.set(recipe.id, structuredClone(raw));
    }
    return deepFreeze({ items, nextCursor: pageCursor('recipes', query, page.nextCursor),
      hasMore: page.hasMore, complete: page.complete && !page.hasMore });
  }

  async function validateRecipeSummaries(ids, { signal } = {}) {
    if (!Array.isArray(ids) || ids.length < 1 || ids.length > 20 ||
        ids.some(id => !normalizeUuid(id))) throw safeFailure('invalid-input');
    const uniqueIds = [...new Set(ids.map(normalizeUuid))];
    const parents = new Map();
    for (const id of uniqueIds) {
      let page = pendingRecipePages.get(id);
      if (!page) {
        try { page = await getPage.call(client, id, { signal }); }
        catch { page = null; }
      }
      if (page) parents.set(id, page);
    }
    let stepPages = [];
    try {
      const filters = uniqueIds.map(id => relationFilter(schemas.steps.recipeId[0], id));
      stepPages = await collectPages('steps', { filter: filters.length === 1 ? filters[0] : { or: filters },
        properties: Object.values(schemas.steps).map(([name]) => name), signal });
    } catch {
      return deepFreeze({ items: uniqueIds.map(id => ({ id, status: 'error' })) });
    }
    const results = [];
    for (const id of uniqueIds) {
      const parent = parents.get(id);
      if (!parent) { results.push({ id, status: 'error' }); continue; }
      try {
        const recipe = await validateSelectedRecipe(parent, stepPages, signal);
        pendingRecipePages.delete(id);
        results.push({ id, status: 'ready', recipe });
      } catch {
        results.push({ id, status: 'error' });
      }
    }
    return deepFreeze({ items: results });
  }

  async function getBean(beanId, { signal } = {}) {
    const id = normalizeUuid(beanId);
    if (!id) throw safeFailure('invalid-input');
    try {
      const raw = await getPage.call(client, id, { signal });
      if (!validateRawPage(raw, sourceIds.beans) || !validateRawProperties('beans', raw)) {
        throw safeFailure('bean-unavailable');
      }
      const bean = decodePage('beans', raw);
      bean.id = id;
      rememberRecordParent('beans', id, 'live', bean);
      return deepFreeze(bean);
    } catch (error) {
      if (safeFailures.has(error)) throw error;
      if (error?.httpStatus === 404) throw safeFailure('bean-unavailable');
      throw readError(error);
    }
  }

  async function getRecipeDetail(recipeId, { signal } = {}) {
    const id = normalizeUuid(recipeId);
    if (!id) throw safeFailure('invalid-input');
    let parent;
    try { parent = await getPage.call(client, id, { signal }); }
    catch (error) {
      if (error?.httpStatus === 404) throw safeFailure('recipe-unavailable');
      throw readError(error);
    }
    const stepPages = await collectPages('steps', { filter: relationFilter(schemas.steps.recipeId[0], id),
      properties: Object.values(schemas.steps).map(([name]) => name), signal });
    return deepFreeze(await validateSelectedRecipe(parent, stepPages, signal));
  }

  async function listRecords({ beanId = null, recipeId = null, cursor = null, limit = 20, signal } = {}) {
    if (typeof queryPage !== 'function') throw safeFailure('read-failed');
    const normalizedBean = beanId == null || beanId === '' ? null : normalizeUuid(beanId);
    const normalizedRecipe = recipeId == null || recipeId === '' ? null : normalizeUuid(recipeId);
    if ((beanId && !normalizedBean) || (recipeId && !normalizedRecipe)) throw safeFailure('invalid-input');
    const sorts = [{ property: schemas.records.date[0], direction: 'descending' },
      { timestamp: 'last_edited_time', direction: 'descending' }];
    const query = { beanId: normalizedBean, recipeId: normalizedRecipe, sorts };
    const tokenState = queryCursor('records', query, cursor);
    let state;
    const now = Date.now();
    pruneRecordPageStates(now);
    if (tokenState === null) {
      state = { rawCursor: null, rawDone: false, rawCursors: [], pendingRaw: [], seenIds: [] };
    } else {
      const entry = isRecord(tokenState) && typeof tokenState.id === 'string'
        ? recordPageStates.get(tokenState.id) : null;
      if (!entry) {
        throw safeFailure('invalid-input');
      }
      entry.lastUsedAt = now;
      state = structuredClone(entry.state);
    }
    const properties = Object.values(schemas.records).map(([name]) => name);
    const seen = new Set(state.seenIds);
    const queued = new Set(state.pendingRaw.map(page => normalizeUuid(page.id)));

    try {
      let scanned = 0;
      while (state.pendingRaw.length < limit && scanned < 3 && !state.rawDone) {
        const page = await queryPageFor('records', { cursor: state.rawCursor, limit: 100, sorts, properties, signal });
        scanned++;
        for (const row of page.items) {
          const id = normalizeUuid(row?.id);
          if (!id || seen.has(id) || queued.has(id)) continue;
          const record = currentRawRecordValue(row);
          if (!record || (normalizedBean && record.beanId !== normalizedBean) ||
              (normalizedRecipe && record.recipeId !== normalizedRecipe)) continue;
          state.pendingRaw.push(row);
          queued.add(id);
        }
        state.rawCursor = page.nextCursor;
        state.rawDone = !page.hasMore;
        if (page.hasMore) {
          if (state.rawCursors.includes(page.nextCursor)) throw safeFailure('pagination-error');
          state.rawCursors.push(page.nextCursor);
        } else if (!page.complete) throw safeFailure('query-incomplete');
      }

      state.pendingRaw.sort((left, right) => {
        const leftDate = currentRawRecordValue(left)?.date ?? '';
        const rightDate = currentRawRecordValue(right)?.date ?? '';
        return String(rightDate).localeCompare(String(leftDate)) || String(right.id).localeCompare(String(left.id));
      });
      const rawItems = state.pendingRaw.splice(0, limit);
      const pageItems = rawItems.map(currentRawRecordValue).filter(Boolean);
      state.seenIds = [...new Set([...state.seenIds, ...pageItems.map(item => item.id)])];
      const beans = cachedRecordParents('beans', pageItems.map(item => item.beanId));
      const recipes = cachedRecordParents('recipes', pageItems.map(item => item.recipeId));
      const complete = state.rawDone && state.pendingRaw.length === 0;
      let nextCursor = null;
      if (!complete) {
        const id = String(++recordPageSequence);
        recordPageStates.set(id, { state: structuredClone(state), lastUsedAt: Date.now() });
        nextCursor = pageCursor('records', query, { id });
      }
      return deepFreeze({ items: pageItems, beans, recipes, nextCursor, hasMore: !complete, complete });
    } catch (error) {
      if (safeFailures.has(error)) throw error;
      throw readError(error);
    }
  }

  function currentRawRecordValue(page) {
    if (!validateRawPage(page, sourceIds.records)) return null;
    const decoded = decodePage('records', page);
    const recipeRelation = relationState(page.properties['레시피']);
    const recipeIds = recipeRelation.ids;
    const snapshotRecipeId = normalizeUuid(decoded.snapshot?.version === 2
      ? decoded.snapshot.recipe?.id : decoded.snapshot?.id);
    const recipeId = recipeIds.length === 1 ? recipeIds[0]
      : recipeIds.length === 0 ? snapshotRecipeId
        : recipeIds.includes(snapshotRecipeId) ? snapshotRecipeId : null;
    const snapshot = readSnapshot(decoded.snapshot, recipeId);
    if (!snapshot || snapshot.value.recordGeneration !== CURRENT_RECORD_GENERATION) return null;
    const beanRelation = relationState(page.properties['원두']);
    const snapshotBeanId = snapshot.beanId;
    const beanCandidates = [...new Set([...beanRelation.ids, ...(snapshotBeanId ? [snapshotBeanId] : [])])];
    const beanRelationAmbiguous = beanRelation.present && !beanRelation.complete;
    const beanId = beanCandidates.length === 1 && !beanRelationAmbiguous ? beanCandidates[0] : null;
    if (!snapshot) return null;
    decoded.id = normalizeUuid(page.id);
    decoded.recipeId = recipeId;
    decoded.beanId = beanId;
    decoded.beanResolution = !beanId ? 'needs-confirmation'
      : beanRelation.ids.includes(beanId) ? 'relation'
        : snapshot.version === 2 ? 'snapshot-v2' : 'snapshot-v1';
    decoded.relationEvidence = { bean: beanRelation, recipe: recipeRelation,
      legacyRecipeBean: { ids: [], complete: true, present: false } };
    if (recipeIds.length > 1 || !recipeRelation.complete) decoded.recipeCandidates = recipeIds;
    if (beanCandidates.length > 1 || beanRelationAmbiguous) decoded.beanCandidates = beanCandidates;
    decoded.snapshot = snapshot.value;
    decoded.snapshotStatus = 'valid';
    const issues = recordValidationIssues(decoded);
    if (issues.length) decoded.invalidFields = issues;
    const snapshotBean = snapshot.value.version === 2 ? snapshot.value.bean : null;
    const snapshotRecipe = snapshot.value.version === 2 ? snapshot.value.recipe : snapshot.value;
    decoded.beanNameStatus = recordParentNameStatus('beans', beanId, snapshotBean?.name);
    decoded.recipeNameStatus = recordParentNameStatus('recipes', recipeId, snapshotRecipe?.name);
    return decoded;
  }

  async function hydrateRecordParents(records, { signal } = {}) {
    if (!Array.isArray(records) || records.some(record => !isCurrentRecord(record))) {
      throw safeFailure('invalid-input');
    }
    ensureRecordParentCacheRevision();
    const beanIds = [...new Set(records.filter(record => record.beanNameStatus === 'loading')
      .map(record => normalizeUuid(record.beanId)).filter(Boolean))];
    const recipeIds = [...new Set(records.filter(record => record.recipeNameStatus === 'loading')
      .map(record => normalizeUuid(record.recipeId)).filter(Boolean))];

    async function hydrateKind(kind, ids) {
      const statuses = {};
      const missing = [];
      for (const id of ids) {
        const entry = getRecordParentEntry(kind, id);
        if (entry) statuses[id] = entry.status;
        else missing.push(id);
      }
      const batch = missing.slice(0, 20);
      for (const id of batch) {
        try {
          const raw = await getPage.call(client, id, { signal });
          if (!validateRawPage(raw, sourceIds[kind]) || !validateRawProperties(kind, raw) ||
              normalizeUuid(raw.id) !== id) {
            statuses[id] = 'error';
            continue;
          }
          const value = decodePage(kind, raw);
          value.id = id;
          rememberRecordParent(kind, id, 'live', value);
          statuses[id] = 'live';
        } catch (error) {
          if (signal?.aborted || error?.code === 'read-cancelled' || error?.name === 'AbortError') {
            throw safeFailure('read-cancelled');
          }
          if (error?.httpStatus === 404) {
            rememberRecordParent(kind, id, 'snapshot');
            statuses[id] = 'snapshot';
          } else statuses[id] = 'error';
        }
      }
      return { statuses, remaining: missing.slice(batch.length) };
    }

    const [beans, recipes] = await Promise.all([
      hydrateKind('beans', beanIds), hydrateKind('recipes', recipeIds),
    ]);
    return deepFreeze({
      beans: cachedRecordParents('beans', beanIds),
      recipes: cachedRecordParents('recipes', recipeIds),
      beanStatuses: beans.statuses,
      recipeStatuses: recipes.statuses,
      remainingBeanIds: beans.remaining,
      remainingRecipeIds: recipes.remaining,
    });
  }

  async function getRecipeStats(recipeId, { signal, validatedRecipe } = {}) {
    const id = normalizeUuid(recipeId);
    if (!id) throw safeFailure('invalid-input');
    const validated = validatedRecipes.get(id);
    if (!validated || validated.recipe !== validatedRecipe || Date.now() - validated.checkedAt > 60000) {
      await getRecipeDetail(id, { signal });
    }
    try {
      const rows = await collectPages('records', { properties: Object.values(schemas.records).map(([name]) => name), signal });
      const current = rows.map(currentRawRecordValue).filter(Boolean);
      const stats = summarizeRatings(current, id);
      return deepFreeze({ status: 'ready', complete: true, ...stats });
    } catch (error) {
      if (safeFailures.has(error)) throw error;
      throw readError(error);
    }
  }

  async function getBeanRecordCounts(ids, { signal } = {}) {
    if (!Array.isArray(ids) || ids.length > 20 || ids.some(id => !normalizeUuid(id))) {
      throw safeFailure('invalid-input');
    }
    const selected = new Set(ids.map(normalizeUuid));
    try {
      const rows = await collectPages('records', { properties: Object.values(schemas.records).map(([name]) => name), signal });
      const counts = Object.fromEntries([...selected].map(id => [id, 0]));
      for (const page of rows) {
        const record = currentRawRecordValue(page);
        if (!record) continue;
        const relation = relationState(page.properties['원두']);
        const snapshot = readSnapshot(record.snapshot, record.recipeId);
        const snapshotBeanId = snapshot?.beanId ?? null;
        const candidates = [...new Set([...relation.ids, ...(snapshotBeanId ? [snapshotBeanId] : [])])];
        if (candidates.length !== 1 || (relation.present && !relation.complete)) continue;
        const bean = candidates[0];
        if (selected.has(bean)) counts[bean]++;
      }
      return deepFreeze({ status: 'ready', complete: true, counts });
    } catch (error) {
      if (safeFailures.has(error)) throw error;
      throw readError(error);
    }
  }

  async function searchOptions({ kind, query = '', cursor = null, limit = 20, signal } = {}) {
    const normalizedQuery = typeof query === 'string' ? query.trim() : '';
    if (!['beans', 'recipes'].includes(kind) || typeof query !== 'string' || normalizedQuery.length > 100) {
      throw safeFailure('invalid-input');
    }
    const page = kind === 'beans'
      ? await listBeans({ query: normalizedQuery, cursor, limit, signal })
      : await listRecipeSummaries({ query: normalizedQuery, cursor, limit, signal });
    if (kind === 'recipes' && page.items.length) {
      const validation = await validateRecipeSummaries(page.items.map(item => item.id), { signal });
      const statusById = new Map(validation.items.map(item => [item.id, item.status]));
      return deepFreeze({ ...page, items: page.items.map(item => ({ id: item.id, name: item.name,
        status: statusById.get(item.id) ?? 'error' })) });
    }
    return deepFreeze({ ...page, items: page.items.map(item => ({ id: item.id, name: item.name, status: 'ready' })) });
  }

  async function fetchAllRaw() {
    const rawData = {};
    for (const kind of KINDS) {
      try {
        const pages = await queryAll.call(client, kind);
        if (!Array.isArray(pages)) throw new Error('Query failed');
        rawData[kind] = pages;
      } catch {
        throw safeFailure('read-failed');
      }
    }
    return rawData;
  }

  async function assembleData(rawData) {
    const excluded = { recipes: 0, records: 0, steps: 0 };

    // 1. Beans
    const beans = [];
    const beanIdSet = new Set();
    for (const page of rawData.beans) {
      if (!validateRawPage(page, sourceIds.beans) || !validateRawProperties('beans', page)) continue;
      const decoded = decodePage('beans', page);
      decoded.id = normalizeUuid(page.id);
      beans.push(decoded);
      beanIdSet.add(decoded.id);
    }

    // 3. Raw Recipes & Parent criteria
    const rawRecipeCandidates = [];
    for (const page of rawData.recipes) {
      if (!validateRawPage(page, sourceIds.recipes) || !validateRawProperties('recipes', page)) {
        excluded.recipes++;
        continue;
      }
      const criteria = getRecipeParentCriteria(page);
      rawRecipeCandidates.push({ page, criteria });
    }

    // 4. Steps
    const stepsByRecipeId = new Map();
    const taintedRecipeIds = new Set();
    for (const page of rawData.steps) {
      const observedRecipeIds = extractObservedRecipeIds(page);
      const validPage = validateRawPage(page, sourceIds.steps) && validateRawProperties('steps', page);
      const recipeRelation = validPage ? extractSingleRelation(page.properties['레시피']) : null;
      if (!recipeRelation) {
        // A rejected row cannot count as a step. Its raw relation IDs still
        // taint identifiable parents, even when the row's own ID or source is bad.
        // This only covers rows returned by the full query; absent deleted rows
        // cannot be inferred from this read.
        for (const recipeId of observedRecipeIds) taintedRecipeIds.add(recipeId);
        excluded.steps++;
        continue;
      }
      const decoded = decodePage('steps', page);
      decoded.id = normalizeUuid(page.id);
      decoded.recipeId = recipeRelation;
      if (!stepsByRecipeId.has(recipeRelation)) stepsByRecipeId.set(recipeRelation, []);
      stepsByRecipeId.get(recipeRelation).push(decoded);
    }

    // 5. Validate complete Recipes and re-read their parents after all queries.
    const validatedRecipes = [];
    const recipeBeanRelations = new Map(rawData.recipes
      .filter(page => validateRawPage(page, sourceIds.recipes))
      .map(page => [normalizeUuid(page.id), relationState(page.properties['원두'])]));
    for (const { page, criteria } of rawRecipeCandidates) {
      const recipeId = criteria.id;
      if (taintedRecipeIds.has(recipeId)) {
        excluded.recipes++;
        continue;
      }
      const steps = stepsByRecipeId.get(recipeId) || [];
      steps.sort((a, b) => a.order - b.order);

      if (steps.length === 0 || steps[0].order !== 1) {
        excluded.recipes++;
        continue;
      }

      const decoded = decodePage('recipes', page);
      decoded.id = recipeId;
      decoded.beanId = criteria.beanId;
      decoded.steps = steps;

      try {
        validateStoredRecipe(decoded);
      } catch {
        excluded.recipes++;
        continue;
      }

      let freshPage;
      try {
        freshPage = await getPage.call(client, recipeId);
      } catch {
        throw safeFailure('stale-read');
      }
      if (!validateRawPage(freshPage, sourceIds.recipes) || !validateRawProperties('recipes', freshPage)) {
        throw safeFailure('stale-read');
      }
      const freshCriteria = getRecipeParentCriteria(freshPage);
      if (JSON.stringify(criteria) !== JSON.stringify(freshCriteria)) throw safeFailure('stale-read');

      validatedRecipes.push(decoded);
    }

    // 6. Records retain their stored snapshot, even when the recipe was deleted.
    const records = [];
    for (const page of rawData.records) {
      if (!validateRawPage(page, sourceIds.records)) {
        excluded.records++;
        continue;
      }
      const recipeRelationState = relationState(page.properties['레시피']);
      const recipeIds = recipeRelationState.ids;
      const decoded = decodePage('records', page);
      const snapshotRecipeId = normalizeUuid(decoded.snapshot?.version === 2 ? decoded.snapshot.recipe?.id : decoded.snapshot?.id);
      const recipeRelation = recipeIds.length === 1 ? recipeIds[0]
        : recipeIds.length === 0 ? snapshotRecipeId
          : recipeIds.includes(snapshotRecipeId) ? snapshotRecipeId : null;
      const snapshot = readSnapshot(decoded.snapshot, recipeRelation);
      const snapshotWasPresent = snapshotWasStored(page);
      decoded.snapshot = snapshot?.value ?? null;
      decoded.snapshotStatus = snapshot ? 'valid' : snapshotWasPresent ? 'damaged' : 'missing';
      const beanRelationState = relationState(page.properties['원두']);
      const snapshotBeanId = snapshot?.beanId ?? null;
      const legacyRecipeIds = snapshot?.version === 2 ? []
        : recipeIds.length ? recipeIds : recipeRelation ? [recipeRelation] : [];
      const legacyRecipeBeanState = combineRelationStates(legacyRecipeIds
        .map(id => recipeBeanRelations.get(id)).filter(Boolean));
      const rowBeanIds = beanRelationState.ids;
      const candidates = [...new Set([
        ...rowBeanIds,
        ...(snapshotBeanId ? [snapshotBeanId] : []),
        ...legacyRecipeBeanState.ids,
      ])];
      const relationEvidence = {
        bean: beanRelationState,
        recipe: recipeRelationState,
        legacyRecipeBean: legacyRecipeBeanState,
      };
      const relationAmbiguous = [beanRelationState, legacyRecipeBeanState]
        .some(state => state.present && !state.complete);
      const selectedBeanId = candidates.length === 1 && !relationAmbiguous ? candidates[0] : null;
      const beanIsKnown = selectedBeanId !== null && beanIdSet.has(selectedBeanId);
      const beanResolution = candidates.length !== 1 || relationAmbiguous || !beanIsKnown
        ? 'needs-confirmation'
        : rowBeanIds.includes(selectedBeanId) ? 'relation'
          : snapshot?.version === 2 ? 'snapshot-v2'
            : snapshot?.version === 1 && snapshotBeanId ? 'snapshot-v1'
              : 'legacy-recipe';
      decoded.id = normalizeUuid(page.id);
      decoded.recipeId = recipeRelation;
      decoded.relationEvidence = relationEvidence;
      if (recipeIds.length > 1 || !recipeRelationState.complete) decoded.recipeCandidates = recipeIds;
      decoded.beanId = selectedBeanId;
      decoded.beanResolution = beanResolution;
      if (candidates.length > 1 || relationAmbiguous) decoded.beanCandidates = candidates;
      const invalidFields = recordValidationIssues(decoded);
      if (invalidFields.length) decoded.invalidFields = invalidFields;
      records.push(decoded);
    }

    // 7. Calculate stats for validated recipes.
    for (const recipe of validatedRecipes) {
      recipe.stats = summarizeRatings(records, recipe.id);
    }

    return deepFreeze({ beans, recipes: validatedRecipes, records, excluded });
  }

  async function readAll() {
    try {
      return await assembleData(await fetchAllRaw());
    } catch (error) {
      if (safeFailures.has(error)) throw error;
      throw safeFailure('read-failed');
    }
  }

  async function readRecipeForSnapshot(recipeId) {
    const id = normalizeUuid(recipeId);
    if (!id) throw safeFailure('invalid-input');
    const all = await readAll();
    const found = all.recipes.find(recipe => recipe.id === id);
    if (!found) throw safeFailure('recipe-unavailable');
    return found;
  }

  return Object.freeze({ listBeans, listRecipeSummaries, validateRecipeSummaries, getBean, getRecipeDetail,
    listRecords, hydrateRecordParents, invalidateRecordParentCache, searchOptions,
    getRecipeStats, getBeanRecordCounts, readAll, readRecipeForSnapshot });
}
