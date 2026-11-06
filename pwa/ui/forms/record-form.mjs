import { createStarRating } from '../star-rating.mjs';
import { make } from '../shared/dom.mjs';
import { label, formBase, addFormActions } from '../shared/form-fields.mjs';
import { routePath, routeParams } from '../shared/route.mjs';
import { isIsoDate, localDate } from '../shared/date.mjs';
import { preferredOptionPage, searchPicker, syncSearchPickerTrigger } from '../interactions/search-picker.mjs';

export function buildRecordForm(document, data, optionPages, route, optionStates, connectionRevision) {
  const form = formBase(document, 'records', '추출 후 빠른 기록');
  const fields = make(document, 'fieldset', undefined, 'form-fieldset');
  const params = routeParams(route);
  const sameConnectionData = !connectionRevision || data?.screen?.connectionRevision === connectionRevision;
  const options = sameConnectionData ? data?.options : null;
  const beanPage = preferredOptionPage(options?.beans, sameConnectionData ? optionPages.get('form:beans') : null);
  const recipePage = preferredOptionPage(options?.recipes, sameConnectionData ? optionPages.get('form:recipes') : null);
  const beanPicker = searchPicker(document, '원두', 'beans', 'form', beanPage,
    '원두를 선택해 주세요.', false, sameConnectionData ? optionStates.get('form:beans') : null);
  const recipePicker = searchPicker(document, '레시피', 'recipes', 'form', recipePage,
    '레시피를 선택해 주세요.', false, sameConnectionData ? optionStates.get('form:recipes') : null);
  fields.append(make(document, 'legend', '기록'), beanPicker, recipePicker);
  for (const [picker, name] of [[beanPicker, 'beanId'], [recipePicker, 'recipeId']]) {
    const selectedId = params.get(name);
    const select = picker.querySelector('select');
    if (selectedId && !Array.from(select.options).some(option => option.value === selectedId)) {
      const kind = name === 'beanId' ? 'beans' : 'recipes';
      const selectedItem = sameConnectionData ? data?.[kind]?.find(item => item.id === selectedId) : null;
      if (selectedItem) {
        const option = make(document, 'option', selectedItem.name ?? '선택 항목');
        option.value = selectedId;
        select.append(option);
      }
    }
    if (selectedId && Array.from(select.options).some(option => option.value === selectedId)) select.value = selectedId;
    syncSearchPickerTrigger(picker, data);
  }
  fields.append(label(document, '날짜', 'date', 'date', true));
  fields.append(createStarRating(document));
  fields.append(label(document, '컵노트 (선택)', 'cupNote', 'textarea', false));
  form.append(fields);
  addFormActions(document, form);
  const requestedDate = params.get('date');
  form.elements.date.value = isIsoDate(requestedDate) ? requestedDate : localDate();
  form.dataset.draftRoute = route;
  form.dataset.draftFlow = recordFlowKey(route);
  form.dataset.initialValues = JSON.stringify(Object.fromEntries(
    ['beanId', 'recipeId', 'date', 'rating', 'cupNote'].map(name => [name, form.elements[name].value])));
  return form;
}

export function recordFlowKey(route) {
  const params = routeParams(route);
  if (routePath(route) !== '/records/new') return '';
  return JSON.stringify([params.get('beanId') ?? '', params.get('recipeId') ?? '', params.get('date') || localDate()]);
}
