import { layoutRatingTrend } from './records-insights.mjs';

const SVG_NS = 'http://www.w3.org/2000/svg';
const svgElement = (document, name) => document.createElementNS(SVG_NS, name);
const make = (document, tag, text, className) => {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = String(text);
  if (className) node.className = className;
  return node;
};
const button = (document, text, type = 'submit', action) => {
  const node = make(document, 'button', text, 'button');
  node.type = type;
  if (action) node.dataset.action = action;
  return node;
};
const formatTime = seconds => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

export function renderRecordsInsights(pane, data, document, ratingFilter, comparisonSort) {
  const state = data.recordInsights;
  if (!state) return;
  const section = make(document, 'section', undefined, 'record-insights');
  section.setAttribute('aria-labelledby', 'record-insights-title');
  section.append(make(document, 'h3', '원두별 평가 인사이트', undefined));
  section.lastElementChild.id = 'record-insights-title';

  const scope = state.status === 'ready'
    ? `불러온 기록 ${state.loadedCount}건 기준 · 아래 필터는 기록 표에만 적용됩니다.`
    : state.status === 'error' && !state.loadedCount ? state.error || '원두 인사이트 기록을 불러오지 못했습니다.'
      : '원두 인사이트 기록을 불러오는 중입니다.';
  const scopeNote = make(document, 'p', scope, 'record-insight-scope');
  scopeNote.dataset.insightScope = '';
  scopeNote.setAttribute('role', state.status === 'error' ? 'status' : 'note');
  section.append(scopeNote);

  if (state.status === 'loading' && !state.loadedCount) {
    section.append(make(document, 'p', '원두 인사이트를 불러오는 중입니다.', 'record-insight-loading'));
    pane.append(section);
    return;
  }
  if (state.status === 'error' && !state.loadedCount) {
    const retry = button(document, '다시 시도', 'button', 'load-more-insights');
    retry.disabled = !!state.loading;
    section.append(retry);
    pane.append(section);
    return;
  }
  if (state.error) section.append(make(document, 'p', state.error, 'record-warning'));
  if (!state.beans?.length) {
    section.append(make(document, state.loadedCount ? 'p' : 'p', '현재 인사이트에 사용할 기록이 없습니다.', 'empty-state'));
    renderInsightsMoreButton(section, document, state);
    pane.append(section);
    return;
  }

  const beanField = make(document, 'label', undefined, 'record-insight-bean-field');
  beanField.append(make(document, 'span', '인사이트 원두'));
  const beanSelect = document.createElement('select');
  beanSelect.setAttribute('aria-label', '인사이트 원두 선택');
  beanSelect.dataset.insightBean = '';
  for (const bean of state.beans) {
    const option = document.createElement('option');
    option.value = bean.id;
    option.textContent = `${bean.name} · 최근 ${bean.latestDate}`;
    option.selected = bean.id === state.selectedBeanId;
    beanSelect.append(option);
  }
  beanField.append(beanSelect);
  section.append(beanField);

  const trendHeading = make(document, 'h4', '날짜별 별점 추이');
  section.append(trendHeading);
  section.append(make(document, 'p', `${state.selectedBean?.name ?? '선택한 원두'} · 유효한 별점 ${state.ratedRecordCount}건`,
    'record-insight-trend-summary'));
  if (state.trend?.length) section.append(renderRatingTrend(document, state.trend));
  else section.append(make(document, 'p', '유효한 별점 기록이 없습니다.', 'record-insight-chart-empty'));

  const best = make(document, 'section', undefined, 'record-insight-best');
  best.setAttribute('aria-labelledby', 'record-insight-best-title');
  best.append(make(document, 'h4', '최고 평가 기록'));
  best.lastElementChild.id = 'record-insight-best-title';
  if (state.bestRecord) best.append(renderInsightRecord(document, state.bestRecord, data, true));
  else best.append(make(document, 'p', '최고 평가 기록이 없습니다.', 'empty-state'));
  section.append(best);

  const comparisons = make(document, 'section', undefined, 'record-insight-comparisons');
  comparisons.setAttribute('aria-labelledby', 'record-insight-comparisons-title');
  comparisons.append(make(document, 'h4', '비교 기록'));
  comparisons.lastElementChild.id = 'record-insight-comparisons-title';
  const controls = make(document, 'div', undefined, 'record-insight-controls');
  const ratingSelect = makeInsightSelect(document, '별점 필터', 'data-insight-rating-filter', ratingFilter,
    [['', '모든 별점'], ['5', '5점'], ['4', '4점'], ['3', '3점'], ['2', '2점'], ['1', '1점']]);
  const sortSelect = makeInsightSelect(document, '정렬', 'data-insight-comparison-sort', comparisonSort,
    [['date-desc', '최신 날짜순'], ['rating-desc', '별점 높은 순']]);
  controls.append(ratingSelect, sortSelect);
  comparisons.append(controls);
  let comparisonRecords = [...(state.comparisonRecords ?? [])];
  if (ratingFilter) comparisonRecords = comparisonRecords.filter(record => String(record.rating) === ratingFilter);
  comparisonRecords.sort(comparisonSort === 'rating-desc'
    ? (left, right) => right.rating - left.rating || String(right.date).localeCompare(String(left.date)) || String(left.id).localeCompare(String(right.id))
    : (left, right) => String(right.date).localeCompare(String(left.date)) || String(left.id).localeCompare(String(right.id)));
  if (comparisonRecords.length) {
    const list = make(document, 'div', undefined, 'record-insight-comparison-list');
    for (const record of comparisonRecords) list.append(renderInsightRecord(document, record, data, false));
    comparisons.append(list);
  } else comparisons.append(make(document, 'p', '조건에 맞는 비교 기록이 없습니다.', 'empty-state'));
  section.append(comparisons);
  renderInsightsMoreButton(section, document, state);
  pane.append(section);
}

