> 보관 범위: 이 보고서와 브라우저 근거는 `048d2dd`에 대한 독립 Critic 실행 결과다. 이후 조사 문구 수정의 브라우저 재실행 결과로 해석하지 않는다. 원본 보고서 중 공개에 불필요한 개인 절대 경로만 생략했다. 참조된 원본 파일 중 아래 증거 디렉터리에 선별 보관한 파일만 포함한다.

# Independent Critic review — APPROVE WITH NIT

- 검토일: 2026-10-23 (Asia/Seoul)
- 기준 main: `5f0b582`
- 구현: `048d2dd1b09c8da65fc24555f2c71abfcfd6cfca`
- 워크트리: `(기능 워크트리; 개인 절대 경로 생략)`
- 역할: 독립 critic. 서브에이전트 생성, 소스 수정, 커밋, merge, 게시 없음. 모든 신규 증거는 이 임시 폴더에만 작성.
- AGENTS.md 및 code-review-and-quality SKILL.md 확인. 사용자 요구와 테스트를 먼저 읽고 구현의 5축(정확성·가독성·설계·보안·성능)을 검토했다. 소스 수정 금지 요구가 우선하므로 스킬의 소스 조건 반전 mutation은 하지 않았다.

## 결론 / Findings

**APPROVE**. 신규 P0/P1/P2 결함 또는 merge 차단 사항을 발견하지 못했다. 아래 P3 문구 정리는 선택 사항이며 Worker에게 반환할 수 있다.

1. **[P3, Nit, 비차단] 복구 문구의 조사 오타**
   - 파일: `pwa/ui/view.mjs:893`, `pwa/ui/view.mjs:904` (선택지 다음 줄 905도 동일)
   - `${targetName}이`를 공통 적용해 실제 Chrome 복구 화면에 `봉지이 휴지통에 있음을 확인함`, `레시피이 휴지통에 있음을 확인함`이 표시된다.
   - `봉지가`, `레시피가`, `추출 기록이`로 조사까지 포함한 표기를 선택하거나 조사 없는 문장으로 정리하면 된다. 복구 기능은 정상이다.
   - 증거: `recovery-browser-results.json`, `recovery-bag.png`, `recovery-recipe.png`.

**기존 제한 사항 (이번 변경 finding 아님):** 320px 화면에서 긴 원두·레시피명이 기록 필터 select의 intrinsic 폭을 키워 기록 목록도 넓어진다. main과 구현 모두 `scrollWidth=360`, `innerWidth=320`, 필터/목록 폭 338px로 동일했다. 구현에서는 이 상황에 새 기록 휴지통 일부가 화면 오른쪽 밖에 놓인다. 390px 긴 이름 및 320px 짧은 이름에서는 버튼 전체가 화면 안에 있고 상호작용도 통과했다. 기존 필터의 폭 제약 개선은 별도 후속 작업으로 권장한다.
- 관련 기존 영역: `pwa/ui/view.mjs:808`의 필터 선택지, `pwa/ui/view.mjs:818`의 기록 목록.
- 증거: `compare.json`, `320-compare-4257.png` (구현), `320-compare-4258.png` (기준 main).

## 독립 실행 결과

| 명령 | 최종 exit | 결과 / 증거 |
| --- | --- | --- |
| `node --test /private/tmp/entity-delete-critic/safety.test.mjs` | 0 | 12/12, `safety.tap` |
| `node /private/tmp/entity-delete-critic/browser.cjs` | 0 | Chrome 1280/390px 긴 이름 및 320px 짧은 이름, 각 5개 삭제 PATCH; `browser.log`, `browser-results.json`, 화면 PNG |
| `node /private/tmp/entity-delete-critic/recovery-browser.cjs` | 0 | 봉지·레시피·기록별 응답 유실 → 새 controller/state 생성 → 확인 UI → 재전송 없는 복구; `recovery-browser.log`, `recovery-browser-results.json` |
| `node /private/tmp/entity-delete-critic/compare.cjs` | 0 | 320px 긴 이름의 기준 main/구현 비교; `compare.log`, `compare.json` |
| `git diff --check 5f0b582 048d2dd` | 0 | 패치 공백 검사 |
| `git status --porcelain=v1` | 0 | 출력 없음; 검토 전후 소스 변경 없음 |

실행 브라우저: Playwright의 `chromium.launch({headless:true, executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'})`. 설치 Chrome 실행 성공. 사용자 프로필 대신 새 임시 context를 사용했다. Service worker를 차단하고 localhost 외 요청은 abort했다. `browser-results.json`의 external 및 pageerror 배열은 모든 context에서 비어 있다. fake API 호출은 fetch fixture가 메모리에서 처리하며 실제 Notion으로 보내지 않는다.

### 브라우저에서 검증한 요구사항

