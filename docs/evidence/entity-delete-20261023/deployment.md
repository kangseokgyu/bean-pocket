# 삭제 기능 게시 확인 — 2026-10-23

- 기능 커밋: `048d2dd`, 문구·증거 마무리: `db993a8`.
- Critic: gpt-6.1-sol / medium, Dirac. 최초 검토 및 최종 문구 재검토 모두 APPROVE. 최종 재검토는 [보고서](critic/final-recheck.md)에 기록했다.
- Worker: gpt-6-luna / max, Socrates. 모델 대체 없음. 메인 Orchestrator가 요구·순서·통합·게시를 담당했다.
- main 통합/배포 커밋: `dc629301f71ad4591c05ddf2f1a1eee9a50f3a1f`.
- 일반판 수동 배포: `gh workflow run pages.yml --ref main -f probes=false`.
- [Pages 실행 39961416718](https://github.com/kangseokgyu/bean-pocket/actions/runs/39961416718): build/deploy 모두 success.
- 통합 커밋 CI: `npm test` 448/448, `npm run build:pages` 버전 `45fc966c78bd`, `npm run check:pages` 통과.
- [공개 앱](https://kangseokgyu.github.io/bean-pocket/)의 정적 파일 18개를 HTTPS로 조회해 검증된 dist와 바이트 단위 비교: 18/18 일치, HTTP 200. HTML/JS/CSS/manifest/아이콘/SW 포함. [파일별 SHA-256과 결과](public-verification.json).
- 확인 명령: `python3 /private/tmp/verify-entity-delete-release.py` exit 0. 확인 요청은 빌드 버전을 query에 넣고 Cache-Control: no-cache를 사용했다.
- CI 원문은 `gh run view 39961416718 --log`로 조회했으며 임시 사본 `/private/tmp/entity-delete-pages-run.log`에서 tests 448/pass 448/fail 0, 빌드 버전과 검사 통과를 확인했다.
- 이 후속 기록은 문서/근거만 추가하며 공개 앱 소스와 산출물 버전은 바꾸지 않는다. 동일 테스트·게시를 반복하지 않는다.

미검증: 실제 Notion 계정/데이터 삭제, 실제 iPhone/Safari, OPFS 디스크 및 native lock crash recovery, 기존 설치 클라이언트의 SW 업데이트 적용. 브라우저 검증은 합성 Notion/메모리 어댑터이며 공개 반영 확인은 정적 파일 비교다. 기존 320px 긴 필터명 넘침은 별도 제한으로 남아 있다.
