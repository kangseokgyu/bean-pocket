import { createSubmissionKeys } from '/submission.mjs';
import { calculateSteps, formatTime, validateBean, validateBag, validateRecipe, validateRecord, copyRecipe, createSnapshot, summarizeRatings } from '/domain.mjs';

const main = document.querySelector('#main');
const dialog = document.querySelector('#form-dialog');
const dialogContent = document.querySelector('#dialog-content');
const notice = document.querySelector('#notice');
const connectionState = document.querySelector('#connection-state');
const emptyData = () => ({ beans: [], bags: [], recipes: [], records: [] });
let data = emptyData();
let connected = false;
let demo = false;
let stale = false;
let loading = false;
let lastFocused = null;
let saving = false;

const escape = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const displayDate = value => value ? escape(value.slice(0, 10).replaceAll('-', '. ')) : '날짜 미입력';
const beanLink = id => '#bean/' + encodeURIComponent(id);
const recipeLink = id => '#recipe/' + encodeURIComponent(id);
const stars = rating => Number.isInteger(rating) && rating >= 1 && rating <= 5 ? '★'.repeat(rating) : '';
const canSave = () => (connected || demo) && !stale && !loading;
const disabled = () => canSave() ? '' : 'disabled';

document.querySelector('#today').textContent = new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' }).format(new Date());

