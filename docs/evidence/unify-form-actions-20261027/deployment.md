# 게시 확인 — 2026-10-27

- 기능 커밋 및 배포 main: `6baa28d51f6b7eadb11c21d21fb22c0d67383298`.
- main 통합 후 `npm test`: exit 0, 570/570 (`integrated-test.txt`).
- main 통합 후 `npm run build:pages` / `npm run check:pages`: exit 0 (`integrated-build.txt`, `integrated-check.txt`).
- 일반판 `probes=false` 수동 실행: [Actions 40470049052](https://github.com/kangseokgyu/bean-pocket/actions/runs/40470049052), 최종 `completed/success` (`deployment-result.json`).
- 공개 주소: https://kangseokgyu.github.io/bean-pocket/
- 빌드: `4763d1ed6938`.
- HTTPS 공개 파일 20개가 모두 HTTP 200이며 로컬 최종 dist와 바이트 단위로 일치. 공개 index 빌드와 공통 버튼 모듈 포함 (`public-check.json`).
- 통합 검사 결과 확인과 게시를 묶은 최초 명령이 자동 승인 검토에서 거부되었다. 결과 파일을 별도로 읽어 테스트 570/570·빌드·검사 통과를 입증한 뒤 재실행하여 게시 성공했다.
- 원두 입력 화면 최종 390px 캡처는 `mobile.png`. 복사 화면은 문구·취소 자동 검사에 포함했으며 캡처 중 비동기 재렌더링 경합이 있어 공통 버튼을 쓰는 원두 화면을 증거 이미지로 보관했다.
- 실제 Notion 쓰기와 iPhone/Safari·기존 설치 PWA 업데이트 적용은 실행하지 않았다.

이 게시 근거의 후속 커밋은 문서·검증 파일만 포함하며 앱 소스와 빌드를 바꾸지 않는다.
