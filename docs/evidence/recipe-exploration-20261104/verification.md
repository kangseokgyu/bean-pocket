# 추출 조건 탐색 검증 기록

원두별 실제 조건 조정, 전체 조건 스냅샷 보존, 같은 원두의 추출 비교, 사용자 베스트 지정과 공용 레시피 저장을 검증한다. [구현 흐름 HTML](flow.html)은 실제 모듈·함수와 연결되어 있으며 외부 라이브러리 없이 열린다.

## 변경과 통합

새 기록은 v3 스냅샷에 당시 원두 정보·실제 조건·단계와 출처 레시피·기록을 보존한다. 기존 v1/v2 및 현재 기록 세대 판독을 유지한다. 출처 레시피가 삭제된 기록의 재추출, 같은 원두의 임의 두 기록 비교, 목록 범위 밖의 비교·베스트 기록 직접 조회를 지원한다. 사용자 베스트는 최고 별점과 구분하며 records 대상 관계 0/1개를 앱에서 검증한다. 기록 생성, 베스트 지정, 공용 레시피 생성은 독립된 쓰기다.

작업 중 main의 즐겨찾기 구현을 통합했다. 즐겨찾기와 베스트는 각각 해당 속성 하나만 PATCH하며 journal의 `favoriteTarget`과 `updateTarget`을 구분한다. 실제 조건 스냅샷에는 즐겨찾기와 조회 상태를 포함하지 않도록 원두 도메인 필드만 보존한다.

## 실행 결과

| 명령 | 종료 코드 | 결과 | 근거 |
| --- | --- | --- | --- |
| `npm test` | 1 | 통합 전 691개 중 660 통과, 31 실패 | [전체 원문](test-full.log) |
| `node --test test/pwa-favorites.test.mjs test/pwa-ui.integration.test.mjs test/pwa-commands.test.mjs` | 0 | 충돌 해소 후 62개 통과 | [통합 검증](test-merge-focused.log) |
| `node --test --test-name-pattern='favorite and best updates' test/pwa-ui.integration.test.mjs` | 1 → 0 | v3 원두 스냅샷의 즐겨찾기 혼입을 확인한 뒤 수정, 1개 통과 | [실패](test-red-unit15-favorites-best.log), [통과](test-green-unit15-favorites-best.log) |
| `node --test test/pwa-notion-client.test.mjs test/pwa-read-repository.test.mjs test/pwa-ui.view.test.mjs` | 0 | 통합 및 기대 동작 갱신 후 297개 통과 | [원문](test-green-merge-adapters-ui.log) |
| `node --test test/domain.test.mjs test/pwa-independent-recipes.test.mjs test/migrate-best-record-relation.test.mjs` | 0 | 26개 통과 | [원문](test-green-merge-domain.log) |
| `npm run build:pages` | 0 | Pages 산출물 생성, 빌드 `7bec373ab1b9` | [원문](build-pages.log) |
| `npm run check:pages` | 0 | Pages 산출물 검사 통과 | [원문](check-pages.log) |
| `git diff --check` | 0 | 공백·충돌 표식 오류 없음 | [원문](diff-check.log) |

첫 전체 테스트의 HTTP 15건은 제한 환경에서 `listen EPERM 127.0.0.1`로 실패했다. 나머지 실패는 테스트 schema fixture에 새 관계가 빠져 발생한 client 검증 오류, 속성·공개 API 목록의 기존 기대값, 읽기 전용 추출 화면을 가정한 DOM 검증이었다. 새 관계의 선택적 비활성화와 편집 폼의 실제 값·저장을 검증하도록 갱신했다. 후속 통합 adapter/UI 검증에서 297개가 통과했다. 전체 HTTP 검증을 포함한 제한 해제 재실행 결과는 아래 최종 실행 절에 기록한다.

기능 단위의 테스트 선행 실패와 통과 원문은 `test-red-unit*.log`, `test-green-unit*.log`에 남겨 두었다. `test-check-unit*.log`는 테스트 fixture나 assertion 자체를 교정한 중간 기록이며 구현의 의도한 실패로 계산하지 않는다. `test-merge-adapters-ui.log`의 1건 실패는 optional best relation을 필수 관계와 함께 거절하도록 기대한 테스트였다. 별도 테스트에서 잘못된 optional 관계는 베스트만 차단하고 일반 연결·즐겨찾기 지원은 유지함을 확인했다.

## 브라우저 검증

