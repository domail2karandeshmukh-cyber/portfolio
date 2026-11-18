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
| Revision history or highlights | No | Yes, short | Yes: highlights of the issue, and a revision record |
| Table of contents | No | Yes | Yes |
| List of effective pages or data modules | No | No | Yes |
| Lists of figures and tables | No | Over 10 figures | Yes |

Don't add pages to make a document look larger, and don't leave out an element its specification requires.

## Page layout

- Paper: A4 by default, US Letter when the reader is in North America. One size within a document set.
- Margins: 20 mm at the top and bottom, 18 mm at the sides; more on the binding side only for print that is bound.
- Type: Hanken Grotesk for text and headings in software and IT documents, at 10.5 pt with 1.45 line spacing; a monospace face for code; the fonts embedded in the file.
- Header: the document's title and identifier. Footer: the page number as "Page 3 of 27", and the issue or version.
- Headings stay with the text that follows them; a warning or a caution never breaks across pages; a table that runs onto a second page repeats its header row.
- Figures and tables are numbered in order and referred to by number.
- Screenshots print at a size where their text is readable: at least the size they had on screen, never enlarged from a low-resolution capture.

## PDF properties

- Searchable text, not pictures of text.
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
