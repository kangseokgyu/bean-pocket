# 게시 확인 — 2026-10-28

- 공개 주소: https://kangseokgyu.github.io/bean-pocket/
- 공개 빌드: `a0341422e675`
- 기능 커밋: `5231ba9`
- 배포 커밋: `0c9b3684c85cbc3d085ce9401ce2b369380c835d`
- 실행: https://github.com/kangseokgyu/bean-pocket/actions/runs/40627538358
- `main` / `pages.yml` / `probes=false`: success. `gh run watch 40627538358 --exit-status --interval 15` exit 0. main 통합 후 CI의 전체 회귀 테스트·일반판 빌드·산출물 검사·배포 모두 통과했다.
- 로컬: `npm test` 595/595, focused 124/124, 일반판 build/check 통과. Worker Chromium/WebKit × 390/768px 4개 조합 및 Critic native dialog 검증 각 브라우저 5개 통과. 독립 리뷰 승인. README.md, critic-review.md 참조.
- 공개 검증 명령: `node docs/evidence/tab-loading-skeleton-20261027/verify-public.mjs /Users/kangseokgyu/.codex/worktrees/toast-only-loading/AX-1day /Users/kangseokgyu/workspace/AX-1day/docs/evidence/toast-only-loading-20261028/public-files.json` exit 0. 20/20 파일 HTTP 200 및 검증 dist와 바이트 일치. 파일별 SHA-256은 public-files.json.
- Codex in-app browser에서 실제 공개 주소를 열어 초기화의 “저장된 연결 확인 중” 알림과 초기화 후 홈 화면, 공개 표시 버전 `a0341422e675`를 확인했다. 화면을 덮는 중앙 스피너는 없었다. 기존 사용자 연결이나 실제 Notion 데이터는 조작하지 않았다.
- 실제 Notion 읽기/쓰기·iPhone Safari/설치 앱·기존 클라이언트 SW 갱신·스크린 리더 음성은 미검증.
- 이번 작업 실제 에이전트 설정: Worker gpt-6-luna/max, Critic gpt-6.1-sol/medium. 순차 실행, 추가 하위 에이전트 없음.

문제 발생 시 이번 기능 변경만 별도 브랜치에서 되돌린 뒤 docs/pages-deploy.md의 검증·일반판 게시 절차를 따른다.
