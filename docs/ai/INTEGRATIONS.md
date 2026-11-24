# Integration status

Checked on 2026-11-25 from the owner's claude.ai account. The Mac's Claude Code and Codex configuration was not reachable and is not covered here. Statuses: VERIFIED, CONFIGURED_NOT_AUTHENTICATED, BLOCKED, NOT_SUPPORTED, DEFERRED.

| Integration | Status | Evidence | Next action |
|---|---|---|---|
| GitHub, read | VERIFIED | Cloned `main` at `aed83e5` | None |
| GitHub, write | BLOCKED | Write access refused for Claude's cloud session; ChatGPT's connector returned 403 earlier | Owner pushes the branch, or use Claude Code on the Mac |
| Vercel | VERIFIED | Listed the team's projects; `karan-deshmukh` serves karandeshmukh.dev and its latest production deployment is READY. Read only | None |
| Supabase | VERIFIED | Listed one existing project (another product) and its public tables, all with row-level security on. Read only | Create a dedicated development project when T07 or T08 needs one |
| MotionSites | VERIFIED | Account call and a library search succeeded. Free plan: 3 free prompts, 0 used, no premium content | Decide on a plan only if a design needs it |
| MotionSites Studio | VERIFIED | Account call succeeded. No active plan, so building, saving and generating are unavailable | None unless the owner buys a plan |
| OpenAI developer docs | VERIFIED as connected | Added as a public no-sign-in connector; claude.ai shows it connected. No document fetched yet | Fetch one page in a new chat |
| Context7 | CONFIGURED_NOT_AUTHENTICATED | Connector added; stopped at Context7's sign-in | Owner signs in |
| Spline | CONFIGURED_NOT_AUTHENTICATED | Connector present; connection incomplete | Owner signs in |
| Playwright | VERIFIED in the cloud workspace | The repository's Playwright tests ran against Google Chrome (see `TEST_REPORT.md`). No Playwright MCP was set up | Check on the Mac |
| Chrome DevTools MCP | NOT_SUPPORTED in claude.ai | Local server only | Set up in Claude Code or Codex on the Mac if needed |
| Firecrawl | DEFERRED | Authenticated in ChatGPT only | Owner connects it in Claude if wanted |
| Figma, Magic UI, 21st.dev | DEFERRED | Not set up or checked | Set up when a task needs one |
| React Bits | NOT_SUPPORTED as a claude.ai connector | Its MCP runs locally in a project | Use in Claude Code or Cursor, or copy components by hand |
| Unsloth | DEFERRED | Local training workflow | Revisit at the AI SOC model prototype |
| PostHog, Composio, Perplexity | DEFERRED | Optional in the brief | None |
