import { isValidRating } from '../../domain.mjs';
import { actionIcon } from '../shared/icons.mjs';
import { make } from '../shared/dom.mjs';
import { button, iconButton, trashButton } from '../shared/buttons.mjs';
import { favoriteButton } from '../shared/favorite-button.mjs';
import { currentRecords, recordName } from '../shared/record-card.mjs';
import {
  hasRecipeValue, makeStepTable, recipeMeasure, recipeOverview, recipeReady,
  recipeSectionHeading, recipeStepCount, recipeValidationMessage,
} from '../shared/recipe-presentation.mjs';

export function renderRecipes(pane, data, document) {
  if (!data.recipes.length) pane.append(make(document, 'p', data.screen?.hasMore
    ? '레시피를 더 확인 중입니다. 더 보기로 계속 확인해 주세요.'
    : data.screen?.complete === false ? '레시피 목록을 끝까지 확인하지 못했습니다. 새로고침해 주세요.'
      : '등록된 레시피가 없습니다.', 'empty-state'));
  for (const recipe of data.recipes) {
    const card = make(document, 'article', undefined, 'recipe-card recipe-summary-card');
    const recipeHeader = make(document, 'div', undefined, 'entity-card-header');
    const title = make(document, 'h3');
    const link = make(document, 'a', recipe.name, 'recipe-card-link');
    link.setAttribute('href', `#/recipes/${recipe.id}`);
    link.setAttribute('aria-label', `${recipe.name} 상세 보기`);
    link.dataset.action = 'navigate';
    link.dataset.route = `/recipes/${recipe.id}`;
    title.append(link);
    recipeHeader.append(title, favoriteButton(document, data, 'recipes', recipe), trashButton(document, 'recipes', recipe.id, recipe.name));
    card.append(recipeHeader, recipeOverview(document, recipe));

    const summary = make(document, 'div', undefined, 'recipe-summary-meta');
    summary.append(make(document, 'span', recipeStepCount(recipe), 'recipe-step-count'));
    if (typeof recipe.extractionGuide === 'string' && recipe.extractionGuide.trim()) {
      summary.append(make(document, 'p', recipe.extractionGuide, 'recipe-guide-preview'));
    }
    card.append(summary);
    const validation = recipeValidationMessage(recipe);
    if (validation) card.append(make(document, 'p', validation.text, validation.className));
    pane.append(card);
  }
}

export function renderRecipeDetail(pane, data, document, recipeId) {
  const recipe = data.recipes.find(row => row.id === recipeId);
  if (!recipe) {
    pane.append(make(document, 'p', '레시피를 찾을 수 없습니다. 최신 목록을 새로고침해 주세요.'));
    return;
  }
  pane.append(recipeCard(document, recipe, data, true));
}

