---
type: reference
id: RN-FB-HIST
owner: Product documentation
author: Karan Deshmukh
reviewer: Release manager
version: 2.4.0
status: Published
date: 2026-11-03
vars:
  product: Fieldbook
---
# {{product}} version history and change impact

The releases of {{product}} 2.x, what each one changed, and what each role notices first after the 2.4 release. Use the impact table to plan who needs a message, a short training, or nothing at all. Fictional sample written for this portfolio.

## Releases

| Version | Date | Theme | Headline changes |
|---|---|---|---|
| 2.4 | 3 November 2026 | Work without a connection | Offline work orders, bulk scheduling, signature capture. API v1 removed. |
| 2.3 | 1 July 2026 | Scale | Work-order lists for large accounts, CSV export in the background, API v1 stops accepting new integrations. |
| 2.2 | 10 March 2026 | API v2 | API v2 released with cursor pagination and UTC timestamps. API v1 deprecated. Checklists on work orders. |
| 2.1 | 18 November 2025 | Teams | Teams and team-based visibility, the daily digest email, single sign-on with OpenID Connect. |
| 2.0 | 2 September 2025 | New mobile app | The current mobile app replaces the 1.x app. Parts catalogue on the device. |

## Support dates

| Version | Supported until | What ends |
|---|---|---|
| Mobile app 2.4 | The release after next | |
| Mobile app 2.3 | 31 January 2027 | Sign-in stops working. |
| Mobile app 2.2 and older | 3 November 2026 | Sign-in stopped working at the 2.4 release. |
| API v2 | Current | |
| API v1 | 3 November 2026 | Removed. Calls get `410 Gone`. |

## Change impact by role, 2.4

What each role sees first, and what they need from you. "Nothing" means the change is invisible to them unless they look for it.

| Change | Technician | Dispatcher | Administrator | Integration owner |
|---|---|---|---|---|
| Offline work orders | A **Waiting to sync** state and a conflict prompt. Needs a short explanation. | Work orders that update late in the day. Needs to know why. | Turn it on per team. | Nothing. |
| Bulk scheduling | Nothing. | A new **Schedule selected** action. Needs ten minutes with the proposal screen. | Choose who can use it. | Nothing. |
| Signature capture | A **Sign** step on completed work orders. Needs to know when to offer it. | Signatures on service reports. | Nothing. | The `signature` field on completed work orders in API v2. |
| API v1 removed | Nothing. | Nothing. | Revoke v1 keys. | Move every call to v2 before the release. |
| Session length of 12 hours | Signs in at the start of a shift after a day off. | Nothing. | Raise it for shared devices if needed. | Nothing. |
| Legacy app can't sign in | Devices on 2.2 or older show **Update required**. | Nothing. | Update the fleet before the release. | Nothing. |
| Daily digest renamed | Nothing. | The email has a new subject line. | Nothing. | Nothing. |

## Which messages to send

| Audience | Send | When |
|---|---|---|
| All technicians | One message: the app updates, you sign in again, offline mode if your team has it, the conflict prompt. | A week before, and again the day before |
| Dispatchers | One message with a link to the bulk-scheduling guide, and a short session on the proposal screen. | The week of the release |
| Integration owners | A message per integration that still calls v1, with the migration guide. | As early as possible, and until the **Last used** column shows no v1 calls |
| Administrators | The migration guide. | Two weeks before |

## Related documents

- RN-FB-2.4: *{{product}} 2.4 release notes*.
- RN-FB-2.4-MG: *Upgrade from {{product}} 2.3 to 2.4*.
