export const demoBeans = Object.freeze([
  Object.freeze({
    id: 'guji',
    name: '에티오피아 구지',
    origin: '함벨라 · 워시드',
    roaster: '샘플 로스터리',
    note: '복숭아 · 홍차 · 자스민',
  }),
  Object.freeze({
    id: 'huila',
    name: '콜롬비아 우일라',
    origin: '산 아구스틴 · 허니',
    roaster: '샘플 로스터리',
    note: '카라멜 · 노란 사과 · 아몬드',
  }),
  Object.freeze({
    id: 'kirinyaga',
    name: '케냐 키리냐가',
    origin: '키리냐가 · 워시드',
    roaster: '샘플 로스터리',
    note: '블랙커런트 · 자몽 · 홍차',
  }),
]);

export const demoRecords = Object.freeze([
  Object.freeze({
    id: 'guji-01', beanId: 'guji', roastedOn: '2026-10-02', brewedOn: '2026-10-08', rating: 4,
    cupNotes: '천도복숭아, 레몬티',
    recipe: Object.freeze({ name: 'V60 · 4:6', family: 'V60', grind: '중간', temperature: 92, dose: 15, water: 240, timeSeconds: 158 }),
  }),
  Object.freeze({
    id: 'guji-02', beanId: 'guji', roastedOn: '2026-10-02', brewedOn: '2026-10-11', rating: 5,
    cupNotes: '복숭아, 자스민, 꿀',
    recipe: Object.freeze({ name: 'V60 · 4:6', family: 'V60', grind: '중간보다 약간 굵게', temperature: 91, dose: 15, water: 240, timeSeconds: 166 }),
  }),
  Object.freeze({
    id: 'guji-03', beanId: 'guji', roastedOn: '2026-10-02', brewedOn: '2026-10-15', rating: 4,
    cupNotes: '홍차, 살구',
    recipe: Object.freeze({ name: '칼리타 웨이브', family: '칼리타', grind: '중간', temperature: 93, dose: 16, water: 250, timeSeconds: 182 }),
  }),
  Object.freeze({
    id: 'guji-04', beanId: 'guji', roastedOn: '2026-10-02', brewedOn: '2026-10-20', rating: 5,
    cupNotes: '복숭아, 백합, 부드러운 단맛',
    recipe: Object.freeze({ name: '오리가미 · 원푸어', family: '오리가미', grind: '중간보다 약간 굵게', temperature: 92, dose: 15, water: 225, timeSeconds: 151 }),
  }),
  Object.freeze({
    id: 'huila-01', beanId: 'huila', roastedOn: '2026-10-05', brewedOn: '2026-10-11', rating: 3,
    cupNotes: '코코아, 구운 견과',
    recipe: Object.freeze({ name: '칼리타 웨이브', family: '칼리타', grind: '중간', temperature: 93, dose: 16, water: 250, timeSeconds: 185 }),
  }),
  Object.freeze({
    id: 'huila-02', beanId: 'huila', roastedOn: '2026-10-05', brewedOn: '2026-10-14', rating: 4,
    cupNotes: '노란 사과, 아몬드',
    recipe: Object.freeze({ name: 'V60 · 펄스', family: 'V60', grind: '중간보다 약간 가늘게', temperature: 92, dose: 15, water: 240, timeSeconds: 162 }),
  }),
  Object.freeze({
    id: 'huila-03', beanId: 'huila', roastedOn: '2026-10-05', brewedOn: '2026-10-18', rating: 5,
    cupNotes: '카라멜, 배, 밀크초콜릿',
    recipe: Object.freeze({ name: '칼리타 웨이브', family: '칼리타', grind: '중간보다 약간 굵게', temperature: 91, dose: 16, water: 250, timeSeconds: 178 }),
  }),
  Object.freeze({
    id: 'huila-04', beanId: 'huila', roastedOn: '2026-10-05', brewedOn: '2026-10-23', rating: 4,
    cupNotes: '카라멜, 잘 익은 배',
    recipe: Object.freeze({ name: '오리가미 · 원푸어', family: '오리가미', grind: '중간', temperature: 92, dose: 15, water: 225, timeSeconds: 155 }),
  }),
  Object.freeze({
    id: 'kirinyaga-01', beanId: 'kirinyaga', roastedOn: '2026-10-07', brewedOn: '2026-10-13', rating: 4,
    cupNotes: '자몽, 얼그레이',
    recipe: Object.freeze({ name: 'V60 · 4:6', family: 'V60', grind: '중간', temperature: 93, dose: 15, water: 240, timeSeconds: 160 }),
  }),
  Object.freeze({
    id: 'kirinyaga-02', beanId: 'kirinyaga', roastedOn: '2026-10-07', brewedOn: '2026-10-16', rating: 5,
    cupNotes: '블랙커런트, 자몽, 홍차',
    recipe: Object.freeze({ name: 'V60 · 펄스', family: 'V60', grind: '중간보다 약간 굵게', temperature: 92, dose: 15, water: 240, timeSeconds: 165 }),
  }),
  Object.freeze({
    id: 'kirinyaga-03', beanId: 'kirinyaga', roastedOn: '2026-10-07', brewedOn: '2026-10-20', rating: 4,
    cupNotes: '레드커런트, 밀크티',
    recipe: Object.freeze({ name: '칼리타 웨이브', family: '칼리타', grind: '중간보다 약간 가늘게', temperature: 93, dose: 16, water: 250, timeSeconds: 184 }),
  }),
  Object.freeze({
    id: 'kirinyaga-04', beanId: 'kirinyaga', roastedOn: '2026-10-07', brewedOn: '2026-10-25', rating: 5,
    cupNotes: '블랙커런트, 베르가못, 긴 여운',
    recipe: Object.freeze({ name: '오리가미 · 원푸어', family: '오리가미', grind: '중간', temperature: 92, dose: 15, water: 225, timeSeconds: 153 }),
  }),
]);

