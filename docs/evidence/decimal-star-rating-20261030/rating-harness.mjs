import { createAppView } from '/pwa/ui/view.mjs';

const beanId = '11111111-1111-4111-8111-111111111111';
const recipeId = '33333333-3333-4333-8333-333333333333';
const bean = { id: beanId, name: '브라우저 검증 원두' };
const recipe = { id: recipeId, name: '브라우저 검증 레시피', dripper: 'V60', dose: 15,
  temperature: 93, totalWater: 250, steps: [], stats: { count: 0, average: null } };
const view = createAppView(document);
view.renderData({ beans: [bean], recipes: [recipe], records: [],
  options: { beans: { items: [bean], status: 'ready' }, recipes: { items: [recipe], status: 'ready' } },
  screen: { route: '/records/new', complete: true, hasMore: false, connectionRevision: 'browser-test' } });
view.bind({ setDirty(value) { window.__pwaDirty = value; } });
window.__pwaView = view;
window.__pwaRoute = `/records/new?beanId=${beanId}&recipeId=${recipeId}&date=2026-10-30`;
view.renderRoute(window.__pwaRoute);