async function api(path, body, key) {
  const response = await fetch(path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: body === undefined ? {} : { 'Content-Type': 'application/json', ...(key ? { 'Idempotency-Key': key } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || '요청을 처리하지 못했습니다.');
  return result;
}

function showNotice(message, error = false) {
  notice.textContent = message;
  notice.hidden = !message;
  notice.className = error ? 'error' : '';
}

function updateConnection() {
  connectionState.textContent = demo ? '체험 · 노션에 저장되지 않음' : connected ? (stale ? '연결 오류 · 이전 데이터' : '노션 연결됨') : '노션 연결 전';
  document.querySelector('#connect-button').textContent = demo ? '노션 연결하기' : connected ? '연결 설정' : '노션 연결';
}

async function loadData({ quiet = false } = {}) {
  if (demo) return render();
  loading = true;
  updateConnection();
  render();
  try {
    data = await api('/api/data');
    stale = false;
    if (!quiet) showNotice('');
  } catch (error) {
    stale = true;
    showNotice(`${error.message} 표시된 데이터는 이전 조회 결과입니다. 다시 불러온 뒤 저장해 주세요.`, true);
  } finally {
    loading = false;
    updateConnection();
    render();
  }
}

function heading(eyebrow, title, subtitle, actions = '') {
  return `<div class="page-heading"><div><p class="eyebrow">${eyebrow}</p><h1>${escape(title)}</h1><p class="subtitle">${escape(subtitle)}</p></div><div class="actions">${actions}</div></div>`;
}

function beanCard(bean) {
  const records = data.records.filter(record => record.beanId === bean.id);
  return `<a class="card" href="${beanLink(bean.id)}"><div class="bean-icon" aria-hidden="true">◒</div><p class="eyebrow">${escape(bean.process || 'COFFEE BEANS')}</p><h2>${escape(bean.name)}</h2><p class="roaster">${escape(bean.roaster || '로스터리 미입력')}</p><div class="card-bottom"><span>추출 기록 ${records.length}개</span><span aria-hidden="true">↗</span></div></a>`;
}

function recipeCard(recipe) {
  const stats = summarizeRatings(data.records, recipe.id);
  return `<a class="card" href="${recipeLink(recipe.id)}"><p class="eyebrow">${escape(recipe.dripper || 'POUR OVER')}</p><h2>${escape(recipe.name)}</h2><p class="roaster">${escape(recipe.dose)}g · ${escape(recipe.temperature)}℃ · ${escape(recipe.totalWater)}g</p><div class="card-bottom"><span>${stats.average === null ? '평가 없음' : `<span class="stars">★</span> ${stats.average.toFixed(1)}`}</span><span>${stats.count}회 기록 ↗</span></div></a>`;
}

function breadcrumbs(bean, recipe) {
  return `<nav class="breadcrumb" aria-label="현재 위치"><a href="#">원두 보관함</a>${bean ? `<span>/</span><a href="${beanLink(bean.id)}">${escape(bean.name)}</a>` : ''}${recipe ? `<span>/</span><span aria-current="page">${escape(recipe.name)}</span>` : ''}</nav>`;
}

function stepsTable(steps) {
  return `<div class="table-scroll" tabindex="0" role="region" aria-label="물 붓기 단계 표. 좁은 화면에서는 좌우로 스크롤하세요."><table><thead><tr><th scope="col">단계</th><th scope="col">누적 시간</th><th scope="col">간격</th><th scope="col">추가 물</th><th scope="col">누적 물</th></tr></thead><tbody>${steps.map(step => `<tr><td>${escape(step.name)}</td><td>${formatTime(step.seconds)}</td><td>${step.interval}초</td><td>${escape(step.water)}g</td><td>${escape(step.cumulativeWater)}g</td></tr>`).join('')}</tbody></table></div>`;
}

function recipeChips(recipe) {
  const values = [['드리퍼', recipe.dripper || '미입력'], ['원두 사용량', `${recipe.dose}g`], ['물 온도', `${recipe.temperature}℃`], ['총 물 양', `${recipe.totalWater}g`], ['분쇄도', recipe.grind || '미입력']];
  if (recipe.grinder) values.push(['그라인더', recipe.grinder]);
  if (recipe.grinderSetting) values.push(['설정값', recipe.grinderSetting]);
  if (recipe.microns) values.push(['입자 굵기', `${recipe.microns}μm`]);
  return `<div class="chips">${values.map(([label, value]) => `<div class="chip"><span>${label}</span>${escape(value)}</div>`).join('')}</div>`;
}

function renderRecord(record) {
  const bag = data.bags.find(item => item.id === record.bagId);
  const bean = data.beans.find(item => item.id === record.beanId);
  const recipe = data.recipes.find(item => item.id === record.recipeId);
  const validSnapshot = record.snapshotStatus === 'valid' ? record.snapshot : null;
  const snapshot = validSnapshot?.version === 2 ? validSnapshot.recipe : validSnapshot;
  const needsConfirmation = record.beanResolution === 'needs-confirmation';
  const invalidLabels = [
    ...(record.invalidFields?.includes('date') ? ['날짜'] : []),
    ...(record.invalidFields?.includes('rating') ? ['별점(정수 1~5)'] : []),
  ];
  const warnings = [
    ...(needsConfirmation ? ['과거 원두 관계를 확인해야 합니다.'] : []),
    ...(invalidLabels.length ? [`기록 오류: ${invalidLabels.join(', ')}`] : []),
    ...(record.snapshotStatus === 'damaged' ? ['스냅샷이 손상되어 당시 조건을 표시할 수 없습니다.'] : []),
  ];
  const snapshotMessage = record.snapshotStatus === 'damaged'
    ? '기록 당시 조건을 검증할 수 없는 기록입니다.'
    : '당시 조건이 저장되지 않은 기록입니다.';
  return `<article class="record"><div class="record-header"><span class="stars" aria-label="5점 만점에 ${escape(record.rating ?? '확인 필요')}점">${stars(record.rating)}</span><span>${displayDate(record.date)}</span><span class="muted">별점: ${escape(record.rating ?? '확인 필요')}/5</span></div><p>원두: ${escape(bean?.name || '원두 확인 필요')} · 레시피: ${escape(recipe?.name || snapshot?.name || '확인할 수 없는 레시피')}</p>${warnings.map(message => `<p class="muted">${escape(message)}</p>`).join('')}${bag ? `<p class="muted">원두 봉지: ${escape(bag.name)}</p>` : record.bagCandidates?.length ? '<p class="muted">원두 봉지 관계 확인 필요</p>' : ''}${record.cupNote ? `<p>${escape(record.cupNote)}</p>` : '<p class="muted">컵노트 없이 남긴 한 잔</p>'}<details><summary>당시 레시피 확인</summary><div class="snapshot">${snapshot ? `<strong>${escape(snapshot.name || '당시 레시피')}</strong>${recipeChips(snapshot)}${Array.isArray(snapshot.steps) ? stepsTable(snapshot.steps) : ''}` : snapshotMessage}</div></details></article>`;
}

function render() {
  const route = location.hash.slice(1).split('/');
  const selectedBean = route[0] === 'bean' ? data.beans.find(bean => bean.id === decodeURIComponent(route[1] || '')) : null;
  const selectedRecipe = route[0] === 'recipe' ? data.recipes.find(recipe => recipe.id === decodeURIComponent(route[1] || '')) : null;
  const refresh = connected && !demo ? `<button class="button small secondary" data-action="reload" ${loading ? 'disabled' : ''}>${loading ? '불러오는 중…' : '다시 불러오기'}</button>` : '';
  if (route[0] === 'records') {
    const records = [...data.records].sort((a, b) => String(b.date ?? '').localeCompare(String(a.date ?? '')));
    main.innerHTML = heading('BREW JOURNAL', '추출 기록', '원두와 레시피를 골라 한 잔의 경험을 다시 찾아보세요.', `<button class="button" data-action="record" ${disabled()}>＋ 추출 기록</button>${refresh}`)
      + `<div class="fields record-filters"><label class="field">원두별 조회<select data-record-filter="beanId"><option value="">모든 원두</option>${data.beans.map(bean => `<option value="${escape(bean.id)}">${escape(bean.name)}</option>`).join('')}</select></label><label class="field">레시피별 조회<select data-record-filter="recipeId"><option value="">모든 레시피</option>${data.recipes.map(recipe => `<option value="${escape(recipe.id)}">${escape(recipe.name)}</option>`).join('')}</select></label></div>`
      + `<div data-record-list>${records.length ? records.map(renderRecord).join('') : '<div class="empty"><h2>아직 추출 기록이 없어요</h2><p>원두와 공용 레시피를 선택해 첫 잔을 기록해보세요.</p></div>'}</div>`;
  } else if (selectedRecipe) {
    const records = data.records.filter(record => record.recipeId === selectedRecipe.id).sort((a, b) => String(b.date ?? '').localeCompare(String(a.date ?? '')));
    main.innerHTML = breadcrumbs(null, selectedRecipe) + heading('BREW RECIPE', selectedRecipe.name, '오늘도 같은 취향을 만날 수 있도록.', `<a class="button secondary" href="#records">추출 기록</a><button class="button secondary" data-action="copy" data-id="${escape(selectedRecipe.id)}" ${disabled()}>레시피 복사</button>${refresh}`)
      + recipeChips(selectedRecipe) + `<div class="section-heading"><h2>물 붓기</h2><span class="muted">시간과 물 양을 함께 확인하세요</span></div>` + stepsTable(selectedRecipe.steps)
      + `<div class="section-heading"><h2>한 잔의 기록 <span class="muted">${records.length}</span></h2><button class="button" data-action="record" data-id="${escape(selectedRecipe.id)}" ${disabled()}>＋ 추출 기록</button></div>`
      + (records.length ? records.map(renderRecord).join('') : '<div class="empty"><h2>첫 번째 한 잔을 기다려요</h2><p>날짜와 별점만으로도 충분해요.<br>기억하고 싶은 향과 맛은 컵노트에 남겨보세요.</p></div>');
  } else if (selectedBean) {
    const records = data.records.filter(record => record.beanId === selectedBean.id).sort((a, b) => String(b.date ?? '').localeCompare(String(a.date ?? '')));
    const bags = data.bags.filter(bag => bag.beanId === selectedBean.id);
    main.innerHTML = breadcrumbs(selectedBean) + heading('BEAN COLLECTION', selectedBean.name, selectedBean.roaster || '나만의 원두 컬렉션', `<a class="button secondary" href="#records">추출 기록</a><button class="button" data-action="recipe" data-id="${escape(selectedBean.id)}" ${disabled()}>＋ 레시피 추가</button>${refresh}`)
      + `<dl class="summary">${[['원산지 · 농장', selectedBean.origin], ['품종', selectedBean.variety], ['가공 방식', selectedBean.process]].map(([label, value]) => `<div><dt>${label}</dt><dd>${escape(value || '미입력')}</dd></div>`).join('')}</dl>`
      + (selectedBean.tastingNotes ? `<div class="note"><strong>로스터리 향미 노트</strong><br>${escape(selectedBean.tastingNotes)}</div>` : '')
      + `<div class="section-heading"><h2>원두 봉지</h2><button class="button small secondary" data-action="bag" data-id="${escape(selectedBean.id)}" ${disabled()}>＋ 봉지 추가</button></div><div class="bag-list">${bags.length ? bags.map(bag => `<div class="bag">${escape(bag.name)}<span>로스팅 ${displayDate(bag.roastedOn)}</span></div>`).join('') : '<p class="muted">구매한 봉지별로 로스팅 날짜를 따로 남길 수 있어요.</p>'}</div>`
      + `<div class="section-heading"><h2>이 원두의 추출 기록 <span class="muted">${records.length}</span></h2></div>`
      + (records.length ? records.map(renderRecord).join('') : '<div class="empty"><h2>아직 추출 기록이 없어요</h2><p>원두와 공용 레시피를 선택해 한 잔을 남겨보세요.</p></div>');
  } else {
    main.innerHTML = heading('YOUR COFFEE COLLECTION', '원두 보관함', '좋아하는 원두와 한 잔의 경험을 모아보세요.', `<a class="button secondary" href="#records">추출 기록</a><button class="button secondary" data-action="recipe" ${disabled()}>레시피 작성</button><button class="button" data-action="bean">＋ 원두 추가</button>${refresh}`)
      + (data.beans.length ? `<div class="grid">${data.beans.map(beanCard).join('')}</div>` : `<div class="empty"><div class="empty-art" aria-hidden="true">◡</div><p class="eyebrow">A NEW CHAPTER, A NEW CUP</p><h2>첫 번째 원두를 기다리고 있어요</h2><p>원두 하나, 레시피 하나에서 시작하는 나의 커피 노트.<br>마음에 든 한 잔을 오래 기억해보세요.</p><div class="actions"><button class="button" data-action="bean">＋ 첫 원두 추가하기</button>${!connected && !demo ? '<button class="button secondary" data-action="connect">노션 연결하기</button>' : ''}</div>${!connected && !demo ? '<button class="demo-link" data-action="demo">저장 없이 체험해보기</button>' : ''}</div>`)
      + `<div class="section-heading"><h2>공용 레시피 <span class="muted">${data.recipes.length}</span></h2></div>`
      + (data.recipes.length ? `<div class="grid">${data.recipes.map(recipeCard).join('')}</div>` : '<p class="muted">원두와 독립된 레시피를 등록해 여러 원두에 사용할 수 있어요.</p>');
  }
}

function field(name, label, value = '', { type = 'text', required = false, full = false, placeholder = '', min, max, step } = {}) {
  const attributes = `${required ? 'required' : ''} ${min !== undefined ? `min="${min}"` : ''} ${max !== undefined ? `max="${max}"` : ''} ${step !== undefined ? `step="${step}"` : ''}`;
  return `<label class="field ${full ? 'full' : ''}">${escape(label)}${required ? ' *' : ''}<input name="${name}" type="${type}" value="${escape(value)}" ${attributes} placeholder="${escape(placeholder)}"></label>`;
}

function textArea(name, label, value = '') {
  return `<label class="field full">${escape(label)}<textarea name="${name}">${escape(value)}</textarea></label>`;
}

function openDialog(title, content) {
  lastFocused = document.activeElement;
  document.querySelector('#dialog-title').textContent = title;
  dialogContent.innerHTML = content;
  dialog.showModal();
  dialogContent.querySelector('input,button,textarea,select')?.focus();
}

function closeDialog() {
  if (saving) return;
  dialog.close();
}

dialog.addEventListener('cancel', event => { if (saving) event.preventDefault(); });
// Clearing this content also removes any typed connection token from the DOM.
dialog.addEventListener('close', () => { dialogContent.innerHTML = ''; lastFocused?.focus(); });
document.querySelector('#close-dialog').addEventListener('click', closeDialog);
document.querySelector('#connect-button').addEventListener('click', openConnection);

function formShell(content, label = '저장하기') {
  return `<form>${content}<p class="form-error" role="alert" hidden></p><div class="form-footer"><button type="button" class="button secondary" data-cancel>취소</button><button type="submit" class="button">${label}</button></div></form>`;
}

function openConnection() {
  openDialog('노션 연결', formShell(`<p class="form-help">노션 통합의 토큰을 입력해 주세요. 토큰은 이 서버의 메모리에서만 사용되며 브라우저와 파일에 저장되지 않습니다. 서버를 다시 시작하면 재입력이 필요합니다.</p><p class="form-help"><a href="https://www.notion.so/profile/integrations" target="_blank" rel="noreferrer">Notion 통합 설정 ↗</a>에서 통합을 만들고, 본인의 커피 레시피 북 페이지의 연결 메뉴에서 해당 통합을 추가해 주세요. 하위 5개 데이터베이스에 읽기·쓰기 권한이 필요합니다.</p><label class="field">통합 토큰 *<input type="password" name="token" required autocomplete="off" spellcheck="false" placeholder="노션 통합 토큰"></label><p class="form-help">로그인 설정이 아닙니다. 이 컴퓨터에서 실행하는 앱과 노션을 연결합니다.</p>`, '연결 확인하기'));
  bindForm(async values => {
    const tokenInput = dialogContent.querySelector('[name="token"]');
    const token = values.token;
    tokenInput.value = '';
    await api('/api/connect', { token });
    connected = true;
    demo = false;
    stale = false;
    data = emptyData();
    location.hash = '';
    await loadData({ quiet: true });
  }, '5개 노션 데이터베이스 접근을 확인했습니다.');
}

function bindForm(onSubmit, successMessage, buildPayload = values => values) {
  const form = dialogContent.querySelector('form');
  const submitButton = form.querySelector('[type="submit"]');
  const submissionKeys = createSubmissionKeys();
  form.querySelector('[data-cancel]').addEventListener('click', closeDialog);
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (saving) return;
    const errorBox = form.querySelector('.form-error');
    errorBox.hidden = true;
    const values = Object.fromEntries(new FormData(form));
    const payload = buildPayload(values);
    // Connection tokens never enter the form's saved payload fingerprint.
    const submissionKey = Object.hasOwn(payload, 'token') ? undefined : submissionKeys.forPayload(payload);
    const oldLabel = submitButton.textContent;
    const controls = [...form.querySelectorAll('input,textarea,select,button')];
    saving = true;
    document.querySelector('#close-dialog').disabled = true;
    controls.forEach(control => { control.disabled = true; });
    submitButton.textContent = '확인하고 저장하는 중…';
    try {
      await onSubmit(payload, submissionKey);
      saving = false;
      dialog.close();
      updateConnection();
      render();
      if (stale) return;
      showNotice(demo ? '체험 모드에 반영했습니다. 노션에 저장되지 않으며 새로고침하면 사라집니다.' : successMessage);
    } catch (error) {
      errorBox.textContent = error.message;
      errorBox.hidden = false;
      errorBox.scrollIntoView({ block: 'nearest' });
    } finally {
      saving = false;
      document.querySelector('#close-dialog').disabled = false;
      controls.forEach(control => { control.disabled = false; });
      submitButton.textContent = oldLabel;
    }
  });
}

