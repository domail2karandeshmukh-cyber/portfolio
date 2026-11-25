# AI SOC — baseline triage pipeline

A first, working slice of the SOC product: alerts in the shape Wazuh sends go in; explained incidents and a queue of proposed actions come out. A React page lets an analyst read each incident and approve or reject the proposed actions. No model is involved yet. This is the baseline any model has to beat on accuracy, speed and cost before it earns a place.

> **This branch is parked in the portfolio repository only because the project has no repository of its own yet. It shares no history with the website. Never merge it into `main`.**

## What it does

1. **Normalise** — checks each alert, bounds every field, masks anything that looks like a password or token, and rejects what it can't trust, with the reason.
2. **Enrich** — adds what the organisation already knows: which addresses are its own, which accounts allow password login, planned changes, training sessions, the scanner's schedule.
3. **Correlate** — groups events that share a source address or an account on a machine within 30 minutes into one incident.
4. **Triage** — scores each incident with fixed, named rules. Every point of the score carries a sentence and the events behind it. Verdict: true positive, false positive, or needs review.
5. **Propose** — for an escalation, lists actions (block an address, disable an account, isolate a machine). **Nothing is carried out.** The code has no way to run an action: a named analyst approves or rejects each one with a written reason, and a rule engine or model can't approve anything.
6. **Audit** — every step goes into a log in which each entry carries the hash of the one before, so a changed, removed or reordered entry shows.
7. **Evaluate** — runs labelled scenarios and reports accuracy, missed attacks, false escalations, time per alert and model cost.

## Run it

Needs Node 22.18 or later. The pipeline itself has no dependency and Node runs its TypeScript directly; `npm install` is only for the analyst's page (React, esbuild) and the type check (TypeScript).

```
npm test                               # 17 pipeline tests
npm run evaluate                       # the 12 labelled scenarios
node src/cli.ts triage data/sample-day.json
npm run data                           # regenerate data/ from data/build.ts

npm install
npm run check                          # type check
npm run build                          # dist/index.html, one self-contained file: open it in a browser
npm run e2e                            # 67 browser checks (needs Python Playwright, Chrome, and `npm install --no-save axe-core`)
```

## The analyst's page

`ui/main.tsx` runs the same pipeline in the browser on `data/sample-day.json`. Four views: incidents (escalations first; each reason with its weight and a control that marks the events behind it), the approval queue, the audit log with its chain check, and the evaluation with its warning above the numbers.

- Approving or rejecting calls the same `ActionQueue.decide()` the tests cover, so the page enforces nothing of its own: a machine name, an empty name or a missing reason is refused by the core.
- **There is no sign-in.** The analyst's name is whatever is typed, so the page shows the approval flow but proves nothing about who approved. Real use needs authentication first.
- Decisions and the audit log live in the page's memory and are gone on reload.
- Alert text is rendered as text only.

## What the numbers mean, and don't

`npm run evaluate` reports 12 of 12 scenarios correct. **That is not a measure of how well this would do in a real SOC.** The rules and the scenarios were written by the same hand at the same time, so the score shows the pipeline behaves as designed and gives a fixed yardstick for comparing a model later. A fair test needs alerts the rules haven't seen, labelled by someone else.

## Limits to know before relying on anything here

- **All data is synthetic.** Hosts, accounts and events are invented; every address is from the ranges reserved for documentation (192.0.2.0/24, 198.51.100.0/24, 203.0.113.0/24).
- **The Wazuh rule IDs, groups and descriptions in the data were written from memory and have not been checked against a Wazuh installation.** The pipeline has never read alerts from a real manager. Expect to adjust `kindOf()` in `src/ingest.ts` when it does.
- The ATT&CK technique names in `src/ingest.ts` are a short hand-written list, also unchecked against the current ATT&CK release.
- The rules cover six patterns (password guessing, new accounts and rights, web shells, malware and test files, scans). Anything else is sent to a person as "needs review", which is the intended safe default, not coverage.
- Secret masking is pattern-based and will miss formats it doesn't know.
- No database, no sign-in, no live connection to Wazuh, no model. The audit log lives in memory; its chain detects edits but isn't signed, so someone who can rewrite the whole log can rewrite the hashes.

## Adding a model later

Implement `Triager` from `src/types.ts` and pass it to `run()` or `evaluate()`. A model receives normalised events as data, returns a verdict, factors and proposals, and reports its token use; it gets no approve path. `tests/pipeline.test.ts` shows a triager that closes every incident being caught by the evaluation, and instructions planted inside alert text being ignored by the baseline — a model-backed triager must pass the same test.

## Layout

```
src/types.ts      shapes shared by everything
src/ingest.ts     normalise, mask, enrich
src/triage.ts     correlate, baseline rules
src/control.ts    audit log, approval queue
src/pipeline.ts   run, evaluate
src/cli.ts        command line
src/sha256.ts     the hash for the audit chain, the same in Node and a browser
ui/               the analyst's page (React) and its build
data/build.ts     writes inventory.json, scenarios.json, sample-day.json
tests/            node --test, and e2e.py for the page
```
