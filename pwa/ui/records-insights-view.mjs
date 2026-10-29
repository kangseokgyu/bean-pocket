import { layoutRatingTrend } from './records-insights.mjs';

const svgElement = (document, name) => document.createElementNS('http://www.w3.org/2000/svg', name);
const trendResizeRenderers = new WeakMap();
let trendResizeObserver;

function observeTrendSize(svg, render) {
  const Observer = globalThis.ResizeObserver;
  if (typeof Observer !== 'function') return;
  if (!trendResizeObserver) {
    trendResizeObserver = new Observer(entries => {
      for (const entry of entries) {
        if (!entry.target.isConnected) {
          trendResizeObserver.unobserve(entry.target);
          trendResizeRenderers.delete(entry.target);
          continue;
        }
        const update = trendResizeRenderers.get(entry.target);
        if (update && entry.contentRect.width > 0) update(entry.contentRect.width);
      }
    });
  }
  trendResizeRenderers.set(svg, render);
  trendResizeObserver.observe(svg);
}

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

export function renderRecordsInsights(pane, data, document, recipeFilter, ratingFilter, comparisonSort, management) {
  const state = data.recordInsights;
  if (!state) {
    if (management) pane.append(management);
    return;
  }
  const layout = make(document, 'div', undefined, 'records-demo-layout');
  const sidebar = make(document, 'aside', undefined, 'record-insight-sidebar');
  sidebar.setAttribute('aria-labelledby', 'record-insight-bean-heading');
  const sidebarHeading = make(document, 'div', undefined, 'record-insight-section-heading');
  sidebarHeading.append(make(document, 'h3', '최근 추출 원두'));
  sidebarHeading.lastElementChild.id = 'record-insight-bean-heading';
  sidebarHeading.append(make(document, 'span', `${state.beans?.length ?? 0}종`, 'record-insight-count-chip'));
  sidebar.append(sidebarHeading, make(document, 'p', '마지막 추출이 최근인 원두부터 표시합니다.', 'record-insight-sidebar-help'));
  if (state.error) sidebar.append(make(document, 'p', state.error, 'record-warning'));
  if (state.status === 'loading' && !state.loadedCount) sidebar.append(make(document, 'p',
    '원두 인사이트를 불러오는 중입니다.', 'record-insight-loading'));
  if (state.status === 'error' && !state.loadedCount) {
    const retry = button(document, '다시 시도', 'button', 'load-more-insights');
    retry.disabled = !!state.loading;
    sidebar.append(retry);
  }
  if (!state.beans?.length && state.status !== 'loading' && state.status !== 'error') {
    sidebar.append(make(document, 'p', '최근 추출 기록이 있는 원두가 없습니다.', 'record-insight-empty'));
  }
  const beanList = make(document, 'ul', undefined, 'record-insight-bean-list');
  for (const bean of state.beans ?? []) {
    const item = make(document, 'li');
    const card = button(document, undefined, 'button', 'select-insight-bean');
    card.className = `button record-insight-bean-card${bean.id === state.selectedBeanId ? ' is-selected' : ''}`;
    card.dataset.beanId = bean.id;
    card.setAttribute('aria-pressed', String(bean.id === state.selectedBeanId));
    const origin = bean.origin || bean.roaster || '원산지 정보 없음';
    card.setAttribute('aria-label', `${bean.name} · ${origin} · 기록 ${bean.recordCount}건 · 최근 ${bean.latestDate} · ${bean.latestRatingLabel} · ${bean.latestRecipeName}`);
    const cardTop = make(document, 'span', undefined, 'record-insight-bean-top');
    cardTop.append(make(document, 'span', bean.name, 'record-insight-bean-name'));
    cardTop.append(make(document, 'span', `기록 ${bean.recordCount}건`, 'record-insight-bean-count'));
    card.append(cardTop, make(document, 'span', origin, 'record-insight-bean-origin'));
    const latest = make(document, 'span', undefined, 'record-insight-bean-latest');
    latest.append(make(document, 'span', `최근 ${bean.latestDate}`), renderRating(document, bean.latestRating));
    card.append(latest, make(document, 'span', `레시피 ${bean.latestRecipeName}`, 'record-insight-bean-recipe'));
    item.append(card);
    beanList.append(item);
  }
  sidebar.append(beanList);
  renderInsightsMoreButton(sidebar, document, state);
  sidebar.append(make(document, 'p', '요약은 현재 불러온 기록 범위 기준입니다.', 'record-insight-sidebar-note'));

  const content = make(document, 'div', undefined, 'record-insights-content');
  const selected = state.selectedBean;
  const summary = make(document, 'section', undefined, 'record-insight-selected-bean');
  summary.setAttribute('aria-labelledby', 'record-insight-selected-name');
  const summaryCopy = make(document, 'div', undefined, 'record-insight-selected-copy');
  summaryCopy.append(make(document, 'p', '선택한 원두', 'record-insight-eyebrow'));
  summaryCopy.append(make(document, 'h3', selected?.name ?? '기록이 있는 원두 없음'));
  summaryCopy.lastElementChild.id = 'record-insight-selected-name';
  if (selected?.origin) summaryCopy.append(make(document, 'p', selected.origin, 'record-insight-origin'));
  const metadata = [selected?.variety, selected?.process].filter(Boolean).join(' · ');
  if (metadata) summaryCopy.append(make(document, 'p', metadata, 'record-insight-metadata'));
  if (selected?.tastingNotes) summaryCopy.append(make(document, 'p', selected.tastingNotes, 'record-insight-tasting-notes'));
  if (selected?.roaster) summaryCopy.append(make(document, 'p', selected.roaster, 'record-insight-roaster'));
  const stats = make(document, 'dl', undefined, 'record-insight-bean-stats');
  appendStatistic(stats, '기록 표본', `${state.selectedRecordCount ?? 0}건`);
  appendStatistic(stats, '평균 평가', state.averageRating === null || state.averageRating === undefined
    ? '평가 없음' : `${state.averageRating.toFixed(1)}점`,
  state.averageRating === null || state.averageRating === undefined ? '' : `유효 별점 ${state.ratedRecordCount}건 기준`);
  summary.append(summaryCopy, stats);
  const scopeNote = make(document, 'p',
    `불러온 기록 ${state.loadedCount}건 중 선택 원두 ${state.selectedRecordCount ?? 0}건 · 평균과 차트는 유효 별점 ${state.ratedRecordCount ?? 0}건 기준입니다.`,
    'record-insight-scope');
  scopeNote.dataset.insightScope = '';
  scopeNote.setAttribute('role', state.status === 'error' ? 'status' : 'note');
  summary.append(scopeNote);
  content.append(summary);

  const trend = make(document, 'section', undefined, 'record-insight-trend-section');
  trend.append(sectionHeader(document, '별점 추이', '선택한 원두의 불러온 추출 기록을 날짜순으로 표시합니다.',
    '전체 기록', 'record-insight-trend-title'));
  trend.append(make(document, 'p', '아래 레시피 필터와 정렬은 비교 표에만 적용됩니다.', 'record-insight-filter-note'));
  if (state.trend?.length) trend.append(renderRatingTrend(document, state.trend));
  else trend.append(make(document, 'p', '이 원두에는 아직 유효한 별점 기록이 없습니다.', 'record-insight-chart-empty'));
  content.append(trend);

  const best = make(document, 'section', undefined, 'record-insight-best-section record-insight-best');
  best.append(sectionHeader(document, '가장 높게 평가한 추출', '선택한 원두의 불러온 유효 별점 기록 안에서 계산합니다.',
    '', 'record-insight-best-title'));
  if (state.bestRecord) best.append(renderBestRecord(document, state.bestRecord));
  else best.append(make(document, 'p', '이 원두에는 아직 최고 평가 기록이 없습니다.', 'record-insight-empty'));

  const comparisons = make(document, 'section', undefined, 'record-insight-comparisons');
  comparisons.append(sectionHeader(document, '추출 기록 비교', '기록 당시 조건과 컵노트를 나란히 비교합니다.',
    `${state.selectedRecordCount ?? 0}건 표본`, 'record-insight-comparisons-title'));
  const controls = make(document, 'div', undefined, 'record-insight-controls');
  const recipeOptions = [['', '모든 레시피'], ...(state.recipeOptions ?? []).map(recipe => [recipe.id, recipe.name])];
  controls.append(makeInsightSelect(document, '레시피', 'data-insight-recipe-filter', recipeFilter, recipeOptions));
  controls.append(makeInsightSelect(document, '정렬', 'data-insight-comparison-sort', comparisonSort,
    [['date-desc', '날짜 최신순'], ['date-asc', '날짜 오래된순'], ['rating-desc', '평가 높은순']]));
  controls.append(makeInsightSelect(document, '별점', 'data-insight-rating-filter', ratingFilter,
    [['', '모든 별점'], ['5', '5점'], ['4', '4점'], ['3', '3점'], ['2', '2점'], ['1', '1점']]));
  comparisons.append(controls);
  let comparisonRecords = [...(state.comparisonRecords ?? [])];
  if (recipeFilter) comparisonRecords = comparisonRecords.filter(record => record.recipeId === recipeFilter ||
    recipeForRecord(record)?.id === recipeFilter);
  if (ratingFilter) comparisonRecords = comparisonRecords.filter(record => String(record.rating) === ratingFilter);
  comparisonRecords.sort(comparisonComparator(comparisonSort));
  const count = make(document, 'p', `${comparisonRecords.length}건`, 'record-insight-comparison-count');
  count.setAttribute('aria-live', 'polite');
  comparisons.append(count);
  if (comparisonRecords.length) comparisons.append(renderComparisonRecords(document, comparisonRecords));
  else comparisons.append(make(document, 'p', '조건에 맞는 비교 기록이 없습니다.', 'record-insight-empty'));
  content.append(best, comparisons);
  if (management) content.append(management);
  layout.append(sidebar, content);
  pane.append(layout);
}

