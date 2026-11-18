/* /studio/control: document control for one document. Every change of status is an action someone takes, with their
   name and a reason, and goes into an audit log that can be exported. Editorial review, technical review and safety
   approval are separate, and a passing style check never counts as any of them.
   This is a local demonstration: names are typed, not signed in, so the log records what was entered in this browser. */
(function () {
  "use strict";
  var T = Kit.t;
  var K = function (s) { return s; };     // marks English that is stored as data and translated where it is shown
  var $ = function (s) { return document.querySelector(s); }, esc = Kit.esc;
  function say(t, bad) { Kit.say($("#dc-status"), t, bad); }
  var STATES = [K("Draft"), K("In review"), K("Approved"), K("Published"), K("Superseded")];
  var REVIEWS = { editorial: K("Editorial review"), technical: K("Technical review"), safety: K("Safety approval") };
  /** The control fields by name, as the interface says them inside a sentence. */
  var FIELDS = { id: K("document ID"), title: K("title"), version: K("version"), author: K("author"), owner: K("owner"), reviewer: K("reviewer") };
  /** The kinds of document the checks know, as the interface names them. */
  var KINDS = { "how-to": K("how-to"), maintenance: K("maintenance"), troubleshooting: K("troubleshooting"), reference: K("reference"), concept: K("concept"), faq: K("FAQ"), "release-notes": K("release notes"), "change record": K("change record") };
  function fieldName(k) { return T(FIELDS[k] || k); }
  /** The sections a document of each type has to have. Headings are matched without case. */
  var REQUIRED = {
    "how-to": ["Before you start", "Check that it worked"],
    maintenance: ["Before you start", "Tools and materials", "Steps", "Acceptance criteria", "Check that it worked"],
    troubleshooting: ["Why it happens", "Fix it"],
    reference: [], concept: [], faq: [], "release-notes": [],
    "change record": ["Reason for change", "Affected data", "Effectivity", "Verification", "Approval"],
  };
  var D = null;          // {source, meta:{...}, safety, checks:{}, reviews:[], revisions:[], log:[]}

  function now() { return new Date().toISOString(); }
  function today() { return now().slice(0, 10); }
  function front(source) { return Doc.parse(source).meta; }
  function kind() { var t = String(front(D.source).type || "").toLowerCase(); return /maintenance/i.test(D.source.slice(0, 400)) && t === "how-to" && /Acceptance criteria/i.test(D.source) ? "maintenance" : t || "concept"; }
  function log(action, detail) { D.log.unshift({ at: now(), who: $("#dc-me").value.trim() || T("(no name entered)"), action: action, detail: detail || "", version: D.meta.version, status: D.meta.status }); }
  /** Writes the control fields into the document's front matter, keeping every other field and the variables. */
  function withMeta(source, meta) {
    var lines = source.replace(/\r\n?/g, "\n").split("\n"), keys = ["id", "title", "version", "status", "author", "owner", "reviewer", "date"], body = lines, head = [];
    if (lines[0] === "---") { var close = lines.indexOf("---", 1); if (close > 0) { head = lines.slice(1, close); body = lines.slice(close + 1); } }
    head = head.filter(function (l) { var m = /^([A-Za-z][\w.-]*)\s*:/.exec(l); return !(m && keys.indexOf(m[1]) > -1 && m[1] !== "title"); });
    var add = keys.filter(function (k) { return k !== "title" && meta[k]; }).map(function (k) { return k + ": " + String(meta[k]).replace(/\n/g, " "); });
    return "---\n" + add.concat(head).join("\n") + "\n---\n" + body.join("\n").replace(/^\n+/, "");
  }

  /* ---------- Checks: what a program can say, kept apart from what people approve ---------- */
  function checks() {
    var doc = Doc.parse(D.source), view = Doc.resolve(doc, Doc.GENERAL), heads = [], anchors = {}, links = [];
    view.blocks.forEach(function (b) { if (b.t === "h") { var t = Doc.text(b.runs, true); heads.push(t.toLowerCase()); anchors[Doc.slug(t)] = 1; } });
    (D.source.match(/\]\(([^)\s]+)\)/g) || []).forEach(function (m) { links.push(m.slice(2, -1)); });
    var broken = links.filter(function (h) { return h[0] === "#" ? !anchors[h.slice(1)] : !/^(https?:|mailto:|\/)/.test(h); });
    var need = REQUIRED[kind()] || [], missing = need.filter(function (n) { return heads.indexOf(n.toLowerCase()) < 0; });
    var sum = Style.summary(Style.check(D.source)), m = D.meta;
    var meta = ["id", "version", "author", "owner", "reviewer"].filter(function (k) { return !m[k]; });
    return { sum: sum, missing: missing, need: need, broken: broken, links: links.length, meta: meta, title: !!view.title };
  }
  function paintChecks() {
    var c = checks(), row = function (ok, label, note) { return '<li class="' + (ok ? "ok" : "no") + '"><b>' + (ok ? T("Passes") : T("Fails")) + "</b> " + esc(label) + (note ? " <small>" + esc(note) + "</small>" : "") + "</li>"; };
    $("#dc-checks").innerHTML =
      row(c.sum.passes, T("Style check"), c.sum.passes ? (c.sum.suggestion ? T("{n} suggestion(s)", { n: c.sum.suggestion }) : T("no findings")) : T("{e} error(s), {w} warning(s)", { e: c.sum.error, w: c.sum.warning })) +
      row(!c.missing.length, T("Required sections for a {kind} document", { kind: T(KINDS[kind()] || kind()) }), c.missing.length ? T("missing: {list}", { list: c.missing.join(", ") }) : c.need.length ? c.need.join(", ") : T("none required")) +
      row(!c.broken.length, T("Links"), c.broken.length ? T("broken: {list}", { list: c.broken.join(", ") }) : T("{n} link(s), none broken", { n: c.links })) +
      row(!c.meta.length, T("Document control fields"), c.meta.length ? T("empty: {list}", { list: c.meta.map(fieldName).join(", ") }) : T("all filled in")) +
      row(c.title, T("A title"), "");
    return c;
  }

  /* ---------- The lifecycle ---------- */
  function reviewsOf(version) { return D.reviews.filter(function (r) { return r.version === version; }); }
  function approvedBy(kind2) { return reviewsOf(D.meta.version).filter(function (r) { return r.kind === kind2 && r.outcome === "approve"; })[0]; }
  function needed() { return ["editorial", "technical"].concat(D.safety ? ["safety"] : []); }
  function paint() {
    if (!D) { $("#dc-doc").hidden = true; sw.inline(true); return; }
    $("#dc-doc").hidden = false; sw.inline(false);
    var m = D.meta;
    ["id", "title", "version", "author", "owner", "reviewer", "date"].forEach(function (k) { var el = $("#dc-" + k); if (el && document.activeElement !== el) el.value = m[k] || ""; });
    $("#dc-safety").checked = !!D.safety;
    $("#dc-flow").innerHTML = STATES.map(function (s) { return '<li class="' + (s === m.status ? "now" : STATES.indexOf(s) < STATES.indexOf(m.status) ? "done" : "") + '"' + (s === m.status ? ' aria-current="step"' : "") + ">" + T(s) + "</li>"; }).join("");
    var c = paintChecks(), st = m.status;
    $("#dc-reviews").innerHTML = needed().map(function (k) { var r = approvedBy(k); return "<li class=\"" + (r ? "ok" : "") + '"><b>' + T(REVIEWS[k]) + "</b> " + (r ? T("approved by {who} on {date}", { who: esc(r.by), date: r.at.slice(0, 10) }) : T("not yet")) + "</li>"; }).join("");
    var allApproved = needed().every(approvedBy);
    var act = function (id, label, show, why) { return show ? '<button type="button" class="btn ' + (why ? "line" : "ink") + ' sm" data-do="' + id + '"' + (why ? ' aria-disabled="true" data-why="' + esc(why) + '"' : "") + ">" + T(label) + "</button>" : ""; };
    $("#dc-actions").innerHTML =
      act("submit", K("Submit for review"), st === "Draft", !c.sum.passes || c.missing.length || c.broken.length ? T("Fix what the checks found first.") : "") +
      act("review", K("Record a review"), st === "In review") +
      act("approve", K("Approve"), st === "In review", allApproved ? "" : T("Every review this document needs has to approve it first.")) +
      act("back", K("Return to draft"), st === "In review" || st === "Approved") +
      act("publish", K("Publish"), st === "Approved") +
      act("revise", K("Start a new revision"), st === "Published") +
      act("supersede", K("Mark as superseded"), st === "Published");
    $("#dc-revs").innerHTML = D.revisions.map(function (r) { return "<tr><td>" + esc(r.version) + "</td><td>" + esc(r.date) + "</td><td>" + esc(r.author) + "</td><td>" + esc(r.change) + "</td><td>" + esc(T(r.status)) + "</td></tr>"; }).join("");
    $("#dc-log").innerHTML = D.log.map(function (l) { return "<tr><td>" + esc(l.at.replace("T", " ").slice(0, 19)) + "</td><td>" + esc(l.who) + "</td><td>" + esc(l.action) + "</td><td>" + esc(l.detail) + "</td><td>" + esc(l.version) + "</td></tr>"; }).join("");
    $("#dc-source").value = D.source;
  }
  function bump(v, major) { var p = String(v || "0.1").split(".").map(function (n) { return parseInt(n, 10) || 0; }); return major ? (p[0] + 1) + ".0" : p[0] + "." + ((p[1] || 0) + 1); }
  function setStatus(s) { D.meta.status = s; D.meta.date = today(); D.source = withMeta(D.source, D.meta); }
  $("#dc-actions").addEventListener("click", function (e) {
    var b = e.target.closest("[data-do]"); if (!b) return;
    if (b.dataset.why) return say(b.dataset.why, true);
    var a = b.dataset.do, m = D.meta;
    if (!$("#dc-me").value.trim()) return say(T("Type your name first: each action is logged with it."), true);
    if (a === "submit") { setStatus("In review"); log(T("Submitted for review"), T("Checks passed at submission: style, required sections, links.")); }
    if (a === "review") { $("#dc-review").hidden = false; $("#dc-r-kind").focus(); return; }
    if (a === "approve") { setStatus("Approved"); log(T("Approved"), needed().map(function (k) { return T(REVIEWS[k]) + ": " + approvedBy(k).by; }).join("; ")); }
    if (a === "back") return Kit.ask(T("Return to draft"), T("Why does it go back to draft?"), T("Changes requested"), { ok: T("Return to draft") }).then(function (why) { if (why == null) return; setStatus("Draft"); log(T("Returned to draft"), why); after(); });
    if (a === "publish") return Kit.ask(T("Publish version {v}", { v: D.revisions.length ? bump(m.version, true) : m.version || "1.0" }), T("What changed in this version? It goes in the revision history."), D.revisions.length ? "" : T("First release"), { ok: T("Publish"), multi: true }).then(function (change) {
      if (!change) return;
      var v = D.revisions.length ? bump(m.version, true) : m.version || "1.0"; m.version = v; setStatus("Published");
      D.revisions.unshift({ version: v, date: today(), author: m.author || "", change: change, status: "Published" }); log(T("Published"), T("Version {v}: {change}", { v: v, change: change })); after();
    });
    if (a === "revise") { m.version = bump(m.version, false); setStatus("Draft"); D.revisions.forEach(function (r) { if (r.status === "Published") r.status = K("Published (current)"); }); log(T("Started a new revision"), T("Draft version {v}", { v: m.version })); }
    if (a === "supersede") return Kit.ask(T("Mark as superseded"), T("Which document replaces it?"), "", { ok: T("Mark as superseded"), optional: true }).then(function (by) { if (by == null) return; setStatus("Superseded"); D.revisions.forEach(function (r) { if (/^Published/.test(r.status)) r.status = "Superseded"; }); log(T("Marked as superseded"), by ? T("Replaced by {doc}", { doc: by }) : ""); after(); });
    after();
    function after() { save(); paint(); say(T("Status: {status}.", { status: T(D.meta.status) })); }
  });
  $("#dc-r-save").addEventListener("click", function () {
    var k = $("#dc-r-kind").value, o = $("#dc-r-outcome").value, c = $("#dc-r-comment").value.trim(), by = $("#dc-me").value.trim();
    if (k === "safety" && !D.safety) return say(T("This document isn't marked as safety-related, so it needs no safety approval."), true);
    if (o === "changes" && !c) return say(T("Say which changes are needed."), true);
    D.reviews.push({ kind: k, outcome: o, comment: c, by: by, at: now(), version: D.meta.version });
    log(o === "approve" ? T("{review}: approved", { review: T(REVIEWS[k]) }) : T("{review}: changes requested", { review: T(REVIEWS[k]) }), c);
    $("#dc-review").hidden = true; $("#dc-r-comment").value = ""; save(); paint();
    say(T("{review} recorded.", { review: T(REVIEWS[k]) }) + (o === "changes" ? " " + T("Return the document to draft to make the changes.") : ""));
  });
  $("#dc-r-cancel").addEventListener("click", function () { $("#dc-review").hidden = true; });

  /* ---------- Fields and the document ---------- */
  ["id", "title", "version", "author", "owner", "reviewer"].forEach(function (k) {
    $("#dc-" + k).addEventListener("change", function () {
      var was = D.meta[k], v = this.value.trim().slice(0, 120);
      if (v === (was || "")) return;
      D.meta[k] = v;
      if (k === "title") D.source = D.source.replace(/^# .*$/m, "# " + D.meta.title); else D.source = withMeta(D.source, D.meta);
      log(T("Changed the {field}", { field: fieldName(k) }), (was || T("(empty)")) + " → " + (D.meta[k] || T("(empty)"))); save(); paint();
    });
  });
  $("#dc-safety").addEventListener("change", function () { D.safety = this.checked; log(this.checked ? T("Marked as safety-related") : T("Marked as not safety-related"), this.checked ? T("Publishing needs a safety approval.") : ""); save(); paint(); });
  $("#dc-source").addEventListener("change", function () {
    if (D.meta.status !== "Draft") { this.value = D.source; return say(T("Only a draft can be edited. Start a new revision, or return it to draft."), true); }
    D.source = this.value.slice(0, 200000); D.meta = readMeta(D.source); log(T("Edited the text"), ""); save(); paint();
  });
  function readMeta(source) {
    var f = front(source), title = Doc.resolve(Doc.parse(source)).title || "";
    return { id: f.id || "", title: title, version: f.version || "0.1", status: STATES.indexOf(f.status) > -1 ? f.status : f.status === "In review" ? "In review" : "Draft", author: f.author || "", owner: f.owner || "", reviewer: f.reviewer || "", date: f.date || today() };
  }
  function start(source, from) {
    D = { source: source, meta: readMeta(source), safety: /maintenance|safety|warning/i.test(source.slice(0, 2000)), reviews: [], revisions: [], log: [] };
    D.meta.status = "Draft"; D.source = withMeta(D.source, D.meta);
    log(T("Opened"), from); save(); paint(); say(T("Opened {what}. It starts as a draft.", { what: from }));
  }
  /* The samples: documents from the fictional scenarios, each with its control fields already in the front matter. */
  var panel = Kit.start($("#dc-start"), {
    tool: "control", title: T("Open a document"),
    lead: T("Four documents of different kinds, each on its way through review: a maintenance procedure, an IT standard operating procedure, a security runbook, and release notes. Open one and take it from draft to published, with its reviews and audit trail. Or open your own."),
    open: function (s) { say(T("Opening {title}…", { title: T(s.title) })); return Kit.fetchText(s.url).then(function (t) { start(t, T("{title} (fictional sample: {kind})", { title: T(s.title), kind: T(s.kind) })); sw.close(); }); },
    fail: function (e) { say(e.message, true); },
    files: [{ label: T("Open a Markdown file"), input: "dc-file" }],
    extra: '<button type="button" class="btn line sm" id="dc-bench2">' + T("Open my workbench document") + "</button>",
  });
  var sw = Kit.startSwitch(panel, $("#dc-slot"), $("#dc-samples"));
  $("#dc-bench2").addEventListener("click", function () { $("#dc-bench").click(); });
  $("#dc-bench").addEventListener("click", function () {
    var s = null; try { s = localStorage.getItem("wb:doc"); } catch (e) {}
    if (!s || !s.trim()) return say(T("The workbench has no document in this browser yet."), true);
    start(s, T("your document from the workbench")); sw.close();
  });
  $("#dc-file").addEventListener("change", function () { var f = this.files[0]; this.value = ""; Kit.readText(f).then(function (t) { start(t, f.name); }, function (e) { say(e.message, true); }); });

  /* ---------- Exports ---------- */
  function csv(rows) { return rows.map(function (r) { return r.map(function (v) { v = String(v == null ? "" : v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }).join(","); }).join("\r\n") + "\r\n"; }
  function base() { return Kit.slug(D.meta.id || D.meta.title, "document"); }
  $("#dc-x-md").addEventListener("click", function () { Kit.save(new Blob([D.source], { type: "text/markdown" }), base() + "-v" + D.meta.version + ".md"); say(T("Downloaded the document with its control fields in the front matter.")); });
  $("#dc-x-audit").addEventListener("click", function () {
    var c = checks();
    var audit = { app: "karandeshmukh.dev/studio/control", note: "Local demonstration: names were typed in one browser, not verified by sign-in.", exported: now(), document: D.meta, safetyRelated: !!D.safety,
      checksAtExport: { style: c.sum, missingSections: c.missing, brokenLinks: c.broken }, reviews: D.reviews, revisions: D.revisions, log: D.log };
    Kit.save(Kit.zip([
      { name: base() + "-audit.json", data: JSON.stringify(audit, null, 1) },
      { name: base() + "-audit-log.csv", data: csv([[T("Time (UTC)"), T("Who"), T("Action"), T("Detail"), T("Version"), T("Status")]].concat(D.log.slice().reverse().map(function (l) { return [l.at, l.who, l.action, l.detail, l.version, T(l.status)]; }))) },
      { name: base() + "-revisions.csv", data: csv([[T("Version"), T("Date"), T("Author"), T("Change"), T("Status")]].concat(D.revisions.map(function (r) { return [r.version, r.date, r.author, r.change, T(r.status)]; }))) },
      { name: base() + "-v" + D.meta.version + ".md", data: D.source },
    ]), base() + "-audit.zip");
    say(T("Exported the audit history: JSON, two CSV files, and the document."));
  });

  var t0 = 0;
  // Every action is kept at once, so closing the tab right after one doesn't lose it.
  function save() { clearTimeout(t0); if (D) Kit.store.put("control", D).catch(function () {}); }
  try { $("#dc-me").value = localStorage.getItem("dc:me") || ""; } catch (e) {}
  $("#dc-me").addEventListener("change", function () { try { localStorage.setItem("dc:me", this.value); } catch (e) {} });
  Kit.store.get("control").then(function (s) { if (s && s.source) { D = s; say(T("Reopened your document from this browser.")); } }).catch(function () {}).then(paint);
  window.studioControl = { get: function () { return D; }, checks: checks };
})();
