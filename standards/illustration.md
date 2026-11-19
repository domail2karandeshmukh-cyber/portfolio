---
title: Illustration standard
description: Conventions for engineering line drawings, callouts and figure titles, and for the diagrams that explain software and systems.
---
# Illustration standard

An illustration in technical documentation is a working part of a procedure: the reader finds a part by its item number, checks it against the parts list, and does the step. This standard covers two kinds of picture: engineering illustrations of equipment, and diagrams of software and systems.

## Engineering illustrations

### Style

- Black line work on white. Add color only when it carries meaning a reader needs, such as the color of an indicator lamp, and never as the only way to tell parts apart.
- Isometric views for assemblies and exploded views; orthographic views when a dimension or a hidden feature matters.
- No shading, gradients, or photographic effects. A drawing must survive a grayscale printer and a phone screen.

### Line weights

The values are for a drawing 800 units wide, shown about 800 pixels wide.

| Line | Weight | Use |
|---|---|---|
| Outline | 1.8 | The outside edge of each part |
| Detail | 1.0 | Edges inside a part: holes, ribs, panels |
| Hidden | 0.9, dashed 6 3 | Edges behind other parts, only where the reader needs them |
| Centerline | 0.7, dash-dot | Axes of shafts and holes |
| Leader | 0.9 | From an item number to its part |
| Movement | 1.2, with an open arrowhead | Direction to remove or install |

### Item numbers and leader lines

- Each item number names one part, and it's the number in the parts list and in the procedure.
- Put item numbers outside the drawing's outline where possible, in rows or columns.
- A leader starts at the number and ends on the part with a small dot (on a surface) or an arrowhead (on an edge). Leaders don't cross each other, and they don't cross another number.
- The lettering is a plain sans-serif at 12 to 14 units, upright, never smaller than the smallest text of the page around it.

### Identification

- Every drawing has a figure title that names the assembly and the task: "Fan assembly: removal and installation (before Modification M01)".
- In S1000D, every drawing has an information control number (ICN), such as ICN-0DEMO-ARF0002-001-01, shown small in a corner and kept in the file name.
- A drawing changed by an engineering change gets a new issue of its ICN; the old issue stays for the data that still refers to it.

### File formats

- SVG for the web: it stays sharp at any zoom, its text can be searched, and its parts can carry hotspots.
- CGM is the traditional exchange format for S1000D illustrations. The demonstrations on this site use SVG, which S1000D also allows; they don't produce CGM.
- Keep the editable source. Don't rasterize a line drawing to publish it.

### Honesty

A drawing of an invented product says so in its title page or caption. A drawing of a real product is made from real geometry: a photograph, a measured sketch, or a CAD model with permission to use it. Don't present invented geometry as a real component.

## Diagrams of software and systems

Choose the notation for the question the reader has.

| The reader asks | Diagram |
|---|---|
| What is the system, and who uses it? | C4 system context |
| What runs where, and how do the parts talk? | C4 container diagram or deployment diagram |
| In what order do things happen? | UML sequence diagram |
| Where does the data go, and where does it cross a trust boundary? | Data-flow diagram, with trust boundaries drawn as dashed lines |
| What states can it be in? | State diagram |
| Which tables relate to which? | Entity-relationship diagram |
| How is the network laid out? | Network topology diagram |
| What does a person do next? | Flowchart |

### Drawing rules

- Every box names a real component, and every arrow a real relationship, labelled with what moves along it.
- Boxes are sized from their text, which is measured in the font the page uses, so no label runs outside its box in any language. The check in the site's tests compares each label with its box in the browser.
- Arrows point the way the data or the control moves. Connectors leave and reach box edges, not corners, and don't cross when a better route exists.
- Color means something and has a legend: the highlighted box is the subject of the page, a dashed line a trust boundary.
- Give the diagram a figure number and a caption, and alternative text that states its relationships in words.
