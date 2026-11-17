---
type: concept
id: SEC-EXP-013
owner: Security operations
author: Karan Deshmukh
reviewer: SOC lead
version: 1.2
status: Approved
date: 2026-10-20
vars:
  siem: Wazuh
---
# What the alert means: SSH authentication failures in {{siem}}

{{siem}} raises an alert when it recognises a pattern in the logs it collects. For SSH, the pattern starts with one line that the `sshd` service writes for every failed sign-in. If the failures keep coming, it ends with a brute-force rule at level 10. Knowing which rule fired, and why, tells you how much of the alert is already analysis and how much is left for you. Fictional sample written for this portfolio, with simulated data.

## The log line behind the alert

Every failed SSH sign-in leaves a line like this one in the host's authentication log.

```text
Oct 20 03:14:07 web-01 sshd[18422]: Failed password for deploy from 203.0.113.45 port 51822 ssh2
```

The {{siem}} agent on the host forwards the line to the manager. A decoder splits it into fields: the program `sshd`, the user `deploy`, the source address `203.0.113.45`, and the port. The rules then match on those fields, not on the raw text.

## The rules, from one event to a pattern

| Rule | Level | Fires when | What it tells you |
|---|---|---|---|
| 5716 | 5 | One failed password for a user that exists. | Somebody, or something, used a wrong password once. |
| 5710 | 5 | One attempt to sign in as a user that doesn't exist. | A guess, often from a list of common names. |
| 5763 | 10 | Eight or more events of rule 5716 from one source within two minutes. | A sustained attempt on accounts that exist: the alert this runbook family is about. |
| 5712 | 10 | Eight or more events of rule 5710 from one source within two minutes. | A sustained attempt with guessed names. |
| 5715 | 3 | One successful sign-in. | Normal on its own, and decisive right after 5763 or 5712 from the same source. |

The thresholds are the defaults in the ruleset that ships with {{siem}}. Your deployment may tune them. Check the rule's definition in the dashboard before you rely on a number from this page.

## Why the level matters

{{siem}} levels run from 0 to 15. The SOC's alert policy sends level 10 and above to the console at once, keeps 5 to 9 for the daily review, and stores the rest for searching. That is why you see one alert for the brute-force rule and not three hundred for each failed password. The single events are there in the data, and the rule has already counted them for you.

## What the alert doesn't tell you

The alert says that failures came in quickly from one address. It doesn't say whether any attempt succeeded, or whether the address is one of ours. It doesn't say whether the host should be reachable from that address at all, or whether the same source is trying other hosts. Those four questions are the investigation, and the runbook asks them in that order.

## The attacker's technique

In the MITRE ATT&CK framework, repeated password attempts are **T1110, Brute Force**. The sub-technique is **T1110.001, Password Guessing**, when the attacker tries many passwords against known users. It is **T1110.003, Password Spraying**, when the attacker tries a few common passwords against many users. The ruleset tags rule 5763 with T1110, which is how the alert appears under that technique on the dashboard's MITRE view.

## Common false positives

- A monitoring or backup job with an expired password, retrying on a schedule. The source is internal and the timing is regular.
- A developer's script with the wrong key, falling back to passwords. The target user is the developer's own.
- A load balancer's health check against port 22. The attempts have no user at all and show up under a different rule.

Each one is fixed at the source. Silencing the rule for an address hides the next real attempt from that address.
