---
title: Video standard
description: How I script, record, annotate, narrate, caption and check instructional videos.
---
# Video standard

An instructional video teaches one task. It shows the real application, says what to do as it happens, and can be followed with the sound off.

## What accessibility requires, and what is house preference

| Requirement | Source | Status |
|---|---|---|
| Captions for prerecorded audio | WCAG 2.2, success criterion 1.2.2 (level A) | Required |
| Audio description, or a text alternative, for prerecorded video | WCAG 2.2, 1.2.3 (A) and 1.2.5 (AA) | Required: the narration describes what happens on screen, and a transcript is published with each film |
| A transcript | W3C WAI, Making Audio and Video Media Accessible | Recommended; provided |
| Player controls that work with a keyboard, with visible focus | WCAG 2.2, 2.1.1 and 2.4.7 | Required |
| No flashing more than three times a second | WCAG 2.2, 2.3.1 | Required |
| Captions shown as a track the viewer can turn off | House | Captions are a WebVTT and SRT track, not burnt into the picture |
| 1920 × 1080, 30 frames a second, H.264 video, AAC audio at 48 kHz | House | Target |
| Loudness about −16 LUFS integrated, true peak −1 dBTP or lower | House | Target for speech heard on laptops and phones |
| Narration at 130 to 160 words a minute | House | Target |

The house targets are my production choices, not documentation standards.

## Script

Write the script before recording. It has the title, the objective in one sentence, the prerequisites, the steps in order, each step's narration, any caution, the result to expect, and where to read more. Each sentence of narration names the control it's about, so the action can be timed to the words.

## Recording

- Record the real application at its documented version, at 1920 × 1080, in a clean browser profile at 100 percent zoom.
- Use sample data with reserved names (example.com, 192.0.2.10). No notifications, no other windows, nothing personal.
- Move the pointer only to act. Each click lands while its control is being named.

## Annotation and zoom

- Use the [screenshot standard](/standards/screenshots), scaled by 1.5 for 1080p: a 4.5 px rectangle, a 36 px callout.
- Show a click with a short ring that fades in about 0.4 seconds; keep the pointer's halo small.
- Zoom to between 125 and 175 percent, and only to make small text readable. Zoom in and out over about 0.6 seconds, and keep the surrounding context in view.
- No decorative transitions. A cut, or a short cross-fade between sections.

## Narration and captions

- The narration is a synthetic voice, and each page says so.
- Captions are written from the script, timed to the recording, and checked by listening.
- A caption has at most two lines of about 42 characters, stays on screen for 1 to 7 seconds, and breaks at a phrase boundary.
- Captions don't cover the controls being used; on a film with a caption bar, the picture leaves room for it.

## Checks before publication

1. ffprobe: resolution, frame rate, codecs, sample rate, and duration as specified.
2. Loudness and true peak measured with the EBU R128 filter.
3. The film watched from start to end with captions on: every action timed to its words, every annotation on its control, no caption over a control.
4. Captions validated as WebVTT, and the SRT copy checked against them.
5. Playback checked on a desktop browser and a phone.
6. Transcript published beside the film.