async function saveData(kind, payload, key) {
  if (demo) {
    let item;
    if (kind === 'beans') item = validateBean(payload);
    if (kind === 'bags') item = validateBag(payload);
    if (kind === 'recipes') item = validateRecipe(payload);
    if (kind === 'records') {
      const recipe = data.recipes.find(item => item.id === payload.recipeId);
      const bean = data.beans.find(item => item.id === payload.beanId);
      const bag = data.bags.find(item => item.id === payload.bagId);
      item = { ...validateRecord(payload, recipe, bean, bag), snapshot: createSnapshot(bean, recipe) };
    }
    item.id = crypto.randomUUID();
    data[kind].push(item);
    return item;
  }
  const item = await api('/api/' + kind, payload, key);
  // Do not turn a successful write into an ambiguous save failure if refresh fails.
  await loadData({ quiet: true });
  return item;
}

function openBean() {
  if (!connected && !demo) return openConnection();
  if (!canSave()) return showNotice('먼저 다시 불러오기로 연결을 확인해 주세요.', true);
  openDialog('새로운 원두', formShell(`<p class="form-help">원두 이름만으로 시작할 수 있어요. 알고 있는 정보는 함께 남겨주세요.</p><div class="fields">${field('name', '원두 이름', '', { required: true, full: true, placeholder: '예: 에티오피아 시다마' })}${field('roaster', '로스터리')}${field('origin', '원산지 · 농장')}${field('variety', '품종')}${field('process', '가공 방식')}${textArea('tastingNotes', '로스터리 향미 노트')}</div>`));
  bindForm(async (values, key) => {
    const bean = await saveData('beans', values, key);
    location.hash = beanLink(bean.id);
  }, '원두를 노션에 저장했습니다.');
}

