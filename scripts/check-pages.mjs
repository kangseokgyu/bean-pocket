import { lstat, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const defaultOutputDir = path.join(projectRoot, 'dist');
const allowedFiles = new Set([
  'app.mjs',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'index.html',
  'manifest.webmanifest',
  'styles.css',
  'sw.js',
]);
const requiredCacheFiles = [
  './',
  './index.html',
  './app.mjs',
  './styles.css',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

async function collectFiles(directory, allowIncomplete) {
  const rootInfo = await lstat(directory).catch(error => {
    if (error.code === 'ENOENT') throw new Error(`산출물 디렉터리가 없습니다: ${directory}`);
    throw error;
  });
  if (rootInfo.isSymbolicLink()) throw new Error('산출물 루트는 심볼릭 링크일 수 없습니다.');
  if (!rootInfo.isDirectory()) throw new Error('산출물 루트는 디렉터리여야 합니다.');

  const found = new Set();
  async function visit(relativeDirectory = '') {
    const absoluteDirectory = path.join(directory, relativeDirectory);
    for (const entry of await readdir(absoluteDirectory)) {
      const relativePath = path.posix.join(relativeDirectory, entry);
      const absolutePath = path.join(directory, relativePath);
      const info = await lstat(absolutePath);
      if (info.isSymbolicLink()) throw new Error(`산출물에 심볼릭 링크가 있습니다: ${relativePath}`);
      if (info.isDirectory()) {
        if (relativePath !== 'icons') throw new Error(`예상하지 않은 산출물 디렉터리: ${relativePath}`);
        await visit(relativePath);
        continue;
      }
      if (!info.isFile()) throw new Error(`산출물은 일반 파일이어야 합니다: ${relativePath}`);
      if (!allowedFiles.has(relativePath)) throw new Error(`예상하지 않은 산출물: ${relativePath}`);
      found.add(relativePath);
    }
  }
  await visit();

  const missing = [...allowedFiles].filter(relativePath => !found.has(relativePath));
  if (missing.length && !allowIncomplete) throw new Error(`필수 산출물이 없습니다: ${missing.join(', ')}`);
  return { found, missing };
}

function pngDimensions(contents, relativePath, size) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  if (contents.length < 24 || !contents.subarray(0, 8).equals(signature) || contents.toString('ascii', 12, 16) !== 'IHDR') {
    throw new Error(`PNG 아이콘 형식이 올바르지 않습니다: ${relativePath}`);
  }
  if (contents.readUInt32BE(16) !== size || contents.readUInt32BE(20) !== size) {
    throw new Error(`PNG 아이콘 크기는 ${size}x${size}여야 합니다: ${relativePath}`);
  }
}

function rejectUnsafeContents(textFiles) {
  const joined = [...textFiles.values()].join('\n');
  if (/https?:\/\//i.test(joined)) throw new Error('외부 URL 참조가 산출물에 있습니다.');
  if (/\/api\/|api\.notion\.com|\/v\d+\//i.test(joined)) throw new Error('API 경로가 산출물에 있습니다.');
  if (/(?:href|src|action)\s*=\s*["']\/|url\(\s*["']?\/|(?:new\s+URL|fetch|register|import)\s*\(\s*["'`]\//i.test(joined)) {
    throw new Error('프로젝트 하위 경로에서 깨질 수 있는 루트 절대 경로가 있습니다.');
  }
  if (/\b(?:localStorage|sessionStorage|indexedDB|Authorization|NOTION_TOKEN)\b/i.test(joined)) {
    throw new Error('토큰 또는 영속 브라우저 저장소 참조가 산출물에 있습니다.');
  }
  if (/\b(?:ntn|secret)_[a-z0-9_-]{12,}/i.test(joined) ||
      /\b(?:token|secret|password|api[_-]?key)\s*[:=]\s*["'][^"']{8,}["']/i.test(joined)) {
    throw new Error('비밀값 또는 토큰처럼 보이는 값이 산출물에 있습니다.');
  }
  if (joined.includes('__BUILD_VERSION__')) throw new Error('빌드 버전이 치환되지 않았습니다.');
}

export async function checkPages(directory = defaultOutputDir, { allowIncomplete = false } = {}) {
  const { found, missing } = await collectFiles(directory, allowIncomplete);
  if (allowIncomplete) return true;
  if (missing.length) return true;

  const textFiles = new Map();
  for (const relativePath of ['app.mjs', 'index.html', 'manifest.webmanifest', 'styles.css', 'sw.js']) {
    textFiles.set(relativePath, (await readFile(path.join(directory, relativePath))).toString('utf8'));
  }
  rejectUnsafeContents(textFiles);

  const html = textFiles.get('index.html');
  if (!html.includes('href="./styles.css"') ||
      !html.includes('href="./manifest.webmanifest"') ||
      !html.includes('src="./app.mjs"')) {
    throw new Error('HTML 앱 자원은 상대 경로로 연결해야 합니다.');
  }
  if (!/new URL\('\.\/sw\.js',\s*import\.meta\.url\)/.test(textFiles.get('app.mjs'))) {
    throw new Error('Service Worker는 모듈 위치 기준 상대 경로로 등록해야 합니다.');
  }

  let manifest;
  try {
    manifest = JSON.parse(textFiles.get('manifest.webmanifest'));
  } catch {
    throw new Error('manifest.webmanifest가 올바른 JSON이 아닙니다.');
  }
  if (manifest.start_url !== './' || manifest.scope !== './') {
    throw new Error('manifest start_url과 scope는 프로젝트 하위 경로 기준 ./ 이어야 합니다.');
  }
  const expectedIcons = [
    { src: './icons/icon-192.png', sizes: '192x192', type: 'image/png' },
    { src: './icons/icon-512.png', sizes: '512x512', type: 'image/png' },
  ];
  if (JSON.stringify(manifest.icons) !== JSON.stringify(expectedIcons)) {
    throw new Error('manifest 아이콘 경로·크기·형식이 빌드 산출물과 일치하지 않습니다.');
  }
  pngDimensions(await readFile(path.join(directory, 'icons/icon-192.png')), 'icons/icon-192.png', 192);
  pngDimensions(await readFile(path.join(directory, 'icons/icon-512.png')), 'icons/icon-512.png', 512);

  const worker = textFiles.get('sw.js');
  const cacheFilesMatch = worker.match(/const APP_FILES\s*=\s*(\[[\s\S]*?\]);/);
  if (!cacheFilesMatch) throw new Error('Service Worker 캐시 허용 목록이 없습니다.');
  let cacheFiles;
  try {
    cacheFiles = JSON.parse(cacheFilesMatch[1]);
  } catch {
    throw new Error('Service Worker 캐시 허용 목록이 JSON 배열이 아닙니다.');
  }
  const cacheWrites = [...worker.matchAll(/\bcache\.addAll\s*\(([^)]*)\)/g)];
  if (JSON.stringify(cacheFiles) !== JSON.stringify(requiredCacheFiles) ||
      cacheWrites.length !== 1 || cacheWrites[0][1].trim() !== 'APP_FILES') {
    throw new Error('Service Worker는 허용된 앱 파일만 캐시해야 합니다.');
  }
  if (/\bcache\.(?:add|put)\s*\(/.test(worker) || /skipWaiting|location\.reload|clients\.claim/i.test(worker)) {
    throw new Error('Service Worker에 임의 캐시 쓰기 또는 강제 업데이트 동작이 있습니다.');
  }

  const versionMatch = html.match(/id="build-version">([a-f0-9]{12})<\/span>/);
  const workerVersionMatch = worker.match(/const BUILD_VERSION = '([a-f0-9]{12})';/);
  if (!versionMatch || !workerVersionMatch || workerVersionMatch[1] !== versionMatch[1] ||
      !/const SCOPE_KEY = encodeURIComponent\(new URL\(self\.registration\.scope\)\.pathname\);/.test(worker) ||
      !/const CACHE_PREFIX = `bean-pocket-shell-\$\{SCOPE_KEY\}-`;\s*const CACHE_NAME = `\$\{CACHE_PREFIX\}\$\{BUILD_VERSION\}`;/.test(worker) ||
      !/\.filter\(name => name\.startsWith\(CACHE_PREFIX\) && name !== CACHE_NAME\)/.test(worker)) {
    throw new Error('화면 빌드 버전과 scope별 Service Worker 캐시 namespace가 일치하지 않습니다.');
  }
  if (found.size !== allowedFiles.size) throw new Error('산출물 허용 목록이 일치하지 않습니다.');
  return true;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    await checkPages(process.argv[2] ? path.resolve(process.argv[2]) : defaultOutputDir);
    console.log('Pages 산출물 검사 통과');
  } catch (error) {
    console.error(`Pages 산출물 검사 실패: ${error.message}`);
    process.exitCode = 1;
  }
}
