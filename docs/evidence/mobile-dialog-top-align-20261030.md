# 모바일 모달 상단 배치

사용자 요청에 따라 모바일 입력·선택 모달을 상단 기준으로 배치하고 취소·저장 버튼은 하단에 유지했다. 변경은 `pwa/styles.css`의 모바일 규칙 두 곳이다. 삭제 확인창의 중앙 배치와 데스크톱 규칙은 유지했다.

## 검증

- Worker `gpt-6-luna / max`가 구현과 검증을 수행했다.
- `npm test`는 642개 모두 통과했다. 최초 샌드박스 실행은 로컬 서버 바인딩 권한 오류로 실패했고, 권한을 허용한 실행에서 통과했다.
- `npm run build:pages`와 `npm run check:pages`가 통과했다. 빌드는 `c3abff13520d`다.
- Chromium 390×844 CSS fixture에서 긴 입력폼의 상단 배치, 하단 sticky 버튼, 선택창 상단 배치, 삭제창 중앙 배치를 확인했다.
- Critic `gpt-6.1-sol / medium`의 독립 검토 결과는 `PASS+NOTES`다. 수정이 필요한 지적은 없다.
- Critic이 빌드된 실제 앱의 연결 모달을 Chrome 390×844에서 열어 상단 위치와 하단 취소·저장을 확인했다. Node 정적 서버에서 요청 실패와 pageerror가 없었다.
- 실제 iPhone Safari, 소프트웨어 키보드 표시 중 동작, notch safe-area 값과 Notion 연결을 통한 실제 선택창 진입은 미검증이다.

로그는 `/private/tmp/mobile-dialog-npm-test-escalated.log`, `/private/tmp/mobile-dialog-build-pages.log`, `/private/tmp/mobile-dialog-check-pages.log`, `/private/tmp/critic-mobile-app-verify.log`에 보관했다. 실제 앱 캡처는 `/private/tmp/critic-mobile-dialog-app-settings.png`다. 임시 경로의 증거는 이 작업 환경에서만 유효하다.

`Experience First`에 따라 입력 중 화면 이동을 줄이는 상단 배치를 선택했다. 사용자 선택에 따라 하단 버튼을 유지했다. Cursor 전용 deslop·comment-sicko 도구는 사용할 수 없어 프로젝트 정책에 따른 Critic diff 검토와 Playwright 확인으로 대체했다.
