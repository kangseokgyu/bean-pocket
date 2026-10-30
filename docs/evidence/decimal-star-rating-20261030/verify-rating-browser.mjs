import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('/Users/kangseokgyu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const pwaVariant = process.argv.includes('--dist') ? 'dist' : 'pwa';
const pwaRoot = path.resolve(root, pwaVariant);
const publicFiles = new Map([
  ['/', 'public/index.html'],
  ['/app.js', 'public/app.js'],
  ['/styles.css', 'public/styles.css'],
  ['/submission.mjs', 'public/submission.mjs'],
  ['/domain.mjs', 'lib/domain.mjs'],
  ['/lib/domain.mjs', 'lib/domain.mjs'],
  ['/ui/star-rating.mjs', 'pwa/ui/star-rating.mjs'],
]);

function contentType(file) {
  if (file.endsWith('.html')) return 'text/html; charset=utf-8';
  if (file.endsWith('.js') || file.endsWith('.mjs')) return 'text/javascript; charset=utf-8';
  if (file.endsWith('.css')) return 'text/css; charset=utf-8';
  return 'application/octet-stream';
}

const server = http.createServer(async (request, response) => {
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
  const url = new URL(request.url, 'http://127.0.0.1');
  if (url.pathname === '/favicon.ico') {
    response.writeHead(204).end();
    return;
  }
  if (url.pathname === '/api/status') {
    response.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify({ connected: false }));
    return;
  }
  if (url.pathname === '/pwa/rating-harness.html') {
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }).end(`<!doctype html>
      <html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
      <link rel="stylesheet" href="./styles.css"><main id="app-root"></main>
      <script type="module" src="./rating-harness.mjs"></script></html>`);
    return;
  }
  if (url.pathname === '/pwa/rating-harness.mjs') {
    const body = await readFile(path.join(root, 'docs/evidence/decimal-star-rating-20261030/rating-harness.mjs'));
    response.writeHead(200, { 'content-type': 'text/javascript; charset=utf-8' }).end(body);
    return;
  }
  const pwaRelative = url.pathname.startsWith('/pwa/') ? decodeURIComponent(url.pathname.slice('/pwa/'.length)) : null;
  const pwaPath = pwaRelative ? path.resolve(pwaRoot, pwaRelative) : null;
  const pwaFile = pwaPath && (pwaPath === pwaRoot || pwaPath.startsWith(`${pwaRoot}${path.sep}`)) ? pwaPath : null;
  const relativeFile = pwaFile ? path.relative(root, pwaFile)
    : url.pathname === '/domain.mjs' && pwaVariant === 'dist' ? 'dist/domain.mjs' : publicFiles.get(url.pathname);
  if (!relativeFile) {
    response.writeHead(404).end('not found');
    return;
  }
  try {
    const body = await readFile(path.join(root, relativeFile));
    response.writeHead(200, { 'content-type': contentType(relativeFile) }).end(body);
  } catch {
    response.writeHead(404).end('not found');
  }
});

