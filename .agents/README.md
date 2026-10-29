# pstack — 프로젝트 로컬 Codex 스킬

## 출처와 설치 기록

- 공식 원본: [cursor/plugins의 pstack](https://github.com/cursor/plugins/tree/1ba91fc25c0977741dd0e267849e6234b037ed0a/pstack)
- 원본 저장소: `cursor/plugins`; 고정 commit SHA: `1ba91fc25c0977741dd0e267849e6234b037ed0a` (2026-10-29에 제공된 checkout)
- 설치 범위: `.agents/skills/`의 **58개 스킬, 535개 파일**. 각 스킬 디렉터리 전체를 포함해 playbook, reference, script, fixture 등 skill 내부 의존성을 보존했다.
- 설치 방법: 이미 다운로드된 공식 저장소 checkout의 `pstack/skills/`에서 프로젝트 `.agents/skills/`로 바이트 보존 복사했다. checkout이 pinned SHA와 일치하고 깨끗한 상태임을 확인했다. 설치 helper는 전체 `cursor/plugins` 저장소를 다시 받아야 하므로 재다운로드를 피했다. upstream 스크립트·hook은 실행하지 않았다.
- 외부 상대 경로 및 문서 지원 파일 33개를 `.agents/` 아래 원본 경로 구조를 따라 복사했다: `docs/guide/` 전체(17개), `docs/harness/`(1개), `agents/`(2개), `automations/benny/`(12개), `LICENSE`(1개). 이미지와 스크립트는 파일로만 복사했다. Benny pack은 안내 문서의 링크 대상이며 활성화하거나 실행하지 않았고, 그 안의 `SKILL.md`는 `.agents/skills/` 밖에 두어 Codex 스킬로 노출하지 않았다.
- 라이선스: [MIT](LICENSE.pstack).
- `.agents/pstack-install-manifest.json`은 이 설치 전용 manifest다. 설치된 스킬 535개 파일과 지원 파일의 실제 SHA-256을 기록한다. 기존 루트 `skills-lock.json`은 과거 CLI 설치 전용 자료여서 제거했다. 설치 helper가 만들지 않은 CLI `computedHash` 값은 만들지 않았다.

## Codex에서 사용

Codex는 저장소 안의 `.agents/skills/<skill-name>/SKILL.md`를 프로젝트 스킬로 탐색한다. 요청과 일치하는 스킬을 선택하고, 해당 `SKILL.md`의 trigger에 따라 필요한 참조와 playbook을 읽는다. 복잡한 엔지니어링 작업은 `poteto-mode`를 진입점으로 사용할 수 있고, 스킬 선택이나 pstack 용어 안내는 [`poteto-help`](skills/poteto-help/SKILL.md)를 참고한다. `poteto-help`의 `../../README.md` 링크는 이 프로젝트 안내 문서로 연결된다.

주요 라우트:

- 조사와 문제 분해: [`figure-it-out`](skills/figure-it-out/SKILL.md), [`how`](skills/how/SKILL.md), [`why`](skills/why/SKILL.md)
- 설계: [`architect`](skills/architect/SKILL.md), [`principle-model-the-domain`](skills/principle-model-the-domain/SKILL.md)
- 구현·버그 수정: [`poteto-mode`](skills/poteto-mode/SKILL.md), [`tdd`](skills/tdd/SKILL.md)
- 검증·리뷰: [`principle-prove-it-works`](skills/principle-prove-it-works/SKILL.md), [`blast-radius`](skills/blast-radius/SKILL.md), [`interrogate`](skills/interrogate/SKILL.md)
- 문서: [`technical-writing`](skills/technical-writing/SKILL.md), [`unslop`](skills/unslop/SKILL.md)

## 프로젝트 정책과 호환성

저장소 루트 [AGENTS.md](../AGENTS.md)가 프로젝트 정책의 기준이다. pstack의 기본 모델·추론 수준·병렬 panel, fresh-agent 지침, PR·merge·게시 권고보다 AGENTS.md의 Orchestrator/Worker/Critic 역할, 지정 모델과 effort, Worker→Critic 순서, 재사용·fallback, `node --test`, 기능별 `codex/` 워크트리, 승인 및 배포 조건이 우선한다. 작업별 사용자의 제한 지시는 프로젝트의 상시 승인보다도 우선한다. 모델이나 reasoning effort를 도구에서 지정할 수 없거나 모델을 사용할 수 없으면 제한을 알리고 사용자 지시·프로젝트 정책에 정해진 대체만 적용한다. 허용된 대체가 없으면 사용자에게 모델 선택을 확인하는 동안 해당 에이전트에 의존하지 않는 작업을 진행하며, 실제 사용 설정을 보고한다. Worker의 429 fallback은 AGENTS.md에 명시된 예외다.

`setup-pstack`은 공식 upstream에서 Cursor의 `~/.cursor/rules/pstack-models.mdc`를 쓰는 스킬이다. 이 프로젝트에서는 실행하지 않으며 홈 설정을 변경하지 않는다. pstack 문서의 Cursor `Task`, `AskQuestion`, custom mode, Bugbot, Automations, PR 도구와 모델 문자열은 Codex에서 같은 기능이 있다고 보장하지 않는다. 실제로 제공되는 Codex 도구만 사용한다. `agents/poteto-agent.md`와 `agents/comment-sicko.md`는 upstream 텍스트 자료로 복사했지만 Codex subagent로 등록되지 않으며, 프로젝트 역할·중첩 금지 정책을 대체하지 않는다. `docs/harness/claude-code.md`는 Claude Code 설명이며 Codex 어댑터가 아니다.

상대 경로가 가리키는 guide는 [`docs/guide/`](docs/guide/README.md)에 보관했다. upstream skill의 바이트를 그대로 유지하기 위해 harness 차이는 이 문서와 AGENTS.md에서 안내한다. 설치된 `scripts/`는 필요한 skill 리소스로 보존했으며 이 설치·검증 중 실행하지 않았다.
