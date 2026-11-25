// The lab engines and the content, checked in Node with its own test runner: node --test tests/
const test = require("node:test");
const assert = require("node:assert/strict");
const T = require("../src/engine/terminal.js");
const F = require("../src/engine/firewall.js");
const G = require("../src/engine/triage.js");
const C = require("../src/content.js");

test("content: three modules, ten lessons, three labs", () => {
  assert.equal(C.MODULES.length, 3);
  const lessons = C.MODULES.flatMap((m) => m.lessons);
  assert.equal(lessons.length, 10);
  assert.equal(new Set(lessons).size, 10, "a lesson is in one module only");
  assert.deepEqual(Object.keys(C.LESSONS).sort(), lessons.slice().sort(), "every lesson is in a module, and every listed lesson exists");
  for (const m of C.MODULES) assert.ok(C.LABS[m.lab] && C.LABS[m.lab].module === m.id, `${m.id} has its lab`);
});
test("content: every quiz question has one right answer among its options, and says why", () => {
  for (const [id, l] of Object.entries(C.LESSONS)) {
    assert.ok(l.body.length >= 4, `${id} has a body`);
    assert.equal(l.quiz.length, 3, `${id} has three questions`);
    for (const q of l.quiz) {
      assert.equal(q.options.length, 4, `${id}: four options`);
      assert.equal(new Set(q.options).size, 4, `${id}: options differ`);
      assert.ok(Number.isInteger(q.answer) && q.answer >= 0 && q.answer < 4, `${id}: the answer is one of the options`);
      assert.ok(q.why.length > 20, `${id}: the answer is explained`);
    }
  }
});
test("content: block types are the four the app draws", () => {
  for (const l of Object.values(C.LESSONS)) for (const b of l.body) assert.ok(["p", "h", "code", "list"].includes(b[0]));
});
test("content: every address in a lesson or a lab is private or reserved for documentation", () => {
  const text = JSON.stringify(C) + JSON.stringify(G.ALERTS) + T.create().exec("cat /var/log/auth.log /var/log/nginx/access.log /home/analyst/notes.txt").out + JSON.stringify(F.ZONES);
  const ok = /^(192\.0\.2\.|198\.51\.100\.|203\.0\.113\.|10\.|172\.16\.|192\.168\.|8\.8\.8\.8$)/; // 8.8.8.8 is a quiz option, named as a public address
  for (const ip of text.match(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g)) assert.match(ip, ok, ip);
});
test("content: the roadmap names modules that exist and promises nothing", () => {
  for (const r of C.ROADMAP) for (const h of r.helps) assert.ok(C.MODULES.some((m) => m.id === h));
  assert.doesNotMatch(JSON.stringify(C.ROADMAP), /guarantee|free exam|will pass/i);
});

test("terminal: moves around and reads files", () => {
  const s = T.create();
  assert.equal(s.exec("pwd").out, "/home/analyst\n");
  assert.equal(s.exec("ls").out, "notes.txt\nreadme.txt\n");
  assert.equal(s.exec("cd /var/log").err, "");
  assert.equal(s.cwd(), "/var/log");
  assert.equal(s.exec("ls").out, "auth.log\nnginx/\n");
  assert.equal(s.exec("cd ..").err, ""); assert.equal(s.cwd(), "/var");
  assert.equal(s.exec("cd").err, ""); assert.equal(s.cwd(), "/home/analyst");
  assert.equal(s.exec("cat /etc/hostname").out, "lab-web01\n");
  assert.match(s.exec("cat nothing.txt").err, /No such file/);
  assert.match(s.exec("cd readme.txt").err, /Not a directory/);
  assert.match(s.exec("cat /etc").err, /Is a directory/);
});
test("terminal: filters and pipes", () => {
  const s = T.create(), log = "/var/log/auth.log";
  assert.equal(s.exec(`grep -c "Failed password" ${log}`).out, "13\n");
  assert.equal(s.exec(`grep Failed ${log} | wc -l`).out, "13\n");
  assert.equal(s.exec(`grep Failed ${log} | grep -c 203.0.113.45`).out, "9\n");
  assert.equal(s.exec(`grep -v Failed ${log} | grep -c Accepted`).out, "5\n");
  assert.equal(s.exec(`grep -i ACCEPTED ${log} | grep 203.0.113.45 | wc -l`).out, "1\n");
  assert.equal(s.exec(`head -n 1 ${log}`).out.split("\n").length, 2);
  assert.match(s.exec(`tail -n 1 ${log}`).out, /17:45:10/);
  assert.equal(s.exec("echo b | sort").out, "b\n");
  assert.equal(s.exec(`cat /etc/passwd | cut -d : -f 1 | sort | head -n 2`).out, "analyst\nbackup\n");
  assert.match(s.exec(`grep Accepted ${log} | cut -d " " -f 9 | sort | uniq -c`).out, /3 maria/);
});
test("terminal: only the listed commands exist, and nothing can be chained, redirected or written", () => {
  const s = T.create();
  for (const c of ["rm -rf /", "sudo su", "curl http://example.com", "bash", "python3 -c 1", "nc 192.0.2.1 22", "chmod 777 x", "vi notes.txt"]) assert.match(s.exec(c).err, /command not found/, c);
  for (const c of ["ls; rm x", "cat a > b", "ls && ls", "echo $(id)", "echo `id`", "cat < x"]) assert.match(s.exec(c).err, /simulator runs one command/, c);
  assert.match(s.exec('echo "open').err, /quote/);
  assert.match(s.exec("x".repeat(401)).err, /too long/);
  assert.equal(s.exec("cat /home/analyst/notes.txt").out, T.create().exec("cat /home/analyst/notes.txt").out, "the files are the same after all that");
  assert.equal(s.exec("").out, "");
  assert.equal(s.exec("clear").clear, true);
  assert.ok(T.COMMANDS.every((c) => !T.create().exec(c + " --zzz").err.includes("command not found")), "every listed command exists");
});
test("terminal lab: the answers come from the log, and the marking is exact", () => {
  const a = Object.fromEntries(T.lab().questions.map((q) => [q.id, q.answer]));
  assert.deepEqual(a, { failed: "13", source: "203.0.113.45", account: "deploy" });
  assert.equal(T.grade(a).passed, true);
  assert.equal(T.grade({ failed: " 13 ", source: "203.0.113.45", account: "DEPLOY" }).passed, true, "spaces and capitals don't matter");
  assert.equal(T.grade({ failed: "12", source: "203.0.113.45", account: "deploy" }).score, 2);
  assert.equal(T.grade({}).score, 0);
  assert.equal(T.grade(null).passed, false);
  assert.deepEqual(T.grade(a), T.grade(a), "the same answers get the same marks");
});

