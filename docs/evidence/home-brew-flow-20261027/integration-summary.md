# 최신 main 통합 검증 — worker-2

## 대상과 범위

- 시작 HEAD: `2e8ec44` (`merge: integrate latest tab loading behavior`). 부모는 `38a2c02`와 최신 main `3d68e2c`이며 `a63b2c4`의 탭 전환 스켈레톤을 포함한다.
- 요청 범위: controller/view/test 자동 병합의 동작 호환 확인, 필수 검증 및 기존 Worker2 E2E 재실행. 서브에이전트·merge·push·배포 없음.
- 원문 `critic-review.md`, `critic-rereview.md` 및 기존 미추적 status 2개는 변경·stage하지 않았다. 기존 Worker2 증거도 덮어쓰지 않았다.

## 확인한 호환성 문제와 최소 수정

자동 병합 직후 기존 전체 테스트는 558 pass, 집중 테스트는 108 pass였다. 기존 테스트의 기본 /beans 전제가 깨진 항목은 없어 해당 fixture를 변경하지 않았다. 그러나 동일 Worker2 브라우저 E2E에서 추출 완료 후 열린 기록 폼의 원두 자동입력이 끝내 비어 있는 실패가 재현되었다 (`integration-browser-red-results.json`, `integration-browser-red.log`).

새 main의 `renderData`는 첫 경로 응답에서도 열린 모달 DOM을 유지하고 주변 목록만 갱신한다. 새 추출 흐름은 응답 전에 빈 기록 모달을 먼저 열므로, 보존된 모달에는 뒤늦게 받은 선택 옵션과 URL 자동입력이 반영되지 않았다. 유효하지 않은 기록 URL의 검증 결과도 기존 빈 모달 뒤에 가려질 수 있었다.

- `pwa/ui/view.mjs`: 기록 모달의 첫 경로 응답에서 선택 옵션·페이지 커서와 변경하지 않은 자동입력만 갱신한다. 기존 모달/form/입력 노드를 교체하지 않고 포커스·별점·컵노트·사용자 선택을 보존한다. 초기값 기준도 갱신하여 자동입력 자체를 실제 초안으로 저장하지 않는다. 검증된 기록 진입 오류는 초기 모달을 닫고 해당 안내를 표시한다.
- `test/pwa-ui.view.test.mjs`: 무편집/편집 중 첫 응답의 자동입력·DOM·포커스·초안·스켈레톤 완료 유지 2개와 유효하지 않은 기록 URL 안내 1개를 추가했다. 모두 구현 전 기능 부재로 실패하는 RED를 확인한 뒤 GREEN으로 전환했다.
- controller와 스켈레톤 자체 로직은 수정하지 않았다. 최신 main의 경로 generation/취소/오류/캐시·열린 모달 보존 및 목록 복원 회귀 테스트를 그대로 유지했다.

## 실제 실행 결과

아래 명령은 저장소 루트, Node 22.17.0에서 실행했다. 로그와 status 파일은 이 문서와 같은 디렉터리에 있다. 로컬 서버가 필요한 전체 테스트·브라우저 실행은 정상 escalation으로 수행했다.

| 명령 | 결과 | 증거 |
| --- | --- | --- |
| 병합 직후 `npm test` | exit 0, 558 pass / 0 fail | `integration-npm-test-before-fix.log` |
| 병합 직후 UI/controller 집중 검사 | exit 0, 108 pass / 0 fail | `integration-focused-red.log`, `integration-focused-red-status.txt` (수정 전 baseline 이름) |
| `node --test --test-name-pattern='integration:' test/pwa-ui.view.test.mjs` (구현 전) | exit 1, 0 pass / 3 fail | `integration-regression-red.log`, `integration-regression-red-status.txt` |
| `node --test test/pwa-ui.view.test.mjs test/pwa-screen-loading.test.mjs` (최종) | exit 0, 111 pass / 0 fail | `integration-focused-green.log`, `integration-focused-green-status.txt` |
| `npm test` (최종) | exit 0, **561 pass / 0 fail / 0 cancelled** | `integration-npm-test.log`, `integration-npm-test-status.txt` |
| `npm run build:pages` | exit 0, build **3a88d931f566** | `integration-build-pages.log`, `integration-build-pages-status.txt` |
| `npm run check:pages` | exit 0 | `integration-check-pages.log`, `integration-check-pages-status.txt` |
| `node docs/evidence/home-brew-flow-20261027/integration-browser.cjs` | exit 0, **9 checks pass**, page/console errors 0, 외부 요청 0 | `integration-browser.log`, `integration-browser-status.txt`, `integration-browser-results.json` |
| `git diff --check` / staged whitespace check | exit 0 | 커밋 전 직접 확인 |

`integration-browser.cjs`는 기존 `worker2-browser.cjs`에서 증거 파일명의 접두사만 `integration-`으로 바꾼 동일 검증이다. 실제 adapter/repository/commands/submission state와 fake Notion, 별도 headless Chrome context, service worker 차단 및 localhost 외 요청 차단을 사용했다.

통과 범위: 실제 독립 공용 레시피 생성 → 홈 → 원두 → 공용 레시피 → 가이드 → 완료 → 원두·레시피·오늘 날짜 자동입력 → 별점·컵노트 저장. 저장된 관계·날짜·컵노트, 무편집 기록 목록 방문, 브라우저 뒤로가기의 선택 유지, run 새로고침, 같은 초안 복원, 다른 날짜 흐름 충돌의 이어쓰기/명시적 새 기록, recipe-only URL 안내도 확인했다. 가이드는 320/390/768/1280px에서 가로 넘침이 없으며 `integration-guide-*.png`에 보존했다.

## 실패 시도와 미검증·인계

- 병합 후 브라우저 RED는 위 실제 모달/자동입력 호환성 문제이며, 타이밍 대기를 늘려 숨기지 않고 제품 수정과 테스트로 해결했다.
- 추가 RED 테스트의 첫 assertion은 DOM 객체를 직접 비교하여 과도한 실패 출력을 유발했다. 객체 전체를 출력하지 않는 boolean assertion으로 보정한 뒤 의도한 3개 기능 실패를 재확인했다. 제품 실패와 테스트 출력 문제를 구분한다. 증거 로그의 의미 없는 줄 끝 공백만 정리했다.
- live Notion, Safari/iPhone 설치형 PWA, 공개 배포, service worker 업데이트, 브라우저 검색 페이지네이션 및 새 흐름과 연결 변경/unknown을 결합한 E2E는 미실행이다. 기존 검색·연결·lock/unknown 회귀는 전체 테스트에서 통과했으며 이를 브라우저 E2E 통과로 확대하지 않는다.
- 새 main의 스켈레톤 전용 브라우저 하네스는 별도로 재실행하지 않았다. 기존 스켈레톤 UI/controller 테스트를 변경 없이 실행했고, 새 모달 보존 회귀 테스트와 기존 Worker2 실제 브라우저 E2E로 겹치는 동작을 검증했다.
- 변경된 view의 독립 Critic 통합 재검토, 후속 merge·push·배포는 Orchestrator 담당이다. 이번 Worker는 검증 및 이 최소 수정·증거 커밋까지만 수행했다.
