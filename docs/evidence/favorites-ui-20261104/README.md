# 즐겨찾기 목록 변경 검증

원두와 레시피의 즐겨찾기 필터와 안내를 제거하고, 별 버튼을 휴지통 버튼과 같은 스타일로 변경했다. 즐겨찾기는 서버 조회에서 이름 정렬보다 우선하므로 페이지 경계에서도 먼저 나온다. 즐겨찾기 속성이 없는 연결은 기존 이름 정렬을 유지한다.

## 검증

- `targeted-red.tap`, `repository-red.tap`, `view-red.tap`, `focus-red.tap`에 변경 전 실패와 시행착오를 보관했다.
- `node --test test/pwa-read-repository.test.mjs test/pwa-ui.view.test.mjs`는 237개 통과했다. 결과는 `targeted-green.tap`이다.
- `npm test`는 권한 제한으로 로컬 서버 실행이 막힌 첫 시도 후 권한을 적용해 692개 통과했다. 결과는 `npm-test-escalated.tap`이다.
- `npm run build:pages`와 `npm run check:pages`가 통과했다. 빌드 버전은 `cb8fcde305ad`다.
- `verify-browser.mjs`는 실제 뷰와 CSS를 합성 샘플로 렌더해 390px 원두·레시피 화면, 버튼 크기·스타일, 필터·안내 제거와 토글 후 순서를 확인했다. 결과는 `browser-results.json`과 PNG 두 파일이다.
- 독립 Critic은 페이지 밖으로 이동한 항목의 키보드 포커스 회귀를 지적했다. 남은 별 버튼과 목록 컨테이너로의 복구를 추가한 뒤 동일 최소 재현이 통과했고 재검토가 승인됐다.

실제 Notion 연결 쓰기와 iPhone 설치·재실행은 검증하지 않았다. 게시 결과는 후속 배포 기록에 남긴다.

## 로컬 미리보기

저장소 루트에서 `node docs/evidence/favorites-ui-20261104/preview-server.mjs`를 실행한다. 서버 주소와 브라우저 검증 설정은 해당 스크립트와 `verify-browser.mjs`를 참조한다. 합성 데이터만 사용한다.
