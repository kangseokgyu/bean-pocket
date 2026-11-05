import { make } from './dom.mjs';
import { actionButton } from './buttons.mjs';

export const label = (document, title, name, type = 'text', required = false, attrs = {}) => {
  const wrap = make(document, 'label', undefined, 'form-field');
  wrap.append(make(document, 'span', title, 'form-field-label'));
  const input = make(document, type === 'textarea' ? 'textarea' : type === 'select' ? 'select' : 'input');
  input.name = name;
  if (type !== 'textarea' && type !== 'select') input.type = type;
  input.required = required;
  for (const [key, value] of Object.entries(attrs)) input[key] = value;
  wrap.append(input);
  return wrap;
};

export function addFieldset(document, parent, title, fields, className = '') {
  const set = make(document, 'fieldset', undefined, `form-fieldset ${className}`.trim());
  set.append(make(document, 'legend', title));
  for (const field of fields) set.append(label(document, ...field));
  parent.append(set);
}

export function formBase(document, kind, title) {
  const form = make(document, 'form', undefined, 'form-grid');
  form.dataset.form = kind;
  const heading = make(document, 'h2', title);
  heading.id = `${kind}-form-title`;
  form.append(heading);
  return form;
}

export function addFormActions(document, form) {
  const actions = make(document, 'div', undefined, 'form-actions');
  const cancel = actionButton(document, '취소', 'button', 'x', 'cancel-form');
  const submit = actionButton(document, '저장', 'submit', 'save');
  submit.dataset.entrySubmit = '';
  submit.dataset.idleLabel = '저장';
  actions.append(cancel, submit);
  form.append(actions);
}
