// Stage 3 and 4: join events that belong to one story (correlate), then say what the story is and why (triage).
//
// The triage here is the baseline: fixed rules with fixed weights, no model. Every point of its score comes from a
// factor that names what was seen and the events that show it, so an analyst can check the reasoning line by line,
// and the same incident always gets the same answer. A model that replaces it has to beat it on the same scenarios.
//
// It proposes actions. It never carries one out: this project has no code that changes a system.
import type { Change, Enriched, Factor, Incident, Inventory, Proposal, Severity, Triage, Triager, Verdict } from "./types.ts";

export const WINDOW_MS = 30 * 60 * 1000;

/** Events are one incident when they share a source address, or an account on a machine, within 30 minutes of each other. */
export function correlate(events: Enriched[], windowMs = WINDOW_MS): Incident[] {
  const parent = events.map((_, i) => i);
  const find = (i: number): number => parent[i] === i ? i : (parent[i] = find(parent[i]));
  const last = new Map<string, number>();   // key -> index of the latest event with that key
  events.forEach((e, i) => {
    // A failed login joins others from its source only: two strangers who both guess at "root" are not one story.
    const guess = e.kind === "auth_failed" || e.kind === "brute_force";
    const keys = [e.srcIp && `ip:${e.srcIp}`, !guess && e.user && `acct:${e.user}@${e.agent}`, !guess && e.actor && `acct:${e.actor}@${e.agent}`].filter(Boolean) as string[];
    if (!keys.length) keys.push(`host:${e.agent}:${e.kind}`);
    for (const k of keys) {
      const j = last.get(k);
      if (j !== undefined && e.time - events[j].time <= windowMs) parent[find(i)] = find(j);
      last.set(k, i);
    }
  });
  const groups = new Map<number, Enriched[]>();
  events.forEach((e, i) => { const r = find(i); groups.set(r, [...(groups.get(r) ?? []), e]); });
  return [...groups.values()].sort((a, b) => a[0].time - b[0].time).map((evs, n) => ({
    id: `INC-${String(n + 1).padStart(3, "0")}`,
    events: evs, start: evs[0].time, end: evs[evs.length - 1].time,
    entities: [...new Set(evs.flatMap((e) => [e.srcIp, e.user && `${e.user}@${e.agent}`, e.agent]).filter(Boolean) as string[])],
  }));
}

const day = (t: number) => new Date(t).toISOString().slice(0, 10);
const hour = (t: number) => new Date(t).getUTCHours();
const ids = (evs: Enriched[]) => evs.map((e) => e.id);
/** A change ticket that explains this kind of event on this machine, on the day or the day before. */
function changeFor(inv: Inventory, e: Enriched, subject?: string): Change | undefined {
  return inv.changes.find((c) => c.covers.includes(e.kind) && c.hosts.includes(e.agent) && (!c.subject || c.subject === subject)
    && [day(e.time), day(e.time - 86_400_000)].includes(c.date));
}

