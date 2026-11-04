# 목록 조회 호환 수정 게시

2026-11-04 KST 확인.

- 수정 커밋 `fc6d278`을 기능 브랜치 `codex/favorites-list-compat`에서 main으로 fast-forward 통합했다. Worker는 허용된 대체 설정 `gpt-6.1-sol / medium`, Critic은 `gpt-6.1-sol / medium`으로 실행했고 독립 검토를 통과했다.
- 통합 후 `npm test`는 689개 통과, 실패 0개, 종료 코드 0이다. `npm run build:pages`, `npm run check:pages`도 종료 코드 0이다. 원문은 `integrated-test.log`, `integrated-build.log`, `integrated-check.log`에 저장했다.
- 빌드 버전은 `01020123e8b7`이다.
- `pages.yml`, `main`, `probes=false`로 [배포 실행 41824584519](https://github.com/kangseokgyu/bean-pocket/actions/runs/41824584519)을 요청했고 성공했다.
- [공개 앱](https://kangseokgyu.github.io/bean-pocket/)은 HTTP 200, 표시 버전 `01020123e8b7`이다. 공개 파일 27개 모두 로컬 dist와 바이트가 일치했다. 파일별 상태와 SHA-256은 `public-files.json`에 기록했다.
- 공개 검사는 `node docs/evidence/brew-record-handoff-20261030/verify-public.mjs dist https://kangseokgyu.github.io/bean-pocket/`로 수행했고 종료 코드 0이다. 확인 후 앱 소스 변경은 없다.

Fix Root Causes 원칙에 따라 화면의 오류를 숨기지 않고, 공통 네트워크 경계에서 검증된 DB 속성만 요청하도록 수정했다. 기존 DB에 없는 선택 속성을 포함하는 요청은 엄격한 합성 서버에서 HTTP 400으로 재현했고 수정 후 통과했다. 실제 운영 Notion 응답과 사용자 계정에서의 목록 복구 여부는 확인하지 않았다. Notion 데이터나 스키마를 변경하지 않았다. 실제 모바일 브라우저 확인도 수행하지 않았다.
