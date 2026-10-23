# 검증 결과

기준: `5f0b582`; 브랜치: `codex/delete-bags-recipes-records`.

| 단계 | 명령 / 절차 | 결과 |
| --- | --- | --- |
| RED | `node --test test/pwa-entity-delete.test.mjs test/pwa-notion-client.test.mjs test/pwa-ui.view.test.mjs` | 종료 코드 1, 99개 중 90 통과·9 실패. 구현 부재에 대한 의도된 실패이며 로그는 `red-focused.tap`에 보관. |
| GREEN | `node --test test/pwa-entity-delete.test.mjs test/pwa-bean-delete.test.mjs test/pwa-notion-client.test.mjs test/pwa-submission-state.test.mjs test/pwa-ui.view.test.mjs` | 종료 코드 0, 156/156 통과. 로그는 `green-focused.tap`에 보관. |
| 전체 테스트 | `npm test` | 종료 코드 0, 448/448 통과. |
| Pages 빌드 | `npm run build:pages` | 종료 코드 0, 산출물 버전 `a9ce59c9a438`. |
| Pages 검사 | `npm run check:pages` | 종료 코드 0, Pages 산출물 검사 통과. |
| 패치 검사 | `git diff --check` | 종료 코드 0. |

브라우저 자동화는 상호작용 테스트까지 수행하지 않았다. 임시 fake-only 서버(`127.0.0.1:4199`)로 이 워크트리의 앱 모듈과 인메모리 `fakePwaNotion` fixture를 제공했고, Codex in-app browser에서 합성 원두 카드가 표시되는 것까지 확인했다. Chrome DevTools MCP는 현재 사용할 수 없고 Playwright가 반환한 Chromium 경로(`/Users/kangseokgyu/Library/Caches/ms-playwright/chromium-1234/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`)에는 실행 파일이 없었다. 사용자의 Critic 우선 반환 요청에 따라 삭제·차단·재조회 브라우저 시나리오는 실행하지 않고 미검증으로 인계한다. 이 브라우저 세션에서 실제 Notion 연결이나 데이터 삭제는 없었다.

## 실행 범위 요약

집중 회귀 테스트는 기존 원두 삭제를 포함해 기록 사용 중인 봉지·레시피 차단, 제외·불완전 관계 fail-closed, Notion 데이터 소스 일치 확인, 삭제 journal 및 응답 유실 복구, 레시피 부모만 휴지통 이동·단계 보존, 기록 삭제 후 평점 재집계와 초안 보존, 카드별 이름 포함 확인을 검증한다.
