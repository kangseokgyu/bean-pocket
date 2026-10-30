import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const evidenceDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(evidenceDir, '../../..');
const require = createRequire(import.meta.url);
const playwrightModule = process.env.DECIMAL_RATING_PLAYWRIGHT_MODULE ??
  '/Users/kangseokgyu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright';
const chromeExecutable = process.env.DECIMAL_RATING_CHROME_PATH ??
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const { chromium } = require(playwrightModule);
const domain = await readFile(path.join(projectRoot, 'lib/domain.mjs'), 'utf8');
const source = (await readFile(path.join(projectRoot, 'pwa/ui/star-rating.mjs'), 'utf8'))
  .replace("'../domain.mjs'", JSON.stringify(`data:text/javascript;base64,${Buffer.from(domain).toString('base64')}`));
const moduleURL = `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const browser = await chromium.launch({ headless: true, executablePath: chromeExecutable });

try {
  const page = await browser.newPage();
  await page.setContent('<html><body></body></html>');
  const results = await page.evaluate(async importedModuleURL => {
    const { createStarRating } = await import(importedModuleURL);
    document.body.append(createStarRating(document));
    const input = document.querySelector('input');
    const results = [];
    for (const value of ['0.1', '0.5', '0.9', '1.0']) {
      input.value = value;
      input.dispatchEvent(new Event('input'));
      const clone = document.querySelector('svg').cloneNode(true);
      clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      clone.setAttribute('width', '240');
      clone.setAttribute('height', '240');
      clone.querySelector('.rating-star-outline').setAttribute('fill', 'none');
      clone.querySelector('.rating-star-outline').setAttribute('stroke', 'black');
      clone.querySelector('.rating-star-fill').setAttribute('fill', 'rgb(245,173,22)');
      const rect = clone.querySelector('.rating-fill-rect');
      const image = new Image();
      image.src = `data:image/svg+xml;base64,${btoa(new XMLSerializer().serializeToString(clone))}`;
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = 240;
      canvas.height = 240;
      const context = canvas.getContext('2d');
      context.drawImage(image, 0, 0);
      const pixels = context.getImageData(0, 0, 240, 240).data;
      let yellowPixels = 0;
      for (let index = 0; index < pixels.length; index += 4) {
        if (pixels[index] > 200 && pixels[index + 1] > 120 && pixels[index + 2] < 60 && pixels[index + 3] > 0) yellowPixels += 1;
      }
      results.push({ value, clipX: rect.getAttribute('x'), clipWidth: rect.getAttribute('width'), yellowPixels });
    }
    return results;
  }, moduleURL);

  assert.deepEqual(results.map(result => [result.clipX, result.clipWidth]), [
    ['3', '1.8'], ['3', '9'], ['3', '16.2'], ['3', '18'],
  ]);
  assert.ok(results[0].yellowPixels > 0, '0.1 must show a visible gold portion');
  assert.ok(results[0].yellowPixels < results[1].yellowPixels, '0.1 and the middle value must differ');
  assert.ok(results[1].yellowPixels < results[2].yellowPixels, 'the middle value and 0.9 must differ');
  assert.ok(results[2].yellowPixels < results[3].yellowPixels, '0.9 and 1.0 must differ');
  console.log(JSON.stringify(results));
} finally {
  await browser.close();
}
