---
type: reference
id: MR-PS104-01
owner: Maintenance planning
author: Karan Deshmukh
reviewer: Reliability engineer
version: 1.1
status: Approved
date: 2026-09-22
vars:
  asset: feed pump B
  tag: PS-104
---
# Monthly inspection record for {{asset}}

The record a technician completes during the monthly inspection of {{asset}}, tag {{tag}}, under procedure MP-PS104-01. The maintenance console fills the first table from the work order; the technician fills the rest. A record is complete when every field has a value or the entry **Not applicable**, and the supervisor has signed it. Fictional sample written for this portfolio: it isn't a record for real equipment.

## Work order

| Field | Value |
|---|---|
| Work order | From the console |
| Asset | {{asset}}, tag {{tag}} |
| Location | Pump room 2, east bay |
| Procedure | MP-PS104-01, version 0.3 |
| Scheduled date | From the console |
| Technician | Name and badge number |
| Shift | Day or night |

## Conditions at the start

| Field | Value | Unit |
|---|---|---|
| Pump running at normal load | Yes or no | |
| Ambient temperature in the pump room | | °C |
| Running hours since the last inspection | From the console | h |
| Alarms active on the console | None, or list them | |

## Readings

Take each reading as the procedure describes, and enter it before you take the next one. Enter the value you read, not the value you expect.

| Check | Reading | Unit | Expected | Inside range |
|---|---|---|---|---|
| Discharge pressure | | bar | 3.8 to 4.6 | Yes or no |
| Bearing temperature, drive end | | °C | Below 70 | Yes or no |
| Vibration, drive-end bearing housing | | mm/s | Below 4.5 | Yes or no |
| Seal leakage | None, drip, or stream | | None visible | Yes or no |

## Observations

| Item | Finding |
|---|---|
| Unusual noise | None, or describe it |
| Coupling guard in place and secure | Yes or no |
| Base bolts tight, no visible movement | Yes or no |
| Oil level in the sight glass | Low, normal, or high |
| Corrosion or paint damage | None, or describe it |

## Outcome

| Field | Value |
|---|---|
| All readings inside range | Yes or no |
| Work order closed | Yes or no |
| Reported to the shift supervisor | Not needed, or the time and the reading reported |
| Follow-up work order raised | None, or its number |

## Sign-off

| Role | Name | Date | Signature |
|---|---|---|---|
| Technician | | | |
| Shift supervisor | | | |

## Retention

The console keeps the record with the work order for the life of the asset. A paper copy, if one is used, goes to the maintenance office at the end of the shift and is scanned within a week.
