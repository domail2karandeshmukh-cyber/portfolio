// Checks the document model and the style checker against the workbench's own starting documents.
//
//   node scripts/selftest.mjs
//   DITA_CATALOG=/path/to/dita-1.3/catalog.xml node scripts/selftest.mjs     also validates the DITA output with xmllint
//
// Every template has to pass the style check, for every reader it can be published for.
// The first draft has to fail it, and has to pass once the automatic fixes are applied.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync, execFileSync } from "node:child_process";
import { createRequire } from "node:module";
// libxml2 2.11 and later stop reading the OASIS DTDs at their entity-amplification limit unless it is raised.
const XMLLINT_LIMITS = (() => { try { const h = spawnSync("xmllint", ["--help"], { encoding: "utf8" }); return ["--huge"].concat(/--max-ampl/.test((h.stdout || "") + (h.stderr || "")) ? ["--max-ampl", "1000"] : []); } catch { return ["--huge"]; } })();
const require = createRequire(import.meta.url);
const Doc = require("../src/doc.js"), Style = require("../src/style.js");

const dir = "content/workbench", catalog = process.env.DITA_CATALOG;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "selftest-"));
let failed = 0, checks = 0;
const ok = (cond, what) => { checks++; if (!cond) { failed++; console.log(`FAIL  ${what}`); } };

