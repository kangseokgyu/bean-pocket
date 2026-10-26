# 봉지 기능 제외 — 검증 증거

- 작업 브랜치: `codex/remove-bags`
- 기준 commit: `209e4e912f83469bbed145c4b4832952299476fd`
- snapshot marker: `snapshot.recordGeneration = "bagless-v1"`; snapshot v2의 기존 본문 구조는 유지한다.
- 검증 데이터는 합성 fixture만 사용했다. 실제 Notion DB/API 데이터는 읽거나 변경하지 않았다.

## RED/GREEN 기록

| Slice | RED | GREEN | 범위·비고 |
|---|---|---|---|
| snapshot 세대 marker | `node --test test/domain.test.mjs`, exit 1, 7개 중 6 pass/1 fail: marker가 없음. marker만 넣은 재실행도 exit 1, 7개 중 6 pass/1 fail: 과거 기록이 평가에 포함됨. | `node --test test/domain.test.mjs test/pwa-domain.test.mjs`, exit 0, 12/12. | marker와 별점 집계 경계. 두 RED 로그는 초기 세션 출력에 기록했으며 별도 원문 파일은 보관하지 않았다. |
| PWA 화면 숨김 | 구세대 기록과 봉지 화면 기대를 제거하기 전 단일 테스트가 실패했다. 순환 fake DOM 객체를 `assert.equal(node, null)`로 출력하는 첫 시도는 Node 메모리 소진으로 단언 결과를 얻지 못했다. | 순환 객체 대신 DOM 존재 여부 boolean을 단언해 의도된 RED(`true !== false`)를 확보했고, 필터 구현 후 단일 테스트 GREEN. `node --test --test-name-pattern='legacy extraction records remain in raw input' test/pwa-ui.view.test.mjs`, exit 0, 1/1. | OOM은 순환 객체 deep-diff 출력에서 발생했다. boolean 단언으로 고친 후 같은 UI 동작을 검증했다. |
| 명령·Notion client 쓰기 차단 | `node --test --test-name-pattern='bag operations are unavailable|bag source stays readable' test/pwa-commands.test.mjs test/pwa-notion-client.test.mjs`, exit 1, 대상 2개 실패: 봉지 명령과 원격 봉지 쓰기가 가능함. | `node --test test/pwa-commands.test.mjs`, exit 0, 28/28. 전체 client/기타 회귀는 최종 `npm test`에 포함해 통과. | 구버전 `bagId`는 journal이나 Notion 요청 전에 거부하고, 기존 source 읽기는 유지한다. |
| 기존 server 경계 | `node --test --test-name-pattern='공개 HTTP 흐름|기록의 bagId 제거|legacy bagId=null|429와 저장 전 조회 실패|legacy server repository blocks' test/http.test.mjs test/notion.test.mjs test/pwa-notion-client.test.mjs`, exit 1, 5개 대상 중 4개 통과/1개 실패. 이전 봉지 route·payload가 허용되는 실패를 확인. | 구현 후 `node --test --test-name-pattern='공개 HTTP 흐름|기록의 bagId 제거|legacy bagId=null|429와 저장 전 조회 실패|legacy server repository blocks|bagless generation' test/http.test.mjs test/notion.test.mjs test/pwa-notion-client.test.mjs`, exit 0, 7/7. | `/api/bags`는 410, 레코드 `bagId`는 저장 전에 거부. 기존 server의 기타 처리와 5개 source 호환은 유지한다. |
| legacy 미완료 journal | 마지막 회귀 테스트는 기존 구현의 복구 동작을 보존하는 추가 검증이며 사전 제품 RED는 만들지 않았다. | `node --test --test-name-pattern='legacy bag journals' test/pwa-ui.integration.test.mjs`, exit 0, 1/1. | `bags`의 `processing`은 `unknown`으로 바뀌어 복구 대상으로 유지되고, `delete-bag`의 `unknown`도 유지된다. 시작 후 페이지 생성/수정 요청이 없고 새 제출은 unresolved lock에 막힌다. |

## 최종 필수 검증

| 명령 | 종료 코드 | 결과 | 원문 로그 |
|---|---:|---|---|
| `npm test` | 0 | 495 tests, 495 pass, 0 fail | [`npm-test.txt`](npm-test.txt) |
| `npm run build:pages` | 0 | Pages 산출물 생성 완료, build ID `47967a532411` | [`build-pages.txt`](build-pages.txt) |
| `npm run check:pages` | 0 | Pages 산출물 검사 통과 | [`check-pages.txt`](check-pages.txt) |
| `git diff --check` | 0 | whitespace 오류 없음 | 실행 결과만 기록; 별도 로그 없음 |

`npm test`는 기존 과거 원두 관계 미해결 테스트에서 1건 실패했다. 원시 기록의 관계 판독·평점 보존 단언은 유지하고, marker 없는 기록이 집계에는 포함되지 않는 새 정책에 맞춰 집계 기대를 0으로 조정했다. 실패 원문은 [`npm-test-before-legacy-expectation-fix.txt`](npm-test-before-legacy-expectation-fix.txt)에 남겼고, 수정 후 전체 495개가 통과했다.

## 보존·제약 확인

- 기존 5개 Notion source 설정과 구형 데이터 decoder는 유지한다. 원시 기존 봉지·기록은 repository에 남고, 화면/평점만 현재 marker로 거른다.
- 원두·레시피 삭제 보호 테스트는 과거 봉지 및 숨겨진/미완료 기록을 입력으로 유지하고 fail-closed 동작을 검증한다.
- unknown/partial journal 및 lock 처리 코드는 유지했다. 이 변경은 봉지 쓰기 경로만 제거하고 구형 미완료 작업을 재전송하지 않는다.
- 실제 브라우저 인터랙션은 수행하지 않았다. 사용자 지시대로 Critic의 순차 검토에서 필요하면 확인한다. 실제 Notion, iPhone/Safari, OPFS 재시작, Pages 공개 반영·공개 version은 미검증이며 worker 범위가 아니다.
- GitHub Pages build ID는 로컬 산출물 결과다. 공개 Pages 반영을 의미하지 않는다. merge·push·배포는 메인이 수행한다.

## 최신 main 통합 검증

- 레시피 카드 상세 열기 변경 `af828a0`을 보존하여 `923a08a`에서 통합했다. 테스트 파일 끝 추가 충돌은 양쪽 테스트를 모두 보존했다.
- `npm test`: exit 0, 497/497 pass, fail/skip 0 ([원문](integrated-test.txt)).
- `npm run build:pages`: exit 0, build `da92f2364938` ([원문](integrated-build.txt)).
- `npm run check:pages`: exit 0 ([원문](integrated-check.txt)).
- 후속 `f02437b`는 README/GLOSSARY 문서만 바뀌었고 제품·빌드 입력은 같다. Critic 재검토에서 P3 종결 및 APPROVE. [독립 검토](critic-report.md).
- Worker는 생성 도구에서 `gpt-6-luna/max` (Gauss), Critic은 `gpt-6.1-sol/medium` (Carver)로 지정했다. 모델 429나 대체 실행은 없었다.
