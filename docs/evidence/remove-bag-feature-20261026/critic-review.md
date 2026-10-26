# Critic 독립 리뷰 — 수정 필요

- 검토 대상: main `6510d5c` → `53d0769615fbe9859eabc796ea65b9b93003a7b6`, `codex/remove-bag-feature`.
- 역할 critic. 요청에서 생성 설정 `gpt-6.1-sol/low`를 전달받았다. 이 채팅에서는 생성 도구/모델 설정을 조회하거나 변경하지 않았으며 추가 에이전트를 만들지 않았다.
- 제품 소스·테스트 수정, commit/merge/push/deploy 및 실제 Notion 접근 없음. `critic-*` 증거만 추가.

## Required findings

### [P2] 기존 서버 연결 화면의 5DB 안내를 4DB로 정정

- 위치: `public/app.js:186`, `public/app.js:198`.
- 재현: 기존 Node/public 화면에서 Notion 연결 설정을 열면 “하위 5개 데이터베이스”가 나오며 연결 성공 시 “5개 노션 데이터베이스 접근을 확인했습니다.”라고 표시한다.
- 실제 어댑터는 이번 변경으로 네 소스만 검증한다. 사용자는 제거된 봉지 DB가 여전히 필요하다고 오해하고, 성공 알림은 검증하지 않은 다섯 번째 DB를 검증했다고 주장한다.
- 수정 제안: 두 안내를 4개로 정정하고 해당 화면/문구를 집중 검증한다.

### [P2] 현재 용어집의 봉지 연결·삭제 보호 계약을 정정

- 위치: `GLOSSARY.md:15`.
- 현재 설명은 “호환을 위해 bags를 포함한 다섯 데이터 소스 연결이 계속 필요”, “과거 봉지와 그 관계는 삭제 보호에 사용”이라고 명시한다.
- README가 현재 용어 정의로 링크하는 문서이며 과거 evidence로 표시된 이력이 아니다. 4DB만 필요하고 봉지는 조회·추론·삭제 의존에 사용하지 않는 이번 요구/구현과 정반대다.
- 수정 제안: 봉지는 폐기된 개념이고 기존 원격 행·속성은 그대로 두되 연결·조회·추론에는 사용하지 않으며, 봉지만으로 원두 근거가 있던 기록은 unresolved로 삭제를 막는다고 정정한다.

## Optional coverage note

- `test/pwa-notion-client.test.mjs:96`은 잘못된 relation 대상 검증 반복을 `Object.keys(RELATIONS)`에서 `['steps','records']`로 좁혀 bags 외에 recipes도 제외했다. recipes의 legacy bean relation은 여전히 존재하며 제공된 경우 client.verify가 타입·대상을 검증한다. 기존 recipes 사례를 복원하는 것이 좋다. 제품의 해당 검사 자체는 유지되어 있어 확인된 기능 오류는 아니다.
- 나머지 테스트 변경에서 기록 직접/snapshot/legacy-recipe 참조, 숨겨진 기록, 다중·truncated 관계, 제외 기록, fresh-read 실패, journal unknown/partial/lock/복구 보호를 제거한 변경은 찾지 못했다. bag 전용 기대값 변경은 명시 요구와 일치한다.
- SPEC/PLAN은 맨 위 현재 계약과 폐기 설명을 통해 과거 봉지 요구를 명시적으로 대체하고 있다. 역사적 문장을 현재 기능으로 해석하지 않았다.

## 독립 브라우저 실행

- 명령: `node /private/tmp/critic-browser.cjs` (보관본 `critic-browser-check.cjs`). 최종 종료 코드 0.
- 설치 Google Chrome, bundled Playwright, headless 독립 임시 프로필, localhost만 허용. 모든 외부 브라우저 요청은 차단하고 목록을 검증했다.
- 제품의 실제 view/controller/commands/NotionClient/read-repository/submission-state를 사용했다. `memoryPlatform`이 OPFS/native locks/파일 선택·설치 환경을 대신하며 `fakePwaNotion`이 모든 Notion 요청을 메모리 응답으로 대신한다. 실제 credential 및 실제 Notion 쓰기 없음.
- 390/1280px 각각: token+4개 source 입력, 연결 검증·저장, 신규 원두 두 개, 신규 독립 recipe와 step, 원두/recipe 선택 기록 생성, `bagless-v1` snapshot, 삭제 confirm 취소 시 PATCH 없음, 기록 있는 원두 삭제 차단 시 PATCH 없음, 기록 없는 원두 삭제 시 정확히 1 PATCH 및 최신 목록 반영 확인.
- 두 viewport 모두 source 4개만 사용, 화면 봉지 텍스트 없음, 페이지 수평 overflow 없음, console error/warning 0, pageerror 0, 외부 요청 0.
- 결과: `critic-browser-results.json`. 스크린샷: `critic-connection-{390,1280}.png`, `critic-beans-{390,1280}.png`. 390 연결 및 1280 목록 이미지를 직접 열어 레이아웃 확인.
- 실행 실패 이력: 최초 sandbox localhost listen EPERM → 승인된 격리 브라우저 실행으로 재시도. 이후 harness가 rating number input에 selectOption을 사용해 실패 → harness만 fill로 수정 후 정상 완료. 제품 오류가 아니다.

## 기존 실행 증거 검토

- `verification.md` 및 RED/GREEN, focused, 최종 전체 TAP, build/check 로그를 대조했다. 인계 문서가 말하는 최종 성공 로그는 실제 `npm-test-green.tap`: 508/508, fail/skip 0. `npm-test-final.tap`은 507 pass/1 fail의 중간 결과이며 이를 최종 성공으로 해석하지 않았다.
- `build-pages.log`: `b56bc1934364`. `check-pages.log`: 산출물 검사 통과. 전체 테스트/빌드는 변경 없이 반복하지 않았다.
- 제거 경로: 환경변수/설정 소스 4개, bags schema/record.bagId/봉지 relation codec 제거, 서버/PWA 조회·원두 추론 제거. 구형 입력은 전송 전에 거절, 원격 schema/행 수정이나 마이그레이션 경로 추가 없음.
- 원두 삭제는 현재/숨겨진 raw record의 beanId/beanCandidates/needs-confirmation 및 제외 record를 확인한다. 봉지 전용 원두 근거 기록은 reader에서 needs-confirmation으로 남는다. legacy bag journal은 최소 판독으로 차단 상태를 유지하고 자동전송 경로가 없다.

## 판정 및 한계

**수정 필요:** 위 두 P2 문구·문서 불일치 수정 후 Critic 재검토. 핵심 봉지 제거 및 기록 보호 구현에서 추가 기능 차단 이슈는 발견하지 못했다.

이번 브라우저 검증은 일반 생성·삭제 흐름 범위다. unknown/partial 복구·중복 제출·숨겨진 과거 기록의 브라우저 상호작용은 별도 재현하지 않았으며 기존 자동 테스트와 코드 검토로 확인했다. 실제 iPhone/Safari·설치/삭제/재설치·native OPFS/locks·파일 picker·실제 Notion 권한/쓰기·배포/공개 반영은 검증하지 않았다. 제품 소스 변경이 생기면 영향받는 검증을 Worker가 실행하고 재검토해야 한다.
