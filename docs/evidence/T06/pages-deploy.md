# T06/T07 실험판 게시 기록

2026-10-18 (Asia/Seoul). 사용자가 검증 결과와 실험 화면을 확인한 후 main 통합·Pages 게시를 명시적으로 승인했다.

- 통합: `codex/pages-first-implementation` → `main`, fast-forward. 기존 원격 main `258eef3`, 게시 커밋 `7aa0c54e384586889003aae1cbcef7e8b19e7638`.
- 실행: `gh workflow run pages.yml --ref main -f probes=true`, 종료 0.
- [Actions 실행 39082843116](https://github.com/kangseokgyu/bean-pocket/actions/runs/39082843116): build·deploy 성공. 회귀 테스트·실험 빌드·검사 통과.
- 빌드: `7a9015e1e222`.
- [실제 홈 화면](https://kangseokgyu.github.io/bean-pocket/), [Notion 실험](https://kangseokgyu.github.io/bean-pocket/probes/notion/), [파일 보관 실험](https://kangseokgyu.github.io/bean-pocket/probes/storage/).
- HTTPS 파일 12개 모두 HTTP 200이며 승인된 로컬 산출물과 바이트 일치. 검증 명령 종료 0. [경로·해시 기록](pages-http-resources.txt).
- PC 인앱 브라우저에서 기존 페이지 새로고침만으로는 이전 빌드가 남았다. 페이지 종료 후 다시 열었을 때 새 빌드와 실험 메뉴를 확인했다. 강제 SW 적용·사이트 데이터 삭제는 하지 않았다. [게시 화면](pages-experiment-home.png).
- 실제 Pages 출처에서 가짜 인증값의 Notion 직접 요청이 HTTP 401로 식별되는 것을 확인했다. 실제 토큰 입력·정상 인증 조회·실제 항목 생성은 수행하지 않았다.

실기기 iPhone 12 / iOS 27.0.1의 T06/T07/T08은 여전히 검증 대기다. 첫 실행 정상 사용자 보고나 PC·HTTP 결과를 실기기 직접 통신 및 저장 수명 통과로 대신하지 않는다. 기존 홈 화면 앱에 이전 빌드가 보이면 Safari의 해당 사이트 탭과 홈 화면 앱을 종료한 뒤 다시 열고 버전을 확인한다. 보관 수명 실험 중 사이트 데이터를 수동 삭제하지 않는다.

이 문서와 후속 증거 커밋은 보고용이며 게시 코드·빌드를 바꾸지 않는다.
