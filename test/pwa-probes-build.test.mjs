import test from 'node:test';
import assert from 'node:assert/strict';
import { cp, mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildPages } from '../scripts/build-pages.mjs';
import { checkPages } from '../scripts/check-pages.mjs';
const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const files = ['notion/index.html', 'notion/probe.mjs', 'storage/index.html', 'storage/probe.mjs'];
async function fixture(t, experimental = false) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'bean-pocket-probes-build-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const sourceDir = path.join(root, 'pwa');
  const outputDir = path.join(root, 'dist');
  await cp(path.join(projectRoot, 'pwa'), sourceDir, { recursive: true });
  for (const file of files) {
    const target = path.join(sourceDir, 'probes', file);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, file.endsWith('.html')
      ? '<!doctype html><html lang="ko"><head><title>실험</title><script type="module" src="./probe.mjs"></script></head><body><h1>실험</h1><p>__BUILD_VERSION__</p></body></html>'
      : 'export const probe = true;\n');
  }
  const version = await buildPages({ sourceDir, outputDir, includeProbes: experimental });
  return { root, sourceDir, outputDir, version };
}

test('일반 빌드는 probes를 제외하고 오염된 probes 폴더는 무검사로 통과하지 않는다', async t => {
  const f = await fixture(t);
  assert.ok(!(await readdir(f.outputDir)).includes('probes'));
  await mkdir(path.join(f.outputDir, 'probes'));
  await writeFile(path.join(f.outputDir, 'probes/private.json'), '{"private":true}');
  await assert.rejects(checkPages(f.outputDir), /probes|산출물/);
});

test('명시적 실험 빌드는 정확한 네 파일·메뉴를 공급하고 일반 검사에서는 거부한다', async t => {
  const f = await fixture(t, true);
  for (const file of files) assert.ok((await readFile(path.join(f.outputDir, 'probes', file))).length);
  assert.equal(await checkPages(f.outputDir, { includeProbes: true }), true);
  await assert.rejects(checkPages(f.outputDir), /probes|산출물/);
  const html = await readFile(path.join(f.outputDir, 'index.html'), 'utf8');
  assert.match(html, /기술 실험/);
  assert.match(html, /href="\.\/probes\/storage\//);
  assert.match(html, /href="\.\/probes\/notion\//);
  const sw = await readFile(path.join(f.outputDir, 'sw.js'), 'utf8');
  assert.doesNotMatch(sw, /probes\//);
});

test('실험 파일 변경은 버전에 반영되고 일반 빌드로 돌아가면 실험 파일은 제거된다', async t => {
  const f = await fixture(t, true);
  const probe = path.join(f.sourceDir, 'probes/storage/probe.mjs');
  await writeFile(probe, 'export const revision = 2;\n');
  const changed = await buildPages({ ...f, includeProbes: true });
  assert.notEqual(changed, f.version);
  await buildPages(f);
  assert.ok(!(await readdir(f.outputDir)).includes('probes'));
  assert.equal(await checkPages(f.outputDir), true);
});

test('실험 산출물의 비밀값·외부 URL·추가 파일·symlink는 거부한다', async t => {
  for (const problem of ['secret', 'url', 'extra', 'symlink']) {
    const f = await fixture(t, true);
    const probe = path.join(f.outputDir, 'probes/notion/probe.mjs');
    if (problem === 'secret') await writeFile(probe, "const leaked = 'ntn_abcdefghijklmnopqrstuvwxy';");
    if (problem === 'url') await writeFile(probe, "fetch('https://unrelated.example/collect');");
    if (problem === 'extra') await writeFile(path.join(f.outputDir, 'probes/notion/.env.local'), 'private');
    if (problem === 'symlink') { await rm(probe); await symlink(path.join(f.sourceDir, 'app.mjs'), probe); }
    await assert.rejects(checkPages(f.outputDir, { includeProbes: true }), /비밀|토큰|secret|URL|산출물|심볼릭|symlink/);
  }
});

test('실험 소스의 symlink와 미허용 파일은 게시에 포함하지 않는다', async t => {
  const f = await fixture(t, true);
  const probe = path.join(f.sourceDir, 'probes/notion/probe.mjs');
  await rm(probe);
  await symlink(path.join(f.sourceDir, 'app.mjs'), probe);
  await assert.rejects(buildPages({ ...f, includeProbes: true }), /심볼릭|symlink/);
  await rm(probe);
  await writeFile(probe, 'export {};');
  await writeFile(path.join(f.sourceDir, 'probes/notion/.env.local'), 'private');
  await assert.rejects(buildPages({ ...f, includeProbes: true }), /허용|예상|소스/);
});
