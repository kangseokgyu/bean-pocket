# 전체 화면 초기 로딩 및 정상 조회 메시지 숨김 — 2026-10-22

## 요청과 변경

- 초기 연결 확인 스피너를 화면 전체를 덮는 오버레이로 변경한다. 첫 목록 로딩까지 유지하고, 완료·오류·복구·재시도·동결 상태 종료 시 숨기며 스피너 자식 요소를 제거한다.
- 오버레이는 body 직속에 둔다. 당겨서 새로고침의 페이지 transform이나 콘텐츠 너비에 영향을 받지 않고 viewport 중앙에 배치된다. 로딩 중 배경 페이지에는 inert를 적용하고, 종료 시 해제한다.
- 기존 role=status, aria-live=polite와 시각적으로 숨긴 진행 안내, 모션 감소 설정을 유지한다.
- 정상 목록 조회는 ready 상태를 유지하되 메시지는 비운다. view에서도 ready 문구를 숨기므로 “최신 목록을 불러왔습니다.”가 표시되지 않는다. 초기 로딩과 새로고침의 이전 오류 안내도 정상 조회 후 사라진다.
- 연결 저장·잠금·Notion 통신·데이터 포맷은 변경하지 않는다. 오류·복구·연결 설정·저장 성공 안내는 유지한다.

## 작업 및 검증

기능별 워크트리 및 `codex/fullscreen-startup-loading` 브랜치, 기준 main `242b22c`에서 직접 구현·리뷰했다. 작업이 작아 별도 에이전트는 구성하지 않았다.

| 검증 | 명령/방법 | 결과 | 근거 |
| --- | --- | --- | --- |
| 선행 테스트 | `node --test --test-name-pattern='startup checking\|initialization spinner\|startup overlay' test/pwa-ui.view.test.mjs` | 종료 1, 오버레이 부재로 실패 확인 | red.tap |
| 관련 테스트 | `node --test test/pwa-ui.view.test.mjs test/pwa-ui.integration.test.mjs` | 종료 0, 48개 통과 | focused-tests.tap |
| 전체 테스트 | `npm test` | 종료 0, 393개 통과, 실패·생략 0 | feature-tests.tap |
| 일반판 빌드 | `npm run build:pages` | 종료 0, `b59e7562ff54` | feature-build.txt |
| 산출물 검사 | `npm run check:pages` | 종료 0 | feature-check.txt |
| 브라우저 | 격리 Chromium, 실제 dist의 view/controller/CSS를 읽는 로컬 fixture와 실제 앱 첫 실행 | 320·390·768·1024·1440px에서 전체 viewport 일치·수평/수직 중앙·넘침 없음. 부모 페이지에 transform이 있어도 전체 화면 유지. 배경 Tab 접근 차단 및 완료 후 focus 가능. 모션 감소, 회전 픽셀 차이, 초기 조회 대기와 7개 결과(성공·연결 없음·오류·복구·잠금·조회 오류·동결), 재조회 후 정상 메시지 없음 확인. 실행 오류·HTTP 오류 0 | browser-results.json, checking-mobile.png, loaded-mobile.png |

Chrome DevTools MCP는 제공되지 않아 기존 설치된 Playwright와 격리 Chromium headless shell 1208을 사용했다. 실제 자격정보 없이 로컬 fixture와 새 브라우저 저장소로 검증했다.

## 변경분 리뷰

요구사항·테스트·변경분을 직접 확인했다. 오버레이를 transform 영역 바깥에 두고, initialize의 finally에서도 종료해 첫 readLatest가 동결 상태로 조기에 반환되는 경우에도 남지 않는다. ready 메시지 제거 후 상태 영역이 즉시 숨겨지고 이전 오류 텍스트가 지워진다. 다른 성공 메시지의 기존 3초 타이머 테스트는 connected 상태로 유지했고, ready는 즉시 숨김 테스트로 바꾸었다. 관련 없는 리팩터링·의존성·저장 변경 없음. `git diff --check` 통과. 병합 차단 사항 없음.

## 미검증 범위와 복귀

실제 iPhone Safari·홈 화면 PWA·실기기 스크린리더 음성 출력과 실제 Notion 연결은 미검증이다. 회귀 시 이번 기능 커밋만 revert한 뒤 필수 테스트·빌드·검사를 통과시켜 일반판 pages.yml(probes=false)으로 재게시한다.

main 통합과 최종 공개 확인 근거는 아래에 추가한다.
