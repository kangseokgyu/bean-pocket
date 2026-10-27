# Critic review — 00a96fb

- 검토일: 2026-10-27 KST
- 역할: critic. 코드 수정·서브에이전트·commit·merge·push·deploy 없음.
- 대상: `codex/home-brew-flow`, `00a96fb`, base `d2ad677`. 시작 시 원본 작업 트리 clean.
- 지침: 제공된 전역/프로젝트 AGENTS 및 로컬 `code-review-and-quality` 적용. 브라우저 검증에는 `browser-testing-with-devtools`의 격리 원칙과 사용자가 요청한 Playwright 대체 경로 적용.
- **Verdict: Request changes**. 아래 세 항목은 필수 수정이다.

## Findings

### 1. [P1 / Critical] 공용 레시피를 원두 소속으로 취급해 정상 추출 흐름을 막는다

- 위치: `pwa/ui/controller.mjs:226`, `:244`, `:292`–`:294`; `pwa/ui/view.mjs:921`, `:978`.
- 재현: 실제 commands와 repository를 fake Notion fetch에 연결하고 원두 하나와 레시피 하나를 정상 생성한다. 홈 → 추출 시작 → 원두 선택으로 진행하면 레시피 선택 버튼은 0개이고 “이 원두에 연결된 레시피가 없습니다”가 표시된다. 생성한 두 ID로 `/brew/run?beanId=...&recipeId=...`에 진입해도 recipe-unavailable이다. `/records/new`도 동일한 관계 비교 때문에 정상 조합을 거부하는 분기가 있다.
- 원인: 기존 계약은 원두 독립적인 공용 레시피다 (`docs/pwa-usage.md:10`, `docs/notion-database-setup.md:10`, `test/domain.test.mjs:7`). 실제 생성 레시피의 beanId는 null이므로 새 필터와 관계 비교를 통과할 수 없다. legacy 원두 관계를 가진 레시피도 다른 원두에 재사용할 수 있어야 한다. 레시피 등록 UI에 원두 연결 필드도 없어 신규 등록 안내로 해결할 수 없다.
- 증거: headless Chrome 390/1280px에서 실제 어댑터·저장소·명령·journal 및 fake Notion으로 재현. `/private/tmp/home-brew-critic-00a96fb/browser-results.json`, `shared-recipe-mobile.png`, `shared-recipe-desktop.png`. 외부 네트워크 요청 0, 최종 브라우저 pageerror 0. 임시 추가 테스트 `critic: shared recipe is selectable after choosing a bean`도 실패한다.
- 최소 수정: 원두 존재 및 레시피/단계 유효성은 각각 검증하되 recipe.beanId로 목록을 제한하거나 선택 조합을 거부하지 않는다. recipe-only URL에서 legacy beanId를 필수 원두로 추론하지 말고 명시적인 원두 선택을 요구한다. 실제 생성한 공용 레시피로 선택 → 안내 → 기록 폼 → 별점/컵노트 저장까지 통합 회귀 테스트를 추가한다. Worker 계획의 “원두와 레시피 관계 검증”도 기존 공용 레시피 계약에 맞춰 수정해야 한다.

### 2. [P1 / Required] 기록 화면을 방문한 뒤 추출을 완료하면 자동입력이 빈 draft로 덮인다

