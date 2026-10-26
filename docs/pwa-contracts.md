# PWA 브라우저 구현 계약 — T10 확정

2026-10-18. 기준 커밋 `ac93b61`, [PLAN](../PLAN.md)·[SPEC](../SPEC.md)와 [T09/M2 판정](technical-gates.md)을 따른다. 부모 결정사항을 반영한 **독립 critic 재검토 PASS로 확정한 계약**이다. 이는 T10 완료이며 후속 코드 구현 완료를 의미하지 않는다. 아래 API·형식은 후속 구현 계약이며 구현·실기기 지원 완료를 뜻하지 않는다.

## 1. 순수 로직·입력·연결 경계

- 도메인 원본은 `lib/domain.mjs` 하나다. 같은 바이트를 `dist/domain.mjs`로 공급하며 계산·검증·복사·스냅샷을 수동 복제하지 않는다.
- 원두 이름 필수·나머지 정보 선택을 유지한다. 레시피는 공용이며 원두 관계 없이 이름·양수 dose/totalWater·0℃ 초과 100℃ 이하 온도·하나 이상 단계가 필수다. 드리퍼·분쇄도·그라인더 정보·μm는 선택이며 입력한 μm만 양수로 검증한다. 첫 단계 0초·간격 0, 이후 시간 증가·물 양 양수와 기존 합계 허용 오차 `0.000001`을 유지한다.
- 추출 기록에는 원두·레시피를 각각 명시적으로 선택하고 날짜·정수 별점 1~5를 필수로 입력한다. 컵노트는 선택이다. 기존 레시피 원두 관계는 legacy 해석에만 사용하고 새 레시피 쓰기에는 넣지 않는다.
- 연결은 `{ revision, token, dataSources: { beans, recipes, steps, records } }`다. revision은 연결 저장마다 새로 만드는 UUID 세대이며 토큰만 교체해도 바뀐다. 각 데이터 소스 값도 UUID이며 토큰·설정은 주입받는다. 브라우저에서 환경변수·Node API를 사용하지 않는다. 실제 값은 소스·빌드·URL·로그·앱 캐시에 넣지 않는다.
- `createSnapshot(bean, recipe)`는 version 2에 당시 원두 전체 정보와 레시피 조건·전체 단계 값·순서를 보존한다. version 1 기록은 기존 원두 관계·기존 레시피 원두 관계 등 확인 가능한 근거를 함께 사용해 읽으며, 원두를 확정할 근거가 없거나 근거가 충돌하면 기록과 평가를 보존하고 확인 필요로 표시한다. 과거 내용을 현재 관계로 덮어쓰지 않는다. 복사 초안은 원본·단계와 참조를 공유하지 않으며 원본 ID·단계 ID·기록·평가 집계를 상속하지 않는다.

## 11. 2026-10-25 레시피 추출 가이드

- `validateRecipe`는 선택 자유 텍스트 `extractionGuide`를 정규화한다. 공용 코덱의 Notion 속성명은 `추출 가이드`, 타입은 `rich_text`이며 서버·PWA가 같은 코덱을 사용한다. Notion rich_text 분할·복원은 기존 2,000자 조각 규칙을 따른다.
- 레시피 등록·복사 폼은 textarea로 입력하고 복사할 때 가이드를 보존한다. 상세 화면에서는 물 붓기 단계 표 아래, 추출 기록 위에 표시한다. 기존 저장 레시피의 편집 기능은 제공하지 않는다.
- 새 version 2 snapshot은 당시 `extractionGuide` 문자열을 포함한다. 이전 recipe 및 version 1/2 snapshot에 필드가 없어도 검증을 통과하며, 데이터 소스에서 속성이 빠진 구버전 페이지는 빈 문자열로 읽는다.
- `verify()`는 `recipes.추출 가이드`가 없으면 구버전 호환 상태로 연결·조회를 허용한다. 그 상태에서 가이드가 빈 새 레시피는 해당 속성을 제외해 저장하고, 값이 있는 새 레시피·복사는 journal 및 Notion 쓰기 전에 `not-sent`로 거부한다. 속성이 존재하면 `rich_text` 타입이어야 한다.
- 로컬 연결 설정의 저장 형식·버전은 바뀌지 않는다. 기존 설정은 다음 초기화·연결 검증에서 원격 schema 지원 여부를 확인하며 별도 개인 설정 마이그레이션이 필요하지 않다.
- 실제 테스트·운영 데이터 소스 속성 변경 보고와 익명 증거는 [Notion 데이터베이스 구성](notion-database-setup.md) 및 [추출 가이드 증거](evidence/recipe-guide-20261025/README.md)를 참조한다. 기존 레시피 페이지 내용은 변경하지 않았다.

