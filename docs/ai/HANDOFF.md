# Current handoff

Last updated: 2026-11-25 by Claude (cloud session on claude.ai, not Claude Code on the owner's Mac)

- **Branches on GitHub:** `ai/shared-handoff-claude` (these shared files, cut from `main` at `aed83e5`), `ai/portfolio-hero-claude` (the hero prototype, stacked on it), `ai/portfolio-arf3d-claude` (the 3D parts view, stacked on the hero) , `ai/portfolio-flows-claude` (the sign-in flows page, stacked on the 3D view) `ai/portfolio-explorer-claude` (the KC1 API explorer, stacked on the flows page) and `ai/portfolio-upgrade-claude` (accessibility fixes, the README and the changelog, stacked on the explorer). **`ai/portfolio-upgrade-claude` holds everything: review and merge that one.** Use `git log -1` on each for the current commit.
- **Owner of the current task:** Claude holds T06. On 25 November the owner told Claude to decide and carry on without asking. Claude still does not merge to `main` or deploy to production without the owner's word: the owner's brief rules that out.
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

## The sign-in flows page (`ai/portfolio-flows-claude`)

- **What it is:** a new page, `/sign-in-flows`: OAuth 2.0 (authorization code with PKCE), OpenID Connect (authorization code flow), SAML 2.0 (SSO started at the service provider) and single sign-on to a second application. Each is a sequence diagram with its steps: the message, what it carries, and what the receiver checks. 33 steps in all, and a table of the differences.
- **How:** `lib/flows.mjs` holds the content and draws the diagrams as SVG at build time. `src/flows.js` (3.9 KB) shows one step at a time. No dependency added. English only, like the other standalone pages.
- **Reached from:** the enterprise IT page (`content/industries.json`), the sitemap and the site search.
- **Without a script** every step is listed under its diagram. Nothing plays by itself. The diagram scrolls in its own frame on a phone.
- **Accuracy:** every value is invented, on example.com, and the page says so. The PKCE verifier and challenge are the pair of RFC 7636, Appendix B; `tests/flows.py` computes the hash. Claude wrote the content from the specifications listed on the page. **Nobody with identity-engineering experience has reviewed it, and the six links to the specifications could not be opened from the build workspace.** Check both before release.

## The KC1 API explorer (`ai/portfolio-explorer-claude`)

- **What it is:** a new page, `/kc1-api-explorer`: the 13 requests recorded against the KC1 prediction API, each with the response it got, filters by outcome and address, the same request as a curl command, and a link to where the documentation covers it.
- **Where the content comes from:** `lib/explorer.mjs` reads `content/projects/kc1/api/exchanges.json`, `exchanges-1.0.0.json` and `openapi.json` on every build. Only the titles and one-line notes are written by hand, and a recording without a title stops the build. The page sends nothing; `tests/explorer.py` checks that it asks no other host for anything.
- **No dependency added.** `src/explorer.js` is 3.4 KB. Without a script each exchange still opens (a `details` element).
- **Linked from:** the API documentation and the AI and data science pages, the sitemap and the search.
- **Why KC1 first, and what is left:** KC1 is the only one of the four projects whose data is in this repository. TrustNav, AI-ChainGuard and NOVATECH Sentinel have their documents fetched from their own repositories at build time, and no recorded data here. An explorer for each needs real data from that project first (a recorded run, an export, a fixture); do not invent it.

## CyberAtlas (T07)

Built as a separate project: 3 modules, 10 lessons, 3 simulated graded labs, one static page with no dependency. It is on the orphan branch `ai/cyberatlas-mvp-claude`, which shares no history with the site, because Claude could not create a repository. Read that branch's `README.md`, `AGENTS.md` and `HANDOFF.md`. Its tests: 14 unit tests and 52 browser checks pass. Before any release it needs a security instructor's read, a check of the certification names, and the owner's choice of name, licence, repository and host.

## AI SOC baseline (T08)

A separate project on the orphan branch `ai/soc-mvp-claude` (no shared history with the site; never merge it). It takes alerts in the shape Wazuh sends, normalises and masks them, adds inventory context, groups them into incidents, and triages each with fixed rules that give a reason and the evidence for every point of the score. Response actions are only proposed: a named analyst approves or rejects each, and the code has no way to run one. Every step goes into a hash-chained audit log. It now has a first analyst's page in React (incidents, approval queue, audit log, evaluation) that runs the pipeline in the browser and builds to one file; there is no sign-in, so the analyst's name is recorded as typed. No model, no database yet. `npm test`: 17 pass; 67 browser checks pass. `npm run evaluate`: 12 of 12 labelled scenarios, which shows the pipeline works as designed and nothing more, because the rules and scenarios were written together. All data is synthetic, and the Wazuh rule IDs in it are from memory and unverified. Read that branch's `README.md`, `AGENTS.md` and `HANDOFF.md` for limits and the ordered next steps.

## Blockers

1. **The Mac was not audited.** Claude's cloud session has no link to it. Local Claude Code and Codex MCP configuration, plugins and skills are unknown. Run `claude mcp list` and `codex mcp list` there and record the output, with credentials removed, in `docs/ai/INTEGRATIONS.md`.

## Next action

T06 is built as far as this repository allows. The message-to-publication experience was already on `main` (see `TASKS.md`). The TrustNav, AI-ChainGuard and Sentinel explorers wait for data from their projects. Next: the owner's review of `ai/portfolio-upgrade-claude`. T07 (CyberAtlas) and T08 (AI SOC baseline) are built and each needs its own repository. T08's next step is real alerts from the owner's own Wazuh lab; creating a Supabase project for it waits for the owner's approval. Before any release: a reader who knows OAuth and SAML checks `/sign-in-flows`, native readers check the eight translated strings of the 3D view, and `scripts/check-links.mjs` runs on an open network.
