// Writes the synthetic data: data/inventory.json and data/scenarios.json.   node data/build.ts
//
// Everything is invented. Addresses are from the ranges reserved for documentation (RFC 5737), the hosts and accounts
// don't exist, and no line comes from a real system. The alerts are shaped like Wazuh's alert JSON (timestamp, rule
// with id, level, description, groups and mitre, agent, data, full_log), and the rule groups are the ones this
// pipeline reads. The rule IDs and descriptions imitate Wazuh's default rules from memory and were not checked
// against a running Wazuh manager: treat them as placeholders until real, redacted alerts replace this file.
import { writeFileSync } from "node:fs";
import type { Inventory, RawAlert, Scenario } from "../src/types.ts";

const DAY = "2026-11-12"; // a Thursday
const at = (hhmmss: string) => `${DAY}T${hhmmss}.000+0000`;
let n = 0;
type Rule = [id: string, level: number, description: string, groups: string[], mitre?: string[]];
const R: Record<string, Rule> = {
  fail: ["5716", 5, "sshd: authentication failed.", ["syslog", "sshd", "authentication_failed"], ["T1110"]],
  brute: ["5763", 10, "sshd: brute force trying to get access to the system. Authentication failed.", ["syslog", "sshd", "authentication_failures"], ["T1110"]],
  ok: ["5715", 3, "sshd: authentication success.", ["syslog", "sshd", "authentication_success"], ["T1078"]],
  adduser: ["5902", 8, "New user added to the system.", ["syslog", "adduser"], ["T1136"]],
  sudoers: ["100210", 12, "User added to the sudo group.", ["syslog", "privilege_change"], ["T1098"]],
  scan: ["100220", 8, "Port scan detected by the firewall.", ["firewall", "recon"], ["T1046"]],
  shell: ["100230", 13, "Web server process started a shell.", ["audit", "attack", "web_shell"], ["T1505.003", "T1059"]],
  virus: ["52502", 8, "ClamAV: virus detected.", ["clamd", "virus"]],
};
function alert(rule: keyof typeof R, time: string, agent: string, data: Record<string, string>, log: string): RawAlert {
  const [id, level, description, groups, mitre] = R[rule];
  return { timestamp: at(time), id: `A${String(++n).padStart(4, "0")}`, rule: { id, level, description, groups, ...(mitre ? { mitre: { id: mitre } } : {}) }, agent: { id: "001", name: agent }, manager: { name: "lab-wazuh" }, data, full_log: log, location: "synthetic" };
}
const fails = (ip: string, agent: string, users: string[], start: number, method = "password") => users.map((u, i) => {
  const t = `11:${String(start + i).padStart(2, "0")}:0${i % 6}`;
  return alert("fail", t, agent, { srcip: ip, dstuser: u }, `sshd[2${100 + i}]: Failed ${method} for ${u} from ${ip} port ${42000 + i} ssh2`);
});
const login = (ip: string, agent: string, user: string, time: string) => alert("ok", time, agent, { srcip: ip, dstuser: user }, `sshd[2200]: Accepted password for ${user} from ${ip} port 42071 ssh2`);

const inventory: Inventory = {
  internal: ["192.0.2.0/24"],
  assets: [
    { ip: "192.0.2.50", name: "lab-scan01", role: "vulnerability_scanner", owner: "security team", schedule: { weekday: 4, fromHour: 14, toHour: 15 } },
    { ip: "192.0.2.10", name: "lab-backup01", role: "backup_server", owner: "infrastructure team" },
    { ip: "192.0.2.80", name: "lab-web01", role: "web_server", owner: "web team" },
    { ip: "192.0.2.90", name: "lab-db01", role: "db_server", owner: "data team" },
    { ip: "192.0.2.31", name: "pc-maria", role: "workstation", owner: "maria" },
  ],
  accounts: [
    { name: "deploy", kind: "service", passwordLogin: false }, { name: "backup", kind: "service", passwordLogin: false },
    { name: "maria", kind: "human", passwordLogin: true }, { name: "root", kind: "service", passwordLogin: false },
  ],
  changes: [
    { id: "CHG-1042", date: "2026-11-11", summary: "Backup server's SSH key replaced; lab-db01 still to update.", hosts: ["lab-db01"], covers: ["auth_failed", "brute_force"] },
    { id: "CHG-1050", date: "2026-11-12", summary: "Create the account svc-metrics on lab-db01 for the monitoring agent.", hosts: ["lab-db01"], covers: ["account_created"], subject: "svc-metrics" },
  ],
  training: [{ host: "train-pc07", date: "2026-11-12", fromHour: 10, toHour: 12, summary: "Security awareness workshop, with the EICAR test file" }],
};

