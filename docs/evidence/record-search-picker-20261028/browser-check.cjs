const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const http = require('node:http');
const path = require('node:path');
const { chromium } = require(process.env.BEAN_CARD_PLAYWRIGHT_MODULE || 'playwright');

const root = process.cwd();
const evidence = path.join(root, 'docs/evidence/record-search-picker-20261028');
const beans = Array.from({ length: 12 }, (_, index) => ({
  id: `11111111-1111-4111-8111-${String(index + 1).padStart(12, '0')}`,
  name: index === 0 ? '시다마 브라우저 원두' : `브라우저 원두 ${index + 1}`,
  origin: index === 0 ? '에티오피아 시다마' : '테스트 농장',
  process: index === 0 ? '워시드' : '내추럴',
  roaster: '검증 로스터',
}));
const recipes = [
  { id: '33333333-3333-4333-8333-333333333331', name: 'V60 브라우저 레시피', beanId: beans[0].id,
    dripper: 'V60', dose: 15, temperature: 93, totalWater: 250, steps: [] },
];

const fixture = `<!doctype html>
<html lang="ko">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/styles.css"><title>기록 검색 선택창 검증</title></head>
<body><main class="page"><header class="site-header"><span class="eyebrow">BEAN POCKET</span><div class="header-tools"><span id="connection-tools"></span></div></header><section id="app-root" class="bean-section" aria-label="나의 커피 노트"></section></main>
<script type="module">
import { createAppView } from '/ui/view.mjs';
const beans = ${JSON.stringify(beans)};
const recipes = ${JSON.stringify(recipes)};
const view = createAppView(document);
const makePage = (kind, query, cursor) => {
  const all = (kind === 'beans' ? beans : recipes).filter(item => item.name.toLowerCase().includes(query.trim().toLowerCase()));
  const start = cursor ? Number(cursor) : 0;
  const items = all.slice(start, start + 5).map(item => ({ id: item.id, name: item.name,
    ...(kind === 'recipes' ? { beanId: item.beanId } : {}), status: 'ready' }));
  const next = start + items.length;
  const hasMore = next < all.length;
  return { items, nextCursor: hasMore ? String(next) : null, hasMore, complete: !hasMore };
};
view.bind({
  getState() { return { pending: false, frozen: false, unresolved: false }; },
  setDirty() {},
  setRecordFilters() { return Promise.resolve(); },
  submit() { window.recordSubmitCount = (window.recordSubmitCount ?? 0) + 1; return Promise.resolve(); },
  loadSearchOptions(kind, query, cursor, target, append) {
    const page = makePage(kind, query, cursor);
    view.setSearchOptions(target, kind, page, append, query);
    return Promise.resolve(page);
  },
});
view.showConnection({ connected: true });
view.renderData({ beans, recipes, records: [], screen: { complete: true, hasMore: false, filters: { beanId: '', recipeId: '' } } });
view.renderRoute('/records');
</script></body></html>`;

const contentTypes = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.mjs', 'text/javascript; charset=utf-8'],
]);

