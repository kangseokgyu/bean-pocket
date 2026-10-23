import {
  InputError,
  copyRecipe,
  createSnapshot,
  validateBag,
  validateBean,
  validateRecord,
  validateRecipe,
  validateStoredRecipe,
} from '../domain.mjs';
import { validateCreatePayload } from '../data/notion-client.mjs';
import { createSubmissionDraft } from '../state/submission-state.mjs';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DELETE_TARGET_BY_OPERATION = Object.freeze({
  'delete-bean': 'beans', 'delete-bag': 'bags', 'delete-recipe': 'recipes', 'delete-record': 'records',
});

function isPlainRecord(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function cloneInput(value, ancestors = new Set()) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (!value || typeof value !== 'object' || ancestors.has(value)) throw new InputError('입력값을 확인해 주세요.');
  ancestors.add(value);
  let result;
  if (Array.isArray(value)) {
    const keys = Reflect.ownKeys(value);
    if (keys.length !== value.length + 1 || keys.some(key => typeof key !== 'string')) throw new InputError('입력값을 확인해 주세요.');
    result = Array.from({ length: value.length }, (_, index) => {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (!descriptor || !Object.hasOwn(descriptor, 'value') || !descriptor.enumerable) throw new InputError('입력값을 확인해 주세요.');
      return cloneInput(descriptor.value, ancestors);
    });
  } else {
    if (!isPlainRecord(value)) throw new InputError('입력값을 확인해 주세요.');
    const keys = Reflect.ownKeys(value);
    if (keys.some(key => typeof key !== 'string')) throw new InputError('입력값을 확인해 주세요.');
    result = {};
    for (const key of keys) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor || !Object.hasOwn(descriptor, 'value') || !descriptor.enumerable) throw new InputError('입력값을 확인해 주세요.');
      result[key] = cloneInput(descriptor.value, ancestors);
    }
  }
  ancestors.delete(value);
  return result;
}

function inputObject(value, label = '입력값') {
  let copy;
  try { copy = cloneInput(value); }
  catch { throw new InputError(`${label}을(를) 확인해 주세요.`); }
  if (!isPlainRecord(copy)) throw new InputError(`${label}을(를) 확인해 주세요.`);
  return copy;
}

function normalizedId(value, label) {
  if (typeof value !== 'string' || !UUID.test(value.trim())) throw new InputError(`${label}을(를) 선택해 주세요.`);
  return value.trim().toLowerCase();
}

function optionalId(value, label) {
  if (value === undefined || value === null || value === '') return null;
  return normalizedId(value, label);
}

function safeState(error) {
  try {
    return ['not-sent', 'rejected', 'unknown'].includes(error?.writeState) ? error.writeState : 'unknown';
  } catch {
    return 'unknown';
  }
}

function idOf(value) {
  try { return normalizedId(value, '페이지'); }
  catch { return null; }
}

function oneById(rows, id) {
  if (!Array.isArray(rows)) return null;
  const matches = rows.filter(row => idOf(row?.id) === id);
  return matches.length === 1 ? matches[0] : null;
}

function requireBean(data, beanId) {
  const item = oneById(data?.beans, beanId);
  if (!item) throw new InputError('최신 조회에서 선택한 원두를 찾을 수 없습니다. 다시 조회해 주세요.');
  return item;
}

function requireRecipe(data, recipeId) {
  const recipe = oneById(data?.recipes, recipeId);
  if (!recipe) throw new InputError('최신 조회에서 완전한 레시피를 찾을 수 없습니다. 다시 조회해 주세요.');
  try { validateStoredRecipe(recipe); }
  catch { throw new InputError('레시피 단계가 완전하지 않습니다. 다시 조회해 주세요.'); }
  return recipe;
}

function requireBag(data, bagId, bean) {
  const bag = oneById(data?.bags, bagId);
  if (!bag) throw new InputError('최신 조회에서 선택한 봉지를 찾을 수 없습니다. 다시 조회해 주세요.');
  const bagBeanId = normalizedId(bag.beanId, '봉지의 원두');
  if (bagBeanId !== bean.id) throw new InputError('봉지와 선택한 원두가 다릅니다. 다시 조회해 주세요.');
  return bag;
}

function requireBagById(data, bagId) {
  const bag = oneById(data?.bags, bagId);
  if (!bag) throw new InputError('최신 조회에서 봉지를 찾을 수 없습니다. 다시 조회해 주세요.');
  const bean = requireBean(data, normalizedId(bag.beanId, '봉지의 원두'));
  requireBag(data, bagId, bean);
  return bag;
}

