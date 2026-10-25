import { createHash } from 'node:crypto';
import { lstat, mkdir, readFile, readdir, realpath, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkPages, probeFiles } from './check-pages.mjs';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const sourceFiles = [
  'app.mjs',
  'commands/index.mjs',
  'ui/controller.mjs',
  'ui/view.mjs',
  'data/notion-client.mjs',
  'data/notion-properties.mjs',
  'data/read-repository.mjs',
  'icons/bp-logo.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'index.html',
  'manifest.webmanifest',
  'platform/app-lifecycle.mjs',
  'platform/connection-file.mjs',
  'platform/update-coordinator.mjs',
  'state/submission-state.mjs',
  'styles.css',
  'sw.js',
];

function containsPath(parent, child) {
  const relative = path.relative(parent, child);
  return relative === '' || (relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
}

async function canonicalPath(input) {
  let current = path.resolve(input);
  const missingParts = [];
  while (true) {
    try {
      const existingPath = await realpath(current);
      return path.resolve(existingPath, ...missingParts.reverse());
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      const parent = path.dirname(current);
      if (parent === current) throw error;
      missingParts.push(path.basename(current));
      current = parent;
    }
  }
}

async function assertNoOverlap(sourceDir, outputDir) {
  const [source, output] = await Promise.all([canonicalPath(sourceDir), canonicalPath(outputDir)]);
  if (containsPath(source, output) || containsPath(output, source)) {
    throw new Error('소스와 출력 디렉터리는 겹칠 수 없습니다.');
  }
}

async function readSourceFiles(sourceDir, includeProbes) {
  const sourceInfo = await lstat(sourceDir).catch(error => {
    if (error.code === 'ENOENT') throw new Error(`PWA 소스 디렉터리가 없습니다: ${sourceDir}`);
    throw error;
  });
  if (sourceInfo.isSymbolicLink()) throw new Error('PWA 소스 디렉터리는 심볼릭 링크일 수 없습니다.');
  if (!sourceInfo.isDirectory()) throw new Error('PWA 소스 경로는 디렉터리여야 합니다.');

  const iconDirectory = path.join(sourceDir, 'icons');
  const iconInfo = await lstat(iconDirectory).catch(error => {
    if (error.code === 'ENOENT') throw new Error('필수 소스 디렉터리가 없습니다: icons');
    throw error;
  });
  if (iconInfo.isSymbolicLink()) throw new Error('PWA 아이콘 디렉터리는 심볼릭 링크일 수 없습니다.');
  if (!iconInfo.isDirectory()) throw new Error('PWA 아이콘 경로는 디렉터리여야 합니다.');

  const dataInfo = await lstat(path.join(sourceDir, 'data'));
  if (dataInfo.isSymbolicLink() || !dataInfo.isDirectory()) {
    throw new Error('PWA 데이터 모듈 디렉터리는 심볼릭 링크가 아닌 디렉터리여야 합니다.');
  }
  const platformInfo = await lstat(path.join(sourceDir, 'platform'));
  if (platformInfo.isSymbolicLink() || !platformInfo.isDirectory()) {
    throw new Error('PWA 파일 보관 모듈 디렉터리는 심볼릭 링크가 아닌 디렉터리여야 합니다.');
  }

  const stateInfo = await lstat(path.join(sourceDir, 'state'));
  if (stateInfo.isSymbolicLink() || !stateInfo.isDirectory()) {
    throw new Error('PWA 작업 상태 디렉터리는 심볼릭 링크가 아닌 디렉터리여야 합니다.');
  }

  for (const directory of ['commands', 'ui']) {
    const info = await lstat(path.join(sourceDir, directory));
    if (info.isSymbolicLink() || !info.isDirectory()) throw new Error(`PWA 모듈 디렉터리는 심볼릭 링크일 수 없습니다: ${directory}`);
  }

  if (includeProbes) {
    for (const [directory, permitted] of [
      ['probes', ['notion', 'storage']],
      ['probes/notion', ['index.html', 'probe.mjs']],
      ['probes/storage', ['index.html', 'probe.mjs']],
    ]) {
      const target = path.join(sourceDir, directory);
      const info = await lstat(target);
      if (info.isSymbolicLink() || !info.isDirectory()) throw new Error(`실험 소스 디렉터리는 심볼릭 링크일 수 없습니다: ${directory}`);
      const names = await readdir(target);
      if (names.some(name => !permitted.includes(name))) throw new Error(`허용하지 않은 실험 소스 파일: ${directory}`);
    }
  }

  const files = new Map();
  for (const relativePath of [...sourceFiles, ...(includeProbes ? probeFiles : [])]) {
    const sourcePath = path.join(sourceDir, relativePath);
    const info = await lstat(sourcePath).catch(error => {
      if (error.code === 'ENOENT') throw new Error(`필수 PWA 소스 파일이 없습니다: ${relativePath}`);
      throw error;
    });
    if (info.isSymbolicLink()) throw new Error(`PWA 소스 파일은 심볼릭 링크일 수 없습니다: ${relativePath}`);
    if (!info.isFile()) throw new Error(`PWA 소스는 일반 파일이어야 합니다: ${relativePath}`);
    files.set(relativePath, await readFile(sourcePath));
  }
  return files;
}

function hashSources(files, builderSource) {
  const hash = createHash('sha256');
  hash.update('scripts/build-pages.mjs\0');
  hash.update(builderSource);
  hash.update('\0');
  for (const [relativePath, contents] of [...files].sort(([left], [right]) => left.localeCompare(right))) {
    hash.update(relativePath);
    hash.update('\0');
    hash.update(contents);
    hash.update('\0');
  }
  return hash.digest('hex').slice(0, 12);
}

function applyBuildVersion(files, version) {
  for (const [relativePath, buffer] of files) {
    if (!relativePath.endsWith('.html') && relativePath !== 'sw.js') continue;
    const contents = buffer.toString('utf8');
    if (['index.html', 'sw.js'].includes(relativePath) && !contents.includes('__BUILD_VERSION__')) {
      throw new Error(`빌드 버전 자리표시자가 없습니다: ${relativePath}`);
    }
    files.set(relativePath, Buffer.from(contents.replaceAll('__BUILD_VERSION__', version)));
  }
}

export async function buildPages({
  sourceDir = path.join(projectRoot, 'pwa'),
  outputDir = path.join(projectRoot, 'dist'),
  domainSource = path.join(projectRoot, 'lib', 'domain.mjs'),
  includeProbes = false,
} = {}) {
  await assertNoOverlap(sourceDir, outputDir);
  if (containsPath(await canonicalPath(outputDir), await canonicalPath(domainSource))) {
    throw new Error('도메인 원본을 포함한 디렉터리는 출력 경로로 사용할 수 없습니다.');
  }
  const files = await readSourceFiles(sourceDir, includeProbes);
  const domainInfo = await lstat(domainSource);
  if (domainInfo.isSymbolicLink() || !domainInfo.isFile()) {
    throw new Error('도메인 원본은 심볼릭 링크가 아닌 일반 파일이어야 합니다.');
  }
  files.set('domain.mjs', await readFile(domainSource));
  if (includeProbes) {
    const html = files.get('index.html').toString('utf8');
    if (!html.includes('</header>')) throw new Error('실험판 진입점을 삽입할 header가 없습니다.');
    files.set('index.html', Buffer.from(html.replace('</header>', '</header>\n<nav aria-label="기술 실험"><p>기술 검증 실험판</p><a href="./probes/notion/">Notion 직접 통신</a> · <a href="./probes/storage/">파일 보관 실험</a></nav>')));
  }
  const version = hashSources(files, await readFile(fileURLToPath(import.meta.url)));
  applyBuildVersion(files, version);

  let outputInfo;
  try {
    outputInfo = await lstat(outputDir);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  if (outputInfo) {
    if (outputInfo.isSymbolicLink()) throw new Error('dist 경로는 심볼릭 링크일 수 없습니다.');
    if (!outputInfo.isDirectory()) throw new Error('dist 경로는 디렉터리여야 합니다.');
    await checkPages(outputDir, { allowIncomplete: true, includeProbes: true });
    await rm(outputDir, { recursive: true });
  }

  await mkdir(path.join(outputDir, 'icons'), { recursive: true });
  for (const [relativePath, contents] of files) {
    const outputPath = path.join(outputDir, relativePath);
    await mkdir(path.dirname(outputPath), { recursive: true });
    await writeFile(outputPath, contents);
  }
  await checkPages(outputDir, { includeProbes });
  return version;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv.slice(2).some(arg => arg !== '--probes')) throw new Error('알 수 없는 빌드 옵션입니다.');
    const version = await buildPages({ includeProbes: process.argv.includes('--probes') });
    console.log(`Pages 산출물 생성 완료 (${version})`);
  } catch (error) {
    console.error(`Pages 산출물 생성 실패: ${error.message}`);
    process.exitCode = 1;
  }
}
