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

function createBeanOption(bean, summary) {
  const button = element('button', 'bean-option');
  button.type = 'button';
  button.dataset.beanId = bean.id;
  button.setAttribute('aria-pressed', 'false');

  const topLine = element('span', 'bean-option-top');
  topLine.append(element('span', 'bean-option-name', bean.name), element('span', 'bean-option-count', `${summary.recordCount}회`));
  button.append(topLine, element('span', 'bean-option-origin', bean.origin));

  if (summary.bestRecord) {
    const best = summary.bestRecord;
    button.append(element('span', 'bean-option-best', `최고 ${best.rating}.0점 · ${formatDate(best.brewedOn)}`));
    button.append(element('span', 'bean-option-recipe', best.recipe.name));
  } else {
    button.append(element('span', 'bean-option-best', '아직 기록이 없어요'));
  }
  return button;
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

  if (!beanList || !beanHeading || !recipeFilter || !recordSort) return;

  let selectedBeanId = demoBeans[0]?.id;
  for (const bean of demoBeans) {
    const summary = summarizeBean(bean.id);
    beanList.append(createBeanOption(bean, summary));
  }

  function render() {
    const summary = summarizeBean(selectedBeanId);
    if (!summary) return;

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
  render();
}

if (typeof document !== 'undefined') initRecordsDemo();