const DAY_MS = 24 * 60 * 60 * 1000;

export function getRoastAgeDays(roastedOn, brewedOn) {
  const roastedAt = Date.parse(`${roastedOn}T00:00:00Z`);
  const brewedAt = Date.parse(`${brewedOn}T00:00:00Z`);
  if (!Number.isFinite(roastedAt) || !Number.isFinite(brewedAt) || brewedAt < roastedAt) return null;
  return Math.floor((brewedAt - roastedAt) / DAY_MS);
}

function compareBestRecord(left, right) {
  return right.rating - left.rating || right.brewedOn.localeCompare(left.brewedOn) || left.id.localeCompare(right.id);
}

export function summarizeBean(beanId, beans = demoBeans, records = demoRecords) {
  const bean = beans.find(item => item.id === beanId);
  if (!bean) return null;

  const beanRecords = records.filter(record => record.beanId === beanId);
  const bestRecord = [...beanRecords].sort(compareBestRecord)[0] ?? null;
  const averageRating = beanRecords.length
    ? Math.round(beanRecords.reduce((sum, record) => sum + record.rating, 0) / beanRecords.length * 10) / 10
    : null;

  return { bean, records: beanRecords, recordCount: beanRecords.length, averageRating, bestRecord };
}

export function getRecentlyBrewedBeans(beans = demoBeans, records = demoRecords, limit = 3) {
  const beansById = new Map();
  for (const bean of beans) {
    if (!beansById.has(bean.id)) beansById.set(bean.id, bean);
  }

  const latestByBean = new Map();
  for (const record of records) {
    if (!beansById.has(record.beanId)) continue;
    const current = latestByBean.get(record.beanId);
    if (!current || record.brewedOn > current.brewedOn || (record.brewedOn === current.brewedOn && record.id < current.id)) {
      latestByBean.set(record.beanId, record);
    }
  }

  const maximumBeans = Number.isFinite(limit) ? Math.max(0, Math.floor(limit)) : 3;
  return [...latestByBean.entries()]
    .sort(([, left], [, right]) => right.brewedOn.localeCompare(left.brewedOn) || left.beanId.localeCompare(right.beanId))
    .slice(0, maximumBeans)
    .map(([beanId, latestRecord]) => ({
      bean: beansById.get(beanId),
      latestRecord,
      recordCount: records.filter(record => record.beanId === beanId).length,
    }));
}

