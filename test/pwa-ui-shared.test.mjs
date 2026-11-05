import test from 'node:test';
import assert from 'node:assert/strict';
import { make, makeSpinner } from '../pwa/ui/shared/dom.mjs';
import { actionIcon, navigationIcon, decorativeSvg } from '../pwa/ui/shared/icons.mjs';
import { button, actionButton, setActionButton, iconButton, trashButton } from '../pwa/ui/shared/buttons.mjs';
import { label, addFieldset, formBase, addFormActions } from '../pwa/ui/shared/form-fields.mjs';
import { showNativeDialog, makeEntryDialog } from '../pwa/ui/shared/dialogs.mjs';

class TestElement {
  constructor(tagName, ownerDocument, namespaceURI = null) {
    this.tagName = tagName;
    this.ownerDocument = ownerDocument;
    this.namespaceURI = namespaceURI;
    this.children = [];
    this.dataset = {};
    this.attributes = new Map();
    this.text = '';
  }
  append(...nodes) {
    for (const node of nodes) {
      node.parentElement = this;
      this.children.push(node);
    }
  }
  replaceChildren(...nodes) {
    this.children = [];
    this.append(...nodes);
  }
  set textContent(value) {
    this.text = String(value);
    this.children = [];
  }
  get textContent() { return this.text + this.children.map(node => node.textContent).join(''); }
  setAttribute(name, value) {
    this.attributes.set(name, String(value));
    if (name === 'class') this.className = String(value);
  }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
  querySelector(selector) {
    const matches = node => {
      if (selector.startsWith('.')) return String(node.className ?? '').split(/\s+/).includes(selector.slice(1));
      const data = selector.match(/^\[data-([a-z-]+)\]$/);
      if (!data) return false;
      const key = data[1].replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
      return Object.hasOwn(node.dataset, key);
    };
    const visit = node => {
      for (const child of node.children) {
        if (matches(child)) return child;
        const found = visit(child);
        if (found) return found;
      }
      return null;
    };
    return visit(this);
  }
}

function createDocument() {
  return {
    createElement(tagName) { return new TestElement(tagName, this); },
    createElementNS(namespaceURI, tagName) { return new TestElement(tagName, this, namespaceURI); },
  };
}

test('shared DOM helper creates text nodes with the requested class', () => {
  const node = make(createDocument(), 'p', '<plain text>', 'notice');
  assert.equal(node.tagName, 'p');
  assert.equal(node.textContent, '<plain text>');
  assert.equal(node.className, 'notice');
});

test('shared SVG helpers preserve local icon paths and decorative markers', () => {
  const document = createDocument();
  const check = actionIcon(document, 'check');
  assert.equal(check.namespaceURI, 'http://www.w3.org/2000/svg');
  assert.equal(check.getAttribute('aria-hidden'), 'true');
  assert.equal(check.children[0].getAttribute('d'), 'M4 12l5 5 11-11');
  assert.equal(check.children[0].getAttribute('pathLength'), '1');

  const navigation = navigationIcon(document, 'beans');
  assert.equal(navigation.className, 'nav-icon');
  assert.equal(navigation.getAttribute('focusable'), 'false');

  const decorative = decorativeSvg(document, '0 0 24 24', 'decorative', ['M0', { d: 'M1', marker: 'favorite' }]);
  assert.equal(decorative.children[1].getAttribute('data-favorite'), '');
});

test('shared buttons preserve action selectors and accessible progress states', () => {
  const document = createDocument();
  const plain = button(document, '다음', 'button', 'continue', 'primary');
  assert.equal(plain.dataset.action, 'continue');
  assert.equal(plain.className, 'button button--primary');

  const save = actionButton(document, '저장', 'submit', 'save', 'save-bean');
  assert.equal(save.dataset.action, 'save-bean');
  assert.equal(save.getAttribute('aria-busy'), 'false');
  setActionButton(save, '저장 완료', 'success');
  assert.equal(save.dataset.state, 'success');
  assert.equal(save.getAttribute('aria-busy'), 'false');
  assert.equal(save.querySelector('[data-action-label]').textContent, '저장 완료');
  assert.equal(save.querySelector('.button-icon').dataset.icon, 'check');

  const icon = iconButton(document, '+', '새 원두 추가', 'show-bean-form');
  assert.equal(icon.getAttribute('aria-label'), '새 원두 추가');
  const trash = trashButton(document, 'beans', 'bean-1', '원두 이름');
  assert.equal(trash.dataset.action, 'delete-bean');
  assert.equal(trash.dataset.id, 'bean-1');
  assert.equal(trash.getAttribute('aria-label'), '원두 이름 삭제');
  assert.equal(trash.children[0].children[0].getAttribute('d'), 'M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7');
});

test('shared form helpers preserve field names, labels, fieldsets, and action controls', () => {
  const document = createDocument();
  const field = label(document, '안내', 'guide', 'textarea', false, { rows: 3 });
  assert.equal(field.tagName, 'label');
  assert.equal(field.children[0].textContent, '안내');
  assert.equal(field.children[1].tagName, 'textarea');
  assert.equal(field.children[1].name, 'guide');
  assert.equal(field.children[1].rows, 3);

  const group = make(document, 'div');
  addFieldset(document, group, '원두 정보', [['이름', 'name', 'text', true]]);
  assert.equal(group.children[0].tagName, 'fieldset');
  assert.equal(group.children[0].children[0].textContent, '원두 정보');

  const form = formBase(document, 'beans', '새 원두');
  assert.equal(form.dataset.form, 'beans');
  assert.equal(form.children[0].id, 'beans-form-title');
  addFormActions(document, form);
  assert.deepEqual(form.children[1].children.map(node => node.dataset.action), ['cancel-form', undefined]);
  assert.equal(form.children[1].children[1].dataset.entrySubmit, '');
});

test('shared dialog helpers retain entry dialog semantics and native fallback', () => {
  const document = createDocument();
  const form = formBase(document, 'records', '새 기록');
  const dialog = makeEntryDialog(document, 'records', form, true);
  assert.equal(dialog.id, 'records-entry-dialog');
  assert.equal(dialog.dataset.entryDialog, 'records');
  assert.equal(dialog.dataset.open, 'true');
  assert.equal(dialog.getAttribute('aria-modal'), 'true');
  assert.equal(dialog.getAttribute('aria-labelledby'), 'records-form-title');

  let shown = 0;
  showNativeDialog({ showModal() { shown++; } });
  assert.equal(shown, 1);
  const fallback = { open: false };
  showNativeDialog(fallback);
  assert.equal(fallback.open, true);
});

test('pull refresh spinner keeps twelve decorative spokes', () => {
  const spinner = makeSpinner(createDocument());
  assert.equal(spinner.className, 'pull-refresh-spinner');
  assert.equal(spinner.getAttribute('aria-hidden'), 'true');
  assert.equal(spinner.children.length, 12);
  assert.ok(spinner.children.every(spoke => spoke.getAttribute('style')?.includes('rotate(')));
});