function openBag(beanId) {
  openDialog('원두 봉지 추가', formShell(`${field('name', '봉지 이름', '', { required: true, placeholder: '예: 10월에 산 봉지' })}${field('roastedOn', '로스팅 날짜 (선택)', '', { type: 'date' })}<p class="form-help">같은 원두를 다시 구매했다면 봉지만 새로 추가해 주세요.</p>`));
  bindForm((payload, key) => saveData('bags', payload, key), '원두 봉지를 노션에 저장했습니다.', values => ({ ...values, beanId }));
}

function stepEditor(step, index) {
  return `<div class="step-editor">${field('stepName', '단계 이름', step.name || `${index + 1}단계`)}${field('stepTime', '누적 시간', formatTime(step.seconds ?? 0), { required: true, placeholder: '0:30' })}${field('stepWater', '추가 물 (g)', step.water ?? '', { type: 'number', min: 0.1, step: 'any', required: true })}<button class="icon-button remove-step" type="button" aria-label="${index + 1}단계 삭제">×</button></div>`;
}

function readSteps() {
  return [...dialogContent.querySelectorAll('.step-editor')].map(row => ({ name: row.querySelector('[name="stepName"]').value, time: row.querySelector('[name="stepTime"]').value, water: row.querySelector('[name="stepWater"]').value }));
}

