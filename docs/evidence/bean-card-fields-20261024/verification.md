# 원두 카드 항목 구분 — 2026-10-24

로스터리, 산지·농장, 품종, 프로세싱, 향미 노트를 각 라벨과 값으로 표시한다. 기존 origin은 산지·농장 통합 필드이므로 원문을 분해하지 않는다. 누락값은 기록 없음으로 표시한다.

- 선행 테스트: node --test --test-name-pattern="bean cards" test/pwa-ui.view.test.mjs — 2개 의도한 실패 (dt/dd 없음), 종료 코드 1. red.log 참조.
- node --test test/pwa-ui.view.test.mjs — 52/52 통과, 종료 코드 0.
- npm test — 451/451 통과, 종료 코드 0.
- npm run build:pages — e450b7ab5b62, 종료 코드 0.
- npm run check:pages — 통과, 종료 코드 0.
- 브라우저: Chrome DevTools MCP 미제공으로 Playwright 독립 Chromium 사용. 320/375/390/768/1440px에서 라벨·값, 누락값, 가로 넘침 없음, 페이지 오류·HTTP 오류 없음 확인. browser.json 및 스크린샷 참조.
- 직접 변경 검토: textContent 기반 출력 유지, dl/dt/dd 의미 구조, CSS 범위 제한, 삭제·기록 보기 동작 유지, 저장소 스키마 변경 없음. git diff --check 통과.
- iPhone 실기기와 사용자 연결의 실제 원두 목록은 이번 브라우저 fixture 검증에 포함하지 않음.

게시 결과는 deployment.md에 기록한다.
