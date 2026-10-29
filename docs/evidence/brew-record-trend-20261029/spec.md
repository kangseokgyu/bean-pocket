# 최근 추출 원두와 별점 추이

## 동작 요구사항

- 원두 목록에는 기록이 있는 서로 다른 원두 가운데 마지막 추출일이 최근인 3종만 표시한다. 원두별로 여러 기록이 있어도 한 번만 표시하고, 기록이 없는 원두는 제외한다.
- 각 원두 버튼은 마지막 추출 날짜, 그 기록의 레시피와 평가를 표시한다. 처음 선택할 원두는 목록의 첫 항목이다.
- 기존 최고 평가 상세와 그 레시피 조건은 유지한다.
- 선택한 원두의 모든 샘플 기록으로 날짜별 별점 선그래프를 표시한다. 기록 표의 레시피 필터와 정렬은 표와 모바일 카드에만 적용한다.
- 그래프 x 좌표는 실제 추출 날짜 차이에 비례하고, y축은 항상 1~5점이다. 점은 날짜 오름차순으로 이어지고 날짜와 점수를 표시한다.
- 원두 선택을 바꾸면 그래프와 텍스트 대안이 함께 바뀐다. 그래프 요약, 날짜별 텍스트 목록, 버튼 키보드 선택을 제공한다.
- 기록 0건은 빈 상태를 안내하고, 기록 1건은 점 하나로 표시한다.
- 데모 샘플 데이터만 사용하고 외부 의존성이나 실제 기록 데이터 연결은 추가하지 않는다.

## RED 검증

- 실행: `node --test test/pwa-records-demo.test.mjs`
- 결과: 실패(exit 1). 신규 `getRatingTrend` 내보내기가 아직 없음을 확인했다.
- 원문 로그: `recent-trend.red.txt`

## GREEN 및 브라우저 검증

- focused: `node --test test/pwa-records-demo.test.mjs` 통과(8/8), `focused-green.txt`.
- 전체: `npm test` 통과(620/620), `npm-test.txt`. 기본 샌드박스 실행은 HTTP 테스트의 loopback listen 제한으로 실패해 `npm-test-sandbox-listen-eperm.txt`에 보존했고, 프로젝트 지침에 따라 권한 상승으로 재실행했다.
- Pages: `npm run build:pages` 통과, 빌드 식별자 `c9fb149587d6` (`build-pages-final.txt`); `npm run check:pages` 통과(`check-pages.txt`). 최초 빌드는 SVG 네임스페이스 검사에서 실패했으며, HTML 내 SVG 템플릿 복제로 변경한 뒤 통과했다(`build-preview.txt`).
- Chromium: `browser-validation.cjs` 및 `browser-validation.txt`. 320/550/768/1024/1440px에서 가로 넘침 없음, 키보드 원두 선택, 별점 그래프·텍스트 대안 동기화, 필터 독립성 확인. 콘솔 오류·경고, 실패/비정상 응답, 외부 요청 없음(요청 5건은 로컬 산출물).
- 화면: `screen-320.png`, `screen-550.png`, `screen-768.png`, `screen-1024.png`, `screen-1440.png`.
- 로컬 미리보기: `http://127.0.0.1:4188/bean-pocket/records-demo.html`.