function updateStepsPreview() {
  const preview = dialogContent.querySelector('.step-preview');
  if (!preview) return;
  try {
    const steps = calculateSteps(readSteps());
    const total = Number(dialogContent.querySelector('[name="totalWater"]').value);
    preview.textContent = steps.map(step => `${step.name} · ${formatTime(step.seconds)} / 간격 ${step.interval}초 / +${step.water}g / 누적 ${step.cumulativeWater}g`).join('\n') + `\n합계 ${steps.at(-1).cumulativeWater}g${total === steps.at(-1).cumulativeWater ? ' · 총 물 양과 일치' : ` · 총 물 양 ${total || '?'}g와 맞춰 주세요`}`;
  } catch (error) {
    preview.textContent = error.message;
  }
}

function openRecipe(beanId, source) {
  const recipe = source ? copyRecipe(source) : { name: '', dripper: '', dose: 15, temperature: 93, totalWater: 250, steps: [{ name: '뜸 들이기', seconds: 0, water: 50 }, { name: '1차 붓기', seconds: 30, water: 100 }, { name: '2차 붓기', seconds: 70, water: 100 }] };
  if (source) recipe.name += ' 복사';
  openDialog(source ? '레시피 복사해서 저장' : '새로운 레시피', formShell(`<p class="form-help">${source ? '원본과 과거 기록은 그대로 두고 새로운 레시피로 저장합니다.' : '수량과 단계는 시작을 위한 예시값입니다. 실제 추출 방법에 맞게 바꿔 주세요.'}</p><div class="fields">${field('name', '레시피 이름', recipe.name, { required: true, full: true })}${field('dripper', '드리퍼', recipe.dripper)}${field('dose', '원두 사용량 (g)', recipe.dose, { type: 'number', required: true, min: 0.1, step: 'any' })}${field('temperature', '물 온도 (℃)', recipe.temperature, { type: 'number', required: true, min: 0.1, max: 100, step: 'any' })}${field('totalWater', '총 물 양 (g)', recipe.totalWater, { type: 'number', required: true, min: 0.1, step: 'any' })}${field('grind', '분쇄도 메모', recipe.grind, { placeholder: '예: 중간 굵기' })}${field('grinder', '그라인더 이름', recipe.grinder)}${field('grinderSetting', '그라인더 설정값', recipe.grinderSetting)}${field('microns', '분쇄 입자 굵기 (μm · 선택)', recipe.microns, { type: 'number', min: 0.1, step: 'any', placeholder: '직접 입력' })}</div><p class="form-help"><a href="https://community.unspecialty.com/compass/grinder" target="_blank" rel="noreferrer">언스페셜티 분쇄도 가이드 ↗</a>를 참고해 μm 값을 직접 입력할 수 있어요.</p><div class="step-heading"><h3>물 붓기 단계</h3><button type="button" class="button small secondary" id="add-step">＋ 단계 추가</button></div><div id="step-editors">${recipe.steps.map(stepEditor).join('')}</div><div class="step-preview" aria-live="polite"></div>`));
  dialogContent.querySelector('#add-step').addEventListener('click', () => {
    const rows = readSteps();
    let seconds = 0;
    try { seconds = calculateSteps(rows).at(-1).seconds + 30; } catch { seconds = rows.length * 30; }
    dialogContent.querySelector('#step-editors').insertAdjacentHTML('beforeend', stepEditor({ seconds }, rows.length));
    updateStepsPreview();
  });
  dialogContent.addEventListener('click', removeStep);
  dialogContent.querySelector('form').addEventListener('input', updateStepsPreview);
  updateStepsPreview();
  bindForm(
    (payload, key) => saveData('recipes', payload, key),
    '레시피와 모든 물 붓기 단계를 노션에 저장했습니다.',
    values => {
      const { stepName, stepTime, stepWater, ...conditions } = values;
      return { ...conditions, steps: readSteps(), ...(source ? { copyFromId: source.id } : {}) };
    },
  );
}

