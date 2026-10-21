# 날짜 입력칸 폭 수정 — 2026-10-21

- 범위: `pwa/styles.css`의 `.form-field input[type="date"]`에만 `appearance: none`(WebKit 접두사 포함), `box-sizing: border-box`, `max-width: 100%`를 적용한다. 추출 날짜와 로스팅 날짜 모두 적용되며 `type="date"`와 날짜 값·필수 검증은 유지한다.
- 근거: [WebKit 301648](https://bugs.webkit.org/show_bug.cgi?id=301648)는 iOS에서 날짜 계열 input의 padding이 100% 폭 밖에 더해지는 문제를 기록하며 macOS에서는 재현되지 않는다고 명시한다. 첨부 화면의 증상과 일치하므로 네이티브 appearance를 해제해 앱의 폭 규칙을 적용한다.
- 실제 iOS 버그의 자동 재현은 하지 못했다. macOS WebKit에서는 수정 전에도 기하학적 폭 검증이 통과했다. RED는 네이티브 appearance 해제 조건이 미충족임을 확인한 것이며 실기기 재현 성공으로 해석하지 않는다.
- 브라우저 회귀 명령: `PLAYWRIGHT_MODULE=/absolute/path/to/playwright CHECK_STAGE=after node docs/evidence/date-input-containment-20261021/browser-check.mjs`. 기존 번들 Playwright를 사용하며 프로젝트 의존성은 추가하지 않았다. WebKit 및 Chrome 설치가 필요하다.
- 실제 view 모듈·CSS로 추출 기록 및 봉지 폼을 localhost에서 렌더링한다. 각 엔진에서 320/390/430/768px, 두 폼, 빈 날짜/2026-10-21을 검증한다. 총 32회 날짜 입력칸과 label·select 폭 일치, 페이지 가로 넘침 없음, 날짜 type·값 유지, pageerror 없음, appearance 해제를 검사한다.
- `browser-red.txt`: appearance 조건 32회 실패, 종료 코드 1. `browser-green.txt`: 32회 통과, 종료 코드 0. `webkit-before.png` / `webkit-after.png`: 390px WebKit 화면. 이는 iPhone 실기기 화면이 아니다.
- 기능 브랜치: `npm test` 385/385 통과 (`tests.txt`), `npm run build:pages` 통과 (`build.txt`, 빌드 `9f737a540245`), `npm run check:pages` 통과 (`check.txt`). 모두 종료 코드 0. `git diff --check` 통과.
- 자체 리뷰: 날짜 input에만 적용되며 select·number·textarea 및 날짜 저장 로직 변경 없음. 기존 min-height 46px·포커스 outline 유지. 추가 의존성·외부 요청·사용자 데이터 없음. 초기 브라우저 하네스의 잘못된 API명과 Chrome 경로는 수정 후 재실행했다.
- 제한: iPhone Safari/홈 화면 실기기, 네이티브 달력 팝업의 실제 터치 조작, 기존 설치 앱의 새 빌드 전환은 직접 확인하지 않았다.