function makeInsightSelect(document, title, dataAttribute, value, options) {
  const field = make(document, 'label', undefined, 'record-insight-control');
  field.append(make(document, 'span', title));
  const select = document.createElement('select');
  select.setAttribute('aria-label', title);
  const dataKey = dataAttribute.slice(5).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
  select.dataset[dataKey] = '';
  for (const [optionValue, text] of options) {
    const option = document.createElement('option');
    option.value = optionValue;
    option.textContent = text;
    option.selected = optionValue === value;
    select.append(option);
  }
  field.append(select);
  return field;
}

function renderInsightsMoreButton(parent, document, state) {
  if (!state.hasMore && !state.error) return;
  const more = button(document, state.loading ? '불러오는 중…' : state.error ? '다시 시도' : '인사이트 더 불러오기',
    'button', 'load-more-insights');
  more.className = 'button record-insights-more';
  more.disabled = !!state.loading;
  parent.append(more);
}

function renderRatingTrend(document, points) {
  const layout = layoutRatingTrend(points, { width: 360, height: 230 });
  const figure = make(document, 'figure', undefined, 'record-insight-chart');
  const svg = svgElement(document, 'svg');
  svg.setAttribute('viewBox', `0 0 ${layout.width} ${layout.height}`);
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-labelledby', 'record-rating-chart-title');
  svg.setAttribute('aria-describedby', 'record-rating-chart-description');
  svg.setAttribute('class', 'rating-trend-chart');
  const title = svgElement(document, 'title');
  title.id = 'record-rating-chart-title';
  title.textContent = '선택한 원두의 날짜별 별점 추이';
  const description = svgElement(document, 'desc');
  description.id = 'record-rating-chart-description';
  description.textContent = `별점 축은 1점부터 5점까지 고정이며 날짜 간격은 실제 달력 날짜 간격입니다. 아래 텍스트 목록에 ${points.length}개 날짜와 별점이 있습니다.`;
  svg.append(title, description);

  for (const rating of layout.yTicks) {
    const y = layout.plotBottom - (rating - 1) / 4 * layout.plotHeight;
    const line = svgElement(document, 'line');
    line.setAttribute('x1', String(layout.plotLeft));
    line.setAttribute('x2', String(layout.plotRight));
    line.setAttribute('y1', String(y));
    line.setAttribute('y2', String(y));
    line.setAttribute('class', 'rating-chart-grid');
    svg.append(line);
    const label = svgElement(document, 'text');
    label.setAttribute('x', String(layout.plotLeft - 12));
    label.setAttribute('y', String(y + 4));
    label.setAttribute('text-anchor', 'end');
    label.setAttribute('class', 'rating-chart-axis-label');
    label.textContent = String(rating);
    svg.append(label);
  }

  if (layout.points.length > 1) {
    const path = svgElement(document, 'path');
    path.setAttribute('d', layout.points.map((point, index) => `${index ? 'L' : 'M'}${point.x},${point.y}`).join(' '));
    path.setAttribute('class', 'rating-chart-line');
    svg.append(path);
  }
  const overlapCounts = new Map();
  for (const point of layout.points) {
    const key = `${point.date}|${point.rating}`;
    overlapCounts.set(key, (overlapCounts.get(key) ?? 0) + 1);
  }
  for (const point of layout.points) {
    const circle = svgElement(document, 'circle');
    circle.setAttribute('cx', String(point.x));
    circle.setAttribute('cy', String(point.y));
    circle.setAttribute('r', '4');
    circle.setAttribute('class', 'rating-chart-point');
    circle.setAttribute('data-trend-point', '');
    circle.setAttribute('data-date', point.date);
    const overlap = overlapCounts.get(`${point.date}|${point.rating}`);
    const pointTitle = svgElement(document, 'title');
    pointTitle.textContent = `${point.date} · ${point.rating}/5${overlap > 1 ? ` · 같은 날짜와 별점 ${overlap}건` : ''}`;
    circle.append(pointTitle);
    svg.append(circle);
  }

  const uniqueDates = [...new Set(layout.points.map(point => point.date))];
  const visibleTickCount = Math.min(uniqueDates.length, 5);
  const tickIndices = new Set(Array.from({ length: visibleTickCount }, (_, index) =>
    visibleTickCount === 1 ? 0 : Math.round(index * (uniqueDates.length - 1) / (visibleTickCount - 1))));
  for (const index of tickIndices) {
    const date = uniqueDates[index];
    const point = layout.points.find(item => item.date === date);
    const label = svgElement(document, 'text');
    label.setAttribute('x', String(point.x));
    label.setAttribute('y', String(layout.height - 8));
    label.setAttribute('text-anchor', index === 0 ? 'start' : index === uniqueDates.length - 1 ? 'end' : 'middle');
    label.setAttribute('class', 'rating-chart-axis-label');
    label.textContent = date.slice(5).replace('-', '/');
    const tickTitle = svgElement(document, 'title');
    tickTitle.textContent = date;
    label.append(tickTitle);
    svg.append(label);
  }
  figure.append(svg);
  const accessibleValues = make(document, 'ol', undefined, 'visually-hidden');
  accessibleValues.id = 'record-rating-chart-values';
  appendChartValues(accessibleValues, layout.points);
  svg.setAttribute('aria-describedby', 'record-rating-chart-description record-rating-chart-values');
  figure.append(svg, accessibleValues);
  const details = document.createElement('details');
  details.className = 'record-insight-chart-values';
  const dataList = make(document, 'ol', undefined, 'record-insight-chart-data');
  appendChartValues(dataList, layout.points);
  details.append(make(document, 'summary', '날짜와 별점 기록 모두 보기'), dataList);
  figure.append(details);
  return figure;
}

