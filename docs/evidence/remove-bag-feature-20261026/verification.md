# 봉지 기능 전체 제거 — worker 검증·인계

- 경로: `/Users/kangseokgyu/.codex/worktrees/remove-bag-feature/AX-1day`
- 브랜치: `codex/remove-bag-feature`. 원본 작업 폴더 수정 없음. 실제 Notion DB·속성·행 수정 없음. merge/push/deploy 없음.
- 역할 worker, 별칭 Kuhn, ID `01a176ea-f6aa-7aa0-be66-492ec0ed688e`. Orchestrator가 생성 도구에 실제 `model: gpt-6.1-sol`, `reasoning_effort: low`를 지정했고 사용자가 승인했음을 전달받음. 추가 에이전트 생성 없음.

## 변경

PWA·Node 서버/public의 연결 설정, 스키마, 모델, 조회를 beans/recipes/steps/records 4개로 통일했다. 봉지 스키마·원두 관계·record.bagId·봉지 기반 원두 추론을 제거했다. 구형 봉지 입력/쓰기에는 요청 전 거절만 남겼다. 기존 파일의 추가 bags 키는 사용하지 않고 읽기만으로 파일을 재작성하지 않는다. 봉지 조회나 마이그레이션은 추가하지 않았다.

`bagless-v1` snapshot 표시·집계 정책은 그대로다. 숨겨진 과거 기록과 평가·snapshot은 원시 기록에 보존한다. 봉지에서만 원두를 알 수 있었던 기록은 needs-confirmation으로 남으며 원두 삭제를 차단한다. 봉지 행만 있는 경우에는 조회·삭제 의존에 사용하지 않고 원격 행을 보존한다. recipe 관계·제외 기록의 fail-closed, unknown/partial journal·lock·복구·중복 차단 테스트를 유지했다. 과거 봉지 journal의 최소 판독은 미완료 상태를 계속 차단하기 위해 남겼으며 전송/봉지 복구 기능은 없다.

문서: .env.example, README, SPEC, PLAN, docs/pwa-contracts.md, docs/notion-database-setup.md, docs/pwa-usage.md, tasks를 정합화했다. 기존 evidence는 수정하지 않았다. tasks/remove-bags.md는 과거 작업 기록으로 표시했다.

## 실제 실행 결과

| 명령 | 종료 코드 | 결과 | 로그 |
|---|---:|---|---|
| `node --test test/remove-bag-feature.test.mjs` (repository RED) | 1 | 11 tests, 7 pass / 4 fail, 봉지 조회·추론 잔여에서 의도한 실패 | red-repository.tap |
| 같은 명령 (repository GREEN) | 0 | 11/11 | green-repository.tap |
| 같은 명령 (domain RED) | 1 | 12 tests, 11 pass / 1 fail, bagId 잔여 | red-domain.tap |
| 같은 명령 (domain GREEN) | 0 | 12/12 | green-domain.tap |
| `node --test test/remove-bag-feature.test.mjs test/pwa-bean-delete.test.mjs test/pwa-entity-delete.test.mjs test/pwa-read-repository.test.mjs test/pwa-notion-client.test.mjs test/pwa-submission-state.test.mjs test/pwa-ui.integration.test.mjs` | 0 | 178/178 | focused.tap |
| `node --test test/pwa-bean-delete.test.mjs` (최종 합성 페이지 보완 후) | 0 | 19/19 | green-hidden-bag-only.tap |
| `npm test` (최종) | 0 | 508/508, skip 0 | npm-test-green.tap |
| `npm run build:pages` | 0 | 버전 b56bc1934364 | build-pages.log |
| `npm run check:pages` | 0 | 산출물 검사 통과 | check-pages.log |
| `git diff --cached --check -- . ":!docs/evidence/**"` | 0 | 소스·문서 공백 오류 없음 | 도구 실행 결과 |

빌드 후 변경은 테스트 합성 응답의 object 필드 및 인계 문서뿐이며 산출물 소스 변경은 없다. 불필요한 동일 빌드 반복은 하지 않았다.

## 실패 원인과 수정

- npm-test-first.tap: 509 tests / 124 fail. 주로 5DB 테스트 연결과 삭제된 봉지 코덱을 호출하는 픽스처. 실제 records/recipe 보호 테스트 삭제 없이 4DB로 갱신.
- npm-test-second.tap: 508 tests / 19 fail. 봉지 모델/검증/삭제 의존 기대값 잔여. queryAll 실패 반복에서 bags 항목 하나만 제외되어 전체 1개 감소. 비봉지 검증은 유지.
- npm-test-third.tap: 508 tests / 11 fail. 합성 스키마의 legacy recipes.bean relation 대상 제거로 fixture 오류가 발생했고 이를 복원. 나머지는 5회 GET 및 record.bagId:null 기대값 잔여 수정.
- npm-test-final.tap: 508 tests / 1 fail. 강화한 숨겨진 봉지 전용 원두 근거 테스트에 object:page 누락. 정상 합성 Notion 페이지 형태로 고친 뒤 19/19와 전체 508/508 확인.
- 테스트 일괄 수정 명령 한 번은 자동 승인 검토가 보호 테스트 약화 가능성으로 거절해 실행되지 않았다. 최신 사용자 지시(봉지 행 미조회·records/recipe 보호 유지)에 근거해 봉지 전용 기대값을 분리 수정했고 fresh-read 실패 보호와 원격 봉지 행 보존 검증을 유지/보강했다. 남은 차단 없음.
- 인계받은 red-core.tap, green-source-config.tap은 이전 worker 증거로 그대로 보존한다.

## Critic·Orchestrator에 남은 사항

- Critic: fake Notion 브라우저 직접 상호작용(연결 입력 4개, 메뉴·목록·상세에 봉지 없음, 생성·기록·삭제 보호·unknown/partial 흐름), 독립 리뷰. worker는 브라우저 직접 검증을 실행하지 않음.
- 실제 iPhone/Safari·실제 OPFS/native lock·실제 Notion 쓰기 검증은 미실행.
- Orchestrator: 검토 후 통합·push·Pages 수동 게시(probes=false), 통합 필수 검증 및 공개 버전·파일 반영 확인. worker 버전은 로컬 산출물 버전이며 공개 게시 버전이 아님.

원시 TAP 실패 출력에는 Node가 만든 공백 전용 diff 줄이 있어 전체 staged diff --check는 이를 지적한다. 증거 원문은 정리하지 않고 보존했으며 소스·문서만 검사하면 exit 0이다. build/check의 .log는 전역 ignore 대상이므로 두 합성 실행 로그만 명시적으로 포함했다.
