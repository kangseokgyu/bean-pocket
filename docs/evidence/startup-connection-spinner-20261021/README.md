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

## main 통합 검증

병합 커밋 `f8eba4d44318c957ce6c5d66e3f57e981573745f`에서 `npm test`(391개 통과), `npm run build:pages`, `npm run check:pages`를 실제 실행했고 모두 종료 0이었다. 통합 빌드도 `91a96fba0bef`다. 근거: main-tests.tap, main-build.txt, main-check.txt.

## 최종 회전 표시 보완

최종 표시 리뷰에서 동일 밝기의 12개 살은 30도 단위 회전 시 모양이 동일하게 보일 수 있음을 확인했다. 기존 당겨서 새로고침의 재로딩 상태와 같은 1/12~1의 불투명도를 초기 스피너에도 적용했다. 선행 테스트는 불투명도 부재로 종료 1로 실패했다(shades-red.tap). 첫 구현의 style.opacity 대입은 과거 증거의 DOM 대역에 style 객체가 없어 전체 테스트 3개가 실패했다(shades-dom-attempt.tap). 기존 생성 방식대로 style 속성에 불투명도를 함께 지정해 해결했으며 테스트 대역이나 기존 테스트는 변경하지 않았다.

보완 후 `npm test` 391개 모두 통과(종료 0), 일반판 빌드·검사 통과(각 종료 0), 최종 버전 `dc029f248d43`. 근거: final-feature-tests.tap, final-feature-build.txt, final-feature-check.txt. 브라우저에서 12개 살의 서로 다른 불투명도와 애니메이션 0ms/80ms 프레임의 픽셀 차이를 확인했고, 기존 반응형·모션 감소·5개 결과 전환도 재검증했다(browser-results.json). 밝기 외에 스피너 모양이나 기존 제스처 동작 변경은 없으며 변경분 재리뷰에서 병합 차단 사항은 없었다.

첫 게시 실행 39615175976은 성공했으며 `91a96fba0bef`를 게시했다. 아래 최종 게시 기록의 `dc029f248d43`이 최종 검증 대상이다.
