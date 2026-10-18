import test from 'node:test';
import assert from 'node:assert/strict';
import { cp, mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildPages } from '../scripts/build-pages.mjs';
import { checkPages } from '../scripts/check-pages.mjs';
const projectRoot = fileURLToPath(new URL('../', import.meta.url));
async function fixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'bean-pocket-data-build-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const sourceDir = path.join(root, 'pwa');
  const outputDir = path.join(root, 'dist');
  await cp(path.join(projectRoot, 'pwa'), sourceDir, { recursive: true });
  await mkdir(path.join(sourceDir, 'data'), { recursive: true });
  await mkdir(path.join(sourceDir, 'platform'), { recursive: true });
  await writeFile(path.join(sourceDir, 'platform/connection-file.mjs'), 'export const storage = true;\n');
  await writeFile(path.join(sourceDir, 'data/notion-client.mjs'), "export const api = 'https://api.notion.com/v1';\n");
  await writeFile(path.join(sourceDir, 'data/notion-properties.mjs'), 'export const codec = true;\n');
  return { root, sourceDir, outputDir };
}

test('공용 데이터 모듈 두 개를 실제 산출물과 앱 캐시에 공급한다', async t => {
  const f = await fixture(t);
  await buildPages(f);
  assert.ok((await readdir(f.outputDir)).includes('data'), '실제 배포용 데이터 모듈이 필요하다');
  for (const name of ['notion-client.mjs', 'notion-properties.mjs']) {
    assert.deepEqual(await readFile(path.join(f.outputDir, 'data', name)), await readFile(path.join(f.sourceDir, 'data', name)));
    assert.ok((await readFile(path.join(f.outputDir, 'sw.js'), 'utf8')).includes('./data/' + name));
  }
  assert.equal(await checkPages(f.outputDir), true);
});

test('데이터 모듈 변경은 앱 빌드 버전을 바꾼다', async t => {
  const f = await fixture(t);
  const first = await buildPages(f);
  await writeFile(path.join(f.sourceDir, 'data/notion-properties.mjs'), 'export const codec = false;\n');
  assert.notEqual(await buildPages(f), first);
});

test('Notion 고정 origin 예외는 클라이언트에만 허용하며 추가 URL·비밀값은 거부한다', async t => {
  const f = await fixture(t);
  await buildPages(f);
  const client = path.join(f.outputDir, 'data/notion-client.mjs');
  await mkdir(path.dirname(client), { recursive: true });
  for (const contents of ["fetch('https://unrelated.example/collect');", "const leaked = 'ntn_abcdefghijklmnopqrstuvwxy';"]) {
    await writeFile(client, contents);
    await assert.rejects(checkPages(f.outputDir), /외부 URL|비밀값|토큰/);
  }
  await writeFile(client, "export const api = 'https://api.notion.com/v1';");
  await writeFile(path.join(f.outputDir, 'data/notion-properties.mjs'), "fetch('https://api.notion.com/v1');");
  await assert.rejects(checkPages(f.outputDir), /외부 URL|API|통신/);
});

test('데이터 디렉터리 symlink를 통해 소스 허용 목록을 우회할 수 없다', async t => {
  const f = await fixture(t);
  const directory = path.join(f.sourceDir, 'data');
  const elsewhere = path.join(f.root, 'elsewhere');
  await cp(directory, elsewhere, { recursive: true });
  await rm(directory, { recursive: true });
  await symlink(elsewhere, directory);
  await assert.rejects(buildPages(f), /심볼릭|symlink/);
});
