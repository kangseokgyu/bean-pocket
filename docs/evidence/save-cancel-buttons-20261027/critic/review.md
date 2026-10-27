# Critic review — Request changes

- 대상: `/Users/kangseokgyu/.codex/worktrees/save-cancel-buttons/AX-1day`의 지정 5개 파일 diff.
- 기준 HEAD: `0ff35d96ec0e9d690c66cc2cc9a145ef43424cb7`.
- 검토본: `reviewed.diff`, `reviewed-sha256.txt`. 제품 코드 수정 및 추가 에이전트 생성 없음. 모든 테스트 데이터/쓰기 mock 전용. 브라우저 외부 네트워크 요청 차단 및 관측 0건.
- `code-review-and-quality`, `browser-testing-with-devtools` 적용. Chrome DevTools MCP 부재로 사용자 허용 격리 Playwright + 설치 Chrome 사용.

## 필수 지적

### [P2] public pending spinner 상태가 아이콘에 전달되지 않음

위치: `public/app.js:233` (관련 CSS `public/styles.css:6`).

`formShell`은 `.button-icon`에 `data-state="idle"`을 설정하지만 제출 시 `submitButton.dataset.state`만 `saving`으로 바꾼다. CSS의 `.button-icon[data-state=saving]`은 매칭되지 않는다. 실제 지연 mock POST 동안 버튼 label은 `저장 중…`, 버튼은 disabled/aria-busy=true지만 아이콘은 디스켓 그대로이며 spinner가 없다. 이는 public의 모든 공통 formShell 폼에 적용된다.

브라우저 관측: iconState=idle, pseudo content=none, animationName=none, svg display=block. 증거: `public-pending.png`, `browser-results.json`의 `P2-public-spinner`.

필수 수정: pending/idle/success 상태를 CSS가 참조하는 아이콘에도 일관되게 전달하거나 선택자를 버튼 상태에 맞추고, public pending 및 실패 복원에 대한 회귀 검증을 추가한다.

### [P2] public 성공 체크가 표시되기 전에 다이얼로그가 닫힘

위치: `public/app.js:238`–245 (핵심 `dialog.close()` 245행).

실제 `await onSubmit` 성공 후 체크 SVG와 `저장 완료`를 설정하지만 같은 동기 실행에서 바로 dialog.close()한다. 브라우저가 성공 상태를 paint할 기회가 없고 close handler는 내용까지 제거한다. 실제 mock 성공을 재현해 requestAnimationFrame으로 관측한 모든 프레임에서 열린 다이얼로그의 체크가 없었다. DOM에 잠깐 check를 기록하는 것만으로는 요구한 성공 피드백이 사용자에게 전달되지 않는다.

증거: `browser-results.json`의 `P2-public-success-never-painted`, `publicSuccessFrames`, `public-success.png`. 정적 제어 흐름도 관측과 일치한다.

필수 수정: 실제 성공이 확정된 뒤 사용자에게 보이는 성공 피드백 단계를 유지하고 그동안 재제출/취소를 잠근 뒤 닫는다. PWA의 기존 성공 유지 패턴을 참고할 수 있다. public의 성공 상태가 실제 프레임에 보이는지 회귀 검증한다.

## 통과 범위

- 5개 파일 전체 diff와 관련 원래 제출/취소/불확실 저장/복구 흐름 확인. 아이콘은 고정 path 데이터이며 신규 사용자 입력 삽입이나 외부 의존성 없음. 변경에서 별도 보안/성능 차단 사유를 발견하지 못함.
- 일반 폼의 저장/취소 문구, SVG 디스켓/X, 기존 녹색 색상 유지. 연결·복구의 의미 있는 문구 유지. 신규 시간 추정 또는 진행률 배경 애니메이션 없음.
- PWA 및 public에서 320/390/1280 너비 검증, 일반 action 버튼 44px 높이·14px 글자·16px 아이콘·10px 모서리. PWA는 초기 연결 피드백 종료 및 진입 애니메이션 안정화 후 치수를 다시 수집함: `pwa-render-results.json`.
- 실제 PWA controller/state/commands/adapter + 인메모리 파일과 fake Notion 사용. pending 동안 spinner 및 aria-busy, 중복 제출 1회 제한, 취소 disabled, Escape 제한 확인. 실제 fake write 완료 후 체크 표시 확인.
- PWA 확정 실패 HTTP 400 후 입력 보존, 버튼 활성 복원, idle 디스켓 복원. 네트워크 결과 불명 시 재제출/Escape 차단 확인.
- public mock API에서 idle 취소 시 POST 0회, pending 중 중복 제출 1회 제한과 취소/Escape 제한, 실패 후 입력/문구/활성 복원 확인.
- reduced-motion: PWA pending spinner animation=none, public action transition duration=0s 확인. public spinner는 원래부터 나타나지 않아 해당 정상 모션 자체는 실패 사항.
- 브라우저 pageerror 0건, 외부 요청 0건. mock HTTP 400 실패 응답은 의도된 검증 입력.