test("firewall: first match wins and the default is deny", () => {
  const p = { src: "internet", dst: "web", port: "22" };
  assert.deepEqual(F.evaluate([], p), { action: "deny", rule: 0 });
  assert.deepEqual(F.evaluate([{ action: "allow", src: "any", dst: "web", port: "any" }, { action: "deny", src: "internet", dst: "web", port: "22" }], p), { action: "allow", rule: 1 });
  assert.deepEqual(F.evaluate([{ action: "deny", src: "internet", dst: "web", port: "22" }, { action: "allow", src: "any", dst: "web", port: "any" }], p), { action: "deny", rule: 1 });
  assert.equal(F.evaluate([{ action: "allow", src: "admin", dst: "web", port: "22" }], p).action, "deny", "a rule for another source doesn't fit");
});
test("firewall: a rule that isn't well formed never matches", () => {
  const p = { src: "internet", dst: "db", port: "5432" };
  for (const bad of [null, "allow all", { action: "permit", src: "any", dst: "any", port: "any" }, { action: "allow", src: "everyone", dst: "any", port: "any" }, { action: "allow", src: "any", dst: "any", port: "80" }, { action: "allow" }]) {
    assert.equal(F.evaluate([bad], p).action, "deny");
  }
  assert.equal(F.evaluate("not a list", p).action, "deny");
  assert.equal(F.clean(new Array(50).fill({ action: "deny", src: "any", dst: "any", port: "any" })).length, 20);
});
test("firewall lab: the short solution passes, and the usual mistakes don't", () => {
  assert.equal(F.grade(F.SOLUTION).passed, true);
  assert.equal(F.grade([]).passed, false, "no rules: the allowed traffic is dropped");
  assert.equal(F.grade([{ action: "allow", src: "any", dst: "any", port: "any" }]).passed, false, "allow everything");
  const wide = F.grade([{ action: "allow", src: "any", dst: "web", port: "any" }, ...F.SOLUTION]);
  assert.equal(wide.passed, false);
  assert.ok(wide.results.some((r) => !r.correct && r.src === "internet" && r.port === "22"), "a wide rule opens SSH to the internet");
  assert.equal(F.grade([...F.SOLUTION, { action: "allow", src: "admin", dst: "db", port: "5432" }]).passed, false, "admins reach the database");
  assert.equal(F.grade(F.SOLUTION.slice().reverse()).passed, true, "these three don't overlap, so their order is free");
  assert.equal(F.POLICY.filter((p) => p.want === "allow").length, 3);
});

test("triage: the right decisions pass, five of six pass, four don't", () => {
  const right = Object.fromEntries(G.ALERTS.map((a) => [a.id, { verdict: a.verdict, action: a.action }]));
  assert.deepEqual([G.grade(right).score, G.grade(right).passed], [6, true]);
  const one = { ...right, a4: { verdict: "tp", action: "escalate" } };
  assert.deepEqual([G.grade(one).score, G.grade(one).passed], [5, true]);
  const two = { ...one, a1: { verdict: "fp", action: "close" } };
  assert.deepEqual([G.grade(two).score, G.grade(two).passed], [4, false]);
  assert.equal(G.grade({ ...right, a1: { verdict: "tp", action: "close" } }).results[0].correct, false, "the right verdict with the wrong action doesn't count");
  assert.deepEqual([G.grade({}).score, G.grade(null).score], [0, 0]);
  assert.equal(G.grade({}).results.every((r) => !r.answered), true);
});
test("triage: the alerts are a fair set", () => {
  assert.equal(G.ALERTS.length, 6);
  assert.equal(G.ALERTS.filter((a) => a.verdict === "tp").length, 3, "half are real");
  for (const a of G.ALERTS) {
    assert.ok(a.evidence.length >= 2 && a.context.length > 40 && a.why.length > 60, a.id);
    assert.equal(a.action, a.verdict === "tp" ? "escalate" : "close", `${a.id}: a real attack is escalated, a false alarm closed`);
  }
  assert.equal(new Set(G.ALERTS.map((a) => a.id)).size, 6);
});