export function getRatingTrend(records, beanId) {
  return records
    .filter(record => record.beanId === beanId)
    .sort((left, right) => left.brewedOn.localeCompare(right.brewedOn) || left.id.localeCompare(right.id));
}

export function getRatingTrendCoordinates(records, { width = 640, height = 250, padding = {} } = {}) {
  const plot = {
    left: padding.left ?? 46,
    right: width - (padding.right ?? 24),
    top: padding.top ?? 28,
    bottom: height - (padding.bottom ?? 48),
  };
  const plotWidth = Math.max(0, plot.right - plot.left);
  const plotHeight = Math.max(0, plot.bottom - plot.top);
  const timestamps = records.map(record => Date.parse(`${record.brewedOn}T00:00:00Z`));
  const firstDate = Math.min(...timestamps);
  const lastDate = Math.max(...timestamps);

  return records.map((record, index) => {
    const timestamp = timestamps[index];
    const x = firstDate === lastDate
      ? plot.left + plotWidth / 2
      : plot.left + ((timestamp - firstDate) / (lastDate - firstDate)) * plotWidth;
    const y = plot.top + ((5 - record.rating) / 4) * plotHeight;
    return { ...record, x, y };
  });
}

export function filterAndSortRecords(records, { beanId, recipeFamily = 'all', sort = 'date-desc' } = {}) {
  return records
    .filter(record => record.beanId === beanId && (recipeFamily === 'all' || record.recipe.family === recipeFamily))
    .sort((left, right) => {
      if (sort === 'rating-desc') return right.rating - left.rating || right.brewedOn.localeCompare(left.brewedOn);
      if (sort === 'date-asc') return left.brewedOn.localeCompare(right.brewedOn) || left.id.localeCompare(right.id);
      return right.brewedOn.localeCompare(left.brewedOn) || left.id.localeCompare(right.id);
    });
}

function element(tagName, className, text) {
  const node = document.createElement(tagName);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function formatDate(value) {
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'UTC',
  }).format(new Date(`${value}T00:00:00Z`));
}

function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return minutes ? `${minutes}분 ${String(remainder).padStart(2, '0')}초` : `${remainder}초`;
}

function appendDefinitionPair(list, label, value) {
  const pair = element('div');
  pair.append(element('dt', '', label), element('dd', '', value));
  list.append(pair);
}

function createRating(rating, className = '') {
  const group = element('span', `rating ${className}`.trim());
  const stars = element('span', 'rating-stars', '★'.repeat(rating) + '☆'.repeat(5 - rating));
  stars.setAttribute('aria-hidden', 'true');
  group.append(stars, element('span', 'rating-number', `${rating}.0점`));
  return group;
}

function createBeanOption({ bean, latestRecord, recordCount }) {
  const button = element('button', 'bean-option');
  button.type = 'button';
  button.dataset.beanId = bean.id;
  button.setAttribute('aria-pressed', 'false');

  const topLine = element('span', 'bean-option-top');
  topLine.append(element('span', 'bean-option-name', bean.name), element('span', 'bean-option-count', `${recordCount}회`));
  button.append(topLine, element('span', 'bean-option-origin', bean.origin));
  button.append(
    element('span', 'bean-option-best', `최근 ${formatDate(latestRecord.brewedOn)} · ${latestRecord.rating}.0점`),
    element('span', 'bean-option-recipe', latestRecord.recipe.name),
  );
  return button;
}

function formatTrendDate(value) {
  const [, month, day] = value.split('-');
  return `${month}/${day}`;
}

