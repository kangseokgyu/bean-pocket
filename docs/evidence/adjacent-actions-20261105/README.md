# 즐겨찾기·삭제 버튼 간격 제거

원두와 레시피 카드의 즐겨찾기·삭제 버튼을 여백 없이 붙였다. 공통 헤더의 gap 12px과 즐겨찾기 버튼의 오른쪽 margin -8px이 만든 4px 간격을, 해당 margin을 -12px로 바꾸어 없앴다. 두 버튼은 각각 46×46px이며 클릭 영역이 겹치지 않는다.

- 변경 전 브라우저 검증은 원두 320px에서 실제 간격 4px로 실패했다. `browser-before.log`에 기록했다.
- 변경 후 320·390·768·1280px의 원두·레시피 8개 조합에서 간격 0px, 버튼 크기, 세로 정렬, 가로 넘침 없음과 즐겨찾기 클릭을 확인했다. `browser-results.json`과 `browser-after.log`에 기록했다.
- 390px 스크린샷 두 장을 직접 확인했다. 테스트 데이터만 사용했으며 실제 Notion 데이터는 변경하지 않았다.
- 최초 전체 테스트는 샌드박스의 로컬 포트 권한 오류로 18개 실패했다. `npm-test.log`에 남기고 권한을 허용하는 환경에서 다시 실행했다.
- 권한을 허용한 전체 `npm test`는 732개 모두 통과했다. 종료 코드는 0이며 `npm-test-unrestricted.log`에 기록했다.
- Pages 빌드와 검사는 종료 코드 0으로 통과했다. 빌드 버전은 `cec5502370cb`다.

재현 명령은 다음과 같다.

```sh
node docs/evidence/adjacent-actions-20261105/preview-server.mjs
node docs/evidence/adjacent-actions-20261105/verify-browser.mjs
npm test
npm run build:pages
npm run check:pages
```

임시 서버의 기본 포트 4194가 사용 중이어서 4207을 사용했다. 브라우저 실행도 최초에는 샌드박스에서 차단되어 권한을 허용한 뒤 실행했다. 상위 `AGENTS.md`의 단순 작업 직접 수행 정책에 따라 서브에이전트 없이 처리했다. Cursor 전용 control-ui와 deslop은 설치되어 있지 않아 기존 Playwright 실행 방식과 직접 diff 검토를 사용했다.

실제 iPhone Safari와 홈 화면 설치·재실행은 확인하지 않았다.
