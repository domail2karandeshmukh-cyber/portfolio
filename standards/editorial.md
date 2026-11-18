---
title: Editorial standard
description: How I write technical documentation, with a profile for software and IT, cybersecurity, AI and data science, aerospace, and industrial engineering.
---
# Editorial standard

One set of rules can't serve a SaaS help center and an aircraft maintenance procedure. This standard has common rules that every document follows, then a profile for each kind of documentation. A profile names the published standards it rests on, and says where my house rules add to them.

## Precedence

When two sources disagree, the first one in this order wins:

1. A specification the deliverable must meet, such as S1000D and its project business rules, or a customer's style guide.
2. The profile for the document's domain, below.
3. The Microsoft Writing Style Guide.
4. The Google developer documentation style guide.
5. A current dictionary: Merriam-Webster for US English.

S1000D defines structure, not language: it says what a data module contains, not how its sentences read. For the sentences of aerospace procedures, the profile uses ASD-STE100.

## Common rules

### Language

- Write in US English, in the second person, in the active voice, and in the present tense.
- Use contractions in software documentation ("don't", "it's"). Don't use them in aerospace and industrial procedures.
- Use plain words: "use", not "utilize"; "about", not "approximately", unless a value is approximate by definition.
- Write "for example", not "e.g."; "that is", not "i.e."; and avoid "etc.".
- Don't write "please", "simply", "just" or "easy".

### Capitalization

Use sentence case for titles, headings, table headers, figure captions, and button names that I write: capitalize the first word, proper nouns, and the first word after a colon.

| Right | Wrong |
|---|---|
| Configure the application settings | Configure The Application Settings |
| Troubleshooting: Device enrollment fails | troubleshooting: device enrollment fails |
| Install the Okta Verify app | Install The Okta Verify App |

Product and feature names keep their official capitalization: Okta Verify, Google Workspace, S1000D, ASD-STE100, macOS. Interface labels match the interface exactly, even when the interface uses title case.

### Headings

- One H1, the document's title. Don't skip levels.
- A task heading starts with a verb: "Install the agent". A concept heading is a noun phrase: "How fault isolation works".
- Headings at the same level are parallel: all verbs, or all nouns.
- Don't number headings in software documentation. Aerospace and industrial publications number them when the publication's specification does.

### Procedures

1. Introduce a procedure with a sentence that adds something the heading doesn't say, ending with a colon.
2. Number the steps. A procedure with one step is a bullet or a sentence, not a list of one.
3. Put one action in each step. Two short actions in the same place in the interface can share a step.
4. Say where before what: "On the **Security** tab, select **Enable MFA**."
5. Start each step with an imperative verb, end it with a period, and bold the interface labels.
6. Put the result after the action, in the same step, without bold: "The **Users** page opens."
7. Use lowercase letters for sub-steps (a, b, c) and lowercase Roman numerals for a third level. Don't go deeper.
8. Begin an optional step with "Optional:".
9. End with the result the reader can check: "Confirm the **Welcome** page opens."

Use "select" for buttons, links, menu items, tabs, and options, whatever the input device. Use "enter" for typing into a field, "turn on" and "turn off" for switches, and "clear" for check boxes. Write a menu path with spaced angle brackets that aren't bold: **File** > **Export** > **PDF**.

### Lists

- Use a numbered list for a sequence, a bulleted list for a set.
- Introduce a list with a complete sentence or a phrase that ends with a colon.
- Keep the items parallel. End every item with a period if any item is a complete sentence; otherwise use no end punctuation.
- Don't put a single item in a list.

### Notices

A notice comes before the step it concerns, never after it. Use the signal words of the profile, and say what happens and how to avoid it.

| Notice | Software and IT | Industrial and aerospace |
|---|---|---|
| Danger of injury or death | Not used | **WARNING** (and **DANGER** where ANSI Z535 applies) |
| Damage to equipment or data | **Caution** | **CAUTION** |
| Information that helps | **Note** | **NOTE** |
| An action the reader must not miss | **Important** | Not used: use a step |

### Terms, acronyms and units

- Define a term the first time it appears, and use the same term every time after. Keep a glossary for a document set.
- Spell out an acronym at its first use, unless the reader knows it better as an acronym (PDF, URL, API).
- Write numbers as numerals with a space before the unit: 4.2 bar, 30 Nm, 5 MB. Use SI units in engineering documents, with the unit symbol, not a word.
- Write dates in full in text (18 November 2026) and in ISO 8601 in data and logs (2026-11-18T14:05:00Z).

### Code, tables and figures

- Set file names, commands, paths, values, and code in the code font. Every code example must run as shown, or say what to replace.
- Use a table when the reader compares or looks something up: parameters, error messages, specifications, parts. Give every table a header row. Don't use a table for layout.
- Number figures and tables in documents longer than one page: "Figure 3. The Admin menu in the Okta dashboard." Refer to a figure by its number, not by "above" or "below".
- Give every informative image alternative text that says what it shows; give decorative images empty alternative text.

## Profiles

### Software, SaaS and enterprise IT

Rests on: the Microsoft Writing Style Guide, then Google's developer documentation style guide.

- Document kinds come from Diátaxis: a tutorial teaches, a how-to guide solves one problem, a reference describes, an explanation helps the reader understand.
- A how-to guide has a task title, one sentence of purpose, prerequisites when there are any, numbered steps with annotated screenshots where a control is hard to find, the expected result, and troubleshooting when a step commonly fails.
- Screenshots follow the [screenshot standard](/standards/screenshots): green annotations, solid redaction, alternative text.

Where Microsoft and Google differ.

