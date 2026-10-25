# 상단 고정 메뉴 — 2026-10-25

- 원두·봉지·레시피·추출 기록을 실제 `.site-header`로 이동하고 아이콘과 이름을 표시했다. 헤더는 배경색과 겹침 순서를 갖춘 `position: sticky; top: 0`을 사용한다.
- 헤더 밖으로 이동한 메뉴의 클릭 처리, pending/frozen 잠금, 연결 전 숨김, 활성 메뉴 표시를 유지했다.
- 테스트 선행: 새 header navigation 테스트는 구현 전 `primary navigation belongs in the site header`로 실패했다. 구현 후 전체 `npm test` 452/452 통과(종료 0).
- `npm run build:pages`, `npm run check:pages` 모두 종료 0. 빌드 `664d5b995172`.
- Chrome / WebKit, 너비 320·390·768·1024·1440에서 600px 스크롤 후 헤더 top=0, 메뉴 이름, 네 메뉴 전환·활성 표시, 가로 넘침 없음, JS pageerror 없음 확인. 로컬 합성 원두 데이터로 실행했으며 실제 Notion 데이터는 사용하지 않았다.
- 브라우저 실행 환경 보정: bundled Chromium headless shell 미설치로 설치된 Chrome channel 사용. hashchange 전에 확인하던 검증은 렌더 완료를 기다리도록 수정했다.
- 변경 검토: 이벤트 중복 실행 방지(본문 fallback일 때 nav 리스너 생략), 본문 및 헤더 메뉴의 상태 잠금, 모바일 줄바꿈, 기존 연결·저장 흐름을 확인했다. 의존성 추가 없음. `git diff --check` 통과.
- 실제 iPhone / 홈 화면 앱 / 사용자 Notion 연결 환경은 직접 확인하지 않았다.
- 브라우저 스크립트는 프로젝트 루트에서 실행하며 Playwright 경로는 이 작업 환경 기준이다. 스크린샷의 빌드 자리표시자는 소스 HTML을 사용하는 검증 harness 특성이다.
