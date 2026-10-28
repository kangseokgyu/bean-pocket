# 게시 확인

- 공개 주소: https://kangseokgyu.github.io/bean-pocket/
- 공개 빌드: `1d1477f2d4d9`
- 기능 커밋: `d83f424be72f30f3e75f76d3b8a8b443fe4ecbc1`
- 배포 커밋: `c1dba206c6e6366585e1a4f5fda6126aa40001aa`
- 실행: https://github.com/kangseokgyu/bean-pocket/actions/runs/40624574565
- `main` / `pages.yml` / `probes=false`: completed / success. `gh run watch 40624574565 --exit-status --interval 10` 종료 코드 0. CI 회귀 테스트·일반판 빌드·산출물 검사·배포 모두 통과.
- 로컬 기능 및 통합 검증: `npm test` 595/595, `npm run build:pages`, `npm run check:pages` 통과. Chrome 17개 검증과 Critic 승인 결과는 `report.md` 참조.
- `python3 /private/tmp/verify-animated-check-pages.py` 종료 코드 0. 캐시 우회 쿼리 및 no-cache 요청으로 공개 HTML·SW·CSS·모듈·manifest·아이콘 20개를 확인했으며, 모두 HTTP 200 및 검증한 dist와 바이트 일치. HTML 및 SW 빌드 값도 일치. 상세 결과는 `public-verification.json`.
- 첫 push 요청은 자동 승인 검토 시간 초과로 실행되지 않았고, 도구가 허용한 한 번의 재시도는 성공했다.
- 기존 Actions의 Node 20→24 전환과 ubuntu-latest 이미지 변경 안내는 있었으나 실패 없음.
- 실제 iPhone Safari·설치 앱·기존 클라이언트의 SW 갱신과 실제 Notion 저장은 미검증. 합성 데이터와 Chrome의 터치 화면·동작 줄이기 에뮬레이션으로 UI를 검증했다.

문제 시 기능 변경만 별도 브랜치에서 되돌린 뒤 필수 검증과 일반판 게시 절차를 따른다.