function renderRatingTrend(summary, { chart, caption, empty, details, list }) {
  const records = getRatingTrend(summary.records, summary.bean.id);
  const detailsSummary = details.querySelector('summary');
  const axis = chart.querySelector('#trend-axis');
  const series = chart.querySelector('#trend-series');
  axis.replaceChildren();
  series.replaceChildren();
  list.replaceChildren(...records.map(record => {
    const item = element('li', 'trend-list-item');
    const date = element('time', '', formatDate(record.brewedOn));
    date.setAttribute('datetime', record.brewedOn);
    item.append(date, element('span', '', `${record.rating}.0점`));
    return item;
  }));

  const titleText = `${summary.bean.name} 별점 추이`;
  chart.querySelector('#rating-trend-title').textContent = titleText;
  chart.hidden = records.length === 0;
  empty.hidden = records.length > 0;
  details.hidden = records.length === 0;

  if (records.length === 0) {
    const emptyDescription = `${summary.bean.name}에는 아직 별점이 기록된 추출이 없습니다.`;
    chart.querySelector('#rating-trend-description').textContent = emptyDescription;
    caption.textContent = emptyDescription;
    detailsSummary.textContent = '그래프를 텍스트로 보기';
    return;
  }

  const width = Math.max(280, Math.floor(chart.getBoundingClientRect().width || chart.clientWidth || 640));
  const height = Math.floor(chart.getBoundingClientRect().height || chart.clientHeight || 250);
  const padding = { top: 30, right: 24, bottom: 48, left: 46 };
  const points = getRatingTrendCoordinates(records, { width, height, padding });
  const plotRight = width - padding.right;
  const plotBottom = height - padding.bottom;
  const plotHeight = plotBottom - padding.top;
  chart.setAttribute('viewBox', `0 0 ${width} ${height}`);

  const dateAndRatingText = records.map(record => `${record.brewedOn} ${record.rating}점`).join(', ');
  const accessibleDescription = `${records.length}건의 전체 추출 기록입니다. 가로축은 실제 날짜 간격, 세로축은 1점부터 5점까지입니다. 날짜별 평가: ${dateAndRatingText}.`;
  chart.querySelector('#rating-trend-description').textContent = accessibleDescription;
  caption.textContent = `${summary.bean.name} · 전체 ${records.length}회 · 날짜 오름차순 · y축 1~5점`;
  detailsSummary.textContent = `그래프를 텍스트로 보기 (${records.length}건)`;

  for (const rating of [5, 4, 3, 2, 1]) {
    const y = padding.top + ((5 - rating) / 4) * plotHeight;
    const tick = chart.querySelector('#trend-grid-template').cloneNode(true);
    tick.removeAttribute('id');
    tick.querySelector('line').setAttribute('x1', padding.left);
    tick.querySelector('line').setAttribute('x2', plotRight);
    tick.querySelector('line').setAttribute('y1', y);
    tick.querySelector('line').setAttribute('y2', y);
    tick.querySelector('text').setAttribute('x', padding.left - 12);
    tick.querySelector('text').setAttribute('y', y + 4);
    tick.querySelector('text').textContent = String(rating);
    axis.append(tick);
  }

  if (points.length > 1) {
    const path = points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');
    const line = chart.querySelector('#trend-line-template').cloneNode();
    line.removeAttribute('id');
    line.setAttribute('d', path);
    series.append(line);
  }

  points.forEach((point, index) => {
    const anchor = index === 0 ? 'start' : index === points.length - 1 ? 'end' : 'middle';
    const group = chart.querySelector('#trend-point-template').cloneNode(true);
    group.removeAttribute('id');
    group.setAttribute('class', 'trend-point');
    group.setAttribute('data-trend-date', point.brewedOn);
    group.setAttribute('data-rating', point.rating);
    group.querySelector('circle').setAttribute('cx', point.x);
    group.querySelector('circle').setAttribute('cy', point.y);
    group.querySelector('.trend-point-rating').setAttribute('x', point.x);
    group.querySelector('.trend-point-rating').setAttribute('y', point.y - 10);
    group.querySelector('.trend-point-rating').textContent = `${point.rating}점`;
    group.querySelector('.trend-axis-date').setAttribute('x', point.x);
    group.querySelector('.trend-axis-date').setAttribute('y', height - 12);
    group.querySelector('.trend-axis-date').setAttribute('text-anchor', anchor);
    group.querySelector('.trend-axis-date').textContent = formatTrendDate(point.brewedOn);
    series.append(group);
  });
}

