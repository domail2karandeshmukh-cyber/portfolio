---
title: House standards
description: The standards every document, screenshot, drawing, publication and film on this site follows, with the sources each one rests on.
---
# House standards

These standards say how I write, annotate, illustrate, publish, and film technical documentation. Each one names its sources, separates what a published standard requires from what is my own house preference, and is kept in the site's repository, so every change has a date and a reason.

| Standard | What it covers | Rests on |
|---|---|---|
| [Editorial standard](/standards/editorial) | Style, structure, and terminology, with a profile for each kind of documentation | Microsoft Writing Style Guide, Google developer documentation style guide, Diátaxis, IEC/IEEE 82079-1, S1000D, and ASD-STE100 |
| [Screenshot standard](/standards/screenshots) | Capture, cropping, green annotations, numbered callouts, and redaction | My own published guides, measured; Google's image guidance; WCAG 2.2 |
| [Illustration standard](/standards/illustration) | Engineering line drawings, callouts, figure titles, and diagram notation | Technical-illustration practice, S1000D ICN rules, the C4 model, and UML |
| [Publishing standard](/standards/publishing) | Page layout, front matter, contents, numbering, and PDF checks | IEC/IEEE 82079-1, S1000D front matter, PDF/UA practice |
| [Video standard](/standards/video) | Scripts, recording, annotation, zoom, narration, captions, and checks | W3C WAI media guidance, WCAG 2.2 |
| [Design system](/standards/design) | The site's tokens, type, components, icons, and motion, with the research behind each decision | Nielsen Norman Group, WCAG 2.2, Apple's design guidance, Carbon, GitHub Docs, and the Microsoft Writing Style Guide |
| [Benchmark](/standards/benchmark) | What I studied, what I adapted from it, and what I may not copy | The sources above and the documentation they describe |

The [style guide](/style) is the editorial standard's software profile as rules a program can check: every document in the library is checked against it on every build.

## How the standards are used

1. A document's kind decides its profile: a how-to guide for a web application uses the software profile; a maintenance procedure uses the industrial or aerospace profile.
2. The profile decides the structure, the words, and the visuals: a software screenshot gets green annotations; an engineering drawing stays in black line work with item numbers.
3. Automated checks run first: the style check, schema and business-rule validation, link checks, layout checks, and accessibility checks. A person reviews what programs can't judge.
4. Each published file is checked as published: every PDF page rendered, every film watched with its captions on.

## Version

Version 10.1, November 2026: the design system is new. The previous rules are in the repository history.
