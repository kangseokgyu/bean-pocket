# 추출 기록 데모 삭제 — 2026-10-29

- 대상은 이 대화에서 실제 화면으로 옮긴 `records-demo.html`과 전용 CSS·모듈이다. 헤더 진입점·전용 링크 스타일·데모 전용 테스트도 제거했다.
- 실제 추출 기록 모듈·레이아웃은 변경하지 않았다. 별도 카드 선택 데모의 기능은 유지하며, 삭제된 페이지를 가리키던 링크만 실제 `index.html#/records`로 교체했다.
- 소스·게시 허용 목록과 SW 프리캐시에서 세 파일을 제외했다. 이전 로컬 dist에 남은 세 파일은 빌더의 기존 출력 안전 검사에서만 정리할 수 있다. 일반 산출물 검사는 재혼입을 거부하며 symlink 거부도 유지한다.
- 삭제 위주의 작은 변경으로 서브에이전트 없이 직접 구현·검증·리뷰했다. 제거 범위, 실제 화면 모듈의 무변경, 잔여 참조, 허용 목록·캐시 정합성, 보안 검사와 테스트 보존을 검토했다.

## 실행 결과

| 검증 | 결과 | 근거 |
| --- | --- | --- |
| 삭제 동작 RED | 의도한 실패: 기존 빌드가 데모를 포함 | `red.txt` |
| 초기 집중 검증 | 이전 dist의 데모가 안전 검사에서 거부됨. 정리 전용 허용을 추가하고 일반 검사·symlink 거부를 검증 | `focused.txt` |
| 잔여 링크 RED | 카드 선택 화면의 삭제 대상 링크를 검출 | `link-red.txt` |
| 최종 집중 검증 | 24/24, 종료 0 | `focused-final.txt` |
| 최종 `npm test` | 631/631, 실패·skip 없음, 종료 0 | `npm-test-final.txt` |
| `npm run build:pages` | `85e18f605e6d`, 종료 0 | `build-final.txt` |
| `npm run check:pages` | 종료 0 | `check-final.txt` |
| 격리 Chrome·로컬 서버 | 세 주소 HTTP 404, 앱 시작·링크 제거·연결 버튼·320/550/1440px·오류/넘침 없음 | `browser-final.txt`, `browser-validation.mjs`, `records-*.png` |
| 소스 공백 검사 | `git diff --check` 종료 0 | 직접 확인 |

브라우저는 실제 Notion 연결 없이 실행했다. 처음 연결 설정창을 닫고 헤더를 캡처했다. 실제 Notion 조회·저장·삭제, 기존 실제 기기의 캐시 갱신과 iPhone Safari는 이번 검증에 포함하지 않았다. 공개 게시와 세 삭제 주소의 404 확인은 배포 후 기록한다.

## 게시 완료

- 기능 커밋 `e187ce1`을 main에 fast-forward 후 push했다. 동일 소스의 통합 상태는 CI에서 전체 테스트·빌드·산출물 검사를 다시 통과했다.
- 일반판 `probes=false` 게시 성공: https://github.com/kangseokgyu/bean-pocket/actions/runs/40860051020 (`deployment.json`).
- 실제 앱: https://kangseokgyu.github.io/bean-pocket/#/records , 공개 빌드 **`85e18f605e6d`**.
- 공개 앱 파일 26개 모두 HTTP 200이며 최종 로컬 빌드와 바이트·SHA256 일치. `records-demo.html`, `records-demo.css`, `records-demo.mjs`는 각각 HTTP 404 (`public-verification.json`).
- 실제 기기의 기존 SW 캐시 갱신, iPhone Safari/홈 화면과 실제 Notion 동작은 확인하지 않았다.
- GitHub 실행의 Node 20 지원 종료·ubuntu-latest 변경 안내는 있었으며 배포는 성공했다. 워크플로는 변경하지 않았다.
