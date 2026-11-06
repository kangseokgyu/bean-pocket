import { make } from '../shared/dom.mjs';
import { button } from '../shared/buttons.mjs';
import { showNativeDialog } from '../shared/dialogs.mjs';

const idOf = value => String(value ?? '');

export function hydrateRecordPickers(form, freshForm, data, optionPages, optionStates, document) {
  if (!form || !freshForm) return;
  const initial = JSON.parse(form.dataset.initialValues || '{}');
  for (const name of ['beanId', 'recipeId']) {
    const select = form.elements[name];
    const freshSelect = freshForm.elements[name];
    const defaultValue = freshSelect.value;
    const selectedValue = select.value === initial[name] ? defaultValue : select.value;
    if (selectedValue && !Array.from(freshSelect.options).some(option => option.value === selectedValue)) {
      const previous = Array.from(select.options).find(option => option.value === selectedValue);
      const option = make(form.ownerDocument, 'option', previous?.textContent ?? '이전 선택 항목');
      option.value = selectedValue;
      freshSelect.append(option);
    }
    select.replaceChildren(...freshSelect.options);
    select.value = selectedValue;
    Object.assign(select.dataset, freshSelect.dataset);
    const search = select.parentElement.querySelector('[data-option-search-kind]');
    const freshSearch = freshSelect.parentElement.querySelector('[data-option-search-kind]');
    if (search.value === freshSearch.value) Object.assign(search.dataset, freshSearch.dataset);
    select.parentElement.querySelector('[data-option-more]').hidden =
      freshSelect.parentElement.querySelector('[data-option-more]').hidden;
    const picker = select.closest('[data-search-picker]');
    const target = picker.dataset.optionTarget;
    const kind = picker.dataset.optionKind;
    renderSearchPicker(picker, optionPages.get(`${target}:${kind}`), optionStates.get(`${target}:${kind}`), data, document);
    syncSearchPickerTrigger(picker, data);
    initial[name] = defaultValue;
  }
  form.dataset.initialValues = JSON.stringify(initial);
}

function buildSearchPickerResult(document, item, kind, target, selected, data) {
  const row = make(document, 'li', undefined, 'search-picker-result');
  const option = button(document, '', 'button', 'select-search-option');
  option.className = 'button';
  option.dataset.optionId = idOf(item.id);
  option.dataset.optionTarget = target;
  option.dataset.optionKind = kind;
  option.setAttribute('aria-pressed', String(selected));
  const summary = make(document, 'span', undefined, 'search-picker-result-copy');
  summary.append(make(document, 'span', item.name, 'search-picker-result-name'));
  const details = optionDetails(item, kind, data);
  if (details) summary.append(make(document, 'span', details, 'search-picker-result-details'));
  if (item.status === 'error') {
    option.disabled = true;
    option.setAttribute('aria-label', `${item.name}, 선택할 수 없습니다.`);
    summary.append(make(document, 'span', '선택할 수 없는 항목', 'search-picker-result-details'));
  }
  option.append(summary);
  option.append(make(document, 'span', selected ? '선택됨' : '선택', 'search-picker-result-action'));
  row.append(option);
  return row;
}