## 2. 속성 코덱의 단일 원본 — T12 소유

`pwa/data/notion-properties.mjs`를 canonical 원본으로 정한다. T12 worker가 기존 `lib/notion.mjs`의 `schemas`, `encodeProperties(kind, data)`, `decodePage(kind, page)` 및 내부 rich_text 처리만 **동작 변경 없이 추출**한다. 서버는 `../pwa/data/notion-properties.mjs`를 import하고 기존 공개 encode/decode를 re-export한다. 브라우저 client는 같은 폴더의 `./notion-properties.mjs`를 import한다. 스키마·직렬화 코드의 수동 사본은 두지 않는다.

기존 한국어 속성명·타입, 빈값, 단일 관계 변환, snapshot JSON 직렬화·rich_text 분할/복원 및 파싱 실패 시 기존 반환 의미를 보존한다. 코덱은 순수 함수이며 통신·파일·Node 의존성이 없다. 도메인의 `createSnapshot`과 코덱의 속성 직렬화는 별도 책임이다. 새 브라우저 client의 전송 한도 검증은 코덱 추출이나 기존 서버·도메인 입력 규칙 변경과 분리한다. 순수 코덱의 서버/브라우저 공통 회귀 검증은 T12가 담당한다.

## 3. Notion 통신 API와 안전 오류 — T12

생성 인터페이스는 `new NotionClient(token, { dataSources, connectionRevision, fetchImpl, timeoutMs = 15000 })`다. connectionRevision은 사용한 연결의 revision이며 client와 제출 초안이 각각 캡처한다. 연결은 복사·정규화 후 고정하고 요청 직전 payload도 고정한다. 공개 메서드는 다음 다섯 개로 제한한다. 반환된 원시 페이지는 내부 코덱·저장소 입력이며 그대로 렌더링하거나 기록하지 않는다.

| 메서드 | 의미 / 성공 반환 |
|---|---|
| `verify()` | 설정된 데이터 소스 4개의 GET·필수 속성 타입·관계 대상 접근을 검증해 `true` 반환. legacy 개인 DB에서 records.bean 관계가 없으면 조회 호환 상태로 허용하되 새 기록 쓰기는 막는다. 생성 권한 실증으로 확대하지 않음 |
| `queryAll(kind)` | 설정된 kind의 데이터 소스를 POST query로 전체 조회해 원시 페이지 배열 반환. **조회용 POST는 원격 쓰기가 아님** |
| `createPage(kind, domainData)` | 공유 `encodeProperties`로 변환·전송 한도 검증 후 해당 데이터 소스 부모로 페이지 생성, 검증된 원시 페이지 반환 |
| `getPage(uuid)` | UUID 페이지 GET, 같은 ID의 정상 페이지 응답 반환 |
| `archiveCreatedPage(uuid)` | T18이 journal의 현재 작업·현재 연결에 속한 확인된 신규 ID임을 검사한 뒤 호출하는 내부 취소만 허용. 정상 archive 상태의 같은 페이지 반환. 사용자용 삭제·기존 원본 수정 용도 금지 |

