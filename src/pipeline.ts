// The whole path for a batch of alerts, and the measurement of a triager against labelled scenarios.
import { performance } from "node:perf_hooks";
import { ActionQueue, AuditLog } from "./control.ts";
import { enrich, normalize } from "./ingest.ts";
import { baseline, correlate } from "./triage.ts";
import type { Incident, Inventory, Rejected, Scenario, Triage, Triager, Usage, Verdict } from "./types.ts";

export type Run = { incidents: Incident[]; triage: Triage[]; rejected: Rejected[]; queue: ActionQueue; audit: AuditLog; ms: number };

/** Alerts in; incidents, their triage and a queue of proposed actions out. Every step is written to the audit log. */
export async function run(alerts: unknown, inventory: Inventory, triager: Triager = baseline, clock?: () => Date): Promise<Run> {
  const t0 = performance.now(), audit = new AuditLog(clock), queue = new ActionQueue(audit);
  const { events, rejected } = normalize(alerts);
  audit.append("system", "alerts.ingested", { accepted: events.length, rejected: rejected.length });
  const incidents = correlate(enrich(events, inventory));
  const triage: Triage[] = [];
  for (const inc of incidents) {
    const t = await triager.triage(inc, inventory);
    triage.push(t);
    audit.append(triager.name, "incident.triaged", { incidentId: inc.id, verdict: t.verdict, severity: t.severity, score: t.score, factors: t.factors.map((f) => f.id) });
    for (const p of t.proposals) queue.propose(inc.id, p, triager.name);
  }
  return { incidents, triage, rejected, queue, audit, ms: performance.now() - t0 };
}

const RANK: Record<Verdict, number> = { true_positive: 2, needs_review: 1, false_positive: 0 };
export type Result = { id: string; title: string; expected: Verdict; got: Verdict; correct: boolean; alerts: number; incidents: number; ms: number; reasons: string[] };
export type Report = {
  triager: string; scenarios: number; correct: number; accuracy: number;
  /** Of the attacks, how many were escalated; of the escalations, how many were attacks. */
  recall: number; precision: number;
  /** Attacks that were closed as false alarms: the error that costs most. */
  missed: number;
  /** False alarms that were escalated: the error that costs analysts' time. */
  falseEscalations: number;
  alerts: number; msTotal: number; msPerAlert: number; usage: Usage; results: Result[];
};

/** A scenario's answer is its most serious incident: one real attack in a batch makes the batch an attack. */
export async function evaluate(scenarios: Scenario[], inventory: Inventory, triager: Triager = baseline): Promise<Report> {
  const results: Result[] = [], usage: Usage = { inputTokens: 0, outputTokens: 0, costUsd: 0 };
  let alerts = 0, msTotal = 0;
  for (const s of scenarios) {
    const r = await run(s.alerts, inventory, triager);
    const top = r.triage.slice().sort((a, b) => RANK[b.verdict] - RANK[a.verdict] || b.score - a.score)[0];
    const got: Verdict = top?.verdict ?? "needs_review";
    for (const t of r.triage) { usage.inputTokens += t.usage.inputTokens; usage.outputTokens += t.usage.outputTokens; usage.costUsd += t.usage.costUsd; }
    alerts += s.alerts.length; msTotal += r.ms;
    results.push({ id: s.id, title: s.title, expected: s.expected, got, correct: got === s.expected, alerts: s.alerts.length, incidents: r.incidents.length, ms: r.ms, reasons: top?.factors.map((f) => f.id) ?? [] });
  }
  const tp = results.filter((r) => r.expected === "true_positive"), escalated = results.filter((r) => r.got === "true_positive");
  const correct = results.filter((r) => r.correct).length, ratio = (a: number, b: number) => b ? a / b : 1;
  return {
    triager: triager.name, scenarios: results.length, correct, accuracy: ratio(correct, results.length),
    recall: ratio(tp.filter((r) => r.got === "true_positive").length, tp.length),
    precision: ratio(escalated.filter((r) => r.expected === "true_positive").length, escalated.length),
    missed: tp.filter((r) => r.got === "false_positive").length,
    falseEscalations: escalated.filter((r) => r.expected === "false_positive").length,
    alerts, msTotal, msPerAlert: ratio(msTotal, alerts), usage, results,
  };
}
