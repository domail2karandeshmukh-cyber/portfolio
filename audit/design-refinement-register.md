# Design refinement register (Version 10.1 brief, November 2026)

What the audit of the rendered site found against the brief "Definitive professional design, documentation and user experience transformation", what was done about each finding, and how it was verified. It starts from the three iPhone screenshots that came with the brief, then covers every page type at 1,440 and 390 pixels, the PDFs at full size, and the Studio.

Baseline: production at commit `3043e98`, screenshotted at the start of the work on 19 November 2026. Work: branch `design-refinement`, not merged and not deployed to production.

Priority: **P1** stops a visitor from doing what they came for, or makes the work look less credible. **P2** costs a visitor time or attention. **P3** is polish. Status: **Fixed** (verified as stated), **Open** (with the reason), **Decision** (needs Karan).

## From the iPhone screenshots

| # | Finding | Root cause | Priority | Status | Fix and verification |
|---|---|---|---|---|---|
| D1 | On the contact page, the April button covered the footer. | April was a floating button fixed to the bottom of the viewport, so it sat over whatever scrolled under it. | P1 | Fixed | April opens from a button in the header; on a phone her panel is a sheet that leaves the header visible. No fixed element is left over the content: checked at 320, 390 and 1,440 px on every page type. |
| D2 | On the home page, the April button covered the availability line. | The same floating button. | P1 | Fixed | As D1. The availability line is fully visible in the first screen at 390 px. |
| D3 | A giant monospace block of the raw chat message filled the phone screen. | The message-to-document card showed the whole raw message in the code face at a large size. | P1 | Fixed | The card shows a compact preview in the text face, up to 880 px wide; the full message, the analysis and every output are on /message-to-document, and **Try your own message** opens a folded tray. `tests/studio/test_case.py` checks the tray. |
| D4 | The signature headline had been replaced by "Complex technology. Clear documentation." | A Version 10 change to shorten the first screen. | P1 | Fixed | "I turn what engineers know into docs people can follow." is back, with an editorial edit that plays once (type to turn, say to know, read to follow, then the highlight). It reads correctly without scripts, shows its final words with reduced motion, keeps its size (no layout shift), and wraps on a phone. Translated into French, German, Spanish and Hindi. |

## Home page and first screen

| # | Finding | Priority | Status | Fix and verification |
|---|---|---|---|---|
| D5 | The home page was 16,224 px tall on a desktop and 22,372 px on a phone, with 2,209 words. | P2 | Fixed | 8,486 px (−48 %) and 11,063 px (−51 %), with 1,134 words, measured on 19 November 2026. Nothing was hidden: the long material moved to the pages it belongs to (the case study, the recruiter overview, the library), and the home page links to each. |
| D6 | The first screen had no clear first action for a recruiter. | P1 | Fixed | Two primary actions, **Explore my work** and **Download CV**, then **Recruiter overview** and **Contact me**. |
| D7 | The order of the home page didn't follow what a visitor needs. | P2 | Fixed | Introduction, selected work, fields, the message-to-document card, tools, projects, films, experience, contact. |
| D8 | Document cards described publications without showing them. | P2 | Fixed | Each card shows a real page of its published PDF, its field, kind and basis, and **Read online** and **PDF** with the page count and size. The thumbnails are made from the PDFs by `scripts/pdf-covers.py`, and were made again after the PDFs changed. |

## Navigation, header and footer

| # | Finding | Priority | Status | Fix and verification |
|---|---|---|---|---|
| D9 | At 1,440 px the header's actions overflowed into the menu. | P2 | Fixed | The search button lost its keyboard hint and the menu's spacing was tightened. No overflow from 320 to 1,920 px. |
| D10 | The phone menu was a long flat list with small targets. | P2 | Fixed | A drawer with labelled, collapsible groups; every item has an icon and a 44 px target; the drawer closes when a link is chosen. |
| D11 | A link to `/#april-band` led nowhere after the redesign. | P2 | Fixed | The link goes to `/#april`, which opens April. The link check passes on 208 pages. |
| D12 | The footer was different on each page type, and April could cover it. | P2 | Fixed | One structured footer (identity, Work, Documentation, Connect, legal) on the home pages, inner pages, the Studio and the workbench. |

## Contact, feedback and privacy

