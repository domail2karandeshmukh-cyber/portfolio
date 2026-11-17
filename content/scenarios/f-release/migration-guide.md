---
type: how-to
id: RN-FB-2.4-MG
owner: Product documentation
author: Karan Deshmukh
reviewer: Release manager
version: 2.4.0
status: Published
date: 2026-11-03
vars:
  product: Fieldbook
  version: 2.4
  previous: 2.3
---
# Upgrade from {{product}} {{previous}} to {{version}}

What an administrator does before, during, and after the {{version}} release so that technicians keep working and integrations keep running. The web app upgrades on its own; the work is in the integrations, the mobile fleet, and the settings that have a new default. Allow half a day, most of it waiting for the mobile apps to update. Fictional sample written for this portfolio.

## Before you start

- You have the **Account administrator** role in {{product}}.
- You have a list of every integration that calls the {{product}} API, with the team that owns each one. The **Integrations** page under **Settings** lists the API keys and when each was last used.
- You have told technicians that the mobile app updates between 3 and 6 November 2026, and that they sign in again afterwards.

> **Important:** Every integration that still calls the version 1 API stops working at the release. Check the **Last used** column before the release date, not after.

## A week before: move integrations to API version 2

1. On the **Integrations** page, sort by **API version**. Each key that shows **v1** needs work.
2. For each v1 key, ask the owning team to change the base path from `/api/v1/` to `/api/v2/` and to read the field changes below.
3. Create a new key with the **v2** scope for each integration. Don't reuse the v1 key: its scopes don't map onto v2.
4. Test each integration against the sandbox account, which runs {{version}} from 20 October.
5. Revoke the v1 keys once their integrations run on v2. A revoked key can't be restored, so do this last.

### Field changes between v1 and v2

| In v1 | In v2 | Note |
|---|---|---|
| `status: "done"` | `status: "completed"` | The other statuses are unchanged. |
| `assignee` (a name) | `assignee_id` (an identifier) | Look up names with `GET /api/v2/technicians`. |
| `scheduled` (local time, no zone) | `scheduled_at` (UTC, ISO 8601) | Convert with the account's time zone from `GET /api/v2/account`. |
| `parts[].code` | `parts[].part_number` | The value is the same. |
| Pagination by `page` | Pagination by `cursor` | Follow the `next` link in the response instead of counting pages. |

## The day before: check the mobile fleet

1. Under **Devices**, filter by **App version**. Devices on 2.2 or older can't sign in after the release.
2. Ask the owners of those devices to update from the store, or push the update through your device management.
3. Devices on {{previous}} keep working until 31 January 2027, so they don't block the release. Plan their update for the following weeks.

## Release day: review the settings with new defaults

1. Under **Settings** > **Mobile**, set **Offline mode** to **On** for the teams that work in places without coverage. It's off by default, so that nothing changes for teams that don't need it.
2. Under **Settings** > **Security**, check **Mobile session length**. The new default is 12 hours. Raise it to at most 7 days for teams that share devices and can't sign in each shift, and record why.
3. Under **Settings** > **Scheduling**, choose who can use **Bulk scheduling**. The default is dispatchers only.
4. Under **Settings** > **Branding**, upload the logo for service reports if you want one. Reports without a logo keep the layout from {{previous}}.

## After the release: watch the first week

1. On the **Integrations** page, confirm that no key shows a call to v1 in the last 24 hours. A call to v1 gets `410 Gone` and appears in the key's error count.
2. Under **Devices**, confirm that every active device is on 2.3 or 2.4.
3. Under **Reports** > **Sync**, watch for work orders that stay in **Waiting to sync** for more than an hour. Most are devices that haven't been online; a device that is online and still waiting is a case for support.
4. Tell technicians about the conflict prompt that appears when a dispatcher and a technician edited the same work order offline. Choosing **Keep mine** or **Keep theirs** is new to them.

## Check that it worked

Integrations show calls to v2 only. Every active device runs 2.3 or 2.4. The sync report shows no work order waiting for more than an hour from a device that is online. Technicians who were given offline mode have completed at least one work order without a connection, which shows as **Synced from offline** in the work order's history.

## If something goes wrong

| Problem | What to do |
|---|---|
| An integration gets `410 Gone` | It's still calling v1. Move it to v2; there's no way to turn v1 back on. |
| An integration gets `401` on v2 | It's using a v1 key. Issue a v2 key. |
| A technician's app says **Update required** | The device is on 2.2 or older. Update it from the store. |
| Work orders edited offline don't appear in the office | Check the device's sync status under **Devices**. If it shows an error, ask the technician to open the app with a connection and select **Sync now**. |
