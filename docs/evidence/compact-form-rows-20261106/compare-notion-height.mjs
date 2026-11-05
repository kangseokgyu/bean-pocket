import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { writeFile } from 'node:fs/promises';

const { chromium } = createRequire(import.meta.url)('/Users/kangseokgyu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const url = 'http://127.0.0.1:4207/docs/evidence/compact-form-rows-20261106/preview.html';
const baselineCss = execFileSync('git', ['show', '0e0c2f3:pwa/styles.css'], { encoding: 'utf8' });
const viewports = [320, 390, 601, 640, 768, 1280];
const results = [];

async function openConnection(page, width, css = null) {
  await page.setViewportSize({ width, height: width > 600 ? 900 : 844 });
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => document.documentElement.dataset.previewReady === 'true');
  if (css) {
    await page.evaluate(styles => {
      document.querySelector('link[rel="stylesheet"]').remove();
      const baseline = document.createElement('style');
      baseline.dataset.stylesheet = 'baseline';
      baseline.textContent = styles;
      document.head.append(baseline);
    }, css);
  }
  await page.locator('.connection-toggle').click();
  await page.waitForFunction(() => document.querySelector('#connection-settings[open]'));
  await page.locator('#connection-settings').evaluate(async dialog => {
    await Promise.all(dialog.getAnimations().map(animation => animation.finished));
  });
  await page.locator('#connection-token').fill('preview-token-only');
  await page.evaluate(() => { document.querySelector('[data-token-status-icon]').dataset.state = 'valid'; });
}

async function readLayout(page) {
  return page.evaluate(() => {
    const dialog = document.querySelector('#connection-settings');
    const fields = [...dialog.querySelectorAll('.form-field--connection')].map(field => {
      const label = field.querySelector('.form-field-label');
      const input = field.querySelector('input');
      const box = field.getBoundingClientRect();
      const inputBox = input.getBoundingClientRect();
      const icon = field.querySelector('[data-token-status-icon]');
      const iconBox = icon?.getBoundingClientRect();
      return {
        label: label.textContent,
        height: box.height,
        inputHeight: inputBox.height,
        inputWidth: inputBox.width,
        fontSize: getComputedStyle(input).fontSize,
        borderWidth: getComputedStyle(field).borderTopWidth,
        paddingBlock: getComputedStyle(field).paddingBlock,
        gap: getComputedStyle(field).rowGap,
        iconVisible: !!icon && iconBox.width > 0,
        iconLeft: iconBox?.left,
        iconRight: iconBox?.right,
        inputRight: inputBox.right,
      };
    });
    return {
      viewport: innerWidth,
      pageWidth: document.documentElement.scrollWidth,
      dialogWidth: dialog.clientWidth,
      dialogScrollWidth: dialog.scrollWidth,
      dialogScrollHeight: dialog.scrollHeight,
      fields,
    };
  });
}

try {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  for (const width of viewports) {
    await openConnection(page, width, baselineCss);
    const before = await readLayout(page);
    await openConnection(page, width);
    const after = await readLayout(page);
    assert.equal(before.fields.length, 5, `${width}px: baseline has five Notion fields`);
    assert.equal(after.fields.length, 5, `${width}px: revised view has five Notion fields`);
    assert.ok(before.pageWidth <= before.viewport && after.pageWidth <= after.viewport, `${width}px: no page overflow`);
    assert.ok(before.dialogScrollWidth <= before.dialogWidth && after.dialogScrollWidth <= after.dialogWidth, `${width}px: no dialog overflow`);
    assert.ok(after.dialogScrollHeight <= before.dialogScrollHeight, `${width}px: dialog content does not grow`);
    for (const [index, field] of after.fields.entries()) {
      assert.ok(Math.abs(before.fields[index].height - 58.625) < 0.1,
        `${width}px: baseline ${field.label} height is ${before.fields[index].height}px, expected 58.625px`);
      assert.ok(field.height <= before.fields[index].height, `${width}px: ${field.label} does not exceed its baseline height`);
      assert.ok(field.height >= 44, `${width}px: ${field.label} keeps a touch target`);
      assert.ok(field.inputHeight >= 38, `${width}px: ${field.label} input keeps its 38px target`);
      assert.ok(Number.parseFloat(field.fontSize) >= 16, `${width}px: ${field.label} value stays at least 16px`);
      assert.equal(field.borderWidth, '1px', `${width}px: ${field.label} keeps its outer border`);
    }
    await page.locator('#connection-settings .form-field--connection .form-field-label').first().click();
    assert.equal(await page.evaluate(() => document.activeElement.name), 'token', `${width}px: persistent label activates its input`);
    await page.locator('#connection-token').focus();
    const focus = await page.evaluate(() => {
      const field = document.querySelector('.form-field--connection:has(#connection-token)');
      const input = field.querySelector('input');
      return {
        fieldWidth: getComputedStyle(field).outlineWidth,
        fieldStyle: getComputedStyle(field).outlineStyle,
        inputStyle: getComputedStyle(input).outlineStyle,
      };
    });
    assert.deepEqual(focus, { fieldWidth: '3px', fieldStyle: 'solid', inputStyle: 'none' }, `${width}px: focus remains visible on the whole field`);
    const icon = after.fields[0];
    assert.ok(icon.iconVisible && icon.iconLeft >= icon.inputRight - 44 && icon.iconRight <= icon.inputRight,
      `${width}px: token status icon stays in its reserved input space`);
    results.push({ width, before, after, focus });
  }
  assert.deepEqual(errors, [], 'preview reports no browser errors');
  await writeFile(new URL('./notion-height-comparison.json', import.meta.url), JSON.stringify({ baseline: '0e0c2f3:pwa/styles.css', passed: true, results, errors }, null, 2) + '\n');
  console.log(JSON.stringify({ passed: true, widths: results.length, errors }));
} finally {
  await browser.close();
}
