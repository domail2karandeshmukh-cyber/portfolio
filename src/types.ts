// The shapes that pass between the stages of the pipeline. Plain types only, so Node runs these files as they are.

/** What a Wazuh alert looks like on the way in. Everything is unknown until normalize() has checked it. */
export type RawAlert = Record<string, unknown>;

export type EventKind =
  | "auth_failed" | "auth_success" | "brute_force" | "account_created" | "privilege_change"
  | "port_scan" | "web_shell" | "malware" | "malware_test" | "other";

/** One alert after checking: only the fields the pipeline uses, each validated and bounded. */
export type SecurityEvent = {
  id: string;
  time: number;            // milliseconds since 1970, UTC
  timeIso: string;
  ruleId: string;
  level: number;           // Wazuh's 0 to 16
  description: string;
  groups: string[];
  kind: EventKind;
  agent: string;
  srcIp?: string;
  user?: string;           // the account the event is about
  actor?: string;          // the account that did it, when the alert says
  detail?: string;         // a command, a file or a detection name
  mitre: string[];         // ATT&CK technique IDs named by the rule
  log: string;             // the log line, with secrets masked
};

export type Rejected = { index: number; reason: string };

export type Asset = { ip: string; name: string; role: string; owner: string; schedule?: { weekday: number; fromHour: number; toHour: number } };
export type Account = { name: string; kind: "human" | "service"; passwordLogin: boolean };
export type Change = { id: string; date: string; summary: string; hosts: string[]; covers: EventKind[]; subject?: string };
export type Training = { host: string; date: string; fromHour: number; toHour: number; summary: string };
export type Inventory = { internal: string[]; assets: Asset[]; accounts: Account[]; changes: Change[]; training: Training[] };

export type Enriched = SecurityEvent & {
  source: "internal" | "external" | "none";
  srcAsset?: Asset;
  account?: Account;
  techniques: string[];    // "T1110 Brute Force"
};

export type Incident = { id: string; events: Enriched[]; start: number; end: number; entities: string[] };

export type Verdict = "true_positive" | "false_positive" | "needs_review";
export type Severity = "low" | "medium" | "high" | "critical";
/** One reason for the verdict: what was seen, how much it counts, and which events show it. */
export type Factor = { id: string; weight: number; text: string; evidence: string[] };
export type ActionType = "disable_account" | "block_ip" | "isolate_host" | "notify_owner";
export type Proposal = { type: ActionType; target: string; because: string };
export type Usage = { inputTokens: number; outputTokens: number; costUsd: number };
export type Triage = {
  incidentId: string;
  verdict: Verdict;
  severity: Severity;
  score: number;
  factors: Factor[];
  summary: string;
  proposals: Proposal[];
  triager: string;
  usage: Usage;
};
/** Anything that can triage an incident: the rule-based baseline now, a model later. Both are measured the same way. */
export type Triager = { name: string; triage(incident: Incident, inventory: Inventory): Triage | Promise<Triage> };

export type Scenario = { id: string; title: string; expected: Verdict; alerts: RawAlert[] };
