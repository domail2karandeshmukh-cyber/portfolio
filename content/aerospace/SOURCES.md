# Aerospace technical publications: research notes and sources

Research for the aerospace demonstrations at /studio/aerospace, done in November 2026.
Everything below was read from the sources named; nothing was copied from a specification,
a restricted dictionary or a real maintenance publication.

## Issues used

| Standard | Issue used here | Status in November 2026 | Source |
|---|---|---|---|
| S1000D | Issue 6 (1 September 2024) | Issue 7 published 16 July 2026; Issue 6 is the latest issue with ATA civil-aviation business rules (Spec 1000BR_6) | en.wikipedia.org/wiki/S1000D (change history); publications.airlines.org (Spec 1000BR, issues 4.1, 4.2 and 6 supported, 5.0 not) |
| ASD-STE100 | Issue 9 (15 January 2025) | Current issue; a standard since Issue 9 | asd-ste100.org (home page, About STE, FAQ) |
| S-Series IPS | SX000i and the S2000M to S6000T family | ILS is called Integrated Product Support (IPS) in the S-Series | aia-aerospace.org/standards/s-series-ips/ |

Why Issue 6 and not Issue 7: Issue 7 is four months old, and tools and business rules still
catch up (ATA Spec 1000BR exists for Issue 6). Many defence programmes still contract Issue 4.1
or 4.2. The demonstration names its issue on every page.

## Licences and what is not redistributed

- S1000D specifications, schemas and related data are free to download, and their use is
  subject to the S1000D Terms and Conditions (users.s1000d.org). The terms page could not be
  read from here, so a permission to redistribute the schemas was not verified.
  Decision: the official schemas are not copied into this repository, the website or any
  download. They are fetched from www.s1000d.org where validation runs (the CI workflow and
  the site's validation function) and used there only.
- The S1000D default BREX data module for Issue 6 (DMC-S1000D-H-04-10-0301-00A-022A-D) is
  referenced by code, not copied. The code was confirmed in s1kd-tools (open source, GPL),
  which maps Issue 6 data to that BREX.
- ASD-STE100 is free of charge on request and is a copyright and trademark of ASD. The
  dictionary (about 900 approved words) is not reproduced. The checker uses an original
  project word list and rule numbers only as references.
- ASD and the STEMG do not certify tools as fully compliant (asd-ste100.org FAQ). The checker
  says what it checks and what needs a person.

## Facts the demonstrations rely on

S1000D
- Information codes used: 040 Description, 131 Normal operation procedure, 271 Adjust,
  310 Visual examination, 340 Function test, 421 Fault isolation procedure, 520 Remove
  procedure, 720 Install procedure, 941 Illustrated parts data, 022 BREX, 00W ACT, 00Q CCT,
  00P PCT. Names as listed in the s1kd-tools data module type table (updated for Issue 6,
  2024-09-03); the specification (Chap 8.4.1) is the authority.
- BREX object rules: allowedObjectFlag 0 = the object must not exist, 1 = it must exist,
  2 = it may exist, with value rules (s1kd-brexcheck source, is_invalid()).
- Code lists from the Issue 6 default BREX: internalRefTargetType irtt01 figure, irtt02
  table, irtt07 paragraph, irtt08 step, irtt11 hotspot; updateReasonType urt01 editorial,
  urt02 technical, urt04 applicability; securityClassification 01 to 99; skillLevelCode
  sk01 to sk03; pmEntryType pmt01 to pmt..; emphasisType em01 bold.
- Schema locations: http://www.s1000d.org/S1000D_6/xml_schema_flat/<schema>.xsd

ASD-STE100 Issue 9 (rule numbers as listed by TechScribe's term-checker page for Issue 9,
simplified-english.co.uk/rules-ste9.html, and community summaries; check the wording in the
standard itself)
- Part 1 writing rules (9 sections, 53 rules), Part 2 dictionary.
- 1.1 approved words, technical nouns and technical verbs; 1.2 one part of speech;
  1.4 approved verb forms; 1.14 American English spelling; 2.1 noun clusters of three
  nouns at most; 3.5 "-ing" forms only as nouns or modifiers; 3.6 active voice;
  4.2 no contractions or omitted words; 4.5 articles before nouns; 5.1 procedural sentences
  of 20 words at most; 5.2 one instruction per sentence; 5.3 imperative; 5.5 notes give
  information, not instructions; 6.3 descriptive sentences of 25 words at most; 6.6 six
  sentences per paragraph at most; 7.x safety instructions (start with a command or
  condition, say the risk); 8.1 no semicolons; 8.7 a hyphenated word counts as one word.
- Examples published by the STEMG FAQ: "start" not "begin"; "check" is approved only as a
  noun; conditions first ("If hot oil touches your skin, injuries can occur").

Tools (named as examples, not endorsements)
- PTC Arbortext: Editor, Styler, Content Delivery (publishes S1000D), IsoDraw (2D/3D
  illustration from CAD), Creo Illustrate (3D illustration); ptc.com/en/products/arbortext,
  support.ptc.com (Windchill S1000D publishing).
- Oxygen XML Editor: schema-guided S1000D 4.x editing (blog.oxygenxml.com, March 2026).
- CSDB and IETP products: Boeing Spectrum (S1000Dmanager CSDB, S1000Dprism IETP viewer),
  HENSOLDT QuILS (CSDB, Author, HTML Publisher, up to Issue 6), SDL Contenta S1000D,
  SiberSafe S1000D, Flatirons (CORENA) Pinpoint, Rohde & Schwarz IETDView, ONEIL ONeSOURCE.
- STE checkers: Acrolinx STE presets (Issues 6 to 8), HyperSTE, ARDOS, MAXit, TechScribe's
  term checker.
- Open source: s1kd-tools (kibook/s1kd-tools, commit fb42a9f, October 2026).

IETM
- The DoD classes (Class 1 to 5, Tri-Service IETM working group, 1994) are older
  descriptors; S1000D describes an IETP by its functionality matrix instead. The demonstration
  claims no class and no functionality-matrix conformance.

ILS / IPS
- SX000i (IPS), S1000D (technical publications), S2000M (material management), S3000L
  (logistics support analysis), S4000P (preventive maintenance), S5000F (in-service
  feedback), S6000T (training analysis and design), SX001G glossary, SX002D common data
  model.
