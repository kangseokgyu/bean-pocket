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
  const tabs = make(document, 'div', undefined, 'records-tabs');
  tabs.setAttribute('aria-label', '기록 보기');
  const management = make(document, 'section', undefined, 'record-management');
  management.dataset.recordsPanel = 'list';
  const analysis = make(document, 'section');
  analysis.dataset.recordsPanel = 'analysis';
  const controls = [];
  const selectPanel = name => {
    management.hidden = name !== 'list';
    analysis.hidden = name !== 'analysis';
    for (const control of controls) control.setAttribute('aria-pressed', String(control.dataset.recordsTab === name));
    setManagementOpen(name === 'analysis');
  };
  for (const [name, title] of [['list', '목록'], ['analysis', '분석']]) {
    const control = button(document, title, 'button', undefined, 'secondary');
    control.dataset.recordsTab = name;
    control.addEventListener('click', () => selectPanel(name));
    controls.push(control);
    tabs.append(control);
  }
  selectPanel(managementOpen ? 'analysis' : 'list');
  pane.append(tabs, management, analysis);
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
  managementBody.append(make(document, 'h3', '전체 기록 목록', 'record-table-heading'));

  const list = make(document, 'div', undefined, 'record-list');
  list.dataset.recordList = '';
  managementBody.append(list);
  const pageMore = make(document, 'div', undefined, 'record-management-page-more');
  pageMore.dataset.recordPageMore = '';
  managementBody.append(pageMore);
  management.append(managementBody);
  renderRecordsInsights(analysis, data, document, insightRecipeFilter, insightRatingFilter, insightComparisonSort,
    comparisonLeftId, comparisonRightId);
  const records = renderRecordRows(list, data, selectedFilters.beanId ?? '', selectedFilters.recipeId ?? '');
  const overview = make(document, 'section', undefined, 'record-overview');
  overview.append(renderRecordTable(document, records, data, list.querySelector('.empty-state')?.textContent ?? ''));
  managementBody.insertBefore(overview, list);
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
    return records;
  }
  for (const record of records) list.append(recordCard(list.ownerDocument, record, data));
  return records;
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
