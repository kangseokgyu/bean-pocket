# iPhone 재실행 연결 복원 수정 — worker-2 인계

- 기준: `785f1c6`, `codex/iphone-connection-retry`. commit/push/merge/배포 미실행. subagent 미생성.
- 원인: 홈의 `routeSchemas('/home')`는 빈 배열이며 실제 NotionClient는 `verify([])`를 거부했다. 최초 연결은 기본 전체 검증으로 성공했지만 재실행은 검증 전 연결 해제로 끝났다.
- 수정: 홈 등 검증 대상이 비어 있는 경로에서는 네 데이터 소스를 검증한다. 화면별 목록·상세 조회와 다른 화면의 부분 검증은 유지한다.
- 저장소 읽기/연결 검증 실패에는 기존 재시도 패널을 사용한다. 저장소와 journal의 일관성을 확인한 뒤에만 명시적인 설정 수정 진입을 허용한다. 잠금 중과 저장소 읽기 실패에는 수정 진입을 숨긴다. guard/mismatch는 복구 패널만 표시하며 교체·쓰기 차단을 유지한다.
- 잠금 어댑터는 외부에서 던진 오류를 `action-error`로 바꾼다. 초기화 콜백에서 실패를 결과로 반환한 후 잠금 밖에서 처리하여 인증·복구 원인을 보존한다. 화면에는 고정 안전 문구만 전달하며 원시 오류·토큰·ID를 표시하지 않는다.

## 변경 파일

- `pwa/ui/controller.mjs`: 비어 있지 않은 시작 검증, 오류별 재시도·복구 분기.
- `pwa/ui/view.mjs`: 재시도 패널의 명시적 설정 수정 버튼, 복구 중 입력폼 숨김.
- `test/pwa-ui.integration.test.mjs`: 실제 NotionClient·repository·submission state와 fake Notion을 사용한 시작/재시도/보호/부분 조회 회귀 테스트.
- `test/pwa-ui.view.test.mjs`: 재시도·복구 입력폼 및 설정 수정 진입 검증.
- `test/pwa-screen-loading.test.mjs`: 홈의 목록 미조회는 유지하되 네 데이터 소스 검증을 기대하도록 수정.
- `README.md`, `docs/pwa-usage.md`: 저장 연결 복원과 재시도 안내.

## 실제 실행 결과

| 명령 | 종료 코드 | 결과 | 로그 |
| --- | --- | --- | --- |
| `node --test test/pwa-ui.integration.test.mjs test/pwa-ui.view.test.mjs` | 0 | 120/120 통과 | `green-targeted.tap` |
| `npm test` (로컬 테스트 서버 실행 허용) | 0 | 570/570 통과, skip 0 | `npm-test.log` |
| `npm run build:pages` | 0 | 산출물 버전 `261874a66bf8` | `build-pages.log` |
| `npm run check:pages` | 0 | 산출물 검사 통과 | `check-pages.log` |
| `git diff --check` | 0 | 공백 오류 없음 | worker 실행 결과 |

초기 `npm test`는 554 통과/16 실패였다(`npm-test-initial-failure.log`). 15개는 `listen EPERM 127.0.0.1` 환경 오류이며 로컬 서버 실행 권한으로 재실행해 통과했다. 1개는 홈에 빈 검증을 기대하던 기존 테스트로, 목록 미조회와 유효한 연결 검증을 함께 단언하도록 갱신했다. 제품 코드는 최종 빌드·검사 뒤 변경하지 않았다.

## RED와 검증 범위

- 이전 worker의 `red-home-init.tap`, `red-startup-flows.tap`, `red-security-boundaries.tap`을 유지했다.
- 구현 전 `red-worker2.tap`에서 실제 홈 시작 실패, 재시도 상태 부재, 인증 안내 및 복구 원인 소실을 재확인했다(종료 1). 인계 테스트의 클릭 이벤트는 실제 위임 대상인 page에 전달하도록 수정했고, connect 차단 오류에는 기존 어댑터의 `action-error`도 허용했다. 외부 요청 미발생과 연결 교체 차단 단언은 유지했다.
- `red-recovery-form.tap`은 복구 중 입력폼 숨김을 추가한 RED 증거(종료 1). GREEN 전 중간 실패로 view 이벤트 처리 범위 문제도 발견해 공개 view 메서드를 통해 처리하도록 수정했다.
- 테스트로 홈 4 GET, 실패 후 재시도 복원, 저장 파일 불변, 저장소 읽기 실패 후 복구, 최초 파일 부재, 401 안전 안내, guard/mismatch 교체 차단, 화면별 부분 검증 및 목록 지연 조회를 확인했다.
- 실제 브라우저/스크린샷은 사용자 지시에 따라 후속 critic 담당. iPhone Safari/홈 화면 앱, 실제 Notion 연결, 배포 공개 반영은 미확인이다. 테스트는 메모리 저장소와 fake Notion을 사용했다.
- 다음 단계: critic 독립 검토와 브라우저 검증 → 메인의 통합 및 필수 검사 → 배포. worker는 게시하지 않았다.

## 최종 완료

독립 검토 APPROVE와 브라우저 12/12를 확인하고 main 통합·필수 검증·일반판 게시·공개 20개 파일 일치 확인까지 완료했다. 공개 빌드 `261874a66bf8`. 최종 근거와 미확인 범위는 [게시 기록](deployment.md)을 따른다. 위 worker 인계의 배포 미실행·브라우저 미확인은 당시 역할 범위에 대한 기록이다.
