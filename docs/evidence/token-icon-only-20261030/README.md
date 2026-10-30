# 토큰 상태를 아이콘으로 표시

토큰 입력칸 아래에 보이던 상태 안내를 기존 `visually-hidden` 클래스로 숨겼다. 화면 읽기용 상태 안내와 1초 자동 검사, 오른쪽 아이콘은 유지했다. 사용하지 않는 문구 표시 CSS를 제거했다.

- `npm test`는 654개 통과, 종료 코드 0이다.
- `npm run build:pages`와 `npm run check:pages`는 통과했다. 빌드는 `b3c4af8b368d`다.
- 제품 view와 CSS에 가짜 검사기를 연결한 Chrome 화면에서 문구가 보이지 않고 체크 아이콘이 유지되는 것을 확인했다. `valid.png`를 참조한다.
- Chrome에서 상태 문구는 absolute 위치와 `clip-path: inset(50%)`, 약 1px 크기이며 아이콘은 약 18px 폭이었다.
- 최초 화면 확인은 빌드 완료 전 자원 404로 실패했다. 산출물이 준비된 뒤 재확인했다.
- 단순 표시 변경이라 추가 에이전트 없이 직접 수행했다. 실제 Notion 인증과 iPhone, 스크린리더 실기는 확인하지 않았다.

## 게시

`bbf1370`을 main에 통합하고 [Pages 실행 40998824631](https://github.com/kangseokgyu/bean-pocket/actions/runs/40998824631)을 `probes=false`로 완료했다. CI의 통합 테스트, 빌드, 산출물 검사와 게시가 통과했다. [공개 앱](https://kangseokgyu.github.io/bean-pocket/)의 빌드는 `b3c4af8b368d`다. 공개 HTML, view, CSS, 서비스 워커는 HTTP 200이고 로컬 검증 산출물과 바이트 단위로 일치했다. 근거는 `public-files.json`에 기록했다.
