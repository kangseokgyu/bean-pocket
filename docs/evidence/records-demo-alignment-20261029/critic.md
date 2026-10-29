# 독립 리뷰 — 수정 요청

- 대상: `55d5bfc..1cc3826`, Critic `gpt-6.1-sol` / `medium`. 코드 수정·추가 에이전트 없음.
- 정보 구조는 데모에 근접했다. 다만 아래 필수 두 건이 남아 있어 수정 후 재검토가 필요하다.

## 필수 수정

1. **[P2] 원두 전환 시 사라진 레시피 필터가 실제 비교 결과에 남음** — `pwa/ui/view.mjs:2386-2393`, `pwa/ui/records-insights-view.mjs:111-120`. 원두 A에서 A 전용 레시피를 필터한 뒤 원두 B를 선택하면 B의 옵션 목록에는 해당 레시피가 없으므로 select는 “모든 레시피”로 보이지만 내부 `insightRecipeFilter`는 A 레시피 ID로 남아 비교 기록이 0건이 된다. 기존 fixture를 재사용한 좁은 독립 Chrome 실행에서 `filter:"", option:"모든 레시피", rows:0, empty:["조건에 맞는 비교 기록이 없습니다."]`를 직접 확인했다. 원두 전환 시 레시피 필터를 초기화하거나 새 원두의 선택 가능한 레시피에 맞춰 상태를 정규화해야 한다. 레시피 필터 → 다른 원두 선택 및 현재 필터 레시피 삭제/갱신 경로를 회귀 테스트한다.

2. **[P2] 차트가 데스크톱에서 확대되어 데모의 정보 밀도와 달라짐** — `pwa/styles.css:666`의 `.rating-trend-chart`, `pwa/ui/records-insights-view.mjs:290`의 차트 레이아웃. 데모는 차트를 250px 높이로 유지하며 폭에 맞게 좌표를 계산한다. 실제 화면은 360×230 viewBox를 `width:100%; height:auto`로 확대하여 데스크톱에서 축 글자·점·선까지 커지고 최고 기록/비교 표를 아래로 밀어낸다. 1440px에서 독립 DOM 측정 결과 실제 SVG 460px, 데모 SVG 250px였다. 768/1024/1440 paired 캡처에서도 눈에 띈다. 데모처럼 고정된 약 250px 높이를 유지하면서 가용 폭에 맞는 viewBox/좌표를 계산하거나 동등한 비율·글자 크기로 렌더링해야 한다. 데스크톱과 모바일 paired 캡처 및 실제 chart 높이/레이블 가독성을 다시 확인한다.

## 선택 개선

- **[P3] 중복되어 실행 불가능한 선택 처리 분기** — `pwa/ui/view.mjs:2395-2399`: 바로 앞의 같은 action 분기가 항상 return하므로 이 분기는 실행되지 않는다. 기능 영향은 없지만 새로 중복된 분기를 제거하면 유지보수가 명확해진다.

## 직접 검토한 근거

- 원본 데모 HTML과 scoped CSS의 sidebar/main, summary, graph, best grid, table/card 및 breakpoint 구조를 확인했다. `demo-{320,550,768,1024,1440}.png`와 대응 production 캡처 총 10개를 모두 직접 열어 비교했다.
- 최근 원두 좌측/선택 정보 우측 구조, 920px 단일 열 전환, 720px table→동내용 card, 선택 summary의 metadata/count/유효 평균, 최고 기록 조건 grid, 펼친 비교 조건, 별 시각화, ivory/coffee 색상과 관리 목록 접힘 구조를 확인했다. 기존 green enclosing panel은 제거됐다.
- 모델/renderer/view/CSS 변경을 검토했다. snapshot 우선, 불러온 범위 표기, invalid 평점 처리, 고정 1~5/실제 날짜 좌표/텍스트 대안, recipe/date/rating 비교 정렬, 관리 fallback 및 관리 영역 paging 위치를 확인했다. controller/query/연결 격리/허용 파일·SVG 보안 예외는 이번 diff에서 변경하지 않았다. 로스팅 경과일·총 추출 시간을 새로 지어내지 않는다.
- 최종 README와 로그는 636 통과/0 실패, focused 147 통과, 빌드·브라우저 `c7ff26136829`로 일치한다. 최초 원문은 607/635이며 15 EPERM과 13 UI 실패/수정 경과가 기록되어 있다.
- 추가 실행은 `/tmp/critic-align-browser.mjs`의 좁은 fixture Chrome 실험뿐이다. 소스와 증거 이미지를 수정하지 않았다. 전체 suite와 전체 브라우저 검증은 중복하지 않았으며 실제 Notion·Safari/Firefox·물리 키보드는 미검증이다.

## 재검토 — 승인

- 대상 `1cc3826..b7fa694`(source 수정 `f559bd9`). 필수 두 건과 선택 개선의 중복 handler가 모두 해결됐다. 추가 차단 사항 없음.
- 원두 전환 시 레시피 필터를 초기화하고, data 갱신 시 선택 옵션이 사라지면 필터 상태도 정규화한다. 원두 전환 및 마지막 해당 레시피 기록 삭제에 대한 회귀 테스트를 직접 읽었다.
- 독립 Chrome fixture에서 이전 재현을 다시 실행했다. A 레시피 필터 후 B 선택 결과 `filter:"", option:"모든 레시피", rows:2, empty:[]`로 정상 표시됐다.
- 같은 독립 실행에서 1440px production/demo SVG 높이는 각각 250/250px였다. 최종 production 320/550/768/1024/1440 캡처와 demo 캡처를 직접 확인해 차트가 더 이상 확대되지 않고 sidebar→summary→trend→best grid→comparison 우선순위와 모바일 카드 표현을 유지함을 확인했다. 좁은 화면의 생략한 날짜도 텍스트 목록에서 확인할 수 있다.
- ResizeObserver 소스의 disconnected target 해제 경로를 읽고, 브라우저에서 observe/unobserve를 계측했다. 원두 선택 8회 후 active 1/detached 0, records를 떠난 뒤 active 0/detached 0이었다. 반복 렌더 및 경로 이탈에서 관측 대상이 누적되지 않았다.
- 최종 release 로그는 focused 149/149, 전체 638/638이며 빌드·브라우저·dist SW 버전 모두 `cfa4de79469e`다. controller/view/insights model/renderer/styles의 현재 소스와 dist가 byte-for-byte 일치한다.
- 독립 검증은 좁은 재현/관측 대상 정리 점검이며 전체 suite/전체 브라우저 검증은 중복 실행하지 않았다. 실제 Notion·Safari/Firefox·물리 장치/키보드 미검증 한계는 유지한다.
