# Critic re-review — 38a2c02

- 대상 exact commit: `38a2c0291853fee5bcd5f356039b794641d5dd3c` (`codex/home-brew-flow`). 수정 비교: `00a96fb..38a2c02`; 전체 기능 base: `d2ad677`.
- 검토일: 2026-10-27 KST. 역할 critic. 코드 수정·서브에이전트·commit·merge·push·deploy 없음.
- **Verdict: Approve — 위 exact commit에 한정. 기존 필수 finding 3개 모두 해결. 이번 재검토 범위에서 새 필수 finding 없음.**
- 최신 main/origin/main `3d68e2c` 및 그 안의 `a63b2c4` skeleton 변경은 이 대상에 아직 통합되지 않았다. 본 승인을 통합 결과의 승인으로 해석하면 안 된다. Worker2가 통합하고 최종 필수 검증을 수행한 후, 겹치는 controller/view 변경의 독립 재검토가 필요하다.

## 검토 방법 및 해결 확인

기존 판정을 전제로 삼지 않고 수정된 controller/view, 신규·변경 테스트, Worker2 browser 하네스와 JSON, RED/GREEN 및 전체/build/check 증거를 직접 읽었다. 기존 `code-review-and-quality` 및 AGENTS 지침을 적용했다. 원문 `critic-review.md`는 그대로 유지했다.

1. **공용 레시피 / 해결.** controller의 목록·run·record-prefill에서 legacy recipe.beanId로 선택을 제한하던 조건이 제거되었다. 원두 존재와 레시피/단계 검증은 유지한다. recipe-only URL은 명시적 원두 선택을 요구한다. 실제 commands로 생성한 독립 레시피가 선택·추출 안내·자동입력·기록 저장까지 동작함을 브라우저에서 재확인했다. 신규 controller 테스트는 beanId null, 다른 legacy 관계 허용, 누락된 원두 및 빈 단계 거부를 검사한다.
2. **빈 draft / 실제 draft 충돌 / 해결.** 기록 폼 초기값과 실제 편집값을 비교해 무편집 폼을 draft로 만들지 않는다. flow key로 선택 원두·레시피·날짜를 구분하고 다른 흐름의 실제 초안은 이어쓰기/명시적 폐기 선택으로 보호한다. 옵션 비동기 재로딩 중에는 draft의 select ID에 해당하는 option을 보존하며 저장 시 canonical commands의 원본 검증을 거친다. 기존 무편집 기록 목록 방문 재현과 같은 흐름 복원 테스트 통과. 브라우저에서도 자동입력, 초안 복원, 충돌 이어쓰기, 새 기록 선택 및 실제 저장을 확인했다.
3. **첫·후속 페이지 누적 / 해결.** 첫 append 시 currentData를 병합 기준으로 사용하고, 후속 캐시의 query 및 레시피 선택 원두 scope를 구분한다. Set으로 페이지 간·한 페이지 내 중복 ID를 제거한다. 기존 첫 추가 페이지 재현과 초기/후속/검색 누적 및 레시피 누적 테스트가 통과했다. 이 누적 동작은 이번 검토에서 단위 테스트로 확인했으며 실제 브라우저 검색 페이지 E2E를 실행했다고 보고하지 않는다.

## 독립 실행 결과

검토 대상은 `git archive 38a2c02`로 `/private/tmp/home-brew-rereview-38a2c02`에 복사했다. 원본 테스트는 수정하지 않고, 최초 critic이 만든 재현 3개를 복사본 테스트에 추가해 그대로 재실행했다.

| 검증 | 결과 | 증거 |
| --- | --- | --- |
| `node --test --test-name-pattern='critic:|record draft|same brew|home startup' .../test/pwa-ui.view.test.mjs .../test/pwa-screen-loading.test.mjs` | exit 0, 10 pass / 0 fail. 최초 critic 재현 3개 및 Worker2 보강 테스트 포함 | `/private/tmp/home-brew-rereview-38a2c02/critic-focused.log`, 복사본 테스트 말미 |
| 복사본에서 `node docs/evidence/home-brew-flow-20261027/worker2-browser.cjs` | exit 0, 9 checks pass. external/pageerror/consoleError 모두 0 | `critic-browser.log`, 복사본 `docs/evidence/home-brew-flow-20261027/worker2-browser-results.json` |
| Mutation: 복사본 view의 초기 목록 fallback 조건 `!previousPage`를 `previousPage`로 반전; `node --test --test-name-pattern='critic: initial' test/pwa-ui.view.test.mjs` | exit 1, 0 pass / 2 fail. 기존 critic 재현과 새 누적 테스트 모두 회귀 검출 | `critic-mutation.log`, `view.before-mutation.mjs` |
| `git diff --check 00a96fb 38a2c02` | exit 0 | 직접 실행 |

