// Stage 1 and 2: check each alert and keep what the pipeline needs (normalize), then look up what the organization
// already knows about its addresses, accounts, changes and calendar (enrich).
//
// An alert comes from outside, so nothing in it is trusted: a field of the wrong type is dropped or the alert is
// rejected with a reason, every string is bounded, and a log line has its secrets masked before it is stored. The
// enrichment reads a local inventory only. It makes no network call.
import type { Account, Asset, Enriched, EventKind, Inventory, RawAlert, Rejected, SecurityEvent } from "./types.ts";

const MAX = 2000;
const IPV4 = /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/;
const str = (v: unknown, max = 200): string | undefined => typeof v === "string" && v.trim() ? v.trim().slice(0, max) : undefined;
const obj = (v: unknown): Record<string, unknown> => v && typeof v === "object" && !Array.isArray(v) ? v as Record<string, unknown> : {};
const list = (v: unknown): string[] => Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").slice(0, 32).map((x) => x.slice(0, 80)) : [];

/** Masks what looks like a secret in a log line, so the store and the page never hold one. */
export function mask(line: string): string {
  return line
    .replace(/\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]{8,}/g, "$1 [masked]")
    .replace(/\b(password|passwd|secret|token|api[_-]?key)(\s*[=:]\s*)("[^"]*"|'[^']*'|[^\s"']+)/gi, "$1$2[masked]");
}

/** The kind of event, from the groups Wazuh's rules carry. The first line that fits decides. */
function kindOf(groups: string[], description: string, detail: string): EventKind {
  const g = new Set(groups), d = description.toLowerCase();
  // Wazuh's ClamAV rules put "virus" on every clamd message (a restart, a database update), so the group alone isn't a detection.
  if ((g.has("virus") || g.has("malware")) && /detected|found/.test(d)) return /eicar/i.test(detail + " " + description) ? "malware_test" : "malware";
  if (g.has("web_shell") || (g.has("attack") && /shell/.test(d))) return "web_shell";
  if (g.has("authentication_failures")) return "brute_force";
  if (g.has("authentication_failed") || g.has("invalid_login")) return "auth_failed";
  if (g.has("authentication_success")) return "auth_success";
  if (g.has("adduser")) return "account_created";
  if (g.has("privilege_change") || /added to (the )?(sudo|admin|wheel) group/.test(d)) return "privilege_change";
  if (g.has("recon") || /port ?scan/.test(d)) return "port_scan";
  return "other";
}

/** Checks one alert. Returns the event, or the reason it can't be used. */
export function normalizeOne(raw: RawAlert, index = 0): SecurityEvent | Rejected {
  const a = obj(raw), rule = obj(a.rule), agent = obj(a.agent), data = obj(a.data);
  const stamp = str(a.timestamp, 40), time = stamp ? Date.parse(stamp) : NaN;
  if (!Number.isFinite(time)) return { index, reason: "no usable timestamp" };
  const ruleId = typeof rule.id === "number" ? String(rule.id) : str(rule.id, 20);
  if (!ruleId || !/^[\w.-]+$/.test(ruleId)) return { index, reason: "no usable rule.id" };
  const level = typeof rule.level === "number" ? rule.level : Number.NaN;
  if (!Number.isInteger(level) || level < 0 || level > 16) return { index, reason: "rule.level is not a whole number from 0 to 16" };
  const agentName = str(agent.name, 80);
  if (!agentName) return { index, reason: "no agent.name" };
  const description = str(rule.description, 300) ?? "";
  const groups = list(rule.groups);
  const srcIp = str(data.srcip, 45);
  const detail = str(data.command, MAX) ?? str(data.virus, 200) ?? str(data.file, 400) ?? str(data.detail, MAX);
  const kind = kindOf(groups, description, detail ?? "");
  // Wazuh's sshd decoders put the name that was tried in dstuser, except for a name that doesn't exist, which goes in srcuser.
  const guess = kind === "auth_failed" || kind === "brute_force";
  return {
    id: str(a.id, 64) ?? `${time}-${ruleId}-${index}`,
    time, timeIso: new Date(time).toISOString(),
    ruleId, level, description, groups,
    kind,
    agent: agentName,
    srcIp: srcIp && IPV4.test(srcIp) ? srcIp : undefined,   // a source that isn't an address is dropped, not trusted
    user: str(data.dstuser, 64) ?? (guess ? str(data.srcuser, 64) : undefined),
    actor: guess ? undefined : str(data.srcuser, 64),
    detail: detail ? mask(detail) : undefined,
    mitre: list(obj(rule.mitre).id).filter((t) => /^T\d{4}(\.\d{3})?$/.test(t)),
    log: mask(str(a.full_log, MAX) ?? ""),
  };
}

/** Checks a batch. Events come back in time order; alerts that can't be used come back with their reasons. */
export function normalize(raw: unknown): { events: SecurityEvent[]; rejected: Rejected[] } {
  const events: SecurityEvent[] = [], rejected: Rejected[] = [];
  if (!Array.isArray(raw)) return { events, rejected: [{ index: -1, reason: "the input is not a list of alerts" }] };
  raw.slice(0, 50_000).forEach((r, i) => {
    const e = normalizeOne(obj(r), i);
    if ("reason" in e) rejected.push(e); else events.push(e);
  });
  events.sort((a, b) => a.time - b.time || a.id.localeCompare(b.id));
  return { events, rejected };
}

/* The ATT&CK techniques this baseline names. IDs and names as published by MITRE ATT&CK (attack.mitre.org). */
export const TECHNIQUES: Record<string, string> = {
  T1110: "Brute Force", T1078: "Valid Accounts", T1136: "Create Account", T1098: "Account Manipulation",
  T1046: "Network Service Discovery", T1059: "Command and Scripting Interpreter", "T1505.003": "Web Shell",
};

const toInt = (ip: string) => ip.split(".").reduce((n, p) => n * 256 + Number(p), 0);
/** Is the address in the range, written like 192.0.2.0/24? */
export function inRange(ip: string, cidr: string): boolean {
  const [base, bits] = cidr.split("/"), n = Number(bits);
  if (!IPV4.test(ip) || !IPV4.test(base ?? "") || !Number.isInteger(n) || n < 0 || n > 32) return false;
  const size = 2 ** (32 - n);
  return Math.floor(toInt(ip) / size) === Math.floor(toInt(base) / size);
}

export function enrich(events: SecurityEvent[], inv: Inventory): Enriched[] {
  const assets = new Map<string, Asset>(inv.assets.map((a) => [a.ip, a]));
  const accounts = new Map<string, Account>(inv.accounts.map((a) => [a.name, a]));
  return events.map((e) => ({
    ...e,
    source: !e.srcIp ? "none" : inv.internal.some((c) => inRange(e.srcIp!, c)) ? "internal" : "external",
    srcAsset: e.srcIp ? assets.get(e.srcIp) : undefined,
    account: e.user ? accounts.get(e.user) : undefined,
    techniques: e.mitre.map((t) => TECHNIQUES[t] ? `${t} ${TECHNIQUES[t]}` : t),
  }));
}
