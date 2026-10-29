const assert = require('node:assert/strict');
const { chromium } = require('/Users/kangseokgyu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const path = require('node:path');

const evidenceDirectory = path.join(process.cwd(), 'docs/evidence/brew-record-trend-20261029');
const baseUrl = 'http://127.0.0.1:4188/bean-pocket';

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
  const errors = [];
  const badResponses = [];
  const failedRequests = [];
  const requests = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error' || message.type() === 'warning') errors.push(`${message.type()}: ${message.text()}`); });
  page.on('request', request => requests.push(request.url()));
  page.on('requestfailed', request => failedRequests.push(`${request.failure()?.errorText} ${request.url()}`));
  page.on('response', response => { if (response.status() >= 400) badResponses.push(`${response.status()} ${response.url()}`); });

  try {
    await page.goto(`${baseUrl}/records-demo.html`, { waitUntil: 'networkidle' });
    assert.equal(await page.title(), '추출 기록 비교 데모 · Bean Pocket');
    assert.equal(await page.locator('.bean-option').count(), 3);
    assert.deepEqual(await page.locator('.bean-option-name').allInnerTexts(), ['케냐 키리냐가', '콜롬비아 우일라', '에티오피아 구지']);
    assert.equal(await page.locator('.bean-option[aria-pressed="true"]').count(), 1);
    assert.equal(await page.locator('.bean-option[aria-pressed="true"]').getAttribute('data-bean-id'), 'kirinyaga');
    assert.match(await page.locator('.bean-option').first().innerText(), /최근 2026\. 10\. 25\..*5\.0점/);
    assert.match(await page.locator('.bean-option').first().innerText(), /오리가미/);
    assert.match(await page.locator('#best-brew').innerText(), /5\.0점/);
    assert.match(await page.locator('#best-brew').innerText(), /물 온도/);
    assert.match(await page.locator('#best-brew').innerText(), /도징 \/ 물/);
    assert.match(await page.locator('#best-brew').innerText(), /추출 시간/);

    const selectedChart = page.locator('#rating-trend');
    assert.equal(await selectedChart.getAttribute('role'), 'img');
    assert.equal(await selectedChart.getAttribute('aria-labelledby'), 'rating-trend-title rating-trend-description');
    assert.match(await page.locator('#rating-trend-description').textContent(), /실제 날짜 간격.*1점부터 5점/);
    assert.deepEqual(await page.locator('.trend-point').evaluateAll(points => points.map(point => point.dataset.trendDate)), [
      '2026-10-13', '2026-10-16', '2026-10-20', '2026-10-25',
    ]);
    assert.deepEqual(await page.locator('#trend-axis .trend-axis-rating').evaluateAll(nodes => nodes.map(node => node.textContent)), ['5', '4', '3', '2', '1']);
    assert.deepEqual(await page.locator('#trend-series .trend-point-rating').evaluateAll(nodes => nodes.map(node => node.textContent)), ['4점', '5점', '4점', '5점']);
    assert.match(await page.locator('#rating-trend-summary').innerText(), /전체 4회/);
    const xPositions = await page.locator('.trend-point circle').evaluateAll(points => points.map(point => Number(point.getAttribute('cx'))));
    const gaps = xPositions.slice(1).map((x, index) => x - xPositions[index]);
    assert.ok(Math.abs(gaps[1] / gaps[0] - 4 / 3) < 0.02, `Expected date-scaled 3:4 day gaps, got ${gaps}`);
    assert.ok(Math.abs(gaps[2] / gaps[0] - 5 / 3) < 0.02, `Expected date-scaled 3:5 day gaps, got ${gaps}`);

    for (const width of [320, 550, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: width <= 550 ? 2400 : 1600 });
      const layout = await page.evaluate(() => ({
        viewport: innerWidth,
        document: document.documentElement.scrollWidth,
        gridColumns: getComputedStyle(document.querySelector('.demo-layout')).gridTemplateColumns,
        cardsDisplay: getComputedStyle(document.querySelector('.record-cards')).display,
        chartWidth: document.querySelector('#rating-trend').getBoundingClientRect().width,
      }));
      assert.ok(layout.document <= width, `${width}px horizontal overflow: ${JSON.stringify(layout)}`);
      assert.ok(layout.chartWidth > 0, `${width}px chart is not visible: ${JSON.stringify(layout)}`);
      if (width <= 720) assert.equal(layout.cardsDisplay, 'grid');
      if (width >= 1024) assert.notEqual(layout.gridColumns.split(' ').length, 1);
      await page.screenshot({ path: path.join(evidenceDirectory, `screen-${width}.png`), fullPage: false });
    }

    await page.locator('button[data-bean-id="huila"]').focus();
    await page.keyboard.press('Enter');
    assert.equal(await page.locator('#selected-bean-name').innerText(), '콜롬비아 우일라');
    assert.equal(await page.locator('button[data-bean-id="huila"]').getAttribute('aria-pressed'), 'true');
    assert.deepEqual(await page.locator('.trend-point').evaluateAll(points => points.map(point => point.dataset.trendDate)), [
      '2026-10-11', '2026-10-14', '2026-10-18', '2026-10-23',
    ]);
    assert.equal(await page.locator('#rating-trend-text summary').innerText(), '그래프를 텍스트로 보기 (4건)');
    await page.locator('#rating-trend-text summary').click();
    assert.equal(await page.locator('#rating-trend-list li').count(), 4);
    assert.match(await page.locator('#rating-trend-list').innerText(), /2026\. 10\. 11\..*3\.0점/);

    await page.locator('#recipe-filter').selectOption('칼리타');
    assert.equal(await page.locator('#records-table-body tr').count(), 2);
    assert.equal(await page.locator('.trend-point').count(), 4, '레시피 필터는 전체 기록 그래프에 적용하지 않는다');
    await page.locator('#record-sort').selectOption('rating-desc');
    assert.equal(await page.locator('#records-table-body tr').first().locator('.rating-number').innerText(), '5.0점');
    await page.locator('#recipe-filter').selectOption('에어로프레스');
    assert.equal(await page.locator('#records-table-region').isVisible(), false);
    assert.match(await page.locator('#record-empty').innerText(), /조건에 맞는 샘플 기록이 없습니다/);
    assert.equal(await page.locator('.trend-point').count(), 4);
    await page.locator('#recipe-filter').selectOption('all');
    await page.locator('#record-sort').selectOption('date-asc');
    assert.equal(await page.locator('#records-table-body tr').count(), 4);
    assert.equal(await page.locator('#records-table-body tr').first().locator('.record-date strong').innerText(), '2026. 10. 11.');

    await page.setViewportSize({ width: 320, height: 1000 });
    assert.equal(await page.locator('#records-cards li').count(), 4);
    assert.equal(await page.locator('.table-scroll').isVisible(), false);
    assert.match(await page.locator('#records-cards').innerText(), /분쇄/);
    assert.match(await page.locator('#records-cards').innerText(), /컵노트/);
    assert.deepEqual(errors, []);
    assert.deepEqual(badResponses, []);
    assert.deepEqual(failedRequests, []);
    assert.ok(requests.every(url => url.startsWith(baseUrl)), `Unexpected request outside local demo: ${requests.join(', ')}`);
    console.log(`PASS: 3 distinct recent beans; default most-recent selection; best-record details; date-scaled SVG and fixed 1–5 axis; keyboard selection; graph text alternative; recipe filter limited to table/cards; responsive widths 320/550/768/1024/1440; no overflow, console errors/warnings, failed/bad or external requests. Requests: ${requests.length}`);
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