| # | Finding | Priority | Status | Fix and verification |
|---|---|---|---|---|
| D13 | The contact page didn't invite a conversation, and the address couldn't be copied. | P1 | Fixed | "Let's work together", with **Discuss an opportunity**, the address with a **Copy** button, **Connect on LinkedIn** and **Download CV**. Email only, as Karan decided; no phone number. |
| D14 | Visitors had no way to report a problem with the portfolio. | P3 | Fixed | **Portfolio feedback**: an email with its subject ready. No ticket system and no promised response time. |
| D15 | The site had no privacy page. | P2 | Fixed | /privacy: no accounts, cookies or analytics; what April and the rewrite desk send to the AI service; what stays in the browser; hosting by Vercel. |

## Industries, icons and the recruiter page

| # | Finding | Priority | Status | Fix and verification |
|---|---|---|---|---|
| D16 | Industries had no consistent visual identity. | P3 | Fixed | One icon family (Lucide, ISC) on the home tiles, the industry pages, the menus and the Studio. |
| D17 | In German at 320 px, "Dokumentationsstudio" pushed a tile 10 px past the screen. | P2 | Fixed | A soft hyphen in the translation, and tiles that can wrap a long word. No sideways scrolling in any language at 320 px. |
| D18 | An automotive entry was suggested in the brief "where appropriate". | P3 | Decision | The only automotive work is Karan's role at Magna International, whose documents are confidential. An automotive field needs his decision and material that he may publish; the car icon is ready for it. |

## Documents and publications (PDF)

| # | Finding | Root cause | Priority | Status | Fix and verification |
|---|---|---|---|---|---|
| D19 | DITA PDFs put "Chapter" in front of each document's title and contents entry. | The theme can turn chapter numbers off but not DITA-OT's label. | P2 | Fixed | A small plug-in (`scripts/dita-pdf/plugin`) removes the label; `args.mjs` installs it. No "Chapter" in any of the nine sets. |
| D20 | In every FOP-made PDF, words with "fi" and "fl" lost those letters when searched, copied or read aloud ("first" became "rst"). | FOP gives a ligature glyph a private-use character. | P1 | Fixed | The PDF fonts have their ligatures turned off (`no-ligatures.py`). No private-use character in any DITA PDF; checked with pdfplumber. |
| D21 | The S1000D PDFs had the same fault on ICN codes and part labels ("ICN-0DEMO" was not findable). | The illustrations asked for a font the site doesn't load, and the fallback's contextual alternates have no characters. | P1 | Fixed | The illustrations print inline in the site's face with contextual alternates off. `tests/studio/test_aero.py` checks every ARF-1 PDF. |
| D22 | Illustration labels printed at 4.6 to 6.5 pt, and the page footer at 6 pt. | Drawings scaled to 92 mm high; an 8 px footer. | P2 | Fixed | Callouts about 8 pt and labels about 7 pt, each measured inside its drawing and clear of the others (new test); footer 7.5 pt. |
| D23 | Straight apostrophes and quotation marks in PDF text, and tables boxed on every side. | Markdown source; the theme's default table frame. | P3 | Fixed | Typographic apostrophes and quotation marks in running text, never in code (`typeset.mjs`), and tables ruled across. |
| D24 | The KC1 sequence diagram printed at about 5 pt, its lifelines ran through its labels, and its alternative text was "Diagram". | A wide diagram scaled down; Mermaid draws labels without a ground. | P2 | Fixed | Wrapped messages (text about 7 pt in print), a ground under every label, and alternative text that lists the participants and the nine messages. The site's other sequence diagrams improved the same way. |
| D25 | A diagram caption repeated its section number ("Figure 1. 1. Overall system architecture"). | The caption took the heading's own number. | P3 | Fixed | The number is dropped from the heading's words. |

## Lifecycle, reader and Studio

| # | Finding | Priority | Status | Fix and verification |
|---|---|---|---|---|
| D26 | The documentation lifecycle was a list of 16 stage chips, with no sense of where a reader was. | P2 | Fixed | Nine phases (Requirement, Research, Author, Illustrate, Review, Validate, Publish, Change, Revise) on a rail that stays under the header, marks the phase being read and fills with progress; an index of the evidence; the revision diffs folded. Every stage keeps its address. 8 new checks in `test_case.py`. |
| D27 | On a phone, a document's contents took a row of chips before the article. | P3 | Fixed | The contents fold under one button that names the section being read. |
| D28 | An enlarged picture had no visible way to close it and let focus leave. | P2 | Fixed | A modal dialog with **Close**, a caption, focus kept on **Close** and the page behind still. |
| D29 | The Studio's menu had no icons, and its items were 32 px high on a phone. | P3 | Fixed | An icon for every tool and 44 px items below 1,200 px. |
| D30 | Text fields across the site and the Studio had borders at 2:1 against white, below the 3:1 that WCAG 2.2 asks for a control's edge (SC 1.4.11). | P2 | Fixed | A `--field` token at 3.7:1, on every text field, list and text area. |

