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

## Critic 지적 수정 — 2026-10-26 후속

- 기준 구현 커밋 `53d0769`. Critic `critic-review.md`의 required P2 두 건과 사용자 추가 요청의 optional coverage만 수정했다.
- `public/app.js`: Node/public 연결 안내와 성공 알림을 모두 4개 DB로 정정. 제품 로직 변경 없음.
- `GLOSSARY.md`: domain-modeling 스킬과 GLOSSARY-FORMAT을 적용했다. 폐기된 봉지는 원격 원본만 보존하고 연결·조회·추론·삭제 의존에 사용하지 않는다고 정정했다. 숨겨진 과거 기록 보존과 원두 미확정 기록의 삭제 차단을 설명하며 구현 marker 세부는 SPEC의 기록 세대 계약으로 연결했다.
- `test/pwa-notion-client.test.mjs`: relation 대상 불일치 검증 반복을 Object.keys(RELATIONS)로 복원했다. RELATIONS는 recipes/steps/records이며 bags만 제외된다. legacy recipes.bean 관계가 존재할 때 잘못된 대상 검증도 다시 실행한다.

| 실제 실행 명령 | 종료 코드 | 결과 | 증거 |
|---|---:|---|---|
| `node --test test/http.test.mjs test/pwa-ui.view.test.mjs test/pwa-ui.integration.test.mjs test/pwa-notion-client.test.mjs` | 0 | 147/147, fail/skip 0 | worker-critic-fixes-focused.tap |
| `rg -n '5개|다섯|봉지.*삭제 보호|기존 봉지 관계' public/app.js GLOSSARY.md` | 1 (기대) | 잔여 문구 0건 | worker-critic-fixes-source-check.txt |
| 4DB 정정 문구·미확정 기록·relation 반복 소스 확인 | 0 | 의도한 문구·검증 복원 확인 | worker-critic-fixes-source-check.txt |
| `git diff --check` | 0 | 이번 변경 공백 오류 없음 | worker-critic-fixes-source-check.txt |

이번 후속은 문구·용어 정의와 테스트 사례 복원이다. Pages 입력 pwa/ 및 lib/domain.mjs는 바뀌지 않아 build/check를 반복하지 않았다. 이전 전체 508/508과 로컬 빌드 b56bc1934364 결과는 위 시점의 증거로 유지하며, 이번 후속의 영향 검증은 147/147이다.

### Critic 증거 확인과 남은 사항 갱신

Critic이 제공한 critic-review.md, critic-browser-check.cjs, critic-browser-results.json 및 연결/원두 화면 390/1280px PNG 4개를 직접 읽거나 열어 확인하고 선별 포함했다. 테스트 fixture의 합성 토큰·합성 source IDs·합성 원두/레시피만 사용하며 실제 credential·실제 Notion 식별자·개인 레코드는 없다. 스크립트에는 작성 환경의 로컬 Playwright 런타임 경로가 포함되어 있다. 스크립트는 재실행하지 않았으며 브라우저 통과는 Critic의 독립 실행 증거로 구분한다.

따라서 위 초기 인계의 'Critic 브라우저 미완료'는 현재 일반 생성·삭제 공개 흐름에 대해서는 완료로 갱신한다. unknown/partial·숨겨진 과거 기록의 브라우저 상호작용, 실제 iPhone/Safari·native OPFS/locks·실제 Notion·공개 게시 검증은 해당 증거 범위에 포함되지 않는다. 이번 P2 수정의 Critic 재검토 및 main 통합·게시는 Orchestrator가 순차 진행한다. worker merge/push/deploy 없음.

## main 통합 후 필수 검사

Orchestrator가 `42b00195f5ab698c105a16992a48f8804427f33f`를 깨끗한 원본 main에 fast-forward 통합했다. Worker(Kuhn, 생성 도구에 gpt-6.1-sol/low 명시)가 통합 main에서 필수 검사를 실제 실행했다. `npm test`: exit 0, 508/508, skip 0; `npm run build:pages`: exit 0, `b56bc1934364`; `npm run check:pages`: exit 0. 로그는 `main-test.txt`, `main-build.txt`, `main-check.txt`다. 최초 sandbox 테스트의 localhost listen EPERM은 `main-test-sandbox.txt`에 보존했고, 권한을 부여한 실행으로 환경 문제를 해소했다. 소스 변경은 없다.

모델 사용: 최초 worker Curie는 gpt-6-luna/max로 설정·속성 테스트까지 수행했다. 사용자의 모델 변경 지시에 따라 중단하고 worker Kuhn을 gpt-6.1-sol/low로 새로 생성해 완료했다. critic Parfit도 최신 사용자 지시에 따라 gpt-6.1-sol/low로 생성했다. 모두 생성 도구 파라미터로 명시했으며 도구의 사용자 지정 이름 기능은 없다. 429에 의한 대체는 아니었다.
