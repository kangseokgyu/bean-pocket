import { actionButton, setActionButton } from './shared/buttons.mjs';
import { make } from './shared/dom.mjs';
import { label } from './shared/form-fields.mjs';

const NOTION_PAGE_ORIGIN = 'https://www.notion.so/';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SOURCE_NAMES = Object.freeze({ beans: '원두', recipes: '레시피', steps: '레시피 단계', records: '추출 기록', bags: '봉지' });
const OPERATION_NAMES = Object.freeze({
  beans: '원두 등록',
  recipes: '레시피 등록',
  steps: '레시피 단계 저장',
  records: '추출 기록 저장',
  'edit-recipe': '레시피 수정',
  'set-best-record': '원두 베스트 추출 변경',
  'favorite-bean': '원두 즐겨찾기 변경',
  'favorite-recipe': '레시피 즐겨찾기 변경',
  'delete-bean': '원두 삭제',
  'delete-recipe': '레시피 삭제',
  'delete-record': '추출 기록 삭제',
});

function operationName(operation) {
  return OPERATION_NAMES[operation.kind] ?? '저장 작업';
}

function statusName(operation) {
  if (operation.kind.startsWith('delete-')) return '삭제 결과 확인 필요';
  if (operation.kind === 'edit-recipe') return '수정 결과 확인 필요';
  if (operation.kind.startsWith('favorite-')) return '즐겨찾기 변경 확인 필요';
  if (operation.status === 'partial') return '일부 저장 결과 확인 필요';
  return '저장 여부 확인 필요';
}

function sourceKind(operation) {
  if (operation.targetKind && SOURCE_NAMES[operation.targetKind]) return operation.targetKind;
  if (operation.kind === 'edit-recipe') return 'recipes';
  if (operation.kind === 'steps') return 'steps';
  return SOURCE_NAMES[operation.kind] ? operation.kind : 'records';
}

function originalPages(operation) {
  const pages = [];
  if (operation.targetId) pages.push({ id: operation.targetId, kind: operation.targetKind ?? sourceKind(operation) });
  if (operation.editTarget?.recipeId) pages.push({ id: operation.editTarget.recipeId, kind: 'recipes' });
  for (const page of operation.createdPages ?? []) pages.push(page);
  const seen = new Set();
  return pages.filter(page => {
    if (!page || typeof page.id !== 'string' || !UUID.test(page.id) || seen.has(page.id.toLowerCase())) return false;
    seen.add(page.id.toLowerCase());
    return true;
  });
}

function addOriginalLinks(document, card, operation) {
  const pages = originalPages(operation);
  if (!pages.length) {
    const name = SOURCE_NAMES[sourceKind(operation)] ?? 'Notion';
    card.append(make(document, 'p',
      '앱이 확인한 원본 페이지 ID가 없어 원본 링크가 없습니다. Notion의 ' + name +
        ' 데이터 소스에서 작업 시각과 결과를 직접 확인해 주세요.', 'muted-note'));
    return;
  }
  card.append(make(document, 'h4', '확인할 Notion 원본'));
  const list = make(document, 'ul', undefined, 'resolution-original-pages');
  for (const page of pages) {
    const link = document.createElement('a');
    link.dataset.originalPage = 'true';
    link.setAttribute('data-original-page', 'true');
    link.setAttribute('href', new URL(page.id.replaceAll('-', ''), NOTION_PAGE_ORIGIN).href);
    link.setAttribute('target', '_blank');
    link.setAttribute('rel', 'noopener noreferrer');
    link.setAttribute('referrerpolicy', 'no-referrer');
    link.textContent = 'Notion 원본 열기 · ' + (SOURCE_NAMES[page.kind] ?? '항목');
    const item = make(document, 'li');
    item.append(link);
    list.append(item);
  }
  card.append(list);
  card.append(make(document, 'p', 'ID가 확인된 원본에만 바로가기를 표시합니다. 링크를 열어 실제 상태를 직접 확인하세요.', 'muted-note'));
}

function verificationItems(operation, deleting, favoriting, editing, hasKnownPages) {
  if (deleting) return ['Notion 원본에서 대상 항목의 휴지통 이동 여부를 확인합니다.'];
  if (favoriting) return ['Notion 원본의 즐겨찾기 체크가 요청한 상태인지 확인합니다.'];
  if (editing) return ['레시피와 모든 단계가 수정 전 또는 수정 후 상태와 정확히 일치하는지 확인합니다.'];
  if (hasKnownPages) return ['이번 작업으로 확인된 ' + operation.knownPageCount + '개 항목의 저장 또는 보관 취소 결과를 모두 확인합니다.'];
  return ['Notion의 해당 데이터 소스에서 이번 작업으로 새 항목이 만들어졌는지 확인합니다.'];
}

function addVerificationChecklist(document, card, operation, deleting, favoriting, editing, hasKnownPages) {
  card.append(make(document, 'h4', '확인할 항목'));
  const list = make(document, 'ul', undefined, 'resolution-checklist');
  list.append(make(document, 'li', '새 요청을 보내지 말고 Notion 원본의 현재 상태를 확인합니다.'));
  for (const item of verificationItems(operation, deleting, favoriting, editing, hasKnownPages)) {
    list.append(make(document, 'li', item));
  }
  card.append(list);
}

