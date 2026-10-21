# 추출기록 + 등록 버튼 — 2026-10-21

- 변경 커밋: `7cbb72b00456081d1f28c2a40456d3a2c94ab2d2`
- 일반판 빌드: `0502e0426d68`
- 게시 주소: https://kangseokgyu.github.io/bean-pocket/
- 배포 성공: https://github.com/kangseokgyu/bean-pocket/actions/runs/39553890124 (`probes=false`)
- 추출기록 메뉴는 폼을 닫은 상태로 시작하며 상단 + 버튼으로 등록 폼을 연다. 입력 보존, 취소·저장 완료 후 닫기, 레시피 상세에서 기록 시작 경로를 검증했다.
- 테스트 선행: 새 테스트는 기존 `/records/new` 메뉴 경로 때문에 의도대로 실패했다(종료 코드 1). 구현 후 UI 테스트 33/33 통과(종료 코드 0).
- 기능 브랜치 및 main 통합 후 각각 `npm test` 383/383, `npm run build:pages`, `npm run check:pages` 통과(모두 종료 코드 0). `git diff --check` 통과.
- 공개 파일 18개 HTTP 200 및 로컬 산출물과 바이트 일치. 파일별 SHA-256은 [public-files.json](public-files.json)에 기록했다.
- 실제 iPhone 화면·터치 및 운영 Notion 신규 저장은 이번 작업에서 실행하지 않았다.
