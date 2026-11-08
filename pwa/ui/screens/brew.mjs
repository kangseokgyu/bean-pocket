import { createStarRating } from '../star-rating.mjs';
import { make } from '../shared/dom.mjs';
import { decorativeSvg } from '../shared/icons.mjs';
import { button, setActionButton } from '../shared/buttons.mjs';
import { favoriteIcon } from '../shared/favorite-button.mjs';
import { label, addFieldset, formBase, addFormActions } from '../shared/form-fields.mjs';
import { formatTime } from '../shared/recipe-presentation.mjs';
import { routePath, routeParams } from '../shared/route.mjs';
import { isIsoDate, localDate } from '../shared/date.mjs';

function routeButton(document, title, route, action = 'navigate', variant = 'secondary') {
  const control = button(document, title, 'button', action, variant);
  control.dataset.route = route;
  return control;
}

export function brewOptionScope(route, kind) {
  return `${kind === 'recipes' ? routeParams(route).get('beanId') ?? '' : 'beans'}|${routeParams(route).get('favorite') === 'true'}`;
}

export function cachedBrewOptionPage(optionPages, kind, route) {
  const cached = optionPages.get(`brew:${kind}`);
  return cached && Date.now() - cached.savedAt < 60000 && cached.scope === brewOptionScope(route, kind)
    ? cached : null;
}

function brewOptionPage(data, optionPages, kind, routeQuery, route) {
  const cached = cachedBrewOptionPage(optionPages, kind, route);
  if (cached && (!routeQuery || cached.query === routeQuery)) return cached;
  return { items: kind === 'beans' ? data.beans ?? [] : data.recipes ?? [],
    nextCursor: data.screen?.nextCursor ?? null, hasMore: !!data.screen?.hasMore,
    complete: data.screen?.complete !== false, query: routeQuery };
}

export function renderBrewOptionResults(document, kind, selectedBean, selectedId, query, page) {
  const isBeans = kind === 'beans';
  const results = make(document, 'div', undefined, 'brew-option-results');
  const items = [...(page.items ?? [])].sort((left, right) => Number(right.favorite === true) - Number(left.favorite === true));
  if (!items.length) {
    const stillLoading = page.hasMore || page.complete === false;
    const noun = isBeans ? '원두' : '레시피';
    if (query) {
      const message = `“${query}” 검색 결과가 없습니다.${stillLoading
        ? ' 다른 항목도 계속 확인할 수 있습니다.' : ' 입력어를 확인하거나 전체 목록에서 다시 찾아보세요.'}`;
      results.append(make(document, 'p', message, 'empty-state'));
      const browseAll = button(document, `전체 ${noun} 보기`, 'button', 'browse-all-brew-options', 'utility');
      browseAll.dataset.optionTarget = 'brew';
      browseAll.dataset.optionKind = kind;
      results.append(browseAll);
    } else {
      const message = isBeans
        ? '원두가 아직 등록되지 않았습니다. 원두를 먼저 등록한 뒤 추출을 시작해 주세요.'
        : '등록된 레시피가 없습니다. 레시피를 등록한 뒤 다시 선택해 주세요.';
      results.append(make(document, 'p', stillLoading ? `${message} 다른 항목도 계속 확인할 수 있습니다.` : message, 'empty-state'));
      if (isBeans) {
        results.append(routeButton(document, '원두 등록하기', '/beans'));
        results.append(routeButton(document, '홈으로 돌아가기', '/home'));
      } else {
        results.append(routeButton(document, '레시피 메뉴에서 등록하기', '/recipes'));
        results.append(routeButton(document, '원두 다시 선택', `/brew/bean?selectedBeanId=${encodeURIComponent(selectedBean.id)}`, 'back-to-beans', 'back'));
      }
    }
  }

  const list = make(document, 'div', undefined, 'brew-option-list');
  for (const item of items) {
    const card = button(document, undefined, 'button', isBeans ? 'select-brew-bean' : 'select-brew-recipe');
    card.className = 'button brew-option-card';
    card.dataset[isBeans ? 'beanId' : 'recipeId'] = item.id;
    if (!isBeans) card.dataset.beanId = selectedBean.id;
    card.setAttribute('aria-pressed', String(item.id === selectedId));
    const ready = isBeans || item.status === 'ready' || item.validationStatus === 'ready' ||
      (item.status === undefined && item.validationStatus === undefined && Array.isArray(item.steps) && item.steps.length > 0);
    card.disabled = !ready;
    if (!isBeans) card.dataset.optionReady = String(ready);
    const heading = make(document, 'span', undefined, 'brew-option-heading');
    heading.append(make(document, 'strong', item.name, 'brew-option-name'));
    if (item.favorite === true) {
      const badge = make(document, 'span', undefined, 'brew-option-favorite');
      badge.setAttribute('role', 'img');
      badge.setAttribute('aria-label', '즐겨찾기');
      badge.append(favoriteIcon(document));
      heading.append(badge);
    }
    card.append(heading);
    if (isBeans) {
      const details = [item.origin, item.roaster].filter(Boolean).join(' · ');
      if (details) card.append(make(document, 'span', details, 'muted-note brew-option-details'));
      if (item.id === selectedId) card.append(make(document, 'span', '선택한 원두', 'brew-selected-label'));
      card.append(make(document, 'span', '이 원두로 내리기 →', 'brew-option-action'));
    } else {
      card.append(make(document, 'span', `${item.dose}g · ${item.temperature}℃ · 물 ${item.totalWater}g · ${item.steps?.length ?? 0}단계`, 'brew-option-details'));
      if (!ready) card.append(make(document, 'span', item.status === 'error' || item.validationStatus === 'error'
        ? '레시피를 확인할 수 없어 선택할 수 없습니다.' : '레시피 단계를 확인 중입니다.', 'muted-note brew-option-status'));
      if (item.id === selectedId) card.append(make(document, 'span', '선택한 레시피', 'brew-selected-label'));
      card.append(make(document, 'span', ready ? '이 레시피로 준비하기 →' : '레시피 단계 확인 후 선택 가능', 'brew-option-action'));
    }
    list.append(card);
  }
  if (items.length) results.append(list);
  if (page.hasMore) {
    const more = routeButton(document, '더 불러오기', '', 'more-options', 'pagination');
    more.className = 'button button--pagination page-load-more';
    more.dataset.optionTarget = 'brew';
    more.dataset.optionKind = kind;
    more.dataset.nextCursor = page.nextCursor ?? '';
    results.append(more);
  } else if (page.complete === false) {
    results.append(make(document, 'p', '전체 목록을 확인하지 못했습니다. 다시 조회해 주세요.', 'record-warning'));
  }
  return results;
}

