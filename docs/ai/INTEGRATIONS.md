# Integration status

Checked on 2026-11-25 from the owner's claude.ai account. The Mac's Claude Code and Codex configuration is not covered: both sessions ran in Claude's cloud workspace, which has no link to the Mac. Statuses: VERIFIED, CONFIGURED (signed in, not yet exercised), CONFIGURED_NOT_AUTHENTICATED, BLOCKED, NOT_SUPPORTED, DEFERRED.

| Integration | Status | Evidence | Next action |
|---|---|---|---|
| GitHub, read | VERIFIED | Cloned `main` at `aed83e5` | None |
| GitHub, write | VERIFIED | After the owner asked for the push, the cloud session was given write access and pushed `ai/shared-handoff-claude`; `main` stayed at `aed83e5`. ChatGPT's connector returned 403 earlier | None |
| Vercel | VERIFIED | Listed the team's projects; `karan-deshmukh` serves karandeshmukh.dev and its latest production deployment is READY. Read only | None |
| Supabase | VERIFIED | Listed one existing project (another product) and its public tables, all with row-level security on. Read only | Create a dedicated development project when T07 or T08 needs one |
| MotionSites | VERIFIED | Account call and a library search succeeded. Free plan: 3 free prompts, 0 used, no premium content | Decide on a plan only if a design needs it |
| MotionSites Studio | VERIFIED | Account call succeeded. No active plan, so building, saving and generating are unavailable | None unless the owner buys a plan |
| OpenAI developer docs | VERIFIED | Added as a public no-sign-in connector; a documentation search returned 16 results | None |
| Context7 | CONFIGURED | The owner's account is signed in and claude.ai shows the connector connected. No tool called yet | Fetch one library's documentation in a new chat |
| Spline | CONFIGURED | The owner's free account is signed in and claude.ai shows the connector connected. No tool called yet | List the scene tools in a new chat |
| Playwright | VERIFIED in the cloud workspace | The repository's Playwright tests ran against Google Chrome (see `TEST_REPORT.md`). No Playwright MCP was set up | Check on the Mac |
| Chrome DevTools MCP | NOT_SUPPORTED in claude.ai | Local server only | Set up in Claude Code or Codex on the Mac if needed |
| Firecrawl | DEFERRED | Authenticated in ChatGPT only | Owner connects it in Claude if wanted |
| Figma, Magic UI, 21st.dev | DEFERRED | Not set up or checked | Set up when a task needs one |
| React Bits | NOT_SUPPORTED as a claude.ai connector | Its MCP runs locally in a project | Use in Claude Code or Cursor, or copy components by hand |
| Unsloth | DEFERRED | Local training workflow | Revisit at the AI SOC model prototype |
| PostHog, Composio, Perplexity | DEFERRED | Optional in the brief | None |