function addOperationTime(document, card, updatedAt) {
  const time = document.createElement('time');
  time.dataset.operationTime = 'true';
  time.setAttribute('data-operation-time', 'true');
  const milliseconds = typeof updatedAt === 'string' ? Date.parse(updatedAt) : NaN;
  if (Number.isFinite(milliseconds)) {
    time.setAttribute('datetime', new Date(milliseconds).toISOString());
    time.textContent = new Intl.DateTimeFormat('ko-KR', {
      timeZone: 'Asia/Seoul', dateStyle: 'medium', timeStyle: 'short',
    }).format(milliseconds);
  } else {
    time.textContent = '시각 정보를 확인할 수 없습니다.';
  }
  const line = make(document, 'p', undefined, 'resolution-time');
  line.append(make(document, 'span', '마지막 변경 시각: '), time);
  card.append(line);
}

export function buildResolutionForm(document, operation) {
  const deleting = operation.kind.startsWith('delete-');
  const favoriting = operation.kind.startsWith('favorite-');
  const editing = operation.kind === 'edit-recipe';
  const targetName = SOURCE_NAMES[operation.targetKind] ?? '항목';
  const hasKnownPages = deleting || favoriting || editing || operation.knownPageCount > 0;
  const card = make(document, 'article', undefined, 'resolution-card');
  card.append(make(document, 'h3', operationName(operation) + ' · ' + statusName(operation)));
  addOperationTime(document, card, operation.updatedAt);
  if (favoriting) {
    card.append(make(document, 'p', 'Notion 원본의 즐겨찾기 체크 상태를 확인해 주세요. 확인 과정에서는 저장을 다시 요청하지 않습니다.'));
  } else if (deleting) {
    card.append(make(document, 'p', 'Notion 원본에서 삭제 대상(' + targetName +
      ')의 휴지통 이동 여부를 직접 확인해 주세요. 확인 과정에서는 삭제를 다시 요청하지 않습니다.'));
  } else if (editing) {
    card.append(make(document, 'p', '레시피와 모든 단계가 수정 전 상태 또는 수정 후 상태와 정확히 일치하는지 확인해 주세요. 일부만 반영되었거나 다른 내용이면 이 화면을 닫지 말고 Notion에서 레시피와 단계를 한쪽 상태로 맞춰 주세요. 저장을 다시 요청하지 마세요.'));
  } else if (hasKnownPages) {
    card.append(make(document, 'p', '확인된 항목 ' + operation.knownPageCount +
      '개. 원본에서 이 항목의 상태를 확인해 저장됨 또는 모두 보관 취소됨을 선택해 주세요.'));
  } else {
    card.append(make(document, 'p', 'Notion 원본을 직접 확인하고, 이번 작업의 결과에 맞는 선택을 해 주세요.'));
  }
  addVerificationChecklist(document, card, operation, deleting, favoriting, editing, hasKnownPages);
  addOriginalLinks(document, card, operation);
  if (!hasKnownPages) {
    card.append(make(document, 'p', '저장됨을 선택할 때는 이번 작업으로 새로 만들어진 모든 페이지의 ID를 입력해 주세요. ID는 상태 메시지에 표시하지 않습니다.', 'muted-note'));
  }

  const form = make(document, 'form', undefined, 'form-grid resolution-form');
  const confirmed = label(document, 'Notion 원본에서 이번 작업의 결과를 직접 확인했습니다.', 'originalConfirmed', 'checkbox', true);
  form.append(confirmed);
  const decision = label(document, '확인 결과', 'decision', 'select', true);
  const select = decision.querySelector('select');
  const decisions = editing
    ? [['saved', '레시피와 모든 단계가 수정 후 상태와 일치함'], ['not-saved', '레시피와 모든 단계가 수정 전 상태와 일치함']]
    : favoriting
      ? [['saved', '즐겨찾기가 요청한 상태(' + (operation.favorite ? '추가' : '해제') + ')임을 확인함'],
        ['not-saved', '즐겨찾기가 요청한 상태와 다름을 확인함']]
      : deleting
        ? [['saved', targetName + ': 휴지통에 있음을 확인함'],
          ['not-saved', targetName + ': 삭제되지 않고 남아 있음을 확인함']]
        : [['saved', '이번 작업의 저장을 확인함'], ['cancelled', '이번 작업의 새 항목을 모두 보관 취소함']];
  if (!hasKnownPages) decisions.splice(1, 0, ['not-saved', '이번 작업이 저장되지 않았음을 확인함']);
  for (const [value, title] of decisions) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = title;
    select.append(option);
  }
  form.append(decision);
  if (!hasKnownPages) {
    form.append(label(document, '확인한 새 페이지 ID (저장됨이면 쉼표로 구분)', 'pageIds', 'text', false,
      { autocomplete: 'off', autocapitalize: 'off', spellcheck: false }));
  }
  const submit = actionButton(document, '확인 결과 저장', 'submit', 'save');
  let resolving = false;
  form.append(submit);
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (resolving || submit.disabled) return;
    resolving = true;
    submit.disabled = true;
    setActionButton(submit, '저장 중…', 'saving');
    try {
      const resolved = await operation.resolve({
        originalConfirmed: confirmed.querySelector('input').checked,
        decision: select.value,
        pageIds: form.elements.pageIds?.value,
      });
      if (resolved === true) setActionButton(submit, '확인 완료', 'success');
      else {
        resolving = false;
        submit.disabled = false;
        setActionButton(submit, '확인 결과 저장', 'idle');
      }
    } catch {
      resolving = false;
      submit.disabled = false;
      setActionButton(submit, '확인 결과 저장', 'idle');
    }
  });
  card.append(form);
  return card;
}
