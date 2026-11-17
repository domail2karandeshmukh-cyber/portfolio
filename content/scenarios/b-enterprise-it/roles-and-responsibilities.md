---
type: reference
id: IT-REF-032
owner: IT service desk
author: Karan Deshmukh
reviewer: Head of IT operations
version: 1.3
status: Approved
date: 2026-09-14
vars:
  company: Meridian Freight
  desk: Service Desk
---
# Roles and responsibilities for onboarding

Who does what when a new employee joins {{company}}, and how long each part may take. Use this table to find out whom to ask when a request stalls. Fictional sample written for this portfolio.

## Responsibility matrix

R is responsible for doing the work, A is accountable for the result, C is consulted, and I is informed.

| Activity | HR | Hiring manager | {{desk}} | Application owner | Security team |
|---|---|---|---|---|---|
| Record the new employee | R, A | C | I | | |
| Submit the onboarding request | I | R, A | I | | |
| Create the identity and mailbox | | I | R, A | | |
| Order and image the laptop | | C | R, A | | |
| Approve application access | | C | I | R, A | |
| Approve privileged roles | | | I | C | R, A |
| Grant access | | I | R, A | I | |
| Confirm the first-day checklist | | R, A | I | | |
| Review privileged roles every ninety days | | C | I | R | A |
| Remove access when someone leaves | R | C | R, A | I | I |

## Service levels

The clock starts when the previous activity is complete, during working hours at the location of the new employee.

| Activity | Target | Measured from |
|---|---|---|
| Check the onboarding request | One working day | Submission of the request |
| Create the identity and mailbox | One working day | The request is checked |
| Laptop delivered to the location | Three working days | The order is placed |
| Application owner's decision | Two working days | The owner is added as an approver |
| Security team's decision on a privileged role | Three working days | The owner's approval |
| First-day checklist confirmed | Two working days | The start date |

## Who to contact

| Question | Contact |
|---|---|
| The start date or manager is wrong | HR operations, through the **People** queue in the {{desk}} portal |
| An application owner hasn't answered | The owner's deputy, listed in the application catalogue |
| A privileged role is urgent | The security on-call engineer, through the **Security** queue |
| The laptop hasn't arrived | Hardware logistics, through the **Hardware** queue |

## Standard access by department

Every employee gets a mailbox, the intranet, and the chat tool through their department group. The groups below add the applications the department uses every day. Anything else needs a request.

| Department | Group | Adds |
|---|---|---|
| Operations | `grp-ops-standard` | Dispatch board, fleet telematics (read), customer portal (agent) |
| Finance | `grp-fin-standard` | Ledger (read), expenses, procurement portal |
| Sales | `grp-sales-standard` | CRM, quoting tool, customer portal (read) |
| Engineering | `grp-eng-standard` | Source control, CI, the staging environment |
| Human resources | `grp-hr-standard` | HR system, recruitment tool, learning platform |