## 검증 명령과 실제 결과

작업 디렉터리는 대상 워크트리. 모든 산출물은 이 보고서와 같은 디렉터리.

1. `git diff --check` → exit 0.
2. `node --test --test-name-pattern='save and cancel actions|save buttons show|confirmation-result save|pending entry saves|failed entry|connection modal protects|connection modal preserves failed' test/pwa-ui.view.test.mjs` → exit 0, 선택된 6/6 통과 (`targeted-tests.log`).
3. 격리 `/tmp/save-cancel-critic/mutation/` 복사본에서 `if (resolving || submit.disabled)`의 resolving 조건을 반전한 뒤 `node --test --test-name-pattern='confirmation-result save' /tmp/save-cancel-critic/mutation/test/pwa-ui.view.test.mjs` → 의도대로 exit 1, disabled assertion 실패로 mutation 검출 (`mutation.log`). 제품 원본 미수정.
4. `node /tmp/save-cancel-critic/browser.cjs` → 최종 exit 0, 13개 보호/렌더 검증 통과 및 위 필수 지적 2건 관측 기록. exit 0은 전체 요구사항 승인 의미가 아님 (`browser.log`, `browser-results.json`).
5. `node /tmp/save-cancel-critic/render.cjs` → exit 0, 안정화된 PWA 3개 너비의 정확한 치수 assertion 통과 (`render.log`, `pwa-render-results.json`).

초기 실행 이력: sandbox localhost listen EPERM으로 exit 1 → escalation으로 실행 가능. 첫 브라우저 harness 정적 lib 경로 누락으로 boot timeout → /lib 경로 추가. 다음 public 성공 요청 전에 mock gate를 해제한 harness race로 종료 지연 → 요청 도착 확인 후 해제로 수정, 최종 실행 통과. 이는 테스트 harness 문제로 제품 수정 없음.

Worker 원문 로그도 확인함: view 108/108, npm 573/573, Pages build `df39b205d8b3`, check 통과. 해당 전체 명령은 중복 실행하지 않았으며 exit 값은 사용자 제공 기록(RED 1, 나머지 0)과 구분한다.

## 제한 / 미검증

- 일반 원두 폼을 공통 builder/submit 경로의 브라우저 대표로 사용했다. 레시피·기록·연결·복구의 모든 개별 입력 조합과 실패 조합을 브라우저에서 전수 재실행하지 않았다. 공통 적용 및 기존 보호는 diff/호출부/관련 단위 테스트로 확인했다.
- 불확실 쓰기 브라우저 보호 검증은 PWA에서 실시했다. public의 서버 측 불확실 쓰기 처리는 이번 diff가 바꾸지 않아 별도 서버 통합 재검증하지 않았다.
- 스크린 리더 음성 출력, 전체 페이지 성능 프로파일링, 실제 Notion 쓰기, main 통합/게시/공개 사이트 검증은 미실행. 실제 Notion 쓰기는 지시대로 금지했다.
- 상태 확인 시 지정 5개 외 untracked `docs/evidence/save-cancel-buttons-20261027/`를 관측했으며 본 Critic이 생성하거나 변경한 경로가 아니다. 검토 범위에 포함하지 않음.

판정: **Request changes — public의 필수 2건 수정 후 재검토 필요. approve 보류.**
