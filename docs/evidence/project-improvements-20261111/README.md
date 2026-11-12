# 2026-11-11 프로젝트 개선 검증 기록

실행 날짜: 2026-11-12 (Asia/Seoul)
브랜치: `codex/project-improvements`
범위: PR/main 검증 전용 workflow, 브라우저 회귀 승격, 복구 안내 UI 추출, PWA 사용·상태 문서 정리.

## 기능 개선 검증 (origin/main 통합 전)

| 명령 | 결과 |
| --- | --- |
| `npm test` | 종료 0, 791/791 통과. 브라우저 실행기는 Node 테스트 자동 수집 밖에 있음 |
| `npm run build:pages` | 종료 0, 로컬 산출물 ID `e90b853a89e4` |
| `npm run check:pages` | 종료 0, Pages 산출물 검사 통과 |
| `CHROME_EXECUTABLE='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' npm run test:browser` | 종료 0, Chromium 23개 시나리오 통과 |
| `node --test test/verification-workflow.test.mjs` | 종료 0, 3/3 통과 |

최종 명령 로그는 [npm-test.txt](npm-test.txt), [build-pages.txt](build-pages.txt), [check-pages.txt](check-pages.txt), [browser-test.txt](browser-test.txt)에 있다. 구조화된 브라우저 결과는 [browser-results.json](browser-results.json), 모바일 원두·레시피 폼 화면은 [browser-screenshots](browser-screenshots/)에 보관한다.

브라우저 검증은 앱의 실제 View/Controller와 메모리 기반 저장소, fake Notion 응답을 사용한다. 390px·1280px 화면, 두 폼 모달의 입력·포커스 유지, 취소 무저장, 초안 새로고침 복원·취소 삭제, 진행 중 중복 제출 차단을 확인했다. 실제 Notion 계정·iPhone·서비스워커 수명주기는 이 실행 범위에 포함되지 않는다.

## 실패 원인과 복구

| 관찰 | 원인 | 복구와 재검증 |
| --- | --- | --- |
| 복구 화면·컨트롤러의 선행 테스트가 실패 | 사용자가 보는 작업명·시각·확인 항목·안전한 원본 링크와 controller 전달값이 없었고, 오류 문구에 내부 `journal` 용어가 노출됨 | 복구 렌더 모듈을 분리하고 controller가 대상·확인된 페이지 ID·시각을 넘기도록 수정. 화면·controller 테스트 통과 |
| 허용목록 테스트에서 Pages 검사가 실패 | checker가 빌드 산출물의 모든 외부 URL을 금지했으며 복구 링크 원본을 예외로 인정하지 않음 | 복구 모듈의 고정 Notion origin 한 곳만 허용하고 다른 외부 URL은 계속 거부하도록 검사기·부정 테스트 수정. Pages 관련 테스트 30/30 통과, 최종 빌드 검사 통과 |
| 초안 새로고침 브라우저 검증에서 초안이 비어 있음 | 기존 harness가 재실행 뒤에도 성공 저장 seed를 다시 제출해 앱의 정상 저장 성공 정리가 초안을 지움 | fixture 초기값을 미리 채우고 세션 내 seed 재제출을 제거. 재실행 복원·명시 취소 정리를 포함한 최종 Chromium 실행 23/23 통과 |
| 첫 브라우저 실행기 경로 테스트 실패 | `scripts/test-browser.mjs` 이름이 Node `--test` 자동 검색 규칙에 맞아 `npm test`가 브라우저 실행기를 테스트로 실행함. 그 실행에는 설치된 시스템 Chrome 경로도 전달되지 않아 전체 테스트가 790/791로 실패 | 실행기를 `scripts/browser/run.mjs`로 이동하고 import·프로젝트 루트 경로를 조정. package 경로 회귀 테스트 추가. 최종 `npm test` 791/791 및 브라우저 23/23 통과 |
| 레시피 수정 복구 링크와 시각 라벨 추가 테스트가 실패 | 수정 대상 ID는 저장 작업의 `editTarget.recipeId`에 있었지만 화면 전달 대상에 포함되지 않았고, `updatedAt`의 의미가 작업 시각으로만 표시됨 | controller 대상 ID 전달에 레시피 ID를 포함하고 라벨을 마지막 변경 시각으로 고침. 추가 회귀 2/2, 최종 전체 테스트 791/791 및 브라우저 23/23 통과 |
| 실행기 이동 직후 브라우저 명령이 `ERR_MODULE_NOT_FOUND`로 종료 | 이전 파일 위치 기준 상대 경로가 남아 있었음 | server/verify import와 프로젝트 루트를 새 위치 기준으로 고침. 최종 브라우저 명령 통과 |
| 실행기 이동 전 서버 경로 검사에서 403 | 경로 끝의 `/`가 fixture root와 일치하지 않았음 | server가 root 경로를 정규화하도록 수정. canonical runner에서 정상 fixture 제공을 확인 |
| 실행기 경로 회귀 테스트가 수정 전 실패 | 새 테스트가 아직 존재하던 `scripts/test-browser.mjs`를 명시적으로 거부함 | 경로를 고친 뒤 `node --test test/verification-workflow.test.mjs` 3/3 통과 |

