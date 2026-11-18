#!/usr/bin/env python3
"""Merges the two runs of scripts/aero/validate.py into content/aerospace/validation.json, which the site shows:
the build check in GitHub Actions (official S1000D Issue 6 schemas, fetched there) and a local run with the S1000D
default BREX for Issue 6 (from s1kd-tools; not redistributed). Both must have checked the same files, byte for byte.

    python3 -I scripts/aero/report.py CI.json LOCAL.json
"""
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
ci, local = (json.load(open(p)) for p in sys.argv[1:3])
if ci["sha256"] != local["sha256"]:
    sys.exit("report: the two runs checked different files; run both on the same commit")
layers = ["wellformed", "schema", "ident", "refs", "applic", "brex", "default-brex"]
results = {}
for f in ci["results"]:
    row = {}
    for layer in layers:
        found = [x for x in ci["results"][f] + local["results"].get(f, []) if x["layer"] == layer]
        if found:
            row[layer] = "fail" if any(x["level"] == "error" for x in found) else "warn" if any(x["level"] == "warning" for x in found) else "pass"
    results[f] = row
out = {
    "checked": ci["checked"], "issue": ci["issue"], "libxml2": ci["libxml2"], "schemas": ci["schemas"],
    "schemaRun": isinstance(ci["schemas"], dict), "defaultBrexRun": local.get("defaultBrex", "").endswith("(applied)"),
    "defaultBrex": local.get("defaultBrex"), "localChecked": local["checked"],
    "errors": ci["errors"] + local["errors"], "warnings": ci["warnings"] + local["warnings"],
    "sha256": ci["sha256"], "results": results,
}
with open(os.path.join(ROOT, "content", "aerospace", "validation.json"), "w", encoding="utf-8") as fh:
    json.dump(out, fh, indent=1)
print(f"report: {len(results)} files, {out['errors']} error(s), schema layer {'on' if out['schemaRun'] else 'off'}, default BREX {'on' if out['defaultBrexRun'] else 'off'}")
