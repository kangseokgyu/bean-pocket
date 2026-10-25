# 레시피 추출 가이드 — 2026-10-25

## Notion schema 변경

메인 에이전트가 이 세션 도구로 테스트·운영 recipe 데이터 소스에 공식 REST API `PATCH /v1/data_sources/{id}`와 `properties: { "추출 가이드": { "rich_text": {} } }`를 적용했다. 두 곳 모두 PATCH HTTP 200 뒤 GET 재조회 HTTP 200을 확인했고, 각 데이터 소스가 14개에서 15개 속성으로 늘었으며 기존 14개 속성 전체가 `deepEqual`로 보존된 것을 직접 검증했다. 기존 recipe page 내용과 값은 수정하지 않았다.

연결 connector는 `ADD COLUMN`과 `ALTER TABLE` 두 형식을 모두 `INVALID_ARGUMENT`로 거부했다. 공식 REST API로 변경을 완료했다. 개인 ID, 기존 페이지·레시피 값, 자격정보는 이 증거에 넣지 않았다. 상세한 공개 안내는 [Notion 데이터베이스 구성](../../notion-database-setup.md)에 있다.

공식 참고: [Update a data source](https://developers.notion.com/reference/update-a-data-source).

## 코드 검증

테스트 우선 RED, 구현 후 전체 GREEN, Pages 빌드·검사와 실제 Chromium 결과를 보관한다. 최종 명령과 종료 코드는 각 로그 끝에 기록했다.

- `red-focused.tap` — 구현 전 domain/codec/schema/UI 회귀 테스트. 의도한 실패가 기록돼 있다.
- `critic-copy-source-red.tap` — 복사 준비 후 원본 가이드만 바꿨을 때 준비된 복사가 성공하는 결함을 재현한 RED. 종료 코드 1은 의도한 실패다.
- `focused-green.tap` — 복사 command와 추출 가이드 테스트: 35 통과, 0 실패, 종료 코드 0. 누락 필드와 빈 문자열 간 복사도 호환된다.
- `focused-diagnostic-failure.tap` — HTTP fixture가 새 `recipes.추출 가이드` 속성을 선언하지 않아 POST가 400이 된 원인 분석 기록. 연관 테스트가 단계 시작 promise를 기다리던 중 정리 경로에 도달하지 않아, 진단 프로세스만 SIGINT로 종료했다(exit 130). 서버 종료 hook의 대기가 원인은 아니었다. fixture에 현재 `rich_text` schema를 반영하고 promise 대기를 `try/finally` 안에서 보장했다.
- `npm-test-green.tap` — 전체 `npm test`: 464 통과, 0 실패, 종료 코드 0.
- `build-pages.txt` — `npm run build:pages`와 생성 빌드 버전.
- `check-pages.txt` — `npm run check:pages` 결과.
- `browser-check.cjs`, `browser-check.log`, `browser-results.json`, `recipe-guide-320.png`, `recipe-guide-390.png`, `recipe-guide-1440.png`, `recipe-guide-form-*.png` — Chromium 320/390/1440px에서 표 아래·기록 위 표시, 페이지 가로 넘침 없음, 복사 보존, 여러 줄 입력과 접근 가능한 textarea 이름을 확인했다. 이번 변경은 command fingerprint와 문서만 수정해 UI 변경이 없으므로 기존 스크린샷을 유지했다. 브라우저 오류도 없었다.
- `browser-diagnostic-failure.log` — 초기 검사에서 `HTMLElement.labels` 직접 참조가 불안정하게 비어 반환된 기록. nested label 및 Playwright 접근성 이름 검증으로 바꿔 최종 Chromium 검사를 통과했다.

최신 빌드 버전은 `f0551ec1495f`이다. 브라우저 스크립트 실행 시 Playwright 모듈·Chromium 실행 파일 경로는 `RECIPE_GUIDE_PLAYWRIGHT_MODULE`, `RECIPE_GUIDE_CHROMIUM_EXECUTABLE` 환경 변수로 제공하며 경로 값은 로그에 남기지 않는다. 브라우저 fixture에는 합성 레시피만 사용한다. 원격 Notion 자격정보·개인 데이터는 브라우저 증거에 포함하지 않는다.
