import { button } from '../shared/buttons.mjs';
import { make } from '../shared/dom.mjs';
import { addFieldset, addFormActions, formBase, label } from '../shared/form-fields.mjs';
import { formatTime, parseInputTime } from '../shared/recipe-presentation.mjs';

export function buildRecipeForm(document, data) {
  const form = formBase(document, 'recipes', '새 레시피');
  addFieldset(document, form, '기본 조건', [
    ['레시피 이름', 'name', 'text', true],
    ['드리퍼', 'dripper', 'text', false],
    ['원두 사용량 (g)', 'dose', 'number', true, { step: 'any', min: 0 }],
    ['분쇄도', 'grind', 'text', false],
    ['그라인더', 'grinder', 'text', false],
    ['그라인더 설정', 'grinderSetting', 'text', false],
    ['분쇄 입자 (μm, 선택)', 'microns', 'number', false, { step: 'any', min: 0 }],
    ['물 온도 (℃)', 'temperature', 'number', true, { step: 'any', min: 0, max: 100 }],
    ['총 물 양 (g)', 'totalWater', 'number', true, { step: 'any', min: 0 }],
  ]);
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
  addFormActions(document, form);
  return form;
}

export function addStep(content, document) {
  const form = content.querySelector('form[data-form="recipes"]');
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
  const panel = form.closest('.data-panel');
  const wrap = form.querySelector('[data-steps]');
  wrap.replaceChildren();
  for (const step of steps) {
    addStep(panel, form.ownerDocument);
    const row = wrap.lastElementChild;
    row.querySelector('[name="stepName"]').value = step.name;
    row.querySelector('[name="time"]').value = formatTime(step.seconds);
    row.querySelector('[name="water"]').value = step.water;
  }
  updatePreview(panel);
}

export function recipePayload(form) {
  const values = Object.fromEntries(new FormData(form));
  for (const key of ['dose', 'temperature', 'totalWater']) values[key] = Number(values[key]);
  values.microns = values.microns === '' ? '' : Number(values.microns);
  values.steps = [...form.querySelectorAll('.step-row')].map(row => ({
    name: row.querySelector('[name="stepName"]').value,
    time: row.querySelector('[name="time"]').value,
    water: Number(row.querySelector('[name="water"]').value),
  }));
  return values;
}

export function updatePreview(content) {
  const form = content.querySelector('form[data-form="recipes"]');
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
