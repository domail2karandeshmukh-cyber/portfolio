# Changelog

What changed on karandeshmukh.dev, release by release. The audit registers in `audit/` hold the findings behind each change, with their evidence.

## Unreleased: interactive pages, on review branches (25 November 2026)

Built on the `ai/portfolio-*` branches, each with a Vercel preview. Not on the live site. State and evidence: `docs/ai/HANDOFF.md` and `docs/ai/TEST_REPORT.md`.

- **The hero's three pages in depth.** On a wide screen they rise into a 3D stack, turn toward the pointer and separate on scroll. No library; unchanged below 1,080 pixels, with reduced motion and without scripts.
- **The ARF-1 rig in 3D, in the parts catalogue.** A model to turn by hand, between assembled and exploded, selected from the rig or from the list. The drawing stays the default. In five languages.
- **Sign-in flows.** `/sign-in-flows`: OAuth 2.0, OpenID Connect, SAML 2.0 and single sign-on in 33 steps, with invented values. To check before release: a review by someone who works with these protocols, and the six links to the specifications.
- **The KC1 API explorer.** `/kc1-api-explorer`: the 13 recorded requests with their responses. Nothing on it is live.
- **Shared rules for coding agents.** `AGENTS.md`, `CLAUDE.md` and `docs/ai/`.

## Round 2: the Studio's tools and two more products (released 21 November 2026)

The leftovers of the design refinement, the Studio's tools, and two more real products. No version number raised. Findings and evidence: `audit/design-refinement-register.md` (D40 to D49).