export function searchPicker(document, title, kind, target, page, placeholder, optional, state) {
  const wrap = make(document, 'div', undefined, 'form-field search-picker');
  wrap.dataset.searchPicker = '';
  wrap.dataset.optionKind = kind;
  wrap.dataset.optionTarget = target;
  const heading = make(document, 'span', title, 'form-field-label');
  heading.id = `${target}-${kind}-picker-label`;
  wrap.append(heading);

  const select = make(document, 'select');
  select.className = 'search-picker-select visually-hidden';
  select.name = kind === 'beans' ? 'beanId' : 'recipeId';
  select.required = false;
  select.setAttribute('aria-hidden', 'true');
  select.setAttribute('tabindex', '-1');
  select.setAttribute('aria-label', title);
  select.dataset.optionSelectKind = kind;
  select.dataset.optionTarget = target;
  fillSelect(select, page?.items ?? [], placeholder, optional);
  const selectedItem = page?.selectedItem;
  if (selectedItem?.id && !Array.from(select.options).some(option => option.value === idOf(selectedItem.id))) {
    const selectedOption = make(document, 'option', selectedItem.name ?? '선택 항목');
    selectedOption.value = idOf(selectedItem.id);
    select.append(selectedOption);
  }
  if (page) {
    select.dataset.optionLoaded = 'true';
    select.dataset.nextCursor = page.nextCursor ?? '';
    select.dataset.optionQuery = page.query ?? '';
  }
  wrap.append(select);

  const emptyLabel = target === 'form' ? `${kind === 'beans' ? '원두' : '레시피'} 선택` : placeholder;
  wrap.dataset.emptyLabel = emptyLabel;
  const trigger = button(document, '', 'button', 'open-search-picker');
  trigger.className = 'button search-picker-trigger';
  trigger.setAttribute('aria-haspopup', 'dialog');
  trigger.setAttribute('aria-expanded', 'false');
  trigger.setAttribute('aria-labelledby', `${heading.id} ${target}-${kind}-picker-value`);
  if (!optional) trigger.setAttribute('aria-required', 'true');
  const value = make(document, 'span', emptyLabel, 'search-picker-value');
  value.id = `${target}-${kind}-picker-value`;
  const summary = make(document, 'span', '', 'search-picker-selection-details');
  const chevron = make(document, 'span', '', 'search-picker-chevron');
  chevron.setAttribute('aria-hidden', 'true');
  trigger.append(value, summary, chevron);
  wrap.append(trigger);

  const dialog = make(document, 'dialog', undefined, 'option-picker-dialog');
  dialog.dataset.optionPicker = '';
  dialog.dataset.optionTarget = target;
  dialog.dataset.optionKind = kind;
  dialog.id = `${target}-${kind}-option-picker`;
  dialog.setAttribute('aria-modal', 'true');
  dialog.setAttribute('aria-labelledby', `${dialog.id}-title`);
  const dialogHeader = make(document, 'div', undefined, 'option-picker-header');
  const optionTitle = kind === 'beans' ? '원두 선택' : '레시피 선택';
  const dialogTitle = make(document, 'h2', optionTitle);
  dialogTitle.id = `${dialog.id}-title`;
  const close = button(document, '닫기', 'button', 'close-search-picker', 'utility');
  close.className = 'button button--utility search-picker-close';
  dialogHeader.append(dialogTitle, close);

  const search = make(document, 'input');
  search.type = 'search';
  search.setAttribute('aria-label', `${optionTitle} 이름 검색`);
  search.setAttribute('autocomplete', 'off');
  search.setAttribute('placeholder', '이름으로 검색');
  search.dataset.optionSearchKind = kind;
  search.dataset.optionTarget = target;
  search.dataset.optionPickerSearch = '';
  const query = state?.query ?? (typeof page?.query === 'string' ? page.query : '');
  search.value = query;
  search.dataset.optionQuery = query;
  search.dataset.optionLoaded = page && (page.query ?? '') === query ? 'true' : 'false';
  const clearSearch = button(document, '검색어 지우기', 'button', 'clear-option-search', 'utility');
  clearSearch.className = 'button button--utility search-picker-clear';
  clearSearch.hidden = !query;

  const results = make(document, 'ul', undefined, 'search-picker-results');
  results.dataset.optionResults = '';
  results.setAttribute('aria-label', `${optionTitle} 검색 결과`);
  const status = make(document, 'p', '', 'search-picker-status');
  status.dataset.optionStatus = '';
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  status.hidden = true;
  const retry = button(document, '다시 시도', 'button', 'retry-search-options');
  retry.dataset.optionTarget = target;
  retry.dataset.optionKind = kind;
  retry.hidden = true;
  const register = button(document, kind === 'beans' ? '원두 등록하기' : '레시피 등록하기', 'button', 'register-search-option', 'primary');
  register.dataset.optionTarget = target;
  register.dataset.optionKind = kind;
  register.hidden = true;
  const more = button(document, '이름 더 보기', 'button', 'more-options', 'pagination');
  more.className = 'button button--pagination search-picker-more';
  more.dataset.optionMore = '';
  more.dataset.optionTarget = target;
  more.dataset.optionKind = kind;
  more.hidden = !page?.hasMore;

  dialog.append(dialogHeader, search, clearSearch, status, retry, results, more, register);
  dialog.addEventListener('cancel', event => {
    event.preventDefault();
    closeSearchPicker(wrap);
  });
  wrap.append(dialog);
  renderSearchPicker(wrap, page, state, null, document);
  syncSearchPickerTrigger(wrap, null);
  return wrap;
}

