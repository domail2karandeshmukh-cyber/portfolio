// The style checker, from the command line.
//
//   node scripts/style.mjs check docs/guide.md README.md        findings, one per line
//   node scripts/style.mjs check --rule serial-comma *.md       one rule only
//   node scripts/style.mjs fix docs/guide.md                    apply, in place, the fixes that are safe to apply unseen
//   node scripts/style.mjs fix --rules step-period,input-neutral docs/guide.md   apply the fixes of those rules only
//
// The rules are in src/style.js. The same file checks the library when the site is built, and runs in the workbench.
import fs from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const Style = require("../src/style.js");

const [mode, ...rest] = process.argv.slice(2);
const opt = (name) => { const i = rest.indexOf("--" + name); return i < 0 ? null : rest.splice(i, 2)[1]; };
const rule = opt("rule"), rules = (opt("rules") || "").split(",").filter(Boolean), terms = (opt("terms") || "").split(",").filter(Boolean);
if (!["check", "fix"].includes(mode) || !rest.length) { console.error("usage: style.mjs check|fix [--rule id] [--rules a,b] [--terms Name,Other] files"); process.exit(2); }

let failed = 0;
for (const file of rest) {
  let source = fs.readFileSync(file, "utf8");
  if (mode === "fix") {
    const out = Style.fixAll(source, rules.length ? rules : Style.AUTO, { terms, vars: false });
    if (out.fixed) fs.writeFileSync(file, out.source);
    console.log(`${file}: ${out.fixed} fixed`);
    continue;
  }
  const found = Style.check(source, { terms, vars: false }).filter((f) => !rule || f.rule === rule), sum = Style.summary(found), lines = source.split("\n");
  if (!sum.passes) failed++;
  console.log(`${file}: ${sum.error} errors, ${sum.warning} warnings, ${sum.suggestion} suggestions`);
  for (const f of found) console.log(`  ${String(f.line).padStart(4)}  ${f.level.padEnd(10)} ${f.rule.padEnd(19)} ${f.message}${rule ? "\n        | " + (lines[f.line - 1] || "").trim().slice(0, 150) : ""}`);
}
process.exit(failed ? 1 : 0);
