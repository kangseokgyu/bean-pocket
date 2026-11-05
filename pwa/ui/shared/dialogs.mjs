import { make } from './dom.mjs';

export const showNativeDialog = dialog => {
  if (typeof dialog.showModal === 'function') dialog.showModal();
  else dialog.open = true;
};

export function makeEntryDialog(document, kind, form, open) {
  const dialog = make(document, 'dialog', undefined, 'entry-dialog');
  dialog.id = `${kind}-entry-dialog`;
  dialog.dataset.entryDialog = kind;
  dialog.dataset.open = String(open);
  dialog.setAttribute('aria-modal', 'true');
  dialog.setAttribute('aria-labelledby', `${kind}-form-title`);
  dialog.append(form);
  return dialog;
}
