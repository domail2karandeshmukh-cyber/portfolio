---
type: concept
id: IT-EXP-033
owner: IT service desk
author: Karan Deshmukh
reviewer: Head of IT operations
version: 1.1
status: Approved
date: 2026-08-20
vars:
  company: Meridian Freight
  idp: Meridian Identity
  desk: Service Desk
---
# How access approvals work

Every access right at {{company}} is granted by a person who is answerable for it, and the record of that decision outlives the access. This page explains who approves what, why a request takes the path it takes, and what happens after the access is granted. Fictional sample written for this portfolio.

## Two kinds of access

**Standard access** comes with a job. A department group gives it on the day the {{desk}} creates the account, and nobody approves it one request at a time. The department head approved the group's contents when the group was set up, and reviews them twice a year.

**Requested access** is everything else: an application outside the department's standard set, a higher role in an application the person already uses, or a privileged role. Requested access always goes through the {{desk}} portal, so that the request, the decision, and the grant are in one record.

## The path of a request

1. The hiring manager, or later the employee, submits the request. The portal asks for the application, the role, the reason, and an end date if the access is temporary.
2. The manager approves. For a request the manager submitted, this step is already done.
3. The application owner approves and chooses the role. The owner knows what the role allows, and the manager doesn't have to.
4. For a privileged role, the security team approves as well. The team checks that the role matches the reason and that the person has completed the training the role needs.
5. The {{desk}} grants the access and records what was granted, by whom, and until when.

A request that any approver declines stops there. The portal tells the requester who declined and why, and the requester can submit a changed request.

## Why the owner, and not the manager, chooses the role

A manager knows what their team member needs to do. An application owner knows which role lets them do it with the least access. Keeping the two decisions apart means that nobody gets a broad role because it was the only one the manager had heard of.

## Time limits

| Kind of access | Lasts | Then |
|---|---|---|
| Standard access | As long as the person is in the department | HR's change of department removes the old group and adds the new one. |
| Requested access, no end date | Until the next review | The owner reviews it every six months and removes what isn't used. |
| Temporary access | Until the end date in the request | {{idp}} removes it on its own and closes the request. |
| Privileged role | Ninety days | The owner and the security team review it, and the holder requests it again if it's still needed. |

## What is recorded

Each request keeps the reason, every approval with its time and approver, the role granted, and the end date. {{idp}} keeps the grant and the removal in its audit log. Together they answer the auditor's two questions: who had access to what, and who said they could.

## Related documents

- SOP-IT-030: *Onboard a new employee: accounts and access*.
- IT-REF-032: *Roles and responsibilities for onboarding*.
