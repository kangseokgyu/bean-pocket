# GUI 사용성 개선 증거

작업 브랜치 `codex/gui-usability`는 main 커밋 `1d86987`에서 시작했다. 지정된 작업 디렉터리는 `/Users/kangseokgyu/.codex/worktrees/gui-usability/AX-1day`다. 원본 작업 폴더의 미커밋 `pwa/styles.css`는 작업 범위에 넣지 않았다.

## 완료 조건

- 긴 추출 폼에서 기본 조건 요약, 조건 펼치기, 눈에 띄는 평가 저장을 확인한다. 접고 펼쳐도 입력값과 실제 조건 스냅샷이 유지된다.
- 기록 화면은 목록으로 시작하고 분석 탭에서 분석을 연다. 기존 원두·레시피 필터, 페이지 조회, 기록 관리와 삭제 확인이 작동한다.
- 기록이 0~1건일 때 큰 차트와 실행 불가능한 두 기록 비교 입력 대신 짧은 안내를 표시한다.
- 목록의 즐겨찾기와 상세의 수정·삭제 조작 대상은 44px 이상이다. 목록에서 삭제 버튼을 감추고 상세 또는 더보기로 옮기며 삭제 확인 흐름은 유지한다.
- 원두 목록은 기록된 정보만 간결히 보여주고, 미기록 메타데이터는 상세 화면에서 확인한다.
- 기록 보조 문구는 13~14px로 읽을 수 있고 반복 안내를 줄인다.
- 성공 토스트는 1초 뒤 사라지고 오류·복구 안내는 해소 또는 재시도 상태로 바뀔 때까지 남는다.
- 새 동작 테스트가 변경 전 의도한 이유로 실패하고, 변경 후 통과한다. `npm test`, `npm run build:pages`, `npm run check:pages`가 모두 통과한다.
- `cua_repl`로 가상 Notion 데이터 화면을 확인하고 결과를 기록한다. 실제 Notion과 iPhone Safari는 이 작업에서 사용하지 않는다.

## 작업 단계

- [x] Read the Principles section of the poteto-mode skill.
- [x] Phase A: Frame
- [x] Phase B: Design the workflow
- [x] Phase C: Run the loop
- [x] Phase D: Keep the audit trail
- [x] Phase E: Verify and hand back (자동 검증 완료, GUI는 Critic 인계)

변경 전 범위는 화면 동작 7개, PWA UI 모듈 약 5개, UI 테스트와 CSS다. 저장된 추출 조건과 삭제 확인에 영향이 있으므로 rigor는 높게 두고, 작은 단위마다 회귀 확인을 한다. 기능을 분리하면 기록 폼, 목록·분석 전환, 희소 데이터, 관리 조작, 원두 요약, 안내 글씨, 토스트가 각각 독립 검증 가능하다.

## 변경 전 브라우저 관찰

2026-11-12, 브라우저 탭의 가상 Notion fixture를 `cua_repl`로 열고 390×844 화면에서 관찰했다. [ui-refactoring 브라우저 harness](../ui-refactor-browser-20261106/README.md)의 로컬 서버와 fixture 초기화 모듈을 사용했다. 이전 자동화 검증 스크립트는 실행하지 않았다.

- `/brew/run`은 조건 편집 필드와 붓기 단계를 모두 처음부터 노출했다. 평가 날짜·별점·컵노트와 `추출 평가 저장`은 긴 페이지 아래에 있었다.
- `/records`는 기록 1건뿐인데도 큰 별점 차트, 두 기록 선택 상자와 “두 건 이상” 안내를 그렸다. 전체 기록 목록은 접힌 관리 섹션 안에 있었다.
- `/beans`는 목록 카드에 품종과 프로세싱의 `기록 없음`을 반복 표시했고, 목록 헤더에 삭제 버튼이 있었다.

위 관찰은 CUA 세션의 변경 전 접근성 트리와 화면 캡처에서 확인했다. 캡처 파일은 별도 저장하지 않았다.

## 의사결정과 검증

각 작업 단위와 증거는 [decisions.tsv](decisions.tsv)에 시간순으로 기록한다. 최종 기록에는 명령, 종료 코드, 테스트 결과, 브라우저 확인 범위, 미확인 범위를 추가한다.

이 브랜치 작업자는 Worker 역할이며 사용자가 추가 에이전트 생성을 금지했다. 따라서 독립 Critic 검토는 하지 않고 변경·검증을 다음 Critic 역할에 넘긴다. 게시, push, merge는 수행하지 않는다.

## Worker 구현 결과

추출 조건은 기본 요약과 접기 편집으로 바꿨고 기존 입력과 실제 조건 payload를 유지한다. 모바일 저장 액션은 화면 아래에 둔다. 기록은 목록으로 시작하며 분석 전환과 기존 필터·페이지·삭제 확인을 유지한다. 비교 링크는 분석 패널로 바로 연결한다. 0~1건 분석에서 차트와 두 기록 선택을 생략한다. 목록 삭제는 원두·레시피 상세와 기록 더보기로 옮겼다. 조작 대상은 최소 44px이며 원두 목록의 빈 메타데이터와 반복 안내를 줄였다. 기록 보조 글씨는 13px, 성공 토스트는 1초, 오류·복구 안내는 해소까지 유지한다.

