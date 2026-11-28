---
type: reference
vars:
  product: Acme Console
---
# Workspace Roles

What each role in a {{product}} workspace can open and change.

## Roles

| Role | Can open | Can change |
| --- | --- | --- |
| Viewer | Dashboards | Nothing |
| Analyst | Dashboards and reports | Their own reports |
| Owner | Everything | Everything, including the list of members |

## Limits

| Setting | Limit |
| --- | --- |
| Members in a workspace | 500 |
| Reports in a workspace | 2,000 |
| Owners in a workspace | At least one |

::: only admin

## Who Can Change a Role

Only an owner can change a role. An administrator of the organization can make themselves an owner of any workspace.

:::
