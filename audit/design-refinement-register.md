# Design refinement register (Version 10.1 brief, November 2026)

What the audit of the rendered site found against the brief "Definitive professional design, documentation and user experience transformation", what was done about each finding, and how it was verified. It starts from the three iPhone screenshots that came with the brief, then covers every page type at 1,440 and 390 pixels, the PDFs at full size, and the Studio.

Baseline: production at commit `3043e98`, screenshotted at the start of the work on 19 November 2026. Work: branch `design-refinement`, merged into main and released to production on 20 November 2026 with Karan's approval; the production deployment of `3043e98` is kept for a rollback. A second round on branch `round-2` (the leftovers D40 to D42, the Studio's tools, and two more real products, D44 to D47, and two defects found on the way, D48 and D49) was released to production on 21 November 2026 with Karan's approval; the production deployment of `ef17f01` is kept for a rollback.

Priority: **P1** stops a visitor from doing what they came for, or makes the work look less credible. **P2** costs a visitor time or attention. **P3** is polish. Status: **Fixed** (verified as stated), **Fixed in round 2** (verified as stated on branch `round-2`, released on 21 November 2026), **Open** (with the reason), **Decision** (needs Karan).

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
| D10 | The phone menu showed all 41 links at once under six plain labels: 2,078 px, about two and a half screens. Its menu button was 40 px high and its search button 35 px. | P2 | Fixed | A drawer with labelled groups that fold (Work open first): 793 px. Every control in it is at least 44 px high, and the industries keep their icons; the drawer closes when a link is chosen. `tests/journeys.py` measures every control in the open drawer. |
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

## Found while writing the completion report

| # | Finding | Priority | Status | Fix and verification |
|---|---|---|---|---|
| D37 | In the phone menu, the five language links were 40 px high, under the 44 px of the rest of the menu. | P3 | Fixed | 44 px. Found while measuring the menu for the report; `tests/journeys.py` now checks every control in the open drawer. |
| D38 | The design-system page said every control on a touch screen is 44 by 44 px, but buttons, fields and filters inside documents and tools are 24 to 41 px. | P2 | Fixed | The page now says what is true, as the brief asks not to make controls bigger than they need to look: 44 px for the header, the menu and the navigation inside a page; at least 24 by 24 px (WCAG 2.2 AA) for every other control, sliders as the browser draws them. Measured at 390 px on 26 pages. |
| D39 | The previews on the library's document cards were older than the documents: the KC1 API reference's still showed revision 1.0, and the MLflow guide had none. | P2 | Fixed | `scripts/shoot-thumbs.py` run again on 20 November 2026: 20 previews changed and one was added. The six publication covers were already made again from the new PDFs. |
| D40 | Straight apostrophes are left in some PDFs: two in the running text of the flagship procedure MP-PS104-01, and others in the Studio's sample guides and the TrustNav reports. | P3 | Fixed in round 2 | `studio-flagship.py` typesets the procedure's DITA source with `typeset.mjs`, as the nine DITA sets are (MP-PS104-01: 0 straight apostrophes, 4 typographic ones). The Step Guide Studio prints an apostrophe inside a word as a typographic one, and the five sample guides and the flagship guide were made again with it (0 straight ones in each). The TrustNav reports are that project's own files and weren't changed. |
| D41 | The note in each ARF-1 drawing ("Fictional training rig. Not to scale.") and the drawing's own copy of its ICN code print at about 5 pt. | P3 | Fixed in round 2 | Printed, the notes and ICN codes are 6.3 to 6.4 pt (measured in the three PDFs), and the indicator's key 5.6 pt with a clear gap between its two labels. The drawings themselves aren't changed: their files are issued illustrations, so the print style sizes them. `test_aero.py` measures every label inside its drawing and clear of the others (106 of 106). Page counts unchanged (26, 7 and 2); the PDFs are still tagged. |
| D42 | On a 390 px phone, April's panel cuts her subtitle to "Karan's assist…", and her speaking ring touches the panel's edge. | P3 | Fixed in round 2 | The voice button is an icon on a phone (its label stays for screen readers), so the subtitle is whole at 390 px, and wraps instead of being cut at 320 px. The speaking ring keeps 12 px from the panel's edge at its widest. |
| D43 | 11 of the 24 PDFs aren't tagged for screen readers: the CV, the six guides the Studio's guide tool makes in the browser, and the four project reports. The DITA and S1000D publications (13) are tagged. | P2 | Decision | The CV and its generation are protected by the brief, and the project reports are the projects' own files, so neither was changed. The guide tool's PDFs could be tagged in a later round. |

## Round 2: the Studio's tools and two more products

