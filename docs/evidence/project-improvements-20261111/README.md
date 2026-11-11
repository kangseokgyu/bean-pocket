# 2026-11-11 프로젝트 개선 검증 기록

실행 날짜: 2026-11-12 (Asia/Seoul)
브랜치: `codex/project-improvements`
범위: PR/main 검증 전용 workflow, 브라우저 회귀 승격, 복구 안내 UI 추출, PWA 사용·상태 문서 정리.

## 최종 검증

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

선행 실패 원문은 [`failures/`](failures/)에 보관했다. 최종 전체 테스트가 통과하기 전에 실패한 실행을 성공으로 간주하지 않는다.

## 이력 보존과 게시 상태

정규 브라우저 실행 코드는 `scripts/browser/`에 별도로 두었다. `docs/evidence/ui-refactor-browser-20261106/`의 원본 harness·결과는 수정하지 않았다. 과거의 21/22개 비교 결과는 해당 날짜의 증거로 남고 이번 23개 회귀 실행과 구분된다.

검증 workflow는 `pull_request`와 `main` push에서 `npm ci`, `npm test`, Pages build/check, Chromium 회귀를 수행하고 Pages 권한·배포 동작을 갖지 않는다. 기존 `.github/workflows/pages.yml`은 계속 수동 실행이다. 이 worktree에서는 merge·push·게시하지 않았으므로 원격 CI 실행과 공개 Pages 반영은 검증하지 않았다. 빌드 ID `e90b853a89e4`는 로컬 후보만 가리킨다.
