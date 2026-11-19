# Version 10 issue register

What the Version 10 audit found on karandeshmukh.dev (production at commit `c32ffc0`), what was done about each finding, and what is still open. Every "Fixed" names the commit on the `v10` branch and the check that shows it.

Severity: **High** means a reader sees a defect or a claim that isn't true. **Medium** means the work looks less professional than it should. **Low** is polish.

## Layout and navigation

| # | Finding | Severity | Status | Fix and evidence |
|---|---|---|---|---|
| 1 | The S1000D architecture diagram: the text of the "S1000D" box ran outside its border. | High | Fixed | Boxes are measured from the text with the real font (`lib/svgbox.mjs`), and a box that can't hold its text stops the build. Text-bounds check: 0 glyphs outside, tightest margin 15 px. `e752348` |
| 2 | No site menu on any page except the home page; no menu at all on a phone. | High | Fixed | One menu on every page (Work, Industries, Documentation, Studio, Projects, Videos, Contact) and a Menu button on phones. `e752348`; group names on phones label their lists instead of being headings, `f8087c2`. |
| 3 | From 1,024 to 1,279 pixels the full menu pushed every page sideways (by up to 163 px in German). | High | Fixed | The Menu button takes over below 1,280 px. Layout check: 29 pages × 8 widths, 0 sideways scroll. `263765b` |
| 4 | No way in for a recruiter from one field. | High | Fixed | Six industry pages and an overview (`e752348`), a field explorer on the home page (`f8087c2`), and a filtered library link on each industry page (`35d15e1`). |
| 5 | The aerospace overview was one long page: 6,605 px on a desktop, 12,668 px on a phone. | Medium | Fixed | Ten sections with a side menu and deep links; 2,053 px and 4,134 px. `e752348` |
| 6 | At 320 px, the home page in French, German and Spanish, the Studio, the aerospace pages, the scenario pages, the DITA HTML and the demo apps scrolled sideways. | High | Fixed | `8eac7c2`, `f8087c2`. Layout check at 320, 375 and 390 px: 0 sideways scroll. |
| 7 | Translated home pages linked to `/fr/studio/aerospace` (and `/de`, `/es`, `/hi`), which don't exist. | High | Fixed | The English-only pages are linked as they are. Link check: 186 pages, 13,787 internal links, all lead somewhere. `263765b` |
| 8 | The Studio's home was a list of tools with no search, filters or stages. | Medium | Fixed | A catalogue of 83 items with a tab for each stage of the work, a search box, and filters for field, type and format, kept in the address. `f8087c2`; `tests/studio/test_hub.py`, 36 checks. |
| 9 | The library could be grouped by kind and project only. | Medium | Fixed | Filters for field, reader, standard or framework, and format; versions shown. `35d15e1` |

## Writing, structure and evidence

| # | Finding | Severity | Status | Fix and evidence |
|---|---|---|---|---|
| 10 | The feed pump B test report gave test durations and results that contradicted each other. | High | Fixed | Rewritten so every duration, reading and result agrees. `8eac7c2` |
| 11 | DITA conversion put "Tools and materials" after the steps of a task, though the source has it before them. | High | Fixed | Sections keep their place: before the steps they are prerequisites, acceptance criteria go to the result. `7786750` |
| 12 | The AI and data science page named model cards as a convention, but no model card existed. | High | Fixed | A model card and a dataset card for KC1, copied from the project's recorded runs. `642336d` |
| 13 | No user documentation of the site's own tools with real screenshots. | Medium | Fixed | "Annotate a screenshot in the Screenshot Studio", with screenshots of the tool marked up by the tool. `642336d` |
| 14 | "Fictional" in headings and labels across the Studio, the industry pages and the scenario pages. | Medium | Fixed in visible copy | "Example company" and "demonstration" in the Studio, industry pages, scenario notices and video slides. `f8087c2`, `7786750`. The aerospace corpus keeps its non-operational declarations, as the brief requires. |
| 15 | Awkward prompts in the aerospace guided path ("Look at change the issue number…"). | Low | Fixed | The three prompts that ask the reader to do something read "Try it:". `263765b` |
| 16 | The videos page said the captions were "checked against the recording". | High | Fixed | It now says how they are made: the narration's script, split into short lines and timed from the recording. `263765b` |

## Screenshots, illustrations and video

| # | Finding | Severity | Status | Fix and evidence |
|---|---|---|---|---|
| 17 | Red was the default annotation color; arrows crossed other controls; callouts covered text; blur hid personal data. | High | Fixed | The house green with a dark keyline, measured placement, solid redaction (`standards/screenshots.md`); every sample made again. `8eac7c2`; blur and pixelate hints warn that both can be reversed, `f8087c2`. |
| 18 | The flagship package's screenshot had a red arrow, and its page described marks it no longer had. | Medium | Fixed | The package was made again, and the page describes the new pictures. `7786750`, `263765b` |
| 19 | The four films drew a caption bar into the picture, as well as a caption track; sound at 96 kHz; one long cue per scene; posters with the caption bar and the old header. | Medium | Fixed | Filmed again from the current site without the bar; cues of two lines of 42 characters; SRT copies; −16 LUFS, true peak at or below −1 dBTP, 48 kHz; new posters. `7786750`, `263765b` |
| 20 | The Video Studio blurred the access key in its samples, burned captions in by default, and its samples were 2 LU too loud. | High | Fixed | A Redaction layer (solid, never fades); captions as a track by default; samples at −16.0 LUFS. `7786750` |
| 21 | An SVG preview could cut an escaped character in half and fail to load. | Low | Fixed | `f8087c2` |

