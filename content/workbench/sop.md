---
type: how-to
id: SOP-IT-021
owner: IT service desk
version: 1.2
status: Approved
vars:
  product: Acme Console
---
# Grant Temporary Administrator Access

Standard operating procedure for the IT service desk. Use it when an engineer needs administrator rights in {{product}} for a fixed time. Fictional sample.

## Before You Start

- The request names the engineer, the workspace, the reason, and the end date.
- The engineer's manager has approved the request in the ticket.
- Access lasts eight hours at most. For a longer time, send the request to the IAM team.

## Steps

1. In {{product}}, open **Access** > **Temporary roles**.
2. Select **Grant**, and then choose the engineer and the workspace.
3. Set the end time to the one in the request.
4. Paste the ticket number in **Reason**, and then select **Save**.
5. Add a comment to the ticket with the end time, and set the ticket to **Waiting for expiry**.

## Check That It Worked

The engineer appears under **Temporary roles** with the end time you set. When that time passes, the role ends on its own and the ticket closes.

## Records

The change log in {{product}} keeps who granted the role, to whom, and why. Auditors read it each quarter.
