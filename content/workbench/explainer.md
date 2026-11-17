---
type: concept
---
# How single sign-on works

Single sign-on lets you sign in once and then open every app your organization has connected.

## The idea

Each app trusts one service to say who you are. That service is the identity provider. An app never sees your password. It receives a signed note from the identity provider that says "this is Dana, and she signed in two minutes ago."

## What happens when you open an app

1. The app sends your browser to the identity provider.
2. The identity provider checks whether you have signed in. If you haven't, it asks you to.
3. The identity provider sends your browser back to the app with the signed note.
4. The app checks the signature and opens.

## Why it matters

- You remember one password, so it can be a long one.
- When someone leaves, one account is closed and every app closes with it.
