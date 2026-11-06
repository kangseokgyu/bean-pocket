import { button } from './buttons.mjs';
import { decorativeSvg } from './icons.mjs';

export function favoriteIcon(document) {
  return decorativeSvg(document, '0 0 24 24', 'favorite-icon', ['M12 2.5 14.9 8.4 21.4 9.3 16.7 13.9 17.8 20.4 12 17.3 6.2 20.4 7.3 13.9 2.6 9.3 9.1 8.4 12 2.5Z']);
}

export function favoriteButton(document, data, kind, item) {
  const control = button(document, undefined, 'button', 'favorite-item', 'utility');
  control.className = 'button icon-button entity-favorite';
  control.dataset.kind = kind;
  control.dataset.id = item.id;
  control.dataset.favorite = String(item.favorite === true);
  control.setAttribute('aria-pressed', String(item.favorite === true));
  control.setAttribute('aria-label', `${item.name} 즐겨찾기 ${item.favorite ? '해제' : '추가'}`);
  control.disabled = data.favoriteSupport?.[kind] === false;
  control.append(favoriteIcon(document));
  return control;
}
