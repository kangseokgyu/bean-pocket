# 검증 결과

기준: `5f0b582`; 브랜치: `codex/delete-bags-recipes-records`.

## 최초 Worker 검증 (`048d2dd`)

| 단계 | 명령 / 절차 | 결과 |
| --- | --- | --- |
| RED | `node --test test/pwa-entity-delete.test.mjs test/pwa-notion-client.test.mjs test/pwa-ui.view.test.mjs` | 종료 코드 1, 99개 중 90 통과·9 실패. 구현 부재에 대한 의도된 실패이며 로그는 `red-focused.tap`에 보관. |
| GREEN | `node --test test/pwa-entity-delete.test.mjs test/pwa-bean-delete.test.mjs test/pwa-notion-client.test.mjs test/pwa-submission-state.test.mjs test/pwa-ui.view.test.mjs` | 종료 코드 0, 156/156 통과. 로그는 `green-focused.tap`에 보관. |
| 전체 테스트 | `npm test` | 종료 코드 0, 448/448 통과. |
| Pages 빌드 | `npm run build:pages` | 종료 코드 0, 산출물 버전 `a9ce59c9a438`. |
| Pages 검사 | `npm run check:pages` | 종료 코드 0, Pages 산출물 검사 통과. |
| 패치 검사 | `git diff --check` | 종료 코드 0. |

브라우저 자동화는 상호작용 테스트까지 수행하지 않았다. 임시 fake-only 서버(`127.0.0.1:4199`)로 이 워크트리의 앱 모듈과 인메모리 `fakePwaNotion` fixture를 제공했고, Codex in-app browser에서 합성 원두 카드가 표시되는 것까지 확인했다. Chrome DevTools MCP는 현재 사용할 수 없고 Playwright가 반환한 Chromium 경로(`/Users/kangseokgyu/Library/Caches/ms-playwright/chromium-1234/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`)에는 실행 파일이 없었다. Orchestrator의 Critic 우선 반환 요청에 따라 삭제·차단·재조회 브라우저 시나리오는 실행하지 않고 미검증으로 인계한다. 이 브라우저 세션에서 실제 Notion 연결이나 데이터 삭제는 없었다.

## 실행 범위 요약

집중 회귀 테스트는 기존 원두 삭제를 포함해 기록 사용 중인 봉지·레시피 차단, 제외·불완전 관계 fail-closed, Notion 데이터 소스 일치 확인, 삭제 journal 및 응답 유실 복구, 레시피 부모만 휴지통 이동·단계 보존, 기록 삭제 후 평점 재집계와 초안 보존, 카드별 이름 포함 확인을 검증한다.

## 독립 Critic 검증 (`048d2dd`)

`critic/report.md`의 독립 검토 결론은 APPROVE이며 blocker는 없다. 안전성 실험 12/12와 설치된 Google Chrome의 fake-only 브라우저 흐름이 통과했다. 1280/390px 긴 이름 및 320px 짧은 이름에서 확인·취소·사용 중 삭제 차단·기록 삭제 후 평가/선택지 갱신·초안 보존·부모 레시피만 삭제·세 유형 응답 유실 복구를 검증했다. 세 JSON, safety TAP, 390px PNG와 공개 전 검사/해시 기록을 `critic/`에 선별 보관했다. 이 근거는 조사 오타 수정 전 커밋에 대한 결과다.

실행 환경은 headless 설치 Chrome의 새 context이며 Service Worker 차단, localhost 밖 요청 abort, fake Notion 및 메모리 파일/lock adapter를 사용했다. 실제 Notion·OPFS 디스크·native lock crash recovery·iPhone/Safari·Pages 공개 반영 검증으로 해석하지 않는다.

기존 한계: 320px 긴 원두·레시피명은 기록 필터 select의 intrinsic 폭 때문에 기준 main과 기능 구현 양쪽 모두 `scrollWidth=360`, `innerWidth=320`, 필터/목록 폭 338px였다. 이때 기록 휴지통 일부가 화면 오른쪽 밖에 놓인다. 390px 긴 이름과 320px 짧은 이름은 통과했다. 이번 변경에서는 기존 레이아웃을 수정하지 않았다.

## P3 문구 마무리 후 최종 Worker 검증

제품 변경은 `pwa/ui/view.mjs`의 조사 없는 안내/선택지 세 문장뿐이다. 기능과 320px 레이아웃은 바꾸지 않았다. 아래 네 명령은 문구 변경 뒤 각각 한 차례 실행했으며 모두 exit 0이다. 정확한 명령·UTC 실행 시각·종료 코드는 `final-commands.json`, 원본 combined stdout/stderr는 각 로그에 보관했다.

| 명령 | 결과 | raw log |
| --- | --- | --- |
| `node --test test/pwa-ui.view.test.mjs` | 49/49 통과 | `final-ui-focused.log` |
| `npm test` | 448/448 통과 | `final-npm-test.log` |
| `npm run build:pages` | 빌드 `45fc966c78bd` | `final-build-pages.log` |
| `npm run check:pages` | Pages 산출물 검사 통과 | `final-check-pages.log` |

선별 Critic 근거와 최종 로그는 credential/Bearer/GitHub token/private-key/email 서명 검사에서 검출되지 않았다. 이미지 세 장은 직접 시각 확인했고 텍스트/EXIF PNG 메타데이터가 없다. 문구 수정 후 브라우저를 다시 실행했다고 주장하지 않으며 UI 집중 테스트와 전체 테스트로 검증했다. 작은 후속 diff의 독립 Critic 재검토, main 통합·push·배포는 Orchestrator 범위다.
