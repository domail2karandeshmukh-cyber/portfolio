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
console.log(failed ? `${failed} of ${checks} checks failed` : `${checks} checks passed${catalog ? ", DITA validated against the DTDs" : " (set DITA_CATALOG to validate the DITA too)"}`);
process.exit(failed ? 1 : 0);
