# 원두 카드 클릭으로 추출 기록 열기 — 2026-10-25

원두 카드의 별도 추출 기록 버튼을 제거했다. 원두 이름을 native anchor로 만들고 CSS 가상 요소로 카드 전체 클릭 영역을 제공한다. 삭제 버튼은 링크와 형제 요소로 유지하며 위쪽 레이어에서 독립적으로 동작한다. 키보드로 링크와 삭제 버튼을 각각 탐색할 수 있고 링크 포커스는 카드 외곽선으로 표시한다.

- `red.tap`: 새 native 링크가 없어서 실패한 구현 전 회귀 테스트. 4 통과, 1 실패, 종료 코드 1.
- `test.tap`: 구현 후 `npm test`, 478 통과, 실패·skip 0, 종료 코드 0.
- `build.txt`, `check.txt`: `npm run build:pages`, `npm run check:pages`, 각각 종료 코드 0. 빌드 `800042497a25`.
- `browser-check.cjs`, `browser.json`, `browser.log`, `card-*.png`: 합성 데이터로 Chromium 320/390/768/1024/1440px에서 본문과 카드 여백 클릭, Enter 이동, Tab으로 삭제 버튼 이동, 삭제 취소 후 목록 유지, 가로 넘침 없음 및 pageerror 없음 확인. 종료 코드 0. 390px 스크린샷 직접 열람 완료.
- `browser-runtime-failure.log`: 번들 Playwright의 기본 브라우저 경로에 실행 파일이 없어 실패. 설치된 Chromium 경로를 명시해 해결.
- `browser-target-failure.log`: 확장 링크가 metadata 요소를 덮어 Playwright의 metadata 직접 클릭이 거부됨. 사용자 동작과 같은 마우스 좌표 클릭으로 바꾸어 검증 완료.

메인 에이전트가 정확성·단순성·기존 라우팅·텍스트 안전성·성능 관점으로 diff를 자체 검토했다. 새 의존성이나 데이터 쓰기는 없으며 차단 사항 없음. 작은 UI 변경으로 서브에이전트는 구성하지 않았다. iPhone Safari 및 홈 화면 설치 앱에서의 실제 조작은 미검증이다.

게시 결과는 deployment.md에 별도 기록한다.
