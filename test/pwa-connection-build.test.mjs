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
  const root = await mkdtemp(path.join(os.tmpdir(), 'bean-pocket-connection-build-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const sourceDir = path.join(root, 'pwa');
  const outputDir = path.join(root, 'dist');
  await cp(path.join(projectRoot, 'pwa'), sourceDir, { recursive: true });
  await mkdir(path.join(sourceDir, 'data'), { recursive: true });
  await mkdir(path.join(sourceDir, 'platform'), { recursive: true });
  await writeFile(path.join(sourceDir, 'data/notion-client.mjs'), "export const api = 'https://api.notion.com/v1';\n");
  await writeFile(path.join(sourceDir, 'data/notion-properties.mjs'), 'export const codec = true;\n');
  await writeFile(path.join(sourceDir, 'platform/connection-file.mjs'), 'export const storage = true;\n');
  return { root, sourceDir, outputDir };
}

test('연결 파일 저장소 모듈을 실제 배포 파일·앱 캐시·버전 해시에 포함한다', async t => {
  const f = await fixture(t);
  const first = await buildPages(f);
  assert.ok((await readdir(f.outputDir)).includes('platform'), '배포용 파일 보관 모듈이 필요하다');
  assert.deepEqual(await readFile(path.join(f.outputDir, 'platform/connection-file.mjs')), await readFile(path.join(f.sourceDir, 'platform/connection-file.mjs')));
  assert.match(await readFile(path.join(f.outputDir, 'sw.js'), 'utf8'), /\.\/platform\/connection-file\.mjs/);
  assert.equal(await checkPages(f.outputDir), true);
  await writeFile(path.join(f.sourceDir, 'platform/connection-file.mjs'), 'export const storage = false;\n');
  assert.notEqual(await buildPages(f), first);
});

test('파일 보관 소스 디렉터리 symlink는 허용 목록으로 우회하지 못한다', async t => {
  const f = await fixture(t);
  const directory = path.join(f.sourceDir, 'platform');
  const elsewhere = path.join(f.root, 'elsewhere');
  await cp(directory, elsewhere, { recursive: true });
  await rm(directory, { recursive: true });
  await symlink(elsewhere, directory);
  await assert.rejects(buildPages(f), /심볼릭|symlink/);
});
