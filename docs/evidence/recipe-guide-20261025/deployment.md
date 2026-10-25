# 추출 가이드 게시 결과 — 2026-10-25

- 기능 커밋 `ad7c4c4`, 독립 리뷰 수정 커밋 `52d700ea204197eaa44a01be1439752d98d35814`.
- `codex/recipe-extraction-guide`에서 최신 main 변경을 보존해 통합한 뒤, 검증된 동일 커밋으로 main을 fast-forward하고 push했다. 기존 미커밋 변경은 없었으며 다른 변경을 되돌리지 않았다.
- 최종 로컬 `npm test`: 종료 0, **464/464 통과**. `npm run build:pages`, `npm run check:pages`: 각각 종료 0. 로그는 같은 폴더에 보관했다.
- main 통합 후 GitHub Actions에서도 regression tests, static PWA build, artifact check가 성공한 뒤 배포했다.
- 일반판 `pages.yml`, `ref=main`, `probes=false`: [실행 40168605523](https://github.com/kangseokgyu/bean-pocket/actions/runs/40168605523), build/deploy 모두 성공.
- 공개 주소: https://kangseokgyu.github.io/bean-pocket/
- 공개 빌드: **`f0551ec1495f`**.
- `public-check.cjs` 실행 종료 0. `index.html`, `domain.mjs`, `ui/view.mjs`, `data/notion-client.mjs`, `data/notion-properties.mjs`, `commands/index.mjs`, `styles.css`, `sw.js`, `manifest.webmanifest` 모두 HTTP 200, 로컬 검증 산출물과 바이트 일치. `public.json` 참조.
- 새 Chromium 세션의 공개 페이지에서 버전 표시 일치, JavaScript 오류 없음. `public-390.png` 참조.
- 합성 데이터의 Chromium 320/390/1440px에서 표 아래·기록 위 표시, 줄바꿈, 복사 입력 유지와 가로 넘침 없음을 확인했다. 이후 복사 원본 변경 감지 수정은 UI를 변경하지 않았으므로 동일 화면 검증을 반복하지 않았다.

## 독립 검토

Worker: `gpt-6-luna`, reasoning `max`, 도구 별칭 Boole. Critic: `gpt-6.1-sol`, reasoning `medium`, 도구 별칭 Epicurus. 생성 도구에 모델·추론 설정을 명시했다. 도구는 사용자 지정 이름을 지원하지 않아 역할명을 업무상 호칭으로 사용했다.

Critic 최초 검토에서 복사 원본 fingerprint에 추출 가이드가 빠져 원본 가이드 변경을 감지하지 못하는 문제와 문서의 수행 주체 오류를 지적했다. Worker가 RED 회귀로 결함을 재현한 뒤 가이드를 비교에 포함하고, 가이드 변경 시 쓰기 0회 차단 및 과거 undefined/빈 문자열 호환을 검증했다. 문서도 정정했다. Critic 재검토는 남은 필수 이슈 없이 승인했다. `critic-copy-source-red.tap`, `focused-green.tap`, `npm-test-green.tap` 참조.

## 검증 범위

메인 에이전트가 테스트·운영 Notion 레시피 DB에 `추출 가이드` rich_text 컬럼을 직접 추가하고 PATCH/GET HTTP 200 및 기존 14개 속성 보존(총 15개)을 확인했다. 기존 레시피 페이지 내용이나 값을 바꾸지 않았다. 실제 앱 자격정보로 레시피를 새로 저장하는 원격 종단 검증은 수행하지 않았다.

실제 iPhone Safari·홈 화면 PWA의 실행, 기존 캐시 갱신·재실행은 미검증이다. 새 Chromium 공개 접속과 합성 데이터 브라우저 검증을 해당 실기기 검증으로 간주하지 않는다. 이 게시 근거 추가 커밋은 앱 빌드 입력을 바꾸지 않는다.
