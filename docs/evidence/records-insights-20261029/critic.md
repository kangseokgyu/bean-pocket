# 독립 리뷰 — 수정 요청

- 대상 `f865280..4f864fcf81562e5ef97d77fb6a915f97e4776cbb`.
- Critic `gpt-6.1-sol` / `medium`, 코드 수정 및 추가 에이전트 없음.

## 필수 수정

1. **[P2] 승인된 최근 원두 3종의 펼친 요약을 유지해야 함** — `pwa/ui/records-insights-view.mjs:56-69`. 현재는 네이티브 select로 바뀌어 선택하지 않은 2종을 동시에 볼 수 없고, option에도 최근 날짜와 이름만 있어 최근 레시피·평가가 빠졌다. 승인된 데모 구성과 사용자의 “어떤 원두가 언제 어떤 레시피로 좋았는지 한눈에” 요구를 실제 화면에 적용하려면 최근 서로 다른 최대 3종을 선택 가능한 버튼/카드로 펼쳐 보여주고 각 원두의 최근 추출 날짜·레시피·평가를 표시해야 한다. 모델의 bean option에 필요한 최신 기록 정보를 포함하고 키보드 선택/선택 상태 및 좁은 화면을 검증한다.

2. **[P2] 스냅샷 원두 이름보다 현재 이름을 우선함** — `pwa/ui/records-insights.mjs:18-19`. v2 snapshot.bean.name이 “당시 원두”, 동일 ID live bean.name이 “현재 원두”인 입력에서 실제 선택 요약은 “현재 원두”를 반환한다. 명세는 historical facts에 snapshot을 사용하고 현재 부모는 누락한 표시 이름만 보완하도록 정했다. 스냅샷 이름을 우선하고 누락한 경우에만 live name을 사용하도록 수정하며 현재 이름을 기대하는 기존 테스트도 계약에 맞춰 바꾼다.

3. **[P2] SVG namespace 예외가 요청 URL 사용도 통과시킴** — `scripts/check-pages.mjs:148-150`. 선언 문자열 전체를 검사 전에 지우므로 정식 namespace 상수에 대한 `fetch(SVG_NS)`를 renderer에 추가해도 `checkPages`가 true를 반환한다. 격리 임시 복사한 dist에서 직접 재현했다. 이는 외부 namespace URL의 네트워크 사용은 거절해야 한다는 기존 검사 계약을 약화한다. namespace literal을 정확한 createElementNS 표현식 내부로 한정해 정규화하거나 같은 수준으로 사용처를 검증하고, `fetch(SVG_NS)`/동일 값 alias 요청을 거절하는 회귀 테스트를 추가한다. 현재 renderer의 SVG 사용 자체는 정상 DOM 생성이다.

## 확인한 사항과 한계

- 변경 테스트/모델/renderer/controller/view/보안 검사 diff 및 기존 저장소의 current-record·부모 hydration 계약을 직접 읽었다. 별도 bounded insight cursor, 필터 격리, 연결 revision/abort/세대 검사, snapshot 레시피 조건 출력, 날짜/평점 검증과 SVG 좌표 및 텍스트 대안을 확인했다.
- 최종 원문 `npm-test-final.txt`는 632 통과/0 실패이고 `build-pages.txt`는 `9cdb7caa5faa`로 완료 보고와 일치한다. 기존 631/149eb9242b74 결과를 최종 근거로 사용하지 않았다.
- 공개 산출물 임시 복사본에 `fetch(SVG_NS)`를 추가하고 검사: true(예상은 거절). 소스/실제 dist는 변경하지 않았다. namespace 예외의 변이를 기존 테스트가 검출하지 못하는 사례다.
- 브라우저 스크립트와 기록된 fixture 결과를 검토했으며 독립 전체 테스트/브라우저 재실행 및 실제 Notion/물리 키보드/Safari/Firefox 검증은 하지 않았다. 네이티브 select의 synthetic key 제한은 README에서 투명하게 설명한다.
