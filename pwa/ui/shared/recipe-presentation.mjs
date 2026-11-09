import { make } from './dom.mjs';
import { button } from './buttons.mjs';
import { label } from './form-fields.mjs';

export function recipeOverview(document, recipe) {
  const overview = make(document, 'section', undefined, 'recipe-overview');
  overview.setAttribute('aria-label', '주요 추출 조건');
  const dripper = make(document, 'p', undefined, 'recipe-dripper');
  dripper.append(make(document, 'span', '드리퍼'),
    make(document, 'strong', hasRecipeValue(recipe.dripper) ? recipe.dripper : '미기록'));
  overview.append(dripper);

  const metrics = make(document, 'dl', undefined, 'recipe-primary-metrics');
  metrics.append(recipeMetric(document, 'dose', '원두량', recipe.dose, 'g'));
  metrics.append(recipeMetric(document, 'water', '물 양', recipe.totalWater, 'g'));
  metrics.append(recipeMetric(document, 'temperature', '물 온도', recipe.temperature, '℃'));
  const ratio = recipeRatio(recipe.dose, recipe.totalWater);
  if (ratio !== null) metrics.append(recipeMetric(document, 'ratio', '추출 비율', `1 : ${ratio}`, ''));
  overview.append(metrics);
  return overview;
}

function recipeMetric(document, key, label, value, unit) {
  const metric = make(document, 'div', undefined, 'recipe-metric');
  metric.dataset.metric = key;
  const display = make(document, 'dd');
  if (hasRecipeValue(value)) {
    display.append(make(document, 'span', String(value)));
    if (unit) display.append(make(document, 'small', unit));
  } else {
    display.append(make(document, 'span', '—'));
  }
  metric.append(make(document, 'dt', label), display);
  return metric;
}

function recipeRatio(dose, water) {
  const doseValue = positiveRecipeNumber(dose);
  const waterValue = positiveRecipeNumber(water);
  if (doseValue === null || waterValue === null) return null;
  const ratio = waterValue / doseValue;
  if (!Number.isFinite(ratio)) return null;
  return Number(ratio.toFixed(1)).toString();
}

