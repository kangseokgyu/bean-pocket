# 탭 메뉴 위 중복 여백 제거 — 2026-10-21

- 변경 커밋: `2184277f8f24b446b896fa2d26563b90a7098187`
- 일반판 빌드: `d6e93757e545`
- 게시 주소: https://kangseokgyu.github.io/bean-pocket/
- 배포 성공: https://github.com/kangseokgyu/bean-pocket/actions/runs/39554427881 (`probes=false`)
- `.bean-section`의 상단 padding과 `.tabs`의 상단 margin이 누적되므로 `.tabs`의 margin-top을 16px에서 0으로 변경했다. 상태창 숨김 후 원두·봉지·레시피·추출기록 탭 위 여백이 16px 줄어든다. 문서/표시 변경 검증 범위에 따라 동작 테스트 추가 없이 기존 회귀 테스트를 실행했다.
- 기능 브랜치와 main 통합 후 각각 `npm test` 383/383 통과(종료 코드 0). 원문: [feature-test.txt](feature-test.txt), [main-test.txt](main-test.txt).
- 기능 브랜치와 main에서 `npm run build:pages`, `npm run check:pages`, `git diff --check` 통과(종료 코드 0).
- 공개 파일 HTTP 상태와 로컬 산출물 일치 결과는 [public-files.json](public-files.json)에 기록한다.
- 실제 iPhone 화면과 터치, 상태창 자동 숨김 이후의 실기기 시각 검증은 수행하지 않았다.