## Found by the test passes

| # | Finding | Priority | Status | Fix and verification |
|---|---|---|---|---|
| D33 | In the phone menu, every group heading looked like the open menu button: a yellow pill with its words against its left edge, and its arrow at the top left. | P1 | Fixed | The menu button's styles applied to every summary in the menu (`.mnav summary`); they now apply to the button only (`.mnav>summary`). Found in the journey screenshots; checked again at 390 px. |
| D34 | In French, German and Spanish, the header ran 44 to 87 px off the side at 1,280 and 1,366 px, common laptop widths. | P1 | Fixed | Between 1,280 and 1,439 px the CV button shows "CV" in those languages, and screen readers still hear its whole name. `tests/matrix.py`: no overflow at any of the ten sizes. |
| D35 | On a touch screen the header's controls were 40 px high, and the name in the header 19 px. | P2 | Fixed | 44 px for every control in the header below 900 px, and for the case study's stage links. At 320 px the larger targets pushed the header 2 px off the side, so below 360 px the CV button has less padding: checked in five languages at device pixel ratios 1, 2 and 3. |
| D36 | On a phone, folding a document's contents after the page loaded moved the article: a layout shift of 0.26 in Lighthouse. | P2 | Fixed | With scripts, the contents start folded on a phone; without scripts they stay open. Lighthouse: CLS 0. |

## Documentation coverage

| # | Finding | Priority | Status | Fix and verification |
|---|---|---|---|---|
| D31 | Real-product documentation covered identity (Keycloak) and an API, but not AI and data science. | P2 | Fixed | "Compare the KC1 model candidates in MLflow": MLflow 3.18.0 on the project's own runs, five annotated screenshots of the real interface, every figure checked by the self-test against the recorded runs. Docker wasn't available, and the guide says so. |
| D32 | More real products (GitHub, Docker, Grafana, Wazuh and others in the brief). | P3 | Open | Each needs a running product and tested steps. Docker isn't available on this computer; the others are possible in a later round. |

## Open questions for Karan

- The availability line (full-time, contract, part-time, freelance, internship, apprenticeship) is unchanged since Version 8. Is it still right?
- The stray branch `fix/refuse-non-finite-values` in the KC1 repository can be deleted: its pull request was merged.
- The titles of the nine videos in the YouTube playlist weren't available, so the playlist isn't described video by video.

## How it was verified

All on 19 and 20 November 2026, on a local build of the branch, in Google Chrome (Chromium) unless stated.

| Check | Result |
|---|---|
| `tests/matrix.py`: 11 pages at the brief's ten sizes, in portrait and, for phones and tablets, landscape, with an orientation change on each phone | 181 page views, none with a problem: no sideways scrolling, the header at 56 or 64 px, nothing fixed over the content, 44 px header targets on touch screens, no clipped text, no script errors |
| `tests/journeys.py`: the brief's 19 visitor steps, performed on a phone (390 × 844, touch) and a desktop (1,440 × 900) | 44 of 44 checks passed, twice in a row |
| `tests/webkit_smoke.py` in WebKitGTK (GNOME's engine, not Safari) | 41 of 41 checks passed |
| axe-core (`scripts/check-a11y.py`), 28 pages in five languages, desktop and phone | 0 WCAG problems |
| Studio suites, self-test, link check | All pass; the self-test has 316 checks; 209 pages and 18,843 links |
| Lighthouse 12.8.2 lab runs, local server | Desktop: performance 100 on the home page, the lifecycle, the API reference and the Studio; LCP 0.7 to 0.8 s, CLS 0. Mobile (simulated slow 4G): performance 88 to 91, LCP 3.2 to 3.7 s, CLS 0 |

Limitations:

- **Firefox** couldn't be tested: Playwright's Firefox and Mozilla's downloads are blocked on this computer's network, and Ubuntu's Firefox package needs snap.
- **Safari and iOS** weren't tested: WebKitGTK shares WebKit's engine but not Safari's interface, its toolbars or iOS's safe areas. The preview is for a check on Karan's iPhone.
- **Mobile LCP** in the lab is above 2.5 s, but the local server sends files uncompressed: Lighthouse estimates 184 KB of savings from compression, which Vercel applies. Running a compressing server locally for a fairer lab test was refused by the session's permission checks, and the preview's address can't be reached from here. No field data exists for the branch.
- **A mail client** can't open in a headless browser: the journeys check the address, the subject and the link instead.
