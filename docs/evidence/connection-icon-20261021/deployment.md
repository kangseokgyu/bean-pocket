# Notion 연결 설정 아이콘 게시 — 2026-10-21

- 빌드 정보 왼쪽에 설정 아이콘을 배치했다. 저장된 연결이 확인되면 입력 영역 전체를 숨기고, 아이콘으로 열고 닫는다. 입력 중인 값은 토글로 지우지 않는다. 연결이 없으면 입력 영역을 자동으로 열고, 저장소 확인 중에는 입력을 숨기며 복구 안내는 유지한다.
- 소스 커밋: `9398625c7f5dda67075af355f44066cab93f736e`. 일반판 빌드: `52dac02d81e9`.
- 선행 테스트: `node --test test/pwa-ui.view.test.mjs`에서 신규 2개가 의도한 동작 부재로 실패했다(27 통과, 2 실패). 로그: `/tmp/ax-connection-icon-red.tap`.
- 구현 후 UI 테스트: 29/29 통과, exit 0. 로그: `/tmp/ax-connection-icon-focused.tap`.
- 전체 `npm test`: 최초 실행은 로컬 서버 listen EPERM으로 366 통과, 13 실패. 서버 실행 권한을 허용한 재실행은 379/379 통과, exit 0. 로그: `/tmp/ax-connection-icon-full.tap`, `/tmp/ax-connection-icon-full-approved.tap`.
- `npm run build:pages`, `npm run check:pages`, `git diff --check`: 모두 exit 0.
- `git push origin main` 후 `gh workflow run pages.yml --ref main -f probes=false` 실행. [Actions 39543134077](https://github.com/kangseokgyu/bean-pocket/actions/runs/39543134077): success, headSha는 소스 커밋과 일치.
- [공개 사이트](https://kangseokgyu.github.io/bean-pocket/) 파일 18개 모두 HTTP 200, 로컬 dist와 바이트 일치. 공개 빌드 `52dac02d81e9` 확인. Python urllib 검증 exit 0, 로그: `/tmp/ax-connection-icon-published.txt`.
- 브라우저 직접 확인은 로컬 주소 접근 자동 승인 검토가 두 번 시간 초과되어 수행하지 못했다. 안전하지 않다는 판정은 아니었다. iPhone 실기기, 실제 Notion 연결, 기존 설치 앱의 새 버전 적용은 직접 확인하지 않았다.

단순 UI 변경으로 별도 에이전트를 구성하지 않고 직접 구현·검토했다. 게시 증거 문서 추가 후 앱 소스에는 변경이 없다.