## 최신 main 통합 후 최종 검증 (2026-11-12)

| 명령 | 결과 |
| --- | --- |
| `node --test --test-name-pattern='changing targets retires|hidden drafts stay with|reloaded meaningful drafts restore|draft edit markers roundtrip' test/pwa-ui.view.test.mjs test/pwa-form-drafts.test.mjs` | 종료 0, 회귀 4/4 통과 |
| `npm test` | 종료 0, 801/801 통과 |
| `npm run build:pages` | 종료 0, 산출물 ID `c6f67c2ee464` |
| `npm run check:pages` | 종료 0, Pages 산출물 검사 통과 |
| `CHROME_EXECUTABLE='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' npm run test:browser` | 종료 0, Chromium 시나리오 23/23 통과 |

통합 후 실행 로그는 [integrated-npm-test.txt](integrated-npm-test.txt), [integrated-build-pages.txt](integrated-build-pages.txt), [integrated-check-pages.txt](integrated-check-pages.txt), [integrated-browser-test.txt](integrated-browser-test.txt)에 있다. Critic 회귀의 수정 전 결과는 [critic-regressions-red.txt](failures/critic-regressions-red.txt)에 보존했다.

Critic P1 재현에서는 다른 연결 대상으로 바꿔도 이전 입력 모달이 열린 채 남았다. 회귀 수정은 기존 scope에 입력을 저장한 뒤 이전 모달과 폼 DOM을 즉시 분리하고, 새 대상의 빈 폼이 그 초안을 저장하지 않는지 확인한다. P2 재현에서는 대상 A의 dirty 상태가 B에 남았고, 새 화면으로 복원한 원두·레시피 수정 초안은 dirty로 표시되지 않았다. 수정은 편집 표시를 초안에 보존하고, 복원 초안의 실제 변경 여부를 확인해 연결 교체·해제 때 폼 dirty 키를 다시 맞춘다. 복원된 레시피 수정 초안이 업데이트 동결을 막고 취소 확인을 띄우는 것도 검증했다.

첫 통합 빌드는 샌드박스가 worktree의 `dist/app.mjs` 삭제를 막아 `EPERM`으로 끝났다. [실패와 복구 기록](failures/pages-build-sandbox-first-attempt.txt)에 원인과 종료 결과를 남겼다. 코드 변경 없이 승인 검토 권한으로 같은 빌드 명령을 다시 실행해 산출물 ID `c6f67c2ee464`를 만들었고 Pages 검사를 통과했다.

선행 실패 원문은 [`failures/`](failures/)에 보관했다. 최종 전체 테스트가 통과하기 전에 실패한 실행을 성공으로 간주하지 않는다.

## Critic P2 brew 복원 수정 (2026-11-12)

