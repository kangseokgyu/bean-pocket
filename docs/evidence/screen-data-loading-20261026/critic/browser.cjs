const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { spawn } = require('node:child_process');
const http = require('node:http');

const root = path.resolve(__dirname, '../../../../');
const port = Number(process.env.SCREEN_DATA_LOADING_PORT || 4271);
const base = `http://127.0.0.1:${port}`;
const output = '/private/tmp/screen-data-loading-critic';
const playwrightPath = '/Users/kangseokgyu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright';
const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const { chromium } = require(playwrightPath);

function healthCheck() {
  return new Promise(resolve => {
    const request = http.get(base + '/health', response => {
      response.resume();
      resolve(response.statusCode === 200);
    });
    request.on('error', () => resolve(false));
    request.setTimeout(500, () => { request.destroy(); resolve(false); });
  });
}

async function startServer() {
  const child = spawn(process.execPath, [path.join(__dirname, 'server.mjs')], {
    cwd: root, env: { ...process.env, SCREEN_DATA_LOADING_PORT: String(port) }, stdio: 'ignore',
  });
  for (let attempt = 0; attempt < 60; attempt++) {
    if (await healthCheck()) return child;
    if (child.exitCode !== null) throw new Error(`fixture server exited with ${child.exitCode}`);
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  child.kill('SIGTERM');
  throw new Error('fixture server did not become ready');
}

async function main() {
  await fs.mkdir(output, { recursive: true });
  const server = await startServer();
  const browser = await chromium.launch({ headless: true, executablePath: chromePath });
  const results = [];
  try {
    for (const width of [1280, 390]) {
      const context = await browser.newContext({ viewport: { width, height: 900 }, serviceWorkers: 'block' });
      const page = await context.newPage();
      const errors = [];
      const external = [];
      const checks = [];
      page.on('pageerror', error => errors.push(String(error)));
      page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
      await context.route('**/*', route => route.request().url().startsWith(base + '/')
        ? route.continue() : (external.push(route.request().url()), route.abort()));

      try {
        await page.goto(base);
        await page.waitForFunction(() => window.fixtureReady && !window.fixture.app.getState().pending);
        assert.equal(await page.evaluate(() => fixture.initialized), true);
        const sources = await page.evaluate(() => fixture.getSourceIds());
        const startupCalls = await page.evaluate(() => fixture.startupCalls);
        const allowedStartupPaths = new Set([
          `/v1/data_sources/${sources.beans}`,
          `/v1/data_sources/${sources.beans}/query`,
        ]);
        assert.ok(startupCalls.length >= 2);
        assert.ok(startupCalls.every(call => allowedStartupPaths.has(call.pathname)));
        assert.equal(startupCalls.filter(call => call.pathname.endsWith('/query')).length, 1);
        assert.equal(startupCalls.find(call => call.pathname.endsWith('/query')).body.page_size, 20);
        checks.push('warm startup verifies beans and queries only its first 20 rows');

        const ids = await page.evaluate(() => fixture.seed());
        await page.waitForFunction(() => document.querySelector('.bean-card')?.innerText.includes('25개'));
        checks.push('bean list count resolves exactly from deferred bagless records');

        const navigate = async (section, route) => {
          await page.locator(`nav [data-route="/${section}"]`).click();
          await page.waitForFunction(expected => window.fixture.getLastScreen()?.screen?.route === expected, route);
          await page.waitForFunction(expected => document.querySelector('.list-view')?.dataset.section === expected.split('/')[1], route);
        };
        const queryCount = kind => page.evaluate(kindName => {
          const id = fixture.getSourceIds()[kindName];
          return fixture.fake.calls.filter(call => call.method === 'POST' && call.pathname === `/v1/data_sources/${id}/query`).length;
        }, kind);

        await navigate('recipes', '/recipes');
        await page.waitForFunction(() => !document.querySelector('.recipe-summary-card')?.innerText.includes('단계를 확인 중입니다'));
        await page.locator('.recipe-card-link').click();
        await page.waitForFunction(expected => window.fixture.getLastScreen()?.screen?.route === expected, `/recipes/${ids.recipe}`);
        await page.waitForFunction(() => document.querySelector('.recipe-card')?.innerText.includes('평가 25회 · 평균 5.0점'));
        assert.match(await page.locator('.recipe-extraction-guide').count().then(String), /^0$/);
        assert.equal(await page.locator('.steps-table tbody tr').count(), 3);
        checks.push('visible recipe summaries validate stages; selected detail loads complete stages and exact deferred stats');

        const beansBeforeFilter = await queryCount('beans');
        await navigate('records', '/records');
        assert.equal(await page.locator('.record-card').count(), 20);
        assert.equal(await queryCount('beans'), beansBeforeFilter, 'the records page does not eagerly query bean name options');
        assert.ok(await page.locator('[data-action="load-more"]').count());
        await page.locator('[data-option-search-kind="beans"][data-option-target="filters"]').focus();
        await page.waitForFunction(({ id, prior }) => fixture.fake.calls.filter(call =>
          call.method === 'POST' && call.pathname === `/v1/data_sources/${id}/query`).length > prior,
        { id: sources.beans, prior: beansBeforeFilter });
        await page.locator('[data-option-search-kind="beans"][data-option-target="filters"]').fill('Screen fixture');
        await page.waitForFunction(() => [...document.querySelectorAll('[data-record-filter="beanId"] option')]
          .some(option => option.textContent.includes('Screen fixture')));
        await page.locator('[data-record-filter="beanId"]').selectOption(ids.bean);
        await page.waitForFunction(() => window.fixture.getLastScreen()?.screen?.filters?.beanId === window.fixture.getLastScreen()?.beans?.[0]?.id);
        assert.equal(await page.locator('.record-card').count(), 20);
        await page.locator('[data-action="load-more"]').click();
        await page.waitForFunction(() => document.querySelectorAll('.record-card').length === 25);
        checks.push('record filter names load on focus and the filtered page continues without skipping raw-scan rows');

        const beansBeforeForm = await queryCount('beans');
        const recipesBeforeForm = await queryCount('recipes');
        await page.locator('[data-action="show-record-form"]').click();
        await page.waitForFunction(({ beansBefore, recipesBefore, beanSource, recipeSource }) => {
          const calls = fixture.fake.calls;
          return calls.filter(call => call.method === 'POST' && call.pathname === `/v1/data_sources/${beanSource}/query`).length > beansBefore &&
            calls.filter(call => call.method === 'POST' && call.pathname === `/v1/data_sources/${recipeSource}/query`).length > recipesBefore;
        }, { beansBefore: beansBeforeForm, recipesBefore: recipesBeforeForm,
          beanSource: sources.beans, recipeSource: sources.recipes });
        const form = page.locator('form[data-form="records"]');
        await form.locator('[name="beanId"]').selectOption(ids.bean);
        await form.locator('[name="recipeId"]').selectOption(ids.recipe);
        await form.locator('[name="rating"]').fill('4');
        await form.locator('[name="cupNote"]').fill('fake browser form record');
        await form.locator('[data-entry-submit]').click();
        await page.waitForFunction(() => fixture.fake.rows.some(row =>
          row.properties['컵노트']?.rich_text?.some(item => item.text.content === 'fake browser form record')));
        checks.push('record form fetches paged bean and validated recipe options only when opened');

        await navigate('recipes', '/recipes');
        await page.locator('.recipe-card-link').click();
        await page.waitForFunction(expected => window.fixture.getLastScreen()?.screen?.route === expected, `/recipes/${ids.recipe}`);
        await page.waitForFunction(() => document.querySelector('.recipe-card')?.innerText.includes('평가 26회 · 평균 5.0점'));
        assert.deepEqual(errors, []);
        assert.deepEqual(external, []);
        results.push({ width, checks, errors, external, startupCalls });
        await page.screenshot({ path: path.join(output, `${width}-screen-loading.png`), fullPage: true });
      } catch (error) {
        results.push({ width, checks, error: String(error), body: await page.locator('body').innerText(), errors, external });
        await page.screenshot({ path: path.join(output, `${width}-failure.png`), fullPage: true });
        throw error;
      } finally {
        await context.close();
      }
    }
  } finally {
    await fs.writeFile(path.join(output, 'browser-results.json'), JSON.stringify(results, null, 2));
    await browser.close();
    server.kill('SIGTERM');
  }
  process.stdout.write(JSON.stringify(results, null, 2) + '\n');
}

main().catch(error => { console.error(error); process.exitCode = 1; });
