# Project state

Git is the source of truth. This file records what an agent cannot read from the code. Keep secrets and account identifiers out of it.

- **Repository:** `domail2karandeshmukh-cyber/portfolio`, public, default branch `main`.
- **Site:** https://karandeshmukh.dev, hosted on Vercel in the project `karan-deshmukh`. A push to `main` deploys to production.
- **Stack:** a static site built by `node build.mjs` (no framework) from `content/` and `src/` into `public/`, plus three serverless functions in `api/`. Node 22 (`package.json`), Python for the browser tests. No 3D or WebGL code exists yet.
- **Size at `aed83e5`:** 942 tracked files; the build writes 211 pages in five languages.
- **Canonical standards:** `standards/` (design, editorial, illustration, publishing, screenshots, video). The design system is `standards/design.md`; there is no separate design-system file for agents.
- **Observation:** the Vercel project setting shows Node 26.x while `package.json` asks for 22.x. Not changed; confirm which one the builds use.

## Open decisions for the owner

- Which hero direction to build (T05), given that the current hero was approved on 20 November 2026.
- Repository and hosting for CyberAtlas (T07), and the Supabase project for it and for the AI SOC product. The account's one existing Supabase project belongs to another product and must not be reused.
- Whether to pay for MotionSites: the account is on the free plan (three free prompts), and MotionSites Studio has no active plan.

## Next milestone

P2: one hero prototype on a preview branch, measured against the baseline in `TEST_REPORT.md`.
