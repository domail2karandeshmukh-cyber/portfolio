---
type: how-to
id: RB-READ-003
owner: Site reliability
version: 1.5
status: Approved
vars:
  service: the readings service
---
# Runbook: {{service}} stops responding

For the engineer on call. Follow it when the alert "Readings API not responding" fires. Fictional sample.

## Before you start

- You're on call, and you have access to the status page and the deployment tool.
- Tell the incident channel that you're working on the alert.

## Steps

1. Open the status page, and then check whether the database shows as healthy.
2. If the database is healthy, restart {{service}} in the deployment tool.
3. Wait two minutes, and then check whether the alert clears.
4. If the alert stays, roll back to the last version that worked.
5. Post the time and the action you took in the incident channel.

## Check that it worked

The alert clears, and a test request to the readings API gets the status 200.

## Escalate

If the service still doesn't respond after the rollback, page the platform team lead. Give them the time the alert fired and every action you took.
