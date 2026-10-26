const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const http = require('node:http');
const path = require('node:path');
const { chromium } = require(process.env.BEAN_CARD_PLAYWRIGHT_MODULE || 'playwright');
const root = process.cwd();
const evidence = path.join(root, 'docs/evidence/recipe-card-detail-20261026');
const recipeId = '33333333-3333-4333-8333-333333333333';
const fixture = `<!doctype html>
<html lang="ko">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/styles.css"><title>레시피 가이드 브라우저 검증</title></head>
<body><main class="page"><header class="site-header"><span class="eyebrow">BEAN POCKET</span><div class="header-tools"><span id="connection-tools"></span></div></header><section id="app-root" class="bean-section" aria-label="나의 커피 노트"></section></main>
<script type="module">
import { createAppView } from '/ui/view.mjs';
const recipeId = '${recipeId}';
const view = createAppView(document);
const actions = new Proxy({}, { get: () => () => {} });
view.bind(actions);
view.showConnection({ connected: true });
view.renderData({
  beans: [{ id: '11111111-1111-4111-8111-111111111111', name: '검증용 원두', origin: '테스트 농장', roaster: '테스트 로스터', variety: '', process: '', tastingNotes: '' }],
  bags: [],
  recipes: [{ id: recipeId, name: '브라우저 검증 레시피', beanId: '11111111-1111-4111-8111-111111111111', dripper: 'V60', dose: 15, grind: '중간', grinder: '', grinderSetting: '', microns: null, temperature: 93, totalWater: 250, extractionGuide: '교반 없음\\n목표 추출 완료 시간: 2분 30초', stats: { count: 0, average: null }, steps: [
    { id: '44444444-4444-4444-8444-444444444444', name: '뜸', seconds: 0, interval: 0, water: 50, cumulativeWater: 50 },
    { id: '55555555-5555-4555-8555-555555555555', name: '붓기', seconds: 150, interval: 150, water: 200, cumulativeWater: 250 },
  ] }],
  records: [],
});
view.renderRoute('/recipes');
</script></body></html>`;

const contentTypes = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.mjs', 'text/javascript; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
]);

async function main() {
  const server = http.createServer(async (request, response) => {
    const pathname = new URL(request.url, 'http://127.0.0.1').pathname;
    if (pathname === '/fixture') {
      response.setHeader('Content-Type', 'text/html; charset=utf-8');
      response.end(fixture);
      return;
    }
    if (pathname === '/favicon.ico') {
      response.writeHead(204).end();
      return;
    }
    const file = path.resolve(root, 'dist', `.${pathname}`);
    if (!file.startsWith(path.resolve(root, 'dist') + path.sep)) {
      response.writeHead(400).end();
      return;
    }
    try {
      response.setHeader('Content-Type', contentTypes.get(path.extname(file)) ?? 'application/octet-stream');
      response.end(await fs.readFile(file));
    } catch {
      response.writeHead(404).end();
    }
  });

  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch({
      headless: true,
      ...(process.env.BEAN_CARD_CHROMIUM_EXECUTABLE
        ? { executablePath: process.env.BEAN_CARD_CHROMIUM_EXECUTABLE }
        : {}),
    });
    const results = [];
    for (const width of [320, 390, 768, 1024, 1440]) {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(`http://127.0.0.1:${server.address().port}/fixture`);
      const card = page.locator('.recipe-summary-card');
      await card.waitFor();
      assert.equal(await card.locator('button').count(), 1);
      assert.equal(await card.locator('a').getAttribute('href'), '#/recipes/' + recipeId);
      assert.equal(await page.getByRole('button', { name: '레시피 상세 보기', exact: true }).count(), 0);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      const rect = await card.boundingBox();
      await page.mouse.move(0, 0);
      await page.waitForTimeout(200);
      const initial = await card.evaluate(node => getComputedStyle(node).backgroundColor);
      await page.mouse.move(rect.x + rect.width / 2, rect.y + rect.height / 2);
      await page.waitForTimeout(200);
      await page.screenshot({ path: path.join(evidence, `recipe-hover-${width}.png`), fullPage: true });
      assert.notEqual(await card.evaluate(node => getComputedStyle(node).backgroundColor), initial,
        JSON.stringify(await page.evaluate(({ x, y }) => ({ media: matchMedia('(hover: hover) and (pointer: fine)').matches, hit: document.elementFromPoint(x, y)?.outerHTML, cardHover: document.querySelector('.recipe-summary-card').matches(':hover') }), { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 })));
      await page.screenshot({ path: path.join(evidence, `recipe-hover-${width}.png`), fullPage: true });
      const summary = await card.locator('p').boundingBox();
      await page.mouse.click(summary.x + summary.width / 2, summary.y + summary.height / 2);
      await page.getByRole('button', { name: '이 레시피 복사', exact: true }).waitFor();
      assert.equal(await page.locator('.recipe-card-link').count(), 0);
      assert.equal(await page.locator('.recipe-extraction-guide').count(), 1);
      await page.getByRole('button', { name: '레시피 목록으로 돌아가기', exact: true }).click();
      const padding = await card.boundingBox();
      await page.mouse.click(padding.x + padding.width / 2, padding.y + padding.height - 5);
      await page.getByRole('button', { name: '이 레시피 복사', exact: true }).waitFor();
      await page.getByRole('button', { name: '레시피 목록으로 돌아가기', exact: true }).click();
      await page.locator('.recipe-card-link').focus();
      await page.keyboard.press('Enter');
      await page.getByRole('button', { name: '이 레시피 복사', exact: true }).waitFor();
      await page.getByRole('button', { name: '이 레시피 복사', exact: true }).click();
      assert.equal(await page.locator('form[data-form="recipes"] input[name="name"]').inputValue(), '브라우저 검증 레시피 복사');
      await page.getByRole('button', { name: '입력 취소', exact: true }).click();
      await page.getByRole('button', { name: '레시피', exact: true }).click();
      await page.locator('.recipe-card-link').focus();
      await page.keyboard.press('Tab');
      assert.equal(await card.locator('button').evaluate(node => node === document.activeElement), true);
      let dialogs = 0;
      page.on('dialog', async dialog => { dialogs++; await dialog.dismiss(); });
      await card.getByRole('button', { name: '브라우저 검증 레시피 삭제', exact: true }).click();
      assert.equal(dialogs, 1);
      assert.equal(await card.count(), 1);
      assert.deepEqual(errors, []);
      results.push({ width, summaryAndPaddingClick: true, keyboard: true, deleteIsolated: true, copyWorks: true, hover: true, errors });
      await page.close();
    }
    const page = await browser.newPage({ viewport: { width: 390, height: 900 }, hasTouch: true, isMobile: true });
    await page.goto(`http://127.0.0.1:${server.address().port}/fixture`);
    await page.locator('.recipe-card-link').tap();
    await page.getByRole('button', { name: '이 레시피로 추출 기록', exact: true }).click();
    assert.equal(await page.locator('form[data-form="records"] select[name="recipeId"]').inputValue(), recipeId);
    results.push({ touchNavigation: true, detailRecordAction: true });
    await page.close();
    await fs.writeFile(path.join(evidence, 'browser.json'), JSON.stringify(results, null, 2));
    console.log(JSON.stringify(results));
  } finally {
    await browser?.close();
    await new Promise(resolve => server.close(resolve));
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
