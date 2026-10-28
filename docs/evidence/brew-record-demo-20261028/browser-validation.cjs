const assert = require('node:assert/strict');
const { chromium } = require('/Users/kangseokgyu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const path = require('node:path');

const evidenceDirectory = path.join(process.cwd(), 'docs/evidence/brew-record-demo-20261028');
const baseUrl = 'http://127.0.0.1:4188/bean-pocket';

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
  const errors = [];
  const badResponses = [];
  const requests = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('request', request => requests.push(request.url()));
  page.on('response', response => { if (response.status() >= 400) badResponses.push(`${response.status()} ${response.url()}`); });

  try {
    await page.goto(`${baseUrl}/records-demo.html`, { waitUntil: 'networkidle' });
    assert.equal(await page.title(), '추출 기록 비교 데모 · Bean Pocket');
    assert.equal(await page.locator('.bean-option').count(), 3);
    assert.equal(await page.locator('.bean-option[aria-pressed="true"]').count(), 1);
    assert.match(await page.locator('.bean-option').first().innerText(), /최고 5\.0점.*2026/);
    assert.match(await page.locator('.bean-option').first().innerText(), /V60|오리가미|칼리타/);
    assert.match(await page.locator('#best-brew').innerText(), /5\.0점/);
    assert.match(await page.locator('#best-brew').innerText(), /로스팅 후/);
    assert.match(await page.locator('#best-brew').innerText(), /분쇄/);
    assert.match(await page.locator('#best-brew').innerText(), /물 온도/);
    assert.match(await page.locator('#best-brew').innerText(), /도징 \/ 물/);
    assert.match(await page.locator('#best-brew').innerText(), /추출 시간/);

    for (const width of [320, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: width === 320 ? 2800 : 1600 });
      const layout = await page.evaluate(() => ({
        viewport: innerWidth,
        document: document.documentElement.scrollWidth,
        gridColumns: getComputedStyle(document.querySelector('.demo-layout')).gridTemplateColumns,
        cardsDisplay: getComputedStyle(document.querySelector('.record-cards')).display,
      }));
      assert.ok(layout.document <= width, `${width}px horizontal overflow: ${JSON.stringify(layout)}`);
      if (width <= 720) assert.equal(layout.cardsDisplay, 'grid');
      if (width >= 1024) assert.notEqual(layout.gridColumns.split(' ').length, 1);
      await page.screenshot({ path: path.join(evidenceDirectory, `screen-${width}.png`), fullPage: false });
    }

    await page.locator('button[data-bean-id="huila"]').focus();
    await page.keyboard.press('Enter');
    assert.equal(await page.locator('#selected-bean-name').innerText(), '콜롬비아 우일라');
    assert.equal(await page.locator('button[data-bean-id="huila"]').getAttribute('aria-pressed'), 'true');
    await page.locator('#recipe-filter').selectOption('칼리타');
    assert.equal(await page.locator('#records-table-body tr').count(), 2);
    await page.locator('#record-sort').selectOption('rating-desc');
    assert.equal(await page.locator('#records-table-body tr').first().locator('.rating-number').innerText(), '5.0점');
    await page.locator('#recipe-filter').selectOption('에어로프레스');
    assert.equal(await page.locator('#records-table-region').isVisible(), false);
    assert.match(await page.locator('#record-empty').innerText(), /조건에 맞는 샘플 기록이 없습니다/);
    await page.locator('#recipe-filter').selectOption('all');
    await page.locator('#record-sort').selectOption('date-asc');
    assert.equal(await page.locator('#records-table-body tr').count(), 4);
    assert.equal(await page.locator('#records-table-body tr').first().locator('.record-date strong').innerText(), '2026. 10. 11.');

    await page.setViewportSize({ width: 320, height: 1000 });
    await page.locator('#recipe-filter').selectOption('all');
    assert.equal(await page.locator('#records-cards li').count(), 4);
    assert.equal(await page.locator('.table-scroll').isVisible(), false);
    assert.match(await page.locator('#records-cards').innerText(), /분쇄/);
    assert.match(await page.locator('#records-cards').innerText(), /컵노트/);
    assert.deepEqual(errors, []);
    assert.deepEqual(badResponses, []);
    assert.ok(requests.every(url => url.startsWith(baseUrl)), `Unexpected request: ${requests.join(', ')}`);
    console.log(`PASS: 3 beans; computed best record; keyboard selection; recipe/date/rating filters; empty state; mobile cards; no overflow/errors/bad responses/external requests. Requests: ${requests.length}`);
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
