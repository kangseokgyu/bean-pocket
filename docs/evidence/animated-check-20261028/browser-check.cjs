const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require('/Users/kangseokgyu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');

const root = path.resolve(__dirname, '../../..');
const evidence = __dirname;
const origin = 'http://127.0.0.1:4199';
const checks = [];
const consoleIssues = [];
const outsideRequests = [];
const expectedFailures = [];
const expectedConsoleIssues = [];
const measurements = {};
let connectionFailurePending = false;
const pwaHarness = `<!doctype html><html lang="ko"><meta charset="utf-8"><link rel="stylesheet" href="/pwa/styles.css"><main class="page"><header class="site-header"><div id="connection-tools"></div></header><section id="app-root"></section></main><script type="module">
import { createAppView } from '/pwa/ui/view.mjs';
const view = window.view = createAppView(document);
view.renderRoute('/beans');
view.renderData({ beans: [], recipes: [], records: [] });
view.bind({ setDirty() {}, getState() { return {}; }, async submit() {
  view.setState({ pending: true });
  view.showStatus({ type: 'saving', message: '저장 중입니다.' });
  await new Promise(resolve => setTimeout(resolve, 80));
  if (window.failNext) {
    window.failNext = false;
    view.setState({ pending: false });
    view.showStatus({ type: 'validation-error', message: '저장하지 못했습니다.' });
    throw new Error('fixture failure');
  }
  view.setState({ pending: false });
  view.showEntrySuccess('beans');
  view.showStatus({ type: 'saved', message: '저장했습니다.' });
} });
view.showBeanForm();
window.failNext = true;
window.ready = true;
</script></html>`;

function check(name, passed) {
  assert.ok(passed, name);
  checks.push(name);
}

function resourceFor(pathname) {
  if (pathname === '/') return path.join(root, 'public/index.html');
  if (pathname === '/domain.mjs') return path.join(root, 'lib/domain.mjs');
  if (pathname.startsWith('/pwa/') || pathname.startsWith('/lib/')) return path.resolve(root, pathname.slice(1));
  return path.resolve(root, 'public', `.${pathname}`);
}

function contentType(file) {
  return ({ '.css': 'text/css; charset=utf-8', '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8' })[path.extname(file)] || 'application/octet-stream';
}

async function motionDetails(locator) {
  return locator.evaluate(node => {
    const path = node.querySelector('path');
    const draw = path.getAnimations().find(animation => animation.animationName === 'check-draw');
    const settle = node.getAnimations().find(animation => animation.animationName === 'check-settle');
    return {
      state: node.dataset.state,
      icon: node.dataset.icon,
      path: path.getAttribute('d'),
      pathLength: path.getAttribute('pathLength'),
      drawName: getComputedStyle(path).animationName,
      drawDuration: getComputedStyle(path).animationDuration,
      drawEasing: getComputedStyle(path).animationTimingFunction,
      dashOffset: getComputedStyle(path).strokeDashoffset,
      settleName: getComputedStyle(node).animationName,
      settleDuration: getComputedStyle(node).animationDuration,
      settleDelay: getComputedStyle(node).animationDelay,
      drawTime: draw?.currentTime,
      settleTime: settle?.currentTime,
      scale: getComputedStyle(node).scale,
    };
  });
}

async function finishMotion(locator) {
  await locator.evaluate(async node => {
    const animations = [...node.getAnimations(), ...node.querySelector('path').getAnimations()]
      .filter(animation => ['check-draw', 'check-settle'].includes(animation.animationName));
    await Promise.all(animations.map(animation => animation.finished));
  });
}

