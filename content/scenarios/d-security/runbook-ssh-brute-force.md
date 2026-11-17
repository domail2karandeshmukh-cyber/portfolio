---
type: how-to
id: RB-SEC-012
owner: Security operations
author: Karan Deshmukh
reviewer: SOC lead
version: 1.6
status: Approved
date: 2026-10-20
vars:
  org: Norrbyn Utilities
  siem: Wazuh
  console: SOC console
---
# Investigate a {{siem}} alert: SSH brute-force attempt

Runbook for the analyst on shift at {{org}} when {{siem}} raises rule 5763, *sshd: brute force trying to get access to the system*. The runbook takes you from the alert to one of three outcomes: a closed false positive, a blocked source, or an escalated incident. Work through it in order and record each decision in the case. Fictional sample written for this portfolio: the hosts, addresses, and people are simulated, and the data in the alert is made up.

## Before you start

- The alert is assigned to you in the {{console}}, and you have opened a case for it.
- You have read access to the {{siem}} dashboard and the firewall's block list, and write access to the case.
- You know the escalation matrix in SEC-REF-014 and have the on-call rota open.

> **Important:** Don't sign in to the affected host over SSH while you investigate. A successful sign-in from your own address during an attack confuses the timeline, and the host may already be compromised. Use the {{siem}} agent's data and the console's remote shell only.

## Triage, in the first ten minutes

1. Open the alert and note the fields that matter: `agent.name`, `data.srcip`, `data.dstuser`, `rule.level`, `rule.firedtimes`, and the timestamp of the first and last event in the group.
2. Check whether the source address is internal. An address in the site's ranges points to a misconfigured job or a compromised workstation, not an internet attacker. Record which.
3. Check whether the target user exists on the host. Rule 5763 fires for failed passwords on users that exist; rule 5710 fires for users that don't. Many attempts against users that exist, such as `deploy` or `admin`, deserve more attention than a dictionary of random names.
4. Search the last 24 hours for rule 5715, *sshd: authentication success*, from the same source address to any host. A success after a run of failures changes the case from an attempt to a likely compromise.
5. Set the case severity from the table below.

| What you found | Severity |
|---|---|
| External source, no success, target users don't exist | Low |
| External source, no success, target users exist | Medium |
| Internal source, any outcome | Medium, until the owner of the source is known |
| Any success from the attacking source | High |

## Investigate

### A failed attempt from outside

1. Look up the source address in the threat-intelligence list in the {{console}}. A known scanner confirms a low-severity case.
2. Check `rule.firedtimes` and the duration of the burst. Hundreds of attempts over seconds is a tool; a few attempts an hour apart may be a person who forgot a password, if the address belongs to a staff VPN range.
3. Check whether the host should accept SSH from the internet at all. Most of {{org}}'s hosts shouldn't: an open port 22 is a finding of its own, even when the attempt failed.

### A failed attempt from inside

1. Find the owner of the source address in the asset inventory.
2. Ask the owner, through the ticketing system and not by chat, whether a job or a person tried to reach the host. Record the answer.
3. If nobody owns the attempt, treat the source workstation as compromised: raise the severity to High and escalate.

### A successful sign-in from the attacking source

1. Raise the severity to High and escalate before you do anything else. The incident lead takes over coordination; you keep investigating.
2. In the {{siem}} dashboard, list every event from the host since the sign-in: new processes, new users, changed files under `/etc`, and outbound connections.
3. Don't change anything on the host yet. Containment is the incident lead's decision, because isolating a production host has consequences they can weigh and you may not know.

## Contain

Only for a Medium or High case, and only with the decision recorded in the case.

1. Block the source address at the perimeter firewall for 24 hours. Use the **Temporary blocks** list, which expires entries on its own.
2. For a successful sign-in, ask the incident lead whether to isolate the host. If yes, move it to the quarantine network from the firewall console. Don't shut it down: memory and running processes are evidence.
3. Lock the targeted accounts on the host until the investigation ends. For `root`, confirm that console access still works before you lock remote access.
4. If a key or password may be compromised, rotate it and record where else it was used.

## Escalate

Escalate according to SEC-REF-014. In short: a High case goes to the incident lead on call within fifteen minutes of the finding that raised it, and a Medium case goes into the daily SOC review. When you escalate, give the case number, the severity, the finding that set it, and what you have already done.

## Close the case

1. Record the outcome: false positive, blocked, or escalated, with the evidence for it.
2. For a false positive that recurs, such as a monitoring job that uses a wrong password, open a change request to fix the job. Don't silence the rule.
3. Add the source address to the watch list for thirty days, so that a return is flagged at once.

## Check that it worked

The case shows a severity, a decision at each step, an outcome, and the time of each action. No new events for rule 5763 from the source address appear after the block, and the watch list contains the address. For an escalated case, the incident lead has acknowledged it in the case within fifteen minutes.
