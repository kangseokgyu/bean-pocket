const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const http = require('node:http');
const path = require('node:path');
const { chromium } = require('/Users/kangseokgyu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');

const root = path.resolve(__dirname, '../../..');
const evidence = __dirname;
const browserPath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const checks = [];
const consoleIssues = [];
const outsideRequests = [];
const measurements = {};

function check(name, detail = true) {
  assert.ok(detail, name);
  checks.push(name);
}

const harness = `<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="stylesheet" href="/pwa/styles.css"><title>삭제 모달 브라우저 검증</title></head>
<body><main class="page"><header class="site-header"><span class="header-tools"></span></header>
<section id="app-root" class="bean-section" aria-label="나의 커피 노트"></section></main>
<script type="module">
import { createAppView } from '/pwa/ui/view.mjs';
const beanId = '11111111-1111-4111-8111-111111111111';
const recipeId = '33333333-3333-4333-8333-333333333333';
const view = createAppView(document);
view.renderRoute('/beans');
view.renderData({
  beans: [{ id: beanId, name: '원두 <안전>', origin: '시다마' }], bags: [],
  recipes: [{ id: recipeId, beanId, name: 'V60', dripper: 'V60', dose: 15, grind: '중간', grinder: '테스트', grinderSetting: '24', microns: null, temperature: 93, totalWater: 250, stats: { count: 0, average: null }, steps: [] }],
  records: [{ id: '66666666-6666-4666-8666-666666666666', beanId, beanResolution: 'relation', recipeId, date: '2026-10-27', rating: 5, cupNote: '테스트', snapshotStatus: 'valid', snapshot: { version: 1, recordGeneration: 'bagless-v1', id: recipeId, beanId, name: 'V60', steps: [] } }],
});
view.showConnection({ connected: true });
const pending = [];
window.control = { calls: [], pending,
  resolveNext(status, message) {
    const request = pending.shift();
    if (!request) throw new Error('삭제 요청이 대기 중이 아닙니다.');
    view.showDeleteResult({ status, message });
    request.resolve({ status, message });
  },
};
window.fixture = { view };
view.bind({ getState: () => ({ pending: pending.length > 0, frozen: false, unresolved: false }),
  submit(action, payload) {
    window.control.calls.push({ action, payload });
    return new Promise(resolve => pending.push({ resolve }));
  },
});
window.fixtureReady = true;
</script></body></html>`;

const server = http.createServer(async (request, response) => {
  try {
    const pathname = new URL(request.url, 'http://127.0.0.1').pathname;
    if (pathname === '/harness') {
      response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }).end(harness);
      return;
    }
    if (pathname === '/favicon.ico') {
      response.writeHead(204).end();
      return;
    }
    const file = path.resolve(root, `.${pathname}`);
    if (!file.startsWith(`${root}${path.sep}`)) throw new Error('Path outside project root');
    const extension = path.extname(file);
    const contentType = extension === '.css' ? 'text/css; charset=utf-8'
      : ['.mjs', '.js'].includes(extension) ? 'text/javascript; charset=utf-8' : 'application/octet-stream';
    response.writeHead(200, { 'content-type': contentType }).end(await fs.readFile(file));
  } catch {
    response.writeHead(404).end();
  }
});

