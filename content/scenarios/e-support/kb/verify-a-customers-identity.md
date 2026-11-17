---
category: Agent handbook
section: Sign-in support
audience: agents
status: published
labels: internal, verification, security
---
# Verify a customer's identity before changing sign-in settings

Internal procedure for support agents. A change to how someone signs in can hand the account to an attacker if you make it for the wrong person. That covers unlocking, resetting a second factor, and changing the sign-in email. Verify first, every time, and note the method in the ticket.

## Accepted methods, in order of preference

1. **A request from inside the product.** The customer selects **Help** while signed in. The ticket then shows **Verified: signed-in session**. Nothing more is needed.
2. **A code sent to the account's email address.** In the support console, select **Send a verification code**. The customer reads it back to you. This works when the customer still has the email but can't sign in.
3. **Three account facts.** When the customer has no access to the email either: the date of the last invoice they sent, the name of a customer on it, and the plan they're on. All three have to match the console.

## Not accepted

- The customer's name, company name, or email address alone. All three are easy to find.
- A screenshot of the sign-in page or of an error message.
- Insistence, seniority, or urgency. A real administrator in a hurry can still read back a code.

## When verification fails

Tell the customer that you can't change sign-in settings in this conversation. Offer the two routes that don't need you: the password reset link on the sign-in page, and their company's administrator under **Settings** > **Users**. Record the failed verification in the ticket, with the method tried.

## Why the second method is enough

The email address receives every security message for the account, so someone who controls it can already reset the password. Verifying with a code to that address doesn't give them anything they don't have. Verifying with less does.
