An administrator deletes a user's lost authenticator in Keycloak, and the user sets up a new one. Six messages carry that task. Each is shown here as Keycloak 26.8.2 shows it in English, recorded on my own test server, then rewritten, with the reason.

The rewrites are my proposals. Keycloak hasn't adopted them, and I'm not part of the Keycloak project. In braces, `{username}`, are the values the interface would fill in.

## What the copy has to do

The task has one trap: after the deletion, the user can sign in with the password alone until an administrator adds the **Configure OTP** required action ([the case study's finding A1](/case-study/help-center-to-docs-as-code#audit-A1)). Keycloak's messages never mention it. The rewrites put the consequence where the administrator is looking, at the moment it matters.

## 1. The confirmation

| | Keycloak 26.8.2 | Proposed |
|---|---|---|
| Title | Delete credentials? | Delete the authenticator {credentialLabel}? |
| Body | Are you sure you want to delete these users credentials? | {username} won't be able to use this phone to sign in. Until they set up a new authenticator, they'll sign in with their password alone. |
| Buttons | Delete · Cancel | Delete authenticator · Cancel |

- **Name the object.** "Credentials" could be the password. The user label, *Alex's phone*, says which.
- **Say the consequence, not "Are you sure?"** A question every dialog asks gets a click, not a thought. The consequence is the reason to stop.
- **The button repeats the verb and the object**, so it makes sense read alone, as a screen reader often reads it.
- Fixes the missing apostrophe, *users credentials*.

## 2. The result

| | Keycloak 26.8.2 | Proposed |
|---|---|---|
| Notification | The credentials has been deleted successfully. | Authenticator deleted. To make {username} set up a new one, add Configure OTP to their required actions. |
| Action | (none) | Add Configure OTP |

- **Agreement:** *credentials has* becomes a short past participle, *Authenticator deleted.*
- **Successfully** adds nothing: the message exists because it worked.
- **The next step is in the message**, with a button that does it. This is the one place to prevent the trap.
- A notification disappears. The button also has to be reachable by keyboard before it does, or the message has to stay until it's dismissed.

## 3. The empty state

When a user has no authenticator, the **Credentials** tab lists the password alone and says nothing.

| | Keycloak 26.8.2 | Proposed |
|---|---|---|
| Empty state, under the password row | (none) | No authenticator. {username} signs in with a password only. Add Configure OTP to ask them to set one up at their next sign-in. |

An empty state is where an administrator looks after the deletion. It should say what's missing and how to fix it, not be blank.

## 4. Saving the required action

| | Keycloak 26.8.2 | Proposed |
|---|---|---|
| Notification | The user has been saved | Saved. {username} will set up an authenticator at their next sign-in. |

Say what the save means for the person, not that a record was written. And end the sentence with a period, as the other messages do.

## 5. The setup form

What the user sees after their password, on **Mobile Authenticator Setup**.

| | Keycloak 26.8.2 | Proposed |
|---|---|---|
| Instruction | Enter the one-time code provided by the application and click Submit to finish the setup. Provide a Device Name to help you manage your OTP devices. | Type the code your authenticator app shows, and name this phone. |
| Field label | One-time code | One-time code |
| Helper text | (none) | The {digits}-digit code in your app. It changes every {period} seconds. |
| Field label | Device Name | Device name |
| Helper text | (none) | For example, *Work phone*. It helps you and your administrator recognize this device later. |
| Button | Submit | Finish setup |

- **One instruction, not two paragraphs.** The labels and helper texts say the rest, next to the field they're about.
- **Type, not enter; no click.** The user may be on a phone.
- **Sentence case**: *Device name*, as the other label.
- **Helper text from the realm's settings**, `{digits}` and `{period}`, so it stays true when an administrator changes the OTP policy.
- **The button says what happens**: the setup ends. *Submit* says what the browser does.

## 6. The error

| | Keycloak 26.8.2 | Proposed |
|---|---|---|
| Error, under the code field | Invalid authenticator code. | That code didn't work. Type the code your app shows now. If every code fails, set your phone's date and time to update automatically. |

- **Say what happened, then what to do.** *Invalid* blames the input and stops there.
- **The two causes, in order of likelihood**: an expired code, then a phone's clock. Both were reproduced on the server ([troubleshooting](/docs/keycloak/otp-troubleshooting)).
- **No apology, no exclamation**, and no "please".

## For accessibility

- The error is tied to its field with `aria-describedby`, and announced when it appears. Color alone doesn't carry it: the text does.
- The helper text is tied to its field too, so a screen reader reads it with the label.
- The confirmation's focus starts on **Cancel**, the safe choice, and returns to the row's menu when the dialog closes.
- The notification's action button stays reachable by keyboard: the notification doesn't vanish while focus is in it.

## For translation

- Each message is one string with its placeholders: no sentence is built from pieces, so a translator can move `{username}` where their language needs it.
- *{digits}-digit* needs a number in a plural rule in many languages, so it belongs in an ICU message: `{digits, plural, other {# digits}}`.
- **Configure OTP** in a message is the name of a control: it has to match the control's translated label, from the same message bundle.
