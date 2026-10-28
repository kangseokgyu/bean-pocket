# RED 확인

- `node --test test/pwa-records-demo.test.mjs` — 종료 코드 1. `pwa/records-demo.mjs`가 없어 레코드 계산·선택 동작을 가져올 수 없음.
- `node --test test/pwa-build.test.mjs` — 종료 코드 1, 14개 중 3개 실패. 빌드 결과에서 데모 파일 누락, 보안 검사를 위한 데모 자산 미공급, Service Worker 기대 목록과의 불일치를 확인.
- 실패 로그는 이 변경 전 상태에서 테스트 명령의 표준 출력으로 확인했다. 다음 단계에서 최소 구현 후 두 명령을 다시 실행한다.
