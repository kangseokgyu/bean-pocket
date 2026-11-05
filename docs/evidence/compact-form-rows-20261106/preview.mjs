import { createAppView } from '/pwa/ui/view.mjs';

const beans = [{
  id: '11111111-1111-4111-8111-111111111111',
  name: '에티오피아 구지 내추럴',
  roaster: '프릳츠 커피 컴퍼니',
  origin: '에티오피아 구지 함벨라',
  variety: '74110 · 헤어룸',
  process: '무산소 내추럴',
  tastingNotes: '블루베리 · 자스민 · 다크초콜릿 · 긴 여운',
  favorite: false,
}];
const recipes = [{
  id: '22222222-2222-4222-8222-222222222222',
  name: '매일 아침 V60',
  dripper: 'V60',
  dose: 15,
  grind: '중간보다 약간 곱게',
  grinder: '코만단테 C40',
  grinderSetting: '24 clicks',
  microns: '',
  temperature: 93,
  totalWater: 250,
  steps: [],
  stats: { count: 0, average: null },
  favorite: false,
}];
const optionPage = items => ({ items, nextCursor: '', query: '' });
const data = {
  beans,
  recipes,
  records: [],
  options: { beans: optionPage(beans), recipes: optionPage(recipes) },
  favoriteSupport: { beans: true, recipes: true },
  screen: { route: '/beans', complete: true, hasMore: false, connectionRevision: 'preview' },
};
const view = createAppView(document);
view.bind({ getState: () => ({ pending: false, frozen: false, unresolved: false }), setDirty() {}, async submit() {} });
view.setState({ connectionRevision: 'preview' });
view.showConnection({ connected: true });
view.renderData(data);
view.renderRoute('/beans');
view.finishStartup();
window.preview = { view, data };
document.documentElement.dataset.previewReady = 'true';
