---
type: how-to
id: EP-TR2-004
owner: Test engineering
version: 0.4
status: Draft
vars:
  rig: Test Rig TR-2
---
# Calibrate the Pressure Sensor on {{rig}}

Engineering procedure for the test lab. Run it before each test campaign, and after you replace any sensor. Fictional sample: don't use it on real equipment.

## Before You Start

- You've stopped the rig, and the line is at atmospheric pressure.
- The reference gauge has a valid calibration certificate.
- You have the calibration sheet for the campaign.

> **Caution:** Don't open the sensor housing. Calibration uses the console only.

## Steps

1. On the rig console, open **Sensors**, and then select the pressure sensor.
2. Select **Calibrate**, and then select **Zero**.
3. Apply the first test pressure with the hand pump, and then wait until the reading is stable.
4. Enter the value from the reference gauge in **Reference**, and then select **Record**.
5. Repeat the last two steps for each pressure on the calibration sheet.
6. Select **Finish**, and then write the result on the calibration sheet.

## Check That It Worked

Each reading is within 0.5 % of the reference gauge, and the console shows **Calibrated** with today's date.

## If a Reading Is Out of Tolerance

Stop the procedure, tag the sensor as out of service, and tell the lab supervisor.
