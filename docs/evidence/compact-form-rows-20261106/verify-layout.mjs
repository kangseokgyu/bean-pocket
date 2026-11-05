import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { writeFile } from 'node:fs/promises';

const { chromium } = createRequire(import.meta.url)('/Users/kangseokgyu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const url = 'http://127.0.0.1:4207/docs/evidence/compact-form-rows-20261106/preview.html';
const viewports = [
  { width: 320, height: 568, name: '320' },
  { width: 390, height: 844, name: '390' },
  { width: 1280, height: 900, name: 'desktop' },
  { width: 390, height: 320, name: 'low-height' },
];
const results = [];

async function openPreview(page, viewport) {
  await page.setViewportSize(viewport);
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => document.documentElement.dataset.previewReady === 'true');
}

async function readCompactForm(page) {
  return page.evaluate(() => {
    const dialog = document.querySelector('.entry-dialog[open]');
    const fieldset = dialog.querySelector('.form-fieldset--compact');
    const fields = [...fieldset.querySelectorAll(':scope > .form-field')].map(field => {
      const label = field.querySelector('.form-field-label');
      const control = field.querySelector('input,textarea');
      const labelBox = label.getBoundingClientRect();
      const controlBox = control.getBoundingClientRect();
      const fieldBox = field.getBoundingClientRect();
      return {
        label: label.textContent,
        type: control.tagName.toLowerCase(),
        labelWidth: label.clientWidth,
        labelScrollWidth: label.scrollWidth,
        labelRight: labelBox.right,
        labelCenter: labelBox.top + labelBox.height / 2,
        controlLeft: controlBox.left,
        controlRight: controlBox.right,
        controlWidth: controlBox.width,
        controlCenter: controlBox.top + controlBox.height / 2,
        fieldWidth: fieldBox.width,
        fieldLeft: fieldBox.left,
        fieldTop: fieldBox.top,
        fieldRight: fieldBox.right,
        fieldBottom: fieldBox.bottom,
        fontSize: getComputedStyle(control).fontSize,
      };
    });
    const active = document.activeElement;
    const focusStyle = getComputedStyle(active);
    return {
      viewport: { width: innerWidth, height: innerHeight },
      pageWidth: document.documentElement.scrollWidth,
      dialogWidth: dialog.clientWidth,
      dialogScrollWidth: dialog.scrollWidth,
      activeName: active.name,
      focusWidth: focusStyle.outlineWidth,
      focusStyle: focusStyle.outlineStyle,
      fields,
    };
  });
}

async function testCompactForm(page, viewport, kind) {
  await openPreview(page, viewport);
  await page.evaluate(kind => {
    const { view } = window.preview;
    view.renderRoute(`/${kind}`);
    if (kind === 'beans') view.showBeanForm();
    else view.showRecipeForm();
  }, kind);
  await page.waitForFunction(() => document.querySelector('.entry-dialog[open]'));
  const layout = await readCompactForm(page);
  const label = `${kind} ${viewport.name}`;
  assert.ok(layout.pageWidth <= layout.viewport.width, `${label}: no horizontal page overflow`);
  assert.ok(layout.dialogScrollWidth <= layout.dialogWidth, `${label}: no horizontal dialog overflow`);
  const [first, second] = layout.fields;
  if (viewport.width <= 600) {
    assert.ok(Math.abs(first.fieldLeft - second.fieldLeft) <= 1, `${label}: fields use the full mobile row`);
    assert.ok(second.fieldTop >= first.fieldBottom, `${label}: mobile fields do not share a compressed two-column row`);
  } else {
    assert.ok(second.fieldLeft >= first.fieldRight, `${label}: desktop fields use separate columns`);
    assert.ok(Math.abs(first.fieldTop - second.fieldTop) <= 1, `${label}: desktop fields share a row`);
  }
  assert.equal(layout.activeName, 'name', `${label}: initial input receives focus`);
  assert.equal(layout.focusWidth, '3px', `${label}: focus is visible`);
  assert.equal(layout.focusStyle, 'solid', `${label}: focus outline is solid`);
  for (const field of layout.fields) {
    assert.ok(field.labelWidth > 0, `${label}: ${field.label} label is visible`);
    assert.ok(field.labelScrollWidth <= field.labelWidth + 1, `${label}: ${field.label} label is not clipped`);
    assert.ok(field.controlWidth >= 100, `${label}: ${field.label} control has room`);
    assert.ok(field.controlRight <= field.fieldRight + 1, `${label}: ${field.label} control fits its field`);
    assert.ok(Number.parseFloat(field.fontSize) >= 16, `${label}: ${field.label} control stays at least 16px`);
    if (field.type === 'textarea') {
      assert.ok(field.controlWidth >= field.fieldWidth - 2, `${label}: textarea uses the full row`);
    } else {
      assert.ok(field.labelRight <= field.controlLeft + 1, `${label}: ${field.label} sits left of its input`);
      assert.ok(Math.abs(field.labelCenter - field.controlCenter) <= 2, `${label}: ${field.label} aligns with its input`);
      assert.ok(field.controlRight > field.controlLeft, `${label}: ${field.label} value is visible`);
    }
  }
  await page.screenshot({ path: new URL(`./${kind}-${viewport.name}.png`, import.meta.url).pathname });
  results.push({ kind, viewport: viewport.name, layout });
}