kind는 `beans/recipes/steps/records`만 받는다. 고정 origin `https://api.notion.com`, 고정 prefix `/v1`, `Notion-Version: 2025-09-03`을 사용한다. UUID는 형식 검증·정규화 후 고정 템플릿에 넣는다. endpoint는 `GET /data_sources/{uuid}`, `POST /data_sources/{uuid}/query`, `GET /pages/{uuid}`, `POST /pages`, 내부 취소 `PATCH /pages/{uuid}`뿐이다. 내부 취소 body는 `{ in_trash: true }`로 고정하고 같은 ID의 취소 상태를 확인한다. 사용자가 URL/path를 주입하는 API는 없고 redirect는 거부한다. 토큰은 Authorization에만 사용하며 응답·토큰은 캐시하지 않는다.

각 요청은 fetch 시작부터 응답 body 전체 읽기·JSON 해석·필수 응답 구조 검증까지 하나의 timeout 범위다. GET/query/create/archive별 object·ID·필수 구조를 검사한다. 생성 응답의 ID를 확인하지 못하거나 archive 응답에서 해당 ID의 취소 상태를 확인하지 못한 2xx는 성공이 아니다. 브라우저 통신 실패만으로 CORS 원인이라고 단정하지 않는다. **어떤 요청도 자동 재시도하지 않는다.**

`queryAll`은 매 요청 `page_size: 100`을 사용한다. 모든 페이지에서 `results`·`has_more`·커서를 검증하고 `request_status.type === 'incomplete'`면 `has_more: false`라도 오류로 끝낸다. 공식 문서의 10,000개 결과 잘림을 전체 성공으로 오인하지 않는다. `has_more: true`인데 커서가 없거나 비었거나 이미 사용한 커서로 반복·순환하면 오류다. 도중 오류·잘림에는 누적한 부분 배열을 반환하지 않는다. 2025-09-03 응답에서 해당 상태 필드가 없으면 필수 기존 구조와 커서를 검증하되, 있는 상태 표시의 incomplete는 반드시 거부한다.

전송 전 rich_text 각 text 조각은 최대 2,000자, rich_text를 포함한 요청 배열은 최대 100개, 직렬화한 전체 UTF-8 JSON은 보수적으로 500,000바이트 이하로 검사한다. 긴 스냅샷은 기존 코덱의 2,000자 분할을 사용하되 배열·전체 요청 한도를 넘으면 전송 전에 거부한다. T18은 부모와 모든 단계의 전송 가능성을 첫 쓰기 전에 검사한다. 이는 원래 레시피·컵노트 등 도메인 입력 필수/선택·값 규칙을 바꾸는 제한이 아니다.

안전 오류는 `{ code, httpStatus?, writeState: 'not-sent' | 'rejected' | 'unknown', retryAfterSeconds? }`뿐이다. code는 고정된 분류값이고 UI는 코드별 정적인 한국어 안내를 사용한다. 원문 API message·본문·토큰·ID·URL·원본 Error·stack·cause를 첨부하지 않는다. Retry-After의 유효한 비음수 초 값만 선택적으로 전달하며 재전송을 예약하지 않는다.

| 상황 | 요청 단위 writeState / 작업 전체 판정 |
|---|---|
| 입력·직렬화·전송 한도 검증 실패, 미전송 | `not-sent`. 이 작업의 앞선 쓰기는 별도로 고려 |
| GET/query 오류 | `not-sent`. POST query도 원격 변경을 하지 않음 |
| 쓰기의 HTTP 400/401/403/404/409/413/415/422/429 명확한 거절 | `rejected`. 앞선 성공·불확실 쓰기가 있으면 작업 전체는 부분 저장/확인 필요일 수 있음 |
| 쓰기 dispatch 후 네트워크·시간 초과·408·5xx·잘못된 2xx body, 기타 성공/거절을 확인하지 못한 응답 | `unknown`. 응답 유실·해석 실패를 미저장으로 간주하지 않으며 자동 재전송 금지 |

