# Critic integration review — 21e84dc

- Exact commit: **`21e84dc5ecf7b0acf8256e46873ead3d68aeb28c`** (`codex/home-brew-flow`).
- 검토일: 2026-10-27 KST. 비교 범위 `38a2c02..21e84dc`, 최소 fix `2e8ec44..21e84dc`.
- `3d68e2c`가 대상 HEAD의 조상임을 `git merge-base --is-ancestor 3d68e2c HEAD` exit 0으로 확인했다. 최신 main의 `a63b2c4` skeleton 변경을 포함한 통합 결과를 검토했다.
- **Verdict: Approve. 기존 3개 필수 finding 해결이 유지되며, 통합 후 새 필수 finding 없음.**
- 역할 critic. 원본 source/test 수정, 서브에이전트, commit, merge, push, deploy 없음. 이번 원본 워크트리 쓰기는 이 리뷰 문서만 수행한다.

## 소스 및 증거 검토

`integration-summary.md`를 먼저 읽고, controller/view 통합 diff와 21e84dc 최소 fix, 새 회귀 테스트 3개, 기존 공용 레시피·draft·누적 테스트, 실제 브라우저 하네스와 JSON, RED/최종 검증 로그를 직접 대조했다. 기존 승인을 통합 승인으로 대신하지 않았다. 기존 AGENTS 및 `code-review-and-quality` 지침을 적용했다.

- **모달·사전입력 호환성 해결:** `pwa/ui/view.mjs:627`에서 현재 경로의 검증 오류를 받은 기록 모달을 닫고 오류 안내를 표시한다. `:638`의 hydrate 호출과 `:1448`의 `hydrateRecordPickers`는 모달/form/select/input 노드를 유지하면서 선택 옵션과 페이지 cursor를 갱신한다. 초기값을 유지한 필드만 새 자동입력을 받고, 사용자 선택 및 별점·컵노트·날짜는 보존한다. 초기 ID 기준도 갱신해 자동입력만으로 의미 있는 draft를 만들지 않는다.
- **skeleton 수명:** main에서 도입한 controller의 generation/abort 및 loading/ready/error/cancelled 경로를 유지한다. 경로 첫 응답 후 주변 목록을 갱신해도 열린 모달을 떼어내지 않는다. UI/controller 집중 테스트가 읽기 실패·취소·이전 응답·현재 경로 복귀·페이지 추가와 모달 보존을 함께 검사한다.
- **기존 finding 1 유지:** 공용 레시피에 legacy beanId 관계를 강요하지 않고 원두와 레시피/단계는 각각 검증한다. 실제 생성한 공용 레시피의 선택 → 안내 → 자동입력 → 기록 저장이 통과했다.
- **기존 finding 2 유지:** 기록 목록 무편집 방문이 빈 draft로 자동입력을 덮지 않는다. 실제 draft의 동일 흐름 복원과 다른 흐름 이어쓰기/명시적 폐기, 비동기 option ID 보존 테스트 및 브라우저 검사가 통과했다.
- **기존 finding 3 유지:** 초기 currentData 기반 append, 후속/검색 페이지 누적, query/scope 구분과 중복 제거 코드는 유지된다. 해당 기존 테스트가 독립 집중 실행에 포함되어 통과했다. 검색 페이지네이션 브라우저 E2E는 이번에도 실행하지 않았다.

## 독립 검증

검토 HEAD를 `git archive 21e84dc`로 `/private/tmp/home-brew-integration-21e84dc`에 복사했다. 브라우저 출력과 mutation은 복사본에서만 수행했다.

| 검증 | 결과 | 증거 |
| --- | --- | --- |
| 원본 대상 `node --test test/pwa-ui.view.test.mjs test/pwa-screen-loading.test.mjs` | **exit 0, 111 pass / 0 fail / 0 cancelled** | `/private/tmp/home-brew-integration-21e84dc/critic-focused.log` |
| 복사본 `node docs/evidence/home-brew-flow-20261027/integration-browser.cjs` | **exit 0, 9 checks pass**, pageerror/consoleError/external 모두 0 | `critic-browser.log`, 복사본 evidence의 `integration-browser-results.json` |
| 기록 첫 응답을 500ms 지연한 추가 headless 검증 `node critic-delayed-browser.cjs` | **exit 0, 10 checks pass**, errors/external 0. 응답 전 입력과 native form 동일성·포커스 보존을 추가 확인한 뒤 전체 저장 흐름도 통과 | `critic-delayed-browser.cjs`, `critic-delayed-browser.log`, 복사본 evidence의 `critic-delayed-browser-results.json` |
| Mutation: 복사본 hydrate 선택 판정 `select.value === initial[name]`를 `!==`로 반전하고 `node --test --test-name-pattern='integration:' test/pwa-ui.view.test.mjs` | **exit 1, 1 pass / 2 fail**. 무편집/편집 첫 응답 회귀 모두 검출, 오류 안내 테스트는 통과 | `critic-mutation.log`, `view.before-mutation.mjs` |
| `git diff --check 38a2c02 HEAD` | exit 0 | 직접 실행 |

