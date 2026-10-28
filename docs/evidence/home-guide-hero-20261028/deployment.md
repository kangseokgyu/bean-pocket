# 홈 히어로 게시 확인

- 요청: 04-guide 시안의 히어로만 적용. 새 홈 섹션은 추가하지 않았다.
- 기능 커밋: `486866c`. 독립 리뷰 포함 게시 커밋: `f8afd9a24d46078387ccc622de4c3149cf84772f`.
- 기능 워크트리와 `codex/home-guide-hero` 브랜치에서 구현·검증하고, 깨끗한 main에 fast-forward 통합했다. 사용자 상시 승인으로 push 및 `pages.yml`, `probes=false` 게시를 실행했다.
- 공개 주소: https://kangseokgyu.github.io/bean-pocket/#/home
- 공개 빌드: `0b2385480db2`.
- 실행: https://github.com/kangseokgyu/bean-pocket/actions/runs/40705606917 — build/deploy 모두 success. 통합된 main의 테스트·일반판 빌드·검사가 게시 전에 통과했다.
- 로컬 전체 테스트 610/610, 집중 테스트 1/1, 일반판 빌드·파일 검사 통과. 320/390/768/1280px 브라우저 검증에서 가로 넘침 없음. 자세한 로그는 validation.md 참조.
- 공개 파일 20개가 모두 HTTP 200 및 로컬 빌드와 SHA-256 일치. `public-files.json`의 allMatch=true.
- 공개 IAB 브라우저에서 새로고침 후 새 영문 문구·한국어 제목·설명·CTA 및 빌드 표시를 확인했다. 추출 시작 클릭으로 `#/brew/bean` 이동 및 홈 복귀를 확인했다. 화면 캡처는 CUA 인라인으로 확인했고 PNG 파일로 저장하지 않았다.
- 실제 Notion 쓰기, 실제 iPhone/Safari 설치형 PWA, 장기간 캐시 업데이트는 미검증이다. 로컬 시각 검증은 OPFS 초기화 제약 때문에 제작 view/CSS를 읽는 별도 임시 미리보기를 사용했다. 공개 홈은 정상 표시를 직접 확인했다.
- 실제 에이전트 생성 설정: Worker `/root/worker`는 `gpt-6-luna` / `max`; Critic `/root/critic`은 `gpt-6.1-sol` / `medium`. 순차 수행했고 대체 모델은 사용하지 않았다.
- 복귀는 docs/pages-deploy.md에 따라 기능 커밋만 revert한 후 동일 검증과 일반판 게시를 진행한다.