async function main() {
  const server = http.createServer(async (request, response) => {
    const pathname = new URL(request.url, 'http://127.0.0.1').pathname;
    if (pathname === '/fixture') {
      response.setHeader('Content-Type', 'text/html; charset=utf-8');
      response.end(fixture);
      return;
    }
    if (pathname === '/favicon.ico') return response.writeHead(204).end();
    const dist = path.resolve(root, 'dist');
    const file = path.resolve(dist, `.${pathname}`);
    if (!file.startsWith(`${dist}${path.sep}`)) return response.writeHead(400).end();
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
    browser = await chromium.launch({ headless: true,
      ...(process.env.BEAN_CARD_CHROMIUM_EXECUTABLE ? { executablePath: process.env.BEAN_CARD_CHROMIUM_EXECUTABLE } : {}) });
    const results = [];
    for (const width of [390, 1440]) {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(`http://127.0.0.1:${server.address().port}/fixture`);

      const beanTrigger = page.locator('.record-filters .search-picker-trigger').first();
      assert.equal(await beanTrigger.textContent(), '모든 원두');
      await beanTrigger.click();
      const filterPicker = page.locator('#filters-beans-option-picker');
      await filterPicker.waitFor({ state: 'visible' });
      assert.equal(await filterPicker.getAttribute('aria-modal'), 'true');
      const search = filterPicker.locator('[data-option-search-kind="beans"]');
      assert.equal(await search.evaluate(node => node === document.activeElement), true);
      const dialogLayout = await filterPicker.evaluate(node => ({
        position: getComputedStyle(node).position,
        width: node.getBoundingClientRect().width,
        top: node.getBoundingClientRect().top,
        bottom: node.getBoundingClientRect().bottom,
      }));
      if (width < 600) {
        assert.equal(dialogLayout.position, 'fixed');
        assert.ok(dialogLayout.top > 300, JSON.stringify(dialogLayout));
        assert.ok(dialogLayout.bottom >= 890, JSON.stringify(dialogLayout));
      } else {
        assert.ok(dialogLayout.width <= 522, JSON.stringify(dialogLayout));
        assert.ok(dialogLayout.top > 100 && dialogLayout.top < 400, JSON.stringify(dialogLayout));
      }

      await search.fill('시다마');
      await filterPicker.locator('[data-option-id]').first().waitFor();
      assert.equal(await filterPicker.locator('.search-picker-result').count(), 1);
      await filterPicker.getByRole('button', { name: '검색어 지우기' }).click();
      await filterPicker.locator('[data-option-id]').first().waitFor();
      await filterPicker.getByRole('button', { name: '이름 더 보기' }).click();
      await filterPicker.locator('[data-option-id]').last().waitFor();
      await filterPicker.locator('[data-option-id]').first().click();
      assert.match(await beanTrigger.textContent(), /시다마 브라우저 원두/);
      assert.match(await beanTrigger.textContent(), /에티오피아 시다마/);
      const recipeTrigger = page.locator('.record-filters .search-picker-trigger').nth(1);
      assert.equal(await recipeTrigger.getAttribute('aria-label'), '모든 레시피');
      await recipeTrigger.click();
      const recipePicker = page.locator('#filters-recipes-option-picker');
      await recipePicker.locator('[data-option-id]').first().waitFor();
      await recipePicker.locator('[data-option-id]').first().click();
      await page.getByRole('button', { name: '필터 초기화', exact: true }).click();
      assert.equal(await beanTrigger.textContent(), '모든 원두');
      assert.equal(await recipeTrigger.textContent(), '모든 레시피');

      await page.screenshot({ path: path.join(evidence, `picker-${width}.png`), fullPage: true });
      await page.getByRole('button', { name: '새 추출 기록 추가' }).click();
      const entryDialog = page.locator('[data-entry-dialog="records"]');
      await entryDialog.waitFor({ state: 'visible' });
      await entryDialog.locator('[data-option-select-kind="beans"]').evaluate(node => { node.value = ''; });
      await entryDialog.locator('[data-option-select-kind="recipes"]').evaluate(node => { node.value = ''; });
      await entryDialog.locator('[name="date"]').fill('2026-10-28');
      await entryDialog.locator('[name="rating"][value="5"]').check();
      await entryDialog.locator('[data-entry-submit]').click();
      const nestedPicker = entryDialog.locator('#form-beans-option-picker');
      await nestedPicker.waitFor({ state: 'visible' });
      await page.keyboard.press('Escape');
      assert.equal(await nestedPicker.isVisible(), false);
      assert.equal(await entryDialog.evaluate(node => node.open), true, 'Escape closes only the nested picker');
      assert.equal(await page.evaluate(() => document.activeElement.matches('[data-action="open-search-picker"]')), true);
      assert.equal(await page.evaluate(() => window.recordSubmitCount ?? 0), 0, 'invalid record selection never reaches submit');
      assert.deepEqual(errors, []);
      results.push({ width, dialogLayout, filterSearchAndClear: true, pagination: true, selectedDetails: true,
        filterReset: true, nestedEscape: true, customRequiredValidation: true, pageErrors: errors });
      await page.close();
    }
    await fs.writeFile(path.join(evidence, 'browser.json'), JSON.stringify(results, null, 2));
    console.log(JSON.stringify(results));
  } finally {
    await browser?.close();
    await new Promise(resolve => server.close(resolve));
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