function sectionHeader(document, title, description, tag, headingId) {
  const heading = make(document, 'div', undefined, 'record-insight-section-heading record-insight-section-heading-block');
  const copy = make(document, 'div');
  const titleNode = make(document, 'h3', title);
  titleNode.id = headingId;
  copy.append(titleNode, make(document, 'p', description));
  heading.append(copy);
  if (tag) heading.append(make(document, 'span', tag, 'record-insight-sample-tag'));
  return heading;
}

function appendStatistic(list, name, value, note = '') {
  const item = make(list.ownerDocument, 'div');
  item.append(make(list.ownerDocument, 'dt', name), make(list.ownerDocument, 'dd', value));
  if (note) item.append(make(list.ownerDocument, 'small', note));
  list.append(item);
}

function renderRating(document, rating) {
  const group = make(document, 'span', undefined, 'record-insight-rating');
  const valid = Number.isInteger(rating) && rating >= 1 && rating <= 5;
  if (!valid) {
    group.textContent = rating == null ? '별점 없음' : '별점 확인 필요';
    group.setAttribute('aria-label', group.textContent);
    return group;
  }
  group.setAttribute('role', 'img');
  group.setAttribute('aria-label', `별점 ${rating}/5`);
  group.append(make(document, 'span', `${'★'.repeat(rating)}${'☆'.repeat(5 - rating)}`, 'record-insight-rating-stars'));
  group.append(make(document, 'span', `${rating}/5`, 'record-insight-rating-number'));
  return group;
}