## 4. 작업 6상태·키·journal — T14

| 상태 / 저장값 | 의미와 전이 |
|---|---|
| 미제출 / `not-submitted` | 초안 검증·취소 가능. 원격 쓰기 전 |
| 처리 중 / `processing` | journal 보관 완료 후 현재 키로 실행 중. 다른 탭·창 제출 차단 |
| 성공 / `succeeded` | 필요한 모든 쓰기 성공 확인. 새 ID 보존 후 재조회하며 재조회 실패를 저장 실패로 바꾸지 않음 |
| 명확한 실패 / `failed` | 미전송·명확한 거절 또는 확인된 내부 취소 완료. 앞선 쓰기·불확실성 검토 후 수동 재제출 가능 여부 판정 |
| 확인 필요 / `unknown` | 불확실 쓰기 또는 종료 뒤 남은 processing. 원본 확인·재조회 전 잠금 유지 |
| 부분 저장 / `partial` | 일부 쓰기 성공·취소 실패. 확인된 항목과 unknown 항목을 구분하며 완전한 항목으로 제공하지 않음 |

정규화·검증한 payload는 깊은 복사로 고정하고 정렬된 객체 키·유지된 단계 배열 순서의 JSON을 SHA-256 지문화한다. 사용자 의도 한 번마다 UUID 작업 키 하나를 만든다. 같은 키는 같은 payload 지문에만 대응한다. 단계 제거·순서·값 변경은 새 키이며 성공 뒤 의도적인 반복 기록은 같은 날짜·값이어도 새 키다. 새 키·연결 교체로 unresolved 작업을 우회하지 않는다.

앱 전용 `submission-journal.json`은 `{ schemaVersion: 1, activeConnectionRevision, connectionGuard, operations }`다. activeConnectionRevision은 현재 확정 연결의 UUID이며 최초 연결 진행 중에만 null을 허용한다. 각 operation에는 `key, kind, connectionRevision, targetFingerprint, payloadFingerprint, status, createdPages, updatedAt`을 둔다. kind는 생성 명령 종류, targetFingerprint는 정렬된 데이터 소스 ID 대응표의 SHA-256이며 토큰·토큰 지문은 포함하지 않는다. createdPages는 확인된 신규 `{ kind, id, archiveState }` 목록이며 archiveState는 `active/archived/unknown`이다. 토큰·컵노트·전체 payload 원문을 journal에 보관하지 않는다. ID·지문도 공개 로그·UI 이벤트로 내보내지 않는다.

connectionGuard는 평상시 null, 연결 저장 중에는 `{ phase: 'processing' | 'unknown', candidateRevision, targetFingerprint }`다. candidateRevision은 저장할 새 연결의 UUID다. 저장 실패·손상으로 journal을 신뢰할 수 없으면 빈 journal로 대체하지 않고 쓰기를 차단한다. 재실행 후 독점 잠금을 얻었는데 processing이 남아 있으면 unknown으로 복구한다. 사용자 원본 확인 체크와 같은 작업 대상의 정상 재조회가 모두 있어야 확인 필요 해제를 허용한다. 실패·부분 상태의 재제출은 앞선 쓰기·취소·unknown을 검토한 후에만 허용하며 자동 실행하지 않는다.

## 5. app-wide 배타 구역 — T14, 연결 교체에도 동일 적용

`withWriteLock(action)`은 `navigator.locks.request('bean-pocket-write-v1', { mode: 'exclusive', ifAvailable: true }, callback)`을 사용한다. 미지원·요청 실패·callback의 lock이 null이면 fail-closed로 Notion 쓰기와 연결 교체를 시작하지 않는다. 메모리 lock·BroadcastChannel·별도 저장소로 대체하지 않는다.

