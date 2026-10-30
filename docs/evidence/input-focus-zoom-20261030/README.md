# 입력 포커스 자동 확대 수정 검증

사용자가 텍스트박스를 눌렀을 때 화면이 자동 확대되는 문제를 보고했다. 일반 폼과 검색 입력에 적용된 14px 글꼴 및 인사이트 선택창의 작은 글꼴을 16px로 변경했다. 사용자 확대 설정은 변경하지 않았다.

- 소스 커밋은 `dc7bda3`이다. 회귀 검사 선행 커밋은 `10aa8ff`이다.
- `node --test test/pwa-input-font-size.test.mjs`는 수정 전에 `form fields uses at least 16px text`로 실패했고 수정 후 1개 통과했다.
- `npm test`는 655개 통과, 실패 0개다. `npm run build:pages`, `npm run check:pages`, `git diff --check`도 종료 코드 0이다.
- Worker는 `gpt-6-luna / max`, Critic은 `gpt-6.1-sol / medium`으로 순차 실행했다. 독립 검토에서 차단 결함은 없었다.
- Chrome 390×595 반응형 화면에서 빌드된 연결 폼 입력 6개와 데모 검색 입력의 계산된 글꼴이 모두 16px임을 확인했다. 변경 전 연결 폼 입력은 14px였다.
- 실제 iOS Safari의 포커스 확대는 iPhone 제어 및 iOS Simulator 부재로 재현하거나 수정 후 확인하지 못했다. 작은 글꼴과 사용자 증상의 관계는 추론이다. 정적 회귀 검사는 실제 브라우저 확대 검사가 아니다.
- [일반판 게시 실행](https://github.com/kangseokgyu/bean-pocket/actions/runs/41000008759)은 `main`, `probes=false`로 완료됐다. 배포 서버의 테스트·빌드·산출물 검사도 통과했다.
- [공개 앱](https://kangseokgyu.github.io/bean-pocket/)의 빌드 버전은 `2879c12bec0a`다. HTML, 두 CSS, 서비스워커, manifest가 HTTP 200이며 로컬 검증 빌드와 바이트 단위로 일치했다. 해시는 [공개 파일 확인 결과](public-files.json)에 기록했다.

로컬 상세 로그는 `/private/tmp/ax-input-focus-zoom-red.test.txt`, `/private/tmp/ax-input-focus-zoom-green.test.txt`, `/private/tmp/ax-input-focus-zoom-npm-test.txt`, `/private/tmp/ax-input-focus-zoom-evidence.txt`에 있다. 문서 기록은 앱 버전 해시에 영향을 주지 않는다.
