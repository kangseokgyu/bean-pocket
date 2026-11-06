import { make } from './dom.mjs';

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