const ATTACKER = "203.0.113.45";
const scan = (ip: string, time: string) => alert("scan", time, "lab-fw01", { srcip: ip, detail: "1,024 ports in 40 seconds against 192.0.2.80 and 192.0.2.90" }, `fw: DROP src=${ip} dst=192.0.2.80 dpt=23 (and 1,023 more)`);
const scenarios: Scenario[] = [
  { id: "guessing-then-success", title: "Password guessing that ends in a login", expected: "true_positive",
    alerts: [...fails(ATTACKER, "lab-web01", ["root", "root", "admin", "deploy", "root", "deploy", "deploy", "root", "deploy"], 40), login(ATTACKER, "lab-web01", "deploy", "11:49:31")] },
  { id: "persistence-after-login", title: "A login from outside, then a new administrator", expected: "true_positive",
    alerts: [login(ATTACKER, "lab-web01", "deploy", "11:49:31"),
      alert("adduser", "11:58:02", "lab-web01", { dstuser: "svc-update", srcuser: "deploy" }, "useradd[3310]: new user: name=svc-update, UID=1010"),
      alert("sudoers", "11:58:20", "lab-web01", { dstuser: "svc-update", srcuser: "deploy", command: "/usr/sbin/usermod -aG sudo svc-update" }, "sudo: deploy : COMMAND=/usr/sbin/usermod -aG sudo svc-update")] },
  { id: "web-shell", title: "A web server that starts a shell", expected: "true_positive",
    alerts: [alert("shell", "12:03:11", "lab-web01", { srcip: ATTACKER, srcuser: "www-data", command: "/bin/sh -c 'id; uname -a'" }, "audit: exe=/bin/sh ppid=nginx uid=www-data")] },
  { id: "malware-on-workstation", title: "Malware on a workstation", expected: "true_positive",
    alerts: [alert("virus", "15:22:40", "pc-maria", { virus: "Win.Trojan.Example-1", file: "C:\\Users\\maria\\Downloads\\invoice.exe" }, "clamd: C:\\Users\\maria\\Downloads\\invoice.exe: Win.Trojan.Example-1 FOUND")] },
  { id: "scanner-on-schedule", title: "The organization's scanner, on its schedule", expected: "false_positive", alerts: [scan("192.0.2.50", "14:00:05")] },
  { id: "backup-key-replaced", title: "A backup job that broke after a planned change", expected: "false_positive",
    alerts: ["02:00:01", "02:00:03", "02:00:05", "02:00:07", "02:00:09"].map((t) => alert("fail", t, "lab-db01", { srcip: "192.0.2.10", dstuser: "backup" }, "sshd[1800]: Failed publickey for backup from 192.0.2.10 port 40122 ssh2")) },
  { id: "eicar-in-training", title: "The antivirus test file, during the workshop that uses it", expected: "false_positive",
    alerts: [alert("virus", "10:20:00", "train-pc07", { virus: "Eicar-Test-Signature", file: "C:\\Users\\student\\Downloads\\eicar.com" }, "clamd: eicar.com: Eicar-Test-Signature FOUND")] },
  { id: "mistyped-password", title: "One wrong password, then the right one, from the usual computer", expected: "false_positive",
    alerts: [alert("fail", "09:02:17", "lab-web01", { srcip: "192.0.2.31", dstuser: "maria" }, "sshd[2105]: Failed password for maria from 192.0.2.31 port 50890 ssh2"), login("192.0.2.31", "lab-web01", "maria", "09:02:25")] },
  { id: "planned-account", title: "A new account that a change ticket covers", expected: "false_positive",
    alerts: [alert("adduser", "16:05:00", "lab-db01", { dstuser: "svc-metrics", srcuser: "root" }, "useradd[4100]: new user: name=svc-metrics, UID=1011")] },
  { id: "guessing-no-success", title: "Password guessing from outside that didn't get in", expected: "needs_review",
    alerts: fails("198.51.100.77", "lab-web01", ["oracle", "admin", "test", "guest", "root", "ubuntu"], 10) },
  { id: "scanner-off-schedule", title: "The organization's scanner, at the wrong time", expected: "needs_review", alerts: [scan("192.0.2.50", "03:12:00")] },
  { id: "scan-from-outside", title: "A port scan from an address nobody knows", expected: "needs_review", alerts: [scan("198.51.100.23", "06:14:00")] },
];

writeFileSync(new URL("./inventory.json", import.meta.url), JSON.stringify(inventory, null, 1) + "\n");
writeFileSync(new URL("./scenarios.json", import.meta.url), JSON.stringify(scenarios, null, 1) + "\n");
console.log(`${scenarios.length} scenarios, ${scenarios.reduce((s, x) => s + x.alerts.length, 0)} alerts`);
