---
category: Cloud services
section: Backups and exports
audience: customers
status: published
labels: backup, export, storage
---
# Back up your books to cloud storage

Ledgerly keeps your data in two data centres and restores it if anything goes wrong on our side. A backup in your own cloud storage is for your side: an archive you control, in a format other tools can read.

## What a backup contains

A backup is a ZIP file with your invoices, bills, contacts, chart of accounts, and transactions as CSV files, plus every attachment as the original file. It doesn't contain passwords or bank connections.

## Set up automatic backups

1. Select **Settings** > **Backups**.
2. Select **Connect storage**, and then choose your storage provider and sign in to it.
3. Choose the folder for the backups.
4. Choose how often: **Weekly** or **Monthly**.
5. Select **Save**.

## Check that it worked

The first backup runs within an hour and appears in the chosen folder as `ledgerly-backup-<date>.zip`. **Settings** > **Backups** shows the time of the last backup and the next one.

## Download a backup now

Under **Settings** > **Backups**, select **Download now**. For accounts with many attachments, the file is prepared in the background and you get an email with a link that works for 24 hours.
