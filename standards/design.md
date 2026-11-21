---
title: Design system
description: The tokens, type, components, icons and motion of this site and its Documentation Studio, with the research each decision rests on.
---
# Design system

The site shows documentation, so the design has one job: to make the documents and the evidence easy to find, read and open, on a phone as well as on a desktop. Every page and every Studio tool uses the tokens and components below, from one stylesheet (`src/site.css`, with `src/studio/studio.css` for the Studio's tools). This page records what each decision is and what it rests on.

## Principles

- **The work comes first.** A page leads with what a visitor came for: a document, a publication, a tool. Decoration that doesn't help a visitor find or read something is left out.
- **One accent, used for one meaning.** The brand yellow marks where the reader is (the current page, phase or section) and the one phrase that the headline highlights. It isn't a background for decoration.
- **Nothing covers the content.** No floating button or panel sits over text, a footer or a control. April opens from the header.
- **Every control is easy to hit.** On a touch screen, the controls that move a visitor around (the header, the menu, the lifecycle rail, a document's contents and the Studio's menu) are at least 44 pixels high. Every other control is at least 24 by 24 pixels, so a button in a document or a tool isn't drawn bigger than its job: a Studio tool's buttons are drawn 36 pixels high, with a 44-pixel target.
- **Motion answers a person or plays once.** The headline's edit plays once on arrival; everything else moves only when someone acts, and nothing moves when the reader's system asks for reduced motion.

## Research and decisions

| Question | What the research says | Decision |
|---|---|---|
| Hide the menu behind a button? | Nielsen Norman Group's quantitative study found that hidden navigation is less discoverable than visible or partly visible navigation, and that people who use it do so later in a task ([NN/g](https://www.nngroup.com/articles/hamburger-menus/)). | On a desktop, the main sections are visible in the header. On a phone, where they don't fit, the menu opens as a drawer with labelled groups, and the most-used actions (**Ask April**, **CV**) stay visible beside it. |
| How large must a control be? | WCAG 2.2 sets a minimum of 24 by 24 CSS pixels, or enough spacing (SC 2.5.8, [W3C](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum)). Apple asks for a hit target of at least 44 by 44 points on a touch screen ([Apple](https://developer.apple.com/design/tips/)). | 44 pixels on a phone for the controls that move a visitor around: header buttons, menu items and languages, the lifecycle rail, the document contents and the Studio's menu. Every other control is at least 24 by 24 pixels, the WCAG minimum. |
| What may a sticky header cover? | A focused item must stay at least partly visible: a sticky header or a persistent panel can fail SC 2.4.11 ([W3C](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured)). | The page's scroll padding follows the header's height, so a heading, a section or a focused control that the browser scrolls to lands below the header. The lifecycle's sticky rail adds its own scroll margin. |
| How should spacing scale? | Carbon builds its spacing scale from multiples of two, four and eight, with small steps inside components and larger ones between them ([Carbon](https://carbondesignsystem.com/elements/spacing/overview/)). | Nine spacing tokens from 4 to 96 pixels, and fluid tokens for the gutter and the space between sections. |
| What does a reader expect of a help center? | GitHub Docs gives every article a standard order of content and a table of contents made automatically ([GitHub Docs](https://docs.github.com/en/contributing/style-guide-and-content-model/contents-of-a-github-docs-article)). | The reader has the shelf on the left, the article in the middle and its contents on the right, with breadcrumbs, previous and next documents, copyable code, enlargeable pictures, print, and the set's PDF and HTML5. On a phone, the contents fold under one button. |
| How much should a tool explain up front? | Progressive disclosure keeps the core features on the first display and moves advanced or rarely used ones to a secondary one, which makes an application easier to learn and less error-prone; what appears first tells users it's important ([NN/g](https://www.nngroup.com/articles/progressive-disclosure/)). | Each Studio tool says what it does in one sentence. **Help** opens the longer explanation, the shortcuts, and the privacy notes and limits, under the header. A notice that keeps a reader safe (demonstration data, not a compliance check) stays in view. |
| How should interface text read? | The Microsoft Writing Style Guide asks for sentence-style capitalization, the last comma in a list of three or more, and short, direct sentences ([Microsoft](https://learn.microsoft.com/en-us/style-guide/top-10-tips-style-voice)). | The site's copy and its controls follow the house editorial standard, which rests on it: sentence case, the serial comma, a verb at the start of an action. |

## Colour

| Token | Value | Use | Contrast on white |
|---|---|---|---|
| `--ink` | #0B0B0C | Text, primary buttons, focus rings | 19.7:1 |
| `--ink2` | #3B3D42 | Body copy that is secondary | 10.9:1 |
| `--mute` | #696C73 | Metadata, captions, labels of fields | 5.3:1 (4.7:1 on `--desk`) |
| `--hl` | #FFDF2B | Where the reader is; the headline's highlight | Ink on yellow 14.8:1 |
| `--field` | #83858A | The border of a text field, a list or a box that has to be found | 3.7:1 (3.3:1 on `--desk`) |
| `--rule`, `--rule2` | #DDDDD9, #B8B9B5 | Dividers and the edges of cards, which nothing depends on | Decorative only |
| `--desk`, `--paper` | #F3F3F0, #FFFFFF | Page background, cards and documents | — |
| `--red`, `--green` | #CE2F20, #0B7E47 | Errors and passes, always with a word or an icon | 5.2:1, 5.1:1 |

Text meets WCAG 2.2 AA (4.5:1) everywhere; the edge of a control that has to be seen meets 3:1 (SC 1.4.11). Colour never carries a meaning alone.

## Type

- **Faces:** Hanken Grotesk for text and interface, Newsreader for display headings, Atkinson Hyperlegible Mono for code, and a Devanagari face for Hindi. All are served from the site, under the SIL Open Font License.
- **Scale:** display `clamp(2.125rem, 1.4rem + 3.4vw, 4.5rem)`, then `--fs-h1` to `--fs-h3`, a lead size, and body text at 1.0625rem (17 px) with a line height of 1.6; small text at 0.9375rem and metadata at 0.875rem. A reading column holds at most about 75 characters.
- **PDFs:** body text at 10.5 pt with a line spacing of 1.45 and 6 to 8 pt between paragraphs, from the same faces (standards/publishing).

## Space, shape and motion

- **Spacing:** `--s1` to `--s9` (4, 8, 12, 16, 24, 32, 48, 64, 96 pixels); `--gutter` `clamp(16px, 5vw, 32px)`; `--sec` `clamp(48px, 7vw, 104px)` between sections.
- **Header:** 64 pixels high on a desktop, 56 on a phone (`--navh`).
- **Radii:** `--r1` 6 pixels for small controls, `--r2` 12 pixels for cards and panels, `--pill` for chips and buttons.
- **Motion:** three durations (`--t1` to `--t3`) and one easing. The headline's edit plays once; the lifecycle rail's bar follows the reader; a menu or a panel opens in response to a click. With reduced motion, the headline shows its final words and nothing animates.
- **Focus:** a 3-pixel ink outline, 2 pixels from the control, on every focusable element.

## Components

| Component | Behaviour |
|---|---|
| Header | Brand, the main sections, search, **Ask April**, the language menu where a page is translated (the home pages and the Studio), and **Download CV**. On a phone: brand, April, the menu and **CV**. |
| Phone menu | A drawer below the header with labelled groups that fold; every control in it is at least 44 pixels high, and the industries keep their icons; it closes when a link is chosen. |
| April | Opens from the header. On a phone, as a sheet over the lower part of the screen that leaves the header visible; on a desktop, as a panel. Never a floating button. |
| Buttons | Ink for the primary action, paper with an ink border for the second; one primary action per group. |
| Studio tool | A header with the tool's name, one sentence and **Help**; then a command bar with the starting points (samples, open, new) on the left, undo and redo, and the output on the right with one ink button, and the status line under them. Its second buttons have a grey edge (`--field`, 3.7:1) so that the ink one stands out. The working areas are panels with one edge (`--rule`), the 12-pixel corner and one kind of title (17 pixels, semibold); a document shown in a tool keeps its own type. On a phone, each group of commands takes a row of its own. |
| Field tiles | An industry or a tool: an icon from the family, a name and, on a wide screen, one line. |
| Document cards | A real page of the published PDF, the product or project, the kind of document, its basis, and **Read online** and **PDF** with pages and size. |
| Lifecycle rail | The nine phases of the documentation lifecycle, sticky under the header, with the current phase marked and a bar that fills with the reader's progress. |
| Reader | Shelf, article and contents; a lightbox for pictures and diagrams with a **Close** button, a caption and focus kept inside. |
| Footer | Identity, three groups of links (Work, Documentation, Connect) and the legal line. Nothing covers it. |

## Icons

One family: [Lucide](https://lucide.dev), under the ISC licence, drawn on a 24-unit grid with a 1.75 stroke, placed in the page as SVG (`lib/icons.mjs`). The only exception is GitHub's own mark, from Octicons (MIT), for links to GitHub. An icon always comes with a word, or with an accessible name when it stands alone.

## Version

Version 10.1, November 2026.
