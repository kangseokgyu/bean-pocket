# Node 서버 제거 — 2026-11-06

검증 기준: `codex/remove-node-server`, 기준 커밋 `ae0ccf7`, Node.js `v24.22.1`. 이 기록은 해당 후보의 로컬 검증이며 최신 main 통합·게시 결과는 별도다.

## 변경 범위

- `server.mjs`, `lib/notion.mjs`, 기존 `public/` 앱, `.env.example`, `npm start`와 서버 전용 테스트를 제거했다.
- 혼합 테스트에서는 서버/public 전용 사례만 제거하고 PWA 사례를 유지했다. 속성 코덱 검증은 `pwa/data/notion-properties.mjs`를 직접 검사한다.
- `lib/domain.mjs`, `pwa/`, Pages 빌드·검사·preview·마이그레이션 도구는 유지했다. `test/fixtures/notion-config.mjs`는 PWA fixture가 사용하므로 유지한다.
- README·스펙·연결·검증 안내를 정적 PWA 구조에 맞췄다. 삭제한 서버 설명 HTML의 활성 문서 링크는 제거·대체했다. 과거 계획·보안·증거 기록은 해당 날짜의 이력으로 구분했다.

## 검증 결과

| 명령 | 결과 |
|---|---|
| `npm test` | exit 0, 730/730 통과, fail/cancelled/skipped/todo 0, 111904.901852 ms |
| `npm run build:pages` | exit 0, 빌드 `08f4208dfe64` |
| `npm run check:pages` | exit 0, Pages 산출물 검사 통과 |
| `git diff --check` | exit 0 |

소스 참조 검사에서 `test/`, `scripts/`, `pwa/`, `.github/`와 `run-preview.sh`에 삭제한 제품 서버·public 앱 참조가 없음을 확인했다. 증거 폴더를 제외한 문서에서 삭제한 `app-flow.html`·`current-editing-overview.html` 참조가 없다.

첫 테스트 실행은 PWA 공용 fixture를 서버 전용으로 잘못 분류해 삭제한 탓에 8개 모듈 로딩 실패로 끝났다. 공용 fixture를 원본 그대로 복원한 후 전체 테스트를 다시 실행했다.

실제 Notion 요청·쓰기, 실제 iPhone, 공개 배포는 이 후보 검증에서 실행하지 않았다. 모의 테스트와 정적 산출물 검사는 해당 범위의 확인을 대신하지 않는다.

## 독립 검토

Critic (`gpt-6.1-sol` / `medium`)은 삭제 범위, 코덱 테스트 이전, 활성 import·문서 참조를 검토했고 차단 사항 없이 승인했다. Python Playwright와 시스템 Chromium으로 기존 일반판 산출물을 `/bean-pocket/`에서 제공해 390×844 화면을 확인했다. 빌드 `08f4208dfe64`의 설정 화면·도메인 모듈·서비스 워커 scope가 정상이며 92개 응답에 HTTP 오류, JavaScript 오류, `/api/`·외부 요청이 없었다. 실제 Notion 쓰기와 iPhone 검증은 포함하지 않았다.