export function findSearchPicker(root, target, kind) {
  return Array.from(root.querySelectorAll('[data-search-picker]'))
    .find(picker => picker.dataset.optionTarget === target && picker.dataset.optionKind === kind) ?? null;
}

export function closeSearchPicker(picker) {
  const dialog = picker?.querySelector('[data-option-picker]');
  if (dialog?.open) dialog.close();
  const trigger = picker?.querySelector('[data-action="open-search-picker"]');
  trigger?.setAttribute('aria-expanded', 'false');
  trigger?.focus?.();
}

function optionDetails(item, kind, data) {
  if (kind === 'beans') {
    const bean = data?.beans?.find(candidate => candidate.id === item.id);
    return [bean?.origin, bean?.process, bean?.roaster].filter(Boolean).join(' · ');
  }
  const recipe = data?.recipes?.find(candidate => candidate.id === item.id);
  if (recipe) return [recipe.dripper, recipe.dose ? `${recipe.dose}g` : '', recipe.temperature ? `${recipe.temperature}℃` : '']
    .filter(Boolean).join(' · ');
  if (item.beanId) return data?.beans?.find(bean => bean.id === item.beanId)?.name ?? '';
  return '';
}

export function syncSearchPickerTrigger(picker, data) {
  const trigger = picker?.querySelector('[data-action="open-search-picker"]');
  const select = picker?.querySelector('select');
  if (!trigger || !select) return;
  const selected = Array.from(select.options).find(option => option.value === select.value);
  const item = Array.from(picker.querySelector('[data-option-results]')?.children ?? [])
    .map(row => row.querySelector('[data-option-id]'))
    .find(option => option?.dataset.optionId === select.value);
  const current = select.value ? selected?.textContent ?? item?.textContent ?? '선택 항목' : picker.dataset.emptyLabel;
  const value = trigger.querySelector('.search-picker-value');
  const details = trigger.querySelector('.search-picker-selection-details');
  const optionData = data?.[picker.dataset.optionKind]?.find(entry => entry.id === select.value);
  value.textContent = current;
  details.textContent = select.value ? optionDetails(optionData ?? { id: select.value }, picker.dataset.optionKind, data) : '';
  trigger.setAttribute('aria-label', select.value ? `${current}${details.textContent ? `, ${details.textContent}` : ''}` : picker.dataset.emptyLabel);
}

export function renderSearchPicker(picker, page, state, data, document) {
  const target = picker.dataset.optionTarget;
  const kind = picker.dataset.optionKind;
  const dialog = picker.querySelector('[data-option-picker]');
  const search = dialog.querySelector('[data-option-search-kind]');
  const results = dialog.querySelector('[data-option-results]');
  const status = dialog.querySelector('[data-option-status]');
  const retry = dialog.querySelector('[data-action="retry-search-options"]');
  const register = dialog.querySelector('[data-action="register-search-option"]');
  const more = dialog.querySelector('[data-option-more]');
  const select = picker.querySelector('select');
  const requestState = state ?? { status: page ? 'ready' : 'idle', query: page?.query ?? '', append: false };
  const query = requestState.query ?? page?.query ?? '';
  const currentPage = page && (page.query ?? '') === query ? page : null;
  search.value = query;
  dialog.querySelector('[data-action="clear-option-search"]').hidden = !query;
  const loading = requestState.status === 'loading';
  const error = requestState.status === 'error';
  const items = (loading && !requestState.append) || (error && !currentPage) ? [] : currentPage?.items ?? [];
  results.replaceChildren(...items.map(item => buildSearchPickerResult(document, item, kind, target,
    idOf(select.value) === idOf(item.id), data)));
  retry.hidden = !error;
  register.hidden = true;
  more.hidden = !currentPage?.hasMore;
  more.disabled = loading && !!requestState.append;
  more.dataset.nextCursor = currentPage?.nextCursor ?? '';
  more.textContent = loading && requestState.append ? '더 불러오는 중…' : '이름 더 보기';
  status.hidden = false;
  if (loading) status.textContent = requestState.append ? '이름을 더 불러오는 중…' : `${kind === 'beans' ? '원두' : '레시피'} 목록을 불러오는 중…`;
  else if (error) status.textContent = `${kind === 'beans' ? '원두' : '레시피'}를 불러오지 못했습니다. 다시 시도해 주세요.`;
  else if (!items.length && query.trim()) status.textContent = currentPage?.hasMore
    ? '검색 결과가 없습니다. 다음 항목도 확인할 수 있습니다.' : '검색 결과가 없습니다.';
  else if (!items.length && currentPage?.hasMore) status.textContent = '항목을 더 확인할 수 있습니다.';
  else if (!items.length && requestState.status === 'ready' && currentPage?.complete !== false) {
    status.textContent = `등록된 ${kind === 'beans' ? '원두' : '레시피'}가 없습니다.`;
    register.hidden = false;
  } else if (!items.length) status.textContent = '이름을 검색하거나 목록을 불러와 주세요.';
  else status.hidden = true;
}

