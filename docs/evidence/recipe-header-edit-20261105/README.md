# 레시피 상세 수정 아이콘

수정 버튼을 제목 오른쪽의 삭제 버튼 바로 왼쪽으로 옮겼다. 두 버튼은 회색 선 아이콘, 투명 배경, 46px 클릭 영역과 기존 호버·포커스 스타일을 공유한다. 그룹 간격과 버튼 마진은 0이다. 접근성 이름은 `<레시피명> 수정`이며 기존 준비 중 안내를 유지한다.

검증은 메인 에이전트가 직접 수행했다. 새 에이전트는 생성하지 않았다.

- 테스트 선행: 기존 구현에서 헤더 그룹 부재와 하단 버튼 개수로 2개 테스트가 실패했다. `red.log` 참조.
- 변경 후 해당 테스트 2개 통과.
- `npm test`: 732개 통과. 첫 실행은 HTTP 서버의 `listen EPERM`으로 실패했으며 권한 확장 실행에서 통과했다. `npm-test-elevated.log` 참조.
- `npm run build:pages`, `npm run check:pages`: 통과.
- `node docs/evidence/recipe-header-edit-20261105/browser-check.cjs`: Chrome의 320px, 390px, 1440px에서 통과. 긴 제목, 두 버튼 순서, 간격 0px, 클릭 영역 46px, 가로 넘침 없음, 클릭·Enter·Space 안내, Tab 이동과 포커스 표시를 확인했다. 삭제 확인창 취소와 삭제 액션·레시피 ID 전달도 확인했다. `browser-results.json`과 화면 PNG 참조.

브라우저 삭제 검증은 모의 submit을 사용했다. 실제 Notion 데이터의 삭제와 물리 iPhone은 검증하지 않았다.

최신 main `2743a00` 통합 후 전체 732개 테스트와 빌드·산출물 검사, 세 화면 크기 브라우저 검증을 다시 통과했다. 통합 빌드 버전은 `8f6fd4759ebb`이다. `integrated-test.log`, `build.log`, `check.log`, `integrated-browser.log`에 결과를 보관했다.
