# 봉지 기능 제외 작업 체크리스트

- 기준 브랜치: `codex/remove-bags`
- 기준 커밋: `209e4e912f83469bbed145c4b4832952299476fd`
- 메인·origin 기준 SHA 일치와 원본 작업 폴더 clean은 메인 제공 정보로 확인했다. 통합·push·게시 담당은 메인이다.
- 사용자 지시: 실제 Notion 데이터 변경 금지, 변경 파일 직접 수정, Critic은 구현·검증 완료 후 메인이 순차 호출.

## 결정

- snapshot v2의 최상위 `recordGeneration: "bagless-v1"`을 현재 기록 식별자로 사용한다. 기존 version 2의 `bean`·`recipe` 모양은 유지한다.
- marker가 정확히 일치하는 유효 기록만 앱 화면과 별점 집계에 노출한다. 과거 행은 원시 조회와 삭제 보호에서 유지한다.
- 기존 Notion 5개 source IDs/schema와 사용자 데이터는 유지하고 변경하지 않는다.
- 봉지 관련 쓰기와 기록 `bagId` payload를 PWA·Notion client·server/public 경계에서 막는다. 미완료 journal을 자동 재전송하지 않고 unknown/partial 및 lock/recovery는 보존한다.

## 진행 체크리스트

- [x] 지정 워크트리 `AGENTS.md`, 기존 SPEC/PLAN/task, 코드 구조와 관련 skill 지침 확인
- [x] `codex/remove-bags` branch 및 clean 시작 상태 확인 (초기 ref 생성은 메인의 승인된 escalation으로 완료)
- [x] snapshot marker·과거 집계 제외 RED: `node --test test/domain.test.mjs`, exit 1, 7 tests / 6 pass / 1 fail; marker 부재에서 실패
- [x] marker만 추가한 후 RED: 같은 명령, exit 1, 7 tests / 6 pass / 1 fail; marker 통과 뒤 과거/미지원 세대가 포함된 집계(3회, 평균 3.333…)가 기대(1회, 평균 4)와 달라 실패
- [x] 도메인 GREEN: `node --test test/domain.test.mjs test/pwa-domain.test.mjs`, exit 0, 12/12
- [x] 원시 조회·숨김 기록·봉지 관계와 삭제 보호 테스트
- [x] PWA 명령/client/server/public 쓰기 차단 RED→GREEN
- [x] UI·기록 선택·상세·초안 정리 및 회귀 테스트 RED→GREEN
- [x] `npm test` (495/495), `npm run build:pages`, `npm run check:pages`
- [x] 브라우저 인터랙션은 사용자 지시에 따라 Critic 인계; 자동 통합은 fake Notion으로 검증
- [x] `docs/evidence/remove-bags-20261026/`에 RED/GREEN, 전체 실행 증거와 한계 기록
- [x] 변경 파일·스테이징을 확인하고 이번 변경만 commit 완료

## 제약 및 위험

- 실제 Notion DB·속성·행을 건드리지 않는다.
- 기존 봉지/기록을 repository read 결과에서 제거하지 않는다. UI/집계 필터와 삭제 보호 입력을 분리한다.
- 기존 미완료 작업의 자동 재전송은 금지하되 journal을 삭제하거나 unknown/partial·global lock을 해제하지 않는다.
- iPhone/Safari, 실 Notion, 실제 OPFS/native lock 재시작, Pages 공개 반영은 이 worker 실행 범위의 증거로 가장하지 않는다.

## 완료 상태

- 필수 자동 검증 통과. 합성 데이터만 사용했고 실제 Notion·공개 배포는 건드리지 않았다.
- 브라우저 수동 상호작용은 Critic 검토 시 확인 가능하도록 미실행 상태로 인계한다.
- commit SHA와 테스트 결과는 작업 완료 보고에 기록한다.

## 통합·게시 완료

- [x] 최신 main 레시피 카드 개선 통합 및 전체497/497·Pages build/check 통과
- [x] Critic 독립 안전성·Chrome 1280/390 검증 및 문서 P3 보완 재검토 승인
- [x] main 통합·push·일반판 Pages 게시 (실행40270176908)
- [x] 공개 build `da92f2364938`, HTTPS20개 파일 바이트 일치 확인

[게시 근거](../docs/evidence/remove-bags-20261026/deployment.md). 실 Notion/iPhone/Safari/실제 OPFS 장애·SW 업데이트 적용은 미검증.
