# Current handoff

Last updated: 2026-11-25 by Claude (cloud session on claude.ai, not Claude Code on the owner's Mac)

- **Branches on GitHub:** `ai/shared-handoff-claude` (these shared files, cut from `main` at `aed83e5`) and `ai/portfolio-hero-claude` (the hero prototype, stacked on it). Use `git log -1` on each for the current commit.
- **Owner of the current task:** T05 is with the owner for review. Nothing else is claimed.
- **Production:** untouched. `main` is still `aed83e5`. Nothing was merged or promoted.

## Done

- Applied the owner's patch with `git am` on a fresh clone and pushed `ai/shared-handoff-claude`.
- Tested each connector that the claude.ai account holds. Results are in `docs/ai/INTEGRATIONS.md`.
- Built the T05 prototype on `ai/portfolio-hero-claude`. What it does, and how it was tested, is in that branch's copy of this file and of `TEST_REPORT.md`.

## Blockers

1. **The Mac was not audited.** Claude's cloud session has no link to it. Local Claude Code and Codex MCP configuration, plugins and skills are unknown. Run `claude mcp list` and `codex mcp list` there and record the output, with credentials removed, in `docs/ai/INTEGRATIONS.md`.

## Next action

The owner reviews the hero preview. If approved, T06 starts from `ai/portfolio-hero-claude`. If not, change the prototype on that branch; do not open a second hero branch.