export function renderUnavailableRoute(pane, document, route, error) {
  const path = routePath(route);
  const params = routeParams(route);
  pane.append(make(document, 'h1', '선택한 항목을 확인할 수 없습니다.'));
  pane.append(make(document, 'p', error === 'recipe-unavailable'
    ? '레시피가 없거나 추출 단계가 유효하지 않습니다. 최신 목록에서 다시 선택해 주세요.'
    : error === 'record-unavailable' ? '기록의 실제 조건을 확인할 수 없습니다. 기록 목록을 새로 확인해 주세요.'
      : error === 'bean-required' ? '추출에 사용할 원두를 먼저 선택해 주세요.'
        : '선택한 원두가 없거나 주소가 올바르지 않습니다. 원두 목록을 새로 확인해 주세요.', 'record-warning'));
  const beanId = params.get('beanId');
  if (path === '/brew/run' && error === 'record-unavailable') {
    pane.append(routeButton(document, '기록 목록으로', '/records', 'navigate', 'back'));
  } else if (path === '/brew/run' && beanId) {
    pane.append(routeButton(document, '레시피 다시 선택', `/brew/recipe?beanId=${encodeURIComponent(beanId)}`, 'navigate', 'back'));
  } else if (path === '/records/new' && beanId) {
    pane.append(routeButton(document, '추출 다시 선택', `/brew/recipe?beanId=${encodeURIComponent(beanId)}`, 'navigate', 'back'));
  } else {
    pane.append(routeButton(document, '원두 선택으로', '/brew/bean', 'navigate', 'back'));
  }
  pane.append(routeButton(document, '홈으로', '/home'));
}

