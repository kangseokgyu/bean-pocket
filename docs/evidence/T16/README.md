# T16~T20 생성·복사 명령 검증

2026-10-19. 예정된 `createCommands({ client, repository, submissionState })` API를 `pwa/commands/index.mjs`에 구현했다. T14 제출 journal과 lock, T15 최신 전체 조회, T12 공유 Notion 속성 코덱과 전송 한도를 재사용한다. 농장 값은 기존 `origin` 필드와 Notion `원산지·농장` 공유 속성에 저장한다. 도메인 원본·코덱 스키마는 변경하지 않았다.

## TDD 및 영향 범위 검증

- 동작 부재 RED: [초기 실패 로그](initial-red.txt). 명령 모듈과 transport preflight export가 없어서 두 테스트 모듈이 import 단계에서 실패했다.
- 수정 후 GREEN: `node --test test/pwa-commands.test.mjs test/pwa-notion-client.test.mjs test/pwa-submission-state.test.mjs test/pwa-read-repository.test.mjs test/pwa-domain.test.mjs` 종료 0, **152개 통과·실패/건너뜀 0**. [전체 TAP 로그](affected-green.txt).
- T15 실제 저장소를 연결해 기록 스냅샷 재조회, 원본 변경 전후 스냅샷 보존·최신 snapshot 선택, 부분 레시피 제외를 검증했다. T14 실제 상태 모듈을 사용해 lock, processing journal, rejected/unknown 구분과 취소 상태를 확인했다.
- 전체 `npm test` 시도는 종료 1이었다. 13개 기존 HTTP 테스트가 sandbox `listen EPERM`으로 실패했고, 다른 worker가 작성 중인 `test/pwa-lifecycle.test.mjs`가 아직 없는 `pwa/platform/app-lifecycle.mjs`를 가져와 1건 실패했다. 당시 TAP은 269개 중 255개 통과·14개 실패였다. [로그](npm-test-integration.txt). 이 실패들을 통과로 간주하지 않는다.

## 부모 통합 경계

정적 배포 빌드·검사기·SW의 허용 목록에는 현재 `commands/index.mjs`가 없다. 부모 소유 통합 변경에서 `scripts/build-pages.mjs`, `scripts/check-pages.mjs`, `pwa/sw.js`, `test/pwa-build.test.mjs`에 `commands/index.mjs` 공급·캐시·검사 항목을 반영해야 한다. 이 worker는 지정된 파일 소유 범위에 따라 해당 파일을 수정하지 않았다.
