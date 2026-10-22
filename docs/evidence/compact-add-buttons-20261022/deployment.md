# 게시 확인

- 통합 커밋: `4c407ecdbf2b630fc2e7045e7f7e4c4c626b8e18`.
- main 통합 후 `npm test`: 종료 0, 413/413 통과 (`main-tests.tap`). `npm run build:pages`, `npm run check:pages`: 종료 0. 빌드 `d903139c5081`.
- `gh workflow run pages.yml --ref main -f probes=false` 실행.
- [Pages 실행 39734457416](https://github.com/kangseokgyu/bean-pocket/actions/runs/39734457416): build/deploy 성공.
- [공개 앱](https://kangseokgyu.github.io/bean-pocket/): HTML 빌드 `d903139c5081`과 실제 styles.css의 32px·회색·테두리 없음 규칙 확인. HTML/CSS/view.mjs/manifest/SW HTTP 200 (`public.json`).
- 실제 iPhone Safari·홈 화면·기존 설치본 업데이트 및 터치 사용성은 미검증.