Critic 재검토에서 `/brew/run` 분기가 공통 초안 복원 전에 반환하는 문제를 확인했다. 분기 안에서 복원을 실행하고, 저장된 route와 원두·레시피·기록 원본 ID가 현재 흐름과 일치할 때만 적용하도록 했다. 수정 전 Node 회귀는 기본 `V60`이 남아 실패했고, 수정 후 이름과 75g 단계·275g 합계가 복원되며 dirty 상태가 업데이트 동결을 막는다. 취소하면 저장 초안도 삭제된다.

최종 검증 결과:

| 명령 | 결과 |
| --- | --- |
| `node --test --test-name-pattern='same brew route restores persisted conditions and stages after a fresh controller' test/pwa-ui.view.test.mjs` | 1/1 통과 |
| `npm test` | 802/802 통과 |
| `npm run build:pages` | 통과, 산출물 ID `5627dbe9659f` |
| `npm run check:pages` | 통과 |
| `CHROME_EXECUTABLE='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' npm run test:browser` | Chromium 24개 시나리오 통과 |

초점 테스트는 [`critic-brew-node-final.txt`](critic-brew-node-final.txt), 전체 명령 로그는 [`critic-final-npm-test.txt`](critic-final-npm-test.txt), [`critic-final-build-pages.txt`](critic-final-build-pages.txt), [`critic-final-check-pages.txt`](critic-final-check-pages.txt), [`critic-final-browser-test.txt`](critic-final-browser-test.txt)에 있다. 실제 Chromium 결과는 [`critic-final-browser-results.json`](critic-final-browser-results.json)에 보관했다. 이 시나리오는 브라우저 OPFS의 저장값을 확인한 뒤 test store의 pending writes를 flush하고 reload해 새 controller의 복원을 검증한다. flush 없이 실행한 초기 시도는 입력 직후 저장 큐가 끝나기 전에 reload해 이전 스냅샷을 읽었으며 [`failures/critic-brew-browser-before-flush.txt`](failures/critic-brew-browser-before-flush.txt)에 보존했다. 수정 전 Node 실패는 [`failures/critic-brew-restore-red.txt`](failures/critic-brew-restore-red.txt)에 있다.

추가 Critic 재검토를 위해 변경을 커밋하며, 이 worktree에서는 push·Pages 게시를 실행하지 않았다. 원본 `/Users/kangseokgyu/workspace/AX-1day/pwa/styles.css`의 사용자 변경은 수정·스테이징하지 않았다. 전체 상세는 [`critic-rereview.md`](critic-rereview.md)에 갱신했다.

## 이력 보존과 게시 상태

정규 브라우저 실행 코드는 `scripts/browser/`에 별도로 두었다. `docs/evidence/ui-refactor-browser-20261106/`의 원본 harness·결과는 수정하지 않았다. 과거의 21/22개 비교 결과는 해당 날짜의 증거로 남고 이번 23개 회귀 실행과 구분된다.

검증 workflow는 `pull_request`와 `main` push에서 `npm ci`, `npm test`, Pages build/check, Chromium 회귀를 수행하고 Pages 권한·배포 동작을 갖지 않는다. 기존 `.github/workflows/pages.yml`은 계속 수동 실행이다. 이 worktree에는 `origin/main` `a443f37`을 merge commit `a5b2128`로 통합했다. 충돌 난 `docs/pwa-usage.md`에는 main의 단계 입력 안내와 기존 레시피 수정·삭제 동작 설명을 함께 반영했다. 원격 main의 PWA CSS 변경도 통합했다. 원본 `/Users/kangseokgyu/workspace/AX-1day/pwa/styles.css`는 이 작업에서 수정하지 않았고, 완료 시점에도 사용자 수정 상태(`M`)로 남아 있음을 확인했다. Critic 원문 보고서는 [critic-review.md](critic-review.md)로 보존했다. 원격 main push와 Pages 게시는 메인이 별도 원격 변경을 확인한 뒤 진행하며, 이 실행에서는 원격 CI와 공개 Pages 반영을 확인하지 않았다. 빌드 ID `c6f67c2ee464`는 통합 후 로컬 산출물만 가리킨다.