function fillSelect(select, rows, placeholder, optional = false) {
  select.replaceChildren();
  const first = select.ownerDocument.createElement('option');
  first.value = '';
  first.textContent = placeholder;
  first.disabled = !optional;
  first.selected = true;
  select.append(first);
  for (const row of rows) {
    const option = select.ownerDocument.createElement('option');
    option.value = idOf(row.id);
    option.textContent = row.name;
    option.disabled = row.status === 'error';
    select.append(option);
  }
}

export function openSearchPicker(picker, content) {
  for (const openPicker of content.querySelectorAll('[data-option-picker]')) {
    if (!openPicker.open || openPicker === picker.querySelector('[data-option-picker]')) continue;
    closeSearchPicker(openPicker.closest('[data-search-picker]'));
  }
  const dialog = picker.querySelector('[data-option-picker]');
  const trigger = picker.querySelector('[data-action="open-search-picker"]');
  const search = picker.querySelector('[data-option-search-kind]');
  showNativeDialog(dialog);
  trigger?.setAttribute('aria-expanded', 'true');
  search?.focus?.();
}

export function selectSearchOption(target, data) {
  const picker = target.closest('[data-search-picker]');
  const select = picker?.querySelector('select');
  const optionId = target.dataset.optionId;
  if (!select || !optionId || target.disabled) return;
  if (!Array.from(select.options).some(option => option.value === optionId)) {
    const selectedOption = target.ownerDocument.createElement('option');
    selectedOption.value = optionId;
    selectedOption.textContent = target.querySelector('.search-picker-result-name')?.textContent ?? '선택 항목';
    select.append(selectedOption);
  }
  select.value = optionId;
  syncSearchPickerTrigger(picker, data);
  closeSearchPicker(picker);
  return select;
}

export function updatePickerOptions(root, select, target, kind, page, { previousValue, previousOption, keepPreviousPage, query }) {
  const placeholder = select.options[0]?.textContent ?? (kind === 'beans' ? '원두를 선택해 주세요.' : '레시피를 선택해 주세요.');
  const optional = target === 'filters';
  if (keepPreviousPage) {
    const known = new Set(Array.from(select.options, option => option.value));
    for (const item of page.items ?? []) {
      if (known.has(idOf(item.id))) continue;
      const option = select.ownerDocument.createElement('option');
      option.value = idOf(item.id);
      option.textContent = item.name;
      option.disabled = item.status === 'error';
      select.append(option);
      known.add(option.value);
    }
  } else {
    fillSelect(select, page.items ?? [], placeholder, optional);
    if (previousValue && !Array.from(select.options).some(option => option.value === previousValue) && previousOption) {
      const preserved = select.ownerDocument.createElement('option');
      preserved.value = previousOption.value;
      preserved.textContent = previousOption.textContent;
      select.append(preserved);
    }
  }
  if (previousValue && Array.from(select.options).some(option => option.value === previousValue)) select.value = previousValue;
  select.dataset.optionQuery = query;
  select.dataset.optionLoaded = 'true';
  select.dataset.nextCursor = page.nextCursor ?? '';
  const search = Array.from(root.querySelectorAll('[data-option-search-kind]'))
    .find(item => item.dataset.optionSearchKind === kind && item.dataset.optionTarget === target);
  if (search && search.value !== query) search.value = query;
  if (search) {
    search.dataset.optionLoaded = 'true';
    search.dataset.optionQuery = query;
  }
  const more = Array.from(root.querySelectorAll('[data-option-more]'))
    .find(item => item.dataset.optionTarget === target && item.dataset.optionKind === kind);
  if (more) {
    more.hidden = !page.hasMore;
    more.dataset.nextCursor = page.nextCursor ?? '';
  }
}

export function preferredOptionPage(serverPage, cachedPage) {
  return cachedPage && Date.now() - cachedPage.savedAt < 60000 ? cachedPage : serverPage;
}
