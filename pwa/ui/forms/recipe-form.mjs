import { button } from '../shared/buttons.mjs';
import { make } from '../shared/dom.mjs';
import { addFormActions, formBase, label } from '../shared/form-fields.mjs';
import { formatTime, parseInputTime } from '../shared/recipe-presentation.mjs';
import { parseMicronValue } from '../../domain.mjs';

export function buildRecipeForm(document, data, editRecipe = null) {
  const form = formBase(document, 'recipes', editRecipe ? '레시피 수정' : '새 레시피');
  if (editRecipe) form.dataset.editId = editRecipe.id;
  const basic = make(document, 'fieldset', undefined, 'form-fieldset form-fieldset--compact');
  basic.append(make(document, 'legend', '기본 조건'));
  const fields = [
    ['레시피 이름', 'name', 'text', true],
    ['드리퍼', 'dripper', 'text', false],
    ['원두 사용량 (g)', 'dose', 'number', true, { step: 'any', min: 0 }, { unit: 'g', values: [15, 18, 20] }],
    ['분쇄도 (레퍼런스 설정)', 'grind', 'text', false, { placeholder: '예: EK43 9, Comandante 24클릭' }],
    ['그라인더', 'grinder', 'text', false],
    ['그라인더 설정', 'grinderSetting', 'text', false],
    ['분쇄 입자 (μm 또는 범위, 선택)', 'microns', 'text', false,
      { inputMode: 'text', placeholder: '예: 900 또는 900~1000' }],
    ['물 온도 (℃)', 'temperature', 'number', true, { step: 'any', min: 0, max: 100 }, { unit: '°C', values: [88, 90, 92, 94] }],
    ['총 물 양 (g)', 'totalWater', 'number', true, { step: 'any', min: 0 }, { unit: 'g', values: [200, 250, 300] }],
  ];
  for (const [title, name, type, required, attrs, shortcuts] of fields) {
    const field = label(document, title, name, type, required, attrs);
    if (!shortcuts) {
      basic.append(field);
      continue;
    }
    const wrap = make(document, 'div', undefined, 'recipe-number-field');
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
  const steps = make(document, 'div', undefined, 'recipe-steps');
  steps.dataset.steps = '';
  form.append(steps);
  form.append(button(document, '단계 추가', 'button', 'add-step', 'utility'));
  const preview = make(document, 'div', undefined, 'recipe-preview');
  preview.setAttribute('aria-live', 'polite');
  preview.setAttribute('aria-label', '단계 입력 미리보기');
  form.append(preview);
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
  const row = make(document, 'fieldset', undefined, 'step-row');
  row.append(make(document, 'legend', `단계 ${index}`));
  row.append(label(document, '단계 이름 (선택)', 'stepName', 'text', false));
  row.append(label(document, '누적 시간 (분:초)', 'time', 'text', true,
    { placeholder: index === 1 ? '0:00' : '0:30', inputMode: 'text', pattern: '\\d+:[0-5]\\d' }));
  row.append(label(document, '이번 물 양 (g)', 'water', 'number', true, { min: 0, step: 'any' }));
  row.append(button(document, '단계 제거', 'button', 'remove-step', 'utility'));
  wrap.append(row);
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
  const preview = form.querySelector('.recipe-preview');
  const rows = [...form.querySelectorAll('.step-row')];
  if (!rows.length) {
    preview.textContent = '단계를 추가해 주세요.';
    return;
  }
  const table = make(content.ownerDocument, 'table', undefined, 'steps-preview-table');
  const head = make(content.ownerDocument, 'thead');
  const heading = make(content.ownerDocument, 'tr');
  for (const title of ['누적 시간', '간격', '이번 물 양', '누적 물 양']) heading.append(make(content.ownerDocument, 'th', title));
  head.append(heading);
  table.append(head);
  const body = make(content.ownerDocument, 'tbody');
  let previous = null;
  let cumulative = 0;
  for (const [index, row] of rows.entries()) {
    const seconds = parseInputTime(row.querySelector('[name="time"]').value);
    const waterText = row.querySelector('[name="water"]').value;
    const water = Number(waterText);
    if (Number.isFinite(water) && water > 0) cumulative += water;
    const tr = make(content.ownerDocument, 'tr');
    const values = [
      seconds === null ? '시간 확인' : formatTime(seconds),
      seconds === null ? '—' : `${index === 0 ? 0 : seconds - (previous ?? seconds)}초`,
      waterText ? `${waterText}g` : '—',
      `${Number(cumulative.toFixed(6))}g`,
    ];
    for (const value of values) tr.append(make(content.ownerDocument, 'td', value));
    body.append(tr);
    if (seconds !== null) previous = seconds;
  }
  table.append(body);
  preview.replaceChildren(table);
  preview.append(make(content.ownerDocument, 'p', `단계 물 합계 ${Number(cumulative.toFixed(6))}g`, 'preview-total'));
}

export function renumberSteps(content) {
  [...content.querySelectorAll('.step-row')].forEach((row, index) => {
    row.querySelector('legend').textContent = `단계 ${index + 1}`;
    row.querySelector('[name="time"]').placeholder = index === 0 ? '0:00' : '0:30';
  });
}
