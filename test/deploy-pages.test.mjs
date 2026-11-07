import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, copyFileSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

const commit = 'a'.repeat(40);
const runUrl = 'https://github.com/kangseokgyu/bean-pocket/actions/runs/123';
const version = 'abcdef012345';

function deploy(t, { failAt = '', dirty = false, remoteVersion = version } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'bean-pocket-deploy-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  copyFileSync(new URL('../deploy-pages.sh', import.meta.url), join(dir, 'deploy-pages.sh'));
  const command = join(dir, 'stub');
  writeFileSync(command, [
    '#!/bin/bash',
    'name=$(basename "$0")',
    'printf "%s %s\\n" "$name" "$*" >> "$CALLS"',
    'if [[ "$name:$*" == "$FAIL_AT" ]]; then echo "fixture: permission denied" >&2; exit 17; fi',
    'case "$name:$*" in',
    '  "git:symbolic-ref "*) echo main ;;',
    '  "git:status "*) [[ "$DIRTY" == yes ]] && echo " M pwa/index.html"; exit 0 ;;',
    '  "git:remote "*) echo https://github.com/kangseokgyu/bean-pocket.git ;;',
    '  "git:rev-parse "*|"gh:run view "*"--json headSha"*) echo "$COMMIT" ;;',
    '  "node:--version") echo v22.17.0 ;;',
    '  "npm:run build:pages") mkdir -p dist; printf \'<span id="build-version">%s</span>\' "$VERSION" > dist/index.html ;;',
    '  "gh:workflow run "*) echo "$RUN_URL" ;;',
    '  "gh:run view "*"--log-failed"*) echo "fixture: CI test failed" ;;',
    '  "curl:"*) printf \'<span id="build-version">%s</span>\' "$REMOTE_VERSION" ;;',
    'esac',
  ].join('\n'));
  chmodSync(command, 0o755);
  for (const name of ['git', 'gh', 'npm', 'node', 'curl']) symlinkSync(command, join(dir, name));
  const calls = join(dir, 'calls');
  writeFileSync(calls, '');
  const result = spawnSync('bash', [join(dir, 'deploy-pages.sh')], {
    env: {
      ...process.env, PATH: dir + ':' + process.env.PATH, CALLS: calls, FAIL_AT: failAt,
      DIRTY: dirty ? 'yes' : 'no', COMMIT: commit, VERSION: version,
      REMOTE_VERSION: remoteVersion, RUN_URL: runUrl,
    },
    encoding: 'utf8',
  });
  return { ...result, calls: readFileSync(calls, 'utf8') };
}

test('stops at a failed local check, preserving the reason and exit code', (t) => {
  const result = deploy(t, { failAt: 'npm:run check:pages' });
  assert.equal(result.status, 17, result.stderr);
  assert.match(result.stderr, /fixture: permission denied/);
  assert.match(result.stderr, /산출물 검사.*17/);
  assert.doesNotMatch(result.calls, /git push|gh workflow run/);
});

test('refuses to deploy changes that are not committed', (t) => {
  const result = deploy(t, { dirty: true });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /커밋되지 않은 변경/);
  assert.doesNotMatch(result.calls, /npm test|git push|gh workflow run/);
});

test('deploys the checked commit as the regular build and verifies the public version', (t) => {
  const result = deploy(t);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.calls, new RegExp('git push origin ' + commit + ':refs/heads/main'));
  assert.match(result.calls, /gh workflow run pages.yml .*--ref main .*probes=false/);
  assert.match(result.calls, /gh run watch 123 .*--exit-status/);
  assert.match(result.stdout, /배포 완료.*abcdef012345/);
});

test('shows the workflow failure log and skips the public check', (t) => {
  const result = deploy(t, { failAt: 'gh:run watch 123 -R github.com/kangseokgyu/bean-pocket --exit-status' });
  assert.equal(result.status, 17);
  assert.match(result.stderr, /fixture: CI test failed/);
  assert.match(result.stderr, /GitHub Actions.*17/);
  assert.doesNotMatch(result.calls, /^curl /m);
});

test('fails if the public build differs from the local build', (t) => {
  const result = deploy(t, { remoteVersion: '000000000000' });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /abcdef012345.*000000000000/);
  assert.doesNotMatch(result.stdout, /배포 완료/);
});
