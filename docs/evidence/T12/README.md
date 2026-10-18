# T12 브라우저 통신 어댑터 — 구현 검증

T10 확정 계약 `7e06466`을 기준으로 worker Helmholtz(gpt-6-luna/max)가 담당 모듈과 기존 서버의 공용 속성 변환 추출을 구현했다. 한국어 속성 33개와 기존 도메인 입력·계산 의미를 유지했다. 실제 운영 DB나 API를 변경하지 않았다.

## 실제 실행 결과

- `node --test test/pwa-notion-client.test.mjs`: RED 종료 1, 동작 부재로 34개 실패. [원문](client-red.txt).
- 전용 테스트와 `test/notion.test.mjs`, `test/notion-config.test.mjs`: GREEN 종료 0, 전용 40개·서버 9개 통과. [원문](client-green.txt).
- 부모 빌드 경계: 초기 RED 종료 1, 모듈 공급·해시·검사 경계·symlink 4개 실패. [RED](build-red.txt), [GREEN](build-green.txt).
- T12/T13 통합 `npm test`: 종료 0, 158통과·실패/건너뜀 0. [전체 로그](npm-test.txt).
- 일반 `build:pages` / `check:pages`: 각각 종료 0, 빌드 `14e0503bd77c`.
- 실험 `build:probes` / `check:probes`: 각각 종료 0, 빌드 `31d43a080478`.
- source·dist·브라우저 미리보기의 모듈 바이트 일치, 실제 비공개 설정 토큰·ID의 공개 후보 source/dist 포함 여부 대조에서 노출 없음. 값은 결과에 출력하지 않았다.
- `git diff --check`: 종료 0.

## 브라우저 범위와 제한

로컬 정적 `/bean-pocket/` 경로에서 **실제 dist 모듈**을 import하고 주입한 모의 응답의 조회·원두 이름 복원 PASS를 확인했다. 실제 Notion 요청은 0건이다. [연결 보관과 함께 확인한 화면](../T13/local-foundation.png).

검증용 foundation-check.html은 별도 임시 미리보기 디렉터리에 있으며 `dist/` 허용 목록·공개 배포에는 포함하지 않는다. 현재 앱 첫 화면의 실제 원두 조회 연결이나 사용자가 입력한 실제 토큰 보관 기능을 완료한 것으로 보고하지 않는다. UI 연결과 최종 실제 Notion·실기기 검증은 후속 단계다. 이번 변경을 main에 통합하거나 Pages에 게시하지 않았다.

독립 critic의 T12·공용 빌드 경계 검토 PASS. critic이 직접 실행한 관련 테스트 63개와 산출물 검사·diff 검사도 통과했다. 코드 커밋 `21ce8ec`, 공용 빌드 통합 `843a886`. 실제 Notion 쓰기는 새 어댑터로 실행하지 않았다.
