---
type: release-notes
vars:
  product: Acme Console
  version: 4.2
---
# {{product}} {{version}} Release Notes

Released on March 4, 2026.

## New

- **Export to CSV.** Every report has an **Export** button. The file holds the rows you see, with your filters applied.

## Changed

- A sign-in session now lasts 12 hours. It lasted 24 hours before.

## Fixed

- A report with more than 10,000 rows no longer times out.

## Known Issues

- An export leaves out the columns you have hidden. Show the columns before you export.

::: only admin

## For Administrators

- The audit log records every export, with the name of the person who ran it.

:::
