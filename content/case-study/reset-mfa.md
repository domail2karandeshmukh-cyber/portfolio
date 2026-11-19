---
type: how-to
id: SD-IAM-007
owner: IT service desk
author: Karan Deshmukh
version: 1.0
status: Ready for technical review
date: 2026-11-19
---
# Reset MFA for a locked-out user

Let a user who lost or replaced their phone sign in again: clear their multi-factor authentication (MFA), so that they can enroll the new phone.

For IT service desk analysts. A demonstration document, written for this portfolio from an example message.

## Before you start

- Confirm that the request is genuine. Call the user on the number in the HR system, not the number in the ticket.
- Check that the account belongs to an employee. Contractor accounts follow a different process: reassign those tickets to the IAM team.

## Steps

1. In the admin console, find the user and open their profile.
2. Select **Reset MFA**.

   > **Caution:** Don't select **Reset password**. It leaves the old phone enrolled.

3. Ask the user to open the enrollment email and enroll the new phone.

## Check that it worked

The user signs in with the new phone. In the admin console, the user's sign-in log shows a new MFA enrollment, dated today.

## Next steps

- Record the time of the enrollment in the ticket, and close it.
- If the enrollment email doesn't reach the user, reassign the ticket to the IAM team.
