#!/usr/bin/env bash
set -euo pipefail

task_project_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "$task_project_root"
npm run build:probes
npm run check:probes

task_preview_root="$(mktemp -d "${TMPDIR:-/tmp}/bean-pocket-preview.XXXXXX")"
mkdir "$task_preview_root/bean-pocket"
cp -R dist/. "$task_preview_root/bean-pocket/"
task_preview_port="${1:-4188}"
echo "미리보기: http://localhost:$task_preview_port/bean-pocket/"
python3 -m http.server "$task_preview_port" --bind 127.0.0.1 --directory "$task_preview_root"