## Publishing

| # | Finding | Severity | Status | Fix and evidence |
|---|---|---|---|---|
| 22 | DITA PDFs: Letter size, Helvetica not embedded, untagged. | Medium | Fixed | A4, Hanken Grotesk embedded, tagged. `8eac7c2` |
| 23 | DITA PDFs opened with a bare title page and a contents page with one entry, and numbered "ii" then "3". | Medium | Fixed in part | Published from a bookmap: a title page with identifier, organization, issue date and author; a page of document information; contents only for more than one document; numbered chapters; number-only footers. `7786750`. Still open: the body counts on from the front matter, because Apache FOP can't restart page numbers in a chapter. |
| 24 | The step-guide PDF listed 14 unembedded standard fonts and had no outline. | Medium | Fixed | `8eac7c2` |

## Accessibility

| # | Finding | Severity | Status | Fix and evidence |
|---|---|---|---|---|
| 25 | Tables and code that scroll sideways on a phone couldn't be reached with the keyboard (10 pages). | High | Fixed | They join the tab order while they scroll. axe-core on those pages: 0 WCAG problems. `263765b` |
| 26 | DITA Open Toolkit's HTML5 contents page has no main landmark. | Low | Accepted | DITA-OT's own template; a best-practice note, not a WCAG failure. |

## Found while checking the preview

| # | Finding | Severity | Status | Fix and evidence |
|---|---|---|---|---|
| 27 | The build turned five links to pages of the site into GitHub addresses that don't exist. They were in the three documents kept in this repository: the KC1 model and dataset cards, and the Screenshot Studio guide. The link check counted them as links to another site, so its internal count stayed clean. | High | Fixed | In this repository's own documents, a link that starts with "/" stays a link to the site. In other repositories, the build reads it from the repository's root, as GitHub does. The five links lead to their pages. |
| 28 | "Source on GitHub" links to files that are new in Version 10 pointed at `main`, where the files don't exist until the merge. On the preview, 10 links answered 404: the house standards, the two cards and the guide. | Medium | Fixed | Links to the site's own files use the branch that Vercel builds (`VERCEL_GIT_COMMIT_REF`): a preview links to its branch, and production to `main`. Link check: 186 pages, 13,792 internal links, all lead somewhere; every GitHub link answers. |
| 29 | The house standards had 16 commas inside paired items, such as "Title, product, and version" and "never with blur, or pixels". The style tool's serial-comma fix had put them there: it took a list item that contains "and" for the end of the list. | Medium | Fixed | The 16 commas are out. The check now skips a list that goes on after "and", and the serial comma is no longer among the fixes applied without a person looking. Style check of the standards: 0 errors, 0 warnings. |
| 30 | The Video Studio wrote each caption as one cue, however long: its two sample videos had cues of up to 154 characters on one line, shown for up to 10.5 seconds. | Medium | Fixed | The Studio splits a caption into cues of at most two lines of 42 characters, each shown for at least a second, on screen and in the SRT and WebVTT files. The samples' caption files were exported again from the Studio: 17 and 15 cues, 1.0 to 6.0 seconds. `tests/studio/test_video.py`: 41 checks. |
| 31 | DITA publications: the document information page of the SaaS help set had three empty columns; two publications had a broken notice sentence ("every person, address and figure in it people, addresses and figures in it"); one title said "fictional sample". | Medium | Fixed | Columns that no document fills are left out; help templates show the status Template; the notice is one correct sentence; the title names the templates. The six sets were validated against the DITA 1.3 DTDs and published again with DITA-OT 4.3.4. |

## Open, and for Karan to decide

| # | Finding | Severity | Status |
|---|---|---|---|
| 32 | Two help-center samples come from employer work: "Access the Core42 AI Cloud Portal" and the Google Workspace FAQs. The repository holds no record that publishing them was authorized. | High | **For Karan.** Left as they are. If authorization is uncertain, they can be taken off the public site and kept as style references only. |
| 33 | Firefox and WebKit couldn't be installed here (their download server is blocked), so every browser test ran in Chromium only. | Medium | Open |
| 34 | The recorded narration of the Studio's two sample videos still says "fictional", and no person has listened to any narration to check the captions against it. | Medium | Open. New narration costs money and needs approval. |
| 35 | The project reports, the paper and the CV are untagged PDFs. The reports and the paper come from the project repositories; the CV is protected and wasn't changed. | Low | Open |
| 36 | "Fictional" is still on screen in three places: the "FICTIONAL DEMO" badge of the demo apps, which shows in every Studio screenshot sample, step guide and sample video; the line "Fictional sample written for this portfolio" in the workbench's templates, which the DITA samples carry; and the aerospace corpus's non-operational notices, which the brief keeps. | Medium | **For Karan.** The badge and the template line can say "Demo" and "Example" instead; that means capturing the samples again and publishing again. Only new narration would cost money. |
| 37 | On a simulated phone on a slow 4G connection (Lighthouse), the largest content shows after 3.2 to 3.8 seconds, above the 2.5 seconds that counts as good. On a desktop it's 0.6 to 0.9 seconds. | Low | Open |
