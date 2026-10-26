# 홈 및 추출 흐름 구현 증거

## 작업 범위

기능 브랜치 `codex/home-brew-flow`에서 홈 기본 화면과 추출 시작 플로우를 구현했다. 홈은 전체 데이터를 조회하지 않으며 화면별 저장소 API를 사용한다. 원두·레시피 선택, URL 복원, 추출 안내, 기존 기록 작성 폼의 자동입력까지 연결했다.

## TDD 및 필수 검증

- RED: `node --test test/pwa-ui.view.test.mjs test/pwa-screen-loading.test.mjs` — 94개 중 87 통과, 7 실패. 로그 `red-focused.log`, 종료 코드 `red-focused-status.txt`.
- RED: `node --test test/pwa-read-repository.test.mjs` — 61개 중 60 통과, 1 실패. 로그 `red-recipe-search.log`, 종료 코드 `red-recipe-search-status.txt`.
- GREEN: 집중 UI·로딩·저장소 테스트 — 155 통과, 실패 0. `green-focused.log`.
- GREEN: 뒤로가기·경로 상태 상호작용 테스트 — 95 통과, 실패 0. `green-flow-interaction.log`.
- 전체: `npm test` — 545 통과, 실패 0, 취소 0. `npm-test.log`, `npm-test-status.txt`.
- Pages: `npm run build:pages` 성공, 산출물 버전 `cede81a6d1b3`. `build-pages.log`, `build-pages-status.txt`.
- Pages 검사: `npm run check:pages` 성공. `check-pages.log`, `check-pages-status.txt`.
- `git diff --check` 통과.

첫 전체 테스트 실행에서는 기존 테스트 헬퍼들이 `/beans` 전제를 생략해 새 기본 `/home`과 어긋나는 실패가 있었다. 테스트를 약화하지 않고 원두 화면을 전제로 하는 하네스에 `/beans`를 명시한 후 전체 545개 테스트가 통과했다.

## 브라우저 범위

fake Notion 모바일·desktop 브라우저 흐름을 확인하려 했으나 자동화 환경에서 Mac이 잠겨 있고 브라우저 인벤토리가 없어 실행하지 못했다. 상세 상태는 `browser-check.md`에 기록했다.

## Critic 인계

구현 및 테스트 변경의 독립 검토가 남아 있다. 이 Worker는 커밋·merge·push·게시를 수행하지 않았다. Orchestrator가 Critic 검토 후 통합 절차를 진행한다.
