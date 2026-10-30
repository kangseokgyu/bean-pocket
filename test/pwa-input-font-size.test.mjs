import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

async function readStylesheet(path) {
  return readFile(new URL(path, import.meta.url), 'utf8');
}

function assertFontSizeAtLeast16(css, rule, label) {
  const declarations = css.match(rule)?.[1];
  assert.ok(declarations, `${label} has a stylesheet rule`);

  const fontSize = declarations.match(/(?:^|;)\s*font-size:\s*(\d+(?:\.\d+)?)(px|rem)\s*(?:;|$)/);
  assert.ok(fontSize, `${label} declares its text size in px or rem`);
  const pixels = Number(fontSize[1]) * (fontSize[2] === 'rem' ? 16 : 1);
  assert.ok(pixels >= 16, `${label} uses at least 16px text`);
}

test('visible PWA text-entry controls keep a 16px minimum font size', async () => {
  const appStyles = await readStylesheet('../pwa/styles.css');
  const demoStyles = await readStylesheet('../pwa/brew-picker-demo.css');

  assertFontSizeAtLeast16(
    appStyles,
    /\.form-field input,\s*\.form-field select,\s*\.form-field textarea\s*\{([^}]*)\}/,
    'form fields'
  );
  assertFontSizeAtLeast16(
    appStyles,
    /\.record-insight-control select\s*\{([^}]*)\}/,
    'record insight filters'
  );
  assertFontSizeAtLeast16(
    appStyles,
    /\.brew-option-search-control > input\[type="search"\]\s*\{([^}]*)\}/,
    'brew option search'
  );
  assertFontSizeAtLeast16(
    demoStyles,
    /^input\s*\{([^}]*)\}/m,
    'brew picker demo search'
  );
});