| # | Finding | Priority | Status | Fix and verification |
|---|---|---|---|---|
| D44 | Each Studio tool had its own toolbar, panels and headings: buttons wrapped onto a lone second row, the status was loose text, and every tool opened with three or four lines of explanation and ended with another paragraph of notes and shortcuts (brief, section 21). | P2 | Fixed in round 2 | One working surface for the eleven tools: a header with one sentence and **Help** (the longer explanation, the shortcuts and the limits, opened under the header), a command bar with the starting points on the left, the output on the right and the status under them, and panels with one edge, corner and title. The DITA Studio has a command bar too. Notices that keep a reader safe stay in view. Every control keeps its id, so the 473 Studio checks pass; the 12 new phrases are translated in four languages (0 untranslated). Checked at 1,440, 390 and 320 px: no page wider than the screen. |
| D45 | The aerospace tools' panel titles showed in the serif at 1.55 rem, over their own sans style. | P3 | Fixed in round 2 | `.dt-card h2` overrode `.ae-h`. Panel titles are one style in every tool (sans, 17 px, semibold). |
| D46 | No guide showed a notebook tool, which data scientists use every day. | P3 | Fixed in round 2 | "Run a notebook from a clean start and share it as HTML in JupyterLab": nine annotated screens of JupyterLab 4.6.6 on a local server, the sample notebook to download, and `evidence.json`. Checking it found that the export's default, **Sanitize HTML output**, shows this notebook's heading and table styles as HTML code; the guide says when to clear it and why to keep it for a notebook from someone else, and nbconvert 7.17.2 confirmed both from the command line. |
| D47 | No guide showed network troubleshooting. | P3 | Fixed in round 2 | "Find the slowest HTTP responses in a capture with tshark": every command and output is what tshark 4.2.2 printed for the published capture of a small test server, compared with the server's own log. |
| D48 | The Studio's tools moved while they loaded. Each drew its samples, its start panel or the CSDB after the first paint, and the aerospace tools' lists widened when their choices arrived, which rewrapped the command bar. On production's build, Lighthouse measured a layout shift of 0.14 to 0.59 on ten of the eleven tools on desktop (0.1 is the limit of "good"), and up to 0.32 on a phone. Already in 10.1; found while measuring round 2. | P2 | Fixed in round 2 | Each tool's samples are in its page, and what comes after the command bar shows only once the tool has drawn itself. Most tools draw at once. The four aerospace tools wait for the CSDB, for three seconds at most, so a slow or failed load never hides a tool. The page keeps the screen's height, so the footer doesn't climb into view, and the bar's lists are as wide as their longest choice from the start. Lighthouse 12.8.2 on the same local server, desktop, production's build then round 2: screenshots 0.589 to 0, CSDB 0.44 to 0, IPC 0.267 to 0, DITA 0.249 to 0, guides 0.228 to 0, knowledge base 0.216 to 0, control 0.191 to 0, IETM 0.182 to 0.002, video 0.164 to 0, S1000D 0.137 to 0, STE 0 to 0. On a phone: 0 on all eleven, from up to 0.316. Desktop performance went from 78 to 94 to 99 or 100 on those ten tools. |
| D49 | Round 2's tool header broke the offline IETM package, the ZIP on the aerospace hub: its Help and Print buttons showed their icon codes as text ("{{i:printer}}"), its command bar had no layout, and on a 390 px phone its Product list ran 11 px past the screen. Found in round 2 before release; production's package is fine. | P1 | Fixed in round 2 | The package draws the same icons as the site, and its style sheet has the header, the Help panel and the command bar. Its lists now have a border, which they lacked in production too. Opened from the disk at 1,350 and 390 px: no icon codes, nothing wider than the screen, no script errors. |

## Documentation coverage

| # | Finding | Priority | Status | Fix and verification |
|---|---|---|---|---|
| D31 | Real-product documentation covered identity (Keycloak) and an API, but not AI and data science. | P2 | Fixed | "Compare the KC1 model candidates in MLflow": MLflow 3.18.0 on the project's own runs, five annotated screenshots of the real interface, every figure checked by the self-test against the recorded runs. Docker wasn't available, and the guide says so. |
| D32 | More real products (GitHub, Docker, Grafana, Wazuh and others in the brief). | P3 | Open, in part fixed in round 2 | Two products added, each checked on a running copy: JupyterLab 4.6.6 (D46) and Wireshark's tshark 4.2.2 (D47). Docker isn't available on this computer, and Grafana, Wazuh and Bitwarden's server need it or a download that the network refuses; GitHub, Jira and Google Workspace need an account to show. |

## Open questions for Karan

- The availability line (full-time, contract, part-time, freelance, internship, apprenticeship) is unchanged since Version 8. Is it still right?
- The stray branch `fix/refuse-non-finite-values` in the KC1 repository can be deleted: its pull request was merged.
- The titles of the nine videos in the YouTube playlist weren't available, so the playlist isn't described video by video.

