# Task board

One owner per task. Change the status and owner in the same commit as the work.

| ID | Task | Status | Owner | Acceptance |
|---|---|---|---|---|
| T01 | Environment audit | Done for the repository; the Mac is open | Claude | Inventory and clean or dirty state recorded |
| T02 | Connector setup | Partly done | Claude | Tool discovery and one safe test per connector |
| T03 | Shared branch and rules | Done | Claude | Authorized branch on GitHub, `main` unchanged |
| T04 | Portfolio baseline | Done, except Lighthouse | Claude | Screenshots, tests and performance evidence |
| T05 | Hero prototype | In review on `ai/portfolio-hero-claude` | Claude, then the owner | Responsive, accessible, original, reviewable preview |
| T06 | Portfolio upgrade | Pending T05 and owner review | Unassigned | Every existing route and all content preserved |
| T07 | CyberAtlas MVP | Pending; repository and hosting to agree with the owner | Unassigned | 10 original lessons, 3 safe simulations |
| T08 | AI SOC MVP | Deferred until after T06 | Unassigned | Defensive triage with evaluation and approvals |
| T09 | StudioBridge | Optional | Unassigned | Shared git handoff demonstrated first |

Open items inside finished tasks:

- T01: audit the Mac (Node, Python, `claude mcp list`, `codex mcp list`, plugins, skills).
- T02: Spline and Context7 are signed in but no tool has been called; Firecrawl, Figma, Magic UI, 21st.dev and Chrome DevTools are not set up.
- T04: Lighthouse and Core Web Vitals on a preview, and `scripts/check-a11y.py`.