Mutation 후 복사본 view를 복원했고 `cmp`로 원본 프로젝트 view와 동일함을 확인했다. 프로젝트 source에는 mutation을 적용하지 않았다.

브라우저는 번들 Playwright + 설치 Google Chrome headless, 새 context, service worker 차단, localhost 외 요청 abort를 사용했다. 실제 NotionClient/repository/commands/submission state와 메모리 fake Notion을 연결하며 실제 Notion 및 사용자 프로필에는 접근하지 않았다.

E2E는 정상 공용 레시피 생성, 홈·원두·레시피 선택, 추출 안내, 완료, 원두·레시피·기기 오늘 날짜 자동입력, 별점 5/컵노트 저장 및 fake 원본 행의 관계·날짜·노트를 검증한다. 뒤로가기 선택 유지, run URL 새로고침, 같은 draft 복원, 다른 날짜 흐름의 이어쓰기/새 기록 선택, recipe-only URL 안내도 통과했다. 320/390/768/1280px에서 가이드 가로 넘침 없음도 재확인했다.

추가 지연 하네스는 원본 소스가 아니라 임시 브라우저 fixture의 repository listRecords에 500ms 지연을 넣었다. 기록 모달 표시 직후 컵노트를 입력·focus하고, ID hydration이 완료된 뒤 같은 native form과 활성 입력 노드인지, 내용이 유지됐는지 assertion했다. 이후 입력을 지워 원래 E2E를 이어서 저장까지 확인했다.

## Worker2 최종 증거 대조

- 구현 전 통합 회귀 RED: `integration-regression-red.log` 및 status exit 1, 0 pass / 3 fail. 초기 자동입력 누락과 검증 오류 은폐를 테스트로 고정했다.
- `integration-npm-test.log` 및 status: **exit 0, 561 pass / 0 fail / 0 cancelled**.
- `integration-focused-green.log`: 111 pass / 0 fail.
- `integration-build-pages.log`: build **`3a88d931f566`**; `integration-check-pages.log`: 통과.
- 전체 테스트·build/check는 같은 대상을 불필요하게 반복하지 않고 Worker2의 원문 로그와 status를 대조했다. 독립 실행 수치와 구분한다.

## 5축 평가와 제한

| 축 | 결론 |
| --- | --- |
| 정확성·기능/테스트 | 최초 응답 hydration, 오류 노출 및 기존 3건 보호가 통과했다. 실제 지연 응답의 native DOM/포커스와 기록 저장까지 확인했다. |
| 가독성·단순성 | hydration을 작은 helper에 한정해 모달 보존 분기의 목적과 선택값 우선순위가 명시되어 있다. |
| 설계 | skeleton의 읽기 수명과 기존 쓰기 상태를 분리하고 기존 모달의 상태 및 canonical commands 검증을 유지한다. |
| 보안 | 변경부에서 새 주입·비밀 노출 또는 쓰기 검증 우회를 발견하지 못했다. placeholder option 보존은 commands의 최신 원본 검증을 대신하지 않는다. 전체 보안 감사는 아니다. |
| 성능 | 페이지 읽기·홈 조회 범위와 경로 취소 정책을 유지한다. 첫 경로 응답에서만 열린 모달 주변 목록과 제한된 선택 옵션을 갱신하며 새 무제한 조회는 없다. |

live Notion, Safari/iPhone 설치형 PWA, service worker 업데이트, 공개 배포 및 새 흐름과 연결 변경/unknown을 결합한 브라우저 E2E는 미검증이다. 기존 전체 회귀 통과를 이 범위의 E2E 통과로 확대하지 않는다. skeleton 전용 과거 브라우저 하네스는 별도로 반복하지 않았으며 통합 UI/controller 111개와 실제/지연 E2E로 겹치는 동작을 검증했다.

이 승인은 exact HEAD `21e84dc5ecf7b0acf8256e46873ead3d68aeb28c`의 통합 코드에 적용한다. 이후 코드가 변경되면 영향받는 검증과 재검토가 필요하다. Orchestrator가 main fast-forward·push·Pages `probes=false` 게시 및 공개 반영 확인을 수행한다. 본 critic은 이를 실행하거나 배포 완료를 보고하지 않는다.
