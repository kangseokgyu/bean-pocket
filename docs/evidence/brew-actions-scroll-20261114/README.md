# 추출 평가 버튼의 스크롤 배치 수정

페이지 끝에서 취소·저장 버튼이 평가 폼과 떨어져 하단 메뉴 위에 머무는 문제를 수정했다. 모바일 `.brew-run-actions`를 fixed에서 sticky로 바꾸고, `.brew-run-pane`의 자리 보충용 하단 여백 100px을 제거했다. 스크롤 중에는 버튼을 하단에 표시하고, 폼 끝이 보이면 원래 문서 위치로 돌아온다. 데스크톱 배치는 유지한다.

단순한 CSS 변경이므로 메인 에이전트가 직접 구현·검증했다. 별도 서브에이전트는 사용하지 않았다. Laziness Protocol 원칙을 적용해 스크롤 이벤트 처리나 상태를 추가하지 않았다.

## 검증

- `CHROME_EXECUTABLE='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' node scripts/browser/verify-brew-actions.mjs`. 수정 전 종료 1, 수정 후 종료 0. 최초 실행은 Playwright 전용 브라우저 미설치로 실패했고, 설치된 Chrome으로 변경해 동작 실패를 재현했다.
- 390×844 화면의 수정 전 버튼 하단 768px, 폼 하단 565.59375px. 수정 후 두 위치 모두 665.59375px.
- 320·390·700·1280px 너비, 조건 펼침·접힘에서 페이지 끝의 버튼과 폼 하단 일치, 버튼 노출, 가로 넘침 여부를 확인했다. 모바일에서는 페이지 위쪽에서도 버튼이 하단 메뉴 위에 노출되는지 확인했다.
- `npm test`. 종료 0, 813개 통과.
- `npm run build:pages`. 종료 0, 빌드 `f56200dc2c3d`.
- `npm run check:pages`. 종료 0.
- `git diff --check`. 종료 0.
- 실패 검증 커밋 `7dd1181`, 수정 커밋 `130d525`. main에 fast-forward한 뒤 검증한 코드와 동일함을 확인했다.
- 기존 작업 폴더의 미커밋 글자 크기 변경은 autostash로 보존했으며, 병합 전후 diff의 blob 해시를 제외한 내용이 정확히 같음을 확인했다. 게시에 포함하지 않았다.

실제 iPhone Safari·홈 화면 앱과 실서비스 Notion 저장은 확인하지 않았다. 화면 검증은 로컬 fixture와 Chrome으로 수행했다.

## 게시

일반판 `probes=false`로 [GitHub Actions](https://github.com/kangseokgyu/bean-pocket/actions/runs/43453035625)를 실행했다. 대상 커밋은 `130d5250884cfd0cb43e570f136c770000e37b0d`다. 완료와 공개 반영 결과는 아래에 기록한다.

배포 결과 `success`와 대상 커밋 일치를 확인했다. 공개 [Bean Pocket](https://kangseokgyu.github.io/bean-pocket/)의 HTML 빌드는 `f56200dc2c3d`였다. 공개 `styles.css`를 받아 검증한 `dist/styles.css`와 바이트 단위로 일치함을 확인했다.