- 위치: `pwa/ui/view.mjs:1354`–`:1365` (새 URL 자동입력), `:1131` (이후 무조건 draft 복원), `:1930`–`:1951` (숨은 폼도 draft로 저장).
- 재현: 원두·레시피 옵션이 로드된 상태에서 `/records`를 방문하고 아무것도 입력하지 않은 채 홈으로 돌아간다. 이후 `/records/new?beanId=B&recipeId=R`로 완료 화면에 진입하면 원두 필드는 B 대신 빈 문자열이다. 임시 추가 테스트 `critic: visiting record list must not overwrite later brew prefill`에서 expected B, actual ''로 실패했다. 이 재현은 1번 문제와 분리하기 위해 유효한 선택 옵션을 제공한다.
- 영향: 이전 기록 화면에서 생성된 숨은 폼의 빈 값이 새 추출 선택을 무효화한다. 기존 실제 draft가 있으면 과거 원두·레시피·날짜/평가와 새 추출이 섞일 가능성도 있다. 새 폼만 여는 현재 테스트로는 잡히지 않는다.
- 최소 수정: 사용자가 편집하지 않은 숨은 폼을 의미 있는 draft로 저장하지 않고, 새 추출의 선택 쌍과 draft 소유 흐름을 구분한다. 같은 흐름으로 돌아오면 기존 draft를 유지하되, 다른 새 추출과 충돌하는 실제 draft는 명시적인 이어쓰기/새 기록 선택으로 보호한다. 단순히 모든 draft를 지우거나 모든 재렌더 때 URL로 덮어쓰면 기존 보호 요구를 깨뜨린다. 무편집 목록 방문, 실제 미저장 draft, 다른 추출 완료, 같은 흐름 뒤로가기를 회귀 검증한다.

### 3. [P2 / Required] 첫 ‘더 불러오기’가 초기 목록을 대체한다

- 위치: `pwa/ui/view.mjs:607`–`:615`.
- 재현: `/brew/bean`의 최초 repository 목록 한 항목과 nextCursor를 렌더한다. 다음 페이지 한 항목을 `setSearchOptions('brew','beans', nextPage, true, '')`로 전달하면 선택 카드가 두 개가 아니라 한 개만 남는다. 임시 추가 테스트 `critic: initial brew page survives first load-more response`에서 expected 2, actual 1로 실패했다. 실제 화면에서는 첫 20개 뒤의 “더 불러오기”를 누르면 앞의 원두들이 사라진다.
- 원인: 최초 화면은 currentData에만 있고 optionPages에는 없다. append 병합은 previousPage가 있는 경우에만 수행하므로 최초 추가 응답이 기존 목록을 교체한다. recipes도 같은 분기를 사용한다.
- 최소 수정: brew의 최초 route page와 검색 page를 동일한 목록 상태로 관리하거나, 동일 route/query의 append일 때 currentData의 초기 항목을 기준으로 병합한다. 쿼리/원두 변경의 다른 결과와는 섞지 않는다. 첫 추가 페이지, 두 번째 추가 페이지, 검색 후 추가, 중복 ID 제거를 검증한다.

## 5축 평가

| 축 | 평가 |
| --- | --- |
| 정확성/기능·테스트 | 위 세 재현으로 승인 불가. 홈/메뉴/추출 조건/붓기표/가이드 코드는 존재하지만 실제 생성 레시피로 핵심 경로가 막힌다. 새 flow 테스트가 legacy beanId fixture와 분리된 stub에 의존한다. |
| 가독성·단순성 | 라우트 및 화면 helper 추출은 읽기 쉽다. 선택/검색/초기 화면 상태가 currentData와 optionPages로 나뉘어 3번 불일치가 생긴다. 새 흐름의 draft 우선순위도 명시해야 한다. |
| 설계 | 기존 공용 레시피 모델과 새 원두 소속 모델의 충돌이 핵심이다. journal/commands를 재사용한 점은 적절하며 새 의존성은 없다. |
| 보안 | 변경부에서 새 주입 취약점이나 비밀 노출은 발견하지 못했다. 외부 문자열은 textContent 기반으로 표시하고 URL 값은 encodeURIComponent 처리한다. 기존 쓰기 lock/journal/unknown 보호 경로를 재사용한다. 제한된 검토이며 전체 보안 감사는 아니다. |
| 성능 | 홈은 엔티티 전체 읽기를 하지 않으며 페이지 크기와 route generation/abort를 유지한다. 새 무제한 조회는 발견하지 못했다. 검색 카드의 전체 재생성은 포커스 유지 관점에서 후속 브라우저 검증이 필요하다. |

## 검증 및 증거

원본 코드에는 손대지 않고 `git archive 00a96fb`로 `/private/tmp/home-brew-critic-00a96fb`에 복사했다. 추가 재현 테스트와 mutation은 복사본에서만 수행했다.