const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
try {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
  const page = await context.newPage();
  const pageErrors = [];
  const failedRequests = [];
  const failedResponses = [];
  const styleCspViolations = [];
  page.on('pageerror', error => {
    pageErrors.push(error.message);
    console.error(`[browser pageerror] ${error.message}`);
  });
  page.on('console', message => {
    if (message.type() !== 'error') return;
    if (message.text().includes("Applying inline style violates the following Content Security Policy directive 'style-src 'self'")) {
      styleCspViolations.push(message.text());
      return;
    }
    pageErrors.push(message.text());
    console.error(`[browser console] ${message.text()}`);
  });
  page.on('requestfailed', request => failedRequests.push(`${request.url()}: ${request.failure()?.errorText}`));
  await page.goto(origin, { waitUntil: 'networkidle' });
  await page.locator('[data-action="demo"]').click();
  await page.locator('.card[href^="#recipe/"]').first().click();
  await page.locator('[data-action="record"]').click();
  await page.waitForTimeout(100);
  assert.deepEqual(pageErrors, [], 'the public dialog should create the rating control without browser errors');
  assert.equal(await page.locator('#dialog-content input[name="rating"]').count(), 1, 'the public dialog creates one rating control');
  await page.locator('input[name="rating"]').waitFor();
  await page.locator('select[name="beanId"]').selectOption('demo-bean');
  const input = page.locator('input[name="rating"]');
  assert.equal(await input.evaluate(element => element.validity.valueMissing), true, 'blank is a required, unselected value');
  await input.evaluate(element => {
    window.__ratingInput = element;
    window.__ratingEvents = [];
    element.addEventListener('pointerdown', event => window.__ratingEvents.push({ type: event.type, id: event.pointerId, captured: element.hasPointerCapture(event.pointerId), connected: element.isConnected }));
    element.addEventListener('pointermove', event => window.__ratingEvents.push({ type: event.type, id: event.pointerId, captured: element.hasPointerCapture(event.pointerId), connected: element.isConnected }));
    element.addEventListener('pointerup', event => window.__ratingEvents.push({ type: event.type, id: event.pointerId, captured: element.hasPointerCapture(event.pointerId), connected: element.isConnected }));
    element.addEventListener('pointercancel', event => window.__ratingEvents.push({ type: event.type, id: event.pointerId, captured: element.hasPointerCapture(event.pointerId), connected: element.isConnected }));
  });
  const bounds = await input.boundingBox();
  assert.ok(bounds?.width > 200, 'the transparent input covers the five-star hit area');
  const y = bounds.y + bounds.height / 2;
  await page.mouse.click(bounds.x + 1, y);
  assert.equal(await input.inputValue(), '0.1', 'the left edge selects the minimum tenth');
  assert.equal(await page.locator('[data-rating-output]').textContent(), '0.1점');

  const startX = bounds.x + 1;
  const endX = bounds.x + bounds.width * 0.86;
  await page.mouse.move(startX, y);
  await page.mouse.down();
  await page.mouse.move(endX, y, { steps: 6 });
  const mouseDrag = await input.evaluate(element => ({
    value: element.value,
    output: element.form.querySelector('[data-rating-output]').textContent,
    sameNode: window.__ratingInput === document.querySelector('input[name="rating"]'),
    events: window.__ratingEvents,
    partialFill: element.form.querySelectorAll('.rating-fill-rect')[4].getAttribute('width'),
  }));
  assert.equal(mouseDrag.value, '4.3');
  assert.equal(mouseDrag.output, '4.3점');
  assert.equal(mouseDrag.sameNode, true, 'dirty-state updates preserve the captured input node');
  assert.ok(mouseDrag.events.some(event => event.type === 'pointermove' && event.captured && event.connected), 'mouse drag keeps pointer capture on the live input');
  assert.equal(mouseDrag.partialFill, '7.2', 'the fifth star is partly filled while dragging');
  await page.screenshot({ path: path.join(path.dirname(fileURLToPath(import.meta.url)), 'browser-rating.png') });
  await page.mouse.move(bounds.x + bounds.width + 40, y, { steps: 3 });
  assert.equal(await input.inputValue(), '5.0', 'dragging beyond the right edge clamps to five');
  await page.mouse.up();

  await input.focus();
  await page.keyboard.press('Home');
  await page.keyboard.press('ArrowRight');
  assert.equal(await input.inputValue(), '0.2', 'keyboard arrows change the score by one tenth');
  await page.keyboard.press('End');
  assert.equal(await input.inputValue(), '5.0');
  await page.keyboard.press('Backspace');
  assert.equal(await input.inputValue(), '');
  assert.equal(await input.evaluate(element => element.validity.valueMissing), true);

  const touchBounds = await input.boundingBox();
  const cdp = await context.newCDPSession(page);
  const touchY = touchBounds.y + touchBounds.height / 2;
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ id: 7, x: touchBounds.x + 2, y: touchY, force: 1 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ id: 7, x: touchBounds.x + touchBounds.width * 0.61, y: touchY, force: 1 }] });
  const touchDrag = await input.evaluate(element => ({ value: element.value,
    captured: window.__ratingEvents.some(event => event.type === 'pointermove' && event.captured && event.connected) }));
  assert.equal(touchDrag.value, '3.1');
  assert.equal(touchDrag.captured, true, 'touch drag keeps pointer capture on the live input');
  const cancelledValue = touchDrag.value;
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
  assert.equal(await input.inputValue(), cancelledValue, 'touch cancellation keeps the last shown score');
  assert.ok((await input.evaluate(() => window.__ratingEvents)).some(event => event.type === 'pointercancel'));
  await cdp.detach();

  await page.locator('.rating-clear').click();
  assert.equal(await input.inputValue(), '');
  assert.equal(await input.evaluate(element => getComputedStyle(element).touchAction), 'none');
  await page.locator('button[type="submit"]').click();
  assert.equal(await page.locator('#form-dialog').evaluate(dialog => dialog.open), true, 'required rating blocks an empty submission');
  await page.locator('.rating-clear').evaluate(button => button.disabled = true);
  await input.evaluate(element => { element.disabled = false; element.value = '4.3'; element.dispatchEvent(new Event('input', { bubbles: true })); });
  await page.locator('button[type="submit"]').click();
  await page.locator('#form-dialog').waitFor({ state: 'hidden' });
  await page.evaluate(() => { location.hash = '#records'; });
  await page.locator('.record').waitFor();
  assert.match(await page.locator('.record').textContent(), /별점: 4\.3\/5/, 'the public UI reads back the saved decimal score');

  const pwaPage = await context.newPage();
  pwaPage.on('pageerror', error => {
    pageErrors.push(error.message);
    console.error(`[PWA pageerror] ${error.message}`);
  });
  pwaPage.on('console', message => {
    if (message.type() !== 'error') return;
    if (message.text().includes("Applying inline style violates the following Content Security Policy directive 'style-src 'self'")) {
      styleCspViolations.push(message.text());
      return;
    }
    pageErrors.push(message.text());
    console.error(`[PWA console] ${message.text()}`);
  });
  pwaPage.on('requestfailed', request => failedRequests.push(`${request.url()}: ${request.failure()?.errorText}`));
  pwaPage.on('response', response => {
    if (response.status() >= 400) failedResponses.push(`${response.status()} ${response.url()}`);
  });
  await pwaPage.goto(`${origin}/pwa/rating-harness.html`, { waitUntil: 'networkidle' });
  await pwaPage.waitForTimeout(100);
  console.log('PWA HTTP errors', failedResponses);
  assert.deepEqual(pageErrors, [], 'the PWA view should create the rating control without browser errors');
  assert.equal(await pwaPage.locator('input[name="rating"]').count(), 1, 'the PWA view creates one rating control');
  const pwaInput = pwaPage.locator('input[name="rating"]');
  await pwaInput.waitFor();
  const pwaBounds = await pwaInput.boundingBox();
  const pwaCdp = await context.newCDPSession(pwaPage);
  await pwaCdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ id: 8, x: pwaBounds.x + 2, y: pwaBounds.y + pwaBounds.height / 2, force: 1 }] });
  await pwaCdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ id: 8, x: pwaBounds.x + pwaBounds.width * 0.42, y: pwaBounds.y + pwaBounds.height / 2, force: 1 }] });
  const pwaTouchValue = await pwaInput.inputValue();
  assert.equal(pwaTouchValue, '2.2', 'the production PWA view handles touch at a tenth-point score');
  assert.equal(await pwaPage.evaluate(() => window.__pwaDirty), true, 'the actual PWA form marks a touched rating as dirty');
  await pwaCdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await pwaCdp.detach();
  await pwaPage.evaluate(() => window.__pwaView.renderRoute('/home'));
  await pwaPage.evaluate(() => window.__pwaView.renderRoute(window.__pwaRoute));
  assert.equal(await pwaInput.inputValue(), '2.2', 'the actual PWA form restores its decimal draft');
  assert.equal(await pwaPage.locator('[data-rating-output]').textContent(), '2.2점');
  await pwaPage.locator('.rating-clear').click();
  await pwaPage.evaluate(() => window.__pwaView.renderRoute('/home'));
  await pwaPage.evaluate(() => window.__pwaView.renderRoute(window.__pwaRoute));
  assert.equal(await pwaInput.inputValue(), '', 'clearing a restored PWA draft remains empty');
  assert.equal(await pwaPage.locator('[data-rating-output]').textContent(), '미입력');
  assert.deepEqual(pageErrors, []);
  assert.deepEqual(failedRequests, []);
  console.log(JSON.stringify({ browser: 'Chrome', version: browser.version(), viewport: '390x844 touch', mouseDrag: mouseDrag.value,
    pwa: pwaVariant, touchDrag: touchDrag.value, publicSavedRating: '4.3',
    pwaTouchRating: pwaTouchValue, errors: pageErrors, failedRequests, styleCspViolations: styleCspViolations.length }));
  await context.close();
} finally {
  await browser.close();
  if (server.listening) await new Promise(resolve => server.close(resolve));
}