[Playwright 시나리오](verify-recipe-exploration-browser.mjs)는 production renderer/controller를 사용하고 외부 Notion 대신 합성 fixture를 사용한다. 390×900 및 1440×900에서 조건·단계 수정, 소수 별점·컵노트 입력, 저장 후 기본 비교, 저장 조건 재추출, 임의 두 기록 비교, 사용자 베스트 지정과 공용 레시피 생성을 확인한다. 준비 화면·비교 화면·베스트 화면 각각 가로 넘침을 검사하고 화면을 저장한다. 기록 관리 disclosure는 실제 summary 클릭으로 열며 강제 클릭을 사용하지 않는다.

통합 전 소스 실행은 두 화면 모두 성공했고 page error와 실패 HTTP 응답은 0건이었다. [최종 소스 원문](browser-flow-source-final.log)을 보존한다. 제한 환경의 Chrome 시작 실패 이후 권한을 확대한 실행에서 fixture 모듈 경로 404, 접힌 기록 관리 UI 클릭, 아이콘 404를 각각 수정했다. 중간 실패 로그도 삭제하지 않았다. 최종 Pages 산출물 실행은 아래에 기록한다.

## 마이그레이션과 확인 범위

[마이그레이션 스크립트](../../../scripts/migrate-best-record-relation.mjs)는 기본 dry-run과 명시적 `--apply`를 구분한다. 기존 속성 전체 보존, one-way 관계 유형·대상, 재실행 무변경, 응답 유실 뒤 재조회 복구는 합성 API 테스트로 검증했다. Worker는 실제 Notion schema를 변경하지 않았다. Orchestrator가 독립 Critic 검토 후 실제 환경 적용과 readback을 담당한다.

실제 사용자 Notion에서 추출 기록을 생성하거나 사용자 베스트를 지정한 것은 아니다. iPhone Safari·홈 화면 PWA와 실제 저장소 복구는 이번 합성 Chrome 시나리오의 확인 범위에 포함되지 않는다. 게시와 공개 파일 검증은 Orchestrator가 별도로 기록한다.

## 도구와 역할 제한

Worker는 `gpt-6-luna` / `max`로 시작했으나 요청 한도 오류로 중단되어 프로젝트에 허용된 `gpt-6.1-sol` / `medium` 대체 Worker가 이어받았다. 두 설정은 생성 도구에 실제 지정되었다. Worker는 subagent를 만들지 않았다. 독립 검토는 Orchestrator가 이후 Critic에 맡긴다.

`poteto-mode`, 문서 작성의 `technical-writing`·`unslop`, 용어 정리의 `domain-modeling`, 코드 설명의 `code-html-diagram` 지침을 적용했다. Cursor 전용 `control-ui`, `deslop`, `comment-sicko` 호출 도구는 이 세션에 없으므로 설치·실행했다고 주장하지 않는다. UI 확인은 Playwright로 수행하고 독립 검토는 허용된 Critic 절차를 사용한다. 프로젝트 정책에 따라 스킬 원본은 수정하지 않았다.

## 최종 실행

기존 `test/http.test.mjs`에 actual-condition HTTP 시나리오를 추가했다. 변경 조건의 v3 저장·재조회, 삭제된 출처의 provenance와 빈 live relation, 공용 레시피 원본 보존, 기존 요청의 v2 동작, 잘못된 첫 단계·물 합계의 HTTP 400 및 추가 기록 미생성을 검증한다. 제품 소스는 바꾸지 않았다. `node --check test/http.test.mjs`와 `git diff --check`는 종료 코드 0이다. 제한 해제 환경의 `node --test test/http.test.mjs` 결과는 Orchestrator가 추가한다.

통합 후 전체 테스트, Pages 산출물 브라우저 검증, Critic 검토, 실제 마이그레이션·게시 결과는 Orchestrator의 실행 뒤 이 절 또는 별도 게시 기록에 추가한다.

### Orchestrator 최종 확인

- 통합 후 `npm test`가 종료 코드 0으로 714개를 통과했다. [전체 원문](test-full-escalated.log)에 명령과 종료 코드를 보관했다.
- 그 뒤 제품 소스 변경 없이 추가한 HTTP 회귀를 포함해 `node --test test/http.test.mjs` 16개가 통과했다. [HTTP 원문](test-http-actual-final.log)에 실제 조건 보존, 출처 삭제, 기존 요청 호환과 오류 거부 결과가 있다.
- `node docs/evidence/recipe-exploration-20261104/verify-recipe-exploration-browser.mjs --dist`가 종료 코드 0으로 완료됐다. 390px·1440px의 전체 흐름, 준비·비교·베스트 화면 각각 가로 넘침 없음, JavaScript 오류 0건과 HTTP 오류 0건을 확인했다. [산출물 브라우저 원문](browser-flow-dist-final.log)에 결과를 보관했다.
- [민감 값 검사](private-value-scan.json)는 변경 텍스트와 작업 증거 88개에서 실제 토큰·비공개 데이터 소스 ID와 일치하는 값이 없음을 확인했다.
- 대체 Worker의 도구 별칭은 `/root/worker_2`다. 역할은 Worker이며 생성 도구에서 `gpt-6.1-sol` / `medium`을 지정했다. 최초 Worker의 사용 한도 오류 이후 허용된 대체 정책을 적용했다.