lock 안에서 **connection 파일과 journal 재읽기 → revision 일치 및 기존 확인 필요/부분 저장/연결 저장 가드 검사 → processing 영속 보관과 재읽기 확인 → 네트워크 → 결과 영속 보관**을 완료한 뒤 lock을 반납한다. Notion 변경을 전송하기 전 파일 revision과 journal.activeConnectionRevision, 초안·client·작업이 캡처한 revision이 모두 현재 값과 같아야 한다. 다르면 안전 오류 `stale-connection`과 `writeState: 'not-sent'`로 차단하고 현재 연결 재로드·초안 재확인을 요구한다. 알림 수신이나 guard가 null이라는 사실만으로 전송을 허용하지 않는다. 작업 도중 각 확인된 신규 ID도 다음 원격 쓰기 전에 보관한다. journal 쓰기·close·재읽기 결과가 불확실하면 원격 쓰기 시작 또는 계속 실행을 차단한다. 결과 보관 실패는 메모리에서도 잠그고, 다음 실행은 남은 processing/손상 상태를 확인 필요로 처리한다. 프로세스 종료로 lock이 풀려도 작업이 미저장이었다고 판단하지 않는다.

BroadcastChannel은 상태 변경 알림·세대값으로 UI 재조회만 돕는다. 비밀·원문 payload를 전달하거나 배타 구역을 대체하지 않는다. 보장은 같은 origin·저장소 파티션에서 같은 앱을 사용하는 창 범위이며 다른 기기의 전역 중복 방지로 확대하지 않는다.

## 6. OPFS 연결 파일과 활성 연결 교체 — T13·T21

전용 디렉터리는 `bean-pocket-private-v1`, 파일은 `connection.json`과 T14 소유 `submission-journal.json`이다. T07 가짜 시험 파일 경로와 섞지 않는다. Connection 형식은 `{ schemaVersion: 1, revision: UUID, token: string, dataSources: { beans, recipes, steps, records } }`이며 revision·네 UUID·필수 키·토큰 문자열을 검증한다. 헤더만 있거나 0바이트인 파일, 손상 JSON, 맞지 않는 schemaVersion의 자동 복구·호환 지원은 없다. 부재와 손상·미지원·권한·용량·저장 불확실은 구분한다.

파일 어댑터는 `readConnection()`에서 유효 Connection 또는 부재인 경우만 null을 반환하고 나머지는 안전 오류로 구분한다. `writeConnection(candidate)`는 검증·serialize·쓰기·close·readback 검증까지 성공한 Connection을 반환한다. 어댑터가 활성 연결을 직접 바꾸지는 않는다.

T21은 동일한 withWriteLock 안에서 두 파일과 journal을 검사한 후 새 연결 verify와 교체를 조정한다. 토큰만 바꾸는 경우도 새 candidateRevision을 만들며, **해당 revision의 guard 영속 보관 → validate·serialize → native createWritable staging·write·close commit → 새 connection 파일 readback과 후보/revision 일치 확인 → journal.activeConnectionRevision 교체와 guard 해제를 한 번의 원자적 journal close로 보관·확인 → 메모리 활성 연결 교체** 순서다. pending 저장·unknown/partial 작업이 있으면 연결을 교체하지 않는다. 다른 창의 오래된 client는 새 파일·journal 세대 검사에서 차단한다.

최초 연결 초기화는 lock 안에서 connection과 journal이 **모두 없음**을 확인한 경우에만 허용한다. connection만 있거나 journal만 있는 경우, revision 불일치·누락은 빈 상태나 새 최초 연결로 대체하지 않고 쓰기를 차단한다. 사용자 원본 확인과 원래 작업 대상의 정상 재조회·설정 복구를 거쳐 두 파일의 revision 및 미해결 상태를 정합화하는 명시적 복구 경로로만 회복한다. 잃은 이력을 미저장으로 간주하지 않으며 원래 대상·상태를 확인할 수 없으면 차단을 유지한다.

