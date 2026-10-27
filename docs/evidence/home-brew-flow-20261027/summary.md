# 홈 및 추출 흐름 구현·수정 증거

## 대상과 수정 범위

기능 브랜치 `codex/home-brew-flow`의 기존 구현 commit은 `00a96fb`이다. 이전의 “Worker가 커밋하지 않았다”는 보고는 이 실제 상태와 맞지 않아 정정했다. 후속 worker-2는 서브에이전트를 생성하지 않고 Critic의 필수 지적 3건만 수정했다. `critic-review.md` 원문은 변경하지 않았다. 이번 인계에는 merge·push·배포가 포함되지 않는다.

- 공용 레시피: 원두 관계 필터 및 조합 거부를 제거했다. 원두 존재와 레시피/단계 유효성은 각각 확인한다. legacy `recipe.beanId`는 원두 선택으로 추론하지 않으며 recipe-only URL은 명시적인 원두 선택을 요구한다.
- 초안: 초기 자동입력과 비교해 실제 변경된 기록만 초안으로 보관한다. 다른 원두·레시피·날짜 흐름과 충돌하면 기존 날짜·별점·컵노트를 보여 주고 ‘이전 기록 이어쓰기’와 ‘이전 초안을 버리고 새 기록 작성’을 선택하게 한다. 같은 흐름의 뒤로가기는 초안을 복원한다. 옵션 재로딩 중에는 선택 ID에 대응하는 옵션을 유지해 브라우저 select가 ID를 잃지 않게 한다. 저장 시 기존 commands의 원본 검증을 그대로 거친다.
- 더 불러오기: 최초 currentData 목록도 병합 기준으로 사용한다. 목록/검색 쿼리와 레시피 선택의 원두 범위를 구분하며, 페이지 간 및 단일 응답 내부의 중복 ID를 제거한다.

## RED → GREEN 및 필수 검증

명령은 이 작업 폴더에서 Node 22.17.0으로 실제 실행했다. 로그와 status는 이 문서와 같은 디렉터리다.

| 검증 | 명령 | 종료 코드·결과 | 증거 |
| --- | --- | --- | --- |
| Critic 재현 RED | `node --test --test-name-pattern='critic:|record draft conflicts|same brew record draft' test/pwa-ui.view.test.mjs` | exit 1, 1 pass / 4 fail | `red-worker2.log` |
| 단일 응답 중복 RED | 위 집중 패턴 (테스트 확장 후) | exit 1, 중복 ID 재현. 새 기록 선택의 옵션 없는 fixture 오류도 함께 확인 후 fixture 보정 | `red-worker2-duplicate.log` |
| 옵션 재로딩 RED | `node --test --test-name-pattern='record draft keeps selected IDs' test/pwa-ui.view.test.mjs` | exit 1, 0 pass / 1 fail | `red-worker2-option-reload.log` |
| 최종 집중 GREEN | `node --test test/pwa-ui.view.test.mjs test/pwa-screen-loading.test.mjs` | exit 0, 101 pass / 0 fail | `green-worker2-focused.log`, `green-worker2-focused-status.txt` |
| 최종 전체 | `npm test` | exit 0, 551 pass / 0 fail / 0 cancelled | `worker2-npm-test.log`, `worker2-npm-test-status.txt` |
| Pages 빌드 | `npm run build:pages` | exit 0, **1d2dac46433e** | `worker2-build-pages.log`, `worker2-build-pages-status.txt` |
| Pages 검사 | `npm run check:pages` | exit 0 | `worker2-check-pages.log`, `worker2-check-pages-status.txt` |
| 공백 오류 검사 | `git diff --check` | exit 0 | 커밋 전 직접 확인 |

기존 00a96fb의 545 pass 및 빌드 `cede81a6d1b3` 로그는 당시 결과로 보존했다. 후속 최종 결과는 위 551 pass와 `1d2dac46433e`다. 전체 테스트에는 기존 연결 변경, lock/unknown 복구, 초안·뒤로가기·빈 목록 안내·검색 회귀가 포함된다. 이전 Worker가 작성한 미커밋 재현 테스트를 확인·재사용하고, 초안 선택 클릭과 옵션 재로딩·페이지 내부 중복 검증을 보강했다.

## 브라우저 검증

`node docs/evidence/home-brew-flow-20261027/worker2-browser.cjs`를 headless Google Chrome과 번들 Playwright로 실행했다. 실제 adapter/repository/commands/submission state와 fake Notion을 사용하며 임시 브라우저 context, service worker 차단, localhost 외 요청 차단으로 격리했다. Mac 잠금과 사용자 브라우저 프로필에 의존하지 않는다.

최종 결과는 `worker2-browser-results.json`, `worker2-browser.log`, `worker2-browser-status.txt`에 기록했다. 실제 생성한 독립 공용 레시피로 홈 → 원두 → 레시피 → 추출 안내 → 완료 → 원두/레시피/오늘 날짜 자동입력 → 별점 5·컵노트 저장을 확인했다. 저장된 fake Notion 행의 원두·레시피 관계, 날짜와 컵노트도 assertion으로 확인했다. 기록 목록 무편집 방문, 브라우저 뒤로가기의 선택 유지, run URL 새로고침, 같은 초안 재진입, 다른 날짜 흐름 충돌의 이어쓰기/명시적 새 기록 선택, recipe-only URL의 원두 선택 요구도 확인했다.

320/390/768/1280px에서 가이드의 가로 넘침이 없음을 검사하고 `worker2-guide-*.png`를 저장했다. 390px 이미지를 직접 열어 표·가이드·완료 버튼의 배치를 확인했다. 브라우저 검색 페이지 누적은 E2E로 검증하지 않았으며 위 UI 테스트로 확인했다.

## 실패한 시도와 제한

- 제한된 실행 환경의 localhost listen EPERM으로 브라우저 서버와 첫 전체 테스트의 HTTP 검사 15개가 실패했다. 전체 테스트 로그는 `worker2-npm-test-restricted.log`에 보존했고 정상 escalation 후 전체 검증을 통과했다.
- 첫 브라우저 시도는 비동기 옵션 로딩 전 값을 assertion한 하네스 타이밍 문제였다 (`worker2-browser-first-attempt.json`). 로딩 완료를 기다린 뒤 초안 재진입에서 실제 select ID 소실을 발견했다 (`worker2-browser-save-attempt.json`). 이를 회귀 테스트 RED로 고정하고 수정했다.
- 이후 실제 저장은 성공했지만 하네스가 저장 완료/폼 자동 닫힘 전에 다음 동작을 시도했다. 완료 상태와 닫힘을 기다리도록 보정했다. recipe-only URL도 화면 로딩 완료 후 최종 안내를 확인하도록 했다. 제품 실패와 하네스 타이밍 실패를 구분했다.
- live Notion, 실제 Safari/iPhone 설치형 PWA, 모든 경로 조합의 브라우저 E2E, 새 추출 흐름과 연결 변경/unknown을 결합한 브라우저 E2E는 미검증이다. 기존 전체 회귀 테스트 통과를 이 범위의 E2E 통과로 해석하지 않는다.
- 독립 Critic 재검토와 Orchestrator의 통합·게시가 다음 단계다. 이번 작업에서는 merge·push·배포하지 않았다.
