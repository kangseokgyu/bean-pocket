# Critic 독립 검토 — APPROVE

- 검토 기준: `785f1c6`, 브랜치 `codex/iphone-connection-retry`의 미커밋 변경. 제품 코드·테스트·기존 문서 원본은 수정하지 않았다. 이 `critic/` 디렉토리의 검증 스크립트·로그·스크린샷만 생성했다. subagent 생성 및 commit/merge/push/deploy는 하지 않았다.
- 결론: **APPROVE. Required 0, Critical 0.** 기능·설계·보안·회귀 관점에서 이번 변경에 필요한 수정사항을 찾지 못했다.

## 코드와 기존 검증 근거

Worker README와 원본 diff, 추가 테스트, 실제 controller/view/NotionClient, connection-file 및 submission-state 잠금·복구 경계를 직접 확인했다. 기존 `npm-test.log`의 570/570, 빌드 버전 `261874a66bf8`, `check:pages` 통과 로그를 확인했으며 전체 테스트·빌드를 중복 실행하지 않았다.

- `/home`에서 빈 배열 대신 네 데이터 소스를 검증한다. 목록 직접 접근의 부분 검증과 목록 지연 조회는 유지된다.
- 저장소 파일 읽기와 journal 일관성 검사, Notion 검증이 성공한 이후에만 `install`한다. guard/mismatch는 복구 전용이며 설정 폼이 숨겨진다. unknown/partial은 조회 연결을 허용하되 신규 쓰기를 계속 차단한다.
- `{error}` 반환은 초기화의 읽기/검증 실패를 잠금 어댑터의 `action-error` 정규화 밖으로 전달한다. 보호 검사나 `install`을 우회하지 않으며, 화면에는 고정 문구만 사용한다. 잠금 context가 밖으로 반환되거나 쓰기 권한이 연장되지 않는다.
- 저장소 읽기 실패는 설정 수정 없이 재시도를 제공한다. 실제 파일 부재만 최초 입력으로 연결하며, 401/403/404/429는 재시도와 명시적 설정 수정 진입을 제공한다. 실패만으로 저장된 설정을 지우지 않는다.

## 독립 실행

| 검증 | 명령/방법 | 결과 | 근거 |
| --- | --- | --- | --- |
| 대상 테스트 | `node --test test/pwa-ui.integration.test.mjs test/pwa-ui.view.test.mjs` | 종료 0, 120/120, skip 0 | `independent-targeted.tap` |
| mutation 무변경 대조군 | 임시 디렉토리의 pwa/test/lib 복사본에서 integration 테스트 | 종료 0 | `mutation-control.tap` |
| 빈 홈 검증 회귀 | 임시 복사본에서 fallback을 빈 배열로 변경 | 종료 1, 홈 시작/재시도/인증/저장소 복원 테스트 실패 | `mutation-empty-home-verification.tap` |
| 오류 원인 소실 | 임시 복사본에서 오류를 action-error로 교체 | 종료 1, 인증 안내 및 복구 보호 테스트 실패 | `mutation-error-cause-loss.tap` |
| guard 우회 | 임시 복사본에서 guard 조건 제거 | 종료 1, 복구 전용 및 교체 차단 테스트 실패 | `mutation-guard-bypass.tap` |
| 실브라우저 | `node docs/evidence/iphone-connection-retry-20261027/critic/browser.cjs` | 종료 0, 12/12 | `browser-results.json` |
| 공백 검사 | `git diff --check` | 종료 0 | 실행 결과 |

mutation의 최초 시도는 임시 복사본에서 lib를 누락해 모듈 로드 오류로 종료했다. 이를 회귀 검출로 인정하지 않았다. lib를 포함하고 무변경 대조군 통과를 확인한 뒤 세 변형을 다시 실행한 결과만 위에 기록했다. 모든 변형은 임시 복사본에만 적용했고 임시 디렉토리는 삭제했다. 요약은 `mutation-results.json`에 있다.

## Chrome + 실제 OPFS 검증

Chrome DevTools MCP가 없어 사용자 지정 bundled Playwright와 `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`을 사용했다. 매 시나리오마다 격리된 새 브라우저 context에서 localhost origin의 실제 OPFS에 테스트 전용 연결 파일과 journal을 기록했다. 실제 view/controller/NotionClient/repository/commands/submission-state/connection-file을 사용하고 Notion 응답만 fake로 대체했다. 외부 요청은 차단했다. 실제 사용자 프로필·토큰·Notion 데이터는 접근하지 않았다.

12개 시나리오 모두 통과:

1. 저장 설정으로 `/home` 시작: GET 4회, 연결 성공, 입력폼 숨김. 새로고침 후 OPFS 재읽기 성공 및 파일 불변.
2. 일시 503 실패: 연결 비활성, 재시도 패널, 폼 숨김. 실제 재시도 버튼 클릭 후 재입력 없이 연결 복원, connection/journal 원문 불변.
3. 401, 403, 404, 429 각각: 연결 비활성, 재시도 패널, 실제 설정 수정 버튼 클릭 후 빈 토큰 폼 표시. 429는 기존 읽기 재시도 정책에 따라 GET 3회.
4. 실제 OPFS 파일 부재: 최초 입력폼 표시, 네트워크 요청 없음.
5. 저장소 접근 오류 주입: 입력폼·수정 버튼 숨김, 재시도 패널. 오류 해제 후 실제 재시도 버튼 클릭으로 저장 파일 그대로 복원.
6. guard 및 revision mismatch 각각: 네트워크 요청 0, 연결 비활성, 복구 패널만 표시.
7. unknown 및 partial 각각: unresolved 표시 유지, 신규 submit 거부, GET 이외 요청 없음.

모든 시나리오에서 320px·390px document 가로 넘침 없음. pageerror, console warning/error, 외부 네트워크 요청 모두 0. 화면 문구에 가짜 토큰·데이터 소스 ID·원시 오류가 노출되지 않는지 단언했다. `*-initial-390.png`는 초기 화면, `*-390.png`는 클릭/재시도 후 화면이다. 전환 애니메이션 종료 후 초기 화면을 촬영했으며 재시도·설정 수정·복구 화면을 직접 열어 확인했다.

최초 localhost 실행은 `listen EPERM 127.0.0.1`로 막혔고, 로컬 서버 및 Chrome 실행 권한으로 재실행해 통과했다. 스크린샷 보완을 위한 재실행에서도 12개 시나리오 모두 통과했다.

## 미확인 범위

iPhone 실기기 Safari/홈 화면 앱의 저장소 수명과 재실행, 서비스워커 업데이트·캐시 경로, 실제 Notion 네트워크·권한, 배포 및 공개 반영은 검증하지 않았다. 이번 브라우저 harness는 service worker를 차단하고 실제 Notion 대신 fake 응답을 사용했다. 따라서 이 승인은 코드와 위 로컬 검증 범위에 대한 것이며 iPhone 실기기 또는 배포 성공을 의미하지 않는다.
