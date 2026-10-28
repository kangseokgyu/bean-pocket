# 커피 드립 일러스트 교체 게시

- 2026-10-29 KST 완료. 요청: 기존 그림을 노션풍의 커피 내리는 그림으로 교체.
- 이미지 생성: 기본 제공 image_gen, 투명 배경. 프롬프트 방향: 단순하고 약간 불규칙한 검은 잉크 선, 흑백 형태, 한 사람이 주전자로 서버 위 드리퍼에 물을 붓는 장면, 글자·로고·배경 없음.
- 프로젝트 이미지: `pwa/icons/home-brew.png`. 원본과 동일한 1254×1254 RGBA PNG. 문구·버튼·최근 글꼴 변경은 유지했다.
- 기능 커밋 `d6dfb53`, 검토·브라우저 근거 포함 게시 커밋 `cb99bf4`.
- 공개 주소: https://kangseokgyu.github.io/bean-pocket/#/home
- 공개 빌드 `41bc06ad0638`.
- Pages 실행 https://github.com/kangseokgyu/bean-pocket/actions/runs/40713009345 — build/deploy success. 통합된 main의 회귀 테스트·빌드·검사를 게시 전에 통과했다.
- 로컬 `npm test` 611/611, 집중 UI·빌드/캐시 테스트 각 1/1, 일반판 빌드 및 파일 검사 통과.
- 공개 파일 21개 모두 HTTP 200 및 검증된 dist와 SHA-256 일치. `public-files.json` 참조.
- 공개 IAB 홈에서 빌드 `41bc06ad0638`, 새 흑백 일러스트의 정상 표시·로드(naturalWidth=1254), 1280px에서 가로 넘침 없음(scrollWidth=1280)을 직접 확인했다.
- 390/1280px 실제 브라우저에서 이미지 로드·가로 넘침 없음·CTA 경로를 확인했다. `browser-verification.md` 참조.
- Worker `gpt-6-luna`/`max`, Critic `gpt-6.1-sol`/`medium`을 기존 에이전트로 재사용했다. Worker와 Critic의 브라우저 연결 제약으로 Orchestrator가 미검증 브라우저 항목을 보완했다.
- 실제 Notion 쓰기·실제 iPhone/Safari 설치형 PWA·장기 오프라인 캐시 갱신은 미검증이다. 복귀는 docs/pages-deploy.md 절차에 따라 기능 커밋만 revert하고 동일 검증 후 재게시한다.
