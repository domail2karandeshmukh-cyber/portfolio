// The command line.
//   node src/cli.ts evaluate                      the baseline against data/scenarios.json
//   node src/cli.ts triage <alerts.json>          a file of Wazuh-shaped alerts (a JSON list): incidents, reasons, proposed actions
// It reads files and prints. It changes nothing and calls nothing.
import { readFileSync } from "node:fs";
import { AuditLog } from "./control.ts";
import { evaluate, run } from "./pipeline.ts";
import type { Inventory, Scenario } from "./types.ts";

const here = (f: string) => new URL(`../data/${f}`, import.meta.url);
const inventory: Inventory = JSON.parse(readFileSync(here("inventory.json"), "utf8"));
const [cmd, file] = process.argv.slice(2);
const pct = (n: number) => `${Math.round(n * 100)}%`;

if (cmd === "evaluate") {
  const scenarios: Scenario[] = JSON.parse(readFileSync(here("scenarios.json"), "utf8"));
  const r = await evaluate(scenarios, inventory);
  console.log(`Triager: ${r.triager}\n`);
  for (const x of r.results) console.log(`${x.correct ? "ok  " : "MISS"} ${x.id.padEnd(26)} expected ${x.expected.padEnd(14)} got ${x.got.padEnd(14)} ${x.reasons.join(", ")}`);
  console.log(`\n${r.correct} of ${r.scenarios} scenarios correct (${pct(r.accuracy)})`);
  console.log(`Attacks escalated (recall): ${pct(r.recall)}   Escalations that were attacks (precision): ${pct(r.precision)}`);
  console.log(`Attacks closed as false alarms: ${r.missed}   False alarms escalated: ${r.falseEscalations}`);
  console.log(`${r.alerts} alerts in ${r.msTotal.toFixed(1)} ms (${r.msPerAlert.toFixed(2)} ms per alert on this computer)`);
  console.log(`Model cost: $${r.usage.costUsd.toFixed(2)} (${r.usage.inputTokens + r.usage.outputTokens} tokens): the baseline uses no model`);
  console.log("\nThe scenarios and the rules were written together, so this score shows that the pipeline works as designed, not how it does on alerts it hasn't seen.");
  process.exitCode = r.correct === r.scenarios ? 0 : 1;
} else if (cmd === "triage" && file) {
  const r = await run(JSON.parse(readFileSync(file, "utf8")), inventory);
  for (const [i, inc] of r.incidents.entries()) {
    const t = r.triage[i];
    console.log(`\n${inc.id}  ${t.verdict.toUpperCase()}  severity ${t.severity}  score ${t.score}  (${inc.events.length} alert${inc.events.length > 1 ? "s" : ""}, ${inc.entities.join(", ")})`);
    console.log(`  ${t.summary}`);
    for (const f of t.factors) console.log(`  ${f.weight > 0 ? "+" : ""}${f.weight}  ${f.text}  [${f.evidence.slice(0, 4).join(", ")}${f.evidence.length > 4 ? ", ..." : ""}]`);
    const tech = [...new Set(inc.events.flatMap((e) => e.techniques))];
    if (tech.length) console.log(`  ATT&CK named by the rules: ${tech.join("; ")}`);
  }
  const waiting = r.queue.list("proposed");
  console.log(`\n${waiting.length} proposed action${waiting.length === 1 ? "" : "s"} waiting for an analyst. Nothing was carried out.`);
  for (const a of waiting) console.log(`  ${a.id}  ${a.type}  ${a.target}  (${a.incidentId}) ${a.because}`);
  if (r.rejected.length) console.log(`\n${r.rejected.length} alert(s) could not be used: ${r.rejected.slice(0, 5).map((x) => `#${x.index} ${x.reason}`).join("; ")}`);
  console.log(`\nAudit log: ${r.audit.entries().length} entries, chain ${AuditLog.verify(r.audit.entries()) === 0 ? "intact" : "BROKEN"}. ${r.ms.toFixed(1)} ms.`);
} else {
  console.log("Usage:\n  node src/cli.ts evaluate\n  node src/cli.ts triage <alerts.json>");
  process.exitCode = 2;
}
