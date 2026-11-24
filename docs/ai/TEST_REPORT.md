# Test report

Record what ran, where, and the result. Leave a gap rather than estimate a number.

## Baseline, 2026-11-25

`main` at `aed83e5`, in Claude's cloud workspace (Linux, Node 22.23.5, npm 10.9.9, Python 3.13.18, Google Chrome with Playwright). Local build served at `http://localhost:8765`.

| Command | Exit | Result |
|---|---|---|
| `npm ci` | 0 | 72 packages installed |
| `npm run build` | 0 | 211 pages in 5 languages; `index.html` 73 KB, `site.css` 101 KB, `app.js` 68 KB; style check 23 of 23 documents pass |
| `node scripts/selftest.mjs` | 0 | 252 checks passed (DITA validation skipped: `DITA_CATALOG` not set) |
| `node scripts/check-links.mjs` | 1 | 19,085 links inside the site all lead somewhere. Of 79 links to other sites, 59 answered and 20 failed with `ENOTFOUND`: the workspace's network blocks those hosts, so this is not evidence of broken links |
| `python3 tests/journeys.py` | 0 | 44 passed, 0 failed (19 visitor journeys, phone and desktop), no script error |
| `python3 tests/matrix.py` | 0 | 181 page views at 10 sizes, portrait and landscape: 181 clean |

Not run: Lighthouse and Core Web Vitals, `scripts/check-a11y.py`, `tests/studio/run.py`, `tests/webkit_smoke.py`, `scripts/check-live.py`. Screenshots from the matrix run stayed in the cloud workspace and are not in the repository.

## Hero prototype, 2026-11-25

`ai/portfolio-hero-claude`, same workspace as the baseline, local build at `http://localhost:8765`.

| Command | Exit | Result |
|---|---|---|
| `npm run build` | 0 | 211 pages in 5 languages; `index.html` 73 KB and `app.js` 68 KB, as in the baseline; `hero3d.js` 5.9 KB |
| `node scripts/selftest.mjs` | 0 | 252 checks passed |
| `node scripts/check-links.mjs` | 1 | 19,090 links inside the site all lead somewhere. Links to other sites: 20 `ENOTFOUND` (blocked hosts, as in the baseline), 20 `HTTP 404` on GitHub links to this branch, which was not pushed when the check ran, and 1 `HTTP 503` |
| `python3 tests/journeys.py` | 0 | 44 passed, 0 failed |
| `python3 tests/matrix.py` | 0 | 181 page views, 181 clean |

Checked by hand in Google Chrome with Playwright:

| Case | Result |
|---|---|
| 1,440 pixels, English and French | 3D on, no script error, the document no wider than the window |
| 1,080 pixels | 3D on, the document no wider than the window |
| 1,440 pixels with reduced motion | Script does nothing; the hero is the baseline's |
| 390 pixels, touch | Script does nothing |

Not run: Lighthouse and Core Web Vitals, `scripts/check-a11y.py`, the studio tests, WebKit, Firefox, a real phone.

## 3D parts view, 2026-11-25

`ai/portfolio-arf3d-claude`, same workspace, local build at `http://localhost:8765`. Headless Chrome drew WebGL in software (SwiftShader).

| Command | Exit | Result |
|---|---|---|
| `npm run build` | 0 | 211 pages in 5 languages; no untranslated Studio piece; `studio/arf3d.js` 552 KB (139 KB gzipped) |
| `node scripts/selftest.mjs` | 0 | 252 checks passed |
| `python3 tests/studio/test_ipc3d.py` (new) | 0 | 26 passed: loads on demand, selection both ways, drag and arrow keys, zoom, French, phone, no-WebGL fallback |
| `python3 tests/studio/test_i18n.py` | 0 | 128 passed |
| `python3 tests/studio/test_aero.py` | 1 | 105 passed, 1 failed: "Watch it in the film plays the IETM part of the film". The same check fails on the baseline build in this workspace, so it is the workspace's video playback, not this change |
| `python3 tests/journeys.py` | 0 | 44 passed |
| `python3 tests/matrix.py` | 0 | 181 page views, 181 clean |

Not run: the other Studio tests, `scripts/check-links.mjs`, `scripts/check-a11y.py`, Lighthouse, a real GPU, WebKit, Firefox, a real phone.
