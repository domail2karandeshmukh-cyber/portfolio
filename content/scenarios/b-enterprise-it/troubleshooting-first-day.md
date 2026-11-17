---
type: troubleshooting
id: IT-TS-035
owner: IT service desk
author: Karan Deshmukh
reviewer: Identity platform lead
version: 1.2
status: Approved
date: 2026-09-10
vars:
  company: Meridian Freight
  idp: Meridian Identity
  desk: Service Desk
---
# A new employee can't sign in on their first day

The person has their account name and the enrolment link, and either the link fails, the sign-in fails, or the laptop won't let them in. Work through the causes in order: the first three account for nine in ten first-day tickets. Fictional sample written for this portfolio.

## What you see

One of these, reported by the new employee or their manager:

- The enrolment link opens a page that says **This link has expired or isn't valid**.
- The sign-in page says **Your account isn't active yet**.
- The sign-in succeeds, but the laptop shows **This device isn't managed by your organization** and signs the person out.
- The sign-in page asks for a verification code that never arrives.

## Why it happens

| Message | Likely cause |
|---|---|
| The link has expired or isn't valid | The link was generated more than fourteen days before the start date, or the person opened a link from an older message. |
| Your account isn't active yet | The start date in {{idp}} is later than today, often because HR changed the date after the account was created. |
| This device isn't managed | The laptop's serial number wasn't pre-registered, or the person signed in to a different laptop. |
| The code never arrives | The person entered a wrong phone number during enrolment, or chose the authenticator app and hasn't installed it. |

## Fix it

### An expired or invalid link

1. In {{idp}}, open the user, and then select **Sign-in** > **Enrolment link** > **Generate**.
2. Send the new link to the person's private email address, the one in the HR record.
3. Ask them to open the newest message only.

### An account that isn't active yet

1. Compare **Start date** in {{idp}} with the HR record.
2. If HR moved the start date earlier, set the new date, and then select **Activate now**.
3. If the dates match and the person really started today, check the time zone of the location: an account activates at 08:00 in the location's time zone, not yours.

### A device that isn't managed

1. Ask the person for the serial number on the underside of the laptop.
2. Compare it with the serial number under **Devices** on the user's page.
3. If it differs, select **Pre-register**, enter the right serial number, and ask the person to restart the laptop and sign in again.
4. If the person has someone else's laptop, don't register it to them. Ask hardware logistics to swap the devices.

### A verification code that never arrives

1. Ask which second factor the person chose during enrolment.
2. For a text message, check the phone number under **Sign-in** > **Second factor**. Correct it, and then select **Send a test code**.
3. For the authenticator app, select **Reset second factor**. The person enrols again at the next sign-in. Verify who you're talking to first: a second-factor reset for the wrong person is an account takeover.

## If none of this fixes it

Collect the account name, the exact message, the time of the attempt, and the sign-in log entry from {{idp}} under **Sign-in** > **Recent attempts**. Escalate the ticket to the identity platform team with the **First day** tag, so that it's picked up within an hour.
