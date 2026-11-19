---
type: how-to
id: KC-ADM-001
owner: Karan Deshmukh
author: Karan Deshmukh
version: 1.0
status: Published
date: 2026-11-19
---
# Reset a user's one-time password in Keycloak

When a user loses or replaces the phone that holds their authenticator, delete its one-time password (OTP) credential. Then make the user set up a new one at their next sign-in.

For Keycloak administrators. Written for Keycloak 26.8.2 and checked against it. Every screen here comes from a Keycloak 26.8.2 server running on my own computer, with a test realm and test users. This is an independent guide, not official Keycloak documentation.

## Before you start

- Confirm that the request comes from the user. Use a phone number or an address the user gave before they lost the phone, not one in the request.
- Sign in to the admin console with an account that can manage the realm's users. I took the screens here as an administrator of the master realm.

## Steps

1. In the admin console, check that the user's realm is the current realm: its name is at the top of the menu. Select **Users**, search for the user, and select their username.

   ![The Users page, with the search box and the username alex.morgan marked](img/01-find-user.png)

2. Select the **Credentials** tab. Find the row of type **Otp**. Its user label names the device, such as *Alex's phone*.

   ![The Credentials tab, with the Otp row of Alex's phone marked](img/02-credentials.png)

3. Open the row's menu, and then select **Delete**.

   ![The row's menu open, with Delete marked](img/03-delete-menu.png)

4. In **Delete credentials?**, select **Delete**. Keycloak reports *The credentials has been deleted successfully.*, and only the password is left on the tab.

   ![The confirmation, with the Delete button marked](img/04-confirm-delete.png)

   > **Caution:** Don't stop after this step. Keycloak's default sign-in flow asks for a code only from a user who has a second factor set up. Without one, the user signs in with the password alone until step 5 is done.

5. Select the **Details** tab. In **Required user actions**, select **Configure OTP**, and then select **Save**. Keycloak reports *The user has been saved*.

   ![The Details tab, with Configure OTP in Required user actions and the Save button marked](img/07-required-action.png)

6. Ask the user to sign in. After their password, Keycloak shows **Mobile Authenticator Setup**. They scan the code with an authenticator app on the new phone, type the code the app shows, name the device, and select **Submit**.

   ![Mobile Authenticator Setup, with the code, the device name and Submit marked, and the QR code hidden](img/09b-setup-code.png)

## Check that it worked

On the **Credentials** tab, a new **Otp** row shows the name the user gave the new device, with today's date.

![The Credentials tab with the new Otp row, Alex's new phone, marked](img/11-new-credential.png)

Keycloak also keeps a record. When the realm saves admin events, **Events** > **Admin events** lists the deletion as an `ACTION` on the user's credential, and the new required action as an `UPDATE` of the user.

![Admin events, with the ACTION on the user's credential marked](img/12-admin-events.png)

## Next steps

- If *Invalid authenticator code.* appears during the setup, see [When a Keycloak user can't sign in with a one-time password](/docs/keycloak/otp-troubleshooting).
- To see what the realm asks of an authenticator, such as the number of digits and how long a code lasts, see [Keycloak OTP policy](/docs/keycloak/otp-policy).
