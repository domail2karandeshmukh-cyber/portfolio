# Changelog

What changed on karandeshmukh.dev, release by release. The audit registers in `audit/` hold the findings behind each change, with their evidence.

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
