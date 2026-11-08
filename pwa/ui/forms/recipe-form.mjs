import { button } from '../shared/buttons.mjs';
import { make } from '../shared/dom.mjs';
import { addFormActions, formBase, label } from '../shared/form-fields.mjs';
import {
  createStageEditorRow, createStageEditorSummary, formatTime, updateStageEditorSummary,
} from '../shared/recipe-presentation.mjs';
import { parseMicronValue } from '../../domain.mjs';

export function buildRecipeForm(document, data, editRecipe = null) {
  const form = formBase(document, 'recipes', editRecipe ? '레시피 수정' : '새 레시피');
  const title = form.firstElementChild;
  const header = make(document, 'div', undefined, 'recipe-form-header');
  form.replaceChildren(header);
  if (editRecipe) {
    form.dataset.editId = editRecipe.id;
    const back = button(document, '레시피로 돌아가기', 'button', 'navigate', 'back');
    back.dataset.route = `/recipes/${encodeURIComponent(editRecipe.id)}`;
    header.append(back);
  }
  header.append(title);
  const basic = make(document, 'fieldset', undefined, 'form-fieldset form-fieldset--compact');
  basic.append(make(document, 'legend', '기본 조건'));
  const fields = [
    ['레시피 이름', 'name', 'text', true],
    ['드리퍼', 'dripper', 'text', false],
    ['원두 사용량 (g)', 'dose', 'number', true, { step: 'any', min: 0 }, { unit: 'g', values: [10, 15, 20], inline: true }],
    ['분쇄도 (레퍼런스 설정)', 'grind', 'text', false, { placeholder: '예: EK43 9, Comandante 24클릭' }],
    ['분쇄 입자 (μm)', 'microns', 'text', false,
      { inputMode: 'text', placeholder: '예: 900 또는 900~1000' }],
    ['그라인더', 'grinder', 'text', false],
    ['그라인더 설정', 'grinderSetting', 'text', false],
    ['물 온도 (℃)', 'temperature', 'number', true, { step: 'any', min: 0, max: 100 }, { unit: '°C', values: [88, 92, 96], inline: true }],
    ['총 물 양 (g)', 'totalWater', 'number', true, { step: 'any', min: 0 }, { unit: 'g', values: [200, 250, 300] }],
  ];
  for (const [title, name, type, required, attrs, shortcuts] of fields) {
    const field = label(document, title, name, type, required, attrs);
    if (!shortcuts) {
      basic.append(field);
      continue;
    }
    const wrap = make(document, 'div', undefined, shortcuts.inline
      ? 'recipe-number-field recipe-number-field--inline' : 'recipe-number-field');
    const input = field.querySelector('input');
    const group = make(document, 'div', undefined, 'recipe-number-shortcuts');
    group.setAttribute('role', 'group');
    group.setAttribute('aria-label', `${title} 빠른 입력`);
    for (const value of shortcuts.values) {
      const control = button(document, `${value}${shortcuts.unit}`, 'button');
      control.addEventListener('click', () => {
        if (input.disabled) return;
        input.value = String(value);
        input.dispatchEvent(new Event('input', { bubbles: true }));
      });
      group.append(control);
    }
    wrap.append(field, group);
    basic.append(wrap);
  }
  form.append(basic);
  form.append(label(document, '추출 가이드 (선택)', 'extractionGuide', 'textarea', false, {
    rows: 4,
    placeholder: '예: 교반 없음, 목표 2분 30초 완성',
  }));
  const stageEditor = make(document, 'section', undefined, 'recipe-steps recipe-preview stage-editor');
  stageEditor.dataset.stageEditor = 'recipe';
  stageEditor.setAttribute('aria-label', '레시피 추출 단계 입력');
  const steps = make(document, 'div', undefined, 'stage-editor-list');
  steps.dataset.steps = '';
  stageEditor.append(steps, button(document, '단계 추가', 'button', 'add-step', 'utility'),
    createStageEditorSummary(document, { totalClassName: 'preview-total' }));
  form.append(stageEditor);
  addFormActions(document, form, editRecipe
    ? { cancelLabel: '수정 취소', submitLabel: '수정 저장' } : undefined);
  if (editRecipe) {
    for (const key of ['name', 'dripper', 'dose', 'grind', 'grinder', 'grinderSetting', 'extractionGuide', 'microns', 'temperature', 'totalWater']) {
      if (form.elements[key]) form.elements[key].value = editRecipe[key] == null ? '' : String(editRecipe[key]);
    }
  }
  return form;
}

export function addStep(content, document) {
  const form = content.matches?.('form[data-form="recipes"]')
    ? content : content.querySelector('form[data-form="recipes"]');
  if (!form) return;
  const wrap = form.querySelector('[data-steps]');
  const index = wrap.children.length + 1;
  const row = createStageEditorRow(document, { number: index, rowClass: 'step-row', removeAction: 'remove-step' });
  wrap.append(row);
  return row;
}

export function setSteps(form, steps) {
  const panel = form.closest('.data-panel') ?? form;
  const wrap = form.querySelector('[data-steps]');
  wrap.replaceChildren();
  for (const step of steps) {
    addStep(panel, form.ownerDocument);
    const row = wrap.lastElementChild;
    if (step.id) row.dataset.stepId = step.id;
    row.querySelector('[name="stepName"]').value = step.name;
    row.querySelector('[name="time"]').value = formatTime(step.seconds);
    row.querySelector('[name="water"]').value = step.water;
  }
  updatePreview(panel);
}

export function recipePayload(form) {
  const values = Object.fromEntries(new FormData(form));
  for (const key of ['dose', 'temperature', 'totalWater']) values[key] = Number(values[key]);
  values.microns = parseMicronValue(values.microns);
  values.steps = [...form.querySelectorAll('.step-row')].map(row => ({
    ...(row.dataset.stepId ? { id: row.dataset.stepId } : {}),
    name: row.querySelector('[name="stepName"]').value,
    time: row.querySelector('[name="time"]').value,
    water: Number(row.querySelector('[name="water"]').value),
  }));
  return values;
}

export function updatePreview(content) {
  const form = content.matches?.('form[data-form="recipes"]')
    ? content : content.querySelector('form[data-form="recipes"]');
  if (!form) return;
  const editor = form.querySelector('[data-stage-editor="recipe"]');
  updateStageEditorSummary(editor, form.elements.totalWater.value);
}

export function renumberSteps(content) {
  [...content.querySelectorAll('.step-row')].forEach((row, index) => {
    row.querySelector('legend').textContent = `단계 ${index + 1}`;
    row.querySelector('[name="time"]').placeholder = index === 0 ? '0:00' : '0:30';
    row.querySelector('[data-action="remove-step"]').setAttribute('aria-label', `단계 ${index + 1} 제거`);
  });
}