(async () => {
  const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    page.setDefaultTimeout(7000);
    page.on('console', message => {
      if (!['error', 'warning'].includes(message.type())) return;
      const issue = `${message.type()}: ${message.text()}`;
      if (connectionFailurePending && issue.includes('503')) expectedConsoleIssues.push(issue);
      else consoleIssues.push(issue);
    });
    page.on('pageerror', error => consoleIssues.push(`pageerror: ${error.message}`));
    page.on('response', response => {
      if (response.status() >= 400 && new URL(response.url()).pathname !== '/api/connect') expectedFailures.push(`${response.status()} ${response.url()}`);
    });
    await page.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (url.origin !== origin) {
        outsideRequests.push(url.href);
        return route.abort();
      }
      if (url.pathname === '/favicon.ico') return route.fulfill({ status: 204, body: '' });
      if (url.pathname === '/pwa-check-harness') return route.fulfill({ contentType: 'text/html; charset=utf-8', body: pwaHarness });
      if (url.pathname === '/api/status') return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ connected: false }) });
      if (url.pathname === '/api/connect') return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: '테스트용 연결 실패' }) });
      try {
        const file = resourceFor(url.pathname);
        if (!file.startsWith(`${root}${path.sep}`)) throw new Error('path outside project');
        return route.fulfill({ contentType: contentType(file), body: await fs.readFile(file) });
      } catch {
        return route.fulfill({ status: 404, body: 'not found' });
      }
    });

    await page.goto(`${origin}/pwa-check-harness`);
    await page.waitForFunction(() => window.ready === true);
    const pwaSave = page.locator('form[data-form="beans"] [data-entry-submit] .button-icon');
    const pwaStatus = page.locator('.status-icon');
    const pwaSaveButton = page.locator('form[data-form="beans"] [data-entry-submit]');
    await page.locator('form[data-form="beans"] input[name="name"]').fill('테스트 원두');
    await pwaSaveButton.click();
    await page.waitForFunction(() => document.querySelector('form[data-form="beans"] [data-entry-submit]')?.dataset.state === 'idle');
    const failedPwaState = await page.evaluate(() => ({
      saveState: document.querySelector('[data-entry-submit]').dataset.state,
      saveIcon: document.querySelector('[data-entry-submit] .button-icon').dataset.icon,
      statusHidden: document.querySelector('.status-icon').hidden,
      statusState: document.querySelector('.status-icon').dataset.state,
    }));
    check('failed save returns to idle without a success check', failedPwaState.saveState === 'idle' && failedPwaState.saveIcon === 'save' && failedPwaState.statusHidden && failedPwaState.statusState === 'idle');

    await pwaSaveButton.click();
    await page.waitForFunction(() => document.querySelector('.status-icon')?.dataset.state === 'success');
    await page.waitForFunction(() => document.querySelector('.status-icon path')?.getAnimations().some(animation => animation.animationName === 'check-draw' && animation.currentTime > 50));
    const saveMotion = await motionDetails(pwaSave);
    const statusMotion = await motionDetails(pwaStatus);
    measurements.pwaSaveMotion = saveMotion;
    measurements.pwaStatusMotion = statusMotion;
    check('PWA save button and completion toast use the short-to-long check path', saveMotion.path === 'M4 12l5 5 11-11' && statusMotion.path === saveMotion.path && saveMotion.pathLength === '1' && statusMotion.pathLength === '1');
    check('PWA draw uses the approved 580ms duration and easing', saveMotion.drawName === 'check-draw' && saveMotion.drawDuration === '0.58s' && saveMotion.drawEasing.includes('0.35, 0, 0.2, 1') && statusMotion.drawDuration === '0.58s');
    check('PWA settle begins after draw and finishes in 820ms total', saveMotion.settleName === 'check-settle' && saveMotion.settleDuration === '0.24s' && saveMotion.settleDelay === '0.58s' && statusMotion.settleDelay === '0.58s');
    check('PWA check strokes are visibly mid-draw before completion', Number.parseFloat(saveMotion.dashOffset) > 0 && Number.parseFloat(statusMotion.dashOffset) > 0);
    await page.waitForTimeout(160);
    measurements.pwaMidDraw = await motionDetails(pwaSave);
    check('150–300ms PWA frame advances from the short endpoint along the reversed path', Number.parseFloat(measurements.pwaMidDraw.dashOffset) >= 0 && Number.parseFloat(measurements.pwaMidDraw.dashOffset) < 1 && measurements.pwaMidDraw.path === 'M4 12l5 5 11-11');
    await page.screenshot({ path: path.join(evidence, 'pwa-check-in-progress.png'), fullPage: true });

    const before = await page.evaluate(() => {
      const savePath = document.querySelector('[data-entry-submit] .button-icon path');
      const statusPath = document.querySelector('.status-icon path');
      window.savedCheckAnimations = {
        save: savePath.getAnimations().find(animation => animation.animationName === 'check-draw'),
        status: statusPath.getAnimations().find(animation => animation.animationName === 'check-draw'),
      };
      return { save: window.savedCheckAnimations.save.currentTime, status: window.savedCheckAnimations.status.currentTime };
    });
    await page.evaluate(() => { window.view.showEntrySuccess('beans'); window.view.showStatus({ type: 'saved', message: '저장했습니다.' }); });
    await page.waitForTimeout(50);
    const after = await page.evaluate(() => ({
      sameSave: window.savedCheckAnimations.save === document.querySelector('[data-entry-submit] .button-icon path').getAnimations().find(animation => animation.animationName === 'check-draw'),
      sameStatus: window.savedCheckAnimations.status === document.querySelector('.status-icon path').getAnimations().find(animation => animation.animationName === 'check-draw'),
      save: window.savedCheckAnimations.save.currentTime,
      status: window.savedCheckAnimations.status.currentTime,
    }));
    check('re-rendering the same success preserves both running animations', after.sameSave && after.sameStatus && after.save > before.save && after.status > before.status);
    await page.waitForFunction(() => Number.parseFloat(getComputedStyle(document.querySelector('[data-entry-submit] .button-icon')).scale) > 1.1);
    measurements.pwaBounceScale = await pwaSave.evaluate(node => getComputedStyle(node).scale);
    check('PWA check reaches the approved 1.12 settle', Number.parseFloat(measurements.pwaBounceScale) > 1.1 && Number.parseFloat(measurements.pwaBounceScale) <= 1.12);
    await Promise.all([finishMotion(pwaSave), finishMotion(pwaStatus)]);
    const completedPwa = await Promise.all([motionDetails(pwaSave), motionDetails(pwaStatus)]);
    check('PWA success stays fully drawn and settles back to scale 1', completedPwa.every(motion => Number.parseFloat(motion.dashOffset) === 0 && Number.parseFloat(motion.scale) === 1));
    await page.screenshot({ path: path.join(evidence, 'pwa-check-complete.png'), fullPage: true });

    await page.evaluate(() => { window.view.showStatus({ type: 'validation-error', message: '저장하지 못했습니다.' }); });
    const pwaError = await page.evaluate(() => ({ hidden: document.querySelector('.status-icon').hidden, state: document.querySelector('.status-icon').dataset.state }));
    check('PWA errors hide the success check', pwaError.hidden && pwaError.state === 'idle');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.evaluate(() => { window.view.showStatus({ type: 'saving', message: '저장 중입니다.' }); window.view.showStatus({ type: 'saved', message: '저장했습니다.' }); });
    const reducedPwa = await motionDetails(pwaStatus);
    check('PWA reduced-motion success is static and complete', reducedPwa.drawName === 'none' && reducedPwa.settleName === 'none' && Number.parseFloat(reducedPwa.dashOffset) === 0);
    await page.screenshot({ path: path.join(evidence, 'pwa-check-reduced-motion.png'), fullPage: true });

    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.goto(`${origin}/`);
    await page.locator('[data-action="demo"]').waitFor();
    await page.locator('[data-action="demo"]').click();
    await page.locator('[data-action="bean"]').click();
    await page.locator('input[name="name"]').fill('브라우저 검증 원두');
    await page.locator('#dialog-content button[type="submit"]').click();
    const publicCheck = page.locator('#dialog-content .button-icon[data-icon="check"][data-state="success"]');
    await publicCheck.waitFor({ state: 'visible' });
    const publicMotion = await motionDetails(publicCheck);
    measurements.publicMotion = publicMotion;
    check('server page demo save uses the same short-to-long check and approved motion', publicMotion.path === 'M4 12l5 5 11-11' && publicMotion.pathLength === '1' && publicMotion.drawName === 'check-draw' && publicMotion.drawDuration === '0.58s' && publicMotion.settleDelay === '0.58s');
    await page.waitForTimeout(200);
    measurements.publicMidDraw = await motionDetails(publicCheck);
    check('server check advances along the short-to-long path before completion', Number.parseFloat(measurements.publicMidDraw.dashOffset) > 0 && Number.parseFloat(measurements.publicMidDraw.dashOffset) < 1);
    await page.screenshot({ path: path.join(evidence, 'server-check-in-progress.png'), fullPage: true });
    await finishMotion(publicCheck);
    const completedPublic = await motionDetails(publicCheck);
    check('server page success check is fully drawn and settles at scale 1 after 820ms', Number.parseFloat(completedPublic.dashOffset) === 0 && Number.parseFloat(completedPublic.scale) === 1);
    await page.locator('#form-dialog').waitFor({ state: 'hidden' });
    await page.locator('#connect-button').click();
    await page.locator('input[name="token"]').fill('test-only-token');
    connectionFailurePending = true;
    await page.locator('#dialog-content button[type="submit"]').click();
    await page.locator('.form-error:not([hidden])').waitFor();
    connectionFailurePending = false;
    const failedPublicState = await page.evaluate(() => ({
      state: document.querySelector('#dialog-content .action-save').dataset.state,
      icon: document.querySelector('#dialog-content .action-save .button-icon').dataset.icon,
    }));
    check('server page connection failure never shows the success check', failedPublicState.state === 'idle' && failedPublicState.icon === 'save');

    check('expected connection rejection was handled without other response or console issues', expectedFailures.length === 0 && consoleIssues.length === 0 && expectedConsoleIssues.length === 1);
    check('browser made no external requests', outsideRequests.length === 0);
    const report = { browser: 'Google Chrome via Playwright', viewport: { width: 390, height: 844 }, checks, measurements, consoleIssues, expectedConsoleIssues, outsideRequests, expectedFailures };
    await fs.writeFile(path.join(evidence, 'browser-results.json'), `${JSON.stringify(report, null, 2)}\n`);
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } catch (error) {
    const report = { checks, measurements, consoleIssues, expectedConsoleIssues, outsideRequests, expectedFailures, failure: error.stack };
    await fs.writeFile(path.join(evidence, 'browser-results.json'), `${JSON.stringify(report, null, 2)}\n`);
    process.stderr.write(`${JSON.stringify(report, null, 2)}\n`);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
