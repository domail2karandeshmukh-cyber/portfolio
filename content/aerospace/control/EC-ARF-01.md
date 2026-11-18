---
id: EC-ARF-01
title: "Engineering change record EC-ARF-01: quick-release fan latches (Modification M01)"
type: change record
version: 1.0
status: Draft
author: Karan Deshmukh
owner: ARF-1 publications (fictional)
reviewer: Technical reviewer (fictional role)
date: 2026-11-16
---

# Engineering change record EC-ARF-01: quick-release fan latches (Modification M01)

This record describes a fictional engineering change to the fictional ARF-1 training rig, and the documentation it changed. It starts as a draft so that you can take it through review and approval in Document Control. The names in the review are typed in your browser; they are not signed or verified identities.

## Reason for change

Students removed and installed the fan assembly many times a week. The four mounting screws wore the threads in the frame. Modification M01 replaces the screws and washers with two quick-release latches on two brackets, so the fan assembly comes off without tools.

## Affected data

| Item | Code | Before | After | What changed |
|---|---|---|---|---|
| Description | DMC-ARFRIG-A-00-00-00-00A-040A-D | Issue 001 | Issue 002 | The fan assembly paragraph has a version before and after M01; a technical-data row is added. |
| Remove procedure | DMC-ARFRIG-A-20-00-00-00A-520A-A | Issue 001 | Issue 002 | The step that releases the fan assembly depends on the modification status. |
| Install procedure | DMC-ARFRIG-A-20-00-00-00A-720A-A | Issue 001 | Issue 002 | Steps to close and lock the latches are added; the torque step applies before M01 only. |
| Illustrated parts data | DMC-ARFRIG-A-00-00-00-00A-941A-D | Issue 001 | Issue 002 | Items 004 (latch) and 005 (bracket) are added; items 002 and 003 apply before M01 only. |
| Parts catalogue view | ICN-0DEMO-ARF0004 | Issue 001 | Issue 002 | Latches and brackets are drawn and numbered. |
| Removal view after M01 | ICN-0DEMO-ARF0005-001-01 | None | Issue 001 | A new illustration of the latch installation. |
| Maintenance publication | PMC-ARFRIG-0DEMO-00001-00 | Issue 001 | Issue 002 | Refers to the new issues of the four data modules. |
| Operator publication | PMC-ARFRIG-0DEMO-00002-00 | Issue 001 | Issue 002 | Refers to issue 002 of the description. |
| Interactive publication | /studio/ietm | Issue 001 content | Issue 002 content | Shows the latch steps for serial numbers 002 and 003 only. |
| Training video | Fan removal walkthrough | Shows screws | To be updated | A new recording must show the latches. Until then, the video applies before M01 only. |

## Effectivity

The conditions cross-reference table (CCT) defines condition M01 with the values pre and post. The product cross-reference table (PCT) records it for each rig:

- Serial number 001, classroom variant: M01 not incorporated (pre).
- Serial number 002, classroom variant: M01 incorporated (post).
- Serial number 003, workshop variant: M01 incorporated (post).

Each changed step, figure and parts-list item carries an applicability annotation, so a reader sees only what applies to the rig in front of them.

## Verification

1. Validate each changed data module against the official S1000D Issue 6 schema.
2. Check each changed module against the project BREX and the S1000D default BREX.
3. Make sure that every applicability annotation names a property that the ACT or the CCT defines.
4. Compare issue 001 and issue 002 of each module, and make sure that each change is marked and has a reason for update.
5. Do a table-top check of the new steps against the illustration.

## Approval

Technical review, editorial review and safety approval are separate. A program can run the checks in the verification list. It can't approve the change: a qualified person does that.
