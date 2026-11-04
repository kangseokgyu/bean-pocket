import { createAppView } from '/pwa/ui/view.mjs';
import { buildRecordsInsights } from '/pwa/ui/records-insights.mjs';
import { createActualSnapshot, validateRecipe } from '/lib/domain.mjs';

const ids = {
  bean: '11111111-1111-4111-8111-111111111111',
  recipe: '33333333-3333-4333-8333-333333333333',
  earlier: '66666666-6666-4666-8666-666666666666',
  source: '77777777-7777-4777-8777-777777777777',
  result: '88888888-8888-4888-8888-888888888888',
};

const bean = { id: ids.bean, name: '브라우저 검증 원두', origin: '시다마', tastingNotes: '복숭아, 자두',
  bestRecordStatus: 'none', bestRecordId: null, bestRecordIds: [] };
const recipe = { id: ids.recipe, beanId: ids.bean, name: 'V60 기본', dripper: 'V60', dose: 15,
  grind: '중간', grinder: 'C40', grinderSetting: '24', microns: 700, temperature: 93, totalWater: 250,
  extractionGuide: '처음 단계는 0초에 붓기 시작',
  steps: [{ name: '뜸', seconds: 0, water: 50 }, { name: '첫 붓기', seconds: 35, water: 100 },
    { name: '마무리', seconds: 80, water: 100 }] };

function record(id, date, rating, cupNote, actualRecipe, sourceRecordId = null) {
  return { id, beanId: ids.bean, beanResolution: 'relation', recipeId: ids.recipe, date, rating, cupNote,
    snapshotStatus: 'valid', invalidFields: [], snapshot: createActualSnapshot(bean, actualRecipe, ids.recipe, sourceRecordId) };
}

const earlier = record(ids.earlier, '2026-11-01', 4.9, '레몬, 차', { ...recipe, dose: 16,
  steps: [{ name: '뜸', seconds: 0, water: 50 }, { name: '첫 붓기', seconds: 30, water: 100 },
    { name: '마무리', seconds: 75, water: 100 }] });
const source = record(ids.source, '2026-11-02', 4.1, '자두', recipe);
const records = [earlier, source];
const recipes = [recipe];
const view = createAppView(document);

function buildData(route = view.currentRoute()) {
  const recordInsights = { ...buildRecordsInsights(records, [bean], ids.bean, recipes), status: 'ready', loading: false };
  return { beans: [bean], recipes, records, bags: [], recordInsights,
    options: { beans: { items: [bean], status: 'ready', hasMore: false },
      recipes: { items: recipes, status: 'ready', hasMore: false } },
    screen: { route, complete: true, hasMore: false, connectionRevision: 'browser-fixture' } };
}

function refresh() {
  view.renderData(buildData());
}

view.renderData(buildData('/brew/run?recordId=' + ids.source));
view.bind({
  getState() { return { pending: false, frozen: false, unresolved: false }; },
  setDirty() {},
  async submit(kind, payload) {
    if (kind === 'brews') {
      const actualRecipe = validateRecipe(payload.actualRecipe);
      const saved = record(ids.result, payload.date, Number(payload.rating), payload.cupNote,
        actualRecipe, payload.sourceRecordId);
      records.push(saved);
      window.__flowSavedRecord = saved;
      refresh();
      return { status: 'succeeded', value: { id: saved.id } };
    }
    if (kind === 'set-best-record') {
      if (payload.beanId !== ids.bean) return { status: 'failed' };
      const selected = records.find(item => item.id === payload.recordId);
      if (!selected) return { status: 'failed' };
      bean.bestRecordId = selected.id;
      bean.bestRecordIds = [selected.id];
      bean.bestRecordStatus = 'ready';
      bean.bestRecord = selected;
      refresh();
      window.__flowBestRecord = selected;
      return { status: 'succeeded', value: { id: bean.id } };
    }
    if (kind === 'recipes') {
      const shared = validateRecipe(payload);
      window.__flowSharedRecipe = shared;
      recipes.push({ ...shared, id: '99999999-9999-4999-8999-999999999999', beanId: ids.bean,
        stats: { count: 0, average: null } });
      refresh();
      return { status: 'succeeded', value: { id: recipes.at(-1).id } };
    }
    return { status: 'failed' };
  },
});

view.renderRoute(`/brew/run?recordId=${ids.source}&date=2026-11-04`);
window.__flowIds = ids;
window.__flowView = view;