function requireRecord(data, recordId) {
  const record = oneById(data?.records, recordId);
  if (!record) throw new InputError('최신 조회에서 추출 기록을 찾을 수 없습니다. 다시 조회해 주세요.');
  return record;
}

function recordDependency(data, kind, targetId) {
  if (!Array.isArray(data?.records) || !Number.isInteger(data?.excluded?.records) || data.excluded.records > 0) return 'unknown';
  const relationKey = kind === 'bags' ? 'bag' : 'recipe';
  const idKey = kind === 'bags' ? 'bagId' : 'recipeId';
  const candidatesKey = kind === 'bags' ? 'bagCandidates' : 'recipeCandidates';
  for (const record of data.records) {
    const relation = record?.relationEvidence?.[relationKey];
    if (!relation || !Array.isArray(relation.ids) || typeof relation.complete !== 'boolean' || typeof relation.present !== 'boolean') return 'unknown';
    const candidates = record[candidatesKey];
    if (candidates !== undefined && !Array.isArray(candidates)) return 'unknown';
    if (record[idKey] === targetId || relation.ids.includes(targetId) || candidates?.includes(targetId)) return 'in-use';
    if (relation.present && !relation.complete) return 'unknown';
    if (kind === 'recipes' && !record.recipeId && !record.recipeCandidates?.length) return 'unknown';
  }
  return null;
}

function deletionFailure(code) {
  return Object.freeze({ code, writeState: 'not-sent' });
}

function recipeSourceValue(recipe) {
  return {
    id: normalizedId(recipe.id, '원본 레시피'),
    beanId: recipe.beanId ? normalizedId(recipe.beanId, '원두') : null,
    name: recipe.name,
    dripper: recipe.dripper,
    dose: recipe.dose,
    grind: recipe.grind,
    grinder: recipe.grinder,
    grinderSetting: recipe.grinderSetting,
    microns: recipe.microns,
    temperature: recipe.temperature,
    totalWater: recipe.totalWater,
    steps: recipe.steps.map(step => ({
      name: step.name, order: step.order, seconds: step.seconds, interval: step.interval,
      water: step.water, cumulativeWater: step.cumulativeWater,
    })),
  };
}

function sameRecipeSource(first, second) {
  return JSON.stringify(recipeSourceValue(first)) === JSON.stringify(recipeSourceValue(second));
}

function normalizedRecipeInput(value) {
  const input = inputObject(value, '레시피');
  delete input.beanId;
  return validateRecipe(input);
}

function normalizedBagInput(value) {
  const input = inputObject(value, '봉지');
  const bag = validateBag(input);
  return { ...bag, beanId: normalizedId(bag.beanId, '원두') };
}

function normalizedRecordInput(value) {
  const input = inputObject(value, '추출 기록');
  const beanId = normalizedId(input.beanId, '원두');
  const recipeId = normalizedId(input.recipeId, '레시피');
  const bagId = optionalId(input.bagId, '원두 봉지');
  // Validate the independent record fields with the shared domain rules. The
  // real recipe and optional bag are reloaded under the write lock before save.
  const record = validateRecord(input, { id: recipeId }, { id: beanId }, null);
  return { ...record, beanId, recipeId, bagId };
}

