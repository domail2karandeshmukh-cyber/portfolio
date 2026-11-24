# Current handoff

Last updated: 2026-11-25 by Claude (cloud session on claude.ai, not Claude Code on the owner's Mac)

- **Branch:** `ai/shared-handoff-claude`, cut from `main` at `aed83e5`. It existed only in Claude's cloud workspace when this was written; the owner received it as a patch file. If the branch is not on GitHub, apply the patch first (`git am`).
- **Owner of the current task:** nobody. T01 to T04 are done as far as the cloud session allows; T05 is ready to claim.
- **Changed files:** `AGENTS.md`, `CLAUDE.md`, `docs/ai/*`. No site source, content or configuration changed.
- **Production:** untouched. Nothing was deployed.

## Done in this session

- Cloned `main` read-only, installed the pinned dependencies, built the site and ran the repository's own checks. Results are in `docs/ai/TEST_REPORT.md`.
- Tested each connector that the claude.ai account holds. Results are in `docs/ai/INTEGRATIONS.md`.
- Wrote these shared files, merged from the owner's setup pack and the repository's existing standards.

## Blockers

1. **No push access from Claude's cloud session.** Attaching the repository with write access was refused by the session's permission check. Smallest owner action: apply the patch locally and push the branch, or run the next session in Claude Code on the Mac.
2. **The Mac was not audited.** Local Claude Code and Codex MCP configuration, plugins and skills are unknown. Run `claude mcp list` and `codex mcp list` there and record the output, with credentials removed, in `docs/ai/INTEGRATIONS.md`.
3. **Spline and Context7 need the owner's sign-in** in claude.ai (Customize, Connectors, Connect).

## Next action

T05, hero prototype. Read `standards/design.md` and `audit/design-refinement-register.md` first: the current hero (the headline that corrects itself and the three document pages) was released with the owner's approval on 20 November 2026. Prototype the 3D directions on a preview branch, load any WebGL after the text and actions have painted, keep the static hero as the fallback for reduced motion and for WebGL failure, and compare `tests/journeys.py` and `tests/matrix.py` against the baseline before asking for review.
