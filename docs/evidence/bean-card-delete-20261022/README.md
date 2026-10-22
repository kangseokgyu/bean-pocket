# 원두 카드 삭제 — 2026-10-22

원두 카드 오른쪽 위에 46×46px 휴지통 버튼을 추가했다. 원두명을 포함한 확인에서 취소하면 쓰지 않으며, 확인하면 Notion 휴지통으로 이동한다. 봉지·레시피가 연결되었거나 제외된 데이터가 있어 관계를 확인할 수 없으면 삭제하지 않는다. 기존 입력 초안은 유지한다.

## 범위와 검토

- 기능 워크트리 `codex/bean-card-delete`, 구현 커밋 `33f9899`. 최신 main `87705f1`의 전체 화면 로딩 변경을 기능 브랜치로 통합했다.
- 삭제 전 최신 관계 조회와 원두 데이터 소스 소속을 검증한다. 기존 생성 실패 cleanup의 `archiveId` 보호를 유지한다.
- 삭제 대상 ID·상태를 PATCH 전에 journal에 기록한다. 응답 유실 시 자동 재전송하지 않고 원래 대상 GET으로 휴지통/활성 상태를 확인한 뒤 복구한다. 404·목록 부재로 성공 판정하지 않는다. 기존 journal을 계속 읽을 수 있으며 새 삭제 작업에만 `deleteTarget` 필드가 추가된다.
- 주 에이전트가 기능·설계·입력 검증·원격 쓰기 경계·기존 생성/복구 회귀를 직접 검토했다. 별도 Critic(`gpt-6.1-sol / high`, Epicurus)은 429로 작업 전에 중단되어 독립 검토를 완료하지 못했다. 사용자에게 알렸으며 사용자는 주 에이전트의 직접 구현·검증·게시를 승인했다.
- Worker `gpt-6-luna / max` 및 승인된 대체 `gpt-6.1-sol / medium`도 반복된 429로 코드 변경 전에 중단됐다. Orchestrator `gpt-6.1-sol / medium`, Laplace의 계획 이후 주 에이전트가 구현했다. 당시 지침에 따른 설정이며 이후 최신 지침은 Orchestrator·Critic high이다.
- Notion 공식 [Trash a page](https://developers.notion.com/reference/trash-page)를 확인했다. 기존 고정 API 버전 `2025-09-03`을 유지하고 `PATCH /pages/{id}`, `in_trash: true`를 사용한다.

## 실행 결과

- `node --test test/pwa-bean-delete.test.mjs`: exit 1, 신규 12개 실패. 삭제 명령·클라이언트 메서드 부재의 의도한 실패([RED](red.tap)).
- `node --test test/pwa-ui.view.test.mjs`: exit 1, 휴지통 버튼 부재의 의도한 실패([UI RED](view-red.tap)).
- 초기 구현 관련 검증: 52개 중 51개 통과. 미확정 복구 대기 시 삭제 버튼 비활성화 누락을 수정했다.
- `node --test test/pwa-bean-delete.test.mjs test/pwa-ui.view.test.mjs test/pwa-submission-state.test.mjs test/pwa-commands.test.mjs test/pwa-ui.integration.test.mjs`: exit 0, 117/117 통과([관련 결과](focused.tap)).
- 최신 main 통합·추가 경계 테스트 후 `TZ=UTC npm test`: exit 0, 410/410 통과([전체 결과](feature-tests.tap)). 정상/취소/관계·제외행/조회실패/잘못된 소속/잠금·동결·중복/연결변경/유실응답·재시작 복구/404/명확한 거절/손상된 journal/삭제대상 경계/초안 유지/성공 후 조회 실패를 포함한다.
- `npm run build:pages`: exit 0, 일반판 빌드 `d456a8e837a4`([빌드](feature-build.txt)).
- `npm run check:pages`: exit 0([검사](feature-check.txt)).
- `git diff --check`: 구현·테스트·문서 변경 exit 0. TAP 원문 공백은 검사 대상에서 제외하며 원문을 보존한다.
- 설치된 Chrome을 별도 임시 프로필로 실행하고 메모리 저장소·가짜 Notion과 실제 앱 view/controller/명령/저장소 어댑터를 사용했다. 320·390·768·1440px에서 가로 넘침/제목·버튼 겹침 없음, 46×46px 터치 영역, 키보드 Enter·확인 취소 무쓰기·정상 삭제 후 목록 갱신·관련 봉지 삭제 차단 통과, 콘솔/page 오류 0([결과](browser.json), [390px 화면](mobile.png)). 최초 검증에서는 검증 서버의 favicon 누락 404가 있어 서버에 data favicon을 추가한 뒤 재검증했다. 제품 코드 문제는 없었다.

## 한계와 게시

- 실제 Notion 데이터를 만들거나 삭제하지 않았다. iPhone/Safari 실기기 조작도 수행하지 않았다. 외부 Notion 편집은 기기 잠금 대상이 아니며 관계 검사는 삭제 직전 조회 기준이다.
- 별도 Critic 독립 검토는 429로 미완료다. 사용자 승인에 따라 주 에이전트 직접 검토와 실제 자동/브라우저 검증으로 진행했다.
- 게시 결과와 공개 자원 일치는 `deployment.md`에 후속 기록한다.
