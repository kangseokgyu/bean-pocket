# 독립 Critic 검토 — APPROVE

- 날짜: 2026-10-26 (Asia/Seoul)
- 역할/앱 별칭: `critic` / `Carver`. 메인이 전달한 실제 실행 설정: `gpt-6.1-sol`, reasoning `medium`. 별도 생성 도구 호출이나 모델 재설정은 하지 않았다.
- 최초 검토: `209e4e9..579f0ee325d47d7e9a52a94ab9169408bd32c0d5`.
- 제품 통합 재검토/브라우저: `923a08a6439ebc65a91067656d3c369ae5bbb0fa` (`main`의 레시피 카드 변경 통합).
- 최종 문서 재검토: `f02437b094a596d35c8c57b4da64a968e54c9184` (README/GLOSSARY만 변경). 제품 검증은 위 `923a08a` 결과를 유지한다.
- AGENTS.md, code-review-and-quality 및 browser-testing-with-devtools 스킬, SPEC/PLAN/tasks와 변경 테스트를 직접 읽고 diff를 검토했다. Worker의 통과 보고를 독립 검증으로 대체하지 않았다. 서브에이전트 생성·제품 코드 수정·commit·merge·push·게시 없음.

## Findings / 판정

**APPROVE**. 신규 P0/P1/P2 결함이나 merge 차단 사항은 발견하지 못했으며, 기존 P3 문서 의견도 해결됐다.

- `f02437b`의 변경 원문을 직접 재검토했다. README는 봉지 UI·쓰기·신규 기록 연결 제외, 5 source ID 유지, 과거 원본 보존, 정확한 `bagless-v1` marker가 있는 유효 snapshot만 표시·평가 집계, 숨겨진 과거 관계의 삭제 보호를 명시한다.
- GLOSSARY의 원두 봉지/추출 기록 정의도 현재 정책에 맞춰 수정됐다. 이전 “봉지와 컵노트는 선택” 문구가 제거돼 기존 P3를 종결한다.
- SPEC 말미의 2026-10-26 결정은 이전 봉지 요구를 명시적으로 대체하며 PLAN §8과 tasks/remove-bags.md도 같은 범위다. README/GLOSSARY와의 정합성에 추가 지적사항은 없다.
- 이번 재검토는 문서 및 검증 증거 정리만 수행했다. 전체 테스트·빌드·브라우저를 재실행하지 않았으며 commit은 메인 담당자에게 맡긴다.

## 직접 확인한 구현 경계

- `createSnapshot`은 v2의 bean/recipe 구조와 가이드를 보존하고 최상위 marker를 추가한다. codec의 JSON 분할/복원과 repository의 validateStoredSnapshot 복제 과정에서 marker가 유지된다.
- `isCurrentRecord`는 정확한 marker 및 `snapshotStatus === 'valid'`를 모두 요구한다. missing/damaged/미지원 marker는 목록·원두 상세·레시피 상세·평가 집계에서 제외된다. 손상 snapshot을 valid로 승격하지 않는다.
- raw repository는 구세대 행과 봉지를 유지한다. 원두·레시피 삭제 검사는 최신 전체 projection을 받으며 숨김 필터를 받지 않는다. 불완전·제외 관계의 fail-closed 검사가 유지된다.
- PWA의 prepareBag/prepareDeleteBag 제거, 위조 draft 거부, prepareRecord의 bagId 소유 속성 거부, client의 bags 생성/archive 및 bagId/무 marker 기록 쓰기 거부를 확인했다. 새 wire properties에는 `원두 봉지` 자체가 없다.
- 서버 `/api/bags` POST 410과 기록 bagId 거부, legacy repository의 봉지 생성 차단, public의 봉지 UI/폼 제거 및 같은 기록 필터를 확인했다. raw 조회에 과거 봉지가 남는 것은 보존 요구에 따른다.
- 5 source 연결·schema 호환 구조 및 journal/state/lock 코드가 유지된다. 기존 unknown/partial 작업은 자동 재실행되지 않고 unresolved 쓰기 잠금을 유지한다.
- 통합 추가 diff의 레시피 링크·summary-card와 테스트 양쪽 보존을 확인했다. 실제 카드 요약 영역 클릭으로 상세에 진입했다.

## 독립 실행 증거

원문과 재현 하네스는 `critic/`에 있다. 제품 원본에 mutation을 적용하지 않았다. 안전성 테스트는 자동 탐색을 피하도록 `.mjs.txt`로 보존했으며, 실행하려면 임시 checkout의 `test/critic-bagless.test.mjs`로 복원해야 상대 imports가 맞는다. 브라우저 하네스의 로컬 절대 경로와 `/private/tmp` 출력 대상은 당시 실행 원문이며 현재 위치에서 바로 실행 가능한 도구로 제공하는 것이 아니다. 재현 위치와 경로 조정은 `critic/README.md`를 따른다. 로그는 ignore되는 `.log` 대신 추적 가능한 `.txt`로 원문 바이트를 보존했다.

