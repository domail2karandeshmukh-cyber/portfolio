# Editorial decisions on Vale's findings

Vale 3.28.1 with the Google, alex and Readability packages and the house rules in `site/styles/Portfolio`.
Three runs, kept as JSON beside this file:

| Run | File | Errors | Warnings | Suggestions |
|---|---|---|---|---|
| The original help-center article | `vale-0-original-article.json` | 7 | 5 | 6 |
| The first migration to MDX | `vale-1-first-migration.json` | 26 | 41 | 99 |
| After review | `vale-2-after-review.json` | 0 | 8 | 72 |

The first migration has more findings than the original because it has six times more text, and because the
terminology page lists the words the house rules forbid.

Vale didn't find either critical problem of the original article: the step that leaves the account with a password
alone (audit A1) and the missing identity check (A2). A linter checks words, not facts. The audit found both, and the
server's recorded behaviour confirmed A1.

## Accepted, and the text changed

| Rule | Example | Change |
|---|---|---|
| Google.OxfordComma | code length, period and other settings | Serial comma added. |
| Google.Passive | They were migrated from a single article | They come from a single help-center article. |
| Google.Passive | until the Configure OTP required action is added | until an administrator adds the **Configure OTP** required action |
| Google.Contractions | a phone that is a minute off | a phone that's a minute off |
| Google.Anthropomorphism | the apps that Mobile Authenticator Setup tells users to install | lists for users to install |
| Google.WordListCase | admin console, in front matter descriptions | Reworded: the descriptions say Keycloak and Keycloak's REST API. |
| alex.GenderedPerson | on his own computer | Reworded, with the author named once. |
| Google.Colons | a capital after a colon before a link | The sentence now introduces the link without a colon. |

## Rejected, with the reason

| Rule | Example | Reason |
|---|---|---|
| Vale.Terms, Portfolio.Terms, alex.Ablist | **Otp**, **Browser - Conditional 2FA**, *Invalid authenticator code.* | Quoted, not written. Interface labels (bold) and Keycloak's messages (italics) keep the product's wording, or the reader can't find them on screen. `IgnoredScopes = strong, em`. |
| Google.WordListCase | admin console, admin REST API, admin events | Keycloak's own names. `TokenIgnores`. |
| alex.ProfanityUnlikely | period | The OTP policy's term for how long a code lasts. Turned off for these pages. |
| Google.OxfordComma | Every step was checked on a server, with a test realm and test users | Not a list. Reworded anyway, to split a long sentence. |
| Google.Anthropomorphism | the user sees | The subject is a person. |
| Google.Passive | When the phone is lost, so is the authenticator; only the password is left | The state matters, not who caused it. |
| Portfolio.Terms, Portfolio.Verbs, Google.WordListCase | the terminology table | The table lists the forbidden words on purpose: the rules are off for the table only, with MDX comments. |
| Google.Acronyms | REST, MFA | REST is familiar to administrators. MFA appears only as a word not to use. |
| Google.Parens | sign in (verb), sign-in (noun) | The parentheses carry the distinction the table is about. |

## Reviewed and kept as warnings

Readability scores on three pages are just past the packages' targets: Coleman–Liau grade 9.9 to 10.4 against 9,
Flesch reading ease 55 to 65 against 70. The pages use a few long product words that can't be replaced, such as
authenticator and credential. The sentences are short: the warnings stay visible in every run rather than being
switched off.

72 suggestions remain: 56 Readability.Polysyllables, one per long word, and the 16 rejected Google suggestions above.
