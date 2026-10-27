# 저장·취소 버튼 — 2026-10-27

사용자와 확인한 미리보기를 일반 웹과 PWA의 저장·취소 버튼에 적용한다. 기본 문구는 `저장 / 취소`, 아이콘은 디스켓과 X이며 약 44px 높이의 작은 버튼을 사용한다. 색상은 앱의 그린 계열을 따른다. 연결 설정과 확인 결과 저장은 작업 의미가 드러나는 문구를 유지한다.

저장 중 표시는 실제 비동기 처리 상태를 따른다. 예상 시간이나 진행률을 표현하는 배경 채움은 사용하지 않는다. 기존 중복 제출 방지·불확실한 결과 보호·입력 취소 제한을 유지한다.

## 구현 검증

| 명령 | 종료 코드 | 결과 | 근거 |
| --- | --- | --- | --- |
| `node --test test/pwa-ui.view.test.mjs` (구현 전) | 1 | 기존 105개 통과, 신규 3개 의도한 실패 | `save-cancel-red.test.txt` |
| `node --test test/pwa-ui.view.test.mjs` (구현 후) | 0 | 108/108 통과 | `save-cancel-green-view.txt` |
| `npm test` | 0 | 573/573 통과 | `save-cancel-npm-test.txt` |
| `npm run build:pages` | 0 | 일반판 `df39b205d8b3` | `save-cancel-build.txt` |
| `npm run check:pages` | 0 | 산출물 검사 통과 | `save-cancel-check.txt` |

최초 전체 테스트·빌드는 sandbox의 localhost/출력 쓰기 제한으로 실패했으며 승인된 재실행에서 통과했다. 위 로그는 통과한 실행이다.

## 역할과 범위

- worker: `gpt-6-luna`, `max`, 도구 별칭 Ptolemy. 구현과 테스트 담당.
- critic: `gpt-6.1-sol`, `medium`, 도구 별칭 Einstein. 독립 검토와 브라우저 검증 담당.
- 도구는 역할 이름 지정을 지원하지 않아 별칭을 업무상 역할에 대응했다.

실제 Notion 데이터 쓰기, iPhone/Safari 실기기, 기존 설치 PWA의 업데이트 적용은 이 검증으로 보장하지 않는다. 독립 검토와 통합·게시 결과는 완료 후 함께 기록한다.

## 독립 검토 후 수정

첫 Critic 검토에서 일반 웹 화면의 저장 중 아이콘 상태 누락과 완료 체크가 그려지기 전 즉시 닫힘을 발견했다(`critic/review.md`). worker가 상태 동기화와 실제 성공 후 1초간의 완료 피드백으로 수정했다. 저장 처리 시간이나 예상 진행률을 나타내는 타이머는 추가하지 않았다.

- 회귀 2개: RED exit 1 → GREEN exit 0 (`save-cancel-fix-red-unit.txt`, `save-cancel-fix-green-unit.txt`).
- 최종 `npm test`: exit 0, 575/575 (`save-cancel-fix-npm-test.txt`).
- 이번 수정은 public과 테스트에 한정되며 PWA 소스·빌드 산출물은 변경하지 않아 일반판 `df39b205d8b3` 및 검사 결과를 재사용한다.

Critic 재검토: **Approve**. public의 pending spinner와 열린 다이얼로그 성공 체크, 중복 제출·취소·닫기·Escape 잠금, 실패 복원을 독립 브라우저 8건으로 확인했다(exit 0). `critic/recheck.md`, `critic/recheck-browser.json` 참조. PWA 검증은 앞선 결과를 재사용했다.
