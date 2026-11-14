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
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.addInitScript(() => {
    window.navigationPhase = 'initial';
    window.navigationPlacements = [];
    new MutationObserver(records => {
      const snapped = records.some(record => record.attributeName === 'data-indicator-animate' && record.oldValue === 'false');
      const nav = document.querySelector('.tabs');
      if (!snapped || nav?.dataset.indicatorReady !== 'true') return;
      const selected = nav.querySelector('[aria-current="page"]');
      const style = getComputedStyle(nav, '::before');
      window.navigationPlacements.push({ phase: window.navigationPhase,
        reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
        x: new DOMMatrixReadOnly(style.transform).m41, width: parseFloat(style.width),
        targetX: selected.offsetLeft, targetWidth: selected.offsetWidth,
        animations: nav.getAnimations({ subtree: true }).length });
    }).observe(document, { subtree: true, attributes: true, attributeOldValue: true,
      attributeFilter: ['data-indicator-animate'] });
  });
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
  const assertSnap = async phase => {
    await page.waitForFunction(phase => window.navigationPlacements.some(value => value.phase === phase), phase);
    const value = await page.evaluate(phase => window.navigationPlacements.find(value => value.phase === phase), phase);
    assert.equal(value.reducedMotion, false, `${phase} uses normal motion`);
    assert.equal(value.animations, 0, `${phase} has no transition immediately after placement`);
    assert.ok(Math.abs(value.x - value.targetX) < 1, JSON.stringify(value));
    assert.ok(Math.abs(value.width - value.targetWidth) < 1, JSON.stringify(value));
    results.push({ check: `${phase} immediate placement with normal motion`, ...value });
  };
  const tap = async route => {
    await page.locator(`.tabs [data-route="${route}"]`).tap();
    await page.waitForFunction(route => document.querySelector('.tabs [aria-current]')?.dataset.route === route, route);
  };
  await page.waitForFunction(() => document.querySelector('.tabs').dataset.indicatorReady === 'true');
  await assertSnap('initial');
  await page.evaluate(() => {
    window.navigationTouches = [];
    document.querySelector('.tabs').addEventListener('touchstart', event => {
      window.navigationTouches.push({ trusted: event.isTrusted, type: event.type });
    }, { passive: true });
  });
  const touchRoute = page.locator('.tabs [data-route="/records"]');
  const touchBox = await touchRoute.boundingBox();
  const touch = await page.context().newCDPSession(page);
  await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{
    x: touchBox.x + touchBox.width / 2, y: touchBox.y + touchBox.height / 2,
  }] });
  await page.waitForTimeout(120);
  const pressed = await touchRoute.evaluate(item => ({
    active: item.matches(':active'), hover: item.matches(':hover'), background: getComputedStyle(item).backgroundColor,
    tapHighlight: getComputedStyle(item).webkitTapHighlightColor,
  }));
  await page.screenshot({ path: `${out}/touch-held.png` });
  await writeFile(`${out}/touch-held.json`, JSON.stringify(pressed, null, 2));
  assert.equal(pressed.background, 'rgba(0, 0, 0, 0)', 'touch-held destination must not paint a second background');
  assert.equal(pressed.tapHighlight, 'rgba(0, 0, 0, 0)', 'native tap highlight must not paint a second background');
  await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForFunction(() => document.querySelector('.tabs [aria-current]')?.dataset.route === '/records');
  await settled();
  assert.ok(await page.evaluate(() => window.navigationTouches.some(event => event.trusted)), 'trusted native touch reaches navigation');
  for (const selector of ['[data-route="/records"]', '[data-route="/beans"]', '.tabs-start-brew']) {
    await page.locator(`.tabs ${selector}`).hover();
    const hovered = await page.locator(`.tabs ${selector}`).evaluate(item => ({
      hover: item.matches(':hover'), background: getComputedStyle(item).backgroundColor,
    }));
    assert.equal(hovered.hover, true);
    assert.equal(hovered.background, 'rgba(0, 0, 0, 0)', 'hover must not paint a second destination background');
    results.push({ check: `hover remains transparent on ${selector}`, ...hovered });
  }
  await tap('/home');
  await settled();
  results.push({ check: 'native touch held has no destination background or tap highlight', ...pressed });
  const start = await snapshot();
  const duration = parseFloat(start.transition) * 1000;
  assert.ok(duration >= 350 && duration <= 400, 'navigation uses the approved 350–400ms motion range');
  await tap('/records');
  await page.waitForFunction(startX => {
    const nav = document.querySelector('.tabs');
    const x = new DOMMatrixReadOnly(getComputedStyle(nav, '::before').transform).m41;
    const distance = nav.querySelector('[aria-current]').offsetLeft - startX;
    return x > startX + distance * 0.2 && x < startX + distance * 0.8;
  }, start.x);
  const middle = await snapshot();
  assert.ok(middle.x > start.x && middle.x < middle.targetX, JSON.stringify(middle));
  assert.ok(middle.animations > 0, 'actual CSS transition is running');
  await page.screenshot({ path: `${out}/moving.png` });
  results.push({ check: 'moving between menu buttons', ...middle });
  results.push({ check: 'settled destination', ...await settled() });
  await tap('/beans');
  await page.waitForFunction(() => {
    const nav = document.querySelector('.tabs');
    const x = new DOMMatrixReadOnly(getComputedStyle(nav, '::before').transform).m41;
    return nav.getAnimations({ subtree: true }).length > 0 && Math.abs(x - nav.querySelector('[aria-current]').offsetLeft) > 3;
  });
  const beforeRetarget = await snapshot();
  await tap('/home');
  const afterRetarget = await snapshot();
  assert.ok(beforeRetarget.animations > 0, 'next tap occurs during the previous animation');
  assert.ok(Math.abs(beforeRetarget.x - beforeRetarget.targetX) > 1, 'previous destination has not been reached');
  assert.ok(Math.abs(afterRetarget.x - beforeRetarget.targetX) > 1, 'retarget does not jump to the previous destination');
  assert.ok(Math.abs(afterRetarget.x - afterRetarget.targetX) > 1, 'retarget continues moving instead of snapping home');
  results.push({ check: 'rapid native tap retargets a running transition', beforeRetarget, afterRetarget, ...await settled() });
  await page.evaluate(() => { window.navigationPhase = 'resize'; });
  await page.setViewportSize({ width: 320, height: 844 });
  await page.waitForFunction(() => {
    const nav = document.querySelector('.tabs');
    return parseFloat(nav.style.getPropertyValue('--nav-indicator-width')) === nav.querySelector('[aria-current]').offsetWidth;
  });
  await assertSnap('resize');
  await tap('/records');
  results.push({ check: '320px unequal column destination', ...await settled() });
  await page.screenshot({ path: `${out}/320px.png` });
  await page.locator('.tabs [data-action="start-brew"]').tap();
  await page.waitForFunction(() => document.querySelector('.tabs .tabs-start-brew').hasAttribute('aria-current'));
  await page.locator('.tabs .tabs-start-brew').hover();
  assert.equal(await page.locator('.tabs .tabs-start-brew').evaluate(item => item.matches(':hover')), true);
  const brew = await settled();
  assert.equal(brew.itemBackground, 'rgba(0, 0, 0, 0)');
  assert.notEqual(brew.color, start.color);
  assert.equal(await page.locator('.tabs .tabs-start-brew').evaluate(item => getComputedStyle(item).boxShadow), 'none');
  results.push({ check: 'brew accent color', ...brew });
  await page.screenshot({ path: `${out}/brew.png` });
  await page.keyboard.press('Tab');
  await page.locator('.tabs [data-route="/recipes"]').focus();
  const focus = await page.locator('.tabs [data-route="/recipes"]').evaluate(item => ({
    visible: item.matches(':focus-visible'), style: getComputedStyle(item).outlineStyle,
    width: getComputedStyle(item).outlineWidth,
  }));
  assert.equal(focus.visible, true);
  assert.equal(focus.style, 'solid');
  assert.equal(focus.width, '3px');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => document.querySelector('.tabs [aria-current]')?.dataset.route === '/recipes');
  results.push({ check: 'keyboard activation keeps visible focus', focus, ...await settled() });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await tap('/home');
  const reduced = await snapshot();
  assert.equal(reduced.transition, '0s');
  assert.equal(reduced.x, reduced.targetX);
  results.push({ check: 'reduced motion', ...reduced });
  await page.setViewportSize({ width: 1280, height: 844 });
  await page.waitForFunction(() => !document.querySelector('.tabs').dataset.indicatorReady);
  assert.equal(await page.locator('.site-header .tabs').count(), 1);
  assert.equal(await page.locator('.tabs .tabs-start-brew').isVisible(), false);
  assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector('.tabs'), '::before').content), 'none');
  await tap('/beans');
  assert.equal(await page.locator('.tabs [aria-current]').getAttribute('data-route'), '/beans');
  results.push({ check: 'desktop navigation retains original placement and selection' });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.evaluate(() => { window.navigationPhase = 'mobile-return'; });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForFunction(() => document.querySelector('.tabs').dataset.indicatorReady === 'true');
  await assertSnap('mobile-return');
  await page.screenshot({ path: `${out}/390px.png` });
  assert.deepEqual(errors, []);
  await writeFile(`${out}/results.json`, JSON.stringify({ results, errors }, null, 2));
  console.log(JSON.stringify({ status: 'passed', checks: results.length, evidence: out }));
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
}
