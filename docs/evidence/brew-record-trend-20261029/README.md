# Brew record trend evidence

This folder records the feature requirements and verification artifacts for the recent-bean list and rating-trend chart.

- `spec.md`: behavior and verification summary.
- `recent-trend.red.txt`, `focused-green.txt`: focused test RED/GREEN evidence.
- `npm-test.txt`: final full test run, 620 passing.
- `npm-test-sandbox-listen-eperm.txt`: initial sandbox run; loopback listeners were blocked, so the test suite was rerun with the project-required elevated permission.
- `build-pages-final.txt`, `check-pages.txt`: final Pages build (`c9fb149587d6`) and output validation.
- `build-preview.txt`: initial build rejection for an inline SVG namespace URL; static SVG templates resolved it without changing the output checker.
- `browser-validation.cjs`, `browser-validation.txt`: Chromium checks of sorting, keyboard selection, graph labels/spacing, filter isolation, viewport widths, console and requests.
- `screen-320.png`, `screen-550.png`, `screen-768.png`, `screen-1024.png`, `screen-1440.png`: viewport screenshots.

## 통합·게시 완료 (2026-10-29 KST)

- 기능 커밋 `3fc5258`, 독립 Critic 승인 `critic.md`. 리뷰 문서를 포함한 `b59e7cc`를 main에 fast-forward 후 push했다. 검증된 소스와 동일하므로 로컬 전체 검증을 중복 실행하지 않았다.
- main의 일반판 `probes=false` 배포 성공: https://github.com/kangseokgyu/bean-pocket/actions/runs/40805554530 (`deployment.json`). CI에서도 전체 테스트·일반 빌드·산출물 검사를 통과했다.
- 공개 데모 https://kangseokgyu.github.io/bean-pocket/records-demo.html , 빌드 **`c9fb149587d6`**.
- 공개 파일 24개 모두 HTTP 200이며 로컬 검증 빌드와 바이트·SHA256 일치 (`public-verification.json`).
- 실제 Notion 데이터 연동, 실제 iPhone Safari/홈 화면 및 Firefox는 확인하지 않았다.
- 에이전트 실제 설정: 기존 대체 Worker `gpt-6.1-sol`/`medium` 재시작이 429로 실패하여 원래 지정 Worker `gpt-6-luna`/`max`로 새 실행했다. Critic은 `gpt-6.1-sol`/`medium`을 재사용했다.
- GitHub Actions에는 Node 20 지원 종료·ubuntu-latest 이미지 변경 안내가 있었으며 배포는 성공했다. 이번 변경은 워크플로를 수정하지 않는다.