export const baseline: Triager = {
  name: "baseline-rules-v1",
  triage(inc: Incident, inv: Inventory): Triage {
    const ev = inc.events, f: Factor[] = [], proposals: Proposal[] = [];
    const add = (id: string, weight: number, text: string, evidence: Enriched[]) => f.push({ id, weight, text, evidence: ids(evidence) });
    const of = (...k: string[]) => ev.filter((e) => k.includes(e.kind));

    // Password guessing, and whether it worked.
    const failed = of("auth_failed", "brute_force"), wins = of("auth_success");
    for (const ip of new Set(failed.map((e) => e.srcIp).filter(Boolean) as string[])) {
      const tries = failed.filter((e) => e.srcIp === ip), burst = tries.length >= 5 || tries.some((e) => e.kind === "brute_force");
      const win = wins.find((w) => w.srcIp === ip && w.time >= tries[0].time);
      const src = tries[0];
      if (burst && win) {
        add("guessing_then_success", 60, `${tries.length} failed logins from ${ip}, then a successful login as ${win.user ?? "an account"}.`, [...tries, win]);
        if (win.user) proposals.push({ type: "disable_account", target: `${win.user}@${win.agent}`, because: "The account was logged in to after password guessing." });
        if (win.source === "external") proposals.push({ type: "block_ip", target: ip, because: "The address guessed passwords and got in." });
      } else if (burst && src.srcAsset?.role === "backup_server" && changeFor(inv, src)) {
        const c = changeFor(inv, src)!;
        add("known_broken_job", -50, `The failures come from ${src.srcAsset.name}, the backup server, and change ${c.id} explains them: ${c.summary}`, tries);
        proposals.push({ type: "notify_owner", target: src.srcAsset.owner, because: `The backup job is failing on ${src.agent} until change ${c.id} is finished.` });
      } else if (burst && src.source === "external") {
        add("guessing_no_success", 25, `${tries.length} failed logins from the outside address ${ip}, and no successful login from it in this incident.`, tries);
      } else if (!burst && win && win.source === "internal") {
        add("mistyped_password", -20, `${tries.length} failed login${tries.length > 1 ? "s" : ""} and then a success from the inside address ${ip}: the pattern of a mistyped password.`, [...tries, win]);
      }
    }
    const flagged = new Set<string>();
    for (const w of wins) {
      if (w.source === "external" && w.account && !w.account.passwordLogin && /password/i.test(w.log + w.description) && !flagged.has(w.user + "@" + w.agent) && flagged.add(w.user + "@" + w.agent)) {
        add("password_login_not_allowed", 20, `${w.user} logged in with a password from outside, and the inventory says this account doesn't use passwords.`, [w]);
      }
    }

    // New accounts and new rights.
    for (const e of of("account_created", "privilege_change")) {
      const c = changeFor(inv, e, e.user);
      if (c) add("planned_change", -40, `Change ${c.id} covers this: ${c.summary}`, [e]);
      else {
        add(e.kind === "account_created" ? "unplanned_account" : "unplanned_rights", 35, e.kind === "account_created" ? `A new account, ${e.user ?? "unnamed"}, was created on ${e.agent}, and no change ticket covers it.` : `${e.user ?? "An account"} was given administrator rights on ${e.agent}, and no change ticket covers it.`, [e]);
        if (e.user) proposals.push({ type: "disable_account", target: `${e.user}@${e.agent}`, because: "The account or its rights were not planned." });
      }
    }

    // A web server that runs commands.
    for (const e of of("web_shell")) {
      add("web_server_ran_a_shell", 70, `A web server process on ${e.agent} started a shell${e.detail ? ` (${e.detail})` : ""}.`, [e]);
      proposals.push({ type: "isolate_host", target: e.agent, because: "Its web application is being used to run commands." });
    }

    // Malware, and tests of the antivirus.
    for (const e of of("malware")) {
      add("malware_detected", 50, `Malware was detected on ${e.agent}${e.detail ? `: ${e.detail}` : ""}.`, [e]);
      proposals.push({ type: "isolate_host", target: e.agent, because: "Malware was detected on it." });
    }
    for (const e of of("malware_test")) {
      const t = inv.training.find((x) => x.host === e.agent && x.date === day(e.time) && hour(e.time) >= x.fromHour && hour(e.time) < x.toHour);
      if (t) add("announced_test", -60, `The detection is the EICAR test file, on ${e.agent}, during “${t.summary}”.`, [e]);
      else add("test_file_unannounced", 10, `The detection is the EICAR test file, which is harmless, and nothing on the calendar explains it on ${e.agent}.`, [e]);
    }

    // Scans.
    const scans = of("port_scan");
    if (scans.length) {
      const s = scans[0], a = s.srcAsset, w = a?.schedule;
      if (a?.role === "vulnerability_scanner" && w && new Date(s.time).getUTCDay() === w.weekday && hour(s.time) >= w.fromHour && hour(s.time) < w.toHour) {
        add("own_scanner_on_schedule", -80, `The scan comes from ${a.name}, the organization's vulnerability scanner, inside its scheduled window.`, scans);
      } else if (a?.role === "vulnerability_scanner") {
        add("own_scanner_off_schedule", 15, `The scan comes from ${a.name}, the vulnerability scanner, outside its scheduled window.`, scans);
      } else {
        add("scan_from_unlisted_source", 25, `A port scan from ${s.srcIp ?? "an unknown source"}, which the inventory doesn't list as a scanner.`, scans);
      }
    }

    // The rules' own opinion counts a little, and only on top of something else or when nothing explains the alert.
    const top = Math.max(...ev.map((e) => e.level));
    if (top >= 7 && !f.some((x) => x.weight < 0)) add("rule_level", top >= 12 ? 20 : top >= 10 ? 10 : 5, `The highest rule level in the incident is ${top} of 16.`, ev.filter((e) => e.level === top));

    const score = f.reduce((n, x) => n + x.weight, 0);
    const benign = f.some((x) => x.weight < 0);
    const verdict: Verdict = score >= 50 ? "true_positive" : score <= 0 && benign ? "false_positive" : "needs_review";
    const severity: Severity = score >= 90 ? "critical" : score >= 50 ? "high" : score >= 20 ? "medium" : "low";
    f.sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight));
    const lead = f[0]?.text ?? "No rule of the baseline recognizes this pattern.";
    return {
      incidentId: inc.id, verdict, severity, score, factors: f,
      summary: verdict === "true_positive" ? `Escalate. ${lead}` : verdict === "false_positive" ? `Close, with the reason noted. ${lead}` : `An analyst needs to look. ${lead}`,
      // A false alarm proposes no containment, whatever else fired.
      proposals: verdict === "false_positive" ? proposals.filter((p) => p.type === "notify_owner") : verdict === "needs_review" ? [] : dedupe(proposals),
      triager: baseline.name, usage: { inputTokens: 0, outputTokens: 0, costUsd: 0 },
    };
  },
};
function dedupe(p: Proposal[]): Proposal[] { const seen = new Set<string>(); return p.filter((x) => !seen.has(x.type + x.target) && seen.add(x.type + x.target)); }
