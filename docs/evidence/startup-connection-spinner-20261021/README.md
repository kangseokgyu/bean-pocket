# 저장된 연결 확인 스피너 — 2026-10-21

## 변경과 완료 조건

- 기능 브랜치: `codex/startup-connection-spinner` (기준 main `a77316b`).
- 저장된 연결 초기 확인은 상태 영역에 기존 당겨서 새로고침과 같은 12개 살의 스피너만 표시한다. 화면용 긴 문구와 재시도 패널은 확인 중 숨긴다.
- 기존 `role=status`, `aria-live=polite` 영역의 시각적으로 숨긴 문구로 “저장된 연결 확인 중”을 알린다. 스피너 자체는 `aria-hidden=true`다.
- 잠금 대기 후 확인 실패 시 스피너를 종료하고 안내와 재시도 버튼을 표시한다. 연결 없음·성공·오류·복구 상태의 기존 전환을 유지한다.
- `prefers-reduced-motion: reduce`일 때 회전하지 않는다. 연결 저장·잠금·Notion 검증 로직은 변경하지 않았다.

## 검증

| 범위 | 명령/방법 | 결과 | 근거 |
| --- | --- | --- | --- |
| 선행 테스트 | `node --test --test-name-pattern='startup checking|initialization spinner ends' test/pwa-ui.view.test.mjs` | 스피너 부재로 새 테스트 6개 실패 확인 | red.tap |
| 관련 테스트 | `node --test test/pwa-ui.view.test.mjs test/pwa-ui.integration.test.mjs` | 종료 0, 46개 통과 | focused-tests.tap |
| 전체 테스트 | `npm test` | 종료 0, 391개 통과, 실패·생략 0 | feature-tests.tap |
| 일반판 빌드 | `npm run build:pages` | 종료 0, 버전 `91a96fba0bef` | feature-build.txt |
| 산출물 검사 | `npm run check:pages` | 종료 0, 통과 | feature-check.txt |
| 브라우저 | 격리 Chromium, 실제 빌드의 view/controller/CSS를 불러오는 로컬 결정적 초기화 fixture 및 실제 빌드 첫 실행 | 320·390·768·1024·1440px에서 가운데 배치, 가로 넘침 없음, 확인 중 입력·재시도 숨김, 모션 감소 시 animation=none. 성공·연결 없음·오류·복구·잠금 실패 전환 확인. 실행 오류·HTTP 오류 0 | browser-results.json, checking-mobile.png, retry-mobile.png |

Chrome DevTools MCP는 제공되지 않아 번들 Playwright와 이미 설치된 Chromium headless shell 1208을 사용했다. 기본 Playwright가 기대한 브라우저 1234가 없어 최초 실행은 시작 단계에서 실패했으며, 기존 설치 바이너리를 명시해 검증을 완료했다. 실제 Notion 자격정보는 사용하지 않았다.

## 변경분 리뷰

코드와 선행 테스트를 직접 검토했다. 초기 확인과 재시도 상태가 분리되고, 모든 initialize 결과가 상태 내용을 교체하여 스피너를 종료한다. 입력 폼은 연결 없음 확인 이후에만 열린다. 연결 교체의 기존 checking 상태 메시지는 유지한다. 기존 당겨서 새로고침 테스트도 통과했다. 외부 의존성·API·저장 포맷 변경이나 비밀값 추가는 없다. `git diff --check` 통과. 병합 차단 사항 없음. 별도 에이전트 리뷰는 수행하지 않았다.

## 미검증 범위와 복귀

- 실제 iPhone Safari·홈 화면 PWA와 실기기 스크린리더 음성 출력은 미검증이다. 실제 Notion 통신·기기 간 잠금 경합은 이번 브라우저 검증에서 수행하지 않았다(기존 통합 테스트는 포함).
- 회귀가 발견되면 이 기능 커밋만 revert하고 동일한 테스트·일반판 검사 후 main에서 pages.yml을 probes=false로 다시 실행한다.
- main 통합 검증과 게시 실행·공개 버전 확인은 후속 게시 기록에 추가한다.
