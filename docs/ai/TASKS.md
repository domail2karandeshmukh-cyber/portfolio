# Task board

One owner per task. Change the status and owner in the same commit as the work.

| ID | Task | Status | Owner | Acceptance |
|---|---|---|---|---|
| T01 | Environment audit | Done for the repository; the Mac is open | Claude | Inventory and clean or dirty state recorded |
| T02 | Connector setup | Partly done | Claude | Tool discovery and one safe test per connector |
| T03 | Shared branch and rules | Done | Claude | Authorized branch on GitHub, `main` unchanged |
| T04 | Portfolio baseline | Done, except Lighthouse | Claude | Screenshots, tests and performance evidence |
| T05 | Hero prototype | In review on `ai/portfolio-hero-claude` | Claude, then the owner | Responsive, accessible, original, reviewable preview |
| T06 | Portfolio upgrade | Built as far as this repository's data allows; in review on `ai/portfolio-upgrade-claude`, which holds every piece | Claude | Every existing route and all content preserved |
| T07 | CyberAtlas MVP | Built, in review. Parked on the orphan branch `ai/cyberatlas-mvp-claude` of this repository until it has its own; never merge it here. Its own `HANDOFF.md` has the state | Claude | 10 original lessons, 3 safe simulations |
| T08 | AI SOC MVP | Baseline built, in review. Parked on the orphan branch `ai/soc-mvp-claude` of this repository until it has its own; never merge it here. Rule-based pipeline with no model yet; interface, storage and model evaluation are still open. Its own `HANDOFF.md` has the state | Claude | Defensive triage with evaluation and approvals |
| T09 | StudioBridge | Optional | Unassigned | Shared git handoff demonstrated first |

Open items inside finished tasks:

- T01: audit the Mac (Node, Python, `claude mcp list`, `codex mcp list`, plugins, skills).
- T02: Spline and Context7 are signed in but no tool has been called; Firecrawl, Figma, Magic UI, 21st.dev and Chrome DevTools are not set up.
- T04: Lighthouse and Core Web Vitals on a preview, and `scripts/check-a11y.py`.

T06 pieces, from the owner's brief:

| Piece | Status |
|---|---|
| Aerospace: the ARF-1 rig in 3D, exploded view, parts list | Built on `ai/portfolio-arf3d-claude`, in review |
| Technical documentation: the six-stage message-to-publication experience | Already on `main`: the home page plays the six stages, stops when a reader takes over, and has a tab for each; `/message-to-document` shows every stage in full. Nothing added |
| Enterprise IT and IAM: SSO, OAuth 2.0, OIDC and SAML sequences | Built on `ai/portfolio-flows-claude` at `/sign-in-flows`, in review |
| Cybersecurity and AI: the KC1 API explorer | Built on `ai/portfolio-explorer-claude` at `/kc1-api-explorer`, in review |
| Cybersecurity and AI: TrustNav, AI-ChainGuard and Sentinel explorers | Not started. This repository holds no data of those projects; see the handoff |
