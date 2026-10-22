# 작은 회색 추가 버튼 — 2026-10-22

사용자가 승인한 계획에 따라 원두·봉지·레시피·추출 기록의 + 버튼을 32×32px, 회색 #737373, 투명 배경, border: 0으로 변경했다. 1.5rem 아이콘과 기존 포커스 표시를 유지한다. 목록 헤더 범위에 한정한 CSS 한 규칙이며 휴지통·설정 버튼에는 적용되지 않는다.

- `npm test`: 종료 0, 413개 통과, 실패 0 (`tests.tap`).
- `npm run build:pages`, `npm run check:pages`: 종료 0, 빌드 `d903139c5081` (`build.txt`, `check.txt`).
- 격리된 headless Chrome에서 실제 view.mjs와 테스트 fixture로 네 탭 × 320/768/1024/1440px 검사: 실제 32×32px, 회색, 테두리 0, 투명 배경, 3px 키보드 포커스, 클릭 시 폼 열기 모두 통과. pageerror 0 (`browser.json`, `mobile.png`). Chrome DevTools MCP가 없어 Playwright를 사용했다. 번들 Chromium이 설치되지 않은 최초 실행은 실패했고 설치된 Chrome 채널로 검증했다.
- 코드 리뷰: CSS 우선순위와 전역 min-height 덮어쓰기, 적용 범위, 접근성 이름·포커스 유지, 화면 캡처 확인 완료. 추가 로직·의존성·데이터 처리 변경 없음. 지적사항 없음.
- 실제 iPhone 터치 사용성·Safari·홈 화면 실행은 미검증.
