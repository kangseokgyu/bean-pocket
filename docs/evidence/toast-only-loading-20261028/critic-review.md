# Critic review — toast-only loading

- Verdict: **Approve**. Required/Critical findings 없음.
- Reviewer role/model: Critic, `gpt-6.1-sol`, reasoning `medium`.
- Reviewed commit: `5231ba9` (`f5ab1c6..5231ba9`), branch `codex/toast-only-loading`.
- 제품 코드를 수정하지 않았다. `AGENTS.md`, `code-review-and-quality` 및 브라우저 검증 스킬을 직접 읽고 요구사항·변경 테스트·제품 diff·연관 controller 상태 흐름·검증 증거를 독립 확인했다.

## 검토 결과

- Correctness: 전체 화면 overlay DOM/CSS와 startup/operation spinner를 제거했고 pwa 소스에 잔존 참조가 없다. 기존 상단 pull-to-refresh spinner는 유지한다. startup-checking 토스트는 pending 동안 body에 위치하므로 `.page[inert]` 밖에 있다. 초기화 saved/missing/error/recovery/busy/read-error 결과 테스트와 controller의 완료/오류/finally 흐름을 확인했다.
- Pending locks: startup inert 및 pending 버튼 비활성화 경로를 유지한다. Controller 중복 요청 거절과 view의 삭제 중복 제출/Escape 잠금도 유지한다. 기존 fullscreen surface의 제거로 이들 조건을 약화하지 않는다.
- Dialog/host: delete dialog pending 상태에만 토스트를 보여준다. 결과가 나오면 기존 dialog feedback으로 전달하고, dialog를 닫으면 status를 앱의 popover host로 복귀시킨다. 연결 dialog 및 popover unsupported fallback 분기도 확인했다.
- Timers/icons: 기존 완료 체크 아이콘, pending 중 숨김 방지, pending cleanup 후 1초 숨김 타이머를 유지한다. 관련 기존/변경 테스트가 이를 검증한다.
- Readability/architecture: 기존 status toast helper를 확장하고 overlay 분기를 삭제한 작은 변경이다. 새 의존성/불필요한 추상화가 없다.
- Security/performance: 토스트 문구는 기존 textContent 경로를 사용한다. 외부 요청/권한/민감정보 취급 변경이 없다. 새 unbounded 작업이 없고 기존 spinner DOM 및 관련 상태 조작을 줄였다.

## 독립 검증

1. `git diff --check f5ab1c6..5231ba9`: exit 0. pwa 소스에서 `startup-loading|operation-spinner|startup-spinner` 검색 결과 없음.
2. 격리 `git archive` 사본에서 새 delete pending 조건의 `!currentState.pending`를 `currentState.pending`로 뒤집었다. targeted `node --test --test-name-pattern='delete confirm shows pending feedback' test/pwa-ui.view.test.mjs`는 toast hidden assertion에서 의도대로 exit 1 (0 pass/1 fail). 원본 source를 사본에 복원한 뒤 같은 테스트 exit 0 (1/1 pass). 제품 작업 트리는 수정하지 않았다. `critic-mutation.txt` 참조.
3. Chromium/WebKit, 390×844 localhost native dialog fixture에서 각 5개 검증 통과: 삭제 pending toast가 실제 modal 안에서 visible, 취소 disabled/Escape 차단 및 제출 1회, 실패 시 modal 안 toast 숨김, 닫기 후 popover host 복귀, 1초 후 숨김. pageerror 각 0. `critic-runtime.cjs`, `critic-runtime.json` 참조. DevTools MCP가 제공되지 않아 기존 Playwright 런타임의 격리 headless browser를 사용했다.
4. Worker의 `startup-390.png`를 직접 열어 하단 toast와 skeleton 화면, fullscreen overlay 부재를 확인했다.

## Worker 증거 교차 확인

- `focused-red-assertions.tap`: 124 tests, 11 intended failures. 최초 RED OOM과 assertion 정정은 README에 명시되어 있다.
- `focused-green.tap`: 124/124 pass.
- `npm-test.tap`: 595/595 pass, fail/cancel/skip 0.
- `build-pages.txt`, `check-pages.txt`: 성공, build `a0341422e675`.
- `browser.cjs`와 `browser-results.json`: Chromium/WebKit × 390/768px, 4조합 각 5개 startup/initial read/refresh 검증 및 pageerror 0. fixture가 실제 view/controller를 사용하고 mock network gates로 pending을 유지함을 확인했다.
- 변경되지 않은 전체 테스트/빌드는 중복 재실행하지 않았다.

## 한계

실제 Notion 요청·저장·삭제, 실기기 Safari, 스크린 리더 음성은 확인하지 않았다. DOM/native dialog와 접근 가능한 host 조건을 확인했으며 음성 발표 여부까지 검증했다는 의미는 아니다. 배포 및 공개 버전 반영 확인은 Orchestrator 담당이다.

## 실행 환경 기록

격리 mutation 테스트 자체는 실행됐으나 첫 증거 저장은 워크트리 경로의 sandbox 쓰기 제한으로 실패해 `/tmp`로 저장했다. 최초 localhost 실행은 sandbox `listen EPERM`으로 시작되지 않았고, 승인된 escalated 실행으로 동일 fixture를 완료했다. 이들은 제품 실패가 아니다.
