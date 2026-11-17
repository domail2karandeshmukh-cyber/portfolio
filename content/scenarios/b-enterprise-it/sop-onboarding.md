---
type: how-to
id: SOP-IT-030
owner: IT service desk
author: Karan Deshmukh
reviewer: Head of IT operations
version: 2.0
status: Approved
date: 2026-09-14
vars:
  company: Meridian Freight
  idp: Meridian Identity
  desk: Service Desk
---
# Onboard a new employee: accounts and access

Standard operating procedure for {{company}}. It covers every account and access right a new employee needs from the day the offer is signed to the end of their first week. The {{desk}} owns the procedure; HR, the hiring manager, and the application owners each have a part in it. Fictional sample written for this portfolio.

## Scope

This procedure applies to employees and long-term contractors who get a {{company}} identity. It doesn't apply to visitors, auditors, or suppliers, who get guest accounts under SOP-IT-034.

## Before you start

- HR has created the person in the HR system with a start date, a manager, a department, and a location.
- The hiring manager has submitted an **Onboarding request** in the {{desk}} portal. Without it, nothing in this procedure starts.
- You have the **Identity administrator** role in {{idp}}.

> **Important:** Create accounts no earlier than five working days before the start date. An account that sits unused for longer is a risk, and the security team disables it.

## Roles

| Role | What they do |
|---|---|
| HR | Records the start date, manager, department, and location. |
| Hiring manager | Requests the accounts, names the applications the person needs, and approves the first-day checklist. |
| {{desk}} | Creates the identity, the mailbox, and the device, and tracks the request to the end. |
| Application owner | Approves access to their application and chooses the role. |
| Security team | Reviews requests for privileged roles. |

## Procedure

### Day −5: check the request

1. Open the onboarding request in the {{desk}} portal.
2. Compare the name, start date, manager, and department with the HR record. If anything differs, send the request back to HR with a comment.
3. Check that every application in the request has a named owner. Add the owner as an approver for each one.
4. Set the request to **Checked** and assign it to yourself.

### Day −3: create the identity and the mailbox

1. Create the standard account in {{idp}} by following *Provision a standard user account* (IT-PR-031).
2. Add the account to the groups for the person's department and location. The groups give the mailbox, the intranet, and the chat tool.
3. Order the laptop from the hardware catalogue with the department's standard image. Ship it to the location in the request.
4. Record the account name and the ticket number in the request.

### Day −1: collect the approvals

1. Check that each application owner has approved or declined their application in the request.
2. For each approved application, grant the role the owner chose. Record the role in the request.
3. For a declined application, add the owner's comment to the request so the manager can see it.

::: only privileged

### Privileged roles

A request for a privileged role, such as domain administrator, database administrator, or payroll approver, needs the security team's approval as well as the application owner's. Record both approvals in the request before you grant the role. The {{desk}} grants a privileged role for ninety days at a time, and the owner reviews it at the end of each period.

:::

### Day 1: activate and hand over

1. Activate the account at 08:00 local time on the start date. {{idp}} does this on its own when the start date is set; check that it happened.
2. Send the welcome message to the person's private email address with the account name and the enrolment link. Never send a password: the person sets one during enrolment.
3. Confirm with the manager that the laptop has arrived.
4. Set the request to **Handed over**.

### Day 5: close the request

1. Ask the manager to confirm the first-day checklist in the portal.
2. Check in {{idp}} that the person has enrolled a second factor and signed in at least once.
3. Close the request.

## Check that it worked

The request is closed, the person has signed in, and every application in the request shows either a granted role or a recorded decline. The security team's weekly report lists no account older than five days without a sign-in.

## Records

| Record | Where | Kept for |
|---|---|---|
| Onboarding request with approvals | {{desk}} portal | Seven years |
| Account creation log | {{idp}} audit log | Two years |
| Device assignment | Hardware inventory | Life of the device |

## Related documents

- IT-REF-032: *Roles and responsibilities for onboarding*.
- IT-PR-031: *Provision a standard user account*.
- IT-EXP-033: *How access approvals work*.
- IT-TS-035: *A new employee can't sign in on their first day*.
