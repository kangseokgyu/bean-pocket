# 상태 메시지 자동 숨김 게시 — 2026-10-21

사용자 ‘배포해줘’ 승인 후 커밋 `5f8c7a5f261086e04ca34bc833f07455d64f1f82`를 origin/main에 push하고 일반판 Pages workflow를 실행했다.

- 정상 처리 메시지는 3초 뒤 숨긴다. 오류·복구 확인·진행 중 메시지는 유지하며, 새 메시지가 표시되면 이전 숨김 타이머를 취소한다.
- 선행 신규 테스트는 1 통과·2 실패. 정상 메시지가 숨겨지지 않는 의도한 실패를 확인했다. `/tmp/ax-status-red.tap`.
- 구현 후 UI 테스트 23/23 통과. 전체 테스트 최초 실행은 로컬 서버 listen EPERM으로 354 통과·13 실패. 서버 실행 허용 후 `npm test`는 exit 0, 367/367 통과. `/tmp/ax-status-focused.tap`, `/tmp/ax-status-full.tap`, `/tmp/ax-status-full-approved.tap`.
- `npm run build:pages`, `npm run check:pages`, `git diff --check`: exit 0. 빌드 `2488de879e15`.
- [Actions 39528215055](https://github.com/kangseokgyu/bean-pocket/actions/runs/39528215055): success. 배포 대상 head는 위 커밋과 일치하며 회귀 테스트·일반 빌드·검사·배포를 완료했다. `/tmp/ax-status-pages.log`, `/tmp/ax-status-deploy-result.json`.
- [공개 사이트](https://kangseokgyu.github.io/bean-pocket/)의 HTTPS 파일 18개 모두 HTTP 200이며 로컬 dist 바이트와 일치했다. 공개 index의 빌드는 `2488de879e15`. `/tmp/ax-status-published-https.txt`.

실행 명령: `git push origin main`, `gh workflow run pages.yml --ref main -f probes=false`, `gh run watch 39528215055 --exit-status --interval 10`, `gh run view` 및 Python HTTPS 파일 비교. 최종 exit 0.

iPhone 실기기 조작 및 기존 설치 앱의 새 빌드 전환은 직접 확인하지 않았다.