function comparisonComparator(sort) {
  if (sort === 'date-asc') return (left, right) => String(left.date).localeCompare(String(right.date)) || String(left.id).localeCompare(String(right.id));
  if (sort === 'rating-desc') return (left, right) => (Number.isInteger(right.rating) ? right.rating : 0) -
    (Number.isInteger(left.rating) ? left.rating : 0) || String(right.date).localeCompare(String(left.date)) || String(left.id).localeCompare(String(right.id));
  return (left, right) => String(right.date).localeCompare(String(left.date)) || String(left.id).localeCompare(String(right.id));
}

function recipeForRecord(record) {
  const snapshot = record.snapshotStatus === 'valid' ? record.snapshot : null;
  return snapshot?.version === 2 ? snapshot.recipe : snapshot?.version === 1 ? snapshot : null;
}

function renderComparisonRecords(document, records) {
  const region = make(document, 'div', undefined, 'record-insight-comparison-region');
  const tableScroll = make(document, 'div', undefined, 'table-scroll record-insight-comparison-table-region');
  const table = make(document, 'table', undefined, 'record-insight-comparison-table');
  table.append(make(document, 'caption', '선택한 원두의 추출일, 레시피, 기록 당시 조건, 평가와 컵노트', 'visually-hidden'));
  const head = make(document, 'thead');
  const headings = make(document, 'tr');
  for (const title of ['추출일', '레시피', '기록 당시 조건 · 분쇄 · 온도 · 도징 · 물', '평가', '컵노트']) {
    const cell = make(document, 'th', title);
    cell.setAttribute('scope', 'col');
    headings.append(cell);
  }
  head.append(headings);
  const body = make(document, 'tbody');
  const cards = make(document, 'ul', undefined, 'record-insight-comparison-cards');
  cards.setAttribute('aria-label', '선택한 원두의 비교 기록 카드');
  for (const record of records) {
    const recipe = recipeForRecord(record);
    const name = recipe?.name || '레시피 이름 확인 필요';
    const row = make(document, 'tr', undefined, 'record-insight-comparison-row');
    row.dataset.insightRecordId = record.id;
    row.append(make(document, 'td', record.date || '날짜 확인 필요', 'record-insight-date-cell'));
    row.append(make(document, 'td', name, 'record-insight-recipe-cell'));
    const conditions = make(document, 'td', undefined, 'record-insight-conditions-cell');
    conditions.append(renderComparisonConditions(document, recipe));
    row.append(conditions);
    const rating = make(document, 'td', undefined, 'record-insight-rating-cell');
    rating.append(renderRating(document, record.rating));
    row.append(rating, make(document, 'td', record.cupNote || '컵노트 없음', 'record-insight-note-cell'));
    body.append(row);

    const card = make(document, 'li', undefined, 'record-insight-comparison-card');
    card.dataset.insightRecordId = record.id;
    const cardHeader = make(document, 'div', undefined, 'record-insight-comparison-card-heading');
    cardHeader.append(make(document, 'strong', record.date || '날짜 확인 필요'), renderRating(document, record.rating));
    card.append(cardHeader, make(document, 'p', name, 'record-insight-comparison-card-recipe'));
    card.append(renderComparisonConditions(document, recipe));
    card.append(make(document, 'p', record.cupNote || '컵노트 없음', 'record-insight-comparison-card-note'));
    cards.append(card);
  }
  table.append(head, body);
  tableScroll.append(table);
  region.append(tableScroll, cards);
  return region;
}