- **The Studio's tools share one working surface.** A header with one sentence and **Help**, which opens the longer explanation, the shortcuts and the limits; a command bar with the starting points on the left, the output on the right and the status under them; and panels with one edge, corner and title. The DITA Studio and the offline IETM package have the command bar too. In five languages.
- **Nothing moves while a Studio tool loads.** Each tool shows once it has drawn itself, so its panels no longer jump as the samples or the CSDB arrive. Lighthouse's layout-shift score on desktop, 0.14 to 0.59 on ten of the tools in 10.1, is now 0 (0.002 on the IETM), and 0 on a phone on all eleven.
- **Two more real products.** "Run a notebook from a clean start and share it as HTML in JupyterLab" (JupyterLab 4.6.6), with nine annotated screens and the sample notebook, and "Find the slowest HTTP responses in a capture with tshark" (Wireshark's tshark 4.2.2), with the capture to download. Each is checked on a running copy, and its `evidence.json` keeps what the product showed.
- **PDFs.** The flagship procedure and the Studio's sample guides print typographic apostrophes. Printed, the notes under the ARF-1 drawings are 6.3 pt instead of 5.3.
- **April on a phone.** Her subtitle is whole at 390 px and wraps at 320 px; her voice button is an icon there.

## 10.1, design refinement (released 20 November 2026)

The Version 10.1 design brief: the signature headline back, a home page half as long, navigation that covers nothing, and the fixes that testing every page at ten sizes found. Released with Karan's approval; no version number raised. Findings and evidence: `audit/design-refinement-register.md`.

- **Headline.** "I turn what engineers know into docs people can follow." is back, with its three edits and its highlight, in five languages. With reduced motion, or without scripts, it shows its final words.
- **Home page.** From 16,224 to 8,486 pixels on a desktop, 22,372 to 11,063 on a phone, and 2,209 to 1,134 words. The long material moved to the recruiter page, the case study and the library. Each document card shows a real page of its PDF.
- **Header, menu, contact, footer and privacy.** April opens from the header and covers nothing. The phone menu folds into labelled groups, with 44-pixel targets. The contact page has a copyable address and a feedback link; one footer on every page; a privacy page.
- **Industries.** One icon family (Lucide) on the tiles, the industry pages, the menus and the Studio.
- **The documentation lifecycle.** Nine phases on a rail that follows the reader, an index of the evidence, and the revision diffs folded. Every stage keeps its address.
- **Reader and Studio.** On a phone, a document's contents fold under one button. An enlarged picture opens in a dialog with **Close** and its caption. The Studio's menu has icons and 44-pixel items. Text fields have edges at 3.7:1.
- **PDFs.** Every PDF published again: no "Chapter" labels, ligatures that search and copy as letters, typographic quotation marks, illustration labels sized for print, and sequence diagrams that read at any size, with alternative text that lists their messages.
- **A real product for AI and data science.** "Compare the KC1 model candidates in MLflow", written against MLflow 3.18.0 and the project's own runs. The self-test checks its figures against the recorded runs.
- **Design system.** `/standards/design`: the tokens, type, components and icons, with the research behind each decision.
- **Tests.** `tests/matrix.py` (11 pages at ten sizes, in both orientations) and `tests/journeys.py` (19 visitor journeys on a phone and a desktop).

## 10.1 (released 19 November 2026)

The first screen, contact, and documentation of real work.

- **First screen.** Who I am, a two-line headline, the facts, availability, two primary actions (**Explore my work**, **Download CV**) and four secondary links, all in the first screen on a desktop and a phone. A link to a section lands its heading 24 pixels under the header.
- **Contact.** Email in the home page's contact section, every footer, the recruiter page, and a new contact page with a subject for six kinds of message. No phone number, by choice. April points to the contact page and says she can't pass a message on.
- **The message-to-document case study.** The hero takes an engineer's message through six stages: input, analysis, edit, document, quality and publish. `/message-to-document` shows every stage in full, with checks the build computes and HTML, PDF, DITA and Markdown made by the real pipeline.
- **API documentation of a working API.** A reference, a quick start and a troubleshooting guide for the KC1 prediction API, with its OpenAPI description and every request and response recorded against the trained model. API documentation is a seventh field on `/industries`.
- **Recruiter page.** "Your field, in one minute": the seven fields, each with what the work rests on, three documents, the conventions, downloads and films.
- **DITA.** A procedure written across several sections keeps its order (each section a step, its list the substeps), variables in code take their values, and the PDF and HTML5 carry DITA-OT's task labels. The code font is named by its real weight.
- **A real product: Keycloak 26.8.2.** Three independent guides for realm administrators (reset a one-time password, troubleshoot sign-in codes, choose an OTP policy), every screen from a Keycloak server run for them and every stated behaviour tested, also published as a DITA set.
- **The documentation lifecycle.** `/documentation-lifecycle` follows the KC1 API documents through sixteen stages, from the requirement to a real engineering change (pull request 2 in the KC1 repository), its impact analysis, and revision 1.1 as a diff.
- **KC1 API 1.0.1.** The fix for `1e999` was merged into the KC1 project (pull request 2), so revision 1.1 of the reference and the troubleshooting guide is published, with the OpenAPI description and the recorded exchanges of 1.0.1; revision 1.0 and the 1.0.0 recordings stay in the lifecycle case study.
- **A tutorial film of a real task.** "Reset a user's one-time password in Keycloak", recorded in Chrome from the running server, with the house marks drawn on the controls' own positions, the QR code hidden, a band naming each step, and WebVTT and SRT captions. Its narration was recorded from the live site after the release, the same day: a synthetic voice, not Karan's, which the film's first and last cards say. The captions are timed from the pauses in the recording.
- **Honest labels.** The demo apps say "Simulated interface" in place of FICTIONAL DEMO, and every sample made from them was made again; the Studio and the aerospace publications say simulated, invented or demonstration data for what each thing is. The Screenshot Studio opens on screenshots of real software.
- **Studio navigation.** The tools in groups on the left of a wide screen and behind "Studio tools" on a narrow one, the page marked, and the previous and next tool at the foot of each tool.
- **The reader.** Contents on the right of a wide screen, previous and next documents, Print, and the set's PDF and HTML5 for a document in a DITA set. Code in DITA-OT's HTML5 wraps instead of scrolling out of a keyboard's reach.
- **Downloads.** Six publication sets, each with a page of its PDF, what it documents, its revision, pages and size, and a way to read it online; aerospace files named for a flat list.
- **PDFs.** Every page of the 25 PDFs (252 pages) looked at; a procedure's figure in the ARF-1 publications is at most 92 mm high, so a figure's two variants share a page (27 pages to 26).
- **April.** Notes on everything above, with its limits, and two new suggested questions in five languages. She no longer quotes the Studio's simulated scenarios as Karan's work.
- **Performance.** The heading font cut to the weights and sizes in use (131 KB to 68 KB).
- **Tests.** `tests/studio/test_case.py` (the case study) and `tests/webkit_smoke.py` (14 pages in WebKitGTK).
- **Version.** 10.1 in `package.json`, the standards pages and every footer.

## 10 (released 19 November 2026)

House standards, designed PDFs with DITA Open Toolkit, the green annotation style, the industry pages, the library's twelve categories and the Documentation Studio's scenarios. The findings are in `audit/v10-issue-register.md`.
