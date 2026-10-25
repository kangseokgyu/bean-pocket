# 하단 상태 토스트 게시 검증

- 공개 주소: https://kangseokgyu.github.io/bean-pocket/
- 게시 소스 커밋: `4c87fae5fd62d85e9cfbd136dbad37ae5b543a02`
- 공개 빌드: `81fed67b6192`
- 일반판 게시(`probes=false`) 실행: https://github.com/kangseokgyu/bean-pocket/actions/runs/40195510246 — build/deploy 성공.
- 상태·저장·입력 오류 안내의 하단 토스트 통합. 성공 3초 자동 숨김, 오류 유지, 모달 안 표시 및 경로 전환 후 유지 확인.
- TDD 실패 재현 후 구현. 마지막 수정은 기존 오류가 표시된 채 설정 모달을 여닫는 회귀 테스트를 추가했다.
- `npm test`: 종료 0, 486개 통과, 실패·건너뜀 0 (`test-summary.txt`). `npm run build:pages`, `npm run check:pages`: 종료 0.
- Chromium·WebKit 320/390/768px 통합 검증. 마지막 모달 열기 수정은 Chromium 390px 접근성 트리 `ignored:false` 및 Escape 종료 후 토스트 유지 확인 (`modal-accessibility.json`, `modal-toast.png`).
- 독립 Critic 검토: 경로 전환 소실과 설정 모달 열기 누락 수정 후 최종 승인. 마지막 회귀 테스트 독립 실행 1/1 통과.
- 게시 후 공개 파일 20개 HTTP 200 및 로컬 dist SHA-256 전체 일치 (`public-files.json`). CI에서도 회귀 테스트·일반판 빌드·산출물 검사 성공.
- 역할 설정: worker `gpt-6-luna / max`, critic `gpt-6.1-sol / medium`; 생성 도구에 명시. 역할 이름 지정 미지원으로 도구 별칭 Hilbert/Herschel 사용.
- 미검증: 실제 iPhone의 설치 앱·키보드·safe-area와 실제 스크린리더 발화. 기존 설치 클라이언트의 즉시 업데이트는 확인하지 않았다.

이 기록만 추가한 뒤 소스나 빌드 입력은 변경하지 않았으며, 같은 검사를 반복하지 않았다.
