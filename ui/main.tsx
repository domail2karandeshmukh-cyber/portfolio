// The analyst's page. It runs the same pipeline as the command line, in the browser, on the synthetic sample day.
// Everything an alert carries is rendered as text; nothing from an alert is ever treated as markup or as an instruction.
import { StrictMode, useEffect, useId, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import inventoryJson from "../data/inventory.json";
import dayJson from "../data/sample-day.json";
import scenariosJson from "../data/scenarios.json";
import { AuditLog, type ActionQueue, type QueuedAction } from "../src/control.ts";
import { evaluate, run, type Report, type Run } from "../src/pipeline.ts";
import type { ActionType, Enriched, Incident, Inventory, Scenario, Triage, Verdict } from "../src/types.ts";

const inventory = inventoryJson as Inventory, scenarios = scenariosJson as Scenario[];
const VERDICT: Record<Verdict, string> = { true_positive: "Escalate", needs_review: "Needs review", false_positive: "False alarm" };
const RANK: Record<Verdict, number> = { true_positive: 0, needs_review: 1, false_positive: 2 };
const ACTION: Record<ActionType, string> = { disable_account: "Disable account", block_ip: "Block address", isolate_host: "Isolate machine", notify_owner: "Notify owner" };
const clock = (iso: string) => iso.slice(11, 19);
const signed = (n: number) => (n > 0 ? `+${n}` : String(n).replace("-", "−"));
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

type Tab = "incidents" | "queue" | "audit" | "evaluation";
type Filter = "all" | Verdict;

function Badge({ verdict }: { verdict: Verdict }) {
  return <span className={`badge v-${verdict}`}>{VERDICT[verdict]}</span>;
}

function ActionCard({ action, analyst, queue, onChange, showIncident }: { action: QueuedAction; analyst: string; queue: ActionQueue; onChange: () => void; showIncident?: boolean }) {
  const [reason, setReason] = useState(""), [error, setError] = useState(""), id = useId();
  const decide = (d: "approve" | "reject") => {
    try { queue.decide(action.id, analyst, d, reason); setError(""); onChange(); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  };
  return (
    <li className={`action s-${action.status}`}>
      <p className="action-head">
        <strong>{ACTION[action.type]}</strong> <code>{action.target}</code>
        <span className="muted"> · {action.id}{showIncident ? ` · ${action.incidentId}` : ""} · proposed by {action.proposedBy}</span>
      </p>
      <p>{action.because}</p>
      {action.status === "proposed" ? (
        <form onSubmit={(e) => e.preventDefault()}>
          <label htmlFor={id}>Reason for your decision</label>
          <textarea id={id} rows={2} value={reason} onChange={(e) => setReason(e.target.value)} aria-describedby={error ? `${id}-e` : undefined} />
          <div className="row">
            <button type="button" className="primary" onClick={() => decide("approve")}>Approve</button>
            <button type="button" onClick={() => decide("reject")}>Reject</button>
          </div>
          {error && <p id={`${id}-e`} className="error" role="alert">{error}</p>}
        </form>
      ) : (
        <p className="decided">
          <strong>{action.status === "approved" ? "Approved" : "Rejected"} by {action.decidedBy}.</strong> {action.reason}
          {action.status === "approved" && <span className="muted"> Recorded only: this page can't carry an action out.</span>}
        </p>
      )}
    </li>
  );
}

function Events({ events, marked }: { events: Enriched[]; marked: Set<string> }) {
  return (
    <div className="scroll" tabIndex={0} role="group" aria-label="Events in this incident">
      <table>
        <thead><tr><th>Time (UTC)</th><th>Event</th><th>Machine</th><th>Rule</th><th>From</th><th>Account</th><th>Log line</th></tr></thead>
        <tbody>
          {events.map((e) => (
            <tr key={e.id} className={marked.has(e.id) ? "marked" : undefined}>
              <td>{clock(e.timeIso)}</td><td><code>{e.id}</code></td><td>{e.agent}</td>
              <td>{e.ruleId} <span className="muted">level {e.level}</span><br />{e.description}</td>
              <td>{e.srcIp ? <>{e.srcIp}<br /><span className="muted">{e.srcAsset ? e.srcAsset.name : e.source}</span></> : "—"}</td>
              <td>{e.user ?? "—"}{e.actor ? <><br /><span className="muted">by {e.actor}</span></> : null}</td>
              <td className="log">{e.log}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Detail({ incident, triage, actions, analyst, queue, onChange, focus }: { incident: Incident; triage: Triage; actions: QueuedAction[]; analyst: string; queue: ActionQueue; onChange: () => void; focus: boolean }) {
  const [marked, setMarked] = useState<string | null>(null), title = useRef<HTMLHeadingElement>(null);
  // When the analyst picks an incident, focus goes to its title: a screen reader announces it, and on a phone it scrolls into view.
  useEffect(() => { if (focus) title.current?.focus({ preventScroll: window.innerWidth > 900 }); }, [focus]);
  const factor = triage.factors.find((f) => f.id === marked);
  const techniques = [...new Set(incident.events.flatMap((e) => e.techniques))];
  return (
    <article className="detail" aria-labelledby="d-title">
      <p className="meta"><Badge verdict={triage.verdict} /> <span>Severity {triage.severity}</span> <span>Score {signed(triage.score)}</span> <span>{incident.id}</span></p>
      <h2 id="d-title" tabIndex={-1} ref={title}>{triage.summary}</h2>
      <p className="muted">
        {plural(incident.events.length, "alert")}, {clock(incident.events[0].timeIso)} to {clock(incident.events.at(-1)!.timeIso)} UTC on {incident.events[0].timeIso.slice(0, 10)} · triaged by {triage.triager}
      </p>
      <h3>Why</h3>
      <ul className="factors">
        {triage.factors.map((f) => (
          <li key={f.id}>
            <span className={`weight ${f.weight > 0 ? "up" : "down"}`}>{signed(f.weight)}</span>
            <span>{f.text}{" "}
              <button type="button" className="link" aria-pressed={marked === f.id} onClick={() => setMarked(marked === f.id ? null : f.id)}>
                {marked === f.id ? "Hide" : "Show"} the {plural(f.evidence.length, "event")}
              </button>
            </span>
          </li>
        ))}
      </ul>
      {techniques.length > 0 && <p className="muted">ATT&amp;CK techniques named by the rules: {techniques.join("; ")}</p>}
      <h3>Proposed actions</h3>
      {actions.length ? (
        <ul className="actions">{actions.map((a) => <ActionCard key={a.id} action={a} analyst={analyst} queue={queue} onChange={onChange} />)}</ul>
      ) : <p className="muted">None. {triage.verdict === "needs_review" ? "The rules don't decide this one; it is yours to judge." : "Nothing to contain."}</p>}
      <h3>Events</h3>
      <Events events={incident.events} marked={new Set(factor?.evidence ?? [])} />
    </article>
  );
}

function Incidents({ data, analyst, onChange }: { data: Run; analyst: string; onChange: () => void }) {
  const [filter, setFilter] = useState<Filter>("all");
  const rows = data.incidents.map((incident, i) => ({ incident, triage: data.triage[i] }))
    .sort((a, b) => RANK[a.triage.verdict] - RANK[b.triage.verdict] || b.triage.score - a.triage.score);
  const [selected, setSelected] = useState(rows[0]?.incident.id), [picked, setPicked] = useState(false);
  const shown = rows.filter((r) => filter === "all" || r.triage.verdict === filter);
  const current = rows.find((r) => r.incident.id === selected);
  const count = (v: Verdict) => rows.filter((r) => r.triage.verdict === v).length;
  const filters: [Filter, string][] = [["all", `All ${rows.length}`], ["true_positive", `Escalate ${count("true_positive")}`], ["needs_review", `Needs review ${count("needs_review")}`], ["false_positive", `False alarm ${count("false_positive")}`]];
  return (
    <div className="split">
      <section aria-label="Incidents" className="list">
        <div className="chips" role="group" aria-label="Show">
          {filters.map(([f, label]) => <button key={f} type="button" aria-pressed={filter === f} onClick={() => setFilter(f)}>{label}</button>)}
        </div>
        <ul>
          {shown.map(({ incident, triage }) => (
            <li key={incident.id}>
              <button type="button" className="item" aria-current={incident.id === selected ? "true" : undefined}
                onClick={() => { setSelected(incident.id); setPicked(true); }}>
                <span className="item-top"><Badge verdict={triage.verdict} /><span className="muted">{incident.id} · {clock(incident.events[0].timeIso)} · {plural(incident.events.length, "alert")}</span></span>
                <span className="item-text">{triage.factors[0]?.text ?? triage.summary}</span>
              </button>
            </li>
          ))}
          {!shown.length && <li className="muted pad">No incidents of this kind.</li>}
        </ul>
      </section>
      {current && <Detail key={current.incident.id} focus={picked} incident={current.incident} triage={current.triage} analyst={analyst} queue={data.queue} onChange={onChange}
        actions={data.queue.list().filter((a) => a.incidentId === current.incident.id)} />}
    </div>
  );
}

function Queue({ data, analyst, onChange }: { data: Run; analyst: string; onChange: () => void }) {
  const all = data.queue.list(), waiting = all.filter((a) => a.status === "proposed"), decided = all.filter((a) => a.status !== "proposed");
  return (
    <section className="page" aria-labelledby="q-title">
      <h2 id="q-title">Approval queue</h2>
      <p>The triager proposes; a named analyst decides, with a reason. An approval here is a recorded decision. Nothing on this page can change a system.</p>
      <h3>Waiting ({waiting.length})</h3>
      {waiting.length ? <ul className="actions">{waiting.map((a) => <ActionCard key={a.id} action={a} analyst={analyst} queue={data.queue} onChange={onChange} showIncident />)}</ul> : <p className="muted">Nothing is waiting.</p>}
      <h3>Decided ({decided.length})</h3>
      {decided.length ? <ul className="actions">{decided.map((a) => <ActionCard key={a.id} action={a} analyst={analyst} queue={data.queue} onChange={onChange} showIncident />)}</ul> : <p className="muted">No decisions yet.</p>}
    </section>
  );
}

function Audit({ data }: { data: Run }) {
  const entries = data.audit.entries(), broken = AuditLog.verify(entries);
  return (
    <section className="page" aria-labelledby="a-title">
      <h2 id="a-title">Audit log</h2>
      <p className={broken ? "error" : "ok"} role="status">
        {broken ? `The chain breaks at entry ${broken}.` : `${plural(entries.length, "entry", "entries")}, chain intact: each entry carries the hash of the one before.`}
      </p>
      <p className="muted">The log is held in this page's memory and is gone when you reload. The hashes show an edit; they are not signed.</p>
      <div className="scroll" tabIndex={0} role="group" aria-label="Audit entries">
        <table>
          <thead><tr><th>No.</th><th>Time (UTC)</th><th>Who</th><th>What</th><th>Details</th><th>Hash</th></tr></thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.seq}><td>{e.seq}</td><td>{clock(e.time)}</td><td>{e.actor}</td><td>{e.action}</td><td className="log">{JSON.stringify(e.details)}</td><td><code title={e.hash}>{e.hash.slice(0, 12)}…</code></td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Evaluation({ report }: { report: Report }) {
  const pct = (x: number) => `${Math.round(x * 100)}%`;
  return (
    <section className="page" aria-labelledby="e-title">
      <h2 id="e-title">Evaluation of {report.triager}</h2>
      <p className="warn"><strong>Read this before the numbers.</strong> The rules and these scenarios were written together, so the score shows that the pipeline works as designed, not how it would do on alerts it hasn't seen.</p>
      <dl className="stats">
        <div><dt>Scenarios correct</dt><dd>{report.correct} of {report.scenarios}</dd></div>
        <div><dt>Attacks escalated</dt><dd>{pct(report.recall)}</dd></div>
        <div><dt>Attacks closed by mistake</dt><dd>{report.missed}</dd></div>
        <div><dt>False alarms escalated</dt><dd>{report.falseEscalations}</dd></div>
        <div><dt>Time per alert, this browser</dt><dd>{report.msPerAlert.toFixed(2)} ms</dd></div>
        <div><dt>Model cost</dt><dd>${report.usage.costUsd.toFixed(2)}</dd></div>
      </dl>
      <div className="scroll" tabIndex={0} role="group" aria-label="Scenario results">
        <table>
          <thead><tr><th>Scenario</th><th>Alerts</th><th>Expected</th><th>Got</th><th>Result</th></tr></thead>
          <tbody>
            {report.results.map((r) => (
              <tr key={r.id}><td>{r.title}</td><td>{r.alerts}</td><td>{VERDICT[r.expected]}</td><td>{VERDICT[r.got]}</td><td>{r.correct ? "Correct" : <strong className="error">Wrong</strong>}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function App() {
  const [data, setData] = useState<Run | null>(null), [report, setReport] = useState<Report | null>(null), [failed, setFailed] = useState("");
  const [tab, setTab] = useState<Tab>("incidents"), [analyst, setAnalyst] = useState(""), [, setTick] = useState(0);
  useEffect(() => {
    let live = true;
    (async () => {
      const r = await run(dayJson, inventory), e = await evaluate(scenarios, inventory);
      if (live) { setData(r); setReport(e); }
    })().catch((e) => live && setFailed(String(e)));
    return () => { live = false; };
  }, []);
  const waiting = data ? data.queue.list("proposed").length : 0;
  const tabs: [Tab, string][] = [["incidents", "Incidents"], ["queue", `Approval queue (${waiting})`], ["audit", "Audit log"], ["evaluation", "Evaluation"]];
  return (
    <>
      <header>
        <div className="brand"><h1>SOC triage</h1><p className="demo">Demo on synthetic alerts. Not connected to any system.</p></div>
        <div className="who">
          <label htmlFor="analyst">Deciding as</label>
          <input id="analyst" value={analyst} onChange={(e) => setAnalyst(e.target.value)} placeholder="Your name" autoComplete="off" maxLength={60} />
          <span className="muted">No sign-in yet: the name is recorded as typed.</span>
        </div>
        <nav aria-label="Views">
          {tabs.map(([t, label]) => <button key={t} type="button" aria-current={tab === t ? "page" : undefined} onClick={() => setTab(t)}>{label}</button>)}
        </nav>
      </header>
      <main>
        {failed && <p className="error" role="alert">The pipeline stopped: {failed}</p>}
        {!data || !report ? !failed && <p className="pad">Running the pipeline…</p> : (
          <>
            {data.rejected.length > 0 && <p className="warn">{plural(data.rejected.length, "alert")} rejected at intake: {data.rejected.map((r) => `no. ${r.index + 1}, ${r.reason}`).join("; ")}</p>}
            {tab === "incidents" && <Incidents data={data} analyst={analyst} onChange={() => setTick((n) => n + 1)} />}
            {tab === "queue" && <Queue data={data} analyst={analyst} onChange={() => setTick((n) => n + 1)} />}
            {tab === "audit" && <Audit data={data} />}
            {tab === "evaluation" && <Evaluation report={report} />}
          </>
        )}
      </main>
    </>
  );
}

createRoot(document.getElementById("root")!).render(<StrictMode><App /></StrictMode>);
