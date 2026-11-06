import { renderRecordsInsights } from '../records-insights-view.mjs';
import { make } from '../shared/dom.mjs';
import { button } from '../shared/buttons.mjs';
import { makeEntryDialog } from '../shared/dialogs.mjs';
import { currentRecords, recordCard } from '../shared/record-card.mjs';
import { preferredOptionPage } from '../forms/record-form.mjs';

export function renderRecords(pane, data, document, form, formOpen, optionPages, optionStates,
  { searchPicker, syncSearchPickerTrigger },
  insightRecipeFilter = '', insightRatingFilter = '', insightComparisonSort = 'date-desc',
  comparisonLeftId = '', comparisonRightId = '', managementOpen = false,
  setManagementOpen = () => {}) {
  form.id = 'new-record-form';
  pane.append(makeEntryDialog(document, 'records', form, formOpen));
  const management = make(document, 'details', undefined, 'record-management');
  management.open = managementOpen;
  management.addEventListener('toggle', () => setManagementOpen(management.open));
  const managementHeading = make(document, 'summary', undefined, 'record-management-summary');
  managementHeading.append(make(document, 'strong', '전체 기록 조회·관리'));
  managementHeading.append(make(document, 'span', `${data.records?.length ?? 0}건 표시 · 검색, 필터와 삭제`));
  management.append(managementHeading);
  const managementBody = make(document, 'div', undefined, 'record-management-body');

  const filters = make(document, 'fieldset', undefined, 'record-filters');
  filters.append(make(document, 'legend', '기록 필터'));
  const beanPicker = searchPicker(document, '원두별 조회', 'beans', 'filters', preferredOptionPage(data.options?.filterBeans, optionPages.get('filters:beans')),
    '모든 원두', true, optionStates.get('filters:beans'));
  const beanSearch = beanPicker.querySelector('[data-option-search-kind]');
  beanSearch.dataset.recordFilterSearch = 'beanId';
  beanPicker.querySelector('select').dataset.recordFilter = 'beanId';
  const recipePicker = searchPicker(document, '레시피별 조회', 'recipes', 'filters', preferredOptionPage(data.options?.filterRecipes, optionPages.get('filters:recipes')),
    '모든 레시피', true, optionStates.get('filters:recipes'));
  const recipeSearch = recipePicker.querySelector('[data-option-search-kind]');
  recipeSearch.dataset.recordFilterSearch = 'recipeId';
  recipePicker.querySelector('select').dataset.recordFilter = 'recipeId';
  const selectedFilters = data.screen?.filters ?? {};
  filters.append(beanPicker, recipePicker);
  const beanSelect = beanPicker.querySelector('select');
  const recipeSelect = recipePicker.querySelector('select');
  if (selectedFilters.beanId) beanSelect.value = selectedFilters.beanId;
  if (selectedFilters.recipeId) recipeSelect.value = selectedFilters.recipeId;
  syncSearchPickerTrigger(beanPicker, data);
  syncSearchPickerTrigger(recipePicker, data);
  const reset = button(document, '필터 초기화', 'button', 'clear-record-filters', 'utility');
  reset.className = 'button button--utility record-filter-reset';
  reset.disabled = !selectedFilters.beanId && !selectedFilters.recipeId;
  filters.append(reset);
  managementBody.append(filters);
  managementBody.append(make(document, 'p', '아래 서버 필터와 페이지는 이 관리 목록에만 적용됩니다. 그래프와 비교 요약은 불러온 인사이트 범위를 사용합니다.',
    'record-insights-table-note'));
  managementBody.append(make(document, 'h3', '전체 기록 목록', 'record-table-heading'));

  const list = make(document, 'div', undefined, 'record-list');
  list.dataset.recordList = '';
  managementBody.append(list);
  const pageMore = make(document, 'div', undefined, 'record-management-page-more');
  pageMore.dataset.recordPageMore = '';
  managementBody.append(pageMore);
  management.append(managementBody);
  renderRecordsInsights(pane, data, document, insightRecipeFilter, insightRatingFilter, insightComparisonSort,
    comparisonLeftId, comparisonRightId, management);
  renderRecordRows(list, data, selectedFilters.beanId ?? '', selectedFilters.recipeId ?? '');
}

function renderRecordRows(list, data, beanId, recipeId) {
  const visibleRecords = currentRecords(data);
  const records = visibleRecords
    .filter(record => (!beanId || record.beanId === beanId) && (!recipeId || record.recipeId === recipeId))
    .sort((a, b) => String(b.date ?? '').localeCompare(String(a.date ?? '')));
  list.replaceChildren();
  if (!records.length) {
    const pending = data.screen?.hasMore || data.screen?.complete === false;
    list.append(make(list.ownerDocument, 'p', pending ? '기록을 더 확인 중입니다. 더 보기를 눌러 계속 확인해 주세요.'
      : visibleRecords.length ? '선택한 조건에 맞는 기록이 없습니다.' : '새 버전에서 작성한 추출 기록이 없습니다.', 'empty-state'));
    return;
  }
  for (const record of records) list.append(recordCard(list.ownerDocument, record, data));
}
