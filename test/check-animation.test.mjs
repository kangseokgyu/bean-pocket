import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [pwaView, pwaStyles, publicApp, publicStyles] = await Promise.all([
  readFile(new URL('../pwa/ui/view.mjs', import.meta.url), 'utf8'),
  readFile(new URL('../pwa/styles.css', import.meta.url), 'utf8'),
  readFile(new URL('../public/app.js', import.meta.url), 'utf8'),
  readFile(new URL('../public/styles.css', import.meta.url), 'utf8'),
]);
const shortStrokeFirstCheck = "check: 'M4 12l5 5 11-11'";

function assertMotion(source, label, selector) {
  assert.ok(/check-draw\s+580ms\s+cubic-bezier\(\.35,0,\.2,1\)/.test(source), `${label} draws for 580ms with the approved easing`);
  assert.ok(/check-settle\s+240ms\s+ease-out\s+580ms/.test(source), `${label} starts its 240ms settle after the draw`);
  assert.ok(/@keyframes\s+check-draw\s*\{[^}]*stroke-dashoffset\s*:\s*1[\s\S]*?stroke-dashoffset\s*:\s*0/.test(source), `${label} draws from the start of the path to its end`);
  assert.ok(/@keyframes\s+check-settle\s*\{[\s\S]*?scale\s*:\s*1\.12/.test(source), `${label} has the approved small settle`);
  const reducedMotion = source.slice(source.search(/@media\s*\([^)]*prefers-reduced-motion\s*:\s*reduce\s*\)/));
  assert.ok(selector.test(reducedMotion) && /animation\s*:\s*none/.test(reducedMotion), `${label} disables check motion for reduced-motion users`);
}

test('PWA check path draws from the short stroke to the long stroke', () => {
  assert.ok(pwaView.includes(shortStrokeFirstCheck), 'PWA check path starts at the short stroke');
  assert.ok(pwaView.includes("path.setAttribute('pathLength', '1')"), 'PWA check path uses a normalized draw length');
});

test('server check path draws from the short stroke to the long stroke', () => {
  assert.ok(publicApp.includes(shortStrokeFirstCheck), 'server check path starts at the short stroke');
  assert.ok(publicApp.includes('pathLength="1"'), 'server check path uses a normalized draw length');
});

test('PWA action and status checks share the approved motion and reduced-motion behavior', () => {
  assertMotion(pwaStyles, 'PWA', /\.button-icon\[data-icon="check"\]\[data-state="success"\]/);
  assert.ok(pwaStyles.includes('.status-icon[data-state="success"]'), 'PWA status checks use the shared animation');
});

test('server action checks use the approved motion and reduced-motion behavior', () => {
  assertMotion(publicStyles, 'server page', /\.button-icon[^{}]*data-icon(?:="check"|=check)[^{}]*data-state(?:="success"|=success)/);
});
