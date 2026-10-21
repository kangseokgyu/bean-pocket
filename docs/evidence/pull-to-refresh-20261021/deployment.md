# 아래로 당겨 페이지 새로고침 게시 — 2026-10-21

사용자 ‘배포해줘’ 승인 후 커밋 `d0e95969f8b7e8b15da970520ab03d007f2a419d`를 origin/main에 push하고 일반판 Pages workflow를 실행했다.

- 화면 맨 위에서 아래로 80px 이상 당겼다가 놓으면 페이지 전체를 다시 로드한다. 당기는 중 안내를 표시하고, 미저장 입력은 다시 로드할 때 초기화된다.
- 짧은 당김·되돌림·터치 취소·가로/위쪽 스와이프·두 손가락·입력 칸/버튼/표/내부 스크롤 영역에서 시작한 동작을 제외한다. 저장·조회 또는 업데이트 동결 중에는 다시 로드하지 않는다.
- 선행 신규 테스트: 2 통과·4 실패. 구현 후 UI 관련 테스트 29/29 통과, 전체 `npm test` exit 0 및 373/373 통과. `/tmp/ax-pull-red.tap`, `/tmp/ax-pull-focused.tap`, `/tmp/ax-pull-full.tap`.
- `npm run build:pages`, `npm run check:pages`, `git diff --check`: exit 0. 빌드 `3caf90b50b4d`.
- [Actions 39531992969](https://github.com/kangseokgyu/bean-pocket/actions/runs/39531992969): success. 대상 head는 위 커밋과 일치. runner 373/373 통과 및 빌드·검사·배포 성공. `/tmp/ax-pull-pages.log`, `/tmp/ax-pull-deploy-result.json`.
- [공개 사이트](https://kangseokgyu.github.io/bean-pocket/)의 HTTPS 파일 18개 모두 HTTP 200이며 로컬 dist 바이트와 일치했다. 공개 index의 빌드는 `3caf90b50b4d`. `/tmp/ax-pull-published-https.txt`.

실행 명령: `git push origin main`, `gh workflow run pages.yml --ref main -f probes=false`, `gh run watch 39531992969 --exit-status --interval 10`, `gh run view` 및 Python HTTPS 파일 비교. 최종 exit 0.

Safari/iPhone 실기기의 실제 스와이프 및 기존 설치 앱의 새 빌드 전환은 직접 확인하지 않았다.
