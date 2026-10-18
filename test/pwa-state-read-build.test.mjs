import test from 'node:test';
import assert from 'node:assert/strict';
import { cp, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { buildPages } from '../scripts/build-pages.mjs';
import { checkPages } from '../scripts/check-pages.mjs';

const modules = ['data/read-repository.mjs', 'state/submission-state.mjs'];
async function fixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'bean-pocket-state-read-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const sourceDir = path.join(root, 'pwa');
  const outputDir = path.join(root, 'dist');
  await cp(new URL('../pwa/', import.meta.url), sourceDir, { recursive: true });
  await mkdir(path.join(sourceDir, 'state'), { recursive: true });
  for (const file of modules) await writeFile(path.join(sourceDir, file), 'export const fixture = true;\n');
  return { root, sourceDir, outputDir };
}

test('조회·작업 상태 모듈은 앱 파일로만 공급하고 변경을 버전에 반영한다', async t => {
  const f = await fixture(t);
  let version = await buildPages(f);
  for (const file of modules) {
    assert.deepEqual(await readFile(path.join(f.outputDir, file)), await readFile(path.join(f.sourceDir, file)));
    assert.ok((await readFile(path.join(f.outputDir, 'sw.js'), 'utf8')).includes('./' + file));
    await writeFile(path.join(f.sourceDir, file), 'export const fixture = false;\n');
    const nextVersion = await buildPages(f);
    assert.notEqual(nextVersion, version);
    version = nextVersion;
  }
  assert.equal(await checkPages(f.outputDir), true);
  for (const file of modules) {
    await writeFile(path.join(f.outputDir, file), "fetch('https://api.notion.com/v1');");
    await assert.rejects(checkPages(f.outputDir), /외부 URL|API|통신/);
    await writeFile(path.join(f.outputDir, file), 'export const fixture = true;\n');
  }
});

test('state 소스 디렉터리 symlink를 통한 허용 목록 우회는 차단한다', async t => {
  const f = await fixture(t);
  const elsewhere = path.join(f.root, 'elsewhere');
  await cp(path.join(f.sourceDir, 'state'), elsewhere, { recursive: true });
  await rm(path.join(f.sourceDir, 'state'), { recursive: true });
  await symlink(elsewhere, path.join(f.sourceDir, 'state'));
  await assert.rejects(buildPages(f), /심볼릭|symlink/);
});

test('소스의 개발용 도메인 경유 모듈과 배포 원본은 같은 함수다', async () => {
  const source = await import('../pwa/domain.mjs');
  const canonical = await import('../lib/domain.mjs');
  assert.equal(source.validateStoredRecipe, canonical.validateStoredRecipe);
  assert.equal(source.createSnapshot, canonical.createSnapshot);
});