function renderBrewOptions(pane, data, document, route, optionPages, kind, selectedBean, params) {
  const isBeans = kind === 'beans';
  const selectedId = params.get(isBeans ? 'selectedBeanId' : 'selectedRecipeId') ?? '';
  const routeQuery = params.get('q') ?? '';
  const page = brewOptionPage(data, optionPages, kind, routeQuery, route);
  const title = isBeans ? '원두 선택' : '레시피 선택';
  pane.append(make(document, 'h1', title));
  if (selectedBean) pane.append(brewSelectionSummary(document, 'bean', '선택한 원두', selectedBean.name,
    '원두 변경', `/brew/bean?selectedBeanId=${encodeURIComponent(selectedBean.id)}`, 'back-to-beans'));
  const searchField = make(document, 'div', undefined, 'brew-option-search');
  const searchId = isBeans ? 'brew-bean-name-search' : 'brew-recipe-name-search';
  const searchLabel = make(document, 'label', `${isBeans ? '원두' : '레시피'} 이름 검색`, 'brew-option-search-label');
  searchLabel.setAttribute('for', searchId);
  searchField.append(searchLabel);
  const searchControl = make(document, 'div', undefined, 'brew-option-search-control');
  searchControl.append(decorativeSvg(document, '0 0 24 24', 'brew-option-search-icon',
    ['M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16ZM17 17l4 4']));
  const search = make(document, 'input');
  search.id = searchId;
  search.type = 'search';
  search.setAttribute('autocomplete', 'off');
  search.setAttribute('placeholder', isBeans ? '예: 에티오피아 시다마' : '예: V60');
  search.dataset.optionSearchKind = kind;
  search.dataset.optionTarget = 'brew';
  search.dataset.optionLoaded = 'true';
  search.value = page.query ?? routeQuery;
  const clearSearch = button(document, '검색어 지우기', 'button', 'clear-brew-search', 'utility');
  clearSearch.className = 'button button--utility brew-option-search-clear';
  clearSearch.hidden = !search.value;
  searchControl.append(search, clearSearch);
  searchField.append(searchControl);
  pane.append(searchField);
  pane.append(renderBrewOptionResults(document, kind, selectedBean, selectedId, search.value, page));
}

function brewStepIndicator(pane, document, path) {
  const steps = [
    ['/brew/bean', '01', '원두'], ['/brew/recipe', '02', '레시피'], ['/brew/run', '03', '추출'],
  ];
  const list = make(document, 'ol', undefined, 'brew-step-indicator');
  list.setAttribute('aria-label', '추출 시작 단계');
  for (const [route, number, title] of steps) {
    const step = make(document, 'li');
    if (path === route) step.setAttribute('aria-current', 'step');
    step.append(make(document, 'span', number, 'brew-step-number'), make(document, 'span', title, 'brew-step-name'));
    list.append(step);
  }
  pane.append(list);
}

function brewSelectionSummary(document, selection, labelText, value, changeText, route, action) {
  const summary = make(document, 'div', undefined, 'brew-selection-summary');
  summary.dataset.selection = selection;
  const copy = make(document, 'span', undefined, 'brew-selection-copy');
  copy.append(make(document, 'span', labelText, 'brew-selection-label'), make(document, 'strong', value, 'brew-selection-name'));
  summary.append(copy, routeButton(document, changeText, route, action, 'utility'));
  return summary;
}

export function recipeFromRecord(record) {
  if (record?.snapshotStatus !== 'valid') return null;
  return record.snapshot?.version >= 2 ? record.snapshot.recipe
    : record.snapshot?.version === 1 ? record.snapshot : null;
}

function recipeIdFromRecord(record) {
  const snapshot = record?.snapshot;
  if (snapshot?.version === 3) return snapshot.source?.recipeId ?? null;
  if (snapshot?.version === 2) return snapshot.recipe?.id ?? record.recipeId ?? null;
  return snapshot?.version === 1 ? snapshot.id ?? record.recipeId ?? null : record?.recipeId ?? null;
}

