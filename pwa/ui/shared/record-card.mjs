import { isCurrentRecord, isValidRating } from '../../domain.mjs';
import { make } from './dom.mjs';
import { button, trashButton } from './buttons.mjs';

export function recordName(record, recipe, snapshotRecipe) {
  return `${record.date || '추출 기록'} · ${recipe?.name || snapshotRecipe?.name || '추출 기록'}`;
}

export function currentRecords(data) {
  return Array.isArray(data?.records) ? data.records.filter(isCurrentRecord) : [];
}

export function recordCard(document, record, data) {
  const card = make(document, 'article', undefined, 'record-card');
  const bean = (data.beans ?? []).find(item => item.id === record.beanId);
  const recipe = (data.recipes ?? []).find(item => item.id === record.recipeId);
  const validSnapshot = record.snapshotStatus === 'valid' ? record.snapshot : null;
  const snapshotBean = validSnapshot?.version >= 2 ? validSnapshot.bean : null;
  const snapshotRecipe = validSnapshot?.version >= 2 ? validSnapshot.recipe : validSnapshot;
  const validRating = isValidRating(record.rating);
  const beanName = bean?.name || snapshotBean?.name || (record.beanNameStatus === 'loading'
    ? '원두 이름 확인 중' : record.beanNameStatus === 'error' ? '원두 이름 불러오기 실패' : '원두 확인 필요');
  const recipeName = recipe?.name || snapshotRecipe?.name || (record.recipeNameStatus === 'loading'
    ? '레시피 이름 확인 중' : record.recipeNameStatus === 'error' ? '레시피 이름 불러오기 실패' : '확인할 수 없는 레시피');
  const header = make(document, 'div', undefined, 'entity-card-header');
  header.append(make(document, 'h3', `${record.date || '날짜 확인 필요'} · ${beanName}`),
    trashButton(document, 'records', record.id, recordName(record, recipe, snapshotRecipe)));
  card.append(header);
  card.append(make(document, 'p', `레시피: ${recipeName} · ${record.rating ?? '별점 확인 필요'}/5 ${validRating ? '★'.repeat(record.rating) : ''}`));
  const nameNotes = [
    recordParentNameNote('beans', record.beanNameStatus, snapshotBean?.name),
    recordParentNameNote('recipes', record.recipeNameStatus, snapshotRecipe?.name),
  ].filter(Boolean);
  for (const note of nameNotes) card.append(make(document, 'p', note, 'muted-note'));
  if (record.beanResolution === 'needs-confirmation') card.append(make(document, 'p', '과거 원두 관계를 확인해야 합니다.', 'record-warning'));
  const invalidLabels = [
    ...(record.invalidFields?.includes('date') ? ['날짜'] : []),
    ...(record.invalidFields?.includes('rating') ? ['별점(0.1~5.0, 0.1점 단위)'] : []),
  ];
  if (invalidLabels.length) card.append(make(document, 'p', `기록 오류: ${invalidLabels.join(', ')}`, 'record-warning'));
  if (record.snapshotStatus === 'damaged') card.append(make(document, 'p', '스냅샷이 손상되어 당시 조건을 표시할 수 없습니다.', 'record-warning'));
  if (record.cupNote) card.append(make(document, 'p', `컵노트: ${record.cupNote}`));
  const actions = make(document, 'div', undefined, 'record-card-actions');
  const replay = button(document, '이 조건으로 다시 추출', 'button', 'replay-record', 'secondary');
  replay.dataset.recordId = record.id;
  replay.dataset.beanId = record.beanId ?? '';
  replay.disabled = !isCurrentRecord(record) || record.beanResolution === 'needs-confirmation' ||
    !Array.isArray(snapshotRecipe?.steps) || !snapshotRecipe.steps.length;
  replay.dataset.actionDisabled = String(replay.disabled);
  const saveRecipe = button(document, '공용 레시피로 저장', 'button', 'save-shared-recipe', 'secondary');
  saveRecipe.dataset.recordId = record.id;
  saveRecipe.disabled = !isCurrentRecord(record) || !Array.isArray(snapshotRecipe?.steps) || !snapshotRecipe.steps.length;
  saveRecipe.dataset.actionDisabled = String(saveRecipe.disabled);
  const selectedBest = bean?.bestRecordId === record.id && ['checking', 'ready'].includes(bean.bestRecordStatus);
  const setBest = button(document, selectedBest ? '현재 사용자 베스트' : '이 원두의 베스트로 지정',
    'button', 'set-best-record', 'secondary');
  setBest.dataset.recordId = record.id;
  setBest.dataset.beanId = record.beanId ?? '';
  setBest.disabled = selectedBest || bean?.bestRecordStatus === 'unsupported' || !bean ||
    !isCurrentRecord(record) || record.beanResolution === 'needs-confirmation' || !validRating ||
    !!record.invalidFields?.length;
  setBest.dataset.actionDisabled = String(setBest.disabled);
  actions.append(replay, saveRecipe, setBest);
  if (bean?.bestRecordStatus === 'unsupported') {
    actions.append(make(document, 'p', 'Notion 원두 데이터베이스에 ‘베스트 추출’ 관계 속성을 추가하면 지정할 수 있습니다.',
      'record-best-unavailable'));
  } else if (!bean) {
    actions.append(make(document, 'p', '원두 정보를 확인할 수 없어 베스트를 지정할 수 없습니다.', 'record-best-unavailable'));
  } else if (!validRating) {
    actions.append(make(document, 'p', '유효한 별점 기록만 사용자 베스트로 지정할 수 있습니다.', 'record-best-unavailable'));
  }
  card.append(actions);
  return card;
}

function recordParentNameNote(kind, status, snapshotName) {
  const name = kind === 'beans' ? '원두' : '레시피';
  if (status === 'loading') return snapshotName
    ? `기록 당시 ${name} 이름을 표시하며 현재 이름을 확인 중입니다.`
    : `현재 ${name} 이름을 확인 중입니다.`;
  if (status === 'snapshot') return `기록 당시 ${name} 이름을 표시합니다.`;
  if (status === 'unavailable') return `${name} 이름을 확인할 수 없습니다.`;
  if (status === 'error') return snapshotName
    ? `현재 ${name} 이름을 불러오지 못해 기록 당시 이름을 표시합니다.`
    : `현재 ${name} 이름을 불러오지 못했습니다.`;
  return '';
}