- 독립 집중 검증: `node --test test/pwa-ui.view.test.mjs test/pwa-screen-loading.test.mjs test/pwa-read-repository.test.mjs` → exit 0, 156 pass / 0 fail. `/private/tmp/home-brew-critic-00a96fb/focused.log`.
- 보호 회귀: `node --test --test-name-pattern='unknown|draft|replacement|unresolved|duplicate' test/pwa-ui.integration.test.mjs test/pwa-connection.test.mjs test/pwa-lifecycle-recovery.test.mjs` → exit 0, 8 pass / 0 fail. `protections.log`.
- 추가 재현: 복사본 `test/pwa-ui.view.test.mjs` 말미의 critic 테스트 3개. `node --test --test-name-pattern='critic:' test/pwa-ui.view.test.mjs` → exit 1, 0 pass / 3 fail (의도한 기능 실패). `critic-repro.log`.
- Mutation: 복사본 controller의 run 관계 조건 `!==`를 `===`로 한 번 반전하고 `node --test test/pwa-screen-loading.test.mjs` 실행 → exit 1, 3 pass / 1 fail. 신규 route 테스트가 mutation을 검출했다. 복사본 controller는 저장한 원본으로 복원했다. `mutation.log`, `controller.before-mutation.mjs`. 이 결과는 기존 테스트가 잘못된 도메인 가정 자체를 검출한다는 뜻은 아니다.
- Headless 브라우저: 번들 Playwright + 설치 Google Chrome, 임시 context, serviceWorkers block, localhost 외 요청 abort. 실제 adapter/repository/commands/state + fakePwaNotion 사용. Mac 잠금과 무관하게 실행 성공. 390×844 및 1280×900에서 1번의 목록 누락을 확인하고 직접 run 및 기록 prefill URL 거부도 확인. `browser.cjs`, `browser-results.json`, 스크린샷은 모두 위 임시 디렉터리. 실제 Notion/사용자 프로필 접근 없음.
- Worker 증거 직접 확인: summary, RED/GREEN 로그·status, npm-test 마지막 집계 545 pass / 0 fail, build `cede81a6d1b3`, check 통과. 전체 테스트 및 build/check는 동일 대상에 대해 불필요하게 반복하지 않았다.
- 실패 시도: sandbox localhost listen EPERM은 허용된 escalation으로 해결했다. 최초 브라우저 하네스는 불필요한 command 생성 인자와 연결 revision 재사용 때문에 초기화 실패했고, 실제 어댑터 생성 방식으로 바로잡았다. 최초 추가 테스트 실험은 순환 DOM 객체 assertion 출력에서 OOM이 발생했으므로 boolean assertion으로 교체하고 별도 Node 22 경로로 실제 실패를 재확인했다. 제품 코드 실패로 오인하지 않았다.

## 미검증 및 인계

- 1번 때문에 정상 실제 데이터 기반의 추출 완료 → 자동입력 → 별점/컵노트 저장까지 브라우저 성공을 확인하지 못했다. 2·3번은 독립 추가 단위 재현이며 브라우저에서 성공 경로를 검증한 것으로 보고하지 않는다.
- 직접 URL/새로고침 전체 조합, 검색 페이지 간 누적과 실제 미저장 draft 충돌, browser history 전체, 연결 변경 및 unknown 복구의 새 흐름 결합은 수정 후 다시 확인해야 한다. 기존 보호 회귀 8개 통과를 새 흐름 전체 E2E 통과로 확대하지 않는다.
- 실제 Safari/iPhone PWA 및 live Notion은 실행하지 않았다.
- summary의 “Worker가 커밋하지 않았다”는 문구와 00a96fb의 불일치는 사용자 전달에 따라 Worker 후속 정리 대상으로 인지했다. 기능 finding과 별개다.
- 사용자 main 초안 3개가 `/private/tmp/bean-pocket-home-brew-early-drafts-20261027/`에 보관되었다는 전달만 받았으며 본 검토에서 열거나 변경하지 않았다.
- Worker가 위 3개를 수정하고 관련 테스트·필수 검증 결과를 갱신한 후 재검토가 필요하다. 본 critic은 코드 수정 및 통합 작업을 수행하지 않았다.
