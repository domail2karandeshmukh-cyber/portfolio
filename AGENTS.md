# Shared instructions for coding agents

CyberAtlas (a provisional name) is a separate project from the owner's portfolio. These rules apply to every AI coding agent that works on it.

## Before you edit

1. Run `git status` and `git fetch`. Read `HANDOFF.md`.
2. If the working tree holds changes you did not make, stop and ask the owner.

## Rules that protect learners

- **Simulations only.** A lab works out its result in the browser. No lab runs a command on any computer, sends a packet, scans, or reaches a host. Do not add a real shell, a container or a network call without the owner's written approval and a threat model.
- **Invented data only.** Addresses come from 192.0.2.0/24, 198.51.100.0/24 and 203.0.113.0/24, or from the private ranges when a lesson is about them. A test fails on any other address. No real organization, person, product log or alert.
- **Defensive.** Lessons teach how to read, check and decide. They contain no exploit, payload or instruction for attacking a system.
- **Original.** Write the lessons. Do not copy course text, graphics, labs or exam questions from anywhere.
- **No promises.** The roadmap names certifications; it promises no result and uses no exam content.
- **Deterministic and graded.** The same input gets the same marks. Answers are derived from the lab's own data where they can be, so a question can't drift from it.
- **No account, no tracking.** Progress stays in the learner's browser. Add nothing that sends data anywhere.
- **Accessible.** Keyboard for everything, a text alternative for every diagram, 44-pixel targets, no motion the learner didn't start. `tests/e2e.py` runs axe-core.
- **No dependency** in what ships. Keep it one static page that `node build.js` puts in `dist/index.html`.

## Checks before a handoff

```bash
npm test                                   # the engines and the content
npm install --no-save axe-core             # once, for the accessibility rules
node build.js && python3 tests/e2e.py      # every lesson and lab, in a real browser
```

Update `HANDOFF.md` at each milestone, then commit. Never push to a default branch or deploy without the owner's approval.