기존 유효 파일 보존은 close를 시도하기 전 실패에 대해 native 임시 쓰기를 abort하는 범위로 한정한다. close 호출·성공 이후 또는 그 결과를 확인하지 못한 때에는 이미 새 내용이 저장됐을 수 있다. close/readback 불확실은 **설정 저장 확인 필요**로 두고 활성 연결 변경·Notion 쓰기를 차단한다. 사전 processing 가드는 종료 후에도 확인 필요로 남으며 설정 재입력만으로 우회하지 않는다. 새 파일 생성 도중 실패해 남은 0바이트 파일은 유효 설정으로 취급하지 않는다.

정상 업데이트는 같은 파일·schemaVersion을 유지한다. OPFS 외 다운로드·파일 앱·localStorage fallback과 앱 자체 암호화·잠금 UI를 추가하지 않는다. 이 계약은 최종 연결 파일 구현의 삭제 수명 실증이 아니며 T29에서 재검증한다.

## 7. 레시피 원격 완전성과 내부 취소 — T15·T18~T20

스키마 변경이나 새 완료 속성 없이 부모 레시피를 만든 후 단계를 **N → … → 2 → 1 역순으로 직렬 생성**한다. 저장하는 order 값은 원래 1..N이며 조회·스냅샷에서는 오름차순으로 정렬한다. 1번을 마지막 원격 생성의 commit gate로 사용하고 모든 성공·journal 기록을 확인한 뒤 작업 성공으로 확정한다.

조회·저장 직전에는 queryAll의 **전체 페이지 조회 성공**, 삭제 상태, 레시피 관계의 0/1 관계, 추출 기록의 원두·레시피 관계를 검사한다. 새 레시피에는 원두 관계가 없다. 기존 recipes.bean 관계는 legacy 기록 해석을 위해 읽을 수 있으며 새로운 레시피 생성·복사에는 기록하지 않는다. has_more가 남은 관계나 잘린 조회를 임의의 단일 관계로 변환하지 않는다. 전체 단계를 order로 정렬해 `validateStoredRecipe`로 1부터 연속·중복 없음·첫 시간 0·이후 시간 증가·양수 물 양·간격/누적값·총량을 검증한다. 파생값을 조용히 재계산해 외부 원본을 정상화하지 않는다.

부모 우선 취소만으로 조회 경쟁까지 막았다고 판단하지 않는다. legacy 레시피 원두 관계가 있는 경우 이를 보존·비교할 수 있지만 공용 레시피의 유효성은 원두 관계에 의존하지 않는다. 레시피 조건 필드(name/dripper/dose/grind/grinder/grinderSetting/microns/temperature/totalWater)·단계·`last_edited_time`을 재검증하며, 값이나 버전이 바뀌거나 최종 확인에 실패하면 조립 결과를 폐기하고 재조회를 요구한다. 최종 확인 없이 오래된 활성 부모와 새 자식을 결합한 결과를 노출하거나 스냅샷으로 저장하지 않는다. 이는 실제 API에서 관측한 범위의 유효성 규칙이며 최종 GET 이후 외부 변경까지 막는 Notion transaction 보장이 아니다.

기존 epsilon 때문에 극소량 끝 단계가 빠진 정방향 prefix가 합계 검증을 통과할 수 있다. [최소 재현](evidence/T10/completeness-probe.txt)에 따라 허용 오차는 유지하고, 역순 생성 중간 상태는 **order 1 부재**로 제외한다. N=1도 그 한 단계를 만들기 전에는 완전하지 않다. 다른 창·재실행에서 이 원격 조건으로 불완전 레시피를 목록·복사·기록 대상으로 숨긴다. 외부에서 Notion 원본을 변경한 경우 자동 복구하지 않으며, 이 방식이 외부 수정의 임의 누락까지 탐지한다고 보장하지 않는다.

