/* CyberAtlas: the pages. One HTML file, no framework and no server: the address after # picks the page
   (#/lesson/files, #/lab/firewall, #/roadmap), and progress is kept in this browser only.

   Everything shown comes from content.js and the three lab engines. Text from them is escaped before it is put in
   the page. The labs are simulations worked out in the browser: no command runs, no packet is sent. */
(function () {
  "use strict";
  var C = window.CAContent, T = window.CATerminal, F = window.CAFirewall, G = window.CATriage;
  var main = document.getElementById("main"), live = document.getElementById("live");

  /* ---------- Progress: in this browser, or in memory when the browser won't store it ---------- */
  var KEY = "cyberatlas.v1", mem = null;
  function load() {
    try { var t = window.localStorage.getItem(KEY); if (t) return JSON.parse(t); } catch (e) { /* private mode, or blocked */ }
    return mem || { lessons: {}, labs: {} };
  }
  function save(p) { mem = p; try { window.localStorage.setItem(KEY, JSON.stringify(p)); } catch (e) { /* kept in memory */ } }
  function reset() { mem = { lessons: {}, labs: {} }; try { window.localStorage.removeItem(KEY); } catch (e) { /* nothing stored */ } }
  var P = load();
  if (!P.lessons) P.lessons = {};
  if (!P.labs) P.labs = {};
  function done(kind, id) { if (!P[kind][id]) { P[kind][id] = true; save(P); } }

  /* ---------- Small helpers ---------- */
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  /** Escapes text, then turns `backquotes` into code. */
  function rich(s) { return esc(s).replace(/`([^`]+)`/g, "<code>$1</code>"); }
  function say(t) { live.textContent = ""; window.setTimeout(function () { live.textContent = t; }, 30); }
  function $(sel, el) { return (el || main).querySelector(sel); }
  function all(sel, el) { return Array.prototype.slice.call((el || main).querySelectorAll(sel)); }
  var ORDER = [];
  C.MODULES.forEach(function (m) { m.lessons.forEach(function (l) { ORDER.push(["lesson", l]); }); ORDER.push(["lab", m.lab]); });
  function href(step) { return "#/" + step[0] + "/" + step[1]; }
  function nameOf(step) { return step[0] === "lesson" ? C.LESSONS[step[1]].title : "Lab: " + C.LABS[step[1]].title; }
  function isDone(step) { return !!P[step[0] === "lesson" ? "lessons" : "labs"][step[1]]; }
  function pager(kind, id) {
    var i = ORDER.findIndex(function (s) { return s[0] === kind && s[1] === id; }), a = ORDER[i - 1], b = ORDER[i + 1];
    return '<nav class="pager" aria-label="Previous and next">' + (a ? '<a href="' + href(a) + '"><span>Previous</span>' + esc(nameOf(a)) + "</a>" : "<span></span>") +
      (b ? '<a class="next" href="' + href(b) + '"><span>Next</span>' + esc(nameOf(b)) + "</a>" : '<a class="next" href="#/roadmap"><span>Next</span>Certification roadmap</a>') + "</nav>";
  }
  function tick(yes) { return '<span class="tick' + (yes ? " on" : "") + '">' + (yes ? "Done" : "To do") + "</span>"; }

  /* ---------- Home ---------- */
  function home() {
    var total = ORDER.length, got = ORDER.filter(isDone).length;
    return '<h1 tabindex="-1">Learn cybersecurity by doing it</h1>' +
      '<p class="lead">Ten short lessons and three hands-on labs, from the Linux command line to triaging alerts like a security analyst. Free, in your browser, with nothing to install.</p>' +
      '<p class="note"><strong>A safe place to practise.</strong> Every lab is a simulation that runs on this page. No command reaches a real computer, no packet leaves your browser, and every address, account and alert is invented.</p>' +
      '<section aria-labelledby="prog-h" class="progress"><h2 id="prog-h">Your progress</h2><p><strong>' + got + " of " + total + '</strong> steps done.</p>' +
      '<div class="bar" role="img" aria-label="' + got + " of " + total + ' steps done"><i style="width:' + Math.round(got / total * 100) + '%"></i></div>' +
      '<p class="small">Progress is kept in this browser only. Nothing is sent anywhere, and there is no account.</p>' +
      '<button type="button" class="btn line" id="reset">Reset my progress</button></section>' +
      C.MODULES.map(function (m, i) {
        return '<section class="module" aria-labelledby="m-' + m.id + '"><p class="kicker">Module ' + (i + 1) + '</p><h2 id="m-' + m.id + '">' + esc(m.title) + "</h2><p>" + esc(m.blurb) + '</p><ol class="steps">' +
          m.lessons.map(function (l) { return '<li><a href="#/lesson/' + l + '">' + esc(C.LESSONS[l].title) + '</a><span class="meta">' + C.LESSONS[l].minutes + " min · 3 questions</span>" + tick(P.lessons[l]) + "</li>"; }).join("") +
          '<li class="lab"><a href="#/lab/' + m.lab + '">Lab: ' + esc(C.LABS[m.lab].title) + '</a><span class="meta">' + C.LABS[m.lab].minutes + " min · graded</span>" + tick(P.labs[m.lab]) + "</li></ol></section>";
      }).join("") +
      '<section class="module" aria-labelledby="road-h"><h2 id="road-h">Where this can lead</h2><p>Six certifications that learners often aim for, and which modules touch the same ground.</p><p><a class="btn line" href="#/roadmap">See the certification roadmap</a></p></section>';
  }
  function homeWire() {
    $("#reset").addEventListener("click", function () {
      if (!window.confirm("Reset your progress on this browser? Lessons and labs will show as not done.")) return;
      reset(); P = load(); render(); say("Progress reset.");
    });
  }

  /* ---------- Lessons and their quizzes ---------- */
  function block(b) {
    if (b[0] === "h") return "<h2>" + esc(b[1]) + "</h2>";
    if (b[0] === "code") return '<pre tabindex="0" aria-label="Example"><code>' + esc(b[1]) + "</code></pre>";
    if (b[0] === "list") return "<ul>" + b[1].map(function (i) { return "<li>" + rich(i) + "</li>"; }).join("") + "</ul>";
    return "<p>" + rich(b[1]) + "</p>";
  }
  function lesson(id) {
    var L = C.LESSONS[id], m = C.MODULES.filter(function (x) { return x.lessons.indexOf(id) >= 0; })[0];
    return '<p class="crumbs"><a href="#/">CyberAtlas</a> / ' + esc(m.title) + '</p><h1 tabindex="-1">' + esc(L.title) + '</h1><p class="meta">' + L.minutes + " minutes · " + (P.lessons[id] ? "Done" : "Not done yet") + "</p>" +
      '<div class="prose">' + L.body.map(block).join("") + "</div>" +
      '<section aria-labelledby="quiz-h" class="quiz"><h2 id="quiz-h">Check what you learned</h2><form id="quiz" novalidate>' +
      L.quiz.map(function (q, i) {
        return '<fieldset data-q="' + i + '"><legend>' + (i + 1) + ". " + esc(q.q) + "</legend>" + q.options.map(function (o, k) {
          return '<label><input type="radio" name="q' + i + '" value="' + k + '"> ' + esc(o) + "</label>";
        }).join("") + '<p class="fb" hidden></p></fieldset>';
      }).join("") + '<button class="btn ink" type="submit">Check my answers</button> <p class="result" role="status"></p></form></section>' + pager("lesson", id);
  }
  function lessonWire(id) {
    var L = C.LESSONS[id];
    $("#quiz").addEventListener("submit", function (e) {
      e.preventDefault();
      var right = 0, blank = 0;
      L.quiz.forEach(function (q, i) {
        var set = $('fieldset[data-q="' + i + '"]'), pick = $("input:checked", set), fb = $(".fb", set);
        fb.hidden = false;
        if (!pick) { blank++; fb.className = "fb bad"; fb.textContent = "Choose an answer."; return; }
        var good = +pick.value === q.answer;
        if (good) right++;
        fb.className = "fb " + (good ? "good" : "bad");
        // The reason is shown for a right answer. A wrong one gets a nudge, so the retry is still a question.
        fb.textContent = good ? "Correct. " + q.why : "Not that one. Read the lesson’s part on this and try again.";
      });
      var msg = blank ? "Answer every question, then check again." : right === L.quiz.length ? "All " + right + " correct. This lesson is done." : right + " of " + L.quiz.length + " correct. Change the others and check again.";
      $(".result").textContent = msg; say(msg);
      if (!blank && right === L.quiz.length) { done("lessons", id); $(".meta").textContent = L.minutes + " minutes · Done"; }
    });
  }

  /* ---------- Lab 1: the simulated shell ---------- */
  function labHead(id) {
    var L = C.LABS[id], m = C.MODULES.filter(function (x) { return x.id === L.module; })[0];
    return '<p class="crumbs"><a href="#/">CyberAtlas</a> / ' + esc(m.title) + '</p><h1 tabindex="-1">Lab: ' + esc(L.title) + '</h1><p class="meta">' + L.minutes + " minutes · graded · " + (P.labs[id] ? "Done" : "Not done yet") + '</p><p class="lead">' + esc(L.intro) + "</p>";
  }
  function shellLab() {
    var qs = T.lab().questions;
    return labHead("ssh-log") + '<section aria-labelledby="sh-h"><h2 id="sh-h">The shell</h2>' +
      '<div class="term"><div id="term-out" class="term-out" role="log" aria-live="polite" aria-label="Shell output" tabindex="0"></div>' +
      '<form id="term-form" class="term-in" autocomplete="off"><label for="term-cmd"><span id="term-ps">analyst@lab-web01:~$</span><span class="sr"> Command</span></label><input id="term-cmd" type="text" spellcheck="false" autocapitalize="off" autocorrect="off" maxlength="400"><button class="btn ink" type="submit">Run</button></form></div>' +
      '<p class="small">Type <code>help</code> for the commands. The up and down arrows bring back earlier commands. Start with <code>cat readme.txt</code>.</p></section>' +
      '<section aria-labelledby="ans-h"><h2 id="ans-h">Your findings</h2><form id="lab-form" novalidate>' + qs.map(function (q, i) {
        return '<div class="field" data-q="' + q.id + '"><label for="a-' + q.id + '">' + (i + 1) + ". " + esc(q.label) + '</label><input id="a-' + q.id + '" type="text" autocomplete="off" spellcheck="false"><button type="button" class="btn line sm hint" aria-expanded="false">Hint</button><p class="hint-text" hidden>' + rich(q.hint) + '</p><p class="fb" hidden></p></div>';
      }).join("") + '<button class="btn ink" type="submit">Check my findings</button> <p class="result" role="status"></p></form></section>' + pager("lab", "ssh-log");
  }
  function shellWire() {
    var sh = T.create(), out = $("#term-out"), cmd = $("#term-cmd"), past = [], at = 0;
    function print(text, cls) { if (!text) return; var d = document.createElement("div"); if (cls) d.className = cls; d.textContent = text.replace(/\n$/, ""); out.appendChild(d); }
    print("CyberAtlas lab shell. A simulator: type help.", "dim");
    $("#term-form").addEventListener("submit", function (e) {
      e.preventDefault();
      var text = cmd.value, r = sh.exec(text);
      print($("#term-ps").textContent + " " + text, "cmd");
      if (r.clear) out.textContent = ""; else { print(r.out); print(r.err, "err"); }
      if (text.trim()) past.push(text);
      at = past.length; cmd.value = "";
      $("#term-ps").textContent = "analyst@lab-web01:" + sh.cwd().replace(/^\/home\/analyst/, "~") + "$";
      out.scrollTop = out.scrollHeight;
    });
    cmd.addEventListener("keydown", function (e) {
      if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
      e.preventDefault();
      at = Math.max(0, Math.min(past.length, at + (e.key === "ArrowUp" ? -1 : 1)));
      cmd.value = past[at] || "";
    });
    all(".hint").forEach(function (b) { b.addEventListener("click", function () { var t = b.nextElementSibling; t.hidden = !t.hidden; b.setAttribute("aria-expanded", String(!t.hidden)); }); });
    $("#lab-form").addEventListener("submit", function (e) {
      e.preventDefault();
      var ans = {};
      all(".field").forEach(function (f) { ans[f.getAttribute("data-q")] = $("input", f).value; });
      var g = T.grade(ans);
      g.results.forEach(function (r) { var fb = $('.field[data-q="' + r.id + '"] .fb'); fb.hidden = false; fb.className = "fb " + (r.correct ? "good" : "bad"); fb.textContent = r.correct ? "Correct. " + r.why : "Not yet. Look at the log again, or open the hint."; });
      var msg = g.passed ? "All " + g.total + " findings are right. Lab done." : g.score + " of " + g.total + " right. Keep looking.";
      $("#lab-form .result").textContent = msg; say(msg);
      if (g.passed) done("labs", "ssh-log");
    });
  }

  /* ---------- Lab 2: firewall rules ---------- */
  function zoneName(id) { if (id === "any") return "Any"; return F.ZONES.filter(function (z) { return z.id === id; })[0].name; }
  function fwLab() {
    return labHead("firewall") + '<section aria-labelledby="net-h"><h2 id="net-h">The network</h2><figure class="net">' +
      '<svg viewBox="0 0 640 250" role="img" aria-label="Network diagram. A firewall in the middle connects four zones: the internet, the admin network, the web server and the database server. The list after the diagram describes each zone.">' +
      '<g class="wire"><path d="M170 62H230V110H270M170 188H230V140H270M470 62H410V110H370M470 188H410V140H370"/></g>' +
      '<g class="zone"><rect x="20" y="30" width="150" height="64" rx="8"/><text x="95" y="58">Internet</text><text class="sub" x="95" y="78">203.0.113.0/24</text></g>' +
      '<g class="zone"><rect x="20" y="156" width="150" height="64" rx="8"/><text x="95" y="184">Admin network</text><text class="sub" x="95" y="204">192.0.2.0/27</text></g>' +
      '<g class="zone"><rect x="470" y="30" width="150" height="64" rx="8"/><text x="545" y="58">Web server</text><text class="sub" x="545" y="78">192.0.2.80</text></g>' +
      '<g class="zone"><rect x="470" y="156" width="150" height="64" rx="8"/><text x="545" y="184">Database server</text><text class="sub" x="545" y="204">192.0.2.90</text></g>' +
      '<g class="fw"><rect x="270" y="92" width="100" height="66" rx="8"/><text x="320" y="130">Firewall</text></g></svg></figure>' +
      "<dl class=\"zones\">" + F.ZONES.map(function (z) { return "<div><dt>" + esc(z.name) + "</dt><dd>" + esc(z.detail) + "</dd></div>"; }).join("") + "</dl></section>" +
      '<section aria-labelledby="pol-h"><h2 id="pol-h">The policy</h2><ol class="policy">' + F.POLICY.map(function (p) { return "<li>" + esc(p.text) + "</li>"; }).join("") + "</ol></section>" +
      '<section aria-labelledby="rules-h"><h2 id="rules-h">Your rules</h2><p class="small">Read from the top. The first rule that fits a packet decides. A packet that fits no rule is dropped.</p>' +
      '<ol id="rules" class="rules"></ol><p><button type="button" class="btn line" id="add">Add a rule</button> <button type="button" class="btn ink" id="run">Run the test packets</button> <button type="button" class="btn line sm hint" id="fw-hint" aria-expanded="false">Hint</button></p>' +
      '<p class="hint-text" id="fw-hint-text" hidden>Start with no rules and run the tests: default deny already passes every “nobody can” line. Then add one narrow allow rule for each “can” line, naming the one source, the one destination and the one port.</p>' +
      '<p class="result" role="status" id="fw-result"></p><div id="fw-table"></div></section>' + pager("lab", "firewall");
  }
  function fwWire() {
    var rules = F.clean(P.fw || []);
    function opts(list, v, any) { return (any ? [{ id: "any", name: "Any" }] : []).concat(list).map(function (o) { return '<option value="' + o.id + '"' + (o.id === v ? " selected" : "") + ">" + esc(o.name) + "</option>"; }).join(""); }
    function draw(focus) {
      $("#rules").innerHTML = rules.length ? rules.map(function (r, i) {
        var n = i + 1;
        return '<li data-i="' + i + '"><span class="num">Rule ' + n + '</span>' +
          '<label><span class="sr">Rule ' + n + ' action</span><select data-k="action"><option value="allow"' + (r.action === "allow" ? " selected" : "") + '>Allow</option><option value="deny"' + (r.action === "deny" ? " selected" : "") + ">Deny</option></select></label>" +
          '<label>from <select data-k="src" aria-label="Rule ' + n + ' source">' + opts(F.ZONES, r.src, true) + "</select></label>" +
          '<label>to <select data-k="dst" aria-label="Rule ' + n + ' destination">' + opts(F.ZONES, r.dst, true) + "</select></label>" +
          '<label>port <select data-k="port" aria-label="Rule ' + n + ' port">' + opts(F.PORTS, r.port, true) + "</select></label>" +
          '<span class="acts"><button type="button" class="btn line sm" data-act="up" aria-label="Move rule ' + n + ' up"' + (i ? "" : " disabled") + '>Up</button><button type="button" class="btn line sm" data-act="down" aria-label="Move rule ' + n + ' down"' + (i < rules.length - 1 ? "" : " disabled") + '>Down</button><button type="button" class="btn line sm" data-act="del" aria-label="Delete rule ' + n + '">Delete</button></span></li>';
      }).join("") : '<li class="empty">No rules yet. With none, every packet is dropped.</li>';
      P.fw = rules; save(P);
      if (focus) { var el = $(focus); if (el) el.focus(); }
    }
    $("#add").addEventListener("click", function () {
      if (rules.length >= 20) { say("Twenty rules is the limit in this lab."); return; }
      rules.push({ action: "allow", src: "internet", dst: "web", port: "443" });
      draw('#rules li[data-i="' + (rules.length - 1) + '"] select'); say("Rule " + rules.length + " added.");
    });
    $("#rules").addEventListener("change", function (e) { var li = e.target.closest("li[data-i]"); if (!li) return; rules[+li.getAttribute("data-i")][e.target.getAttribute("data-k")] = e.target.value; P.fw = rules; save(P); });
    $("#rules").addEventListener("click", function (e) {
      var b = e.target.closest("button[data-act]"); if (!b) return;
      var i = +b.closest("li").getAttribute("data-i"), act = b.getAttribute("data-act");
      if (act === "del") { rules.splice(i, 1); draw("#add"); say("Rule deleted."); return; }
      var j = act === "up" ? i - 1 : i + 1, t = rules[i]; rules[i] = rules[j]; rules[j] = t;
      draw('#rules li[data-i="' + j + '"] [data-act="' + act + '"]:not([disabled])'); say("Rule moved to position " + (j + 1) + ".");
    });
    $("#fw-hint").addEventListener("click", function () { var t = $("#fw-hint-text"); t.hidden = !t.hidden; this.setAttribute("aria-expanded", String(!t.hidden)); });
    $("#run").addEventListener("click", function () {
      var g = F.grade(rules);
      $("#fw-table").innerHTML = '<div class="scroll" role="region" tabindex="0" aria-label="Test results"><table><caption>Test packets</caption><thead><tr><th scope="col">Packet</th><th scope="col">Policy</th><th scope="col">Your firewall</th><th scope="col">Decided by</th><th scope="col">Result</th></tr></thead><tbody>' +
        g.results.map(function (r) {
          return '<tr class="' + (r.correct ? "pass" : "fail") + '"><th scope="row">' + esc(zoneName(r.src)) + " to " + esc(zoneName(r.dst)) + ", port " + r.port + "</th><td>" + (r.want === "allow" ? "Allow" : "Deny") + "</td><td>" + (r.got === "allow" ? "Allowed" : "Dropped") + "</td><td>" + (r.rule ? "Rule " + r.rule : "No rule: default deny") + "</td><td>" + (r.correct ? "Pass" : "Fail") + "</td></tr>";
        }).join("") + "</tbody></table></div>";
      var msg = g.passed ? "All " + g.total + " test packets pass. Lab done." : g.score + " of " + g.total + " pass. Read the failed lines: which rule decided them?";
      $("#fw-result").textContent = msg; say(msg);
      if (g.passed) done("labs", "firewall");
    });
    draw();
  }

  /* ---------- Lab 3: triage ---------- */
  function triLab() {
    return labHead("triage") + '<form id="tri" novalidate>' + G.ALERTS.map(function (a, i) {
      function radios(kind, list) { return '<fieldset><legend>' + (kind === "verdict" ? "What is it?" : "What do you do?") + "</legend>" + list.map(function (o) { return '<label><input type="radio" name="' + a.id + "-" + kind + '" value="' + o.id + '"> ' + esc(o.name) + "</label>"; }).join("") + "</fieldset>"; }
      return '<article class="alert" data-a="' + a.id + '" aria-labelledby="h-' + a.id + '"><p class="kicker">Alert ' + (i + 1) + " of " + G.ALERTS.length + " · level " + a.level + " · rule " + esc(a.rule) + '</p><h2 id="h-' + a.id + '">' + esc(a.title) + '</h2><dl class="facts"><div><dt>Time</dt><dd>' + esc(a.time) + "</dd></div><div><dt>Agent</dt><dd>" + esc(a.agent) + "</dd></div>" +
        Object.keys(a.fields).map(function (k) { return "<div><dt>" + esc(k.charAt(0).toUpperCase() + k.slice(1)) + "</dt><dd>" + esc(a.fields[k]) + "</dd></div>"; }).join("") + "</dl>" +
        '<h3>Evidence</h3><pre tabindex="0" aria-label="Log lines for alert ' + (i + 1) + '"><code>' + esc(a.evidence.join("\n")) + '</code></pre><h3>Context</h3><p>' + esc(a.context) + '</p><div class="decide">' + radios("verdict", G.VERDICTS) + radios("action", G.ACTIONS) + '</div><p class="fb" hidden></p></article>';
    }).join("") + '<p><button class="btn ink" type="submit">Mark my decisions</button></p><p class="result" role="status"></p></form>' + pager("lab", "triage");
  }
  function triWire() {
    $("#tri").addEventListener("submit", function (e) {
      e.preventDefault();
      var d = {};
      G.ALERTS.forEach(function (a) { var v = $('input[name="' + a.id + '-verdict"]:checked'), c = $('input[name="' + a.id + '-action"]:checked'); d[a.id] = { verdict: v && v.value, action: c && c.value }; });
      var g = G.grade(d), open = g.results.filter(function (r) { return !r.answered; }).length;
      if (open) { var m = "Decide all six alerts first: " + open + " still " + (open === 1 ? "has" : "have") + " an open choice."; $("#tri .result").textContent = m; say(m); return; }
      g.results.forEach(function (r) { var fb = $('.alert[data-a="' + r.id + '"] .fb'); fb.hidden = false; fb.className = "fb " + (r.correct ? "good" : "bad"); fb.textContent = (r.correct ? "Right. " : !r.verdict ? "Not the verdict an analyst would reach. " : "Right verdict, but not the next step. ") + r.why; });
      var msg = g.score + " of " + g.total + " right. " + (g.passed ? "Lab done." : "Five passes. Read the reasons, change your decisions and mark again.");
      $("#tri .result").textContent = msg; say(msg);
      if (g.passed) done("labs", "triage");
    });
  }

  /* ---------- Roadmap ---------- */
  function roadmap() {
    return '<p class="crumbs"><a href="#/">CyberAtlas</a></p><h1 tabindex="-1">Certification roadmap</h1><p class="lead">Certifications that people starting in security often aim for, and where this course touches the same ground.</p>' +
      '<p class="note"><strong>Read this first.</strong> CyberAtlas is not affiliated with any certifying body, contains no exam questions, and promises no exam result. It is a first step. Exams change: take the current objectives, prices and rules from each body’s own website before you plan.</p>' +
      '<div class="scroll" role="region" tabindex="0" aria-label="Certifications"><table><caption>Certifications and the modules that help</caption><thead><tr><th scope="col">Certification</th><th scope="col">From</th><th scope="col">Level</th><th scope="col">What it covers</th><th scope="col">Modules here that help</th></tr></thead><tbody>' +
      C.ROADMAP.map(function (r) {
        return '<tr><th scope="row">' + esc(r.name) + "</th><td>" + esc(r.body) + "</td><td>" + esc(r.level) + "</td><td>" + esc(r.note) + "</td><td>" + r.helps.map(function (h) { return esc(C.MODULES.filter(function (m) { return m.id === h; })[0].title); }).join(", ") + "</td></tr>";
      }).join("") + '</tbody></table></div><p><a class="btn line" href="#/">Back to the modules</a></p>';
  }

  /* ---------- Routing ---------- */
  function render() {
    var parts = (window.location.hash || "#/").replace(/^#\/?/, "").split("/"), kind = parts[0], id = parts[1], wire = null, title = "CyberAtlas";
    if (kind === "lesson" && Object.prototype.hasOwnProperty.call(C.LESSONS, id)) { main.innerHTML = lesson(id); wire = function () { lessonWire(id); }; title = C.LESSONS[id].title; }
    else if (kind === "lab" && id === "ssh-log") { main.innerHTML = shellLab(); wire = shellWire; title = "Lab: " + C.LABS[id].title; }
    else if (kind === "lab" && id === "firewall") { main.innerHTML = fwLab(); wire = fwWire; title = "Lab: " + C.LABS[id].title; }
    else if (kind === "lab" && id === "triage") { main.innerHTML = triLab(); wire = triWire; title = "Lab: " + C.LABS[id].title; }
    else if (kind === "roadmap") { main.innerHTML = roadmap(); title = "Certification roadmap"; }
    else { main.innerHTML = home(); wire = homeWire; }
    document.title = title === "CyberAtlas" ? "CyberAtlas: learn cybersecurity by doing it" : title + " | CyberAtlas";
    if (wire) wire();
    window.scrollTo(0, 0);
    var h = $("h1");
    if (h && render.again) h.focus({ preventScroll: true });   // on the first page, the focus stays where the browser put it
    render.again = true;
  }
  window.addEventListener("hashchange", render);
  render();
})();
