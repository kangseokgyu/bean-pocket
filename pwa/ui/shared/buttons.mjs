import { make } from './dom.mjs';
import { actionIcon, trashIcon } from './icons.mjs';

export const button = (document, text, type = 'submit', action, variant = 'secondary') => {
  const back = variant === 'back';
  const node = make(document, 'button', back ? undefined : text, `button button--${variant}`);
  node.type = type;
  if (action) node.dataset.action = action;
  if (back) {
    node.setAttribute('aria-label', text);
    const arrow = make(document, 'span', '←', 'back-arrow');
    arrow.setAttribute('aria-hidden', 'true');
    node.append(arrow);
  }
  return node;
};

export function actionButton(document, text, type, icon, action) {
  const node = button(document, '', type, action);
  node.className = `button action-button action-${icon === 'x' ? 'cancel' : 'save'}`;
  const iconNode = make(document, 'span', undefined, 'button-icon');
  iconNode.dataset.icon = icon;
  iconNode.dataset.state = 'idle';
  iconNode.setAttribute('aria-hidden', 'true');
  iconNode.append(actionIcon(document, icon));
  const labelNode = make(document, 'span', text, 'button-label');
  labelNode.dataset.actionLabel = '';
  node.append(iconNode, labelNode);
  node.dataset.state = 'idle';
  node.setAttribute('aria-busy', 'false');
  return node;
}

export function setActionButton(buttonNode, text, state, icon = state === 'success' ? 'check' : 'save') {
  const labelNode = buttonNode.querySelector('[data-action-label]');
  if (labelNode) labelNode.textContent = text;
  buttonNode.dataset.state = state;
  buttonNode.setAttribute('aria-busy', String(state === 'saving'));
  const iconNode = buttonNode.querySelector('.button-icon');
  if (!iconNode) return;
  iconNode.dataset.state = state;
  if (iconNode.dataset.icon !== icon) {
    iconNode.dataset.icon = icon;
    iconNode.replaceChildren(actionIcon(buttonNode.ownerDocument, icon));
  }
}

export const iconButton = (document, icon, title, action) => {
  const node = button(document, '', 'button', action);
  node.className = 'button icon-button';
  node.setAttribute('aria-label', title);
  node.title = title;
  const glyph = make(document, 'span', icon);
  glyph.setAttribute('aria-hidden', 'true');
  node.append(glyph);
  return node;
};

export function trashButton(document, kind, id, name) {
  const action = { beans: 'delete-bean', recipes: 'delete-recipe', records: 'delete-record' }[kind];
  const remove = iconButton(document, '', `${name} 삭제`, action);
  remove.className += ' entity-delete';
  remove.dataset.id = id;
  remove.dataset.name = name;
  remove.replaceChildren(trashIcon(document));
  return remove;
}