function renderBrewRun(pane, data, document, route, params) {
  const sourceRecordId = params.get('recordId') || params.get('sourceRecordId') || '';
  const sourceRecord = sourceRecordId ? data.records?.find(item => item.id === sourceRecordId) : null;
  const beanId = params.get('beanId') || sourceRecord?.beanId;
  const bean = data.beans?.find(item => item.id === beanId);
  const recipeId = sourceRecord ? recipeIdFromRecord(sourceRecord) : params.get('recipeId');
  const recipe = sourceRecord ? recipeFromRecord(sourceRecord) : data.recipes?.find(item => item.id === recipeId);
  if (!bean || !recipe || !Array.isArray(recipe.steps) || !recipe.steps.length) {
    renderUnavailableRoute(pane, document, route, 'recipe-unavailable');
    return;
  }
  pane.append(make(document, 'h1', sourceRecord ? '기록 조건으로 다시 추출' : '추출 준비'));
  pane.append(
    brewSelectionSummary(document, 'bean', '원두', bean.name, '원두 변경',
      `/brew/bean?selectedBeanId=${encodeURIComponent(bean.id)}`, 'back-to-beans'),
    brewSelectionSummary(document, 'recipe', '출처 조건', recipe.name || '기록 당시 조건', '레시피 선택',
      `/brew/recipe?beanId=${encodeURIComponent(bean.id)}&selectedRecipeId=${encodeURIComponent(recipeId ?? '')}`, 'back-to-recipes'),
  );
  pane.append(make(document, 'p', '이번 추출에 실제로 사용할 조건을 확인하고 바꾸세요. 저장된 기록에는 아래 전체 조건이 들어갑니다.', 'brew-edit-intro'));
  const form = formBase(document, 'brews', '이번 추출과 평가 기록');
  form.dataset.draftRoute = route;
  const hidden = (name, value) => {
    const input = make(document, 'input');
    input.type = 'hidden'; input.name = name; input.value = value ?? '';
    return input;
  };
  const sourceId = sourceRecord ? recipeIdFromRecord(sourceRecord) : recipeId;
  form.append(hidden('beanId', bean.id), hidden('sourceRecipeId', sourceId),
    hidden('sourceRecordId', sourceRecord?.id ?? params.get('sourceRecordId') ?? ''));
  addFieldset(document, form, '추출 조건', [
    ['조건 이름', 'name', 'text', true],
    ['드리퍼', 'dripper', 'text', false],
    ['원두량 (g)', 'dose', 'number', true, { min: 0, step: 'any' }],
    ['분쇄도 (레퍼런스 설정)', 'grind', 'text', false, { placeholder: '예: EK43 9, Comandante 24클릭' }],
    ['분쇄 입자 (um)', 'microns', 'text', false,
      { inputMode: 'text', placeholder: '예: 900 또는 900~1000' }],
    ['그라인더', 'grinder', 'text', false],
    ['그라인더 설정', 'grinderSetting', 'text', false],
    ['물 온도 (℃)', 'temperature', 'number', true, { min: 0, max: 100, step: 'any' }],
    ['총 물 양 (g)', 'totalWater', 'number', true, { min: 0, step: 'any' }],
  ], 'brew-condition-fields');
  form.elements.name.value = recipe.name ?? '';
  for (const key of ['dripper', 'dose', 'grind', 'grinder', 'grinderSetting', 'microns', 'temperature', 'totalWater']) {
    form.elements[key].value = recipe[key] ?? '';
  }
  form.append(label(document, '추출 가이드', 'extractionGuide', 'textarea', false, { rows: 3 }));
  form.elements.extractionGuide.value = recipe.extractionGuide ?? '';
  const changes = make(document, 'p', '공용 레시피 조건 그대로', 'brew-condition-changes');
  changes.dataset.brewChanges = '';
  changes.setAttribute('aria-live', 'polite');
  form.append(changes);
  const stages = make(document, 'section', undefined, 'brew-edit-stages');
  stages.append(make(document, 'h3', '물 붓기 단계'));
  const stageList = make(document, 'div', undefined, 'brew-stage-list');
  stageList.dataset.brewStages = '';
  stages.append(stageList, button(document, '단계 추가', 'button', 'add-brew-stage', 'utility'));
  const total = make(document, 'p', '', 'brew-stage-total');
  total.dataset.brewStageTotal = '';
  total.setAttribute('aria-live', 'polite');
  stages.append(total);
  form.append(stages);
  recipe.steps.forEach((step, index) => addBrewStage(document, stageList, step, index));
  form.append(make(document, 'h3', '추출 평가'));
  form.append(label(document, '추출 날짜', 'date', 'date', true));
  form.append(createStarRating(document));
  form.append(label(document, '컵노트 (선택)', 'cupNote', 'textarea', false));
  form.elements.date.value = params.get('date') && isIsoDate(params.get('date')) ? params.get('date') : localDate();
  form.dataset.initialConditions = JSON.stringify(brewRecipeInput(form));
  addFormActions(document, form);
  const save = form.querySelector('[data-entry-submit]');
  if (save) { save.dataset.idleLabel = '추출 평가 저장'; setActionButton(save, '추출 평가 저장', 'idle'); }
  updateBrewConditions(form);
  pane.append(form);
}

