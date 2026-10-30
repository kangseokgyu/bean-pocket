# 0.1점 별점 입력 게시

- 공개 주소 https://kangseokgyu.github.io/bean-pocket/
- 공개 빌드 `ba0b50b0e574`.
- 게시 커밋 `92621a45674260c71bb91db8aec313af6e62d947`.
- [Pages 실행](https://github.com/kangseokgyu/bean-pocket/actions/runs/41010891527). `probes=false`, GitHub 테스트·빌드·검사·배포 성공.
- 공개 루트 HTTP 200. 게시 파일 27개 전부 로컬 dist와 바이트 일치. 상세는 `public-files.json`.

별점은 0.1~5.0점에서 선택한다. 누른 위치와 드래그에 따라 숫자와 별의 부분 채움이 즉시 갱신된다. PWA와 서버 화면의 입력, 저장·조회, 통계·그래프, 초안 복원을 함께 변경했다. 기존 정수 기록도 유효하다.

기능별 워크트리와 codex/decimal-star-rating 브랜치에서 Worker gpt-6-luna / max와 Critic gpt-6.1-sol / medium을 순차 사용했다. 최신 main을 기능 브랜치에 통합한 후 npm test 662/662, build:pages, check:pages 및 dist Chrome 검증을 통과했다. Critic이 찾은 SVG 여백 문제를 수정하고 독립 재검토 PASS를 받았다. main에는 검증된 동일 제품 코드를 fast-forward했다.

검증은 Chrome 156의 390×844 터치 에뮬레이션과 마우스로 수행했다. 서버 체험 모드 4.3점 저장·조회, PWA 2.2점 터치와 포인터 캡처·초안 복원·비우기를 확인했다. 0.1/0.5/0.9/1.0점의 부분 채움도 래스터로 구별했다. 실제 Notion 계정 쓰기, 실기기 iPhone과 화면낭독기는 미검증이다. 기존 동적 스타일 CSP 경고 12건이 남으며 새 별점 채움은 SVG 속성을 사용한다.

Model the Domain 원칙에 따라 점수와 활성 포인터를 한곳에서 관리했다. Prove It Works 원칙에 따라 실제 브라우저 렌더와 공개 파일을 확인했다. Sequence Work into Verifiable Units 원칙에 따라 실패 테스트부터 수정·통합·독립 검토·게시 순서로 진행했다.
