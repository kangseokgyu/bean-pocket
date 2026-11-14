import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { createBrowserServer } from './server.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const out = process.env.BEAN_BROWSER_RESULTS ?? '/tmp/bottom-menu-motion-browser';
await mkdir(out, { recursive: true });
const server = createBrowserServer({ regression: root });
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
let browser;
const results = [];
try {
  browser = await chromium.launch({ headless: true,
    ...(process.env.CHROME_EXECUTABLE ? { executablePath: process.env.CHROME_EXECUTABLE } : {}) });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/regression/pwa/index.html`);
  await page.waitForFunction(() => window.harnessReady || window.harnessError);
  assert.equal(await page.evaluate(() => window.harnessError), undefined);
  await page.locator('.startup-overlay').waitFor({ state: 'hidden' });
  const snapshot = () => page.evaluate(() => {
    const nav = document.querySelector('.tabs');
    const item = nav.querySelector('[aria-current="page"]');
    const style = getComputedStyle(nav, '::before');
    return { ready: nav.dataset.indicatorReady, x: new DOMMatrixReadOnly(style.transform).m41,
      width: parseFloat(style.width), targetX: item.offsetLeft, targetWidth: item.offsetWidth,
      color: style.backgroundColor, itemBackground: getComputedStyle(item).backgroundColor,
      textColor: getComputedStyle(item).color, transition: style.transitionDuration,
      animations: nav.getAnimations({ subtree: true }).length, currentCount: nav.querySelectorAll('[aria-current]').length,
      display: style.display, content: style.content };
  });
  const settled = async () => {
    await page.evaluate(async () => {
      const nav = document.querySelector('.tabs');
      await Promise.all(nav.getAnimations({ subtree: true }).map(animation => animation.finished.catch(() => {})));
    });
    const value = await snapshot();
    assert.ok(Math.abs(value.x - value.targetX) < 1, JSON.stringify(value));
    assert.ok(Math.abs(value.width - value.targetWidth) < 1, JSON.stringify(value));
    assert.equal(value.currentCount, 1);
    return value;
  };
  const click = async route => {
    await page.locator(`.tabs [data-route="${route}"]`).click();
    await page.waitForFunction(route => document.querySelector('.tabs [aria-current]')?.dataset.route === route, route);
  };
  await page.waitForFunction(() => document.querySelector('.tabs').dataset.indicatorReady === 'true');
  results.push({ check: 'initial placement', ...await settled() });
  const start = await snapshot();
  await click('/records');
  await page.waitForFunction(startX => {
    const nav = document.querySelector('.tabs');
    const x = new DOMMatrixReadOnly(getComputedStyle(nav, '::before').transform).m41;
    return x > startX && x < nav.querySelector('[aria-current]').offsetLeft;
  }, start.x);
  const middle = await snapshot();
  assert.ok(middle.x > start.x && middle.x < middle.targetX, JSON.stringify(middle));
  assert.ok(middle.animations > 0, 'actual CSS transition is running');
  await page.screenshot({ path: `${out}/moving.png` });
  results.push({ check: 'moving between menu buttons', ...middle });
  results.push({ check: 'settled destination', ...await settled() });
  await click('/beans');
  await click('/recipes');
  await click('/home');
  results.push({ check: 'rapid selection ends on home', ...await settled() });
  await page.setViewportSize({ width: 320, height: 844 });
  await page.waitForFunction(() => {
    const nav = document.querySelector('.tabs');
    return parseFloat(nav.style.getPropertyValue('--nav-indicator-width')) === nav.querySelector('[aria-current]').offsetWidth;
  });
  results.push({ check: '320px resize', ...await settled() });
  await click('/records');
  results.push({ check: '320px unequal column destination', ...await settled() });
  await page.screenshot({ path: `${out}/320px.png` });
  await page.locator('.tabs [data-action="start-brew"]').click();
  await page.waitForFunction(() => document.querySelector('.tabs .tabs-start-brew').hasAttribute('aria-current'));
  const brew = await settled();
  assert.equal(brew.itemBackground, 'rgba(0, 0, 0, 0)');
  assert.notEqual(brew.color, results[0].color);
  results.push({ check: 'brew accent color', ...brew });
  await page.screenshot({ path: `${out}/brew.png` });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await click('/recipes');
  const reduced = await snapshot();
  assert.equal(reduced.transition, '0s');
  assert.equal(reduced.x, reduced.targetX);
  results.push({ check: 'reduced motion', ...reduced });
  await page.setViewportSize({ width: 1280, height: 844 });
  await page.waitForFunction(() => !document.querySelector('.tabs').dataset.indicatorReady);
  assert.equal(await page.locator('.site-header .tabs').count(), 1);
  assert.equal(await page.locator('.tabs .tabs-start-brew').isVisible(), false);
  assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector('.tabs'), '::before').content), 'none');
  await click('/beans');
  assert.equal(await page.locator('.tabs [aria-current]').getAttribute('data-route'), '/beans');
  results.push({ check: 'desktop navigation retains original placement and selection' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForFunction(() => document.querySelector('.tabs').dataset.indicatorReady === 'true');
  results.push({ check: 'mobile return', ...await settled() });
  await page.screenshot({ path: `${out}/390px.png` });
  assert.deepEqual(errors, []);
  await writeFile(`${out}/results.json`, JSON.stringify({ results, errors }, null, 2));
  console.log(JSON.stringify({ status: 'passed', checks: results.length, evidence: out }));
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
}