function removeStep(event) {
  const button = event.target.closest('.remove-step');
  if (!button) return;
  button.closest('.step-editor').remove();
  updateStepsPreview();
}

function openRecord(recipe) {
  const beanOptions = data.beans.map(bean => `<option value="${escape(bean.id)}">${escape(bean.name)}</option>`).join('');
  const recipeOptions = data.recipes.map(item => `<option value="${escape(item.id)}" ${item.id === recipe?.id ? 'selected' : ''}>${escape(item.name)}</option>`).join('');
  openDialog('한 잔의 기록', formShell(`<p class="form-help">원두와 공용 레시피를 선택합니다. 당시 원두 정보와 전체 레시피 단계가 함께 보존됩니다.</p><label class="field">원두 *<select name="beanId" required><option value="">원두를 선택해 주세요.</option>${beanOptions}</select></label><label class="field">레시피 *<select name="recipeId" required><option value="">레시피를 선택해 주세요.</option>${recipeOptions}</select></label>${field('date', '추출 날짜', today(), { type: 'date', required: true })}<fieldset><legend>전체 만족도 * (1~5점)</legend><div class="rating-options">${[1, 2, 3, 4, 5].map(rating => `<label><input name="rating" type="radio" value="${rating}" required>${rating} <span class="stars" aria-hidden="true">★</span></label>`).join('')}</div></fieldset><label class="field">사용한 원두 봉지 (선택)<select name="bagId"><option value="">원두 봉지를 선택하지 않음</option></select></label>${textArea('cupNote', '컵노트 (선택)')}`));
  const beanSelect = dialogContent.querySelector('[name="beanId"]');
  beanSelect.addEventListener('change', () => {
    const bagSelect = dialogContent.querySelector('[name="bagId"]');
    const selected = bagSelect.value;
    const bags = data.bags.filter(bag => bag.beanId === beanSelect.value);
    bagSelect.innerHTML = '<option value="">원두 봉지를 선택하지 않음</option>' + bags.map(bag => `<option value="${escape(bag.id)}">${escape(bag.name)}${bag.roastedOn ? ' · ' + escape(bag.roastedOn) : ''}</option>`).join('');
    if (bags.some(bag => bag.id === selected)) bagSelect.value = selected;
  });
  bindForm((payload, key) => saveData('records', payload, key), '추출 기록과 당시 원두·레시피를 노션에 저장했습니다.');
}

