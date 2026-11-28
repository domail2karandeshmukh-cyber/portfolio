---
type: troubleshooting
vars:
  product: Acme Console
---
# A Report Shows "Access is denied"

You open a report in {{product}} and see "Access is denied" in place of the report.

## Why It Happens

Your account has the Viewer role in the workspace that owns the report. A viewer can open dashboards, but not the reports behind them.

## Fix It

1. Open the workspace that owns the report.
2. Select **Members**, and then find your name.
3. Ask a workspace owner to change your role to **Analyst**.

## If That Didn't Work

- Sign out, and then sign in again. A role change applies at the next sign-in.
- If the message stays, send the report's address and the time of the error to the service desk.