| Question | Microsoft | Google | House |
|---|---|---|---|
| Verb for interface elements | select | click (for clickable elements) | select |
| Optional steps | No rule on its procedures page | Begin with "Optional:" | Begin with "Optional:" |
| Menu paths | Spaced angle brackets, not bold | Bold path with angle brackets | Microsoft: **File** > **Save** |
| Screenshot in a procedure | No rule on its procedures page | Use one when an element is hard to find | Use one when it helps a reader find the control |

### API and developer documentation

Rests on: the software profile, and the OpenAPI Specification (3.2.0 is current; the API descriptions here use 3.1 or later).

- A reference page for an endpoint gives the method and path, what it does, authentication, and permissions, path and query parameters, the request body, a request example, the response schema, a response example, errors, and rate limits and pagination where they apply.
- Every example is a real request against a real API, with secrets replaced by named placeholders such as `$API_TOKEN`.
- A sequence diagram sits beside the description of a flow that crosses systems.

### Cybersecurity

Rests on: the software profile; NIST SP 800-61 Rev. 3 for incident response; MITRE ATT&CK for adversary techniques.

- A runbook has a purpose, scope, roles, trigger conditions, severity, investigation steps with decision points, evidence to collect, escalation, containment, recovery, verification, closure, and its revision history.
- Name techniques by their ATT&CK ID and name: T1110.001, Password Guessing.
- Use severity colors and labels only for real severity, defined in the document.
- Write timestamps in UTC. Defang indicators in text: `hxxps://example[.]com`.
- Never show a real secret, token, internal host name, or personal detail; use reserved names such as `example.com` and documentation IP ranges such as `192.0.2.0/24`.

### AI and data science

Rests on: model cards (Mitchell et al., 2019), datasheets for datasets (Gebru et al.), and the model and dataset cards of Hugging Face.

- A model card has the model's purpose and intended use, out-of-scope uses, the training data, the evaluation data, the metrics with the decision threshold, results by relevant group, limitations, and ethical considerations.
- A dataset card has the source and licence, collection, preprocessing, splits, known biases, and how to cite it.
- Report only measured results, with the data split, the random seed, and the software versions that produced them. Label simulated data as simulated.
- A report on an experiment gives the objective, architecture, dataset, method, configuration, training, evaluation, reproducibility, results, limitations and responsible use.

### Aerospace

Rests on: S1000D Issue 6 and the project's business rules (BREX) for structure; ASD-STE100 Issue 9 for the language of procedures and descriptions; ATA iSpec 2200 for civil-aviation chapter numbering where a project uses it.

- A procedure is a data module with preliminary requirements (conditions, personnel, support equipment, supplies, spares, safety), the steps, and close-up requirements.
- Warnings and cautions are separate elements, placed before the step they apply to, and referenced from the steps.
- Write procedural sentences of 20 words or fewer and descriptive sentences of 25 or fewer, one instruction to a sentence, in the imperative, as ASD-STE100 requires. Use the dictionary's approved words, and technical names and verbs as the project allows.
- Don't translate a controlled-English text and call the translation ASD-STE100: the standard applies to English.
- Illustrations follow the [illustration standard](/standards/illustration): line work, item numbers, ICN names.

### Industrial and automotive engineering

Rests on: IEC/IEEE 82079-1:2019 (information for use); ISO 20607:2019 for the instruction handbooks of machinery; ANSI Z535.6 for safety messages where the market requires it.

- An instruction identifies the product and its version, says who it's for, and gives safety information before the step it applies to.
- A maintenance procedure has its purpose, the interval, safety, and lock-out conditions, tools, and materials, numbered steps with the expected reading or result in each, acceptance criteria, and how to record the result.
- An inspection record is a form: what was checked, the expected value, the measured value, pass, or fail, who checked it and when.
- A test report gives its objective, scope, method, results in a table, analysis, limitations, conclusions and recommendations. Its numbers must agree with each other in every section.

## Document structures

| Document | Sections, in order |
|---|---|
| How-to guide | Title, purpose, prerequisites, steps, result, troubleshooting, related |
| User guide | Title, product, and version, audience, overview, contents, getting started, tasks, reference, troubleshooting, glossary |
| Installation guide | Requirements, prerequisites, dependencies, installation, configuration, verification, troubleshooting, upgrade, or removal |
| API reference | Overview, authentication, base URL, permissions, endpoints (method, path, parameters, examples, schemas, errors), limits, pagination |
| Runbook | Purpose, scope, roles, triggers, severity, investigation, decisions, evidence, escalation, containment, recovery, verification, closure, revisions |
| Release notes | Version and date, highlights, new, changed, fixed, known issues, upgrade steps |
| Knowledge-base article | Problem in the reader's words, cause, solution steps, result, related articles |
| Technical report | Title, objective, scope, method, results, tables, and figures, analysis, limitations, conclusions, recommendations, references |
| Maintenance procedure | Identification, applicability, preliminary requirements, safety, steps, inspection criteria, close-up, record |
| Illustrated parts catalogue | Identification, applicability, illustration, item numbers, parts table (part number, name, quantity, applicability) |
| Engineering change record | Change number, reason, affected items, impact on each document, approvals, effective serial numbers |

A short help article doesn't need a title page, a contents list, or a revision history; a controlled publication does. The [publishing standard](/standards/publishing) says when.

## Checks

Programs check what they can: the [style guide](/style) rules on every build, headings, and lists, links, schemas and business rules, alternative text, and the layout of every page at eight screen widths. A person checks the rest: that the steps work, that the words are the right ones, and that the document answers its reader's question. A clean check isn't an approval.