독립 Critic 검토와 실제 schema 적용·공개 반영 결과는 후속 게시 기록에 남긴다.

### 실제 Notion schema 적용

Critic이 마이그레이션 도구에서 추가 차단 문제를 발견하지 않은 뒤 Orchestrator가 테스트, 운영 순서로 명시적 `--apply`를 실행했다. 두 환경 모두 종료 코드 0이며 기존 속성 전체 보존과 records 대상 단방향 관계를 재조회로 확인했다. 추출 기록 행은 생성·갱신하지 않았다.

- [테스트 적용 원문](migration-test-apply.log).
- [운영 적용 원문](migration-operating-apply.log).
- [적용 후 무변경 확인](migration-post-apply.log). 두 환경 모두 `already configured; apply=no`로 종료했다.

앱 소스의 Critic C1/C2 수정·재검토와 게시 검증은 별도로 이어진다.


## Critic C1/C2 수정

Critic의 [독립 검토](critic-review.md)에서 C1과 C2를 재현했다. 수정 뒤 최종 전체·배포 산출물 결과는 이전 결과와 구분해 추가한다.

C1은 Node reader가 레시피 ID 문자열을 모든 버전에 요구한 문제였다. v3의 유효한 `source.recipeId: null`은 관계 ID도 null일 때 판독하고, v1/v2 문자열 ID와 출처·관계 ID 일치 검증은 유지한다. production `NotionRepository.all()`을 사용하는 회귀 테스트는 수정 전 `damaged !== valid`로 실패했고, 수정 후 파일 전체 11개가 통과했다. HTTP 테스트에는 출처를 생략한 경우와 명시적 null인 경우 각각 저장 뒤 GET에서 전체 조건·단계를 확인하는 검증을 추가했다.

C2는 명시적 비교 쌍을 직접 읽은 뒤에도 이전 원두 선택을 쓰고, 원두 선택 목록까지 최근 세 개로 자르던 문제였다. 유효한 현재 세대·같은 원두 쌍에서 선택할 원두 ID를 읽기 결과로 반환하고, 요청 세대 확인 뒤 해당 원두를 선택한다. 원두 선택 목록은 불러온 모든 원두를 유지하고 별점 추이만 최근 세 개로 제한한다. 이 선택은 매 렌더마다 강제하지 않으므로 이후 수동 원두 선택과 두 기록 선택이 유지된다. `invalidFields`가 있는 기록, 이전 세대, 누락 기록과 다른 원두 쌍은 선택을 바꾸지 않는다.

production controller와 renderer를 함께 사용하는 테스트는 최신 A/B/C 원두와 오래된 target 두 기록을 제공한다. 기존 선택 B에서 명시적 target 쌍을 열었을 때 수정 전 B가 유지되는 실패를 확인했다. 수정 후 target 선택, 실제 좌우 option의 selected 값, 16g/18g 비교 표, 수동 원두 변경, 좌우 교환 뒤 재렌더 보존, 차트의 기존 Top 3 유지와 잘못된 쌍의 선택 불변을 확인한다. 이 통합 테스트가 사용하는 가벼운 DOM double은 select.value를 자동 계산하지 않으므로 실제 option.selected를 검증한다. `test-green-C2-fourth-bean.log`의 중간 실패는 이 double의 검증 방법을 교정한 기록이며 제품 실패로 계산하지 않는다.

