# T08 시험판 B 게시 기록

2026-10-18 (Asia/Seoul). 사용자가 A의 모드별 기준 지문을 제공한 뒤 B 통합·게시를 명시적으로 승인했다.

- 승인 범위: 홈 복귀 링크와 Notion 화면 이탈 안내를 추가한 B 버전. 파일 보관 방식은 A와 동일.
- main 통합: `7aa0c54` → `ff6de95aef1682d081f4491cbe6f5ddec086f2a6`, fast-forward 후 원격 반영.
- 실행: `gh workflow run pages.yml --ref main -f probes=true`, 종료 0.
- [Actions 실행 39087313953](https://github.com/kangseokgyu/bean-pocket/actions/runs/39087313953): 회귀 테스트·실험판 빌드·산출물 검사 및 게시 성공.
- B 빌드: `0f0ea09f28a8`. 로컬 빌드·검사도 종료 0.
- [게시 홈](https://kangseokgyu.github.io/bean-pocket/), [파일 보관 실험](https://kangseokgyu.github.io/bean-pocket/probes/storage/).
- 실제 HTTPS 자원 12개 모두 HTTP 200이며 승인된 로컬 산출물과 바이트 일치. [경로·해시](pages-b-http-resources.txt).
- A와 저장 모듈·manifest·SW 원본 바이트 동일 확인. OPFS 파일을 쓰거나 삭제하는 동작은 이번 게시 검증에서 실행하지 않았다.
- PC 인앱 브라우저에서 처음에는 A 화면이 남았다. 검증 탭 종료 후 재접속하여 홈·파일 실험 모두 B 빌드와 홈 복귀 링크를 확인했다. 강제 SW 전환이나 사이트 데이터 삭제는 하지 않았다. [게시 화면](pages-b-storage.png).

## 남은 실기기 업데이트 확인

사용자 제공 기준 지문:

- Safari: `b42845c6e32d09642e06ef2cf918f5d8bf6dad85a3029bbedcb0dc1cdcdcb61b`
- 홈 화면: `cd8f7d70816dd74fea6577542d7f6f201f9064276825a9b811aafe9b76707810`

각 모드에서 홈과 파일 실험의 B 빌드를 확인하고 새로 작성하지 않은 채 기존 파일 읽기만 실행해 위 값과 각각 비교한다. 이전 빌드가 보이면 요청 처리 중이 아닌 상태에서 해당 사이트 탭과 앱을 종료·재실행한다. 사이트 데이터를 지우지 않는다. 이후 두 모드의 업데이트 후 지문 일치 결과를 사용자에게 보고받았다([기록](README.md)). 완전 삭제·재설치 후 제거 결과는 아직 받지 않았다. 게시 성공을 T08 통과로 대신하지 않는다.

이 문서와 후속 증거 커밋은 보고용이며 게시된 코드·빌드를 바꾸지 않는다.
