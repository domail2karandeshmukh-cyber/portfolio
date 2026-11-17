---
type: reference
id: SEC-REF-014
owner: Security operations
author: Karan Deshmukh
reviewer: Head of security
version: 2.1
status: Approved
date: 2026-10-01
vars:
  org: Norrbyn Utilities
---
# Escalation matrix for security cases

Who the analyst on shift tells, how quickly, and through which channel, for each severity of case at {{org}}. The matrix applies to every case the SOC opens, whatever raised it. Fictional sample written for this portfolio: the roles are real kinds of roles, and the people behind them aren't named.

## Severities

| Severity | Definition | Examples |
|---|---|---|
| Low | An attempt that failed, from outside, against something that isn't exposed. No sign of success, no internal source. | A port scan. A brute-force attempt against users that don't exist. |
| Medium | An attempt with a chance of success, or anything from an internal source until it's explained. | A brute-force attempt against accounts that exist. Malware blocked on a workstation. An internal host probing another. |
| High | Evidence that an attacker got in, or that data left. | A successful sign-in from an attacking source. Ransomware activity. Credentials found in a public place. |
| Critical | High, and the safety of people or the supply of water or power is affected or threatened. | Access to a control-system network. A compromised engineering workstation that can reach field devices. |

## Who to tell, and when

The clock starts at the finding that set the severity, not at the alert.

| Severity | Tell | Within | Channel |
|---|---|---|---|
| Low | Nobody now. Summarise in the shift handover. | End of shift | Shift log |
| Medium | The SOC lead, in the daily review. If found at night, the SOC lead by message. | Next daily review, or one hour at night | Case comment with the **Review** tag; the SOC channel at night |
| High | The incident lead on call. | Fifteen minutes | Phone call from the on-call rota, then the case number by message |
| Critical | The incident lead on call, then the operations duty manager. | Fifteen minutes for both | Phone calls. Don't rely on messages at this severity. |

If the incident lead doesn't answer within ten minutes, call the next person on the rota. Record every call you make in the case, answered or not.

## What to have ready when you call

1. The case number.
2. The severity and the finding that set it, in one sentence.
3. The hosts and accounts involved.
4. What you have already done, including any block.
5. What you want decided, such as isolating a host, locking an account, or calling someone else in.

## Who decides what

| Decision | Who |
|---|---|
| Block an external address for 24 hours | The analyst on shift |
| Block an internal address | The SOC lead |
| Isolate a host | The incident lead |
| Lock a privileged account | The incident lead |
| Declare a security incident | The incident lead |
| Involve the operations duty manager | The incident lead |
| Inform the regulator or the police | The head of security, with legal counsel |
| Tell customers or the public | Communications, on the head of security's request |

## Handover

A High or Critical case never changes hands without a conversation. At the end of a shift, the analyst walks the next analyst through the case timeline, and both add a handover comment. The incident lead stays the same until they hand over themselves.

## Related documents

- RB-SEC-012: *Investigate a Wazuh alert: SSH brute-force attempt*.
- SEC-EXP-013: *What the alert means: SSH authentication failures in Wazuh*.