function recipeCard(document, recipe, data, detailed = false) {
  const article = make(document, 'article', undefined, 'recipe-card');
  const header = make(document, 'div', undefined, 'entity-card-header');
  header.append(make(document, 'h2', recipe.name));
  const headerActions = make(document, 'div', undefined, 'recipe-header-actions');
  if (detailed) {
    const edit = iconButton(document, '', `${recipe.name} 수정`, 'edit-recipe');
    edit.className += ' entity-edit';
    edit.dataset.id = recipe.id;
    edit.replaceChildren(actionIcon(document, 'edit'));
    headerActions.append(edit);
  }
  headerActions.append(trashButton(document, 'recipes', recipe.id, recipe.name));
  header.append(headerActions);
  article.append(header, recipeOverview(document, recipe));

  const validation = recipeValidationMessage(recipe);
  if (validation) article.append(make(document, 'p', validation.text, validation.className));

  const conditionDetails = [
    ['분쇄도', recipe.grind, ''], ['그라인더', recipe.grinder, ''],
    ['그라인더 설정', recipe.grinderSetting, ''], ['분쇄 입자', recipe.microns, 'μm'],
  ].filter(([, value]) => hasRecipeValue(value));
  if (conditionDetails.length) {
    const conditions = make(document, 'section', undefined, 'recipe-detail-section recipe-conditions');
    conditions.append(recipeSectionHeading(document, '추출 조건'));
    const list = make(document, 'dl', undefined, 'recipe-condition-list');
    for (const [label, value, unit] of conditionDetails) {
      const item = make(document, 'div', undefined, 'recipe-condition');
      item.append(make(document, 'dt', label), make(document, 'dd', `${value}${unit}`));
      list.append(item);
    }
    conditions.append(list);
    article.append(conditions);
  }

  const stats = recipe.stats ?? { count: 0, average: null };
  article.append(make(document, 'p', stats.status === 'loading' ? '출처 추출 평가 통계를 확인 중입니다.'
    : stats.status === 'error' ? '출처 추출 평가 통계를 확인하지 못했습니다.'
      : stats.count ? `이 레시피에서 시작한 추출 평가 ${stats.count}회 · 평균 ${Number(stats.average).toFixed(1)}점`
        : '이 레시피에서 시작한 추출 평가 없음 · 0회', 'recipe-rating'));

  const steps = Array.isArray(recipe.steps) ? recipe.steps : [];
  const stepsSection = make(document, 'section', undefined, 'recipe-detail-section recipe-steps-section');
  const stepLabel = Array.isArray(recipe.steps) ? `${steps.length}단계`
    : recipe.validationStatus === 'checking' ? '확인 중'
      : recipe.validationStatus === 'error' ? '확인 실패' : '단계 미기록';
  stepsSection.append(recipeSectionHeading(document, '붓기 단계', stepLabel));
  if (steps.length) stepsSection.append(makeStepTable(document, steps));
  else stepsSection.append(make(document, 'p', recipe.validationStatus === 'checking' ? '레시피 단계를 확인 중입니다.'
    : recipe.validationStatus === 'error' ? '레시피 단계 확인에 실패했습니다.' : '등록된 붓기 단계가 없습니다.', 'muted-note'));
  article.append(stepsSection);

  if (typeof recipe.extractionGuide === 'string' && recipe.extractionGuide.trim()) {
    const guide = make(document, 'section', undefined, 'recipe-detail-section recipe-extraction-guide');
    guide.append(recipeSectionHeading(document, '추출 가이드'), make(document, 'p', recipe.extractionGuide));
    article.append(guide);
  }

  const records = currentRecords(data).filter(record => record.recipeId === recipe.id)
    .sort((a, b) => String(b.date ?? '').localeCompare(String(a.date ?? '')));
  const recordsSection = make(document, 'section', undefined, 'recipe-detail-section recipe-records');
  recordsSection.append(recipeSectionHeading(document, '추출 기록'));
  if (!records.length) recordsSection.append(make(document, 'p', data.screen?.hasMore
    ? '기록을 더 확인 중입니다.'
    : data.screen?.complete === false ? '전체 기록을 확인하지 못했습니다.' : '기록 없음'));
  for (const record of records) {
    const recordItem = make(document, 'div', undefined, 'recipe-record-item');
    const bean = data.beans.find(item => item.id === record.beanId);
    const validRating = isValidRating(record.rating);
    const validSnapshot = record.snapshotStatus === 'valid' ? record.snapshot : null;
    const snapshot = validSnapshot?.version >= 2 ? validSnapshot.recipe : validSnapshot;
    const recordHeader = make(document, 'div', undefined, 'entity-card-header record-summary-header');
    recordHeader.append(make(document, 'p', `${record.date || '날짜 확인 필요'} · 원두: ${bean?.name || '원두 확인 필요'} · ${record.rating ?? '별점 확인 필요'}/5 ${validRating ? '★'.repeat(record.rating) : ''}`),
      trashButton(document, 'records', record.id, recordName(record, data.recipes.find(item => item.id === record.recipeId), snapshot)));
    recordItem.append(recordHeader);
    const invalidLabels = [
      ...(record.invalidFields?.includes('date') ? ['날짜'] : []),
      ...(record.invalidFields?.includes('rating') ? ['별점(0.1~5.0, 0.1점 단위)'] : []),
    ];
    if (invalidLabels.length) recordItem.append(make(document, 'p', `기록 오류: ${invalidLabels.join(', ')}`, 'record-warning'));
    if (record.snapshotStatus === 'damaged') recordItem.append(make(document, 'p', '스냅샷이 손상되어 당시 조건을 표시할 수 없습니다.', 'record-warning'));
    if (record.cupNote) recordItem.append(make(document, 'p', `컵노트: ${record.cupNote}`));
    if (Array.isArray(snapshot?.steps)) {
      const dripper = hasRecipeValue(snapshot.dripper) ? snapshot.dripper : '드리퍼 미기록';
      const conditions = `기록 당시 조건: ${dripper} · ${recipeMeasure(snapshot.dose, 'g')} · ${recipeMeasure(snapshot.temperature, '℃')} · 물 ${recipeMeasure(snapshot.totalWater, 'g')}`;
      recordItem.append(make(document, 'p', conditions, 'record-snapshot-conditions'));
      recordItem.append(make(document, 'h5', '당시 단계'));
      recordItem.append(makeStepTable(document, snapshot.steps));
      if (typeof snapshot.extractionGuide === 'string' && snapshot.extractionGuide.trim()) {
        recordItem.append(make(document, 'p', `기록 당시 추출 가이드: ${snapshot.extractionGuide}`, 'record-extraction-guide'));
      }
    }
    recordsSection.append(recordItem);
  }
  article.append(recordsSection);

  const actions = make(document, 'div', undefined, 'recipe-card-actions');
  if (detailed) {
    const record = button(document, '이 레시피로 추출 기록', 'button', 'new-record', 'primary');
    record.dataset.id = recipe.id;
    record.disabled = !recipeReady(recipe);
    actions.append(record);
  }
  const copy = button(document, '이 레시피 복사', 'button', 'copy-recipe');
  copy.dataset.id = recipe.id;
  copy.disabled = !recipeReady(recipe);
  actions.append(copy);
  article.append(actions);
  return article;
}