실패 때 T18은 journal의 **현재 작업이 생성한 확인된 부모 레시피 ID부터 archive하고 정상 취소 응답을 확인한 경우에만 자식 정리**를 진행한다. 부모 취소가 실패·unknown이면 자식에 손대지 않고 partial/unknown을 보존한다. 부모 취소 확인 후 자식 취소가 실패해도 남은 새 항목과 불확실성을 기록한다. 응답을 잃어 ID를 모르는 생성 항목을 찾아 자동 삭제하지 않는다. 앞선 unknown은 다른 확인된 항목을 취소해도 사라지지 않는다. 원본 복사 대상이나 기존 운영 항목은 내부 취소 대상이 아니다.

## 8. 재조회·안전한 SW 적용 — T27 후속 구현

앱 시작·사용자 새로고침·저장 성공 후 최신 조회를 실행한다. 실패를 빈 목록으로 바꾸지 않으며 성공 뒤 재조회 실패는 “저장은 성공했으나 최신 목록을 불러오지 못함”으로 구분한다. 주기적 동기화·오프라인 Notion 데이터 저장은 추가하지 않는다.

SW 자동 safe apply는 현재 활성 창만이 아니라 **같은 scope의 모든 제어 창**에서 dirty draft 없음·메모리 pending 없음·journal processing 및 unknown/미해결 partial·connectionGuard 없음이 확인될 때만 허용한다. 각 창은 prepare에서 **새 입력·초안 변경·제출·연결 교체 동결을 완료하고 clean 상태를 재확인한 뒤에만 ACK**한다. ACK 뒤에도 apply 또는 중단까지 동결을 유지한다. 새 dirty 감지·동결 실패·창 집합 변경은 해당 generation을 무효화하며 응답 없는 창·실행 중 요청·dirty 상태가 있으면 대기한다. apply 직전에 모든 창이 현재 generation의 prepared·동결 상태인지와 clean/journal 상태를 다시 확인한다. 중단·generation 무효화 때에는 동결을 해제하고, 다음 generation에서 창 목록·응답·journal을 새로 수집해 낡은 ACK를 재사용하지 않는다. 동일 배타 구역과 결합해 ACK 후 새 입력·제출이 끼어드는 경쟁을 막는다.

이 핸드셰이크는 **T27에서 자동화와 실제 브라우저로 구현·검증할 후속 기능이며 현재 미구현·지원 미검증**이다. 무조건 skipWaiting·강제 reload를 하지 않으며 업데이트 알림·버튼 UI를 추가하지 않는다. 앱 캐시는 앱 파일만 포함한다.

## 9. 파일 소유와 검증 인계

| 소유 | 파일 / 범위 |
|---|---|
| T11 | `lib/domain.mjs` 단일 원본과 정적 공급, 도메인 의미 보존 |
| T12 | `pwa/data/notion-properties.mjs` 추출·공유 코덱, `pwa/data/notion-client.mjs`, 관련 Node 테스트와 `lib/notion.mjs`의 최소 import/re-export 변경 |
| T13 | `pwa/platform/connection-file.mjs`, Connection 형식·native staging·재읽기 검증 |
| T14 | `pwa/state/submission-state.mjs`, journal·Web Locks·재실행 복구 |
| T15 | `pwa/data/read-repository.mjs`, 전체 조회·관계·완전성 판정 |
| T16~T20 | `pwa/commands/create-*.mjs`·복사 명령, 위 계약 재사용 |
| T21~T26 | `pwa/app.mjs`·`pwa/styles.css`의 연결→조회→입력 화면 직렬 통합 |
| T27 | 앱 수명·SW 세대별 모든 창 핸드셰이크 |
| 부모 | 빌드 허용 목록·공유 코덱 정적 공급·hash·캐시·검사기·workflow·package.json 통합. 다른 worker가 동시에 수정하지 않음 |

