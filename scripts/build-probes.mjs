import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildPages } from './build-pages.mjs';

export function buildProbes(options = {}) {
  return buildPages({ ...options, includeProbes: true });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    console.log(`실험판 산출물 생성 완료 (${await buildProbes()})`);
  } catch (error) {
    console.error(`실험판 빌드 실패: ${error.message}`);
    process.exitCode = 1;
  }
}
