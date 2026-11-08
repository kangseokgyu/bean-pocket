import { addStep, recipePayload, renumberSteps, setSteps, updatePreview } from '../forms/recipe-form.mjs';
import { addBrewStage, brewPayload, recipeFromRecord, updateBrewConditions } from '../screens/brew.mjs';
import { localDate } from '../shared/date.mjs';
import { formatTime, parseInputTime } from '../shared/recipe-presentation.mjs';
import { routePath, routeParams } from '../shared/route.mjs';
import { closeSearchPicker, openSearchPicker, selectSearchOption, syncSearchPickerTrigger } from './search-picker.mjs';

const FORM_KINDS = new Set(['beans', 'recipes', 'records', 'brews']);
const WHEEL_STEP_DISTANCE = 100;
const WHEEL_PAUSE_MS = 250;

function readWheelValue(input) {
  if (input.type === 'number' && !input.validity?.badInput) {
    return {
      value: Number(input.value),
      step: input.name === 'rating' ? Number(input.step) : 1,
      min: String(input.min ?? '') === '' ? -Infinity : Number(input.min),
      max: String(input.max ?? '') === '' ? Infinity : Number(input.max),
      format: String,
    };
  }
  if (input.name === 'time') {
    const value = input.value === '' ? 0 : parseInputTime(input.value);
    if (value !== null) return { value, step: 1, min: 0, max: Number.MAX_SAFE_INTEGER, format: formatTime };
  }
  if ((input.name === 'grind' || input.name === 'grinderSetting' || input.name === 'microns') &&
      /^-?(?:\d+(?:\.\d+)?|\.\d+)$/.test(input.value)) {
    return { value: Number(input.value), step: 1, min: -Infinity, max: Infinity, format: String };
  }
  return null;
}