Node 내장 테스트에 fetch·OPFS·locks를 주입해 페이지 잘림·커서 순환·모든 쓰기/취소 실패 지점·close/readback 불확실·동시 창·종료 복구·구버전 응답을 검증한다. 후속 회귀 항목에는 다른 창의 연결 교체 후 오래된 client/초안의 쓰기 차단과 파일 한쪽 부재 복구, 부모 조회 뒤 archive·극소량 자식 삭제가 끼어든 조립 결과 거부를 포함한다. T27은 clean ACK 뒤 입력 시도·동결 실패·apply 직전 재확인·중단 시 해제·창 집합 변경을 자동화와 실제 브라우저에서 검증한다. CUA 실제 브라우저의 공개 흐름 결과는 Node 모의 결과와 별도로 기록한다. T28은 연결→원두/레시피→복사→반복 기록→재조회 흐름과 릴리스 산출물을 검증하고, T29는 실제 Pages·Notion·지정 iPhone·PC·셀룰러와 **최종 실제 연결 파일 수명**을 재검증한다. 모의 검증을 실제 Notion·실기기 통과로 보고하지 않는다.

공식 근거와 결정 재현은 [T10 근거 확인](evidence/T10/source-check.md), [최소 재현](evidence/T10/completeness-probe.txt)을 따른다. 계약 작성 증거와 검토 상태는 [T10 기록](evidence/T10/README.md)에 남긴다.

## 10. 2026-10-22 공용 레시피·독립 추출 기록 보완

이번 기능 변경은 위 계약의 과거 날짜·완료 상태를 소급 변경하지 않고, 관련 데이터·journal 경계를 다음처럼 보완한다.

- Notion `records.beanId`는 `원두` relation이며 대상은 beans다. relation 부재는 legacy 개인 DB 조회를 허용하지만 검증된 새 쓰기 지원으로 간주하지 않는다. 기록 생성은 schema 지원을 확인하고 원두·레시피 선택을 검증한 뒤에만 journal에 등록·전송한다.
- 새 레시피는 beans와 독립적으로 생성·복사한다. 과거 recipes.bean relation은 이름 변경·삭제하지 않고 legacy 근거로 읽는다.
- 새 기록은 beanId와 recipeId를 각각 저장하며 bagId는 허용하지 않는다. version 2 snapshot에는 당시 원두 전체 정보와 레시피 전체 조건·단계 순서를 기록한다. 기존 version 1 snapshot은 원두 관계·기존 레시피 원두 관계·기존 레시피 원두 관계 등 일치하는 근거로만 해석한다. 추론 불가·충돌은 기록을 버리거나 평가를 초기화하지 않고 확인 필요로 보존한다.
- 이미 준비된 journal이나 다른 탭에서 온 과거 record payload에 bean 선택이 없으면 새 버전에서 보완 추정하거나 자동 재전송하지 않는다. 차단은 원격 요청 전 `not-sent`로 확정되어 기존 작업을 중복 전송하지 않는다.
- 원두 삭제는 실제 기록 의존성 및 unresolved legacy 기록이 있으면 차단한다. 독립 레시피의 legacy relation 하나만으로 삭제를 막지는 않는다.

## 11. 2026-10-26 봉지 전체 제거 계약

앱·서버는 beans/recipes/steps/records 4개 DB만 설정·검증·조회한다. 봉지 스키마·모델·record.bagId·봉지 기반 원두 추론은 제거한다. 과거 연결의 추가 bags 키는 사용하지 않으며 파일을 읽는 것만으로 다시 쓰지 않는다. 원격 DB·속성·행의 마이그레이션이나 호환 조회는 하지 않는다.

유효한 v2 snapshot의 `recordGeneration: "bagless-v1"` 표시·집계 정책을 유지한다. 숨겨진 과거 기록은 원시 기록과 삭제 보호에 보존한다. 봉지에서만 원두를 알 수 있던 기록은 unresolved로 남겨 원두 삭제를 차단한다. 레시피 관계의 불완전·다중·제외 기록도 삭제를 fail-closed로 막는다. 봉지 입력은 네트워크 전 거절하며, 과거 journal은 자동 전송하지 않고 unknown/partial·lock·중복 차단을 유지한다.
