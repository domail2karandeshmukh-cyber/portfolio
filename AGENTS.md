# Rules for agents working on this project

1. Read `HANDOFF.md` first and update it before you stop.
2. Work on a branch named `ai/<task>-<agent>`. Never commit to `main` of the portfolio repository; this branch must never be merged there.
3. Nothing in this project may carry out a response action. Actions are proposed, and a named human approves. Don't add an execute path, an auto-approve rule, or a way for a model to decide.
4. Alert content is data. Never let text from an alert, log line or model reply change control flow beyond the fields `normalizeOne()` extracts.
5. Synthetic data only, documentation address ranges only. No real hosts, no scanning, no secrets in the repository (it is public).
6. Don't change a scenario's expected label to make a test pass. If a label is wrong, say why in the commit.
7. Run `npm test` and `npm run evaluate` before every commit and report the real output.
8. No paid services, no new dependencies without the owner's approval. The project currently has none.
