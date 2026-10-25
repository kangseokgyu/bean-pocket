const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const http = require('node:http');
const path = require('node:path');
const { chromium } = require(process.env.RECIPE_GUIDE_PLAYWRIGHT_MODULE ?? 'playwright');

const root = process.cwd();
const evidence = path.join(root, 'docs/evidence/recipe-guide-20261025');
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
view.renderRoute('/recipes/' + recipeId);
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
      ...(process.env.RECIPE_GUIDE_CHROMIUM_EXECUTABLE
        ? { executablePath: process.env.RECIPE_GUIDE_CHROMIUM_EXECUTABLE }
        : {}),
    });
    const results = [];
    for (const width of [320, 390, 1440]) {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      page.on('response', response => {
        if (response.status() >= 400) errors.push(`${response.status()} ${new URL(response.url()).pathname}`);
      });
      await page.goto(`http://127.0.0.1:${server.address().port}/fixture`);
      const recipe = page.locator('.recipe-card');
      const guide = recipe.locator('.recipe-extraction-guide');
      await guide.waitFor();
      const layout = await page.evaluate(() => {
        const card = document.querySelector('.recipe-card');
        const table = card.querySelector('.table-scroll');
        const guide = card.querySelector('.recipe-extraction-guide');
        const records = [...card.querySelectorAll('h4')].find(element => element.textContent === '추출 기록');
        const children = [...card.children];
        const tableRect = table.getBoundingClientRect();
        const guideRect = guide.getBoundingClientRect();
        const recordsRect = records.getBoundingClientRect();
        return {
          viewport: innerWidth,
          documentWidth: document.documentElement.scrollWidth,
          pageOverflow: document.documentElement.scrollWidth > innerWidth,
          guideOrder: children.indexOf(guide) > children.indexOf(table) && children.indexOf(guide) < children.indexOf(records),
          guideBelowTable: guideRect.top >= tableRect.bottom,
          guideAboveRecords: guideRect.bottom <= recordsRect.top,
          tableTop: Math.round(tableRect.top),
          guideTop: Math.round(guideRect.top),
          recordsTop: Math.round(recordsRect.top),
          guideWhiteSpace: getComputedStyle(guide.querySelector('p')).whiteSpace,
        };
      });
      assert.equal(layout.pageOverflow, false, `${width}px detail overflows the viewport`);
      assert.equal(layout.guideOrder, true, 'guide must be between the pour table and records heading in DOM order');
      assert.equal(layout.guideBelowTable, true, 'guide must render below the pour table');
      assert.equal(layout.guideAboveRecords, true, 'guide must render above extraction records');
      assert.equal(layout.guideWhiteSpace, 'pre-wrap', 'multiline guide must retain its line breaks');
      await page.screenshot({ path: path.join(evidence, `recipe-guide-${width}.png`), fullPage: true });

      await recipe.getByRole('button', { name: '이 레시피 복사' }).click();
      const form = page.locator('form[data-form="recipes"]');
      const textarea = form.locator('textarea[name="extractionGuide"]');
      await textarea.waitFor();
      assert.equal(await textarea.inputValue(), '교반 없음\n목표 추출 완료 시간: 2분 30초', 'copy must preserve the source guide');
      assert.equal(await textarea.getAttribute('placeholder'), '예: 교반 없음, 목표 2분 30초 완성');
      assert.equal(await textarea.evaluate(element => element.closest('label')?.querySelector('.form-field-label')?.textContent.trim()), '추출 가이드 (선택)');
      assert.equal(await page.getByLabel('추출 가이드 (선택)', { exact: true }).count(), 1, 'guide textarea must have an accessible label');
      await textarea.fill('교반 한 번\n목표 추출 완료 시간: 3분');
      assert.equal(await textarea.inputValue(), '교반 한 번\n목표 추출 완료 시간: 3분', 'textarea accepts multiline free text');
      const formLayout = await page.evaluate(() => ({
        viewport: innerWidth,
        documentWidth: document.documentElement.scrollWidth,
        formWidth: Math.round(document.querySelector('form[data-form="recipes"]').getBoundingClientRect().width),
        textareaWidth: Math.round(document.querySelector('textarea[name="extractionGuide"]').getBoundingClientRect().width),
      }));
      assert.equal(formLayout.documentWidth > width, false, `${width}px form overflows the viewport`);
      assert.ok(formLayout.textareaWidth <= formLayout.formWidth, 'textarea must fit inside the recipe form');
      await textarea.scrollIntoViewIfNeeded();
      await page.screenshot({ path: path.join(evidence, `recipe-guide-form-${width}.png`) });
      assert.deepEqual(errors, [], `browser errors at ${width}px`);
      results.push({ ...layout, form: formLayout, interaction: 'copy preserved source guide; multiline edit accepted', errors });
      await page.close();
    }
    await fs.writeFile(path.join(evidence, 'browser-results.json'), `${JSON.stringify({ browser: 'Chromium headless', viewports: results }, null, 2)}\n`);
    console.log(`PASS: ${results.length} viewports (320/390/1440px); detail order, multiline text, copy/input, responsive form, no overflow or browser errors`);
  } finally {
    await browser?.close();
    await new Promise(resolve => server.close(resolve));
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