export function createCommands({ client, repository, submissionState } = {}) {
  if (!client || typeof client.createPage !== 'function' || typeof client.archiveCreatedPage !== 'function' ||
      typeof client.connectionRevision !== 'string' || !client.dataSources ||
      !repository || typeof repository.readAll !== 'function' || typeof repository.readRecipeForSnapshot !== 'function' ||
      !submissionState || typeof submissionState.withWriteLock !== 'function') {
    throw new TypeError('명령 실행에 필요한 client, repository, submissionState를 확인해 주세요.');
  }
  const commandsByDraft = new WeakMap();
  const uncertainWrites = new WeakSet();
  const isUnknown = error => uncertainWrites.has(error) || safeState(error) === 'unknown';

  async function prepare(kind, payload, metadata = {}) {
    const draft = await createSubmissionDraft(kind, payload, {
      connectionRevision: client.connectionRevision,
      dataSources: client.dataSources,
    });
    commandsByDraft.set(draft, { kind, ...metadata });
    return draft;
  }

  async function prepareBean(payload) {
    return prepare('beans', validateBean(inputObject(payload, '원두')));
  }

  async function prepareDelete(kind, payload) {
    const targetKind = DELETE_TARGET_BY_OPERATION[kind];
    if (!targetKind) throw new InputError('삭제 대상을 확인해 주세요.');
    const input = inputObject(payload, `삭제할 ${targetKind}`);
    const labels = { beans: '원두', bags: '봉지', recipes: '레시피', records: '추출 기록' };
    return prepare(kind, { id: normalizedId(input.id, labels[targetKind]) });
  }

  const prepareDeleteBean = payload => prepareDelete('delete-bean', payload);
  const prepareDeleteBag = payload => prepareDelete('delete-bag', payload);
  const prepareDeleteRecipe = payload => prepareDelete('delete-recipe', payload);
  const prepareDeleteRecord = payload => prepareDelete('delete-record', payload);

  function archiveTarget(kind, id) {
    if (typeof client.archivePage === 'function') return client.archivePage.call(client, kind, id);
    if (kind === 'beans' && typeof client.archiveBean === 'function') return client.archiveBean.call(client, id);
    throw Object.freeze({ code: 'delete-unavailable', writeState: 'not-sent' });
  }

  async function prepareBag(payload) {
    return prepare('bags', normalizedBagInput(payload));
  }

  async function prepareRecipe(payload) {
    return prepare('recipes', normalizedRecipeInput(payload));
  }

  async function prepareCopy(recipeIdValue, changesValue = {}) {
    const recipeId = normalizedId(recipeIdValue, '복사할 레시피');
    const changes = inputObject(changesValue, '변경값');
    const source = await repository.readRecipeForSnapshot(recipeId);
    try { validateStoredRecipe(source); }
    catch { throw new InputError('복사할 레시피가 완전하지 않습니다. 다시 조회해 주세요.'); }
    if (normalizedId(source.id, '원본 레시피') !== recipeId) throw new InputError('복사할 레시피가 바뀌었습니다. 다시 조회해 주세요.');

    const copied = copyRecipe(source);
    delete copied.beanId;
    const payload = normalizedRecipeInput({ ...copied, ...changes });
    return prepare('recipes', payload, { copySourceId: recipeId, copySource: recipeSourceValue(source) });
  }

  async function prepareRecord(payload) {
    if (client.recordBeanRelationSupported !== true) {
      throw Object.freeze({ code: 'schema-unsupported', writeState: 'not-sent' });
    }
    return prepare('records', normalizedRecordInput(payload));
  }

  async function writeCreate(operation, kind, payload) {
    let dispatchedState;
    try {
      return await operation.write(async () => {
        try { return await client.createPage.call(client, kind, payload); }
        catch (error) { dispatchedState = safeState(error); throw error; }
      }, { createdKind: kind });
    } catch (error) {
      if (safeState(error) === 'unknown' || dispatchedState === 'unknown') uncertainWrites.add(error);
      throw error;
    }
  }

  async function writeArchive(operation, pageId) {
    let dispatchedState;
    try {
      return await operation.write(async () => {
        try { return await client.archiveCreatedPage.call(client, pageId); }
        catch (error) { dispatchedState = safeState(error); throw error; }
      }, { archiveId: pageId });
    } catch (error) {
      if (safeState(error) === 'unknown' || dispatchedState === 'unknown') uncertainWrites.add(error);
      throw error;
    }
  }

  async function cleanupRecipe(operation, parentId, childIds) {
    try { await writeArchive(operation, parentId); }
    catch { return; }
    for (const childId of [...childIds].reverse()) {
      try { await writeArchive(operation, childId); }
      catch (error) { if (isUnknown(error)) return; }
    }
  }

  async function createRecipePages(operation, payload) {
    const { steps, ...recipe } = payload;
    validateCreatePayload('recipes', recipe, client.dataSources);
    const stagePayloads = steps.map(step => ({ ...step }));
    // Check every step before dispatching the parent so no transport limit can
    // leave an intentionally incomplete recipe behind.
    for (const step of stagePayloads) validateCreatePayload('steps', { ...step, recipeId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' }, client.dataSources);

    let parentId = null;
    const childIds = [];
    try {
      const parent = await writeCreate(operation, 'recipes', recipe);
      parentId = idOf(parent?.id);
      if (!parentId) throw Object.freeze({ code: 'invalid-write-response', writeState: 'unknown' });
      const createdSteps = [];
      for (let index = stagePayloads.length - 1; index >= 0; index--) {
        const stage = stagePayloads[index];
        const created = await writeCreate(operation, 'steps', { ...stage, recipeId: parentId });
        const stepId = idOf(created?.id);
        if (!stepId) throw Object.freeze({ code: 'invalid-write-response', writeState: 'unknown' });
        childIds.push(stepId);
        createdSteps.push({ ...stage, id: stepId, recipeId: parentId });
      }
      createdSteps.sort((first, second) => first.order - second.order);
      return { ...recipe, id: parentId, steps: createdSteps, stats: { count: 0, average: null } };
    } catch (error) {
      if (isUnknown(error)) throw error;
      if (parentId) await cleanupRecipe(operation, parentId, childIds);
      throw error;
    }
  }

  async function execute(draft) {
    const metadata = draft && commandsByDraft.get(draft);
    if (!metadata) throw Object.freeze({ code: 'invalid-draft', writeState: 'not-sent' });

    return submissionState.withWriteLock(context => context.runOperation(
      draft,
      client.connectionRevision,
      async operation => {
        const payload = draft.payload;
        if (metadata.kind === 'beans') {
          validateCreatePayload('beans', payload, client.dataSources);
          return writeCreate(operation, 'beans', payload);
        }

        const latest = await repository.readAll();
        if (metadata.kind === 'delete-bean') {
          requireBean(latest, payload.id);
          const hasRecordDependency = Array.isArray(latest.records) && latest.records.some(record =>
            record.beanId === payload.id || record.beanCandidates?.includes(payload.id) ||
            record.beanResolution === 'needs-confirmation');
          if (!Array.isArray(latest.bags) || !Array.isArray(latest.recipes) ||
              latest.bags.some(bag => bag.beanId === payload.id) ||
              hasRecordDependency ||
              (latest.excluded?.bags ?? 0) > 0 ||
              (latest.excluded?.records ?? 0) > 0) {
            throw new InputError('연결된 봉지·추출 기록 또는 확인할 수 없는 기록이 있어 삭제할 수 없습니다.');
          }
          return operation.write(() => archiveTarget('beans', payload.id), { deleteId: payload.id, deleteKind: 'beans' });
        }
        const deleteKind = DELETE_TARGET_BY_OPERATION[metadata.kind];
        if (deleteKind && deleteKind !== 'beans') {
          if (deleteKind === 'bags') requireBagById(latest, payload.id);
          else if (deleteKind === 'recipes') requireRecipe(latest, payload.id);
          else requireRecord(latest, payload.id);
          if (deleteKind === 'bags' || deleteKind === 'recipes') {
            const dependency = recordDependency(latest, deleteKind, payload.id);
            if (dependency === 'in-use') throw deletionFailure('delete-in-use');
            if (dependency === 'unknown') throw deletionFailure('delete-dependency-unknown');
          }
          return operation.write(() => archiveTarget(deleteKind, payload.id), { deleteKind, deleteId: payload.id });
        }
        if (metadata.kind === 'bags') {
          requireBean(latest, payload.beanId);
          validateCreatePayload('bags', payload, client.dataSources);
          return writeCreate(operation, 'bags', payload);
        }

        if (metadata.kind === 'recipes') {
          if (metadata.copySourceId) {
            const source = oneById(latest?.recipes, metadata.copySourceId);
            if (!source || !sameRecipeSource(source, metadata.copySource)) {
              throw new InputError('복사 원본이 바뀌거나 삭제되었습니다. 다시 조회해 주세요.');
            }
          }
          const validated = validateRecipe(payload);
          return createRecipePages(operation, validated);
        }

        if (metadata.kind === 'records') {
          const bean = requireBean(latest, payload.beanId);
          const recipe = requireRecipe(latest, payload.recipeId);
          const bag = payload.bagId ? requireBag(latest, payload.bagId, bean) : null;
          const validated = validateRecord(payload, recipe, bean, bag);
          const record = {
            ...validated,
            name: `${validated.date} · ${recipe.name}`,
            snapshot: createSnapshot(bean, recipe),
          };
          validateCreatePayload('records', record, client.dataSources);
          return writeCreate(operation, 'records', record);
        }

        throw Object.freeze({ code: 'invalid-draft', writeState: 'not-sent' });
      },
    ));
  }

  return Object.freeze({ prepareBean, prepareDeleteBean, prepareDeleteBag, prepareDeleteRecipe, prepareDeleteRecord, prepareBag, prepareRecipe, prepareRecord, prepareCopy, execute });
}