- 원두/봉지/레시피/기록 카드의 SVG 휴지통, 접근 가능한 이름, 우상단 배치, 46×46px 버튼.
- 각 확인창에 해당 항목 이름과 Notion 휴지통 이동 명시. 취소 시 PATCH 없음.
- 사용 중 원두/봉지/레시피 삭제 차단. 봉지/레시피의 상태 문구에 추출 기록을 먼저 삭제하라는 안내 표시.
- 기록 삭제 후 목록에서 해당 기록 제거. 평가 2회/평균 3점에서 1회/평균 1점으로, 마지막 기록 삭제 후 평가 없음/0회로 갱신.
- 기록 목록 및 레시피 상세 안의 기록 휴지통 모두 동작.
- 기록을 먼저 모두 지운 뒤 봉지와 레시피 삭제 성공. 레시피 부모만 휴지통 이동하고 단계 2개는 active로 유지.
- 삭제된 봉지/레시피가 기록 작성 선택지에서 제거. 미저장 컵노트와 dirty 상태는 보존.
- 의존성 제거 후 기존 원두 삭제 성공.
- 신규 세 삭제 유형 모두 응답 유실 시 삭제 UI 잠금 및 종류에 맞는 복구 문구. state/controller를 새로 만들고 저장된 journal을 읽은 뒤 원본 확인 UI로 해결. 추가 PATCH 없음.
- 390px 기록/봉지 화면은 PNG를 직접 열어 긴 제목 줄바꿈과 휴지통 배치를 시각 확인.

### 신규 안전성 실험 12개

각 bags/recipes/records에 대해 다음 4개 테스트를 독립 추가했다.
1. 생성 cleanup으로 삭제 대상 처리, 생성으로 위장, 다른 ID, 다른 kind, 비원두 deleteKind 생략을 쓰기 전에 차단.
2. 동일 draft 중복 실행은 두 번째 PATCH를 보내지 않음. 연결 revision 변경 후 이전 draft도 차단.
3. 서버에서는 휴지통 이동했으나 응답 유실: 재시작 후 unknown 확인, 신규 쓰기 차단, saved 확인으로 해소; PATCH 1회 유지.
4. 서버에서는 이동하지 않고 응답 유실: 재시작 후 not-saved 확인으로 해소; PATCH 1회 유지.

기존 테스트·구현도 직접 검토해 최신 readAll 기반 의존성 검사, excluded/incomplete 관계의 fail-closed, Notion 페이지 소속 검사, durable journal target과 cleanup 분리, 쓰기 lock/연결 검증이 유지되는 것을 확인했다.

## 실패한 시도 / 수정한 하네스 가정

- localhost 서버 첫 실행은 sandbox `listen EPERM`으로 exit 1. 동일 fake-only 서버를 승인된 실행 환경에서 시작해 해결했다. 실제 API 접근은 없었다.
- 초기 브라우저 검증의 평점 assertion은 UI의 실제 표기 `평가 1회 · 평균 1.0점`과 다른 정규식 때문에 exit 1. 실제 화면은 올바른 집계였고 하네스만 수정했다. `harness-first-failure.log` 보존.
- 기존 참고 하네스는 실제 index.html의 `.page` 컨테이너가 빠져 있었다. 임시 서버 HTML에 같은 바깥 컨테이너를 넣고 레이아웃을 재검증했다. 제품 소스 변경 없음.
- 320px 긴 이름 시나리오는 실제 가로 넘침 때문에 exit 1. 기준 main에도 동일함을 별도 비교해 확인했다. 실패 결과는 `browser-long-name.log`, `browser-long-name-results.json`에 보존했다. 최종 정상 범위 테스트에서 320px에는 짧은 이름을 사용하며 이 제한을 숨기지 않았다.
- main 비교 첫 하네스는 baseline 아카이브의 `lib/domain.mjs` 누락으로 모듈 404 / timeout exit 1. baseline의 lib를 임시 디렉터리에 추가한 뒤 비교 명령 exit 0. 초기 진단은 `compare-diagnostic.log`에 남겼다.

## 기존 Worker 근거 / 미검증 범위

Worker의 `docs/evidence/entity-delete-20261023/verification.md`, RED/GREEN 로그와 테스트를 읽었다. Worker 보고: 의도한 RED 9, focused 156/156, 전체 448/448, build/check exit 0, 빌드 버전 `a9ce59c9a438`. 동일 전체 테스트·빌드는 중복 실행하지 않았다. 위 표는 이번 Critic이 실제로 추가 실행한 결과만 구분해 기록한다.

실제 Notion 계정/데이터 쓰기, 실제 iPhone/Safari, 실제 OPFS 디스크·native browser lock의 crash recovery, service worker 업데이트, Pages 게시와 공개 반영은 이번 검토에서 실행하지 않았다. 브라우저는 실제 제품 모듈과 fake Notion 및 메모리 저장/lock adapter를 사용했다. 재시작 검증은 같은 메모리 파일 상태를 새 submission-state/controller가 읽는 방식이다. main merge/게시 및 통합 검증은 Orchestrator 범위다.

Worker verification.md의 `사용자의 Critic 우선 반환 요청`은 **실제로 Orchestrator 요청**이었다는 후속 지시를 반영해 기록한다. 해당 프로젝트 문서는 수정하지 않았으며 최종 증거 정리 시 Orchestrator가 정정할 예정이다.
