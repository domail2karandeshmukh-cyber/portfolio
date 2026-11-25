# Current handoff

Last updated: 2026-11-25 by Claude (cloud session)

- **Where this lives:** the branch `ai/cyberatlas-mvp-claude` of `domail2karandeshmukh-cyber/portfolio`. It is an orphan branch: it shares no history with the portfolio and must never be merged into it. It is parked there because Claude could not create a repository. Move it to its own repository when one exists: `git push <new-remote> ai/cyberatlas-mvp-claude:main`.
- **State:** MVP built and tested, then a fourth module added (accounts and phishing: three lessons and the inbox lab). Not deployed, not public.
- **Scope met from the owner's brief:** now 4 modules, 13 lessons, 4 deterministic graded simulations, a network diagram with a text alternative, a terminal simulator with a fixed command list and invented logs, quizzes with explanations, progress storage, reset, hints, a certification roadmap.
- **Choices to know about:** no framework and no dependency; the terminal is a small simulator written for this project, not xterm.js, because the lab needs a form field and a log, not a terminal emulator; progress is in localStorage, so there is no Supabase and no personal data.

## Tests, 2026-11-25

| Command | Result |
|---|---|
| `npm test` | 17 passed |
| `node build.js && python3 tests/e2e.py` | 63 passed, with axe-core's WCAG 2.0 to 2.2 A and AA rules clean on the home page, a lesson, each lab and the roadmap, and a 360-pixel phone |

Not run: Lighthouse, WebKit, Firefox, a screen reader, a real phone.

## Open before any release

1. A security instructor reads the thirteen lessons, the six alert explanations and the six message explanations. In the passwords lesson, check the sentence about NIST's guidance on forced password changes against the current SP 800-63B. An AI model wrote them.
2. The certification names and descriptions in `src/content.js` are checked against each body's current site. They were not looked up.
3. The owner picks a name, a licence, a repository and a host.

## Next

Done since the MVP: the accounts and phishing module. Still to do: more lessons per module (web basics and encryption are the obvious gaps), then the AI engineering strand. Keep the rules in `AGENTS.md`.
