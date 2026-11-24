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
