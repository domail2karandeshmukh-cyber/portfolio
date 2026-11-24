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

## Sign-in flows page, 2026-11-25

`ai/portfolio-flows-claude`, same workspace, local build at `http://localhost:8765`.

| Command | Exit | Result |
|---|---|---|
| `npm run build` | 0 | 212 pages in 5 languages (one more than the baseline) |
| `node scripts/selftest.mjs` | 0 | 252 checks passed |
| `python3 tests/flows.py` (new) | 0 | 40 passed: whole without a script, stepping in all four flows, the diagram follows, a link to a step, the keyboard, a phone, the PKCE hash, and axe-core's WCAG 2.0 to 2.2 A and AA rules with no finding in two states |
| `python3 tests/journeys.py` | 0 | 44 passed |
| `python3 tests/matrix.py` | 0 | 181 page views, 181 clean |
| `node scripts/check-links.mjs` | 1 | 19,187 links inside the site all lead somewhere. Links to other sites: 26 `ENOTFOUND` (blocked hosts, among them the page's six links to the specifications) and 21 `HTTP 404` on GitHub links to this branch before it was pushed |

Not run: the Studio tests other than those listed for the 3D view, `scripts/check-a11y.py` on the whole site, Lighthouse, WebKit, Firefox, a real phone.

## KC1 API explorer, 2026-11-25

`ai/portfolio-explorer-claude`, same workspace, local build at `http://localhost:8765`.

| Command | Exit | Result |
|---|---|---|
| `npm run build` | 0 | 213 pages in 5 languages (two more than the baseline) |
| `node scripts/selftest.mjs` | 0 | 252 checks passed |
| `python3 tests/explorer.py` (new) | 0 | 21 passed: every exchange shows its recorded status and answer, opens without a script, the filters, a link to an exchange, no request to another host, a phone, and axe-core with no finding |
| `python3 tests/flows.py` | 0 | 40 passed |
| `python3 tests/journeys.py` | 0 | 44 passed |
| `python3 tests/matrix.py` | 0 | 181 page views, 181 clean |
| `node scripts/check-links.mjs` | 1 | 19,309 links inside the site all lead somewhere. Links to other sites: 26 `ENOTFOUND` (blocked hosts) and 21 `HTTP 404` on GitHub links to this branch before it was pushed |

`tests/explorer.py` failed once on "every control is a 44-pixel target" on a phone, then passed on three runs after the test was given 500 ms for the layout to settle. Watch that check.

Not run: the Studio tests, `scripts/check-a11y.py` on the whole site, Lighthouse, WebKit, Firefox, a real phone.
