---
type: how-to
id: KC-ADM-001
owner: Karan Deshmukh
author: Karan Deshmukh
version: 1.1
status: Published
date: 2026-11-28
---
# Reset a user's one-time password in Keycloak

When a user loses or replaces the phone that holds their authenticator, delete its one-time password (OTP) credential. Then make the user set up a new one at their next sign-in.

For Keycloak administrators. Written for Keycloak 26.8.2 and checked against it. Every screen here comes from a Keycloak 26.8.2 server running on my own computer, with a test realm and test users. This is an independent guide, not official Keycloak documentation.

## Before you start

- Confirm that the request comes from the user. Use a phone number or an address the user gave before they lost the phone, not one in the request.
- Sign in to the admin console with an account that can manage the realm's users. I took the screens here as an administrator of the master realm.
- Make sure the user has their new phone, with an authenticator app such as FreeOTP, Google Authenticator, or Microsoft Authenticator.

> **Important:** Add the required action before you delete the credential. In the other order, the user can sign in with the password alone between the two actions. I tested both orders on Keycloak 26.8.2: with the required action added first, Keycloak asks for a code until the credential is deleted, and then asks the user to set up a new authenticator.

## Steps

1. In the admin console, check that the user's realm is the current realm: its name is at the top of the menu. Select **Users**, search for the user, and then select their username.

   ![The Users page of the admin console. The search box is outlined in green, and the username alex.morgan is outlined and marked 1.](img/01-find-user.png)

2. On the **Details** tab, in **Required user actions**, select **Configure OTP**, and then select **Save**.

   ![The Details tab of alex.morgan. Configure OTP is selected in Required user actions, marked 1, and the Save button is marked 2.](img/07-required-action.png)

3. Select the **Credentials** tab, and find the row whose type is **Otp**. Its user label names the device, such as *Alex's phone*.

   ![The Credentials tab, marked 1, with two rows, Password and Otp. The Otp row, labelled Alex's phone, is outlined and marked 2.](img/02-credentials.png)

4. In the **Otp** row, open the menu at the end of the row, and then select **Delete**.

   ![The menu of the Otp row is open, and its Delete item is outlined and marked 1.](img/03-delete-menu.png)

5. In the **Delete credentials?** dialog, select **Delete**. Check that the **Otp** row no longer appears on the **Credentials** tab.

   ![The Delete credentials? dialog over the Credentials tab. Its red Delete button is outlined and marked 1.](img/04-confirm-delete.png)

6. Ask the user to sign in. After their password, Keycloak shows **Mobile Authenticator Setup**. The user scans the QR code with the authenticator app on the new phone, enters the code that the app shows, names the device, and then selects **Submit**.

   ![The Mobile Authenticator Setup page that the user sees. The one-time code field, the device name field and the Submit button are marked 1 to 3. The QR code is covered because it contains the secret.](img/09b-setup-code.png)

> **Note:** Anyone who knows the password can complete step 6 with their own phone. If the phone was stolen with the password, also select **Update Password** in step 2, so that the user sets a new password before setting up the authenticator.

## Check that it worked

On the **Credentials** tab, a new **Otp** row shows the name the user gave the new device, with today's date.

![The Credentials tab with a new Otp row, labelled Alex's new phone, outlined and marked 1.](img/11-new-credential.png)

Keycloak also keeps a record. When the realm saves admin events, **Events** > **Admin events** lists the deletion as an `ACTION` on the user's credential, and the new required action as an `UPDATE` of the user.

![Admin events, with the ACTION on the user's credential outlined.](img/12-admin-events.png)

## Next steps

- If *Invalid authenticator code.* appears during the setup, see [When a Keycloak user can't sign in with a one-time password](/docs/keycloak/otp-troubleshooting).
- To see what the realm asks of an authenticator, such as the number of digits and how long a code lasts, see [Keycloak OTP policy](/docs/keycloak/otp-policy).