function createComparisonRow(record) {
  const row = element('tr');
  const roastAge = getRoastAgeDays(record.roastedOn, record.brewedOn);
  const dateCell = element('td', 'record-date');
  dateCell.append(element('strong', '', formatDate(record.brewedOn)), element('span', 'muted-value', roastAge === null ? '로스팅 날짜 확인 필요' : `로스팅 후 ${roastAge}일`));
  row.append(dateCell, element('td', 'record-recipe', record.recipe.name));

  const conditions = element('td', 'record-conditions');
  conditions.append(element('span', '', record.recipe.grind));
  conditions.append(element('span', '', `${record.recipe.temperature}°C · ${record.recipe.dose}g / ${record.recipe.water}g`));
  conditions.append(element('span', '', formatTime(record.recipe.timeSeconds)));
  row.append(conditions);

  const ratingCell = element('td', 'record-rating');
  ratingCell.append(createRating(record.rating));
  row.append(ratingCell, element('td', 'record-note', record.cupNotes));
  return row;
}

function createRecordCard(record) {
  const card = element('li', 'record-card');
  const heading = element('div', 'record-card-heading');
  heading.append(element('strong', '', formatDate(record.brewedOn)), createRating(record.rating));
  card.append(heading, element('p', 'record-card-recipe', record.recipe.name));

  const details = element('dl', 'record-card-details');
  const roastAge = getRoastAgeDays(record.roastedOn, record.brewedOn);
  appendDefinitionPair(details, '로스팅 후', roastAge === null ? '날짜 확인 필요' : `${roastAge}일`);
  appendDefinitionPair(details, '분쇄', record.recipe.grind);
  appendDefinitionPair(details, '온도', `${record.recipe.temperature}°C`);
  appendDefinitionPair(details, '도징 / 물', `${record.recipe.dose}g / ${record.recipe.water}g`);
  appendDefinitionPair(details, '추출 시간', formatTime(record.recipe.timeSeconds));
  appendDefinitionPair(details, '컵노트', record.cupNotes || '기록 없음');
  card.append(details);
  return card;
}

function renderBestRecord(summary, target) {
  target.replaceChildren();
  const record = summary.bestRecord;
  if (!record) {
    target.append(element('p', 'best-empty', '이 원두에는 아직 추출 기록이 없습니다.'));
    return;
  }

  const age = getRoastAgeDays(record.roastedOn, record.brewedOn);
  const tied = summary.records.filter(item => item.rating === record.rating).length;
  const intro = element('div', 'best-heading');
  intro.append(element('p', 'eyebrow', 'SAMPLE RECORD · 최고 평가'), element('h3', '', record.recipe.name));
  const score = element('div', 'best-score');
  score.append(createRating(record.rating, 'rating-featured'));
  score.append(element('span', 'best-score-count', `기록 ${summary.recordCount}회 중`));
  intro.append(score);

  const reason = tied > 1
    ? `샘플 ${summary.recordCount}회 중 ${record.rating}.0점을 받은 기록 ${tied}개 가운데 가장 최근 추출입니다.`
    : `샘플 ${summary.recordCount}회 가운데 가장 높은 ${record.rating}.0점 기록입니다.`;
  target.append(intro, element('p', 'best-reason', reason));

  const details = element('dl', 'best-details');
  appendDefinitionPair(details, '추출 날짜', formatDate(record.brewedOn));
  appendDefinitionPair(details, '로스팅 후', age === null ? '날짜 확인 필요' : `${age}일`);
  appendDefinitionPair(details, '레시피', record.recipe.name);
  appendDefinitionPair(details, '분쇄', record.recipe.grind);
  appendDefinitionPair(details, '물 온도', `${record.recipe.temperature}°C`);
  appendDefinitionPair(details, '도징 / 물', `${record.recipe.dose}g / ${record.recipe.water}g`);
  appendDefinitionPair(details, '추출 시간', formatTime(record.recipe.timeSeconds));
  appendDefinitionPair(details, '컵노트', record.cupNotes || '기록 없음');
  target.append(details, element('p', 'sample-boundary', '이 값은 샘플의 평가 결과입니다. 개인 기록을 바탕으로 계산하며, 모두에게 맞는 권장 레시피를 뜻하지 않습니다.'));
}

