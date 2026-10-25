# 한 줄 헤더 — 2026-10-25

로고와 네 메뉴, 연결 설정을 한 줄로 배치했다. 로고는 기존 12px에서 모바일 14px·일반 화면 20px로 확대했다. 메뉴 버튼은 44px 높이로 축소했고 모바일에서는 작은 아이콘과 글자를 표시한다. 빌드 표시는 하단으로 이동했으며 ID와 버전 주입을 유지했다. 실제 DOM 순서도 로고 → 메뉴 → 설정으로 맞췄다. 기존 sticky 고정과 메뉴 동작을 유지한다.

- 브라우저 선행 검증: 변경 전 `logo, navigation and tools share one row` 실패(browser-red.txt).
- 첫 구현의 320px에서 ‘추출 기록’ 글자가 버튼 경계를 넘어 마지막 열 폭을 보완했다.
- 최종 `npm test`: 452/452, 실패·skip 없음(종료 0).
- `npm run build:pages`, `npm run check:pages`, `git diff --check` 모두 종료 0. 최종 빌드 `57b7f23e191c`.
- Chrome / WebKit 각각 320·360·390·600·601·768·1024·1440px: 헤더 한 줄(세 요소의 수직 중심 일치), 로고 확대, 메뉴 축소, 600px 스크롤 후 sticky top=0, 가로 넘침 없음, 각 메뉴 이름이 버튼 안에 포함, 네 메뉴 전환과 활성 상태, JS pageerror 없음 확인.
- 검토: 빌드 ID 유일성, footer 버전 표시 유지, 메뉴·설정의 시각 및 DOM 순서 일치, pending/frozen 상태와 이벤트 처리 유지, 기존 하위 화면 스타일 영향 여부 확인. 의존성 추가 없음.
- 로컬 합성 데이터 사용. 실제 iPhone / 홈 화면 앱 / 사용자 Notion 연결은 미검증. browser-check.cjs는 프로젝트 루트에서 실행하며 Playwright 경로는 이 환경 기준이다.
