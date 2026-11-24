# Current handoff

Last updated: 2026-11-25 by Claude (cloud session on claude.ai, not Claude Code on the owner's Mac)

- **Branches on GitHub:** `ai/shared-handoff-claude` (these shared files, cut from `main` at `aed83e5`), `ai/portfolio-hero-claude` (the hero prototype, stacked on it) and `ai/portfolio-arf3d-claude` (the 3D parts view, stacked on the hero). Use `git log -1` on each for the current commit.
- **Owner of the current task:** T05 and the first piece of T06 are with the owner for review. The owner told Claude to decide the hero's direction and to start T06. Claude holds T06.
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

## The 3D parts view (`ai/portfolio-arf3d-claude`)

- **What it is:** on `/studio/ipc`, a **3D view** button puts the ARF-1 rig in place of the exploded drawing. A reader drags to turn it, moves a slider between assembled and exploded, zooms with the drawing's own buttons, and selects a part on the rig or in the parts list; each follows the other. It follows the issue and the product on show.
- **The model:** `src/studio/arf3d.mjs` holds the same boxes and cylinders, in the same units, as `scripts/aero/draw.py`, which draws the catalogue figures. Change a part in both.
- **Dependencies added:** `three` 0.187.0 and `esbuild` 0.28.2, both pinned. The build bundles the module into `/studio/arf3d.js` (552 KB, 139 KB gzipped), which the page fetches only when a reader presses the button. No other page loads it.
- **Fallbacks:** the drawing stays the default. Without WebGL the drawing comes back and the status says so. With reduced motion the parts move at once. The parts list is the keyboard and screen-reader route to every part; the canvas has a text alternative and turns with the arrow keys.
- **Languages:** eight new strings, translated by Claude into French, German, Spanish and Hindi in `content/i18n/studio/`. A native reader has not checked them.
- **Not done:** the page's Help text and the README don't mention the view; the user guide and the film of the catalogue don't show it; `scripts/check-a11y.py` and Lighthouse were not run.

## Blockers

1. **The Mac was not audited.** Claude's cloud session has no link to it. Local Claude Code and Codex MCP configuration, plugins and skills are unknown. Run `claude mcp list` and `codex mcp list` there and record the output, with credentials removed, in `docs/ai/INTEGRATIONS.md`.

## Next action

The owner reviews the two previews. Then the next T06 piece: the IAM sequences (no new dependency needed), on a new branch from `ai/portfolio-arf3d-claude`.