function initRecordsDemo() {
  const beanList = document.querySelector('#bean-list');
  const beanHeading = document.querySelector('#selected-bean-name');
  const beanOrigin = document.querySelector('#selected-bean-origin');
  const beanRoaster = document.querySelector('#selected-bean-roaster');
  const beanNote = document.querySelector('#selected-bean-note');
  const countValue = document.querySelector('#selected-record-count');
  const averageValue = document.querySelector('#selected-record-average');
  const bestTarget = document.querySelector('#best-brew');
  const recordCount = document.querySelector('#comparison-count');
  const emptyState = document.querySelector('#record-empty');
  const tableBody = document.querySelector('#records-table-body');
  const cardList = document.querySelector('#records-cards');
  const currentSelection = document.querySelector('#selection-announcement');
  const recipeFilter = document.querySelector('#recipe-filter');
  const recordSort = document.querySelector('#record-sort');
  const beanListCount = document.querySelector('#bean-list-count');
  const beanListEmpty = document.querySelector('#bean-list-empty');
  const trendTargets = {
    chart: document.querySelector('#rating-trend'),
    caption: document.querySelector('#rating-trend-summary'),
    empty: document.querySelector('#rating-trend-empty'),
    details: document.querySelector('#rating-trend-text'),
    list: document.querySelector('#rating-trend-list'),
  };

  if (!beanList || !beanHeading || !recipeFilter || !recordSort) return;

  const recentBeans = getRecentlyBrewedBeans(demoBeans, demoRecords, 3);
  let selectedBeanId = recentBeans[0]?.bean.id ?? null;
  beanListCount.textContent = `${recentBeans.length}종`;
  beanListEmpty.hidden = recentBeans.length > 0;
  for (const recentBean of recentBeans) {
    beanList.append(createBeanOption(recentBean));
  }

  function render() {
    const summary = summarizeBean(selectedBeanId);
    if (!summary) {
      beanHeading.textContent = '기록이 있는 원두 없음';
      beanOrigin.textContent = '';
      beanRoaster.textContent = '';
      beanNote.textContent = '';
      countValue.textContent = '0회';
      averageValue.textContent = '기록 없음';
      currentSelection.textContent = '최근 추출 기록이 있는 원두가 없습니다.';
      bestTarget.replaceChildren(element('p', 'best-empty', '최근 추출 기록이 없습니다.'));
      renderRatingTrend({ bean: { id: '', name: '선택한 원두' }, records: [] }, trendTargets);
      recordCount.textContent = '0건';
      tableBody.replaceChildren();
      cardList.replaceChildren();
      emptyState.hidden = false;
      document.querySelector('#records-table-region').hidden = true;
      return;
    }

    for (const button of beanList.querySelectorAll('[data-bean-id]')) {
      const selected = button.dataset.beanId === selectedBeanId;
      button.setAttribute('aria-pressed', String(selected));
      button.classList.toggle('is-selected', selected);
    }

    beanHeading.textContent = summary.bean.name;
    beanOrigin.textContent = summary.bean.origin;
    beanRoaster.textContent = summary.bean.roaster;
    beanNote.textContent = summary.bean.note;
    countValue.textContent = `${summary.recordCount}회`;
    averageValue.textContent = summary.averageRating === null ? '기록 없음' : `${summary.averageRating.toFixed(1)}점`;
    currentSelection.textContent = `${summary.bean.name} 선택 · 기록 ${summary.recordCount}회`;
    renderBestRecord(summary, bestTarget);
    renderRatingTrend(summary, trendTargets);

    const visibleRecords = filterAndSortRecords(demoRecords, {
      beanId: selectedBeanId,
      recipeFamily: recipeFilter.value,
      sort: recordSort.value,
    });
    recordCount.textContent = `${visibleRecords.length}건`;
    tableBody.replaceChildren(...visibleRecords.map(createComparisonRow));
    cardList.replaceChildren(...visibleRecords.map(createRecordCard));
    emptyState.hidden = visibleRecords.length > 0;
    document.querySelector('#records-table-region').hidden = visibleRecords.length === 0;
  }

  beanList.addEventListener('click', event => {
    const button = event.target.closest('button[data-bean-id]');
    if (!button) return;
    selectedBeanId = button.dataset.beanId;
    render();
  });
  recipeFilter.addEventListener('change', render);
  recordSort.addEventListener('change', render);
  window.addEventListener('resize', () => {
    const summary = summarizeBean(selectedBeanId);
    if (summary) renderRatingTrend(summary, trendTargets);
  });
  render();
}

if (typeof document !== 'undefined') initRecordsDemo();
