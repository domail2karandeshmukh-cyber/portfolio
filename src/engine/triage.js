/* CyberAtlas alert triage lab.

   Six invented alerts, shaped like the alerts of a SIEM such as Wazuh (a rule with a level and a description, the
   agent that reported it, the fields the rule read), each with the log lines behind it and the context an analyst
   would look up. The learner decides two things for each: is it a real attack or a false alarm, and what to do. The
   marking is in this file, so the same decisions always get the same result.

   Nothing here comes from a real system. Addresses are from the ranges reserved for documentation (RFC 5737), and
   the rule numbers are invented: they are not Wazuh's.

   Used in the browser (window.CATriage) and in Node for the tests (module.exports). */
(function (root) {
  "use strict";

  var VERDICTS = [{ id: "tp", name: "Real attack (true positive)" }, { id: "fp", name: "False alarm (false positive)" }];
  var ACTIONS = [{ id: "escalate", name: "Escalate as an incident" }, { id: "close", name: "Close, and write down why" }];

  var ALERTS = [
    {
      id: "a1", time: "12 Nov, 11:49", level: 10, rule: "L-5712", title: "Several failed SSH logins, then a success", agent: "lab-web01",
      fields: { "source address": "203.0.113.45", user: "deploy", "failed attempts": "9 in 9 minutes" },
      evidence: ["sshd: Failed password for root from 203.0.113.45 (x4)", "sshd: Failed password for deploy from 203.0.113.45 (x4)", "sshd: Accepted password for deploy from 203.0.113.45"],
      context: "203.0.113.45 is outside the organization. The shift notes say nobody should log in as deploy with a password.",
      verdict: "tp", action: "escalate",
      why: "Guessing that ends in a success is a break-in until proven otherwise. The address is external and the account isn’t meant to accept passwords. Escalate, so that the account is locked and the session examined.",
    },
    {
      id: "a2", time: "12 Nov, 02:00", level: 5, rule: "L-5710", title: "Failed SSH logins for a service account", agent: "lab-db01",
      fields: { "source address": "192.0.2.10", user: "backup", "failed attempts": "3" },
      evidence: ["sshd: Failed publickey for backup from 192.0.2.10 (x3)", "cron on 192.0.2.10: backup job started 02:00:00"],
      context: "192.0.2.10 is the organization’s backup server. A change ticket from yesterday says its SSH key was replaced and “lab-db01 still to update”.",
      verdict: "fp", action: "close",
      why: "The source is the backup server, at the minute its job starts, with a key the ticket says isn’t installed on this host yet. It’s a broken job, not an attack. Close it, name the ticket, and tell the team that owns the backup: the job is failing.",
    },
    {
      id: "a3", time: "12 Nov, 11:58", level: 12, rule: "L-5902", title: "New user added to the sudo group", agent: "lab-web01",
      fields: { "new user": "svc-update", "added by": "deploy", group: "sudo" },
      evidence: ["useradd: new user: name=svc-update, UID=1010", "usermod: add 'svc-update' to group 'sudo'", "sudo: deploy : COMMAND=/usr/sbin/usermod -aG sudo svc-update"],
      context: "No change ticket mentions a new account. The command was run nine minutes after the deploy login in the first alert.",
      verdict: "tp", action: "escalate",
      why: "An unplanned administrator account, created by the account that was just broken into, is an attacker making sure they can come back. Escalate and link it to the first alert: it is the same incident.",
    },
    {
      id: "a4", time: "12 Nov, 14:00", level: 8, rule: "L-4012", title: "Port scan against the server network", agent: "lab-fw01",
      fields: { "source address": "192.0.2.50", "ports tried": "1,024 in 40 seconds", targets: "192.0.2.80, 192.0.2.90" },
      evidence: ["fw: DROP src=192.0.2.50 dst=192.0.2.80 dpt=23", "fw: DROP src=192.0.2.50 dst=192.0.2.80 dpt=25", "fw: ... 1,022 more"],
      context: "The asset inventory lists 192.0.2.50 as the vulnerability scanner. Its schedule says: server network, Thursdays at 14:00. 12 November is a Thursday.",
      verdict: "fp", action: "close",
      why: "It is the organization’s own scanner, on its own schedule, against its own targets. Close it with the inventory entry as the reason. If the same scan came from an address that isn’t in the inventory, or at another time, it would be worth an analyst’s hour.",
    },
    {
      id: "a5", time: "12 Nov, 12:03", level: 13, rule: "L-8101", title: "Web server process started a shell", agent: "lab-web01",
      fields: { parent: "nginx (www-data)", command: "/bin/sh -c 'id; uname -a'", "source address": "203.0.113.45" },
      evidence: ["audit: exe=/bin/sh ppid=nginx uid=www-data", 'nginx access: 203.0.113.45 "POST /upload.php" 200', "audit: exe=/usr/bin/id uid=www-data"],
      context: "A web server answers requests; it has no reason to start a shell and ask who it is. The request came from the address of the first alert.",
      verdict: "tp", action: "escalate",
      why: "A web server that starts a shell is running commands for someone else. “id” and “uname” are what a person types first on a machine they have just got into. Escalate: the web application is being used to run commands.",
    },
    {
      id: "a6", time: "12 Nov, 10:20", level: 7, rule: "L-7501", title: "Malware test file detected", agent: "train-pc07",
      fields: { file: "C:\\Users\\student\\Downloads\\eicar.com", detection: "EICAR-Test-File", action: "quarantined" },
      evidence: ["av: detected EICAR-Test-File in eicar.com", "av: file quarantined"],
      context: "train-pc07 is in the training room. Today’s calendar has “Security awareness workshop, 10:00 to 12:00”, whose exercise is to download the EICAR test file. EICAR is a harmless file that antivirus products agree to detect, made for testing them.",
      verdict: "fp", action: "close",
      why: "The detection is correct and harmless: a test file, on a training computer, during the workshop that uses it. Close it with the workshop as the reason. The antivirus did its job, which is what the exercise shows.",
    },
  ];

  /** Marks the decisions: { a1: { verdict, action }, ... } in; { score, total, passed, results: [{ id, verdict, action, correct, why }] } out.
      An alert counts when both its verdict and its action are right. Five of six passes. */
  function grade(decisions) {
    var results = ALERTS.map(function (a) {
      var d = (decisions || {})[a.id] || {};
      return { id: a.id, verdict: d.verdict === a.verdict, action: d.action === a.action, correct: d.verdict === a.verdict && d.action === a.action, answered: !!(d.verdict && d.action), why: a.why };
    });
    var score = results.filter(function (r) { return r.correct; }).length;
    return { score: score, total: ALERTS.length, passed: score >= ALERTS.length - 1, results: results };
  }

  var api = { ALERTS: ALERTS, VERDICTS: VERDICTS, ACTIONS: ACTIONS, grade: grade };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.CATriage = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
