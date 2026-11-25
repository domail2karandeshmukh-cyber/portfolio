// The human side: an audit log that shows if it was altered, and a queue where a named analyst approves or rejects
// each proposed action.
//
// There is no "execute" here, on purpose. An approved action is a recorded decision for a person or a later,
// separately reviewed connector to carry out. Nothing in this project can change a system.
import { sha256 } from "./sha256.ts";
import type { Proposal } from "./types.ts";

export type AuditEntry = { seq: number; time: string; actor: string; action: string; details: unknown; prev: string; hash: string };
const digest = (e: Omit<AuditEntry, "hash">) => sha256(JSON.stringify([e.seq, e.time, e.actor, e.action, e.details, e.prev]));

/** An append-only log. Each entry carries the hash of the one before, so a changed or removed entry breaks the chain. */
export class AuditLog {
  #entries: AuditEntry[] = [];
  #clock: () => Date;
  constructor(clock: () => Date = () => new Date()) { this.#clock = clock; }
  append(actor: string, action: string, details: unknown = {}): AuditEntry {
    if (!actor.trim() || !action.trim()) throw new Error("An audit entry needs an actor and an action.");
    const base = { seq: this.#entries.length + 1, time: this.#clock().toISOString(), actor, action, details: structuredClone(details), prev: this.#entries.at(-1)?.hash ?? "" };
    const entry = Object.freeze({ ...base, hash: digest(base) });
    this.#entries.push(entry);
    return entry;
  }
  /** A copy: the log itself can't be reached from outside. */
  entries(): AuditEntry[] { return this.#entries.map((e) => structuredClone(e)); }
  /** Checks a list of entries, such as one read back from storage: the first broken entry's number, or 0 when the chain holds. */
  static verify(entries: AuditEntry[]): number {
    let prev = "";
    for (const [i, e] of entries.entries()) {
      const { hash, ...rest } = e;
      if (e.seq !== i + 1 || e.prev !== prev || digest(rest) !== hash) return i + 1;
      prev = hash;
    }
    return 0;
  }
}

export type Status = "proposed" | "approved" | "rejected";
export type QueuedAction = Proposal & { id: string; incidentId: string; status: Status; proposedBy: string; decidedBy?: string; reason?: string };

/** Who may not decide: the triagers themselves. A proposal is decided by a person, by name. */
const MACHINE = /^(baseline|model|system|auto|bot|agent)\b/i;

export class ActionQueue {
  #items = new Map<string, QueuedAction>();
  #audit: AuditLog;
  constructor(audit: AuditLog) { this.#audit = audit; }
  propose(incidentId: string, proposal: Proposal, proposedBy: string): QueuedAction {
    const item: QueuedAction = { ...proposal, id: `ACT-${String(this.#items.size + 1).padStart(3, "0")}`, incidentId, status: "proposed", proposedBy };
    this.#items.set(item.id, item);
    this.#audit.append(proposedBy, "action.proposed", { id: item.id, incidentId, type: item.type, target: item.target, because: item.because });
    return { ...item };
  }
  decide(id: string, analyst: string, decision: "approve" | "reject", reason: string): QueuedAction {
    const item = this.#items.get(id);
    if (!item) throw new Error(`There is no action ${id}.`);
    if (item.status !== "proposed") throw new Error(`Action ${id} was already ${item.status} by ${item.decidedBy}.`);
    if (!analyst.trim() || MACHINE.test(analyst.trim())) throw new Error("An action is decided by a named analyst, not by a triager or the system.");
    if (analyst.trim() === item.proposedBy) throw new Error("Whoever proposed an action can't decide it.");
    if (reason.trim().length < 10) throw new Error("Give the reason for the decision in a sentence.");
    item.status = decision === "approve" ? "approved" : "rejected";
    item.decidedBy = analyst.trim(); item.reason = reason.trim();
    this.#audit.append(item.decidedBy, `action.${item.status}`, { id, reason: item.reason });
    return { ...item };
  }
  list(status?: Status): QueuedAction[] { return [...this.#items.values()].filter((i) => !status || i.status === status).map((i) => ({ ...i })); }
}