function positiveRecipeNumber(value) {
  if (!hasRecipeValue(value) || typeof value === 'boolean') return null;
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

export function hasRecipeValue(value) {
  return value !== undefined && value !== null && !(typeof value === 'string' && value.trim() === '');
}

export function recipeMeasure(value, unit) {
  return hasRecipeValue(value) ? `${value}${unit}` : '—';
}

export function recipeStepCount(recipe) {
  return Array.isArray(recipe.steps) ? `${recipe.steps.length}단계` : '단계 미기록';
}

export function recipeValidationMessage(recipe) {
  if (recipe.validationStatus === 'checking') return { text: '레시피 단계를 확인 중입니다.', className: 'muted-note' };
  if (recipe.validationStatus === 'error') return { text: '레시피 단계 확인에 실패했습니다.', className: 'record-warning' };
  return null;
}

export function recipeSectionHeading(document, title, detail = '') {
  const heading = make(document, 'div', undefined, 'recipe-section-heading');
  heading.append(make(document, 'h4', title));
  if (detail) heading.append(make(document, 'span', detail));
  return heading;
}

export function makeStepTable(document, steps) {
  const wrap = make(document, 'div', undefined, 'table-scroll');
  wrap.setAttribute('role', 'region');
  wrap.setAttribute('aria-label', '레시피 단계 표');
  const table = make(document, 'table', undefined, 'steps-table');
  const head = make(document, 'thead');
  const header = make(document, 'tr');
  for (const [title, detail] of [['단계'], ['누적 시간', '간격'], ['누적 물', '이번 물']]) {
    const cell = make(document, 'th', title);
    if (detail) cell.append(make(document, 'span', ` (${detail})`, 'step-current'));
    cell.setAttribute('scope', 'col');
    header.append(cell);
  }
  head.append(header);
  table.append(head);
  const body = make(document, 'tbody');
  for (const [index, step] of steps.entries()) {
    const row = make(document, 'tr');
    row.append(make(document, 'td', step.name));
    const interval = step.interval ?? (index === 0 ? 0 : step.seconds - steps[index - 1].seconds);
    for (const [total, current] of [[formatTime(step.seconds), `${interval}초`], [`${step.cumulativeWater}g`, `${step.water}g`]]) {
      const cell = make(document, 'td');
      cell.append(make(document, 'span', total, 'step-total'), make(document, 'span', ` (${current})`, 'step-current'));
      row.append(cell);
    }
    body.append(row);
  }
  table.append(body);
  wrap.append(table);
  return wrap;
}

export function recipeReady(recipe) {
  if (recipe.validationStatus !== undefined) return recipe.validationStatus === 'ready';
  return Array.isArray(recipe.steps) && recipe.steps.length > 0;
}

export function parseInputTime(value) {
  const match = /^(\d+):([0-5]\d)$/.exec(value);
  if (!match) return null;
  const seconds = Number(match[1]) * 60 + Number(match[2]);
  return Number.isSafeInteger(seconds) ? seconds : null;
}

export function formatTime(seconds) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

export function createStageEditorRow(document, {
  number, name = '', time = '', water = '', rowClass = '', id = null,
  removeAction, removeDisabled = false,
  nameLabel = '단계 이름 (선택)', timeLabel = '시작 시간 (분:초)',
}) {
  const row = make(document, 'fieldset', undefined, `stage-editor-row ${rowClass}`.trim());
  row.dataset.stageEditorRow = '';
  if (id) row.dataset.stepId = id;
  row.append(make(document, 'legend', `단계 ${number}`, 'visually-hidden'));

  const fields = make(document, 'div', undefined, 'stage-editor-fields');
  const nameField = label(document, nameLabel, 'stepName', 'text', false);
  nameField.className += ' stage-editor-name';
  nameField.querySelector('input').value = name;
  const measurements = make(document, 'div', undefined, 'stage-editor-measurements');
  const timeField = label(document, timeLabel, 'time', 'text', true, {
    placeholder: number === 1 ? '0:00' : '0:30', inputMode: 'text', pattern: '\\d+:[0-5]\\d',
  });
  timeField.querySelector('input').value = time;
  const waterField = label(document, '붓는 양 (g)', 'water', 'number', true, { min: 0, step: 'any' });
  waterField.querySelector('input').value = water;
  measurements.append(timeField, waterField);
  fields.append(nameField, measurements);

  const remove = button(document, '단계 제거', 'button', removeAction, 'utility');
  remove.setAttribute('aria-label', `단계 ${number} 제거`);
  remove.dataset.actionDisabled = String(removeDisabled);
  remove.disabled = removeDisabled;
  row.append(fields, remove);
  return row;
}

export function createStageEditorSummary(document, { totalClassName = 'stage-editor-total', totalDataset = null } = {}) {
  const summary = make(document, 'div', undefined, 'stage-editor-summary');
  const total = make(document, 'p', '', `stage-editor-total ${totalClassName}`);
  if (totalDataset) total.dataset[totalDataset] = '';
  total.setAttribute('aria-live', 'polite');
  const details = make(document, 'details', undefined, 'stage-editor-details');
  details.dataset.stageBreakdown = '';
  details.append(make(document, 'summary', '단계별 간격과 누적 물 보기'));
  const table = make(document, 'table', undefined, 'steps-preview-table');
  table.append(make(document, 'caption', '단계별 시작 시간, 간격, 붓는 양과 누적 물', 'visually-hidden'));
  const head = make(document, 'thead');
  const heading = make(document, 'tr');
  for (const title of ['시작 시간', '간격', '붓는 양', '누적 물']) {
    const cell = make(document, 'th', title);
    cell.setAttribute('scope', 'col');
    heading.append(cell);
  }
  head.append(heading);
  const body = make(document, 'tbody');
  table.append(head, body);
  details.append(table);
  summary.append(total, details);
  return summary;
}

export function updateStageEditorSummary(editor, targetWater) {
  const rows = [...editor.querySelectorAll('[data-stage-editor-row]')];
  const total = editor.querySelector('.stage-editor-total');
  const body = editor.querySelector('.steps-preview-table')?.querySelector('tbody');
  if (!total || !body) return;

  let cumulative = 0;
  let previousSeconds = null;
  for (const [index, row] of rows.entries()) {
    const seconds = parseInputTime(row.querySelector('[name="time"]').value);
    const waterText = row.querySelector('[name="water"]').value;
    const water = Number(waterText);
    if (Number.isFinite(water) && water > 0) cumulative += water;

    let line = body.children[index];
    if (!line) {
      line = make(editor.ownerDocument, 'tr');
      for (let cell = 0; cell < 4; cell += 1) line.append(make(editor.ownerDocument, 'td'));
      body.append(line);
    }
    const interval = seconds === null || (index > 0 &&
      (previousSeconds === null || seconds < previousSeconds))
      ? '—' : `${index === 0 ? 0 : seconds - previousSeconds}초`;
    const values = [
      seconds === null ? '시간 확인' : formatTime(seconds),
      interval,
      waterText ? `${waterText}g` : '—',
      `${formatStageWater(cumulative)}g`,
    ];
    [...line.children].forEach((cell, cellIndex) => { cell.textContent = values[cellIndex]; });
    previousSeconds = seconds;
  }
  while (body.children.length > rows.length) body.lastElementChild.remove();

  const sum = `${formatStageWater(cumulative)}g`;
  if (targetWater === undefined) {
    total.textContent = `총 물 양 ${sum}`;
    return;
  }
  const target = String(targetWater ?? '').trim();
  total.textContent = `단계 물 합 ${sum} / 목표 ${target ? `${formatStageWater(Number(target))}g` : '—'}`;
}

function formatStageWater(value) {
  return Number.isFinite(value) ? String(Number(value.toFixed(6))) : '—';
}