## How it was verified

All on 19 and 20 November 2026, in Google Chrome for Testing 153 (Chromium) unless stated. The runs of 20 November are on the final build of the branch, after the fixes D37 to D39.

| Check | Result |
|---|---|
| `tests/matrix.py`: 11 pages at the brief's ten sizes, in portrait and, for phones and tablets, landscape, with an orientation change on each phone | 181 page views, none with a problem: no sideways scrolling, the header at 56 or 64 px, nothing fixed over the content, 44 px header targets on touch screens, no clipped text, no script errors |
| `tests/journeys.py`: the brief's 19 visitor steps, performed on a phone (390 × 844, touch) and a desktop (1,440 × 900) | 44 of 44 checks passed, every control in the open phone menu at least 44 px high |
| `tests/webkit_smoke.py` in WebKitGTK 2.52.6 (GNOME's engine, not Safari) | 41 of 41 checks passed |
| axe-core 4.14.1 (`scripts/check-a11y.py`): all 209 pages, desktop and phone | 0 WCAG problems; 40 best-practice notes, all on the ten contents pages that DITA-OT makes for HTML5 |
| The picture dialog by keyboard | Focus on **Close**, kept in the dialog, returned to the picture on Esc |
| The 12 Studio suites | 473 of 473 checks passed |
| Self-test and link check | 316 checks; 209 pages and 18,845 links |
| The headline, in five languages at 390 and 320 px, with motion, reduced motion and no scripts | 10 of 10 |
| Lighthouse 12.8.2 lab runs, local server | Desktop: performance 100 on the home page, the lifecycle and the API reference, 99 on the Studio; LCP 0.7 to 0.8 s. Mobile (simulated slow 4G): performance 88 to 92, LCP 3.2 to 3.7 s, CLS 0. Accessibility 100 in all eight runs |
| PDFs: text extracted from all 24 | 0 private-use characters (329 in production), 0 "Chapter" labels (78 in production) |
| S1000D: `scripts/aero/validate.py` on the 23 ARF-1 files without the schema layer | 0 errors, 0 warnings; the files are unchanged since the full run with the official Issue 6 schemas on 18 November |

Limitations:

- **Firefox** couldn't be tested: Playwright's Firefox and Mozilla's downloads are blocked on this computer's network, and Ubuntu's Firefox package needs snap.
- **Safari and iOS** weren't tested: WebKitGTK shares WebKit's engine but not Safari's interface, its toolbars or iOS's safe areas. The preview is for a check on Karan's iPhone.
- **Mobile LCP** in the lab is above 2.5 s, but the local server sends files uncompressed: Lighthouse estimates 175 to 200 KB of savings per page from compression, which Vercel applies. Running a compressing server locally for a fairer lab test was refused by the session's permission checks, and the preview's address can't be reached from here. No field data exists for the branch.
- **A mail client** can't open in a headless browser: the journeys check the address, the subject and the link instead.

## How round 2 was verified

On 20 November 2026, on the build of commit `595ae7f` (the preview), in Google Chrome for Testing 153 (Chromium) unless stated.

| Check | Result |
|---|---|
| The 12 Studio suites | 473 of 473 checks passed |
| `tests/matrix.py`: 11 pages at the brief's ten sizes, in portrait and, for phones and tablets, landscape | 181 page views, none with a problem |
| `tests/journeys.py`: the brief's 19 visitor steps on a phone and a desktop | 44 of 44 checks passed |
| `tests/webkit_smoke.py` in WebKitGTK 2.52.6 (GNOME's engine, not Safari) | 41 of 41 checks passed |
| axe-core 4.14.1 (`scripts/check-a11y.py`): all 211 pages, desktop and phone | 0 WCAG problems; 40 best-practice notes, all on the contents pages that DITA-OT makes for HTML5 |
| Self-test and link check | 316 checks; 211 pages and 19,085 links |
| Lighthouse 12.8.2 lab runs on the eleven Studio tools, local server | Layout shift 0 on a phone on all eleven, and 0 on desktop except the IETM (0.002). Performance 99 or 100 on desktop, 83 to 90 on a phone (LCP 3.5 to 4.5 s). Accessibility 100 in all 22 runs |
| Lighthouse on the home page and the two new guides, build `81e322a` (the last commit changes only the Studio's tool pages and the offline package) | Performance 100 on desktop on all three; on a phone 88 (home), 86 (JupyterLab guide) and 94 (tshark guide) |
| The offline IETM package, opened from the disk at 1,350 and 390 px | No icon codes, nothing wider than the screen, no script errors |
| The preview, fetched through Vercel | It serves commit `595ae7f`; pages answer with `noindex` |

The limitations of the first round apply: no Firefox, no Safari or iOS, mobile LCP measured on an uncompressed local server, and no field data for the branch.
