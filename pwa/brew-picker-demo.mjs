const beans = [
  { id: 'guji', name: '에티오피아 구지 우라가', subtitle: '에티오피아 · 구지', detail: '모모스커피 · 내추럴', note: '베리, 복숭아, 밀크초콜릿', kind: 'SINGLE ORIGIN' },
  { id: 'huila', name: '콜롬비아 우일라', subtitle: '콜롬비아 · 우일라', detail: '프릳츠 · 워시드', note: '오렌지, 캐러멜, 아몬드', kind: 'SINGLE ORIGIN' },
  { id: 'blend', name: '데일리 블렌드', subtitle: '브라질 · 콜롬비아', detail: '앤트러사이트 · 블렌드', note: '다크초콜릿, 헤이즐넛', kind: 'BLEND' },
];
const recipes = [
  { id: 'v60', name: 'V60 데일리', subtitle: '하리오 V60 · 핸드드립', detail: '원두 20g · 물 300g · 93℃', note: '중간 분쇄 · 4단계 · 약 3분', kind: 'HOT', ready: true },
  { id: 'iced', name: '아이스 드립', subtitle: '하리오 V60 · 핸드드립', detail: '원두 20g · 물 180g · 94℃', note: '서버에 얼음 120g · 3단계 · 약 2분 30초', kind: 'ICED', ready: true },
  { id: 'kalita', name: '칼리타 웨이브', subtitle: '칼리타 185 · 핸드드립', detail: '원두 18g · 물 270g · 92℃', note: '중간 분쇄 · 4단계 · 약 3분', kind: 'HOT', ready: true },
  { id: 'draft', name: '새 레시피', subtitle: '추출 단계 미등록', detail: '원두 20g · 물 300g · 93℃', note: '추출 단계를 등록하면 선택할 수 있어요.', kind: '준비 중', ready: false },
];

const $ = selector => document.querySelector(selector);
const cards = $('#cards');
const search = $('#search');
let step = 0;
let selectedBean;
let selectedRecipe;

function span(className, text) {
  const node = document.createElement('span');
  node.className = className;
  node.textContent = text;
  return node;
}

function renderCards() {
  const query = search.value.trim().toLocaleLowerCase();
  const items = (step === 0 ? beans : recipes).filter(item =>
    [item.name, item.subtitle, item.detail, item.note].join(' ').toLocaleLowerCase().includes(query));
  cards.replaceChildren();
  for (const item of items) {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'picker-card';
    card.dataset.id = item.id;
    card.disabled = item.ready === false;
    const top = span('card-top', '');
    top.append(span('card-kind', item.kind));
    card.append(top, span('card-name', item.name), span('card-subtitle', item.subtitle),
      span('card-detail', item.detail), span('card-note', item.note),
      span('card-action', card.disabled ? '추출 단계 등록 후 선택 가능' : step === 0 ? '이 원두로 내리기 →' : '이 레시피로 준비하기 →'));
    card.addEventListener('click', () => {
      if (step === 0) { selectedBean = item; step = 1; }
      else { selectedRecipe = item; step = 2; }
      search.value = '';
      render();
    });
    cards.append(card);
  }
  $('#result-count').textContent = `${step === 0 ? '원두' : '레시피'} ${items.length}${step === 0 ? '종' : '개'}`;
  $('#empty').hidden = items.length > 0;
}

function render() {
  const titles = ['어떤 원두로 내릴까요?', '어떤 레시피로 내릴까요?', '추출을 시작할 준비가 됐어요.'];
  $('#picker-title').textContent = titles[step];
  $('#step-label').textContent = `STEP 0${step + 1}`;
  $('#picker-help').textContent = ['카드의 어느 곳을 눌러도 레시피 선택으로 이동해요.', '추출 조건을 확인하고 카드 전체를 눌러 선택하세요.', '선택한 원두와 레시피를 확인해 보세요.'][step];
  document.querySelectorAll('.steps li').forEach((item, index) => {
    item.removeAttribute('aria-current');
    if (index === step) item.setAttribute('aria-current', 'step');
  });
  $('#back').hidden = step === 0;
  $('#back').textContent = step === 2 ? '← 레시피 다시 선택' : '← 원두 다시 선택';
  $('#selected-bean').hidden = step !== 1;
  $('#selected-bean').textContent = selectedBean ? `선택한 원두 · ${selectedBean.name}` : '';
  $('#search-area').hidden = step === 2;
  cards.hidden = step === 2;
  $('#ready').hidden = step !== 2;
  $('#search-label').textContent = step === 0 ? '원두 검색' : '레시피 검색';
  search.placeholder = step === 0 ? '원두 이름, 산지, 로스터리로 검색' : '레시피 이름, 도구로 검색';
  if (step < 2) renderCards();
  else {
    $('#empty').hidden = true;
    const summary = $('#summary');
    summary.replaceChildren();
    for (const [label, value] of [['원두', selectedBean.name], ['레시피', selectedRecipe.name], ['추출 조건', selectedRecipe.detail]]) {
      const term = document.createElement('dt');
      const description = document.createElement('dd');
      term.textContent = label;
      description.textContent = value;
      summary.append(term, description);
    }
  }
  $('#picker-title').focus();
}

search.addEventListener('input', renderCards);
$('#back').addEventListener('click', () => { step -= 1; search.value = ''; render(); });
$('#restart').addEventListener('click', () => { step = 0; selectedBean = undefined; selectedRecipe = undefined; search.value = ''; render(); });
// Initial paint preserves the browser's normal focus and scroll position.
renderCards();