function startDemo() {
  demo = true;
  stale = false;
  data = emptyData();
  data.beans.push({ id: 'demo-bean', name: '에티오피아 시다마', roaster: '체험용 로스터리', origin: '에티오피아', variety: 'Heirloom', process: '워시드', tastingNotes: '체험용 예시 · 재스민, 레몬, 홍차' });
  const recipe = validateRecipe({ name: '맑고 산뜻한 아침', dripper: 'V60', dose: 15, temperature: 93, totalWater: 250, microns: 950, grind: '중간 굵기', steps: [{ name: '뜸 들이기', time: '0:00', water: 50 }, { name: '1차 붓기', time: '0:30', water: 100 }, { name: '2차 붓기', time: '1:10', water: 100 }] });
  recipe.id = 'demo-recipe';
  data.recipes.push(recipe);
  showNotice('체험 · 노션에 저장되지 않음. 예시 데이터와 입력 내용은 이 탭의 메모리에만 있으며 새로고침하면 사라집니다.');
  updateConnection();
  render();
}

main.addEventListener('click', event => {
  const button = event.target.closest('[data-action]');
  if (!button || button.disabled) return;
  const action = button.dataset.action;
  const id = button.dataset.id;
  if (action === 'connect') return openConnection();
  if (action === 'reload') return loadData();
  if (action === 'demo') return startDemo();
  if (action === 'bean') return openBean();
  if (!canSave()) return showNotice('연결을 확인하고 다시 시도해 주세요.', true);
  if (action === 'bag') return openBag(id);
  if (action === 'recipe') return openRecipe(null);
  const recipe = data.recipes.find(item => item.id === id);
  if (action === 'copy' && recipe) return openRecipe(null, recipe);
  if (action === 'record') return openRecord(recipe ?? null);
});

main.addEventListener('change', event => {
  if (!event.target.matches('[data-record-filter]')) return;
  const beanId = main.querySelector('[data-record-filter="beanId"]')?.value ?? '';
  const recipeId = main.querySelector('[data-record-filter="recipeId"]')?.value ?? '';
  const records = data.records.filter(record => (!beanId || record.beanId === beanId) && (!recipeId || record.recipeId === recipeId))
    .sort((a, b) => String(b.date ?? '').localeCompare(String(a.date ?? '')));
  const list = main.querySelector('[data-record-list]');
  if (!list) return;
  list.innerHTML = records.length ? records.map(renderRecord).join('') : '<div class="empty"><h2>선택한 조건에 맞는 기록이 없어요</h2><p>원두 또는 레시피 필터를 바꿔보세요.</p></div>';
});

window.addEventListener('hashchange', () => { render(); main.focus({ preventScroll: true }); });
try {
  const status = await api('/api/status');
  connected = status.connected;
  if (status.error) showNotice(status.error, true);
  if (connected) await loadData();
} catch (error) {
  showNotice(error.message || '서버 연결을 확인해 주세요.', true);
}
updateConnection();
render();
