/* CyberAtlas firewall simulator.

   A model of a packet filter for the lab "Write the firewall rules": four zones, a list of rules read from the top,
   the first rule that matches decides, and a packet that matches no rule is dropped (default deny). Nothing is sent
   anywhere: a "packet" is three words, and the result is worked out in this file. The same rules always give the
   same result, so the lab can be graded.

   Used in the browser (window.CAFirewall) and in Node for the tests (module.exports). */
(function (root) {
  "use strict";

  var ZONES = [
    { id: "internet", name: "Internet", detail: "Anyone outside. Addresses like 203.0.113.0/24 in this lab." },
    { id: "admin", name: "Admin network", detail: "The administrators’ computers, 192.0.2.0/27." },
    { id: "web", name: "Web server", detail: "lab-web01, 192.0.2.80. Serves the site over HTTPS." },
    { id: "db", name: "Database server", detail: "lab-db01, 192.0.2.90. PostgreSQL, for the web server only." },
  ];
  var PORTS = [
    { id: "22", name: "22 (SSH)" }, { id: "443", name: "443 (HTTPS)" }, { id: "5432", name: "5432 (PostgreSQL)" },
  ];
  /* The policy the rules have to meet. Each line is one test packet and what must happen to it. */
  var POLICY = [
    { src: "internet", dst: "web", port: "443", want: "allow", text: "Anyone can reach the website over HTTPS." },
    { src: "internet", dst: "web", port: "22", want: "deny", text: "Nobody on the internet can reach SSH on the web server." },
    { src: "admin", dst: "web", port: "22", want: "allow", text: "Administrators can reach SSH on the web server." },
    { src: "web", dst: "db", port: "5432", want: "allow", text: "The web server can query the database." },
    { src: "internet", dst: "db", port: "5432", want: "deny", text: "Nobody on the internet can reach the database." },
    { src: "admin", dst: "db", port: "5432", want: "deny", text: "Administrators don’t query the database directly: only the web server does." },
    { src: "internet", dst: "admin", port: "22", want: "deny", text: "Nothing from the internet reaches the admin network." },
    { src: "web", dst: "admin", port: "22", want: "deny", text: "A compromised web server can’t reach back into the admin network." },
  ];

  function known(list, id) { return id === "any" || list.some(function (x) { return x.id === id; }); }
  /** Keeps only well-formed rules, so a rule typed or stored wrongly can never match by accident. */
  function clean(rules) {
    return (Array.isArray(rules) ? rules : []).filter(function (r) {
      return r && (r.action === "allow" || r.action === "deny") && known(ZONES, r.src) && known(ZONES, r.dst) && known(PORTS, r.port);
    }).slice(0, 20);
  }
  function matches(rule, packet) {
    return (rule.src === "any" || rule.src === packet.src) && (rule.dst === "any" || rule.dst === packet.dst) && (rule.port === "any" || rule.port === String(packet.port));
  }
  /** What happens to a packet: { action, rule } where rule is the number (from 1) of the rule that decided, or 0 for the default deny. */
  function evaluate(rules, packet) {
    var list = clean(rules);
    for (var i = 0; i < list.length; i++) if (matches(list[i], packet)) return { action: list[i].action, rule: i + 1 };
    return { action: "deny", rule: 0 };
  }
  /** Runs the policy's packets through the rules: { score, total, passed, results: [{ ...policy line, got, rule, correct }] }. */
  function grade(rules) {
    var results = POLICY.map(function (p) {
      var r = evaluate(rules, p);
      return { src: p.src, dst: p.dst, port: p.port, want: p.want, text: p.text, got: r.action, rule: r.rule, correct: r.action === p.want };
    });
    var score = results.filter(function (r) { return r.correct; }).length;
    return { score: score, total: POLICY.length, passed: score === POLICY.length, results: results };
  }
  /** One short answer that passes, for the tests and for "Show a solution". */
  var SOLUTION = [
    { action: "allow", src: "internet", dst: "web", port: "443" },
    { action: "allow", src: "admin", dst: "web", port: "22" },
    { action: "allow", src: "web", dst: "db", port: "5432" },
  ];

  var api = { ZONES: ZONES, PORTS: PORTS, POLICY: POLICY, SOLUTION: SOLUTION, clean: clean, evaluate: evaluate, grade: grade };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.CAFirewall = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