- 선행 실패: `test-red.log`. 인계된 `test-red-targeted.log`는 TAP 헤더만 있어 실패 근거로 사용하지 않는다.
- 인계 시 실패: `test-green-targeted.log`의 7개 중 2개 실패. 첫 h3가 붓기 단계 제목인 점과 테스트 클릭 helper가 버튼 자체 listener를 호출하지 않는 점을 수정했다. `test-green-targeted-fixed.log`: 7개 통과, 종료 0.
- 삭제 테스트를 새 상세/더보기 경로로 옮겨 확인·취소·오류·중복 잠금 검증을 유지했다. 토스트와 희소 분석의 옛 기대값도 승인된 동작에 맞췄다.
- `node --test test/pwa-ui.view.test.mjs`: 215개 통과, 종료 0 (`test-ui.log`). 이후 비교 링크 회귀 테스트를 추가했다. 추가 테스트의 의도한 실패는 `test-red-comparison-route.log`, 수정 후 1개 통과는 `test-green-comparison-route.log`에 남겼다.
- 원본 CSS SHA-256: `30fb61b19fb9eb1b324b3df1cd8a74f9049131e5ca6ee964481601210f41416b`. 원본 사용자 변경 17줄 추가·5줄 삭제를 읽기만 했다.
- 추가 에이전트를 생성하지 않았다. 사용자가 허용한 luna/max 429 이후 sol/medium fallback Worker 인계다. 이 채팅에서 모델 설정을 변경하는 생성 도구는 호출하지 않았으므로 적용 설정을 별도로 검증했다고 주장하지 않는다.
- 변경 후 CUA GUI 검증은 사용자 지시에 따라 Critic에게 인계한다. Worker는 실제 Notion 및 iPhone Safari 검증을 수행하지 않았다.
- 구현 커밋 후 `origin/main`을 병합하고 통합 상태에서 `npm test`, `npm run build:pages`, `npm run check:pages`를 실행한다. main 병합·push·게시와 독립 검토는 Orchestrator/Critic 담당이다.

## origin/main 통합과 최종 검증

- 구현 커밋: `2ccf405` (`feat: simplify brew and records interactions`).
- 통합 커밋: `1cbb3ce` (`origin/main`의 `e271245`를 기능 브랜치에 병합).
- 충돌 6개 파일을 해결했다. 최신 main의 원두·레시피 상세 상단 액션, 초안 복원과 단계 편집을 유지했다. 최신 4열 기록 표는 기본 목록 패널에 두고 기존 카드·필터·더보기를 유지했다. 분석 패널에는 추이와 원두 요약·비교를 둔다.
- 중간 통합 UI 검증은 230개 중 4개 실패했다 (`test-ui-integrated.log`). 상세 액션의 최신 위치와 표의 목록 패널 이동을 테스트에 반영했다. 해당 기대값 수정 후 전체 검증을 실행했다.

| 명령 | 종료 코드 | 결과 | 증거 |
| --- | --- | --- | --- |
| `npm test` | 0 | 810개 통과, 실패·취소·건너뜀 0, 약 57초 | [전체 테스트](npm-test-integrated.log) |
| `npm run build:pages` | 0 | 빌드 버전 `8ede26dc0362` | [빌드](build-pages-integrated.log) |
| `npm run check:pages` | 0 | 정적 산출물 검사 통과 | [산출물 검사](check-pages-integrated.log) |
| `git diff --check` | 0 | 공백·충돌 표식 오류 없음 | 터미널 실행 |

테스트 후 제품 소스를 변경하지 않았다. 원본 CSS의 최종 SHA-256과 17줄 추가·5줄 삭제 상태는 시작 때와 동일하다. Worker는 push·main merge·게시를 실행하지 않았다. 공개 빌드 버전은 확인하지 않았으며 위 버전은 로컬 산출물이다.

## Critic / Orchestrator 인계

추가 에이전트 없이 Worker 작업을 마쳤다. Critic은 `cua_repl`만으로 변경 후 GUI를 확인한다. 가상 Notion fixture에서 390×844 및 넓은 화면의 저장 액션·키보드/접기 편집, 수정 후 스냅샷 저장, 새로고침 후 초안 복원, 기록 목록/분석 전환과 필터·페이지 유지, 0~1건 및 다건 분석, 44px 대상과 삭제 확인·취소, 성공 1초/오류 지속을 확인한다. 특히 최신 main에서 들어온 4열 표와 관리 카드가 기본 목록에 함께 있고 상세 관리 버튼은 카드 내부가 아닌 화면 상단에 있는 점을 검토한다. 실제 Notion 및 iPhone Safari는 미확인이다.

Orchestrator는 독립 Critic 결과를 확인한 후 main 통합·push·일반판 게시 및 공개 파일 반영을 담당한다. 현재 브랜치는 `codex/gui-usability`이며 원본 사용자 CSS를 계속 보호해야 한다. 검증 뒤 제품 소스가 바뀌면 영향받는 검증 결과를 갱신한다.
