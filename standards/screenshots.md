---
title: Screenshot standard
description: How I capture, crop, annotate and redact screenshots, measured from my own published guides and improved where they fell short.
---
# Screenshot standard

My published how-to guides use a recognizable bright green for rectangles, arrows, and numbered callouts. This standard keeps that green, measures the guides it comes from, and fixes what the measurements showed: strokes thicker than they need to be, arrows longer than they need to be, numbers that don't have enough contrast, and blur used to hide personal details.

## What the original guides use

I measured six annotated screenshots from my guides for an identity platform's administrators, pixel by pixel. They were captured on a high-density display at 144 dots per inch, so one pixel of the page is two pixels of the image; the values below are in page pixels.

| Element | Measured | Comment |
|---|---|---|
| Green | #6CE975 in five images; #00ED64 in one | #00ED64 is another company's brand green, so the house green is #6CE975 |
| Rectangle stroke | 4 to 6 px | Thick enough to be seen, heavier than the controls it marks |
| Rectangle corners | about 3.5 px radius | Slightly rounded |
| Space inside the rectangle | 2.5 to 12.5 px | Uneven from one image to the next |
| Arrow shaft | 7 to 8 px | Heavier than the rectangles |
| Arrowhead | about 20 px wide, 10 to 12 px long | Wide and short |
| Arrow length | 114 to 248 px | Some arrows cross half the screen to reach their target |
| Numbered callout | Filled green circle, 36 to 37 px across, white number about 16 px high | White on #6CE975 has a contrast ratio of 1.55:1, below the 4.5:1 that text needs |
| Frame | A light lavender border, 2 to 4 px, with rounded corners, on four of the six images | Added by the capture tool, not by design |
| Redaction | Blur | Blur can be reversed; it isn't safe for personal details |

## The house style

All values are page pixels for an image shown at its natural size. For a capture at twice the density, double them; for a 1920 × 1080 film, multiply by 1.5.

### Color

| Use | Color | Contrast |
|---|---|---|
| Annotation green: strokes, arrows, callout fill | #6CE975 | 13.6:1 on black, 9.5:1 on dark gray (#1F2937) |
| Keyline: a 1 px edge outside every green stroke | #0E5A2B | 8.4:1 on white, 5.4:1 against the green |
| Number in a callout | #0B2E16 on #6CE975 | 9.6:1 |
| Redaction box | #000000, fully opaque | Not applicable |

The keyline is the one change to the look of the original guides. Bright green alone has a contrast ratio of 1.55:1 on a white interface, below the 3:1 that WCAG 2.2 asks of graphics a reader needs (success criterion 1.4.11). With the dark edge, the annotation stands out on white and on dark interfaces alike, and it still reads as the same green.

Red, amber, and blue are kept for meaning: red for an error the reader must see, amber for a warning, blue for information. They're never decoration.

### Rectangles

- Stroke: 2 px of green with the 1 px keyline outside it, 3 px in all.
- Corners: 3 px radius.
- Space between the control and the inside of the stroke: 4 px on every side. The stroke never touches or covers the control's text.
- One rectangle marks one control. Don't include a neighbor to make the rectangle tidier.

### Arrows

- Shaft: 3 px in all, green with its keyline.
- Head: a filled triangle 11 px long and 11 px wide.
- The point stops 4 px short of the rectangle it points at.
- Use the shortest arrow that leaves the reader in no doubt: 40 to 90 px. Draw it straight across or straight down; use a diagonal only when a straight arrow would cross another control.
- Don't use an arrow when a rectangle alone is clear.

### Numbered callouts

- A filled green circle 24 px across with a 1 px keyline, and the number in bold at 13 px, centered.
- Number in the order of the steps, and use the same number in the step's text: "2. Select **System Log**." A screenshot with one action needs no number.
- Put the callout outside the control, at the start of a short arrow or beside the rectangle's corner, never over interface text.

### Frame and crop

- Crop to the part of the window the step needs, with enough around it to show where it is: the menu, not the whole desktop.
- Keep the real colors, labels, and fonts of the interface.
- Give the image a 1 px border in #D0D4D9 with 6 px corners so a white interface doesn't merge with a white page. The lavender frame of the original guides is a preset for anyone who wants it.

### Redaction

Cover personal details with a solid, fully opaque box, never with blur, or pixels: both can be reversed. That means names, email addresses, account, and transaction IDs, tokens, internal host names, private addresses, and customer data. A redaction is drawn into the exported pixels, so it can't be removed from the file. Keep the unredacted capture out of the repository.

## Placement

A rectangle is placed from the control's own position, not by eye. For a screenshot of a web page, the capture script reads the control's bounding box from the page, then adds the padding and the stroke.

```text
inside edge   = control box + 4 px on every side
stroke center = inside edge + 1.5 px
image pixels  = page pixels × device pixel ratio, minus the crop offset
```

The same numbers are kept with the image as data, so a resize or a new crop moves the annotations with the picture, and a check can compare each rectangle with the control it marks.

## Text in and around screenshots

- Don't write explanations in the image: put them in the step, where a screen reader and a translator can reach them.
- Introduce a screenshot with its step. Give it alternative text that says what it shows and what is marked: "The Okta admin dashboard, with the Admin button marked."
- In a long document, number and caption the screenshots: "Figure 2. The Reports menu, with System Log marked."

## Presets in the Studio

| Preset | Use | Look |
|---|---|---|
| House green | Software, SaaS, and IT guides | The values above |
| Security | Security consoles, which are often dark | House green, with red kept for the alert itself |
| Video | Training films at 1920 × 1080 | House green × 1.5 |
| Engineering | Line drawings and photographs of equipment | Black lines and item numbers, no green |
| Classic | Matching an older guide | The original guides' green, strokes, and lavender frame |

## Checks

- Every rectangle encloses its control with 4 px to spare, and touches no other control: measured against the page for browser captures.
- Every arrow points at a marked control and is no longer than 90 px.
- Callout numbers run in step order and match the text.
- No personal detail is visible; nothing is blurred.
- The image has alternative text, and a caption in a long document.
