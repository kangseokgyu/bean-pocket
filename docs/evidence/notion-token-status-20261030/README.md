# Notion 토큰 자동 확인

마지막 입력 후 1초 동안 추가 입력이 없으면 `/v1/users/me`로 토큰을 확인한다. 입력칸 오른쪽에 확인 중, 성공 체크, 경고를 표시한다. 입력 변경과 닫기, 저장 시 이전 요청을 취소하고 늦은 응답을 무시한다. 길이 제한은 없으며 기존 데이터 소스 검사와 연결 저장 절차를 유지한다.

## 검증

- 구현 커밋은 `f638f094`이며 최신 main `14210da` 위에서 검증했다.
- `node --test` 선행 실패는 `red-debounce.txt`에 기록했다.
- `npm test`는 653개 통과, 종료 코드 0이다. `npm-test.txt`를 참조한다.
- `npm run build:pages`와 `npm run check:pages`는 종료 코드 0이다. 빌드는 `4a79fe3d8b6e`다.
- Worker는 `gpt-6-luna / max`, Critic은 `gpt-6.1-sol / medium`을 생성 도구로 지정했다. 순차 실행했으며 Critic의 게시 판정은 blocker 없음이다.
- 실제 제품 view와 CSS에 가짜 검사기를 연결한 Chrome 화면을 `checking.png`, `valid.png`, `unavailable.png`에 보관했다.

실제 Notion 자격 증명과 iPhone, 스크린리더 실기는 검증하지 않았다. Critic은 상태 문구가 label 안에 있어 입력 이름에 포함될 수 있다는 비차단 접근성 개선점을 남겼다. 상태는 `aria-describedby`와 `aria-live`로도 제공한다.

`Model the Domain`에 따라 상태와 취소 요청을 폼에서 관리한다. `Prove It Works`에 따라 동작 테스트와 Chrome 화면을 확인했다. `Sequence Work into Verifiable Units`에 따라 구현, 독립 검토, 통합, 게시 순서로 진행한다. 상태와 요청 취소가 한 폼 수명에 속하므로 구현은 한 Worker가 맡았다.

Cursor 전용 deslop, control-ui, comment-sicko는 제공되지 않아 실행하지 않았다. 프로젝트 정책에 따라 설계 비교와 주석 검토를 허용된 Worker와 Critic 순서로 수행했다.

## 공식 근거

- [Notion 토큰 형식 변경 이력](https://developers.notion.com/page/changelog)은 토큰을 불투명한 문자열로 취급하고 인증 요청으로 확인하도록 안내한다.
- [토큰 사용자 조회](https://developers.notion.com/reference/get-self)는 `/users/me`를 제공한다.
- [오류 코드](https://developers.notion.com/reference/errors)에 따라 401만 토큰 무효로 분류하고 다른 오류는 확인 불가로 표시한다.

## 게시 결과

- 기능과 검증 기록을 main에 fast-forward 통합하고 `bb96bd6`를 push했다.
- [Pages 실행 40991010310](https://github.com/kangseokgyu/bean-pocket/actions/runs/40991010310)은 `probes=false`로 테스트, 일반판 빌드, 산출물 검사와 게시를 모두 통과했다.
- [공개 앱](https://kangseokgyu.github.io/bean-pocket/)의 빌드는 `4a79fe3d8b6e`다.
- 공개 `index.html`, `app.mjs`, `ui/view.mjs`, `data/notion-client.mjs`, `styles.css`, `sw.js`가 모두 HTTP 200이고 검증한 dist와 바이트 단위로 일치했다. 각 SHA-256은 `public-files.json`에 기록했다.
- 배포 후 실제 토큰 인증과 iPhone의 설치 앱 갱신은 확인하지 않았다.
