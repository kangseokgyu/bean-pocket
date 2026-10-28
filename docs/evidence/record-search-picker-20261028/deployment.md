# 검색 가능한 기록 선택창 게시 — 2026-10-28

- 공개 주소: https://kangseokgyu.github.io/bean-pocket/
- 공개 빌드: `6b691e271650`; 게시 커밋 `2642d23` (최종 제품 코드 `75383c7`).
- 기능 브랜치 `codex/record-search-picker`에서 구현 및 수정, Critic 최종 승인 후 main에 fast-forward 통합. 기존 main 작업 폴더는 clean 상태였고 사용자 변경을 포함하거나 되돌리지 않았다.
- 실행: https://github.com/kangseokgyu/bean-pocket/actions/runs/40697730054
- `gh workflow run pages.yml --ref main -f probes=false`로 일반판 실행. build/deploy success, 2026-10-28 22:36 KST 게시 완료.
- 통합 후 GitHub Actions `npm test` 610/610, fail/cancel/skip 0. `npm run build:pages`, `npm run check:pages` 통과. [CI 근거](ci-summary.txt).
- Python urllib로 공개 파일 20개 모두 HTTP 200 및 로컬 검증 dist 바이트/SHA-256 일치 확인. [파일 근거](public-files.json).
- 격리된 새 Chrome 세션에서 공개 기록 경로 진입 및 새로고침, 버전 일치, 390px 가로 넘침 없음, JavaScript 오류/HTTP 오류 0건 확인. [브라우저 결과](public-browser.json), [캡처](public-mobile.png). 공개 브라우저 확인은 연결 전 화면에 한정한다.
- 검색·선택·필터 초기화·상태·페이지네이션·초안 복원·레시피 상세 진입·Escape/포커스는 모의 데이터 기반 390/1440px 브라우저와 자동 회귀 테스트로 검증. [검증 요약](README.md), [독립 검토](critic-review.md).
- 실제 Notion 쓰기·iPhone/Safari/홈 화면 실기기·기존 설치 클라이언트 업데이트 적용은 확인하지 않았다.
- 회귀 시 이번 기능 커밋만 별도 codex 브랜치에서 revert하고 필수 검사/독립 검토 후 main 통합·일반판 재게시. 기존 데이터와 연결 설정은 복귀 대상이 아니다.

역할 및 실제 생성 설정: Worker `gpt-6-luna` / `max`, Critic `gpt-6.1-sol` / `medium`. 같은 역할 에이전트를 재사용했고 Worker 구현 후 Critic 검토를 순차 진행했다. 메인 Orchestrator 설정은 이 대화에서 변경할 수 없으며, 지정 설정으로 바꿨다고 보고하지 않는다.
