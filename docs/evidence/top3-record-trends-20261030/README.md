# Top 3 추출 기록 그래프 검증

추출 기록 그래프를 원두 선택 카드보다 위로 옮기고, 최근 추출일 기준 상위 3종의 추이를 함께 표시했다. 선택 원두 요약과 비교 표는 기존 선택 기준을 유지한다. 그래프는 원두별 선과 범례, 공통 날짜·별점 축을 사용한다.

`Model the Domain` 원칙을 적용해 `trendSeries`를 원두별 `{ beanId, beanName, points }` 구조로 만들었다. `Prove It Works` 원칙에 따라 Chrome에서 실제 DOM 순서와 화면 배치를 확인했다.

- 테스트를 먼저 추가하고 기존 구현에서 Top 3 데이터와 첫 화면 순서가 없는 것으로 실패함을 확인했다. [실패 로그](red.txt)에 기록했다.
- 관련 모델·뷰·컨트롤러 테스트 179개가 통과했다.
- `npm test`는 로컬 테스트 서버 실행이 허용된 환경에서 665개 통과했다. 기본 샌드박스에서는 loopback `listen EPERM`으로 15개 실패했다. 재실행 로그는 `/private/tmp/top3-trend-npm-test-escalated.log`에 있다.
- `npm run build:pages`, `npm run check:pages`, `git diff --check`가 종료 코드 0으로 완료됐다. 빌드 버전은 `71c6830b8c01`이다.
- Chrome fixture 검증은 390px와 1440px에서 그래프 첫 배치, 전체 폭, 원두별 선, 동일 좌표, 미평가 원두 범례, 긴 이름 줄바꿈과 가로 넘침 없음을 확인했다. JavaScript 오류와 404가 없었다. [측정 결과](browser-results.json), [모바일 화면](screen-390.png), [데스크톱 화면](screen-1440.png)에 기록했다.
- Worker는 `gpt-6-luna / max`, Critic은 `gpt-6.1-sol / medium`으로 순차 실행했다. Critic이 6개 파일의 변경과 검증 근거를 직접 확인해 차단 결함 없이 승인 가능하다고 판단했다. 새 주석이나 suppression은 없다.
- 변경 전 필수 조사와 의도 실패 확인을 먼저 수행했다. 같은 모델·렌더러를 변경하므로 구현은 Worker 한 명으로 한정하고 공유 파일 쓰기를 직렬화했다. 설치되지 않은 `control-ui`와 `deslop` 스킬은 Playwright 및 변경분 검토로 대체했다.

실제 iOS Safari, 사용자 Notion 연결 데이터, 보조기기를 사용한 접근성은 검증하지 않았다. 브라우저 검증에는 합성 fixture를 사용했다. 게시 결과는 완료 후 별도로 기록한다.
