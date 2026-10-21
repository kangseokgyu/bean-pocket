# Addy Osmani Agent Skills — 프로젝트 로컬 설치

- 원본: https://github.com/addyosmani/agent-skills
- 확인한 원본 커밋: `aeac41d4d005999432bb7312f7ff06383a91d59d` (2026-10-21)
- CLI: `skills@1.5.18`; 설치 명령: `npx --yes skills@1.5.18 add addyosmani/agent-skills --skill '*' -a codex --copy -y`
- 설치 위치: `.agents/skills/`; 프로젝트 설치 이력: 루트 `skills-lock.json`.
- 설치 명령의 npm 캐시는 프로젝트 `.state/skills-install/npm-cache/`로 지정했다. 전역 옵션·홈 설정 변경은 사용하지 않았다.
- 25개 스킬의 모든 파일은 위 원본과 바이트 단위로 일치한다. `SKILL.md` 메타데이터·워크플로는 수정하지 않았다.
- 원본 `references/` 7개를 `.agents/references/`로 복사했다. 각 스킬의 `../../references/`, 하위 참조의 `../../../references/`가 그대로 유효하다.
- 라이선스: [MIT](LICENSE.addyosmani-agent-skills). 원본 AGENTS.md·CLAUDE.md, 플러그인·시작 훅·별도 라우터는 설치하지 않았다.

## 사용과 우선순위

Codex는 Repository Root의 `.agents/skills/`를 기본 탐색한다. 요청과 일치하는 스킬만 선택하고 본문·참조는 필요할 때 읽는다. `using-agent-skills`는 설치만 유지하며 상시 로드하지 않는다. 프로젝트 루트 AGENTS.md의 우선순위와 작업별 매핑을 따른다.

기존 프로젝트 정책이 스킬의 기본 권장사항보다 우선한다. 특히 trunk 중심 Git 흐름·증분별 자동 커밋, Jest/Playwright 예시·테스트 비율, 페르소나·모델 지정, 배포·승인 절차를 프로젝트에 자동 이식하지 않는다. 기존 `node --test`, 기능별 워크트리·브랜치·게시 규칙을 유지한다. 이번 설치는 사용자의 명시적 제한에 따라 현재 루트에 미커밋 상태로 남기고 commit·push·merge·배포를 수행하지 않았다.

스킬에서 보여주는 `tasks/`, SPEC.md, CONSTRAINTS.md, 페르소나 경로 등은 필요할 때 생성·선택하는 예시이며 설치 필수 파일이 아니다. `idea-refine`의 루트 기준 예시 명령 `bash skills/idea-refine/scripts/idea-refine.sh`는 이 프로젝트에서 `bash .agents/skills/idea-refine/scripts/idea-refine.sh`로 해석한다. 해당 도우미는 설치 검증 중 실행하지 않았다. Claude 전용 명령·페르소나는 Codex에 등록하지 않았다.

## 설치된 스킬 (25개)

- [api-and-interface-design](skills/api-and-interface-design/SKILL.md)
- [browser-testing-with-devtools](skills/browser-testing-with-devtools/SKILL.md)
- [ci-cd-and-automation](skills/ci-cd-and-automation/SKILL.md)
- [code-review-and-quality](skills/code-review-and-quality/SKILL.md)
- [code-simplification](skills/code-simplification/SKILL.md)
- [constraint-driven-development](skills/constraint-driven-development/SKILL.md)
- [context-engineering](skills/context-engineering/SKILL.md)
- [debugging-and-error-recovery](skills/debugging-and-error-recovery/SKILL.md)
- [deprecation-and-migration](skills/deprecation-and-migration/SKILL.md)
- [documentation-and-adrs](skills/documentation-and-adrs/SKILL.md)
- [doubt-driven-development](skills/doubt-driven-development/SKILL.md)
- [frontend-ui-engineering](skills/frontend-ui-engineering/SKILL.md)
- [git-workflow-and-versioning](skills/git-workflow-and-versioning/SKILL.md)
- [idea-refine](skills/idea-refine/SKILL.md)
- [incremental-implementation](skills/incremental-implementation/SKILL.md)
- [interview-me](skills/interview-me/SKILL.md)
- [observability-and-instrumentation](skills/observability-and-instrumentation/SKILL.md)
- [performance-optimization](skills/performance-optimization/SKILL.md)
- [planning-and-task-breakdown](skills/planning-and-task-breakdown/SKILL.md)
- [security-and-hardening](skills/security-and-hardening/SKILL.md)
- [shipping-and-launch](skills/shipping-and-launch/SKILL.md)
- [source-driven-development](skills/source-driven-development/SKILL.md)
- [spec-driven-development](skills/spec-driven-development/SKILL.md)
- [test-driven-development](skills/test-driven-development/SKILL.md)
- [using-agent-skills](skills/using-agent-skills/SKILL.md)

## 검증 및 한계

- 원본 `scripts/lib/skill-lint.js`로 실제 설치 디렉터리를 검사: 25개, 오류 0, 경고 0.
- 원본 `validate-reference-links.js`의 검사 루트만 메모리에서 `.agents/`로 지정: 공통·개별 참조 파일 및 헤딩 앵커 모두 통과.
- `skills list -a codex --json`: 25개 모두 `scope=project`, `agents=[Codex]`, 경로는 현재 저장소 내부.
- 전역 Codex 설정·AGENTS.md·스킬 및 사용자 `.agents/skills` 등 86개 파일의 설치 전후 해시 동일. 기존 프로젝트 AGENTS.md는 원문 전체를 유지하고 규칙만 뒤에 추가했다.
- 트리거 정적 점검: “이 diff를 리뷰해줘” → `code-review-and-quality`; “어제부터 저장이 실패해” → `debugging-and-error-recovery` 후 변경 시 TDD; “새 기능을 구현해줘” → 필요 시 요구사항 구체화·spec → plan → incremental implementation·TDD → verify → review. 실제 애플리케이션 수정이나 별도 모델 실행을 동반한 자동 선택 평가는 하지 않았다.
- Codex 공식 로컬 탐색 경로: https://learn.chatgpt.com/docs/build-skills#where-codex-loads-local-skills . 현재 채팅의 스킬 선택 UI에서 실제 표시되는지는 확인하지 않았다. 다음 턴에 사용할 수 있으며 목록에 나타나지 않으면 Codex를 다시 시작한다.
- 검증 로그·설치 전 기준: `.state/skills-install/` (기존 gitignore 대상). 영구 테스트 인프라는 추가하지 않았다.
- 향후 CLI 업데이트는 공통 `references/`를 갱신하지 않을 수 있으므로 같은 원본 버전의 공통 참조도 비교·동기화하고 경로를 재검증한다. 스킬만 별도 프로젝트로 복사하면 공통 참조가 빠질 수 있다.
