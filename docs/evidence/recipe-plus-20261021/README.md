# 레시피 새 작성 + 버튼 — 2026-10-21

레시피 탭을 `/recipes` 목록으로 변경하고, 원두와 같은 상단 `+` 버튼으로 작성 폼을 연다. 기본 폼은 숨기고 기존 레시피의 상세 진입과 빈 목록 안내를 표시한다. 입력·단계·열림 상태는 재조회와 탭 이동 시 유지한다. 취소 및 저장 성공의 초안 정리 시 폼을 닫는다. 기존 `/recipes/new` 직접 진입과 복사 경로에서는 작성 폼을 연다.

검증:

- 선행 신규 테스트: `node --test --test-name-pattern='recipe creation opens' test/pwa-ui.view.test.mjs`, exit 1. `/recipes` 탭이 없어 의도한 실패를 확인했다.
- 구현 후 UI 테스트: `node --test test/pwa-ui.view.test.mjs`, exit 0, 30/30 통과. `/tmp/recipe-ui-test.log`.
- 최종 `npm test`: exit 0, 380/380 통과. `/tmp/recipe-full-approved.log`. 신규 테스트는 기본 숨김, + 열기, 접근성 속성, 목록 표시, 입력·단계 유지, 취소·초안 정리 시 닫기, 직접 작성 진입, 저장 중 버튼 비활성화, 빈 목록 및 상세 화면을 확인한다.
- 최초 전체 테스트는 sandbox의 로컬 HTTP listen EPERM으로 367 통과·13 실패(`/tmp/recipe-full-test.log`). 로컬 서버 실행 허용 후 위 최종 검증이 통과했다.
- `npm run build:pages`, `npm run check:pages`, `git diff --check`: exit 0. 일반판 빌드 `742e8b37c9c9`.
- 단순 UI 변경으로 별도 에이전트 구성 없이 직접 수행했다.

실제 브라우저 시각 검사, iPhone 실기기 조작, Notion 실제 쓰기는 실행하지 않았다. 게시 결과는 후속 기록을 따른다.

게시 완료:

- 구현 커밋 `2cd7662c767a6bc0d75c1e1950fdabe0ff0da2ce`를 `origin/main`에 push했다. merge 없이 기존 main에서 이번 변경만 커밋했다.
- `gh workflow run pages.yml --ref main -f probes=false` 실행 후 [Actions 39544921541](https://github.com/kangseokgyu/bean-pocket/actions/runs/39544921541)의 대상 head 일치 및 build/deploy success를 확인했다. 상세 결과 `/tmp/recipe-pages-result.json`.
- [공개 사이트](https://kangseokgyu.github.io/bean-pocket/)의 빌드는 `742e8b37c9c9`. HTTPS 파일 18개 모두 HTTP 200이고 로컬 dist와 바이트가 일치했다. [파일 비교 기록](published-https.txt).
- iPhone 실기기·기존 설치 앱의 빌드 전환·Notion 실제 쓰기 및 브라우저 시각 검사는 미실행이다.