export function addBrewStage(document, list, step = {}, index = list.children.length) {
  const row = make(document, 'fieldset', undefined, 'brew-stage-row');
  row.append(make(document, 'legend', `단계 ${index + 1}`));
  row.append(label(document, '단계 이름', 'stepName', 'text', false));
  row.append(label(document, '누적 시간 (분:초)', 'time', 'text', true,
    { placeholder: index === 0 ? '0:00' : '0:30', inputMode: 'text', pattern: '\\d+:[0-5]\\d' }));
  row.append(label(document, '이번 물 양 (g)', 'water', 'number', true, { min: 0, step: 'any' }));
  const remove = button(document, '단계 제거', 'button', 'remove-brew-stage', 'utility');
  remove.disabled = index === 0;
  row.append(remove);
  row.querySelector('[name="stepName"]').value = step.name ?? '';
  row.querySelector('[name="time"]').value = formatTime(step.seconds ?? 0);
  row.querySelector('[name="water"]').value = step.water ?? '';
  list.append(row);
  return row;
}

function brewRecipeInput(form) {
  return {
    name: form.elements.name.value,
    dripper: form.elements.dripper.value,
    dose: form.elements.dose.value,
    grind: form.elements.grind.value,
    grinder: form.elements.grinder.value,
    grinderSetting: form.elements.grinderSetting.value,
    microns: form.elements.microns.value,
    temperature: form.elements.temperature.value,
    totalWater: form.elements.totalWater.value,
    extractionGuide: form.elements.extractionGuide.value,
    steps: [...form.querySelectorAll('.brew-stage-row')].map(row => ({
      name: row.querySelector('[name="stepName"]').value,
      time: row.querySelector('[name="time"]').value,
      water: row.querySelector('[name="water"]').value,
    })),
  };
}

export function updateBrewConditions(form) {
  const actual = brewRecipeInput(form);
  const initial = JSON.parse(form.dataset.initialConditions || '{}');
  const labels = { name: '조건 이름', dripper: '드리퍼', dose: '원두량', grind: '분쇄도', grinder: '그라인더',
    grinderSetting: '그라인더 설정', microns: '분쇄 입자', temperature: '물 온도', totalWater: '총 물 양',
    extractionGuide: '추출 가이드', steps: '물 붓기 단계' };
  const changed = Object.keys(labels).filter(key => JSON.stringify(actual[key]) !== JSON.stringify(initial[key]));
  const status = form.querySelector('[data-brew-changes]');
  if (status) status.textContent = changed.length ? `공용 레시피에서 변경: ${changed.map(key => labels[key]).join(', ')}` : '공용 레시피 조건 그대로';
  const sum = actual.steps.reduce((total, step) => total + (Number(step.water) || 0), 0);
  const total = form.querySelector('[data-brew-stage-total]');
  if (total) total.textContent = `단계 물 합 ${Number(sum.toFixed(3))}g · 총 물 ${actual.totalWater || '—'}g`;
}

export function renderBrewFlow(parent, data, document, route, optionPages) {
  const path = routePath(route);
  const params = routeParams(route);
  const pane = make(document, 'section', undefined, 'brew-flow-pane');
  if (path === '/brew/run') pane.className += ' brew-run-pane';
  brewStepIndicator(pane, document, path);
  if (data.screen?.error) {
    renderUnavailableRoute(pane, document, route, data.screen.error);
  } else if (path === '/brew/bean') {
    renderBrewOptions(pane, data, document, route, optionPages, 'beans', null, params);
  } else if (path === '/brew/recipe') {
    const beanId = params.get('beanId');
    const bean = data.beans?.find(item => item.id === beanId);
    if (!bean) renderUnavailableRoute(pane, document, route, 'bean-unavailable');
    else renderBrewOptions(pane, data, document, route, optionPages, 'recipes', bean, params);
  } else if (path === '/brew/run') {
    renderBrewRun(pane, data, document, route, params);
  } else {
    renderUnavailableRoute(pane, document, route, 'bean-unavailable');
  }
  parent.replaceChildren(pane);
}

export function brewPayload(form) {
  return {
    beanId: form.elements.beanId.value,
    sourceRecipeId: form.elements.sourceRecipeId.value || null,
    sourceRecordId: form.elements.sourceRecordId.value || null,
    actualRecipe: brewRecipeInput(form),
    date: form.elements.date.value,
    rating: form.elements.rating.value,
    cupNote: form.elements.cupNote.value,
  };
}
