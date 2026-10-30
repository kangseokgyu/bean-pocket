import { isValidRating } from '../domain.mjs';

let nextRatingControlId = 0;

function emitRatingInput(input) {
  const EventConstructor = input.ownerDocument.defaultView?.Event ?? globalThis.Event;
  input.dispatchEvent(new EventConstructor('input', { bubbles: true }));
}

export function createStarRating(document, { label = '별점' } = {}) {
  const id = ++nextRatingControlId;
  const group = document.createElement('fieldset');
  group.className = 'star-rating';
  const legend = document.createElement('legend');
  legend.className = 'form-field-label';
  legend.textContent = `${label} (0.1~5.0점)`;

  const options = document.createElement('div');
  options.className = 'rating-options';
  const input = document.createElement('input');
  input.type = 'number';
  input.name = 'rating';
  input.className = 'rating-slider-input';
  input.id = `star-rating-${id}`;
  input.min = '0.1';
  input.max = '5';
  input.step = '0.1';
  input.required = true;
  input.inputMode = 'none';
  input.setAttribute('role', 'slider');
  input.setAttribute('aria-label', '별점 (0.1~5.0점)');
  input.setAttribute('aria-valuemin', '0.1');
  input.setAttribute('aria-valuemax', '5');
  input.setAttribute('aria-valuestep', '0.1');
  input.setAttribute('aria-orientation', 'horizontal');
  input.setAttribute('aria-valuetext', '미입력');
  input.setAttribute('autocomplete', 'off');

  const fillRects = [];
  for (let index = 0; index < 5; index += 1) {
    const option = document.createElement('span');
    option.className = 'rating-option';
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', 'm12 3 2.78 5.63L21 9.54l-4.5 4.39 1.06 6.2L12 17.2l-5.56 2.93 1.06-6.2L3 9.54l6.22-.91Z');
    path.setAttribute('class', 'rating-star-outline');
    const fill = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    fill.setAttribute('d', 'm12 3 2.78 5.63L21 9.54l-4.5 4.39 1.06 6.2L12 17.2l-5.56 2.93 1.06-6.2L3 9.54l6.22-.91Z');
    fill.setAttribute('class', 'rating-star-fill');
    const clip = document.createElementNS('http://www.w3.org/2000/svg', 'clipPath');
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    const clipId = `star-rating-${id}-fill-${index}`;
    clip.setAttribute('id', clipId);
    clip.setAttribute('clipPathUnits', 'userSpaceOnUse');
    rect.setAttribute('x', '3');
    rect.setAttribute('y', '0');
    rect.setAttribute('width', '0');
    rect.setAttribute('height', '24');
    rect.setAttribute('class', 'rating-fill-rect');
    clip.append(rect);
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    defs.append(clip);
    fill.setAttribute('clip-path', `url(#${clipId})`);
    svg.append(defs, path, fill);
    option.append(svg);
    options.append(option);
    fillRects.push(rect);
  }
  options.append(input);

  const valueRow = document.createElement('div');
  valueRow.className = 'rating-value-row';
  const output = document.createElement('output');
  output.className = 'rating-value';
  output.dataset.ratingOutput = '';
  output.setAttribute('aria-live', 'polite');
  output.setAttribute('for', input.id);
  output.textContent = '미입력';
  const clear = document.createElement('button');
  clear.type = 'button';
  clear.className = 'rating-clear';
  clear.textContent = '지우기';
  clear.setAttribute('aria-label', '별점 비우기');
  clear.disabled = true;
  valueRow.append(output, clear);
  group.append(legend, options, valueRow);

  function updatePresentation() {
    const rating = input.value === '' ? null : Number(input.value);
    const valid = isValidRating(rating);
    const labelText = valid ? `${rating.toFixed(1)}점` : '미입력';
    output.textContent = labelText;
    input.setAttribute('aria-valuetext', labelText);
    if (valid) input.setAttribute('aria-valuenow', rating.toFixed(1));
    else input.removeAttribute('aria-valuenow');
    clear.disabled = !valid;
    for (const [index, rect] of fillRects.entries()) {
      const fraction = valid ? Math.max(0, Math.min(1, rating - index)) : 0;
      rect.setAttribute('width', String(Math.round(fraction * 180) / 10));
    }
  }

  function changeValue(value) {
    if (input.disabled || input.value === value) return;
    input.value = value;
    emitRatingInput(input);
  }

  let activePointerId = null;
  function updateFromPointer(event) {
    const bounds = input.getBoundingClientRect();
    if (bounds.width <= 0) return;
    const fraction = Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width));
    const tenths = Math.round(fraction * 49) + 1;
    changeValue((tenths / 10).toFixed(1));
  }

  function releasePointer(pointerId) {
    if (activePointerId !== pointerId) return;
    activePointerId = null;
    try {
      if (input.hasPointerCapture(pointerId)) input.releasePointerCapture(pointerId);
    } catch {
      activePointerId = null;
    }
  }

  input.addEventListener('input', updatePresentation);
  input.addEventListener('pointerdown', event => {
    if (input.disabled || activePointerId !== null || event.button !== undefined && event.button !== 0) return;
    input.focus({ preventScroll: true });
    try {
      input.setPointerCapture(event.pointerId);
    } catch {
      return;
    }
    activePointerId = event.pointerId;
    updateFromPointer(event);
    event.preventDefault();
  });
  input.addEventListener('pointermove', event => {
    if (event.pointerId !== activePointerId) return;
    if (input.disabled) return releasePointer(event.pointerId);
    updateFromPointer(event);
  });
  input.addEventListener('pointerup', event => {
    if (event.pointerId !== activePointerId) return;
    updateFromPointer(event);
    releasePointer(event.pointerId);
  });
  input.addEventListener('pointercancel', event => releasePointer(event.pointerId));
  input.addEventListener('lostpointercapture', event => {
    if (event.pointerId === activePointerId) activePointerId = null;
  });
  input.addEventListener('keydown', event => {
    if (input.disabled) return;
    const current = input.value === '' ? null : Number(input.value);
    let next;
    if (event.key === 'ArrowRight' || event.key === 'ArrowUp') next = Math.min(50, Math.round((current ?? 0) * 10 + 1)) / 10;
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') next = Math.max(1, Math.round((current ?? 0.2) * 10 - 1)) / 10;
    else if (event.key === 'Home') next = 0.1;
    else if (event.key === 'End') next = 5;
    else if (event.key === 'Delete' || event.key === 'Backspace') next = null;
    else return;
    changeValue(next === null ? '' : next.toFixed(1));
    event.preventDefault();
  });
  clear.addEventListener('click', () => {
    changeValue('');
    input.focus({ preventScroll: true });
  });

  return group;
}