function appendChartValues(list, points) {
  for (const point of points) list.append(make(list.ownerDocument, 'li', `${point.date} · 별점 ${point.rating}/5`));
}

function renderInsightRecord(document, record, data, best) {
  const article = make(document, 'article', undefined, best ? 'record-insight-best-record' : 'record-insight-comparison');
  article.dataset.insightRecordId = record.id;
  const snapshot = record.snapshotStatus === 'valid' ? record.snapshot : null;
  const recipe = snapshot?.version === 2 ? snapshot.recipe : snapshot?.version === 1 ? snapshot : null;
  const liveRecipe = data.recipes?.find(item => item.id === record.recipeId);
  const recipeName = recipe?.name || liveRecipe?.name || '기록 당시 레시피 이름을 확인할 수 없습니다.';
  article.append(make(document, 'h5', `${record.date} · ${record.rating}/5 ★`));
  article.append(make(document, 'p', `레시피: ${recipeName}`));
  article.append(make(document, 'p', record.cupNote ? `컵노트: ${record.cupNote}` : '컵노트 없음'));
  if (best) article.append(renderRecipeConditions(document, recipe));
  else {
    const details = document.createElement('details');
    details.className = 'record-insight-condition-details';
    details.append(make(document, 'summary', '기록 당시 레시피 조건 보기'), renderRecipeConditions(document, recipe));
    article.append(details);
  }
  return article;
}

function renderRecipeConditions(document, recipe) {
  const conditions = make(document, 'dl', undefined, 'record-insight-recipe-conditions');
  if (!recipe) {
    conditions.append(make(document, 'dt', '기록 당시 조건'), make(document, 'dd', '스냅샷에서 확인할 수 없습니다.'));
    return conditions;
  }
  const values = [
    ['드리퍼', recipe.dripper], ['원두 양', Number.isFinite(recipe.dose) ? `${recipe.dose}g` : ''],
    ['물 양', Number.isFinite(recipe.totalWater) ? `${recipe.totalWater}g` : ''],
    ['물 온도', Number.isFinite(recipe.temperature) ? `${recipe.temperature}℃` : ''],
    ['분쇄도', recipe.grind], ['그라인더', recipe.grinder], ['그라인더 설정', recipe.grinderSetting],
    ['분쇄 입자', Number.isFinite(recipe.microns) ? `${recipe.microns}μm` : ''],
  ].filter(([, value]) => value !== undefined && value !== null && value !== '');
  for (const [name, value] of values) {
    conditions.append(make(document, 'dt', name), make(document, 'dd', value));
  }
  if (Array.isArray(recipe.steps) && recipe.steps.length) {
    const heading = make(document, 'dt', '단계별 누적 시간과 물');
    const list = make(document, 'dd');
    const steps = make(document, 'ol', undefined, 'record-insight-steps');
    for (const step of recipe.steps) {
      const time = Number.isFinite(step.seconds) ? formatTime(step.seconds) : '시간 확인 필요';
      const water = Number.isFinite(step.water) ? `${step.water}g` : '물 양 확인 필요';
      steps.append(make(document, 'li', `${step.name || '단계'} · 누적 ${time} · 이번 물 ${water}`));
    }
    list.append(steps);
    conditions.append(heading, list);
  }
  return conditions;
}
