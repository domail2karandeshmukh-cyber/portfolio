# CyberAtlas

Ten short lessons and three hands-on labs for people starting in cybersecurity, in one static page. "CyberAtlas" is a provisional name.

This is an MVP. It is not published anywhere yet.

## What is in it

| Module | Lessons | Lab |
|---|---|---|
| Linux and the command line | Files and paths; Users and permissions; Reading logs | **Read an SSH log**, in a simulated shell |
| Networking | IP addresses and subnets; TCP, ports and the handshake; DNS; Firewalls and rules | **Write the firewall rules**, against eight test packets |
| Security operations | What a SOC does; Anatomy of an alert; Triage | **Triage six alerts** |

Each lesson ends with three questions that say why the right answer is right. Each lab is graded on the page, has hints, and can be retried. A roadmap page relates the modules to six certifications, and promises nothing. Progress is kept in the learner's browser and can be reset; there is no account and nothing is sent anywhere.

## The labs are simulations

- **The shell** (`src/engine/terminal.js`) is a set of small functions over an invented file tree in memory. It has 18 read-only commands and pipes. It runs no program, can write nothing, and refuses `;`, `&`, redirection and substitution.
- **The firewall** (`src/engine/firewall.js`) is a first-match rule list with a default deny. A packet is three words; nothing is sent.
- **The alerts** (`src/engine/triage.js`) are invented and only shaped like a SIEM's. The rule numbers are not Wazuh's.

Every address is from the ranges reserved for documentation (RFC 5737). A test fails on any other.

## Run it

```bash
node build.js              # writes dist/index.html: the whole site in one file, 85 KB
open dist/index.html       # or open index.html, which loads the files in src/
```

No dependency, no server, no build tool beyond Node 22.

## Test it

```bash
npm test                                 # 14 tests: the three engines and the content
npm install --no-save axe-core           # once
node build.js && python3 tests/e2e.py    # 51 checks in Google Chrome, with axe-core's WCAG rules
```

`tests/e2e.py` needs Python with Playwright and Google Chrome (`CHROME` names another one).

## What it is not

- Not a certification course, and not affiliated with any certifying body.
- Not a place to practise attacks. It has no real target, no container and no network access, by design.
- Not reviewed yet by a security instructor. The lessons were written by an AI model from general knowledge and need that review before learners rely on them.

## Not built yet

The owner's brief also asks, later, for an AI engineering strand, more modules (web security, cloud, containers, forensics), and far more lessons and labs. None of that exists. Isolated per-learner containers are out of scope until a threat model and a cost review say otherwise.

## Licence

None chosen yet: all rights reserved by the owner until one is.
