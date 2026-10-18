import { decodePage, schemas } from './notion-properties.mjs';
import { summarizeRatings, validateRecord, validateStoredRecipe } from '../domain.mjs';

const KINDS = Object.freeze(['beans', 'bags', 'recipes', 'steps', 'records']);
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const safeFailures = new WeakSet();

function safeFailure(code, writeState = 'not-sent') {
  const failure = Object.freeze({ code, writeState });
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

  for (const [, [name, type]] of Object.entries(fields)) {
    const property = page.properties[name];
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

function extractOptionalSingleRelation(property) {
  if (!property || typeof property !== 'object') return null;
  if (property.has_more === true) return null;
  if (!Array.isArray(property.relation)) return null;
  if (property.relation.length === 0) return { id: null };
  if (property.relation.length === 1) {
    const id = normalizeUuid(property.relation[0]?.id);
    return id ? { id } : null;
  }
  return null;
}

function extractObservedRecipeIds(page) {
  if (!isRecord(page) || page.archived === true || page.in_trash === true || !isRecord(page.properties)) return [];
  const relation = page.properties['레시피']?.relation;
  if (!Array.isArray(relation)) return [];
  return [...new Set(relation.map(item => normalizeUuid(item?.id)).filter(Boolean))];
}

function getRecipeParentCriteria(page) {
  const decoded = decodePage('recipes', page);
  return {
    ...decoded,
    id: normalizeUuid(page.id),
    beanId: extractSingleRelation(page.properties['원두']),
    sourceId: normalizeUuid(page.parent.data_source_id),
    lastEditedTime: page.last_edited_time,
  };
}

function isValidRecordSnapshot(snapshot, recipeId, record, bag) {
  if (!isRecord(snapshot) || snapshot.version !== 1) return false;
  const snapshotId = normalizeUuid(snapshot.id);
  const beanId = normalizeUuid(snapshot.beanId);
  if (snapshotId !== recipeId || !beanId) return false;

  try {
    validateStoredRecipe(snapshot);
    validateRecord(record, { id: snapshotId, beanId }, bag);
    return true;
  } catch {
    return false;
  }
}

export function createReadRepository(client) {
  if (!isRecord(client)) throw safeFailure('invalid-input');

  let queryAll, getPage, sourceIds;
  try {
    queryAll = client.queryAll;
    getPage = client.getPage;
    sourceIds = copySourceIds(client.dataSources);
  } catch {
    throw safeFailure('invalid-input');
  }
  if (typeof queryAll !== 'function' || typeof getPage !== 'function' || !sourceIds) {
    throw safeFailure('invalid-input');
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
    const excluded = { bags: 0, recipes: 0, records: 0, steps: 0 };

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

    // 2. Bags
    const bags = [];
    const bagsById = new Map();
    for (const page of rawData.bags) {
      if (!validateRawPage(page, sourceIds.bags) || !validateRawProperties('bags', page)) {
        excluded.bags++;
        continue;
      }
      const beanRelation = extractSingleRelation(page.properties['원두']);
      if (!beanRelation || !beanIdSet.has(beanRelation)) {
        excluded.bags++;
        continue;
      }
      const decoded = decodePage('bags', page);
      decoded.id = normalizeUuid(page.id);
      decoded.beanId = beanRelation;
      bags.push(decoded);
      bagsById.set(decoded.id, decoded);
    }

    // 3. Raw Recipes & Parent criteria
    const rawRecipeCandidates = [];
    for (const page of rawData.recipes) {
      if (!validateRawPage(page, sourceIds.recipes) || !validateRawProperties('recipes', page)) {
        excluded.recipes++;
        continue;
      }
      const criteria = getRecipeParentCriteria(page);
      if (!criteria.beanId || !beanIdSet.has(criteria.beanId)) {
        excluded.recipes++;
        continue;
      }
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
      if (!validateRawPage(page, sourceIds.records) || !validateRawProperties('records', page)) {
        excluded.records++;
        continue;
      }
      const recipeRelation = extractSingleRelation(page.properties['레시피']);
      if (!recipeRelation) {
        excluded.records++;
        continue;
      }
      const bagRelation = extractOptionalSingleRelation(page.properties['원두 봉지']);
      if (!bagRelation) {
        excluded.records++;
        continue;
      }

      const decoded = decodePage('records', page);
      const bag = bagRelation.id === null ? null : bagsById.get(bagRelation.id);
      if (bagRelation.id !== null && !bag) {
        excluded.records++;
        continue;
      }
      if (!isValidRecordSnapshot(decoded.snapshot, recipeRelation, decoded, bag)) {
        excluded.records++;
        continue;
      }

      decoded.id = normalizeUuid(page.id);
      decoded.recipeId = recipeRelation;
      decoded.bagId = bagRelation.id;
      records.push(decoded);
    }

    // 7. Calculate stats for validated recipes.
    for (const recipe of validatedRecipes) {
      recipe.stats = summarizeRatings(records, recipe.id);
    }

    return deepFreeze({ beans, bags, recipes: validatedRecipes, records, excluded });
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

  return Object.freeze({ readAll, readRecipeForSnapshot });
}
