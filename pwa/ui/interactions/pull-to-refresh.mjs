import { make, makeSpinner } from '../shared/dom.mjs';

export function bindPullToRefresh({ page, document, actions }) {
  const surface = document.documentElement ?? page;
  const pullContent = document.querySelector('.page') ?? page;
  const indicator = make(document, 'div', undefined, 'pull-refresh');
  indicator.setAttribute('role', 'status');
  indicator.setAttribute('aria-live', 'polite');
  const spinner = makeSpinner(document);
  const spokes = [...spinner.children];
  const label = make(document, 'span', '', 'pull-refresh-label');
  indicator.append(spinner, label);
  indicator.hidden = true;
  (document.body ?? page).append(indicator);
  const threshold = 240;
  let start;
  let modalGesture;
  let distance = 0;
  let dragging = false;
  let reloading = false;
  let reloadGeneration = 0;
  const atTop = () => (document.scrollingElement?.scrollTop ?? 0) <= 0;
  const activeDialog = () => document.querySelector('dialog[open]');
  const blocked = () => {
    const state = actions.getState?.();
    return Boolean(activeDialog()) || state?.pending || state?.frozen;
  };
  const available = () => !reloading && !blocked();
  const showPull = distance => {
    const progress = Math.min(distance / threshold, 1);
    pullContent.dataset.pullState = 'pulling';
    pullContent.style.setProperty('--pull-offset', `${Math.min(distance * 0.65, 96)}px`);
    indicator.style.setProperty('--pull-progress', String(progress));
    spinner.style.setProperty('--pull-angle', `${progress * 180}deg`);
    spokes.forEach((spoke, index) => { spoke.style.opacity = String(Math.max(0, Math.min(1, progress * 12 - index))); });
    indicator.dataset.state = progress >= 1 ? 'armed' : 'pulling';
    indicator.hidden = false;
    const message = progress >= 1 ? '놓으면 새로고침합니다.' : '아래로 당겨 새로고침';
    if (label.textContent !== message) label.textContent = message;
  };
  const reset = () => {
    start = undefined;
    modalGesture = undefined;
    distance = 0;
    dragging = false;
    resetPull();
  };
  const resetPull = () => {
    distance = 0;
    dragging = false;
    if (!reloading) {
      indicator.hidden = true;
      pullContent.dataset.pullState = 'idle';
      pullContent.style.setProperty('--pull-offset', '0px');
    }
  };
  const cancelForDialog = () => {
    const gesture = start;
    start = undefined;
    modalGesture = activeDialog() && gesture ? { ...gesture, lastY: gesture.lastY ?? gesture.y } : undefined;
    reloadGeneration++;
    reloading = false;
    resetPull();
  };
  const MutationObserver = document.defaultView?.MutationObserver;
  if (typeof MutationObserver === 'function') {
    const dialogObserver = new MutationObserver(records => {
      if (records.some(record => record.attributeName === 'open' && record.target.tagName?.toLowerCase() === 'dialog')) {
        cancelForDialog();
      }
    });
    dialogObserver.observe(surface, { attributes: true, attributeFilter: ['open'], subtree: true });
  }
  const scrolledInside = target => {
    for (let node = target; node && node !== document.body && node !== surface; node = node.parentElement) {
      if (node.scrollHeight > node.clientHeight && node.scrollTop > 0) return true;
    }
    return false;
  };
  const dialogCanScroll = (dialog, target, touch, deltaY, gesture) => {
    let withinDialog = false;
    for (let node = target; node; node = node.parentElement) {
      if (node === dialog) {
        withinDialog = true;
        break;
      }
    }
    if (!withinDialog) return false;
    const bounds = dialog.getBoundingClientRect?.();
    if (target === dialog && bounds && (gesture.x < bounds.left || gesture.x > bounds.right ||
      gesture.y < bounds.top || gesture.y > bounds.bottom || touch.clientX < bounds.left ||
      touch.clientX > bounds.right || touch.clientY < bounds.top || touch.clientY > bounds.bottom)) return false;
    for (let node = target; node && node !== dialog; node = node.parentElement) {
      if (node.scrollHeight > node.clientHeight) {
        const maxScroll = node.scrollHeight - node.clientHeight;
        if ((deltaY > 0 && node.scrollTop > 0) || (deltaY < 0 && node.scrollTop < maxScroll)) return true;
      }
    }
    const maxScroll = dialog.scrollHeight - dialog.clientHeight;
    return (deltaY > 0 && dialog.scrollTop > 0) || (deltaY < 0 && dialog.scrollTop < maxScroll);
  };

  surface.addEventListener('touchstart', event => {
    reset();
    const dialog = activeDialog();
    if (dialog) {
      if (event.touches.length === 1) {
        const touch = event.touches[0];
        modalGesture = { id: touch.identifier, x: touch.clientX, y: touch.clientY, lastY: touch.clientY };
      }
      return;
    }
    if (!available() || !atTop() || event.touches.length !== 1 || scrolledInside(event.target)) return;
    const touch = event.touches[0];
    start = { id: touch.identifier, x: touch.clientX, y: touch.clientY, lastY: touch.clientY };
  }, { passive: true });

  surface.addEventListener('touchmove', event => {
    const dialog = activeDialog();
    if (dialog) {
      if (start) cancelForDialog();
      if (!modalGesture || event.touches.length !== 1 || !event.cancelable) return;
      const touch = event.touches[0];
      if (touch.identifier !== modalGesture.id) {
        modalGesture = undefined;
        return;
      }
      const dx = Math.abs(touch.clientX - modalGesture.x);
      const dy = touch.clientY - modalGesture.y;
      const deltaY = touch.clientY - modalGesture.lastY;
      modalGesture.lastY = touch.clientY;
      if (Math.abs(dy) <= 8 || dx >= Math.abs(dy)) return;
      if (!dialogCanScroll(dialog, event.target, touch, deltaY, modalGesture)) event.preventDefault();
      return;
    }
    if (!start) return;
    if (!available() || !atTop() || scrolledInside(event.target) || event.touches.length !== 1 || !event.cancelable) return reset();
    const touch = event.touches[0];
    if (touch.identifier !== start.id) return reset();
    start.lastY = touch.clientY;
    const dx = Math.abs(touch.clientX - start.x);
    const dy = touch.clientY - start.y;
    if (dy < -8 || (dx > 8 && dx >= dy)) return reset();
    distance = Math.max(0, dy);
    if (!dragging && dy <= 8) return;
    if (dy <= 0 || dy <= dx) {
      indicator.hidden = true;
      pullContent.dataset.pullState = 'idle';
      pullContent.style.setProperty('--pull-offset', '0px');
      return;
    }
    dragging = true;
    event.preventDefault();
    showPull(distance);
  }, { passive: false });

  surface.addEventListener('touchend', event => {
    const touch = Array.from(event.changedTouches).find(item => item.identifier === start?.id);
    const shouldReload = start && touch && event.touches.length === 0 && available() && atTop() &&
      distance >= threshold && touch.clientY - start.y >= threshold;
    // A drag on a control must not become a tap when released below the refresh threshold.
    if (start && dragging && event.cancelable) event.preventDefault();
    reset();
    if (!shouldReload) return;
    if (event.cancelable) event.preventDefault();
    reloading = true;
    indicator.dataset.state = 'reloading';
    label.textContent = '새로고침 중…';
    pullContent.dataset.pullState = 'reloading';
    pullContent.style.setProperty('--pull-offset', '56px');
    indicator.style.setProperty('--pull-progress', '1');
    spokes.forEach((spoke, index) => { spoke.style.opacity = String((index + 1) / 12); });
    indicator.hidden = false;
    // Let the rotating spinner paint before replacing the document.
    const generation = ++reloadGeneration;
    document.defaultView.requestAnimationFrame(() => {
      if (generation !== reloadGeneration) return;
      document.defaultView.setTimeout(() => {
        if (generation !== reloadGeneration) return;
        if (blocked()) {
          reloading = false;
          reset();
          return;
        }
        document.defaultView.location.reload();
      }, 240);
    });
  }, { passive: false });
  surface.addEventListener('touchcancel', reset, { passive: true });
}
