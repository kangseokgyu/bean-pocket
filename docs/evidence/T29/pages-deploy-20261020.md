# T29 검증용 일반판 게시 — 2026-10-20

사용자가 검증 결과를 확인한 뒤 main 병합과 게시를 명시 승인했다. 기존 후보 b0023cf를 main에 fast-forward 통합하고 push했다.

- 첫 실행 39346868850: 회귀 353/354, 날짜 테스트가 UTC runner에서 실패하여 배포 중단. 기존 사이트 유지.
- 최소 재현: `TZ=UTC node --test test/pwa-ui.view.test.mjs` exit 1. KST 경계 테스트가 실행 호스트의 시간대를 암묵적으로 사용했다.
- 수정 0ce1996: 테스트 안에서 Asia/Seoul을 지정하고 finally에서 기존 TZ를 복원. 제품 코드 변경 없음.
- `TZ=UTC npm test`: exit 0, 354 pass / 0 fail. 일반 4e7b1268f15d·실험 4a0d23ec358e 빌드/검사 exit 0. 최종 dist는 일반판.
- [최종 Actions](https://github.com/kangseokgyu/bean-pocket/actions/runs/39347188137): success, head 0ce1996ba07916b16d0fab49cce13844f2aa0388. 완료 2026-10-20 09:22:29 KST.
- [실제 사이트](https://kangseokgyu.github.io/bean-pocket/): 공개 dist 18개 파일 전부 HTTP 200·로컬 후보와 바이트 일치.
- 인앱 브라우저 첫 접속은 기존 실험판 0f0ea09f28a8을 표시했다. 탭 종료 후 재접속으로 일반판 4e7b1268f15d·연결 설정·원두/봉지/레시피/기록 메뉴 확인. 사이트 데이터 삭제나 강제 SW 전환은 하지 않았다.

실제 Notion 요청·지정 iPhone·셀룰러·연결 파일 수명은 미검증이다. T29는 게시/PC 초기 화면 확인만 완료했으며 나머지 체크리스트는 대기다. T30 운영 연결은 진행하지 않았다.
