import { addFieldset, addFormActions, formBase } from '../shared/form-fields.mjs';

export function buildBeanForm(document) {
  const form = formBase(document, 'beans', '새 원두');
  addFieldset(document, form, '원두 정보', [
    ['원두 이름', 'name', 'text', true, { autocomplete: 'off' }],
    ['로스터리', 'roaster', 'text', false],
    ['원산지·농장', 'origin', 'text', false],
    ['품종', 'variety', 'text', false],
    ['가공 방식', 'process', 'text', false],
    ['향미 노트', 'tastingNotes', 'textarea', false],
  ], 'form-fieldset--compact');
  addFormActions(document, form);
  return form;
}
