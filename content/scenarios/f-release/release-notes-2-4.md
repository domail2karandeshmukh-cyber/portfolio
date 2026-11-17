---
type: release-notes
id: RN-FB-2.4
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
# {{product}} {{version}} release notes

{{product}} {{version}} lets technicians work through a whole shift without a connection, lets dispatchers schedule a week of work orders at once, and retires the version 1 API. The web app updates on 3 November 2026 at 22:00 UTC; the mobile apps follow in the stores over the next three days. Read *Change impact* below for what each role sees first, and RN-FB-2.4-MG for the upgrade steps. Fictional sample written for this portfolio: {{product}} is an invented product.

## New features

### Offline work orders

Technicians can open, edit, and complete work orders without a connection. At the start of the shift, the app stores the day's assigned work orders, their checklists, and the parts catalogue on the device. It sends the changes when the connection returns.

- A work order edited offline shows **Waiting to sync** until it's sent.
- If a dispatcher changes the same work order in the meantime, the app keeps both versions and asks the technician to choose at the next sync.
- Photos taken offline are compressed to 1.5 MB each and sent after the text, so that the status reaches the office first.

### Bulk scheduling

Dispatchers can select up to 200 unassigned work orders and schedule them in one step. The scheduler proposes technicians by skill, location, and remaining capacity, and shows the travel time each assignment adds.

### Signature capture

A customer can sign a completed work order on the technician's device. The signature is stored as an image with the work order, with the time, the device, and the technician's name, and appears on the service report.

## Improvements

- The work-order list loads in under a second for accounts with up to 50,000 open orders. It took up to six seconds in {{previous}}.
- The parts search matches partial part numbers and supplier references.
- Service reports can carry the customer's logo. Administrators upload it under **Settings** > **Branding**.
- The mobile app asks for location access only while a work order is in progress, not all the time.

## Fixed issues

| Issue | What happened in {{previous}} | What happens now |
|---|---|---|
| FB-4821 | A work order closed on the mobile app could reopen on the web if the two were edited within a minute of each other. | The later change wins, and the earlier one is kept in the history. |
| FB-4903 | The weekly summary email counted cancelled work orders as completed. | Cancelled orders have their own line. |
| FB-4967 | Checklists with more than 40 items cut off the last items on small screens. | The checklist scrolls. |
| FB-5012 | Exporting more than 10,000 work orders to CSV failed without a message. | The export runs in the background and sends a download link. |
| FB-5044 | A technician removed from a team kept seeing the team's work orders until they signed out. | The list refreshes within a minute of the change. |

## Deprecated and removed

- **The version 1 API is removed.** It was deprecated in 2.2 and stopped accepting new integrations in {{previous}}. Integrations that still call `/api/v1/` get `410 Gone` from this release. See the migration guide.
- **The legacy mobile app (1.x)** can't sign in to accounts on {{version}}. The app shows a message that points to the current app.
- The **Daily digest** email is renamed **Daily summary**. Its content is unchanged.

## Known limitations

- Offline mode holds at most 150 work orders per device. A technician with more assigned work sees the first 150 by scheduled time, and the rest after a sync.
- Bulk scheduling doesn't yet account for a technician's planned leave on the same day. A proposal may assign work to someone who is away; the dispatcher sees a warning and can reassign.
- Signature capture isn't available on the web app. Signatures are collected on the mobile app only.
- Offline photos aren't available in the work order's web view until the sync finishes, which can take several minutes on a slow connection.

## Security

- Session tokens for the mobile app now expire after 12 hours of inactivity instead of 30 days. Technicians sign in again at the start of a shift after a day off.
- The audit log records who exported customer data, and when.

## Compatibility

| Component | Supported in {{version}} |
|---|---|
| Mobile app | 2.4 on iOS 16 or later and Android 11 or later; 2.3 keeps working until 31 January 2027 |
| Web app | The current and previous major version of Chrome, Edge, Firefox, and Safari |
| API | Version 2 only |
| Single sign-on | SAML 2.0 and OpenID Connect, unchanged |
