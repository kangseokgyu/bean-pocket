# 봉지 등록 + 버튼 — 2026-10-21

- 브랜치: `codex/bag-add-button`
- 봉지 등록 폼은 기본 숨김, 목록 상단 + 버튼으로 열림. 취소·저장 성공 시 닫힘.
- 탭 이동·목록 갱신 시 열린 상태와 입력 보존, 접근성 이름·펼침 상태, 저장 중 버튼 비활성화 검증.
- 테스트 선행: `node --test test/pwa-ui.view.test.mjs` 종료 1. 새 테스트가 기본 폼 노출 때문에 실패 (`red.tap`). 구현 후 32/32 통과.
- `npm test`: 종료 0, 382/382 통과 (`full-tests.tap`). 최초 샌드박스 실행은 로컬 HTTP listen EPERM으로 실패하여 권한을 허용한 실행으로 검증.
- `npm run build:pages`: 종료 0, 일반판 빌드 `76618d084cea`.
- `npm run check:pages`: 종료 0.
- `git diff --check`: 종료 0.
- 실제 브라우저·iPhone·Notion 저장은 미검증. DOM 기반 회귀 테스트 및 전체 자동 테스트로 확인.
- main 머지 및 Pages 게시: 변경·검증 결과 제시 후 명시적 머지 승인 대기.
