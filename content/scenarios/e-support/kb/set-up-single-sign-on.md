---
category: Administration
section: Security
audience: customers
status: published
labels: sso, saml, admin
---
# Set up single sign-on

With single sign-on, your team signs in to Ledgerly with the account they use for their other work tools. Ledgerly supports SAML 2.0 and OpenID Connect. Setting it up takes about 30 minutes with someone who manages your identity provider.

## Before you start

- You're an administrator in Ledgerly on the Business plan.
- You can create an application in your identity provider, or you have someone who can.
- Your users' email addresses in Ledgerly match the ones in the identity provider.

## Steps

1. Select **Settings** > **Security** > **Single sign-on**, and then select **Set up**.
2. Choose **SAML** or **OpenID Connect**, to match what your identity provider offers.
3. Copy the values Ledgerly shows, such as the reply address and the entity ID, into a new application in your identity provider.
4. Copy the values your identity provider shows, such as the sign-in address and the certificate, into Ledgerly.
5. Select **Test with my account**. A window opens; sign in through your identity provider.
6. When the test succeeds, choose **Required for everyone** or **Optional**, and then select **Turn on**.

## Check that it worked

The sign-in page shows a button with your company's name, and signing in through it opens the dashboard. **Settings** > **Users** shows **SSO** next to each user who has signed in that way.

## If you get locked out

Administrators can always sign in with their Ledgerly password at `app.ledgerly.example/admin-sign-in`, even when single sign-on is required. Keep one administrator's password in your password manager for this case.
