---
title: Benchmark
description: The documentation and standards I studied for Version 10, what I adapted from each, and what I may not copy.
---
# Benchmark

Before changing the site's documents, I compared them with the published documentation of companies and standards bodies that do this work well. This page lists what I studied, what each source does that is worth adapting, and the limits on using it. Nothing here is copied: the sources are studied for their practice, and their text, branding, and interfaces stay theirs.

The last column says how current my reading is: **checked** means I read the source again in November 2026 for this version; **earlier** means it was researched for the aerospace work in Version 9; **practice** means I know it from my own work and didn't read it again.

## Writing style

| Source | What it does well | What I adapted | Limits | Read |
|---|---|---|---|---|
| Microsoft Writing Style Guide | Sentence-case headings; one action per step; location before action; "select" for every input device; spaced angle brackets for menu paths | The house style for software and IT, and most rules of the [style guide](/style) | Text and examples are Microsoft's; only the rules are used | checked |
| Google developer documentation style guide | Procedures with an introductory sentence; "Optional:" steps; images introduced by a sentence; solid redaction, never blur; numbered figure captions | Second reference, and the image and redaction rules of the [screenshot standard](/standards/screenshots) | Licensed CC BY 4.0; cite it when quoting | checked |
| Kubernetes documentation style guide | US English, sentence-case headings, code style for commands, and API objects, UpperCamelCase for API kinds | The API and developer profile: code style for objects and commands | Project-specific terms don't carry over | checked |
| Diátaxis | Four kinds of documentation: tutorials, how-to guides, reference, explanation | The document kinds of the software profile and the library's grouping | A framework, not a style guide | practice |

## Screenshots and visuals

| Source | What it does well | What I adapted | Limits | Read |
|---|---|---|---|---|
| Dynatrace content style guide, screenshot annotations | Every annotation color has one meaning; as few shapes as possible; callout lines exactly horizontal or vertical | Color only for meaning; the shortest straight arrow | Its Snagit theme and fonts are internal | checked |
| New Relic style guide, image annotations | A green house color, fixed line widths, about 2 pixels of clearance around a control, no shadows, visible in dark and light mode | Fixed geometry, clearance that never covers the control, a dark keyline for both modes | Its green, #00CE7C, and theme are its own | checked |
| Unity documentation style guide | Numbered labels for steps, letters for areas; consistent label size | Numbers only for steps that match the text | Its label artwork is its own | checked |
| TechSmith Snagit and Camtasia guidance | Step tool, themes, capture, and annotation workflow | The Studio's presets and step numbering | Product guidance, not a standard | practice |
| My own published guides | Bright green rectangles, arrows, and numbered circles | The house green, #6CE975, measured from six screenshots | The originals contain an employer's internal identifiers; they'ren't published | checked |

## API, security and AI

| Source | What it does well | What I adapted | Limits | Read |
|---|---|---|---|---|
| OpenAPI Specification 3.2.0 | A standard description of an HTTP API that tools can read | API descriptions in OpenAPI 3.1 or later | Use the version the tooling supports | checked |
| Stripe API reference, GitHub Docs | Each endpoint with its parameters, a request, a response, and its errors, side by side | The structure of the API reference in the [editorial standard](/standards/editorial) | Their layouts and text are theirs | practice |
| NIST SP 800-61, MITRE ATT&CK | Incident-response phases; a shared name for every adversary technique | The runbook structure and ATT&CK IDs in the security profile | ATT&CK is used under its terms of use, with attribution | practice |
| Wazuh documentation | Alert rules, decoders, and agents explained from the console the reader sees | The simulated alert scenario | The scenario is simulated; no real alert is shown | practice |
| Hugging Face model cards; Mitchell et al., 2019 | Fixed sections: description, intended uses, and limitations, training data, procedure, evaluation, including the decision threshold | The model card and dataset card of the AI profile | Report only measured results | checked |

## Aerospace and industrial

| Source | What it does well | What I adapted | Limits | Read |
|---|---|---|---|---|
| S1000D Issue 6 | Data modules, a common source database, applicability, BREX | The ARF-1 data and its validation | Schemas used for validation, not redistributed; Issue 7 appeared in July 2026 | earlier |
| ASD-STE100 Issue 9 | Writing rules and a controlled dictionary for maintenance text | The STE checker's rules, cited by number | The dictionary isn't reproduced | earlier |
| ATA iSpec 2200, revision 2025.1 | Chapter numbering and content for civil-aviation maintenance data | Named in the aerospace profile for projects that use it | A paid specification; not used for the demonstrations | checked |
| FAA aviation maintenance handbooks | Clear line drawings with callouts, safety notices before the step | The illustration standard's line work and callouts | US government works; cite them | practice |
| Public manuals of Airbus, Boeing, ATR, and Garmin | Effectivity, warnings, illustrated parts lists, revision bars | Front matter and change marking in the ARF-1 publications | Restricted maintenance data is never used; only public documents are studied | practice |
| IEC/IEEE 82079-1:2019 | Information for use: target audience, safety information, structure, consistency | The industrial profile | Current edition 2019; a third edition is in development | checked |
| ISO 20607:2019; Siemens, Schneider Electric, and ABB manuals | Machinery instruction handbooks: identification, intended use, maintenance, safety | The structure of maintenance procedures and inspection records | Their manuals and drawings are theirs | practice |

## Authoring and publishing tools

| Source | What it does well | What I adapted | Limits | Read |
|---|---|---|---|---|
| OASIS DITA 1.3 and DITA Open Toolkit | Topics, maps, keys, conditions; HTML5 and PDF from one source | The DITA Studio and the published DITA samples | DITA-OT's default PDF needs a custom plug-in to look designed | practice |
| PTC Arbortext, Adobe FrameMaker, MadCap Flare, Oxygen XML | Structured authoring, single sourcing, conditional content, validation as you write | The workbench's conditions and the S1000D editor's live checks | Commercial tools; named as examples, not endorsements | practice |
| CSDB and IETP products | Issue control, relationships, applicability filtering | The CSDB and IETM demonstrations | No product is claimed to be matched | earlier |

## Video and accessibility

| Source | What it does well | What I adapted | Limits | Read |
|---|---|---|---|---|
| W3C WAI, Making Audio and Video Media Accessible | Captions, description, transcripts, descriptive transcripts, accessible players | The [video standard](/standards/video) | Guidance; WCAG states the requirements | checked |
| WCAG 2.2 | Testable requirements: captions (1.2.2), audio description (1.2.5), non-text contrast (1.4.11), target size (2.5.8) | Every page, film, and annotation is checked against level AA | A checker finds some failures; a person checks the rest | practice |
