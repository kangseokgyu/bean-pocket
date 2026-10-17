# T01 최소 PWA 로컬 검증

- 일시: 2026-10-18 (Asia/Seoul)
- 환경: macOS, Node v22.17.0, Codex in-app browser (PC)
- 코드 기준: 이 증거와 함께 커밋된 T01 트리. 앱 빌드 **`6738e488ff5e`**
- 범위: 최소 화면, manifest·PNG 아이콘·SW, 허용 목록 빌드·검사기. 실제 Pages·Notion·iPhone 아님
- 결과: **로컬 구현 검증 완료**, 실배포 및 실기기는 T03/T04 대기

## 실행 결과

| 명령 / 실행 | 종료 코드 | 결과 |
|---|---|---|
| `node --test test/pwa-build.test.mjs` (최초 RED, worker 실행) | 1 | 최초 모듈 부재 이후 export stub으로 재실행. 비어 있는 빌드 산출물이 허용 목록 계약을 만족하지 못하는 의도한 실패 확인 |
| 같은 명령 (최초 구현) | 0 | 전용 테스트 8개 통과 |
| 같은 명령 (critic 지적 회귀 RED, worker 실행) | 1 | 8 통과·3 실패. namespace 검사 누락, 상위 symlink를 통한 원본 덮어쓰기, scope 간 캐시 공유 재현 |
| 같은 명령 (수정 후 GREEN) | 0 | 전용 테스트 11개 통과. critic도 독립 실행해 11개 통과 |
| `npm test` (수정 전 부모 실행) | 0 | 전체 37개 통과 |
| `npm test` (최종 수정 후 부모 실행, 포트 권한 부여) | 0 | **전체 40개 통과, 0 실패, 0 skip**. [원문](npm-test.txt) |
| `npm run build:pages` | 0 | 최종 빌드 `6738e488ff5e` 생성 |
| `npm run check:pages` | 0 | 허용된 앱 파일 7개만 포함, 경로·manifest·PNG·버전·SW 캐시 정책 검사 통과 |
| `node --check` (worker 실행) | 0 | build-pages.mjs, check-pages.mjs, pwa/sw.js 구문 검사 통과 |
| 로컬 정적 HTTP 자원 확인 (부모 실행) | 0 | `/bean-pocket/`와 자원 7개 모두 200. [결과](http-resources.txt) |
| `git diff --check` | 0 | 공백 오류 없음 |

전용 테스트에는 누락 파일, 예상 밖·비밀 파일, 루트 절대 경로, API 캐시 주입, source/output symlink, 실제 경로 중첩과 원본 보존, 빌드 hash 변경, scope별 캐시 수명과 외부·query·nonGET 요청 배제가 포함된다. SW 행위 검증은 Node VM의 모의 캐시이며 실제 iPhone의 저장 수명 검증이 아니다.

## 브라우저 확인

`dist/`만 임시 디렉터리의 `bean-pocket/`에 복사하고 `python3 -m http.server 4188 --bind 127.0.0.1 --directory /private/tmp/bean-pocket-pages-preview`로 제공했다. 저장소 루트나 환경 파일은 제공하지 않았다.

Codex in-app browser에서 `http://localhost:4188/bean-pocket/`를 열어 원두 목록 제목·빈 목록·연결 전 안내·최종 빌드 버전을 확인했다. 화면 폭은 PC 1280px이며 실제 아이폰 검증으로 간주하지 않는다. 서버 기록에는 JS·CSS·PNG와 SW 설치를 위한 앱 자원 요청이 있었다.

![최종 로컬 화면](local-preview.png)

중간 빌드 `78586a7436c0`는 `127.0.0.1` 출처에서 확인했다. 같은 출처의 즉시 재실행에서는 중간 버전이 남아 있었으며, 최종 첫 실행 검증은 별도 `localhost` 출처에서 했다. 이 결과를 자동 업데이트 통과로 기록하지 않는다. 강제 skipWaiting·새로고침은 추가하지 않았고 안전한 업데이트의 최종 검증은 T27/T29에 남아 있다.

## 독립 검토

- orchestrator: `gpt-6.1-sol` / `medium`, Socrates. 우선순위·완료 조건 확인.
- worker: `gpt-6-luna` / `max`, Helmholtz. 테스트 선행 구현과 동일 담당 수정.
- critic: `gpt-6.1-sol` / `medium`, Nietzsche. 실제 소스와 요구사항 직접 검토.
- 첫 검토: P2 상위 symlink 중첩 우회, P2 다른 scope 캐시 삭제, P3 해시 입력 문구 오류.
- 조치: 회귀 RED → 동일 worker 수정 → GREEN, 문구는 부모 수정.
- 재검토: **PASS**, 3건 모두 해결. 집중 재검토 범위에서 새 오류 없음.

T03 실제 Pages 게시, T04 아이폰 첫 실행, T06 실제 Notion 직접 통신, T08 OPFS 수명은 미검증이다. 미통합 기능 브랜치를 실제 배포 완료로 보지 않는다.