| 명령 | 종료 코드 | 결과 | 근거 |
| --- | --- | --- | --- |
| `node --test --test-name-pattern='Node repository reads v3 null-source' test/notion.test.mjs` | 1 | 의도한 손상 판독 실패 | [C1 RED](test-red-C1-null-source.log) |
| `node --test test/notion.test.mjs` | 0 | 11개 통과 | [C1 GREEN](test-green-C1-null-source.log) |
| `node --test --test-name-pattern='explicit comparison selects an older fourth' test/pwa-ui.view.test.mjs` | 1 | 이전 B 선택 유지 실패 | [C2 RED](test-red-C2-fourth-bean.log) |
| 같은 명령, invalid date 쌍 포함 | 1 | 잘못된 쌍이 target으로 선택을 바꿈 | [추가 RED](test-red-C2-invalid-pair.log) |
| `node --test test/pwa-records-insights.test.mjs test/pwa-ui.view.test.mjs` | 0 | 187개 통과 | [최종 C2 GREEN](test-green-C2-focused-final.log) |
| `npm run build:pages` | 0 | 빌드 `55455017fc96` | [빌드](build-pages-C1-C2.log) |
| `npm run check:pages` | 0 | 산출물 검사 통과 | [검사](check-pages-C1-C2.log) |
| `git diff --check` | 0 | 오류 없음 | [원문](diff-check-C1-C2.log) |

`test-green-C2-focused.log`는 회귀 테스트의 select.value 가정을 교정하기 전 217개 통과·1개 실패를 보존한다. 최종 187개 실행은 수정된 실제 option 선택 및 invalid date 검증을 포함한다. HTTP 테스트와 controller adapter 통합 테스트의 최종 실행은 Orchestrator의 전체 검사 및 아래 후속 기록으로 확인한다.

추가로 `node --test test/pwa-ui.integration.test.mjs`를 실행해 실제 Notion client·repository·commands·journal adapter 통합 31개가 모두 통과했다. 종료 코드는 0이며 [원문](test-green-C2-integration-final.log)을 보존한다. C1/C2 수정 뒤의 전체 테스트·dist 브라우저 실행과 Critic 재검토는 Orchestrator가 이어간다.


## Critic C3 수정

[C3 재검토](critic-rereview.md)는 C1/C2가 해결됐으나 `includeComparisonPair`의 새 `{ items, beanId }` 반환 계약을 인사이트 초기 background 조회와 더보기에서 반영하지 않아 목록 append가 실패함을 확인했다. 이전 전체 실행의 719개 중 718개 통과·1개 실패는 실제 회귀이며 `test-full-post-review.log`에 보존한다.

Worker는 `rg -n includeComparisonPair pwa/ui/controller.mjs`로 호출 세 곳을 확인했다. `fetchScreen`은 이미 새 계약을 사용했고, `loadInitialRecordInsights`와 `loadMoreInsights`를 `comparison.items`로 일괄 변경했다. 배열·객체 양쪽을 받는 호환 분기나 오류 무시는 추가하지 않았다. Fix Root Causes와 Migrate Callers Then Delete Legacy APIs 원칙에 따라 누락된 내부 호출을 같은 반환 계약으로 맞췄다. 유효한 비교 쌍의 원두는 현재 선택이 없을 때 초기화하며, 더보기 이후 사용자의 수동 선택을 덮어쓰지 않는다.

기존 cursor 테스트와 두 신규 filtered-entry 테스트를 구현 전 실행했다. 기존 더보기는 기대한 4건 대신 2건으로 남았고, 필터 뒤 unfiltered background 초기 조회 및 명시적 오래된 원두 비교 초기 조회는 `ready` 대신 `error`로 실패했다. 수정 뒤 세 경로가 모두 통과했고 명시적 비교 이후 수동으로 바꾼 원두도 더보기 뒤 유지했다.

| 명령 | 종료 코드 | 결과 | 근거 |
| --- | --- | --- | --- |
| `node --test test/pwa-ui.records-insights.integration.test.mjs` | 1 | 기존 pagination 및 새 background 조회 2건 실패 | [RED](test-red-C3-pagination.log) |
| 같은 명령, 수정 후 | 0 | 6개 통과 | [GREEN](test-green-C3-pagination.log) |
| `node --test test/notion.test.mjs test/pwa-records-insights.test.mjs test/pwa-ui.view.test.mjs test/pwa-ui.records-insights.integration.test.mjs` | 0 | C1/C2·초기·더보기·선택 보존을 포함해 204개 통과 | [집중 검증](test-green-C3-focused.log) |
| `npm run build:pages` | 0 | 빌드 `7ad80a8bd1ac` | [빌드](build-pages-C3.log) |
| `npm run check:pages` | 0 | 산출물 검사 통과 | [검사](check-pages-C3.log) |
| `git diff --check` | 0 | 오류 없음 | [원문](diff-check-C3.log) |

`node --check pwa/ui/controller.mjs`도 종료 코드 0이다. 제품 소스를 다시 고정했으며 Orchestrator의 전체 테스트·최종 dist 브라우저 실행과 동일 Critic의 독립 재검토가 남아 있다. 이전 성공·실패 증거와 실제 schema 적용 기록은 그대로 보존한다.
