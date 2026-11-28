# Localization readiness

What the source does so that a translation team can work from it, and how it was tested.

## In the source

- **One term for one thing.** The terminology page lists the terms, the words not to use, and why. Vale enforces the
  list on every change (`site/styles/Portfolio/Terms.yml`, `Verbs.yml`).
- **Interface labels quoted exactly.** Bold labels such as **Configure OTP** must be translated with the label that
  Keycloak shows in the target language, from Keycloak's own message bundles, not translated freely. Keycloak's
  messages in italics follow the same rule.
- **One sentence per line.** A changed sentence is a changed line, so a translation memory and a reviewer see exactly
  what changed.
- **No idioms, no abbreviations, no exclamations.** The original article's "a piece of cake", "secs" and "3/4/25" are
  gone (audit A10).
- **Dates in ISO 8601** in front matter; the theme shows them.
- **Headings with fixed IDs** such as `{#code-refused}`, so links keep working when a heading is translated.
- **Text outside images.** Every screenshot has its alternative text and caption in the page, where a translator can
  reach them. The pictures themselves show Keycloak's English interface: a translated page needs screenshots of the
  localized console.
- **Strings in components** go through Docusaurus's `translate()`, so `npm run write-translations` extracts them.

## Tested with a pseudo-locale

`qps-ploc` is a pseudo-locale, not a translation: `scripts/pseudo.mjs` accents every letter, makes each string about
35% longer and brackets it.

1. The first build (`quality/pseudo-1-first-run.txt` and `.jpg`) found the only strings a translator couldn't reach:
   the five labels of `PageFacts`, hard-coded in English on every page.
2. The labels became literal `translate()` calls. A first attempt built the ID from a variable; `write-translations`
   refused it, because extraction needs static values.
3. The second build (`quality/pseudo-2-after-fix.txt`) has no English left in any page's content. Pages stay within a
   390 px screen with the longer text.

No language other than English is published. A real translation would be done by a translator and reviewed by a
native speaker; machine output is never published as a translation here.

The revision of 1.1 added code blocks with titles (`title="Variables"`, `title="Output"`). The pseudo-locale check found
both titles still in English: a code block's title is text a reader sees, so `scripts/pseudo.mjs` now treats it as
text and leaves the code alone (`quality/pseudo-3-after-revision.txt`: nothing left).
