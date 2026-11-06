# 흰색 배경과 미표백 종이 카드

사용자가 미리 본 생성 이미지 적용을 승인했다. 화면과 상단 배경 및 PWA 시작 배경을 흰색으로 변경하고 원두·레시피·기록·선택 카드에 승인한 원본 종이 질감을 적용했다. 이미지 바이트는 원본 그대로이며, 오프라인 캐시와 빌드 버전 해시에 포함한다. 선택과 호버의 테두리 및 강조색은 유지한다.

- 제품 커밋: `a989c143c07a9abdfc857e2403fed23fab0a46a9`.
- 기능 워크트리: `/workspace/bean-pocket-white-paper`, 기능 브랜치: `codex/white-paper-cards`. 원본 작업 브랜치는 변경하지 않았다. 최신 origin/main을 반영한 뒤 main에 fast-forward 통합했다.
- 이미지 공급·오프라인 캐시·교체 시 버전 갱신 테스트는 구현 전 누락 이미지 오류로 실패, 구현 후 통과했다.
- `npm test`: 772개 통과, 실패·취소·건너뜀 0개.
- `npm run build:pages`, `npm run check:pages`, `git diff --check`: 통과.
- 빌드 버전: `4ec4ba7dda41`.
- 일반판 Pages 실행: https://github.com/kangseokgyu/bean-pocket/actions/runs/42229079521 (`probes=false`). build와 deploy 모두 성공.
- 공개 주소: https://kangseokgyu.github.io/bean-pocket/
- 게시 후 공개 HTML의 빌드 버전 일치와 공개 CSS·종이 이미지의 로컬 산출물 바이트 일치를 확인했다.
- 이미지 SHA-256: `9eaeeb0e174fe758b55b716d27b91efc2888dd86c3e35212e7f1e7b6819a0066`.
- 브라우저 도구가 `Browser Use could not read requirements` 오류를 반환해 화면의 시각적 검증은 수행하지 못했다. 실제 기기와 실제 Notion 데이터도 이번 범위에서 확인하지 않았다.
