---
title: Publishing standard
description: Page layout, front matter, contents, numbering and the checks every published PDF passes.
---
# Publishing standard

A published PDF should look like a document someone designed for print, not like a web page someone printed. This standard says what a publication contains, how its pages are laid out, and how it's checked before anyone sees it.

## One source, several outputs

HTML and PDF come from the same source: Markdown, DITA, or S1000D XML. A correction is made once, in the source, and every output is generated again. An output is never edited by hand.

## Front matter, when the document needs it

| Element | Short help article | User or administrator guide | Controlled publication (maintenance, operator, S1000D) |
|---|---|---|---|
| Title page | No | Yes | Yes |
| Document identifier, version, and date | In the header line | On the title page | On the title page, with the issue number |
| Applicability (product, version, serial numbers) | Only if it varies | Yes | Yes |
| Revision history or highlights | No | Yes, short | Yes: highlights of the issue and a revision record |
| Table of contents | No | Yes | Yes |
| List of effective pages or data modules | No | No | Yes |
| Lists of figures and tables | No | Over 10 figures | Yes |

Don't add pages to make a document look larger, and don't leave out an element its specification requires. A publication of one document has no contents list: its headings are its bookmarks.

The DITA publications on this site are published from a bookmap (scripts/dita-pdf/bookmap.mjs): a title page with the publication's identifier, the organization, the issue date and the author; a page of document information with each document's ID, version, status and date; a contents list when there is more than one document; and each document as a chapter. A chapter is a document in its own right, so its title stands alone, with no "Chapter 1" in front of it in the text or in the contents. The theme turns the numbers off, and a small plug-in (scripts/dita-pdf/plugin) turns the word off, because the theme can't change DITA Open Toolkit's labels.

## Page layout

- Paper: A4 by default, US Letter when the reader is in North America. One size within a document set.
- Margins: 20 mm at the top and bottom, 18 mm at the sides; more on the binding side only for print that is bound.
- Type: Hanken Grotesk for text and headings in software and IT documents, at 10.5 pt with 1.45 line spacing; a monospace face for code; the fonts embedded in the file.
- Typography: a typographic apostrophe (’) and quotation marks (“ ”) in running text, never in code, a file name, a command or a label from the interface (scripts/dita-pdf/typeset.mjs). A table is ruled across, top and bottom, rather than boxed on every side. Inline code is a size smaller than the text around it.
- Illustrations: their callouts and labels print at about 8 pt and 7 pt, in the text face, each inside its drawing and clear of the others (tests/studio/test_aero.py measures every one).
- Header: the publication's title. Footer: the page number. The title page and the page of document information carry none; the contents list is numbered in roman numerals, and the chapters in arabic numerals that count on from the front matter. That is how DITA Open Toolkit numbers a bookmap with Apache FOP: restarting at 1 in each chapter needs folio prefixes (XSL 1.1), which FOP doesn't support. The S1000D publications number their pages "Page 3 of 27".
- Headings stay with the text that follows them; a warning or a caution never breaks across pages; a table that runs onto a second page repeats its header row.
- A step's command stays on the page with what follows it, so that no step ends a page with its code or its caution on the next one.
- A procedure's parts carry their labels: "Before you begin", "Procedure", "Results" and "What to do next", so that a reader sees where the prerequisites end and the steps begin. DITA Open Toolkit writes them in the PDF and the HTML5 (`args.gen.task.lbl`).
- A procedure written across several sections keeps its order: each section is a step, and its numbered list becomes the substeps.
- Figures and tables are numbered in order and referred to by number.
- Screenshots print at a size where their text is readable: at least the size they had on screen, never enlarged from a low-resolution capture.

## PDF properties

- Searchable text, not pictures of text, in which every word keeps its real letters. Apache FOP and Chromium give a ligature or a contextual alternate a private-use character, so "first" would be found, copied and read aloud as "rst": the PDF fonts have their ligatures turned off (scripts/dita-pdf/no-ligatures.py), the S1000D illustrations print without contextual alternates, and the tests look for private-use characters in every ARF-1 PDF.
- Bookmarks that follow the headings.
- Tagged, where the producer supports it, so a screen reader can follow the structure.
- Title, author, and subject set in the document's properties.
- Fonts embedded.

## Checks before publication

1. Every page rendered and looked at.
2. No blank page, no clipped text, no table wider than the page, no heading alone at the bottom of a page.
3. The contents list and the bookmarks match the headings, and every cross-reference goes to the right place.
4. Numbering of steps, figures, and tables is continuous.
5. Screenshots readable at print size; engineering drawings legible in grayscale.
6. The PDF says the same thing as the HTML from the same source.
7. The properties, fonts, and tags checked with a PDF inspector.

## What publishes what here

| Source | Output | Tool |
|---|---|---|
| Markdown documents in the library | HTML pages | The site's build |
| DITA topics and maps | HTML5 and PDF | DITA Open Toolkit |
| S1000D Issue 6 data and publication modules | HTML, PDF, and an offline IETM | The site's own publisher, with Chromium for PDF |
| Step guides made in the Studio | Markdown, HTML, and PDF | The Step Guide Studio in the browser |
