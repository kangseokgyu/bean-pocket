import { createAppView } from '/pwa/ui/view.mjs';
const beans = [
  { id: '11111111-1111-4111-8111-111111111111', name: '에티오피아 구지', roaster: '프릳츠', origin: '에티오피아', process: '내추럴', tastingNotes: '블루베리 · 자스민 · 초콜릿', favorite: true },
  { id: '22222222-2222-4222-8222-222222222222', name: '콜롬비아 핑크 버번', roaster: '센터커피', origin: '콜롬비아', process: '워시드', tastingNotes: '복숭아 · 오렌지 · 꿀', favorite: false },
];
const recipes = [
  { id: '33333333-3333-4333-8333-333333333333', name: '매일 아침 V60', dripper: 'V60', dose: 15, temperature: 93, totalWater: 250, steps: [], stats: { count: 0, average: null }, favorite: true },
  { id: '44444444-4444-4444-8444-444444444444', name: '아이스 하리오', dripper: 'V60', dose: 20, temperature: 92, totalWater: 180, steps: [], stats: { count: 0, average: null }, favorite: false },
];
const view = createAppView(document);
const data = { beans, recipes, records: [], favoriteSupport: { beans: true, recipes: true }, screen: { route: '/beans', complete: true, hasMore: false, connectionRevision: 'preview' } };
function render() {
  for (const items of [beans, recipes]) items.sort((a, b) => Number(b.favorite) - Number(a.favorite) || a.name.localeCompare(b.name, 'ko'));
  view.renderData(data);
}
view.bind({ getState: () => ({}), async submit(kind, payload) {
  const items = kind === 'favorite-bean' ? beans : recipes;
  items.find(item => item.id === payload.id).favorite = payload.favorite;
  render();
} });
render();
view.renderRoute(location.hash.slice(1) || '/beans');
window.preview = { view, data, render };