Mutation 뒤 복사본 view를 저장한 원본으로 복원했다. 원본 프로젝트 코드에 mutation을 적용하지 않았다.

브라우저는 번들 Playwright와 설치된 Google Chrome headless, 새 임시 context, serviceWorkers 차단 및 localhost 외 요청 abort를 사용했다. 실제 NotionClient/read-repository/commands/submission-state를 메모리 fake Notion에 연결했다. Mac 잠금 및 사용자 브라우저 프로필에 의존하지 않았다.

브라우저에서 정상 생성 → 홈 → 원두 → 공용 레시피 → 추출 안내 → 완료 → 원두/레시피/기기 오늘 날짜 사전입력 → 별점 5·컵노트 저장을 재확인했다. fake Notion 저장 행의 원두/레시피 관계, 날짜, 컵노트도 assertion을 통과했다. 뒤로가기 선택 유지, run URL 새로고침, 같은 draft 복원, 다른 날짜 흐름 충돌의 이어쓰기/폐기, recipe-only URL 안내도 통과했다. 320/390/768/1280px에서 가이드 가로 넘침 없음. 재생성된 320px 스크린샷을 직접 열어 붓기표·가이드·완료 버튼 배치도 확인했다.

## Worker2 증거 대조

- `worker2-npm-test.log` 및 status: exit 0, 551 pass / 0 fail / 0 cancelled.
- `green-worker2-focused.log`: 101 pass / 0 fail.
- `worker2-build-pages.log`: build `1d2dac46433e`; `worker2-check-pages.log`: 통과.
- RED 로그 및 최종 browser 하네스·JSON은 실제 실패와 보정/제품 수정을 구분해 기록되어 있다. summary의 초기 commit 보고도 정정되었다.
- 동일 대상의 전체 테스트·빌드·Pages 검사는 불필요하게 반복하지 않았다. 위 수치는 Worker2의 실행 증거이고 독립 재실행 수치와 구분한다.

## 5축 평가

| 축 | 평가 |
| --- | --- |
| 정확성·기능/테스트 | 기존 3건 모두 독립 재현이 GREEN. 실제 공용 레시피의 기록 저장까지 성공. 새 테스트가 초기 fixture의 도메인 가정과 비동기 옵션 소실을 보완한다. |
| 가독성·단순성 | recordFlowKey, 초기값 비교와 명시적 conflict 선택으로 기존 문제의 우선순위가 드러난다. 페이지 병합 조건 및 중복 제거도 확인 가능하다. |
| 설계 | 공용 레시피 계약 및 canonical commands의 저장 검증을 유지한다. 수정 범위가 기존 흐름 보호에 한정되며 의존성 추가 없음. |
| 보안 | 변경부의 새 주입·비밀 노출은 발견하지 못했다. conflict 노트와 option label은 텍스트 렌더링한다. 임시 option 보존이 쓰기 검증을 우회하지 않으며 기존 journal/lock/unknown 경로는 유지한다. 전체 보안 감사로 확대하지 않는다. |
| 성능 | 홈의 전체 조회 방지와 제한된 페이지 조회를 유지한다. 중복 제거는 Set으로 처리한다. 이번 수정에서 새 무제한 조회나 성능 차단 사유는 발견하지 못했다. |

## 남은 제한 및 다음 단계

- live Notion, 실제 Safari/iPhone 설치형 PWA, 모든 직접 URL/검색 페이지 조합의 브라우저 E2E, 새 흐름과 연결 변경/unknown 복구의 결합 E2E는 미검증이다. 기존 전체 회귀 통과를 그 범위의 E2E 통과로 확대하지 않는다.
- **최신 main 통합 후 재검토가 남아 있다.** 특히 skeleton 전환 중 record draft/자동입력과 route read, 안내 화면/옵션 선택이 서로 영향을 주는지 확인해야 한다. 현재 Approve는 통합 전 `38a2c0291853fee5bcd5f356039b794641d5dd3c`에만 적용한다.
- 시작 시 이미 있던 untracked 원문 리뷰 및 RED status 2개는 수정하지 않았다. 이번 워크트리 쓰기는 `critic-rereview.md`만 수행한다. 통합·게시 작업은 Orchestrator 담당이며 본 critic은 보고 후 대기한다.
