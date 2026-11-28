---
type: how-to
vars:
  product: Acme Console
---
# Reset MFA for a Locked-Out User

For the IT service desk. Takes about five minutes.

## Before You Start

- Confirm that the request is genuine. Call the user on the number in the HR system, not the number in the ticket.
- Contractor accounts follow a different process. Send those requests to the IAM team.

## Steps

1. In {{product}}, open the user's profile.
2. Select **Reset MFA**.

   > **Caution:** Don't select **Reset password**. It leaves the old device enrolled.

3. Ask the user to open the enrollment email and register the new device.

::: only admin

## If the User Has No Second Device

1. In {{product}}, go to **Security** > **Recovery codes**.
2. Select **Generate**, and then read the code to the user by phone.

:::

## Check That It Worked

The system log shows a new enrollment for the user.
