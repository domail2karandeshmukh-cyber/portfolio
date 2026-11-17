---
type: how-to
id: IT-PR-031
owner: IT service desk
author: Karan Deshmukh
reviewer: Identity platform lead
version: 1.4
status: Approved
date: 2026-09-02
vars:
  company: Meridian Freight
  idp: Meridian Identity
  desk: Service Desk
---
# Provision a standard user account

Create the identity a new employee signs in with, set the attributes other systems read from it, and give it the standard access for the department. The procedure takes about fifteen minutes in {{idp}}. Fictional sample written for this portfolio.

## Before you start

- The onboarding request is checked (SOP-IT-030) and assigned to you.
- You have the **Identity administrator** role in {{idp}}.
- You know the person's legal name, preferred name, start date, manager, department, location, and job title from the HR record.

> **Caution:** Enter the attributes exactly as the HR record has them. The payroll, badge, and expenses systems read them from {{idp}} every night, and a wrong department sends the person's costs to the wrong budget.

## Create the identity

1. In {{idp}}, select **Users** > **New user**.
2. Enter the legal name in **Full name** and the preferred name in **Display name**.
3. Let {{idp}} propose the account name. It uses the first initial and the last name, and adds a number when the name is taken. Don't change it: the mailbox and the home drive take their names from it.
4. Set **Start date** to the date in the HR record. The account stays inactive until 08:00 local time on that date.
5. Enter the manager, department, location, and job title.
6. Select **Create**.

## Give the standard access

1. On the new user's page, select **Groups** > **Add**.
2. Add the department group, such as `grp-ops-standard`. The groups are listed in IT-REF-032.
3. Add the location group, such as `loc-rotterdam`. It gives the printers and the Wi-Fi profile for the site.
4. Select **Licences** > **Assign**, and then choose **Standard employee**. The licence creates the mailbox within an hour.
5. Select **Save**.

## Prepare the enrolment

1. Select **Sign-in** > **Enrolment link**, and then select **Generate**.
2. Copy the link into the onboarding request, in the **Welcome message** field. The link works for fourteen days from the start date and asks the person to set a password and a second factor.
3. Under **Devices**, select **Pre-register**, and then enter the serial number of the laptop from the hardware order. The laptop enrols on its own the first time the person signs in to it.

::: only admin

## Service accounts and shared mailboxes

Don't use this procedure for a service account or a shared mailbox. A service account has no start date, no manager, and no licence, and it gets a managed secret instead of a password. Follow IT-PR-036 instead, and record the owning team in the **Owner** attribute.

:::

## Check that it worked

The user's page shows **Inactive until** followed by the start date, the department and location groups, the **Standard employee** licence, and a pre-registered device. The **Directory sync** panel shows the account in the next sync, within fifteen minutes. Record the account name in the onboarding request.

If the page shows **Attribute conflict**, another account already has the same employee number. Don't create a second identity: send the request back to HR to resolve the duplicate.