async function testNotion(page, viewport) {
  await openPreview(page, viewport);
  await page.locator('.connection-toggle').click();
  await page.waitForFunction(() => document.querySelector('#connection-settings[open]'));
  await page.locator('#connection-token').fill('preview-token-only');
  await page.evaluate(() => { document.querySelector('[data-token-status-icon]').dataset.state = 'valid'; });
  await page.locator('#connection-token').focus();
  const layout = await page.evaluate(() => {
    const dialog = document.querySelector('#connection-settings');
    const fields = [...dialog.querySelectorAll('.form-field--connection')].map(field => {
      const label = field.querySelector('.form-field-label');
      const input = field.querySelector('input');
      const icon = field.querySelector('[data-token-status-icon]');
      const labelBox = label.getBoundingClientRect();
      const inputBox = input.getBoundingClientRect();
      const fieldBox = field.getBoundingClientRect();
      return {
        label: label.textContent,
        labelWidth: label.clientWidth,
        labelScrollWidth: label.scrollWidth,
        labelBottom: labelBox.bottom,
        inputTop: inputBox.top,
        inputLeft: inputBox.left,
        inputRight: inputBox.right,
        fieldLeft: fieldBox.left,
        fieldRight: fieldBox.right,
        fontSize: getComputedStyle(input).fontSize,
        iconRight: icon?.getBoundingClientRect().right,
        iconVisible: !!icon && icon.getBoundingClientRect().width > 0,
      };
    });
    const token = dialog.querySelector('.form-field--connection:has(#connection-token)');
    return {
      viewport: { width: innerWidth, height: innerHeight },
      pageWidth: document.documentElement.scrollWidth,
      dialogWidth: dialog.clientWidth,
      dialogScrollWidth: dialog.scrollWidth,
      tokenFieldOutline: getComputedStyle(token).outlineWidth,
      tokenInputOutlineStyle: getComputedStyle(token.querySelector('input')).outlineStyle,
      fields,
    };
  });
  const label = `Notion ${viewport.name}`;
  assert.ok(layout.pageWidth <= layout.viewport.width, `${label}: no horizontal page overflow`);
  assert.ok(layout.dialogScrollWidth <= layout.dialogWidth, `${label}: no horizontal dialog overflow`);
  assert.equal(layout.fields.length, 5, `${label}: token and four source IDs render`);
  for (const field of layout.fields) {
    assert.ok(field.labelWidth > 0, `${label}: ${field.label} label is visible`);
    assert.ok(field.labelScrollWidth <= field.labelWidth + 1, `${label}: ${field.label} label is not clipped`);
    assert.ok(field.labelBottom <= field.inputTop + 1, `${label}: ${field.label} sits above its value`);
    assert.ok(field.inputLeft >= field.fieldLeft && field.inputRight <= field.fieldRight, `${label}: ${field.label} value stays inside its border`);
    assert.ok(Number.parseFloat(field.fontSize) >= 16, `${label}: ${field.label} value stays at least 16px`);
  }
  assert.equal(layout.fields[0].iconVisible, true, `${label}: token status icon is visible`);
  assert.ok(layout.fields[0].iconRight <= layout.fields[0].inputRight, `${label}: token status icon stays inside the input`);
  assert.equal(layout.tokenFieldOutline, '3px', `${label}: focus appears on the bordered token field`);
  assert.equal(layout.tokenInputOutlineStyle, 'none', `${label}: token input does not draw a duplicate outline`);
  await page.screenshot({ path: new URL(`./notion-${viewport.name}.png`, import.meta.url).pathname });
  results.push({ kind: 'notion', viewport: viewport.name, layout });
}

async function testPicker(page, viewport) {
  await openPreview(page, viewport);
  await page.evaluate(() => {
    const { view } = window.preview;
    view.renderRoute('/records/new');
    view.showRecordForm();
  });
  await page.waitForFunction(() => document.querySelector('.entry-dialog[open]'));
  await page.locator('.search-picker-trigger').first().click();
  await page.waitForFunction(() => document.querySelector('.option-picker-dialog[open]'));
  const search = page.locator('.option-picker-dialog[open] [data-option-picker-search]');
  await search.focus();
  const layout = await page.evaluate(() => {
    const dialog = document.querySelector('.option-picker-dialog[open]');
    const trigger = document.querySelector('.search-picker-trigger');
    const search = dialog.querySelector('[data-option-picker-search]');
    return {
      viewport: { width: innerWidth, height: innerHeight },
      pageWidth: document.documentElement.scrollWidth,
      dialogWidth: dialog.clientWidth,
      dialogScrollWidth: dialog.scrollWidth,
      triggerHeight: trigger.getBoundingClientRect().height,
      focusWidth: getComputedStyle(search).outlineWidth,
      focusStyle: getComputedStyle(search).outlineStyle,
    };
  });
  const label = `picker ${viewport.name}`;
  assert.ok(layout.pageWidth <= layout.viewport.width, `${label}: no horizontal page overflow`);
  assert.ok(layout.dialogScrollWidth <= layout.dialogWidth, `${label}: no horizontal picker overflow`);
  assert.ok(layout.triggerHeight >= 46, `${label}: selection trigger keeps its existing 46px touch target`);
  assert.equal(layout.focusWidth, '3px', `${label}: picker search focus is visible`);
  assert.equal(layout.focusStyle, 'solid', `${label}: picker focus outline is solid`);
  if (viewport.name === '390') await page.screenshot({ path: new URL('./picker-390.png', import.meta.url).pathname });
  results.push({ kind: 'picker', viewport: viewport.name, layout });
}

try {
  const page = await browser.newPage({ deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  for (const viewport of viewports) {
    await testCompactForm(page, viewport, 'beans');
    await testCompactForm(page, viewport, 'recipes');
    await testNotion(page, viewport);
    await testPicker(page, viewport);
  }
  assert.deepEqual(errors, [], 'preview reports no browser errors');
  await writeFile(new URL('./browser-results.json', import.meta.url), JSON.stringify({ passed: true, results, errors }, null, 2) + '\n');
  console.log(JSON.stringify({ passed: true, cases: results.length, errors }));
} finally {
  await browser.close();
}