(async () => {
  let browser;
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    browser = await chromium.launch({ headless: true, executablePath: browserPath });
    const origin = `http://127.0.0.1:${server.address().port}`;
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: 'block' });
    await context.route('**/*', route => {
      if (route.request().url().startsWith(`${origin}/`)) return route.continue();
      outsideRequests.push(route.request().url());
      return route.abort();
    });
    const page = await context.newPage();
    page.setDefaultTimeout(7000);
    page.on('console', message => {
      if (['error', 'warning'].includes(message.type())) consoleIssues.push(`${message.type()}: ${message.text()}`);
    });
    page.on('pageerror', error => consoleIssues.push(`pageerror: ${error.message}`));
    await page.goto(`${origin}/harness`);
    await page.waitForFunction(() => window.fixtureReady);

    const dialog = page.getByRole('dialog');
    const trash = page.getByRole('button', { name: '원두 <안전> 삭제' });
    await trash.focus();
    await page.keyboard.press('Enter');
    await dialog.waitFor({ state: 'visible' });
    check('Enter opens the native accessible dialog');
    check('initial focus moves to Cancel', await page.evaluate(() => document.activeElement?.dataset.action === 'cancel-delete'));
    check('untrusted target name is visible as text', await dialog.locator('.delete-confirm-target').textContent() === '원두 <안전>');
    check('bean dependency restriction is explained', await dialog.locator('.delete-confirm-description').textContent().then(text => text.includes('연결된 추출 기록이 있으면 삭제할 수 없습니다')));

    await page.waitForTimeout(180);
    const dimensions = await dialog.evaluate(node => {
      const cancel = node.querySelector('[data-action="cancel-delete"]');
      const remove = node.querySelector('[data-action="confirm-delete"]');
      const style = getComputedStyle(remove);
      return {
        dialogWidth: node.getBoundingClientRect().width,
        buttonHeights: [cancel, remove].map(button => button.getBoundingClientRect().height),
        gap: getComputedStyle(node.querySelector('.delete-confirm-actions')).gap,
        transition: style.transitionDuration,
        red: style.backgroundColor,
      };
    });
    measurements.desktop = dimensions;
    await page.screenshot({ path: path.join(evidence, 'desktop-dialog.png'), fullPage: true });
    check('desktop dialog and buttons render to spec', dimensions.dialogWidth <= 460 && dimensions.buttonHeights.every(height => height === 44) && dimensions.gap === '10px' && dimensions.transition.includes('0.14s') && dimensions.red === 'rgb(167, 51, 44)');

    await page.keyboard.press('Escape');
    await dialog.waitFor({ state: 'hidden' });
    check('Escape cancels and restores focus', await page.evaluate(() => document.activeElement?.getAttribute('aria-label') === '원두 <안전> 삭제'));
    await trash.click();
    check('global status toast stays hidden while the delete dialog is open', await page.locator('.app-status').evaluate(node => node.hidden));
    await dialog.locator('[data-action="cancel-delete"]').click();

    await trash.click();
    const confirm = dialog.locator('[data-action="confirm-delete"]');
    await confirm.click();
    await page.waitForFunction(() => window.control.calls.length === 1);
    check('delete request shows red spinner and disables both buttons', await confirm.isDisabled() && await dialog.locator('[data-action="cancel-delete"]').isDisabled() && await confirm.getAttribute('aria-busy') === 'true');
    const spinner = await confirm.locator('.button-icon').evaluate(node => ({ animation: getComputedStyle(node, '::after').animationName, svg: getComputedStyle(node.querySelector('svg')).display }));
    check('pending state renders spinner instead of trash icon', spinner.animation === 'action-button-spin' && spinner.svg === 'none');
    await page.screenshot({ path: path.join(evidence, 'desktop-spinner.png'), fullPage: true });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    check('reduced-motion preference disables spinner and button transitions', await confirm.locator('.button-icon').evaluate(node => getComputedStyle(node, '::after').animationName === 'none') && await confirm.evaluate(node => getComputedStyle(node).transitionDuration === '0s'));
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await confirm.evaluate(node => node.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    check('synthetic duplicate click does not dispatch a second request', await page.evaluate(() => window.control.calls.length === 1));
    await page.evaluate(() => window.control.resolveNext('succeeded', '삭제했습니다.'));
    await page.getByRole('button', { name: '삭제 완료' }).waitFor({ state: 'visible' });
    check('success check appears only after the delete result resolves', await confirm.locator('.button-icon').getAttribute('data-icon') === 'check');
    check('success feedback is announced in the dialog', await dialog.locator('.delete-confirm-feedback').textContent() === '삭제했습니다.');
    await page.screenshot({ path: path.join(evidence, 'desktop-success.png'), fullPage: true });
    await dialog.waitFor({ state: 'hidden', timeout: 2500 });
    check('successful dialog closes after its completion check', true);
    check('focus returns to the surviving trigger', await page.evaluate(() => document.activeElement?.getAttribute('aria-label') === '원두 <안전> 삭제'));

    for (const [route, name, heading, phrase] of [
      ['/recipes', 'V60', '레시피를 삭제할까요?', '추출 기록에서 사용 중인 레시피'],
      ['/records', '2026-10-27 · V60', '추출 기록을 삭제할까요?', '해당 추출 기록만'],
    ]) {
      await page.evaluate(routePath => window.fixture.view.renderRoute(routePath), route);
      const trigger = page.getByRole('button', { name: `${name} 삭제` });
      await trigger.click();
      check(`${route} uses the shared dialog`, await dialog.locator('h2').textContent() === heading && await dialog.locator('.delete-confirm-target').textContent() === name && (await dialog.locator('.delete-confirm-description').textContent()).includes(phrase));
      await dialog.getByRole('button', { name: '취소' }).click();
      check(`${route} cancel restores focus`, await trigger.evaluate(node => document.activeElement === node));
    }

    await page.evaluate(() => window.fixture.view.renderRoute('/beans'));
    await trash.click();
    await dialog.getByRole('button', { name: '삭제', exact: true }).click();
    await page.waitForFunction(() => window.control.calls.length === 2);
    await page.evaluate(() => window.control.resolveNext('failed', '삭제하지 못했습니다. 연결된 기록을 확인해 주세요.'));
    await dialog.locator('.delete-confirm-feedback').getByText('삭제하지 못했습니다. 연결된 기록을 확인해 주세요.').waitFor();
    check('known deletion failure stays visible and enables a deliberate retry', await dialog.locator('[data-action="confirm-delete"]').isEnabled());
    await page.screenshot({ path: path.join(evidence, 'desktop-failure.png'), fullPage: true });
    await dialog.getByRole('button', { name: '취소' }).click();
    check('failure dialog cancel restores focus', await page.evaluate(() => document.activeElement?.getAttribute('aria-label') === '원두 <안전> 삭제'));

    await trash.click();
    await dialog.getByRole('button', { name: '삭제', exact: true }).click();
    await page.waitForFunction(() => window.control.calls.length === 3);
    await page.evaluate(() => window.control.resolveNext('unknown', '삭제 여부 확인이 필요합니다. Notion 원본을 확인해 주세요.'));
    check('uncertain result blocks retry but remains dismissible', await dialog.locator('[data-action="confirm-delete"]').isDisabled() && await dialog.locator('[data-action="cancel-delete"]').isEnabled());
    await page.keyboard.press('Escape');
    await dialog.waitFor({ state: 'hidden' });
    check('Escape can dismiss a settled uncertain result', await page.evaluate(() => document.activeElement?.getAttribute('aria-label') === '원두 <안전> 삭제'));

    for (const width of [390, 320]) {
      await page.setViewportSize({ width, height: 844 });
      await trash.click();
      await page.waitForTimeout(180);
      const mobile = await dialog.evaluate(node => ({
        width: node.getBoundingClientRect().width,
        left: node.getBoundingClientRect().left,
        right: node.getBoundingClientRect().right,
        viewport: innerWidth,
        height: [...node.querySelectorAll('.action-button')].map(button => button.getBoundingClientRect().height),
      }));
      check(`${width}px modal fits without horizontal overflow`, mobile.left >= 0 && mobile.right <= width && mobile.width <= width - 32 && mobile.height.every(height => height === 44));
      if (width === 390) await page.screenshot({ path: path.join(evidence, 'mobile-dialog.png'), fullPage: true });
      await dialog.getByRole('button', { name: '취소' }).click();
    }

    await trash.click();
    await dialog.locator('[data-action="confirm-delete"]').click();
    await page.waitForFunction(() => window.control.calls.length === 4);
    await page.evaluate(() => document.querySelector('[data-action="delete-bean"]').closest('.bean-card').remove());
    await page.evaluate(() => window.control.resolveNext('succeeded', '삭제했습니다.'));
    await dialog.waitFor({ state: 'hidden', timeout: 2500 });
    check('focus falls back to the app content when a successful delete removes its trigger', await page.evaluate(() => document.activeElement?.classList.contains('app-content')));

    check('browser has no console errors or warnings', consoleIssues.length === 0);
    check('browser makes no external requests', outsideRequests.length === 0);
    const report = { browser: 'Google Chrome via Playwright', checks, measurements, consoleIssues, outsideRequests };
    await fs.writeFile(path.join(evidence, 'browser-results.json'), `${JSON.stringify(report, null, 2)}\n`);
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } catch (error) {
    const report = { checks, measurements, consoleIssues, outsideRequests, failure: error.stack };
    await fs.writeFile(path.join(evidence, 'browser-results.json'), `${JSON.stringify(report, null, 2)}\n`);
    process.stderr.write(`${JSON.stringify(report, null, 2)}\n`);
    process.exitCode = 1;
  } finally {
    await browser?.close();
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
})();
