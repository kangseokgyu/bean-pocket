import { button } from '../shared/buttons.mjs';
import { make } from '../shared/dom.mjs';
import { decorativeSvg } from '../shared/icons.mjs';

export function renderHome(pane, document) {
  pane.className = 'list-view home-view';
  const hero = make(document, 'section', undefined, 'home-hero');
  hero.setAttribute('aria-labelledby', 'home-hero-title');
  const content = make(document, 'div', undefined, 'home-hero-content');
  const eyebrow = make(document, 'p', undefined, 'home-hero-eyebrow');
  eyebrow.append(make(document, 'span', 'GOOD COFFEE'), make(document, 'span', 'BRIGHTER DAYS'));
  const title = make(document, 'h1', '오늘의 한 잔을 시작해 보세요.');
  title.id = 'home-hero-title';
  content.append(eyebrow, title,
    make(document, 'p', '좋아하는 원두로, 나만의 방식으로. 기록할수록 더 맛있는 커피가 됩니다.', 'home-hero-copy'));
  const start = button(document, '추출 시작', 'button', 'start-brew', 'primary');
  start.className = 'button button--primary primary-button home-start-button';
  start.textContent = '';
  start.append(
    decorativeSvg(document, '0 0 24 24', 'home-start-cup', [
      'M3 7h14v7a5 5 0 0 1-5 5H8a5 5 0 0 1-5-5V7Zm14 2h2a3 3 0 1 1 0 6h-3M3 22h18',
    ]),
    make(document, 'span', '추출 시작'),
    decorativeSvg(document, '0 0 24 24', 'home-start-arrow', ['M5 12h13m-6-6 6 6-6 6']),
  );
  content.append(start);
  const artwork = make(document, 'img', undefined, 'home-hero-art');
  artwork.setAttribute('src', './icons/home-brew.png');
  artwork.setAttribute('alt', '');
  artwork.setAttribute('width', '1254');
  artwork.setAttribute('height', '1254');
  artwork.alt = '';
  artwork.dataset.heroArt = 'true';
  artwork.setAttribute('aria-hidden', 'true');
  hero.append(content, artwork);
  pane.append(hero);
}
