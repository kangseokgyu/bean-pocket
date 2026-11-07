#!/usr/bin/env bash
set -u

repo=github.com/kangseokgyu/bean-pocket
site=https://kangseokgyu.github.io/bean-pocket/

fail() {
  printf '실패: %s\n' "$2" >&2
  exit "$1"
}

run() {
  local step=$1 code
  shift
  printf '▶ %s\n' "$step" >&2
  "$@" || {
    code=$?
    fail "$code" "$step (종료 코드 $code). 위 명령 출력을 확인하세요."
  }
}

capture() {
  local target=$1 step=$2 output code
  shift 2
  printf '▶ %s\n' "$step" >&2
  output=$("$@") || {
    code=$?
    [[ -z "$output" ]] || printf '%s\n' "$output" >&2
    fail "$code" "$step (종료 코드 $code). 위 명령 출력을 확인하세요."
  }
  printf -v "$target" '%s' "$output"
}

build_version() {
  local html=$1 pattern='id="build-version">([a-f0-9]{12})</span>'
  if [[ "$html" =~ $pattern ]]; then
    printf '%s\n' "${BASH_REMATCH[1]}"
  else
    printf 'HTML에서 빌드 버전을 찾을 수 없습니다.\n' >&2
    return 1
  fi
}

[[ $# == 0 ]] || fail 2 '사용법: ./deploy-pages.sh'
run '저장소 폴더 열기' cd -- "$(dirname -- "${BASH_SOURCE[0]}")"
for tool in git node npm gh curl; do
  command -v "$tool" >/dev/null || fail 127 "$tool 명령을 찾을 수 없습니다. 설치 후 다시 실행하세요."
done

capture branch '현재 브랜치 확인' git symbolic-ref --quiet --short HEAD
[[ "$branch" == main ]] || fail 1 "현재 브랜치는 $branch 입니다. 변경을 main에 병합하고 main에서 실행하세요."
capture changes '작업 폴더 상태 확인' git status --porcelain --untracked-files=all
[[ -z "$changes" ]] || fail 1 "커밋되지 않은 변경이 있습니다. 배포할 파일을 커밋하고 작업 폴더를 정리하세요.
$changes"

capture remote '배포 저장소 확인' git remote get-url --push --all origin
case "$remote" in
  "https://$repo"| "https://$repo.git"|git@github.com:kangseokgyu/bean-pocket|git@github.com:kangseokgyu/bean-pocket.git|ssh://git@github.com/kangseokgyu/bean-pocket.git) ;;
  *) fail 1 'origin의 push 주소가 kangseokgyu/bean-pocket 저장소 하나를 가리켜야 합니다.' ;;
esac
capture commit '배포할 커밋 확인' git rev-parse HEAD
capture node_version 'Node.js 버전 확인' node --version
if [[ ! "$node_version" =~ ^v([0-9]+)\.([0-9]+)\.[0-9]+$ ]] ||
   (( BASH_REMATCH[1] < 22 || (BASH_REMATCH[1] == 22 && BASH_REMATCH[2] < 9) )); then
  fail 1 "Node.js 22.9 이상이 필요합니다. 현재 버전: $node_version"
fi
run 'GitHub 인증 확인 (필요하면 gh auth login --hostname github.com 실행)' gh auth status --active --hostname github.com
run '테스트' npm test
run '일반판 빌드' npm run build:pages
run '산출물 검사' npm run check:pages
capture local_html '로컬 HTML 읽기' cat dist/index.html
capture version '로컬 빌드 버전 확인' build_version "$local_html"

capture checked_commit '검증 후 커밋 확인' git rev-parse HEAD
capture changes '검증 후 작업 폴더 상태 확인' git status --porcelain --untracked-files=all
[[ "$commit" == "$checked_commit" && -z "$changes" ]] ||
  fail 1 '검증 중 커밋 또는 작업 폴더가 바뀌었습니다. 변경을 정리한 뒤 다시 실행하세요.'

run '검증한 커밋을 origin/main에 push' git push origin "$commit:refs/heads/main"
capture run_url '일반판 배포 요청' gh workflow run pages.yml -R "$repo" --ref main -f probes=false
run_prefix="https://$repo/actions/runs/"
run_id=${run_url#"$run_prefix"}
[[ "$run_url" == "$run_prefix"* && "$run_id" =~ ^[0-9]+$ ]] ||
  fail 1 "배포 요청은 접수됐지만 실행 URL을 받지 못했습니다. 다시 요청하기 전에 https://$repo/actions/workflows/pages.yml 에서 실행을 확인하세요."

printf 'GitHub Actions 실행: %s\n' "$run_url"
capture deployed_commit 'GitHub Actions의 대상 커밋 확인' gh run view "$run_id" -R "$repo" --json headSha --jq .headSha
[[ "$deployed_commit" == "$commit" ]] ||
  fail 1 "GitHub Actions 대상 커밋이 다릅니다. 검증: $commit, 실행: $deployed_commit. $run_url 에서 실행을 확인하세요."

if gh run watch "$run_id" -R "$repo" --exit-status; then
  printf 'GitHub Actions 실행 완료\n'
else
  code=$?
  gh run view "$run_id" -R "$repo" --log-failed >&2 || :
  fail "$code" "GitHub Actions 실행이 실패했거나 상태를 확인할 수 없습니다 (종료 코드 $code). $run_url"
fi

capture public_html '공개 사이트 접속' curl -fsSL --max-time 20 -H 'Cache-Control: no-cache' "${site}?build=$version"
capture public_version '공개 빌드 버전 확인' build_version "$public_html"
[[ "$public_version" == "$version" ]] ||
  fail 1 "GitHub Actions는 성공했지만 공개 빌드가 다릅니다. 예상: $version, 공개: $public_version. 잠시 후 $site 에서 다시 확인하세요."

printf '배포 완료: %s (빌드 %s, 커밋 %s)\n' "$site" "$version" "$commit"