function bindFineNumberWheel(content, document) {
  let distance = 0;
  let lastEventTime = 0;
  content.addEventListener('focusin', () => { distance = 0; });
  content.addEventListener('wheel', event => {
    const input = event.target;
    if (input !== document.activeElement || !input.matches('input') || !FORM_KINDS.has(input.form?.dataset.form) ||
      input.disabled || input.readOnly || !event.cancelable || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    const mode = event.deltaMode;
    const { deltaX, deltaY } = event;
    if (!deltaY || Math.abs(deltaX) >= Math.abs(deltaY)) return;
    const settings = readWheelValue(input);
    if (!settings || !Number.isFinite(settings.value)) return;

    event.preventDefault();
    const pixels = deltaY * (mode === 1 ? 34 : mode === 2 ? WHEEL_STEP_DISTANCE : 1);
    if (event.timeStamp - lastEventTime > WHEEL_PAUSE_MS || Math.sign(pixels) !== Math.sign(distance)) distance = 0;
    lastEventTime = event.timeStamp;
    distance += pixels;
    if (Math.abs(distance) < WHEEL_STEP_DISTANCE) return;
    const direction = -Math.sign(distance);
    distance = 0;

    const { value, step, min, max, format } = settings;
    const adjusted = value + direction * step;
    const next = Math.max(min, Math.min(max, Number.isInteger(adjusted) ? adjusted : Number(adjusted.toPrecision(15))));
    if (next === value && input.value !== '') return;
    input.value = format(next);
    const EventConstructor = document.defaultView?.Event ?? globalThis.Event;
    input.dispatchEvent(new EventConstructor('input', { bubbles: true }));
  }, { passive: false });
}

export function bindEvents({ page, nav, connectionForm, tokenInput, scheduleTokenValidation,
  resetTokenValidation, originalConnectionCheck, sourceFields, content, actions, document, view,
  openDeleteDialog, closeDeleteDialog, submitDelete, setInsightRecipeFilter, setInsightRatingFilter,
  setInsightComparisonSort, setInsightCompareLeft, setInsightCompareRight }) {
  bindFineNumberWheel(content, document);
  connectionForm.addEventListener('input', event => {
    if (event.target === tokenInput && !event.target.disabled) {
      const rawToken = String(tokenInput.value ?? '');
      const token = rawToken.trim();
      const pasted = event.inputType === 'insertFromPaste';
      if (pasted && rawToken !== token) tokenInput.value = token;
      resetTokenValidation();
      scheduleTokenValidation(token);
    }
    if (!event.target.disabled) actions.setDirty(true, 'connection');
  });
  connectionForm.addEventListener('submit', async event => {
    event.preventDefault();
    const form = event.currentTarget;
    if (form.querySelector('button[type="submit"]')?.disabled || form.elements.token.disabled) return;
    const formData = new FormData(form);
    if (!view.beginConnectionSave()) return;
    try {
      await actions.connect({
        token: formData.get('token'),
        dataSources: Object.fromEntries(sourceFields.map(([key]) => [key, formData.get(key)])),
      });
    } catch { /* Safe status text is supplied by the controller. */ }
    finally { view.finishConnectionSave(); }
  });

  globalThis.window?.addEventListener?.('hashchange', () => view.renderRoute(globalThis.window.location.hash.slice(1)));

  const optionSearchTimers = new Map();
  const loadOptions = (target, kind, query = '', cursor = null, append = false) => {
    void actions.loadSearchOptions?.(kind, query, cursor, target, append);
  };
  const scheduleOptionSearch = search => {
    const { optionSearchKind: kind, optionTarget: targetName } = search.dataset;
    const key = `${targetName}:${kind}`;
    const searchRoute = view.currentRoute();
    const query = search.value;
    search.dataset.optionLoaded = 'false';
    view.setSearchOptionsState?.(targetName, kind, { status: 'loading', query });
    clearTimeout(optionSearchTimers.get(key));
    const timer = setTimeout(() => {
      if (optionSearchTimers.get(key) !== timer) return;
      optionSearchTimers.delete(key);
      if (view.currentRoute() === searchRoute) loadOptions(targetName, kind, query);
    }, 250);
    optionSearchTimers.set(key, timer);
  };
  const openPicker = picker => {
    const state = actions.getState?.() ?? {};
    if (!picker || state.pending || state.frozen || state.unresolved) return;
    openSearchPicker(picker, content);
  };
  const formDirtyKey = form => form?.dataset.editId
    ? `recipe-edit:${form.dataset.editId}` : form?.dataset.form;
  const updateRecordFilters = () => {
    if (!windowData) return;
    const beanId = content.querySelector('[data-record-filter="beanId"]')?.value ?? '';
    const recipeId = content.querySelector('[data-record-filter="recipeId"]')?.value ?? '';
    const reset = content.querySelector('[data-action="clear-record-filters"]');
    if (reset) reset.disabled = !beanId && !recipeId;
    const update = actions.setRecordFilters?.({ beanId, recipeId });
    if (update?.catch) void update.catch(() => {});
  };
  const navigateTo = (next, replaceCurrent = null) => {
    const currentWindow = globalThis.window;
    if (!currentWindow?.location) { view.renderRoute(next); return; }
    if (replaceCurrent && currentWindow.history?.replaceState) {
      const base = `${currentWindow.location.pathname ?? ''}${currentWindow.location.search ?? ''}`;
      currentWindow.history.replaceState(null, '', `${base}#${replaceCurrent}`);
    }
    currentWindow.location.hash = next;
  };

  const handleClick = async event => {
    const openDialog = event.target.closest?.('[data-option-picker]');
    if (openDialog && event.target === openDialog) {
      closeSearchPicker(openDialog.closest('[data-search-picker]'));
      return;
    }
    const target = event.target.closest('[data-action]');
    const action = target?.dataset.action;
    if (!action || target.disabled) return;
    if (action === 'favorite-item') {
      const state = actions.getState?.() ?? {};
      if (state.pending || state.frozen || state.unresolved) return;
      const id = target.dataset.id;
      const kind = target.dataset.kind;
      const restoreFocus = document.activeElement === target;
      try { await actions.submit(kind === 'beans' ? 'favorite-bean' : 'favorite-recipe', { id, favorite: target.dataset.favorite !== 'true' }); }
      catch { /* Controller supplies the safe status message. */ }
      if (restoreFocus) {
        const replacement = Array.from(content.querySelectorAll('[data-action="favorite-item"]')).find(item => item.dataset.id === id);
        (replacement ?? content.querySelector('[data-action="favorite-item"]') ?? page).focus?.();
      }
      return;
    }
    if (action === 'select-insight-bean') {
      const beanId = target.dataset.beanId;
      const currentBean = Array.from(content.querySelectorAll('[data-action="select-insight-bean"]'))
        .find(card => card.getAttribute('aria-pressed') === 'true');
      if (currentBean?.dataset.beanId !== beanId) setInsightRecipeFilter('');
      const update = actions.setRecordInsightsBean?.(beanId);
      if (update?.catch) void update.catch(() => {});
      const selected = Array.from(content.querySelectorAll('[data-action="select-insight-bean"]'))
        .find(card => card.dataset.beanId === beanId);
      selected?.focus?.();
      return;
    }
    if (action === 'replay-record') {
      const recordId = target.dataset.recordId;
      if (recordId) navigateTo(`/brew/run?recordId=${encodeURIComponent(recordId)}`);
      return;
    }
    if (action === 'save-shared-recipe') {
      const record = recordFromDisplayedData(windowData ?? {}, target.dataset.recordId);
      const recipe = actualRecipeForSharedLibrary(record);
      if (!recipe || typeof actions.submit !== 'function') return;
      target.disabled = true;
      try {
        const result = await actions.submit('recipes', recipe);
        if (result?.status === 'succeeded') {
          view.showStatus({ type: 'saved', message: '기록 당시 실제 조건으로 공용 레시피를 저장했습니다.' });
        }
      } catch {
        // Controller status reports whether the independent recipe write failed or needs recovery.
      } finally {
        if (target.isConnected !== false && target.dataset.state !== 'success') target.disabled = false;
      }
      return;
    }
    if (action === 'set-best-record') {
      if (typeof actions.submit !== 'function') return;
      target.disabled = true;
      try {
        const result = await actions.submit('set-best-record', {
          beanId: target.dataset.beanId, recordId: target.dataset.recordId,
        });
        if (result?.status === 'succeeded') {
          view.showStatus({ type: 'saved', message: '이 추출을 사용자 베스트로 지정했습니다.' });
        }
      } catch {
        // The controller supplies a fixed message for unsupported, invalid, and uncertain writes.
      } finally {
        if (target.isConnected !== false) target.disabled = false;
      }
      return;
    }
    if (action === 'open-search-picker') {
      openPicker(target.closest('[data-search-picker]'));
      return;
    }
    if (action === 'close-search-picker') {
      closeSearchPicker(target.closest('[data-search-picker]'));
      return;
    }
    if (action === 'select-search-option') {
      const select = selectSearchOption(target, windowData);
      if (!select) return;
      const form = select.form;
      if (FORM_KINDS.has(form?.dataset.form)) actions.setDirty(true, form.dataset.form);
      if (select.matches('[data-record-filter]')) updateRecordFilters();
      return;
    }
    if (action === 'clear-option-search') {
      const picker = target.closest('[data-search-picker]');
      const search = picker?.querySelector('[data-option-search-kind]');
      if (!search) return;
      search.value = '';
      view.setSearchOptionsState?.(search.dataset.optionTarget, search.dataset.optionSearchKind,
        { status: 'loading', query: '' });
      search.focus?.();
      loadOptions(search.dataset.optionTarget, search.dataset.optionSearchKind, '');
      return;
    }
    if (action === 'retry-search-options') {
      const picker = target.closest('[data-search-picker]');
      const search = picker?.querySelector('[data-option-search-kind]');
      if (search) loadOptions(search.dataset.optionTarget, search.dataset.optionSearchKind, search.value);
      return;
    }
    if (action === 'register-search-option') {
      const picker = target.closest('[data-search-picker]');
      const kind = target.dataset.optionKind;
      if (!picker || !['beans', 'recipes'].includes(kind)) return;
      closeSearchPicker(picker);
      navigateTo(kind === 'beans' ? '/beans' : '/recipes');
      return;
    }
    if (action === 'clear-brew-search' || action === 'browse-all-brew-options') {
      const pane = target.closest('.brew-flow-pane');
      const search = pane?.querySelector('[data-option-search-kind]');
      if (!search) return;
      const { optionSearchKind: kind, optionTarget: targetName } = search.dataset;
      const key = `${targetName}:${kind}`;
      clearTimeout(optionSearchTimers.get(key));
      optionSearchTimers.delete(key);
      delete search.dataset.optionComposing;
      search.value = '';
      search.dataset.optionLoaded = 'false';
      const clearSearch = pane.querySelector('[data-action="clear-brew-search"]');
      if (clearSearch) clearSearch.hidden = true;
      const currentRoute = view.currentRoute?.() ?? '';
      const params = routeParams(currentRoute);
      if (params.has('q')) {
        params.delete('q');
        const nextQuery = params.toString();
        navigateTo(`${routePath(currentRoute)}${nextQuery ? `?${nextQuery}` : ''}`);
        return;
      }
      loadOptions(targetName, kind, '');
      search.dataset.optionLoaded = 'true';
      search.focus?.();
      return;
    }
    if (action === 'clear-record-filters') {
      for (const select of content.querySelectorAll('[data-record-filter]')) {
        select.value = '';
        syncSearchPickerTrigger(select.closest('[data-search-picker]'), windowData);
      }
      target.disabled = true;
      updateRecordFilters();
      return;
    }
    if (action === 'cancel-delete') {
      if (closeDeleteDialog() === 'cancelled') view.showStatus({ type: 'cancelled', message: '삭제를 취소했습니다.' });
      return;
    }
    if (action === 'confirm-delete') {
      await submitDelete();
      return;
    }
    if (action === 'edit-connection') {
      view.editConnection();
      return;
    }
    if (action === 'retry-initialize') {
      try { await actions.initialize(); } catch { /* Safe status text is supplied by the controller. */ }
      return;
    }
    if (action === 'navigate' || action === 'back-to-beans' || action === 'back-to-recipes') {
      navigateTo(target.dataset.route);
      return;
    }
    if (action === 'resume-record-draft') {
      navigateTo(view.resolveRecordDraft());
      return;
    }
    if (action === 'start-new-record') {
      view.resolveRecordDraft(true);
      return;
    }
    if (action === 'start-brew') {
      navigateTo('/brew/bean');
      return;
    }
    if (action === 'select-brew-bean') {
      const beanId = target.dataset.beanId;
      if (!beanId) return;
      navigateTo(`/brew/recipe?beanId=${encodeURIComponent(beanId)}`,
        `/brew/bean?selectedBeanId=${encodeURIComponent(beanId)}`);
      return;
    }
    if (action === 'select-brew-recipe') {
      const { beanId, recipeId } = target.dataset;
      if (!beanId || !recipeId) return;
      navigateTo(`/brew/run?beanId=${encodeURIComponent(beanId)}&recipeId=${encodeURIComponent(recipeId)}`,
        `/brew/recipe?beanId=${encodeURIComponent(beanId)}&selectedRecipeId=${encodeURIComponent(recipeId)}`);
      return;
    }
    if (action === 'complete-brew') {
      const { beanId, recipeId } = target.dataset;
      if (!beanId || !recipeId) return;
      navigateTo(`/records/new?beanId=${encodeURIComponent(beanId)}&recipeId=${encodeURIComponent(recipeId)}&date=${localDate()}`);
      return;
    }
    if (action === 'add-brew-stage') {
      const form = target.form;
      const stages = form?.querySelector('[data-brew-stages]');
      if (!form || !stages) return;
      const lastTime = parseInputTime(stages.lastElementChild?.querySelector('[name="time"]')?.value ?? '') ?? 0;
      const row = addBrewStage(document, stages, { name: '', seconds: lastTime + 30, water: 10 }, stages.children.length);
      updateBrewConditions(form);
      actions.setDirty(true, 'brews');
      row.querySelector('[name="stepName"]')?.focus();
      return;
    }
    if (action === 'remove-brew-stage') {
      const row = target.closest('.brew-stage-row');
      const form = target.form;
      if (!row || !form || row.querySelector('[name="time"]') === form.querySelector('.brew-stage-row [name="time"]')) return;
      const restoreFocus = document.activeElement === target;
      const removedIndex = [...form.querySelectorAll('.brew-stage-row')].indexOf(row);
      row.remove();
      const remainingRows = [...form.querySelectorAll('.brew-stage-row')];
      remainingRows.forEach((stage, index) => {
        stage.querySelector('legend').textContent = `단계 ${index + 1}`;
        const remove = stage.querySelector('[data-action="remove-brew-stage"]');
        remove.disabled = index === 0;
        remove.dataset.actionDisabled = String(index === 0);
        remove.setAttribute('aria-label', `단계 ${index + 1} 제거`);
      });
      updateBrewConditions(form);
      actions.setDirty(true, 'brews');
      if (restoreFocus) remainingRows[Math.min(removedIndex, remainingRows.length - 1)]
        ?.querySelector('[name="stepName"]')?.focus();
      return;
    }
    if (action === 'cancel-connection') {
      if (view.cancelConnection()) view.showStatus({ type: 'cancelled', message: '연결 입력을 취소했습니다.' });
      return;
    }
    if (['delete-bean', 'delete-recipe', 'delete-record'].includes(action)) {
      const state = actions.getState?.() ?? {};
      if (target.disabled || state.pending || state.frozen || state.unresolved) return;
      openDeleteDialog(target, action);
      return;
    }
    if (action === 'show-bean-form') {
      view.showBeanForm();
      return;
    }
    if (action === 'show-recipe-form') {
      view.showRecipeForm();
      return;
    }
    if (action === 'show-record-form') {
      view.showRecordForm();
      loadOptions('form', 'beans');
      loadOptions('form', 'recipes');
      return;
    }
    if (action === 'load-more') {
      try { await actions.loadMore?.(); } catch { /* Controller supplies a safe status. */ }
      return;
    }
    if (action === 'load-more-insights') {
      try { await actions.loadMoreInsights?.(); } catch { /* The insight section supplies its own retry state. */ }
      return;
    }
    if (action === 'more-options') {
      const { optionTarget: targetName, optionKind: kind } = target.dataset;
      const picker = target.closest('.form-field') ?? target.closest('.brew-flow-pane');
      const search = picker?.querySelector('[data-option-search-kind]');
      const select = picker?.querySelector('select');
      loadOptions(targetName, kind, search?.value ?? '', target.dataset.nextCursor || select?.dataset.nextCursor || null, true);
      return;
    }
    if (action === 'cancel-form') {
      const form = target.closest('form');
      const kind = form?.dataset.form;
      const editId = form?.dataset.editId;
      const dirtyKey = formDirtyKey(form);
      const state = actions.getState?.() ?? {};
      if (state.pending || state.frozen || target.closest('dialog')?.dataset.saveState === 'success') return;
      if (kind && FORM_KINDS.has(kind)) {
        if (editId && actions.isDirty?.(dirtyKey)) {
          const discard = await view.confirmDiscardEdit?.();
          if (!discard) return;
        }
        view.clearDraft(kind, editId);
        actions.setDirty(false, dirtyKey);
        view.showStatus({ type: 'cancelled', message: '입력을 취소했습니다.' });
        if (editId) navigateTo(`/recipes/${encodeURIComponent(editId)}`);
        else if (kind === 'brews') navigateTo('/records');
      }
      return;
    }
    if (action === 'new-record') {
      const recipeId = target.dataset.id;
      const form = navigateAndGetForm(view, content, '/records/new', 'records');
      if (form) {
        const option = document.createElement('option');
        const recipe = windowData?.recipes.find(item => item.id === recipeId);
        option.value = recipeId;
        option.textContent = recipe?.name ?? '선택한 레시피';
        if (!Array.from(form.elements.recipeId.options).some(item => item.value === recipeId)) form.elements.recipeId.append(option);
        form.elements.recipeId.value = recipeId;
        syncSearchPickerTrigger(form.elements.recipeId.closest('[data-search-picker]'), windowData);
        actions.setDirty(true, 'records');
      }
      return;
    }
    if (action === 'edit-recipe') {
      const recipe = windowData?.recipes.find(item => item.id === target.dataset.id);
      if (!recipe || !Array.isArray(recipe.steps) || recipe.status === 'error' || recipe.validationStatus === 'error') return;
      navigateTo(`/recipes/${encodeURIComponent(recipe.id)}/edit`);
      return;
    }
    if (action === 'confirm-connection') {
      if (!originalConnectionCheck.querySelector('input[name="originalConfirmed"]')?.checked) {
        view.showStatus({ type: 'resolution-required', message: '원본 연결 파일을 직접 확인한 뒤 복구를 진행해 주세요.' });
        return;
      }
      try { await actions.confirmCurrent(true); } catch { /* Controller uses a fixed safe message. */ }
      return;
    }
    if (action === 'add-step') {
      const row = addStep(content, document);
      updatePreview(content);
      actions.setDirty(true, formDirtyKey(target.closest('form')));
      row?.querySelector('[name="stepName"]')?.focus();
      return;
    }
    if (action === 'remove-step') {
      const form = target.closest('form');
      const row = target.closest('.step-row');
      const restoreFocus = document.activeElement === target;
      const removedIndex = [...form.querySelectorAll('.step-row')].indexOf(row);
      row?.remove();
      renumberSteps(content);
      updatePreview(content);
      actions.setDirty(true, formDirtyKey(form));
      if (restoreFocus) {
        const remainingRows = [...form.querySelectorAll('.step-row')];
        const nextRow = remainingRows[Math.min(removedIndex, remainingRows.length - 1)];
        (nextRow?.querySelector('[name="stepName"]') ?? form.querySelector('[data-action="add-step"]'))?.focus();
      }
      return;
    }
    if (action === 'copy-recipe') {
      const source = windowData?.recipes.find(item => item.id === target.dataset.id);
      if (!source) return;
      const form = navigateAndGetForm(view, content, '/recipes/new', 'recipes');
      if (!form) return;
      for (const key of ['name', 'dripper', 'dose', 'grind', 'grinder', 'grinderSetting', 'extractionGuide', 'microns', 'temperature', 'totalWater']) {
        if (form.elements[key]) form.elements[key].value = source[key] ?? '';
      }
      form.elements.name.value = `${source.name} 복사`;
      form.dataset.copyId = source.id;
      setSteps(form, source.steps);
      actions.setDirty(true, 'recipes');
    }
  };
  page.addEventListener('click', handleClick);
  if (nav.parentElement !== page) nav.addEventListener('click', handleClick);

  content.addEventListener('compositionstart', event => {
    const search = event.target;
    if (!search.matches('[data-option-search-kind]') || search.dataset.optionTarget !== 'brew') return;
    search.dataset.optionComposing = 'true';
    const key = `${search.dataset.optionTarget}:${search.dataset.optionSearchKind}`;
    clearTimeout(optionSearchTimers.get(key));
    optionSearchTimers.delete(key);
  });
  content.addEventListener('compositionend', event => {
    const search = event.target;
    if (!search.matches('[data-option-search-kind]') || search.dataset.optionTarget !== 'brew') return;
    delete search.dataset.optionComposing;
    if (!search.disabled) scheduleOptionSearch(search);
  });
  content.addEventListener('input', event => {
    if (event.target.disabled) return;
    if (event.target.matches('[data-option-search-kind]')) {
      const { optionSearchKind: kind, optionTarget: targetName } = event.target.dataset;
      if (targetName === 'brew') {
        const clearSearch = event.target.parentElement?.querySelector('[data-action="clear-brew-search"]');
        if (clearSearch) clearSearch.hidden = !event.target.value;
        if (event.isComposing || event.target.dataset.optionComposing === 'true') {
          event.target.dataset.optionLoaded = 'false';
          return;
        }
      }
      scheduleOptionSearch(event.target);
      return;
    }
    const form = event.target.form;
    if (FORM_KINDS.has(form?.dataset.form)) actions.setDirty(true, formDirtyKey(form));
    if (form?.dataset.form === 'brews') updateBrewConditions(form);
    updatePreview(content);
    event.target.removeAttribute('aria-invalid');
  });
  content.addEventListener('change', event => {
    if (event.target.disabled) return;
    if (event.target.matches('[data-record-filter]')) updateRecordFilters();
    if (event.target.matches('[data-insight-recipe-filter]')) setInsightRecipeFilter(event.target.value);
    if (event.target.matches('[data-insight-rating-filter]')) {
      setInsightRatingFilter(event.target.value);
    }
    if (event.target.matches('[data-insight-comparison-sort]')) {
      setInsightComparisonSort(event.target.value);
    }
    if (event.target.matches('[data-insight-compare-left]')) setInsightCompareLeft(event.target.value);
    if (event.target.matches('[data-insight-compare-right]')) setInsightCompareRight(event.target.value);
    updatePreview(content);
  });
  content.addEventListener('focusin', event => {
    const select = event.target.closest('[data-option-select-kind]');
    const search = event.target.closest('[data-option-search-kind]');
    const control = search ?? select;
    if (!control || control.dataset.optionLoaded === 'true') return;
    loadOptions(control.dataset.optionTarget, control.dataset.optionSearchKind ?? control.dataset.optionSelectKind,
      search?.value ?? '');
  });
  content.addEventListener('submit', async event => {
    const form = event.target;
    const kind = form.dataset.form;
    if (!FORM_KINDS.has(kind)) return;
    event.preventDefault();
    const state = actions.getState?.() ?? {};
    if (state.pending || state.frozen || state.unresolved || form.closest('dialog')?.dataset.saveState === 'success') return;
    if (kind === 'records') {
      const missingName = [['beanId', '원두'], ['recipeId', '레시피']]
        .find(([name]) => !form.elements[name]?.value);
      if (missingName) {
        const picker = Array.from(form.querySelectorAll('[data-search-picker]'))
          .find(item => item.dataset.optionKind === (missingName[0] === 'beanId' ? 'beans' : 'recipes'));
        view.showStatus({ type: 'validation-error', message: `${missingName[1]}를 선택해 주세요.` });
        openPicker(picker);
        return;
      }
    }
    clearInvalidFields(form);
    let payload;
    try {
      payload = kind === 'recipes' ? recipePayload(form)
        : kind === 'brews' ? brewPayload(form) : Object.fromEntries(new FormData(form));
    } catch {
      view.showStatus({ type: 'validation-error', message: '입력값이나 최신 원본 관계를 확인해 주세요.' });
      return;
    }
    try {
      if (kind === 'recipes' && form.dataset.editId) {
        let baseline;
        try { baseline = JSON.parse(form.dataset.editBaseline); }
        catch { throw new Error('edit-baseline-unavailable'); }
        const result = await actions.submit('edit-recipe', {
          recipeId: form.dataset.editId, baseline, changes: payload,
        });
        if (result?.status === 'succeeded') navigateTo(`/recipes/${encodeURIComponent(form.dataset.editId)}`);
      } else if (kind === 'recipes' && form.dataset.copyId) {
        await actions.submit('copy', { recipeId: form.dataset.copyId, changes: payload });
      } else {
        const result = await actions.submit(kind, payload);
        if (kind === 'brews' && result?.status === 'succeeded') {
          const sourceRecordId = payload.sourceRecordId;
          const newRecordId = result.value?.id;
          const pair = sourceRecordId && newRecordId
            ? `?compareSourceRecordId=${encodeURIComponent(sourceRecordId)}&compareRecordId=${encodeURIComponent(newRecordId)}` : '';
          navigateTo(`/records${pair}`);
        }
      }
    } catch {
      // Controller status is the single user-facing report for a failed operation.
    }
  });
  page.addEventListener('invalid', event => {
    const field = event.target;
    if (field?.form) {
      markInvalidField(field.form, field);
      view.showStatus({ type: 'validation-error', message: '필수 입력과 입력 범위를 확인해 주세요.' });
    }
  }, true);

  let windowData = null;
  const originalRender = view.renderData;
  view.renderData = data => {
    windowData = data;
    originalRender(data);
  };
}

function recordFromDisplayedData(data, recordId) {
  return (data.records ?? []).find(record => record.id === recordId) ??
    (data.beans ?? []).find(bean => bean.bestRecord?.id === recordId)?.bestRecord ?? null;
}

function actualRecipeForSharedLibrary(record) {
  const recipe = recipeFromRecord(record);
  if (!recipe || !Array.isArray(recipe.steps) || !recipe.steps.length) return null;
  return {
    name: recipe.name, dripper: recipe.dripper, dose: recipe.dose, grind: recipe.grind,
    grinder: recipe.grinder, grinderSetting: recipe.grinderSetting, microns: recipe.microns,
    temperature: recipe.temperature, totalWater: recipe.totalWater, extractionGuide: recipe.extractionGuide,
    steps: recipe.steps.map(step => ({ name: step.name, seconds: step.seconds ?? step.time, water: step.water })),
  };
}

function navigateAndGetForm(view, content, nextRoute, kind) {
  if (globalThis.window?.location) globalThis.window.location.hash = nextRoute;
  view.renderRoute(nextRoute);
  return content.querySelector(`form[data-form="${kind}"]`);
}

function clearInvalidFields(form) {
  form.querySelectorAll('[aria-invalid="true"]').forEach(item => item.removeAttribute('aria-invalid'));
}

function markInvalidField(form, field) {
  clearInvalidFields(form);
  const target = field || form.querySelector('[required]:invalid') || form.querySelector('input,select,textarea');
  target?.setAttribute('aria-invalid', 'true');
}