function renderComparisonConditions(document, recipe) {
  const list = make(document, 'dl', undefined, 'record-insight-comparison-conditions');
  if (!recipe) {
    list.append(make(document, 'dt', '당시 조건'), make(document, 'dd', '스냅샷에서 확인할 수 없습니다.'));
    return list;
  }
  const values = [
    ['분쇄', recipe.grind], ['온도', Number.isFinite(recipe.temperature) ? `${recipe.temperature}℃` : ''],
    ['도징', Number.isFinite(recipe.dose) ? `${recipe.dose}g` : ''],
    ['물', Number.isFinite(recipe.totalWater) ? `${recipe.totalWater}g` : ''], ['드리퍼', recipe.dripper],
  ].filter(([, value]) => value !== undefined && value !== null && value !== '');
  for (const [label, value] of values) {
    const pair = make(document, 'div');
    pair.append(make(document, 'dt', label), make(document, 'dd', value));
    list.append(pair);
  }
  if (!values.length) list.append(make(document, 'dt', '당시 조건'), make(document, 'dd', '기록되지 않았습니다.'));
  return list;
}

function renderBestRecord(document, record) {
  const article = make(document, 'article', undefined, 'record-insight-best-record');
  article.dataset.insightRecordId = record.id;
  const recipe = recipeForRecord(record);
  const heading = make(document, 'div', undefined, 'record-insight-best-heading');
  const copy = make(document, 'div');
  copy.append(make(document, 'p', '최고 평가 기록', 'record-insight-eyebrow'));
  copy.append(make(document, 'h4', recipe?.name || '레시피 이름 확인 필요'));
  heading.append(copy, renderRating(document, record.rating));
  article.append(heading, make(document, 'p',
    `불러온 유효 별점 ${record.rating}/5 기록 중 가장 높게 평가된 추출입니다.`, 'record-insight-best-reason'));
  article.append(make(document, 'p', record.date || '날짜 확인 필요', 'record-insight-best-date'));
  article.append(renderRecipeConditions(document, recipe));
  article.append(make(document, 'p', record.cupNote || '컵노트 없음', 'record-insight-best-note'));
  return article;
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

function updateTrendGeometry(svg, points, width, height) {
  const layout = layoutRatingTrend(points, { width: Math.max(280, Math.floor(width)), height });
  svg.setAttribute('viewBox', `0 0 ${layout.width} ${layout.height}`);
  for (const [index, rating] of layout.yTicks.entries()) {
    const y = layout.plotBottom - (rating - 1) / 4 * layout.plotHeight;
    const line = svg.querySelectorAll('.rating-chart-grid')[index];
    line?.setAttribute('x1', String(layout.plotLeft));
    line?.setAttribute('x2', String(layout.plotRight));
    line?.setAttribute('y1', String(y));
    line?.setAttribute('y2', String(y));
    const label = svg.querySelectorAll('[data-rating-axis]')[index];
    label?.setAttribute('x', String(layout.plotLeft - 12));
    label?.setAttribute('y', String(y + 4));
  }
  const pointById = new Map(layout.points.map(point => [point.id, point]));
  const line = svg.querySelector('.rating-chart-line');
  if (line) line.setAttribute('d', layout.points.map((point, index) => `${index ? 'L' : 'M'}${point.x},${point.y}`).join(' '));
  for (const circle of svg.querySelectorAll('.rating-chart-point')) {
    const point = pointById.get(circle.getAttribute('data-record-id'));
    if (!point) continue;
    circle.setAttribute('cx', String(point.x));
    circle.setAttribute('cy', String(point.y));
  }
  for (const label of svg.querySelectorAll('.rating-chart-point-label')) {
    const point = layout.points.find(item => item.date === label.getAttribute('data-date') &&
      item.rating === Number(label.getAttribute('data-rating')));
    if (!point) continue;
    label.setAttribute('x', String(point.x));
    label.setAttribute('y', String(point.y + (point.rating === 5 ? 15 : -9)));
  }
  const dateLabels = [...svg.querySelectorAll('[data-date-axis]')];
  for (const label of dateLabels) {
    const point = layout.points.find(item => item.date === label.getAttribute('data-date-axis'));
    if (point) label.setAttribute('x', String(point.x));
    label.style.display = '';
  }
  const lastDateBounds = dateLabels.at(-1)?.getBBox();
  let previousRight = -Infinity;
  for (const [index, label] of dateLabels.entries()) {
    const bounds = label.getBBox();
    const isLast = index === dateLabels.length - 1;
    const crowded = !isLast && (bounds.x < previousRight + 8 ||
      (index > 0 && bounds.x + bounds.width > lastDateBounds.x - 8));
    label.style.display = crowded ? 'none' : '';
    if (!crowded) previousRight = bounds.x + bounds.width;
  }
}

function renderRatingTrend(document, points) {
  const layout = layoutRatingTrend(points, { width: 640, height: 250 });
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
    label.setAttribute('data-rating-axis', String(rating));
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
    circle.setAttribute('data-record-id', point.id);
    circle.setAttribute('data-rating', String(point.rating));
    const overlap = overlapCounts.get(`${point.date}|${point.rating}`);
    const pointTitle = svgElement(document, 'title');
    pointTitle.textContent = `${point.date} · ${point.rating}/5${overlap > 1 ? ` · 같은 날짜와 별점 ${overlap}건` : ''}`;
    circle.append(pointTitle);
    svg.append(circle);
  }
  const distinctLabelPoints = [];
  const labeledPointKeys = new Set();
  for (const point of layout.points) {
    const key = `${point.date}|${point.rating}`;
    if (labeledPointKeys.has(key)) continue;
    labeledPointKeys.add(key);
    distinctLabelPoints.push(point);
  }
  const labelLimit = 12;
  const labelPoints = distinctLabelPoints.length <= labelLimit ? distinctLabelPoints
    : Array.from({ length: labelLimit }, (_, index) => distinctLabelPoints[
      Math.round(index * (distinctLabelPoints.length - 1) / (labelLimit - 1))]);
  for (const point of labelPoints) {
    const label = svgElement(document, 'text');
    label.setAttribute('x', String(point.x));
    label.setAttribute('y', String(point.y + (point.rating === 5 ? 15 : -9)));
    label.setAttribute('text-anchor', 'middle');
    label.setAttribute('class', 'rating-chart-point-label');
    label.setAttribute('aria-hidden', 'true');
    label.setAttribute('data-date', point.date);
    label.setAttribute('data-rating', String(point.rating));
    label.textContent = `${point.rating}점`;
    svg.append(label);
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
    label.setAttribute('data-date-axis', date);
    label.textContent = date.slice(5).replace('-', '/');
    const tickTitle = svgElement(document, 'title');
    tickTitle.textContent = date;
    label.append(tickTitle);
    svg.append(label);
  }
  figure.append(svg);
  observeTrendSize(svg, width => updateTrendGeometry(svg, points, width, 250));
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

function renderRecipeConditions(document, recipe) {
  const conditions = make(document, 'dl', undefined, 'record-insight-recipe-conditions');
  if (!recipe) {
    const pair = make(document, 'div');
    pair.append(make(document, 'dt', '기록 당시 조건'), make(document, 'dd', '스냅샷에서 확인할 수 없습니다.'));
    conditions.append(pair);
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
    const pair = make(document, 'div');
    pair.append(make(document, 'dt', name), make(document, 'dd', value));
    conditions.append(pair);
  }
  if (Array.isArray(recipe.steps) && recipe.steps.length) {
    const pair = make(document, 'div');
    const heading = make(document, 'dt', '단계별 누적 시간과 물');
    const list = make(document, 'dd');
    const steps = make(document, 'ol', undefined, 'record-insight-steps');
    for (const step of recipe.steps) {
      const time = Number.isFinite(step.seconds) ? formatTime(step.seconds) : '시간 확인 필요';
      const water = Number.isFinite(step.water) ? `${step.water}g` : '물 양 확인 필요';
      steps.append(make(document, 'li', `${step.name || '단계'} · 누적 ${time} · 이번 물 ${water}`));
    }
    list.append(steps);
    pair.append(heading, list);
    conditions.append(pair);
  }
  return conditions;
}
