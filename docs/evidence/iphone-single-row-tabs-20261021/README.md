# iPhone 메뉴 한 줄 표시

- 모바일(600px 이하)에서 2열로 전환하던 규칙을 제거하고 기본 4열을 유지한다.
- 모바일 메뉴 간격 4px, 버튼 좌우 여백 4px, 글자 0.875rem, 줄바꿈 방지. 터치 높이 50px 유지.
- `npm test`: 종료 코드 0, 381개 통과, 실패 0.
- `npm run build:pages`: 종료 코드 0, 빌드 `23ac91261e31`.
- `npm run check:pages`: 종료 코드 0.
- `git diff --check`: 종료 코드 0.
- 설치된 Chrome 모바일 에뮬레이션에서 320/360/375/390/430/600/768px 너비 모두 네 버튼의 세로 위치 일치, 글자 및 페이지 가로 넘침 없음. 수치는 `layout.json`, 390px 화면은 `390px.png`.
- 미연결 상태에서 실제 메뉴 DOM과 상위 요소의 hidden 속성을 검증 중 해제했다. 서비스 워커 자동 새로고침은 검증 브라우저에서 차단했다. 앱 소스에는 이 설정을 넣지 않았다.
- WebKit 브라우저 바이너리 미설치로 Safari 엔진 검증은 수행하지 못했다. 실제 iPhone Safari·홈 화면 실행도 미검증이다.
- main merge는 AGENTS.md의 명시적 승인 대기. 아직 push·게시하지 않았으며 공개 빌드 반영은 확인하지 않았다.

## 병합·게시 완료

- 사용자 추가 지시: 이 프로젝트는 merge와 게시를 추가 승인 없이 진행한다. `AGENTS.md`, `docs/pages-deploy.md`에 상시 승인 기록.
- main 병합: `b698b634dbc565e9e9ea18a294d0c6fff143c127`. 통합 시 main에 있던 봉지 추가 버튼 변경도 유지되므로 빌드는 기능 브랜치 단독 결과와 다르다.
- 통합 `npm test`: exit 0, 382개 통과, 실패 0. `/tmp/iphone-tabs-integrated-test.log`.
- 통합 `npm run build:pages`, `npm run check:pages`, `git diff --check`: exit 0. 빌드 `194cabc7afbd`.
- main push 후 `gh workflow run pages.yml --ref main -f probes=false` 실행.
- [Pages 실행 39552296354](https://github.com/kangseokgyu/bean-pocket/actions/runs/39552296354): success, 배포 head `b698b634dbc565e9e9ea18a294d0c6fff143c127`. 테스트·빌드·검사·배포 성공.
- [공개 사이트](https://kangseokgyu.github.io/bean-pocket/): 빌드 `194cabc7afbd`, 공개 파일 18개 전부 HTTP 200이며 로컬 dist와 바이트 일치. `published-files.json`에 결과 기록.
- 실제 iPhone Safari·홈 화면 실행 및 기존 설치 앱의 새 버전 적용은 직접 확인하지 않았다.
