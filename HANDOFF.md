# Handoff — AI SOC baseline

**State (2026-11-25, Claude):** baseline pipeline and a first analyst's page complete and tested. `npm test` 17/17; `npm run check` clean; `npm run e2e` 67/67 (including axe scans in light, dark and phone); `npm run evaluate` 12/12 scenarios (see README for why that is not a real-world score).

## Done
- Normalise, mask, enrich, correlate, rule-based triage, proposals, approval queue, hash-chained audit log, evaluation with latency and cost, CLI.
- Synthetic inventory, 12 labelled scenarios (4 true positive, 5 false positive, 3 needs review), one mixed sample day.

- Analyst's page (`ui/`, React): incidents with reasons and evidence, approval queue, audit log, evaluation. Runs the pipeline in the browser; builds to one file. `src/` no longer imports from `node:` (own SHA-256, tested against Node's).

## Found and fixed while testing
- Unrelated password guessers were merged into one incident through the account they both targeted; failed logins now correlate by source address only.
- `Authorization: Bearer <token>` left the token unmasked; fixed, with a test. `PWD=` in sudo lines is no longer treated as a password.

## Not verified
- Wazuh rule IDs, groups and descriptions in `data/build.ts` (from memory). Check against a real manager's `alerts.json`.
- ATT&CK technique names.
- Behaviour on any alert the scenarios don't cover.

## Next, in order
1. Get real Wazuh alerts from a lab manager (the owner's own machines only) and fix `kindOf()` against them.
2. A held-out scenario set labelled by someone other than the rule author.
3. Persist events, incidents, actions and the audit log (Supabase was the owner's choice; needs his approval for the project and schema).
4. Sign-in for analysts (the page records a typed name; that is not identity). Depends on 3.
5. A model-backed `Triager`, evaluated against this baseline on accuracy, time and cost. Unsloth fine-tuning only if a stock model falls short.

## Owner decisions waiting
- A repository of its own for this project.
- Whether Supabase project creation is approved (may incur cost).
