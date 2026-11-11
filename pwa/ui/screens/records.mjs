import { isValidRating } from '../../domain.mjs';
import { renderRecordsInsights } from '../records-insights-view.mjs';
import { make } from '../shared/dom.mjs';
import { button } from '../shared/buttons.mjs';
import { makeEntryDialog } from '../shared/dialogs.mjs';
import { currentRecords, recordCard, recordPresentation } from '../shared/record-card.mjs';
import { preferredOptionPage, searchPicker, syncSearchPickerTrigger } from '../interactions/search-picker.mjs';

export function renderRecords(pane, data, document, form, formOpen, optionPages, optionStates,
  insightRecipeFilter = '', insightRatingFilter = '', insightComparisonSort = 'date-desc',
  comparisonLeftId = '', comparisonRightId = '', managementOpen = false,
  setManagementOpen = () => {}) {
  form.id = 'new-record-form';
  pane.append(makeEntryDialog(document, 'records', form, formOpen));
  const management = make(document, 'details', undefined, 'record-management');
  management.open = managementOpen;
  management.addEventListener('toggle', () => setManagementOpen(management.open));
  const managementHeading = make(document, 'summary', undefined, 'record-management-summary');
  managementHeading.append(make(document, 'strong', '상세 분석 및 기록 관리'));
  managementHeading.append(make(document, 'span', `${data.records?.length ?? 0}건 표시`));
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
  managementBody.append(make(document, 'p', '원두·레시피 필터는 추출 기록 표와 관리 목록에 적용됩니다.',
    'record-insights-table-note'));
  managementBody.append(make(document, 'h3', '전체 기록 목록', 'record-table-heading'));

  const list = make(document, 'div', undefined, 'record-list');
  list.dataset.recordList = '';
  managementBody.append(list);
  const visibleRecords = currentRecords(data);
  const records = visibleRecords
    .filter(record => (!selectedFilters.beanId || record.beanId === selectedFilters.beanId) &&
      (!selectedFilters.recipeId || record.recipeId === selectedFilters.recipeId))
    .sort((a, b) => String(b.date ?? '').localeCompare(String(a.date ?? '')));
  const pending = data.screen?.hasMore || data.screen?.complete === false;
  const emptyMessage = pending ? '기록을 더 확인 중입니다.'
    : (visibleRecords.length || selectedFilters.beanId || selectedFilters.recipeId)
      ? '선택한 조건에 맞는 기록이 없습니다.' : '새 버전에서 작성한 추출 기록이 없습니다.';
  if (!records.length) list.append(make(document, 'p', emptyMessage, 'empty-state'));
  for (const record of records) list.append(recordCard(document, record, data));

  const overview = make(document, 'section', undefined, 'record-overview');
  overview.append(renderRecordTable(document, records, data, emptyMessage));
  const pageMore = make(document, 'div');
  pageMore.dataset.recordPageMore = '';
  overview.append(pageMore);
  renderRecordsInsights(pane, data, document, insightRecipeFilter, insightRatingFilter, insightComparisonSort,
    comparisonLeftId, comparisonRightId, overview, management);
  management.append(managementBody);
}

function renderRecordTable(document, records, data, emptyMessage) {
  const frame = make(document, 'div', undefined, 'table-scroll');
  const table = make(document, 'table', undefined, 'record-overview-table');
  const head = make(document, 'thead');
  const headings = make(document, 'tr');
  for (const label of ['날짜', '원두', '레시피', '별점']) {
    const cell = make(document, 'th', label);
    cell.setAttribute('scope', 'col');
    headings.append(cell);
  }
  head.append(headings);
  const body = make(document, 'tbody');
  for (const record of records) {
    const { beanName, recipeName } = recordPresentation(record, data);
    const row = make(document, 'tr');
    const values = [record.invalidFields?.includes('date') ? '—' : record.date || '—', beanName, recipeName,
      isValidRating(record.rating) ? `${record.rating}/5` : '—'];
    row.append(...values.map(value => make(document, 'td', value)));
    body.append(row);
  }
  if (!records.length) {
    const row = make(document, 'tr');
    const cell = make(document, 'td', emptyMessage, 'empty-state');
    cell.setAttribute('colspan', '4');
    row.append(cell);
    body.append(row);
  }
  table.append(make(document, 'caption', '추출 기록', 'visually-hidden'), head, body);
  frame.append(table);
  return frame;
}
