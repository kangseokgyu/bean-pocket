# 선별 보관한 독립 Critic 근거

검토 대상은 `048d2dd`다. `report.md`는 개인 워크트리 절대 경로만 생략한 보고서이며, JSON·TAP·390px PNG는 원본 바이트를 복사했다. `manifest.json`에 SHA-256을 기록했다. 보고서가 언급하는 나머지 임시 하네스·로그·PNG는 이 공개 증거 묶음에서 제외했다.

- `browser-results.json`: 1280/390px 긴 이름, 320px 짧은 이름 흐름 성공. 각 5개 삭제 PATCH, pageerror/external 배열 모두 비어 있음.
- `recovery-browser-results.json`: 세 삭제 유형의 응답 유실 후 새 controller/state와 원본 확인 UI로 복구. 수정 전 조사 문구가 포함된 역사적 실행 결과다.
- `compare.json`: 포트 4257은 기능 구현, 4258은 기준 main. 320px 긴 필터에서 양쪽 모두 scrollWidth 360 / viewport 320으로 기존 넘침 확인.
- `safety.tap`: 독립 안전성 실험 12/12, exit 0.
- `390-bag.png`, `390-record.png`, `390-rating.png`: 합성 이름만 표시된 390px 화면. Worker가 공개 전 직접 이미지를 열어 확인했다.

실행 환경은 Playwright + 설치된 Google Chrome의 headless 임시 context다. Service Worker는 차단했고 localhost 밖 요청은 abort했다. 제품 모듈을 사용하지만 Notion fetch, 파일 저장, lock은 fake/in-memory adapter다. 재시작은 같은 메모리 파일 상태를 새 state/controller가 읽는 방식이며 실제 OPFS 디스크·native lock crash recovery나 iPhone/Safari 검증이 아니다. 실제 Notion 연결·데이터 삭제·Pages 게시가 없다.

공개 전 MD/JSON/TAP의 credential/Bearer/GitHub token/private-key/email 서명을 검사해 검출되지 않았고 JSON parse도 통과했다. PNG의 텍스트/EXIF 메타데이터는 없으며 세 이미지를 직접 확인해 합성 데이터만 표시됨을 확인했다. 이 검사는 해당 선별 파일에 한정한다.