for (const file of fs.readdirSync(dir).filter((f) => f.endsWith(".md")).sort()) {
  const name = file.replace(/\.md$/, ""), source = fs.readFileSync(path.join(dir, file), "utf8");
  const doc = Doc.parse(source), found = Style.check(source), sum = Style.summary(found);
  if (name === "first-draft") {
    ok(!sum.passes && sum.error + sum.warning >= 4, `${name}: the draft should break the guide in at least four places that matter`);
    const fixed = Style.fixAll(source, Style.RULES.map((r) => r.id), {});
    ok(Style.summary(Style.check(fixed.source)).passes, `${name}: the draft should pass once the fixes are applied`);
    ok(fixed.fixed >= 10, `${name}: at least ten fixes should apply (${fixed.fixed} did)`);
  } else {
    ok(sum.passes, `${name}: ${sum.error} error(s), ${sum.warning} warning(s): ${found.filter((f) => f.level !== "suggestion").map((f) => `${f.rule} on line ${f.line}`).join(", ")}`);
    ok(sum.suggestion === 0, `${name}: ${sum.suggestion} suggestion(s): ${found.map((f) => `${f.rule} on line ${f.line}`).join(", ")}`);
  }
  ok(doc.title, `${name}: has a title`);
  // Every reader: all blocks, the general reader, and each condition the document names.
  for (const reader of [undefined, Doc.GENERAL, ...Doc.conditions(doc)]) {
    const view = Doc.resolve(doc, reader), label = `${name} for ${reader === undefined ? "every reader" : reader === Doc.GENERAL ? "the general reader" : reader}`;
    const md = Doc.toMarkdown(view), html = Doc.toHtml(view), dita = Doc.toDita(view);
    ok(!/\{\{/.test(html), `${label}: a variable has no value`);
    ok(!/^\s*:::/m.test(md) && !/class=/.test(html), `${label}: the outputs carry no trace of the conditions or of the preview`);
    // Markdown written out and read again is the same document.
    ok(Doc.toHtml(Doc.resolve(Doc.parse(md))) === html, `${label}: the Markdown output reads back as the same document`);
    ok(/^<\?xml/.test(dita) && /<title>/.test(dita), `${label}: has a DITA topic`);
    if (catalog) {
      const out = path.join(tmp, `${name}-${reader === undefined ? "all" : reader === Doc.GENERAL ? "general" : reader}.dita`);
      fs.writeFileSync(out, dita);
      try { execFileSync("xmllint", [...XMLLINT_LIMITS, "--noout", "--valid", "--nonet", out], { env: { ...process.env, XML_CATALOG_FILES: catalog }, stdio: "pipe" }); checks++; }
      catch (e) { failed++; console.log(`FAIL  ${label}: the DITA is not valid\n${String(e.stderr).split("\n").slice(0, 6).join("\n")}`); }
    }
  }
  const kind = /<(task|concept|reference|troubleshooting) id=/.exec(Doc.toDita(Doc.resolve(doc)))[1];
  console.log(`${name.padEnd(16)} ${String(sum.error + sum.warning).padStart(2)} to fix, ${String(sum.suggestion).padStart(2)} advice   DITA ${kind}${Doc.conditions(doc).length ? `   readers: ${Doc.conditions(doc).join(", ")}` : ""}`);
}
// The scenario documents: a value for every variable, in code too, and a DITA topic that is valid for every reader.
for (const sc of fs.readdirSync("content/scenarios", { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name).sort()) {
  for (const file of fs.readdirSync(`content/scenarios/${sc}`).filter((f) => f.endsWith(".md")).sort()) {
    const label = `${sc}/${file}`, doc = Doc.parse(fs.readFileSync(`content/scenarios/${sc}/${file}`, "utf8"));
    const view = Doc.resolve(doc), html = Doc.toHtml(view), dita = Doc.toDita(view), pkg = Doc.toDitaPackage(doc);
    ok(!/\{\{/.test(html) && !/\{\{/.test(dita) && !/\{\{/.test(pkg.topic), `${label}: a variable is left without its value`);
    if (catalog) for (const [what, xmlText] of [["topic", dita], ["package topic", pkg.topic]]) {
      const out = path.join(tmp, `${sc}-${file}-${what.replace(/ /g, "-")}.dita`);
      fs.writeFileSync(out, xmlText);
      try { execFileSync("xmllint", [...XMLLINT_LIMITS, "--noout", "--valid", "--nonet", out], { env: { ...process.env, XML_CATALOG_FILES: catalog }, stdio: "pipe" }); checks++; }
      catch (e) { failed++; console.log(`FAIL  ${label}: the DITA ${what} is not valid\n${String(e.stderr).split("\n").slice(0, 6).join("\n")}`); }
    }
  }
}
// A procedure written across several sections keeps its order: each section is a step, in the order it was written,
// and its numbered list becomes the substeps. "Verify" with a list of its own is part of the procedure, not its result.
{
  const doc = Doc.parse(fs.readFileSync("content/scenarios/c-cloud/developer-guide-deploy.md", "utf8"));
  const dita = Doc.toDita(Doc.resolve(doc)), cmds = [...dita.matchAll(/<step><cmd>(.*?)<\/cmd>/g)].map((m) => m[1]);
  ok(cmds.join(" | ") === "Create the project | Write the configuration | Set the environment variables | Deploy | Verify", `the deploy guide's steps are out of order: ${cmds.join(" | ")}`);
  ok((dita.match(/<substep>/g) || []).length === 9 && !/<result>[\s\S]*<ol>/.test(dita), "the deploy guide's numbered lists should be nine substeps, with none left in the result");
  ok(/<codeblock[^>]*><ph keyref="cli">lattice<\/ph> auth login<\/codeblock>/.test(Doc.toDitaPackage(doc).topic), "a variable in a code block should become a key reference in the DITA project");
  const sop = Doc.toDita(Doc.resolve(Doc.parse(fs.readFileSync("content/scenarios/b-enterprise-it/sop-onboarding.md", "utf8"))));
  ok([...sop.matchAll(/<step><cmd>(.*?)<\/cmd>/g)].map((m) => m[1].slice(0, 6)).join(",") === "Day −5,Day −3,Day −1,Day 1:,Day 5:", "a heading that only holds the procedure (\"Procedure\") should leave its sections as the steps");
  const howto = Doc.toDita(Doc.resolve(Doc.parse(fs.readFileSync("content/workbench/how-to.md", "utf8"))));
  ok((howto.match(/<step>/g) || []).length === 3 && !/<substeps>/.test(howto), "a procedure written as one numbered list keeps its items as the steps");
}
// The guide follows itself: the name of every group, and the title and the reason of every rule, go through the check.
const groups = [...new Set(Style.RULES.map((r) => r.group))];
const own = Style.check(groups.map((g) => `### ${g}`).concat(Style.RULES.map((r) => `#### ${r.title}\n\n${r.why}`)).join("\n\n"), { off: ["heading-skip"] });
ok(!own.length, `the style guide's own words: ${own.map((f) => `${f.rule} in "${f.quote}"`).join(", ")}`);
// Every rule that is checked by code and gives two examples: the first breaks the rule, and the second doesn't.
for (const r of Style.RULES.filter((r) => r.level !== "review" && r.bad && r.good)) {
  const hit = (text) => Style.check(text, { vars: r.id === "var-undefined" }).some((f) => f.rule === r.id);
  ok(hit(r.bad), `${r.id}: the check misses the rule's own "not this" example`);
  ok(!hit(r.good), `${r.id}: the check flags the rule's own "this" example`);
}
// Version 10.1: every figure in the MLflow guide's tables is the one MLflow recorded (content/projects/kc1/mlflow-evidence.json).
{
  const ev = JSON.parse(fs.readFileSync("content/projects/kc1/mlflow-evidence.json", "utf8")), guide = fs.readFileSync("content/projects/kc1/MLFLOW_COMPARE_RUNS.md", "utf8");
  const run = (name) => ev.runs.find((r) => r.run === name), f3 = (x) => x.toFixed(3);
  const rows = Object.fromEntries([...guide.matchAll(/^\| ([^|]+?) \| ([\d.]+) \| ([\d.]+) \| ([\d.]+) \|(?: ([\d.]+) \|)?$/gm)].map((m) => [m[1], m.slice(2).filter(Boolean)]));
  for (const name of ["Logistic balanced", "Random Forest balanced", "Random Forest default", "Logistic default"]) {
    const m = run(name).metrics;
    ok(JSON.stringify(rows[name]) === JSON.stringify([m.recall, m.average_precision, m.f1, m.precision].map(f3)), `MLflow guide: the row of ${name} matches the recorded run`);
  }
  for (const t of ["0.30", "0.50", "0.70"]) {
    const m = run(`Threshold ${t} (balanced Logistic)`).metrics;
    ok(JSON.stringify(rows[t]) === JSON.stringify([m.recall, m.precision, m.f1].map(f3)), `MLflow guide: the threshold ${t} matches the recorded run`);
  }
}
console.log(failed ? `${failed} of ${checks} checks failed` : `${checks} checks passed${catalog ? ", DITA validated against the DTDs" : " (set DITA_CATALOG to validate the DITA too)"}`);
process.exit(failed ? 1 : 0);
