"""Runs every studio test in Chrome against a local build, and says which passed.

    node build.mjs && python3 -m http.server 8765 --directory public &
    CHROME=/usr/bin/google-chrome DITA_HOME=/path/to/dita-ot python3 tests/studio/run.py http://localhost:8765

Each test is a script that does what a writer does in one tool: opens two different inputs, edits, saves, reopens,
exports, opens the export and checks what is in it, feeds the tool a bad file, and watches for script errors.
Needs Python with Playwright and Pillow, ffmpeg, Node, and xmllint; the DITA tests need DITA Open Toolkit.
"""
import pathlib, subprocess, sys

HERE = pathlib.Path(__file__).resolve().parent
base = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8765"
failed = []
for test in sorted(HERE.glob("test_*.py")):
    r = subprocess.run([sys.executable, str(test), base], capture_output=True, text=True)
    lines = [l for l in (r.stdout + r.stderr).strip().splitlines() if l]
    print(f"{test.name:18} {lines[-1] if lines else '(no output)'}")
    for l in lines:
        if l.startswith("FAIL"): print("    " + l)
    if r.returncode: failed.append(test.name)
print("all passed" if not failed else f"failed: {', '.join(failed)}")
sys.exit(1 if failed else 0)
