# 추출 조건 탐색 게시 결과

원두별 실제 추출 조건 조정, 기록 비교, 베스트 지정과 재추출, 실제 조건의 공용 레시피 저장을 main에 통합하고 게시했다.

- [PR #2](https://github.com/kangseokgyu/bean-pocket/pull/2)를 main에 병합했다. 게시 커밋은 `1cb3e8c4e6b37c7d57198843b89f4fb897bae539`다.
- [일반판 Pages 실행](https://github.com/kangseokgyu/bean-pocket/actions/runs/41827662728)을 `probes=false`로 실행했다. 통합 후 테스트 723개, 일반판 빌드·산출물 검사와 배포가 모두 성공했다. [CI 요약](ci-test-summary.json), [실행 단계](deployment.json)를 보관한다.
- 이번 게시 빌드는 `3729e1901247`이다. [공개 파일 대조](public-files.json)에서 앱 파일 27개가 모두 HTTP 200이며 검증한 로컬 산출물과 바이트 단위로 일치했다.
- [공개 앱](https://kangseokgyu.github.io/bean-pocket/)을 최종 재조회한 버전은 `85597d48c840`이다. 이번 배포 뒤 별도 즐겨찾기 UI 변경이 추가 게시된 결과이며, main `4b823af`는 이번 기능의 게시 커밋을 포함한다. [최종 공개 버전 확인](public-version-final.json)에 실제 읽은 값을 보관한다. 후속 변경을 덮거나 이전 빌드를 다시 게시하지 않았다.
- 실제 Notion 테스트·운영 원두 DB에 `베스트 추출` 관계를 추가했다. 각 기존 속성 전체 보존과 records 대상 단방향 관계를 재조회했고, 후속 dry-run은 두 환경 모두 무변경이었다. 사용자 추출 기록 행은 생성·갱신하지 않았다.

[검증·실패 이력](verification.md), [구현 흐름 HTML](flow.html), [최종 독립 검토](critic-final-review.md), [최신 main 통합 검토](critic-integration-review.md)에 근거를 모았다.

브라우저 검증은 production 모듈과 합성 저장소를 사용했다. 실제 iPhone Safari·홈 화면 PWA, 사용자 Notion에서 새 추출 기록 생성·베스트 갱신, 실제 저장소 복구는 이번 실행의 확인 범위에 포함되지 않는다. 후속 즐겨찾기 UI 게시 파일 전체를 이번 로컬 `3729e1901247` 산출물과 대조한 것은 아니며, 해당 후속 버전은 표시 버전만 재조회했다.

Worker는 `gpt-6-luna/max` 사용 한도 오류 뒤 허용된 `gpt-6.1-sol/medium`으로 대체했다. Critic은 `gpt-6.1-sol/medium`으로 순차 독립 검토했다. GitHub 연결 도구의 PR 생성은 403으로 제한되어 권한이 확인된 `gh` CLI로 생성·병합했다. 자동 승인 검토의 거부는 없었다.
