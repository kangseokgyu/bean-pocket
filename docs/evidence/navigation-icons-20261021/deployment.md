# 메뉴 아이콘 변경 — 2026-10-21

- 상단 원두·봉지·레시피·추출 기록 메뉴를 각각 커피콩·원두 봉투·문서·커피잔 SVG로 변경했다. 접근성 이름과 툴팁, 기존 경로와 선택 색상을 유지한다.
- 기능 워크트리 `navigation-icons`, 브랜치 `codex/navigation-icons`에서 직접 구현·검토했다. 단순 표시 변경으로 별도 에이전트는 구성하지 않았다. 범위·접근성·라우팅·외부 URL 차단 회귀를 검토했다.
- 소스 커밋: `d5c83b01a19637afb27c15832c2a0663e3d18f2a`. 일반판 빌드: `1d1d608d1bf2`.
- 선행 UI 테스트는 접근성 이름 부재로 신규 테스트가 실패했다. `/tmp/ax-navigation-icons-red.tap`. SVG 검사 테스트도 기존 URL 검사로 실패했다. `/tmp/ax-navigation-icons-build-red.tap`.
- 초기 구현에서 기존 메뉴 문자열을 찾는 테스트 2개와 SVG API가 없는 증거 테스트 4개가 실패했다. 접근성 라벨 기준 조회와 테스트 DOM 대역의 표준 API 지원으로 해결했다. 초기 빌드 실패는 SVG 네임스페이스를 외부 요청으로 판단한 것이었다. 뷰의 정확한 SVG 생성 구문에만 예외를 두고, 같은 주소로 fetch하거나 다른 모듈에서 쓰는 경우는 계속 거부함을 테스트했다.
- 기능 브랜치 `npm test`: 385/385 통과, exit 0. `/tmp/ax-navigation-icons-full.tap`. main fast-forward 통합 후 `npm test`: 385/385 통과, exit 0. `/tmp/ax-navigation-icons-integrated.tap`.
- `npm run build:pages`, `npm run check:pages`, `git diff --check`: 모두 exit 0. 통합 빌드도 같은 버전이다.
- Chrome 격리 프로필, 실제 뷰와 메모리 빈 데이터로 390px·1280px 화면의 네 메뉴 이동·선택·접근성 이름·48px 이상 터치 높이를 확인했다. 페이지 실행 오류 0개. `/tmp/ax-navigation-icons-browser.txt`, [모바일](mobile.png), [데스크톱](desktop.png). 초기 미리보기는 앱 초기화와 수동 뷰의 충돌로 실패하여 앱 부트스트랩을 분리한 UI 검증으로 해결했다.
- 게시 실행: [Actions 39608445389](https://github.com/kangseokgyu/bean-pocket/actions/runs/39608445389), `pages.yml`, `main`, `probes=false`.
- iPhone 실기기, 실제 Notion 연결과 저장, 기존 설치 앱의 새 버전 적용은 직접 확인하지 않았다.
- 배포 결과: success. 공개 [사이트](https://kangseokgyu.github.io/bean-pocket/)의 파일 18개가 모두 HTTP 200이고 로컬 dist와 바이트가 일치한다. 빌드 `1d1d608d1bf2` 반영 확인. `/tmp/ax-navigation-icons-published.txt`, `/tmp/ax-navigation-icons-deploy.txt`. 증거 추가 후 앱 소스 변경 없음.