| 검증 | 실제 결과 | 증거 |
|---|---|---|
| 독립 추가 안전성 테스트 | exit 0, 5/5 | `critic/safety.tap`, `critic/critic-bagless.test.mjs.txt` |
| 변경 위험 대상 기존 테스트 11개 | 최초 9 pass, 2 listen EPERM; HTTP 2개만 권한 있는 실행에서 재검증하여 2/2 pass | `critic/focused-sandbox.tap`, `critic/http.tap` |
| marker 조건 반전 mutation | 임시 `git archive 923a08a` 복사본에서 `===`를 `!==`로 변경; exit 1, 선택 4개 중 2개가 집계 오류를 검출. 복사본 복원 완료 | `critic/mutation.tap` |
| 설치 Google Chrome headless | exit 0; 독립 임시 context 1280px/390px, 실제 제품 view/controller/client/repository/commands/state + fake Notion/메모리 storage/lock | `critic/browser.txt`, `critic/browser-results.json`, `critic/browser.cjs`, `critic/server.mjs` |
| 화면 직접 확인 | 390px 기록 폼/레시피 평가 화면 PNG 확인; 폼 진입 애니메이션 완료 후 별도 촬영 | `critic/390-form-settled.png`, `critic/390-rating.png` |
| 패치/검토 대상 | `git diff --check 209e4e9 923a08a` exit 0; 제품 변경 없는 clean 상태 확인 | 실행 출력 |

안전성 5개는 16가지 status/marker 조합, 유효 marker 원격 roundtrip, 손상 v2 raw 보존/집계 제외/삭제 보호, 위조 bags/delete-bag draft, null/빈 값/undefined bagId, journal 생성 전 거부, records processing·bags partial·delete-bag unknown 재시작 후 미전송과 잠금을 직접 검증한다.

브라우저에서는 봉지 메뉴/선택 부재, 과거 컵노트 숨김과 새 기록 조회, 폼으로 2점 기록 저장, raw marker와 bag 속성 부재, 평가 4점 1회 → 평균 3점 2회 → 삭제 후 4점 1회, 가이드 표시/복사, 레시피 카드 클릭을 확인했다. 현재 기록을 모두 지운 뒤에도 숨겨진 과거 기록/봉지가 원두·레시피 삭제를 막고 PATCH가 추가되지 않았다. 모든 context에서 pageerror/console error·warning 및 외부 요청 배열이 비었다. 개인 프로필 접근과 실제 Notion 요청은 없었다.

## 기존 검증과 한계

- Worker 전체 495/495 및 메인 통합 전체 497/497은 각 원문 로그로 확인했다. 메인의 integrated build/check 로그는 성공 및 build `da92f2364938`을 확인했다. 전체 테스트/빌드를 Critic이 반복 실행한 것으로 보고하지 않는다.
- 초기 localhost 서버와 Chrome 실행은 sandbox EPERM/SIGABRT로 막혀 같은 fake-only 검증을 승인된 실행 환경에서 실행했다. 최초 focused HTTP 2건도 환경 오류이며 `http.tap`의 재실행으로 해소했다.
- 브라우저 초기 2회는 hashchange 완료 전에 DOM 개수를 읽거나 상세 대신 이전 목록을 읽는 하네스 대기 오류였다. section/detail 요소 대기를 추가해 최종 통과했다. 마지막 실패 로그는 `critic/browser-navigation-race.txt`에 보관했다. 제품 수정 없음.
- 실제 Notion, iPhone/Safari, 실제 OPFS 디스크/native lock crash recovery, service worker 업데이트 실행, Pages 게시/공개 build 반영은 미검증이다. 일반 초안·업데이트 회귀는 해당 코드 diff와 메인의 전체 테스트를 확인했으며 브라우저에서 모든 조합을 재현한 것은 아니다.
- 브라우저는 source 모듈을 사용하는 localhost 합성 fixture다. 배포 dist/public 서버 화면의 시각 검증과 동일하지 않다. legacy HTTP 동작은 집중 자동 테스트와 코드로 확인했다.
- 보고서는 위 HEAD 범위의 결론이다. 이후 제품 변경이 있으면 영향 범위를 재검토해야 한다. 문서 의견은 종결했으며 merge/게시 판단은 메인 담당자에게 반환한다.
