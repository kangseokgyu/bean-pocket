# Critic 독립 검토 — 저장·삭제 진행 토스트

- 역할/설정: Critic, `gpt-6.1-sol`, reasoning effort `medium` (기존 생성 도구 설정 유지). 하위 에이전트·원본 코드 수정·merge·push·게시 없음.
- 기준: `f2433e4` 대비 `pwa/ui/view.mjs`, `test/pwa-ui.view.test.mjs` 변경, `investigation.md`, 각 실행 로그와 `.exit`. 앞서 읽은 프로젝트 `AGENTS.md`와 `code-review-and-quality/SKILL.md`를 적용했다.
- 판정: **Approve**. 필수 수정사항 없음.

## 요구사항 및 구현 판단

- `pwa/ui/view.mjs:189-195`의 새 정책은 pending과 상태 타입 saving, 열린 대응 모달, 실제 버튼 saving 상태를 모두 요구한다. 원두 추가·레시피 저장·기록 저장의 활성 입력 모달과 원두·레시피·기록 삭제 모달에 적용된다. 레시피 복사도 기존 recipes 입력 폼을 사용하므로 별도 정책 없이 포함된다.
- 삭제는 `deleteRequestPending`까지 확인하므로 결과 표시 단계의 남은 삭제 모달을 진행 중으로 오인하지 않는다. 입력 모달은 activeEntryKind의 모달 객체와 열린 모달 객체를 비교하므로 다른 모달 또는 닫힌 이전 폼의 버튼 상태가 토스트를 숨기지 않는다.
- 결과 타입 saved/failed/validation-error/unknown/partial/saved-read-error/deleted-read-error는 새 saving 조건 밖이다. 컨트롤러 결과 전달·재조회 실패 처리와 삭제 결과 모달·닫기 후 토스트 복원은 변경되지 않았다. 기존 pending=false 삭제 결과 토스트 억제도 유지되어 모달 결과 영역이 계속 안내를 담당한다 (`view.mjs:196`, `564-650`, `controller.mjs:896-936`).
- 연결 저장은 checking 상태이며 연결 모달은 entry/delete 모달이 아니므로 정책 밖이다. 화면 조회 loading 및 startup-checking도 정책 밖이다. 해당 동작을 확장 범위에 섞지 않았다.
- 모달 수명주기와 상태 순서를 직접 확인했다. 입력 모달 저장 버튼은 `setState()` 이후 `applyViewState()`의 `syncEntryDialogState()`에서 saving으로 바뀌고, 컨트롤러가 뒤이어 saving 상태를 전달한다. 성공은 버튼 success 상태와 saved 안내로 전환하고 기존 성공 타이머가 모달을 닫는다. 실패는 pending 해제에 따라 입력 가능 상태로 돌아간다 (`view.mjs:421-427`, `511-534`, `789-803`, `815-829`, `1001-1015`).

## 품질·접근성·보안·성능

명시적인 UI 표시 정책을 기존 토스트 배치 함수 안에서 일반화했고 새로운 컨트롤러 분기·의존성·외부 데이터 처리가 없다. 중복 추상화나 요청 범위 밖 리팩터링도 없다. 상수 개수의 모달/버튼 조회가 추가될 뿐 네트워크·반복 요청은 추가되지 않는다. 새 보안 문제는 발견하지 못했다.

버튼의 saving 텍스트, aria-busy, spinner, 중복 제출 잠금은 기존 흐름을 유지한다. 결과 토스트/모달의 상태 영역도 유지한다. hidden으로 감춘 공유 진행 토스트 대신 기존 버튼이 진행 상태를 제공한다. 실제 스크린리더 발화는 확인하지 않았다.

## 테스트와 독립 실행

- 독립 focused 명령: `node --test --test-name-pattern='bean delete button spinner|recipe and record delete spinners|entry save spinners|saving progress remains|connection modal protects|dismissing a deletion result|success delay locks|save buttons show loading' test/pwa-ui.view.test.mjs`
- **14/14 통과, 종료 코드 0**. 원두·레시피·기록/복사 saving 억제, 저장 결과 유지, 삭제 오류/unknown/partial/재조회 실패 안내 보존 및 닫기, spinner 없는 일반 saving, 연결 checking, 성공 지연 잠금을 확인했다. 증거 `critic-focused.log`, `critic-focused.exit`.
- mutation: 원본 파일을 수정하지 않고 `/private/tmp/form-progress-critic-mutation-20261028`의 별도 복사본에서 새 `statusType === 'saving'`을 `!==`로 반전했다. focused 5개 중 원두 삭제·레시피/기록 삭제·입력 저장의 기대 hidden 단언 3개가 실패했다. **종료 코드 1**, 환경 오류가 아닌 의도한 회귀 검출. 증거 `critic-mutation.log`, `critic-mutation.exit`.
- `git diff --check` 독립 실행 **종료 코드 0**.
- Worker의 관련 **168/168 exit0**, 전체 재실행 **598/598 exit0**, Pages build/check exit0를 각 로그와 이름별 `.exit`에서 확인했다. 빌드 `c8746f6422c6`. 기본 전체 실행 exit1을 감추지 않았으며 loopback listen EPERM은 최종 허용 재실행에서 해소됐다. 전체 실행은 불필요하게 반복하지 않았다.

### Optional (비차단)

`test/pwa-ui.view.test.mjs:1926`의 spinner 부재 경계는 열린 모달이 없는 경우를 검증한다. 추후 이 정책을 다시 확장한다면, 입력 모달이 열린 상태에서 버튼이 success/idle인데 saving 상태가 전달되는 경우까지 추가하면 실제 버튼 상태 guard를 더 직접적으로 보호할 수 있다. 현재 구현의 guard는 원문으로 확인했으며 사용자 요청 경로의 동작/회귀 테스트와 mutation이 통과하므로 이번 변경의 필수 수정은 아니다.

## 보고서/도식 확인 및 한계

`investigation.md`의 적용 범위, 복사 포함 이유, 연결/화면 조회 제외, 결과 상태 보존과 검증 수치가 코드/증거와 일치한다. `outputs/form-feedback-flow.html`도 실제 pending + saving + 열린 대응 모달의 saving 버튼 조건과 최종 안내 보존을 정확하게 설명하며 중요한 내용 오류가 없다. 도식의 실제 Notion/iPhone 미검증 표기도 적절하다.

이번 독립 검토는 코드·테스트·로그와 HTML 내용 검토다. 실제 브라우저 렌더링·보조기술 발화·iPhone 실기기·실제 Notion 쓰기·배포 반영을 검증하지 않았다. 원본 코드와 기능 범위를 변경하지 않았다.
