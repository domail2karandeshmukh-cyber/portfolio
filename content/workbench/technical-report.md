---
type: concept
id: TR-2026-07
owner: Reliability engineering
version: 1.1
status: Published
---
# Test Report: Seal Leakage on Feed Pump B

A six-week test on a fictional pump: three weeks before a repair and three weeks after it. Written for this portfolio: I invented the pump, the readings, and the people.

## Summary

The mechanical seal on feed pump B leaked in two of the three weekly inspections before the repair, and in none of the three after it. The repair replaced the seal and the shaft sleeve together. The leak came from the worn shaft sleeve, not from the seal: the old seal's faces were in good condition, and the sleeve had score marks under the seal's O-ring.

## Objective

Find the cause of the seal leak on feed pump B, and confirm that the repair stopped it.

## Scope

Feed pump B, tag PS-104, for six weeks in 2026. The other pumps of the same type weren't part of the test.

## Method

1. Each week, the technician did the monthly inspection procedure MP-PS104-01 and recorded the discharge pressure, the bearing temperature, the vibration at the drive-end bearing housing, and any visible leak.
2. After the third inspection, the maintenance team replaced the seal and the shaft sleeve, and examined both old parts.
3. The technician did the same inspection for three more weeks.

## Results

All readings come from the inspection records for weeks 1 to 6. The limits are the ones in procedure MP-PS104-01.

| Week | Repair | Leak seen | Vibration (mm/s) | Bearing temperature (°C) | Discharge pressure (bar) |
|---|---|---|---|---|---|
| 1 | Before | No | 2.8 | 58 | 4.2 |
| 2 | Before | Yes | 3.6 | 61 | 4.1 |
| 3 | Before | Yes | 4.1 | 63 | 4.0 |
| 4 | After | No | 2.7 | 57 | 4.2 |
| 5 | After | No | 2.6 | 57 | 4.3 |
| 6 | After | No | 2.7 | 58 | 4.2 |
| Limit | | None visible | Below 4.5 | Below 70 | 3.8 to 4.6 |

The examination of the old parts found:

- The seal faces were flat and evenly worn, within the seal maker's limits.
- The shaft sleeve had a scored band about 2 mm wide under the seal's O-ring.

## Analysis

The leak appeared in week 2 and continued in week 3 while every other reading stayed inside its limit. A scored sleeve lets liquid pass under the O-ring that seals the rotating seal face to the sleeve, so the seal leaks although its faces are good. A new seal on the old sleeve would have leaked again.

Vibration rose from 2.8 to 4.1 mm/s in the same three weeks, close to the 4.5 mm/s limit. After the repair, it fell to between 2.6 and 2.7 mm/s. This test can't tell whether the vibration wore the sleeve or the worn sleeve raised the vibration.

## Limitations

- One pump, with three readings before the repair and three after it.
- Weekly readings can miss a leak that comes and goes between inspections.
- The technician measured vibration at one point, as an overall value, without a frequency analysis.

## Conclusions

1. A scored shaft sleeve caused the leak, not a worn seal.
2. Replacing the seal and the sleeve together stopped the leak for the three weeks after the repair.

## Recommendations

1. At the next overhaul of each pump of this type, replace the shaft sleeve with the seal.
2. Add a vibration trend to the monthly inspection. When the reading rises more than 1 mm/s above the pump's baseline, inspect the seal before the reading reaches the 4.5 mm/s limit.

## References

- Procedure MP-PS104-01, monthly inspection of feed pump B.
- Inspection records MR-PS104-01 for weeks 1 to 6.
