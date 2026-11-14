import test from 'node:test';
import assert from 'node:assert/strict';
import { syncNavigationIndicator } from '../pwa/ui/view.mjs';

function fixture() {
  const values = {};
  const selected = { offsetLeft: 132.5, offsetTop: 6, offsetWidth: 67, offsetHeight: 48 };
  const nav = {
    dataset: {}, style: { setProperty: (name, value) => { values[name] = value; } },
    ownerDocument: { defaultView: { matchMedia: () => ({ matches: true }) } },
    getBoundingClientRect: () => ({ width: 344 }),
    querySelector: () => selected,
    get offsetWidth() { return 344; },
  };
  return { nav, selected, values };
}

test('indicator follows actual selected button geometry, including unequal columns and rapid selections', () => {
  const { nav, selected, values } = fixture();
  syncNavigationIndicator(nav);
  assert.equal(values['--nav-indicator-x'], '132.5px');
  assert.equal(values['--nav-indicator-width'], '67px');
  assert.equal(values['--nav-indicator-y'], '6px');
  assert.equal(values['--nav-indicator-height'], '48px');
  assert.equal(nav.dataset.indicatorReady, 'true');
  selected.offsetLeft = 7;
  selected.offsetWidth = 44;
  syncNavigationIndicator(nav);
  selected.offsetLeft = 270;
  syncNavigationIndicator(nav);
  assert.equal(values['--nav-indicator-x'], '270px');
  assert.equal(values['--nav-indicator-width'], '44px');
});

test('first placement and resize settle without animating from stale coordinates', () => {
  const { nav, selected, values } = fixture();
  const animationAtLayout = [];
  Object.defineProperty(nav, 'offsetWidth', { get() { animationAtLayout.push(nav.dataset.indicatorAnimate); return 344; } });
  syncNavigationIndicator(nav);
  selected.offsetWidth = 53;
  syncNavigationIndicator(nav, false);
  assert.deepEqual(animationAtLayout, ['false', 'false']);
  assert.equal(values['--nav-indicator-width'], '53px');
  assert.equal(nav.dataset.indicatorAnimate, 'true');
});

test('hidden or desktop navigation resets placement and leaves native selection styling available', () => {
  const { nav } = fixture();
  syncNavigationIndicator(nav);
  nav.getBoundingClientRect = () => ({ width: 0 });
  syncNavigationIndicator(nav);
  assert.equal(nav.dataset.indicatorReady, undefined);
  nav.getBoundingClientRect = () => ({ width: 344 });
  nav.ownerDocument.defaultView.matchMedia = () => ({ matches: false });
  syncNavigationIndicator(nav);
  assert.equal(nav.dataset.indicatorReady, undefined);
});
