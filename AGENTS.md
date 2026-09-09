# Agent Skills (OpenCode)

Skills live in `.opencode/skills/<name>/SKILL.md`. Shared checklists in `.opencode/references/`.

## Rules

- If a task matches a skill, load it with the `skill` tool before acting and follow it strictly.
- Never skip required spec, plan, or test steps a skill demands.

## Intent → Skill

- Feature → `spec-driven-development`, then `planning-and-task-breakdown`, `incremental-implementation` + `test-driven-development`
- Bug / failure → `debugging-and-error-recovery`
- API / interface → `api-and-interface-design`
- UI → `frontend-ui-engineering`
- Review → `code-review-and-quality`
- Refactor → `code-simplification`
- Ship → `shipping-and-launch`
