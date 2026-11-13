# 추출 기록 버튼 정리

`docs/button-icon-guidelines.md`에 따라 목록·분석은 선택 밑줄이 있는 탭으로, 기록의 세 가지 동작은 테두리 없는 보조 버튼으로 표시한다. 글자는 13px, 터치 영역 높이는 44px다. 기존 문구, 이벤트와 비활성화 조건은 유지한다. 공용 기록 카드의 같은 동작에도 동일한 스타일을 적용한다.

- `npm test` 통과. 813개 성공, 실패 없음.
- `npm run build:pages` 통과. 초기 빌드 `01f8cfbf76eb`. main의 추출 동작 배치 수정 통합 후 필수 테스트·빌드·검사와 대상 브라우저 검증을 다시 통과했다. 최종 일반판 빌드는 `feb2496ac6d0`이다.
- `npm run check:pages` 통과.
- `npm run test:browser` 통과. 기존 브라우저 회귀 검사 24개 성공. 설치된 Chrome과 번들 Playwright 사용.
- 실제 Chrome에서 320px, 390px, 1440px 화면의 가로 넘침, 버튼의 44px 이상 터치 영역, 목록·분석 전환, 다시 추출 경로, 키보드 초점을 확인했다.
- 변경 전후 화면을 비교했다. 기능 변경 없는 CSS 수정이므로 신규 동작 테스트는 추가하지 않았다.
- iPhone 실기기와 실제 Notion 저장은 검증하지 않았다. 브라우저 검증은 프로젝트의 가짜 저장소를 사용했다.

검증 로그는 `/tmp/record-buttons-test.log`, `/tmp/record-buttons-browser.log`, `/tmp/record-buttons-regression.log`에 보관했다. 화면은 `/tmp/records-final-390.png`에 보관했다.

통합 검증 로그는 `/tmp/record-buttons-integrated-test.log`, `/tmp/record-buttons-integrated-browser.log`에 보관했다.

## 공개 반영 확인

- 게시 실행 https://github.com/kangseokgyu/bean-pocket/actions/runs/43453756070 은 성공했다. `pages.yml`, `main`, `probes=false`로 실행했다.
- 배포 커밋은 `8b5dcf363026c42123e1a40fd82234234b3a2c8d`이다.
- https://kangseokgyu.github.io/bean-pocket/ 의 공개 빌드 `feb2496ac6d0`를 확인했다.
- 공개 `styles.css`와 검증한 `dist/styles.css`가 바이트 단위로 일치했다. SHA-256은 `8bc1643af2b58f7b330bc0cb400993cbdc81cb162ef856a4b691080ae5afd2d7`이다.
- 기존 작업 폴더의 미커밋 CSS 변경은 배포에서 제외하고 내용 그대로 보존했다.
