import { decodePage, optionalProperties, schemas } from './notion-properties.mjs';
import {
  recordValidationIssues,
  summarizeRatings,
  validateStoredRecipe,
  validateStoredSnapshot,
} from '../domain.mjs';

const KINDS = Object.freeze(['beans', 'recipes', 'steps', 'records']);
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

  return Object.freeze({ readAll, readRecipeForSnapshot });
}
