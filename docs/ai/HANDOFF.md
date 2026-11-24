# Current handoff

Last updated: 2026-11-25 by Claude (cloud session on claude.ai, not Claude Code on the owner's Mac)

- **Branches on GitHub:** `ai/shared-handoff-claude` (these shared files, cut from `main` at `aed83e5`) and `ai/portfolio-hero-claude` (the hero prototype, stacked on it). Use `git log -1` on each for the current commit.
- **Owner of the current task:** T05 is with the owner for review. Nothing else is claimed.
- **Production:** untouched. `main` is still `aed83e5`. Nothing was merged or promoted.

## Done

- Applied the owner's patch with `git am` on a fresh clone and pushed `ai/shared-handoff-claude`.
- Tested each connector that the claude.ai account holds. Results are in `docs/ai/INTEGRATIONS.md`.
- Built the T05 prototype on `ai/portfolio-hero-claude`. What it does, and how it was tested, is in that branch's copy of this file and of `TEST_REPORT.md`.

## The hero prototype (this branch)

- **What it is:** on a screen 1,080 pixels wide or more, the three publication pages beside the headline rise from the flat stack into depth, turn a few degrees toward the mouse pointer, and separate into layers over the first half of the hero's scroll. The headline, the text, the actions and the page images are the ones `main` has.
- **How:** `src/hero3d.js` (5.9 KB, loaded with `defer` on the home page in all five languages) wraps the three existing images and sets CSS 3D transforms. Nine lines in `src/site.css`, one script tag in `src/home.html`, one file name in `build.mjs`.
- **Dependencies:** none added. Three.js 0.187.0 was tried and removed: its module build is about 2.1 MB before compression, for three flat pages that CSS can turn in 3D. Three.js is the right tool for real geometry, such as the ARF-1 exploded view in T06. Spline was not used: its connector is not signed in.
- **Fallback:** below 1,080 pixels, with reduced motion, without scripts, or without CSS 3D support, the script does nothing and the hero is `main`'s.
- **Limits:** a prototype of one direction, not three. It is restrained by design; the owner may want more. Not measured with Lighthouse, not run through `scripts/check-a11y.py`, and seen only in Google Chrome.

## Blockers

1. **The Mac was not audited.** Claude's cloud session has no link to it. Local Claude Code and Codex MCP configuration, plugins and skills are unknown. Run `claude mcp list` and `codex mcp list` there and record the output, with credentials removed, in `docs/ai/INTEGRATIONS.md`.

## Next action

The owner reviews the hero preview. If approved, T06 starts from `ai/portfolio-hero-claude`. If not, change the prototype on that branch; do not open a second hero branch.
