/* /studio/csdb: the common source database of the fictional ARF-1 training rig, read from its S1000D XML. Inventory,
   search and filters, a module's identification, relationships, issues (with a line-by-line comparison), XML, and the
   checks: the build's official-schema result, and the browser's own checks run again here. */
(function () {
  "use strict";
  var T = Kit.t, esc = Kit.esc, $ = function (s) { return document.querySelector(s); };
  var db = null, current = null;
  var SNS = { "00": T("General"), "10": T("Frame and access panel"), "20": T("Fan assembly"), "30": T("Air filter"), "40": T("Control box") };
  function say(t, bad) { Kit.say($("#cd-status"), t, bad); }

  function latestOnly(x) { return db.latest(x.id.code) === x; }
  function ciOf(file) { var v = db.index.validation; return v && v.results ? v.results[file] : null; }
  function ciChip(file) {
    var r = ciOf(file);
    if (!r) return '<span class="ae-chip ae-skip">' + esc(T("Not checked")) + "</span>";
    var bad = Object.keys(r).filter(function (k) { return r[k] === "fail"; });
    return bad.length ? '<span class="ae-chip ae-fail">' + esc(T("Fails: {list}", { list: bad.join(", ") })) + "</span>" : '<span class="ae-chip ae-pass">' + esc(r.schema === "pass" ? T("Schema and rules pass") : T("Rules pass")) + "</span>";
  }
  function status(id) {
    return esc(T(id.issueType)) + " · " + esc(id.qa);
  }
  function filtered() {
    var q = $("#cd-q").value.trim().toLowerCase(), type = $("#cd-type").value, sns = $("#cd-sns").value, latest = $("#cd-latest").checked;
    return db.items.filter(function (x) {
      if (latest && !latestOnly(x)) return false;
      if (type && x.id.type !== type) return false;
      if (sns && x.id.systemCode !== sns) return false;
      if (q && (x.id.code + " " + x.id.title + " " + x.file).toLowerCase().indexOf(q) < 0 && x.doc.documentElement.textContent.toLowerCase().indexOf(q) < 0) return false;
      return true;
    });
  }
  function paintList() {
    var list = filtered();
    $("#cd-count").textContent = T("{n} of {all}", { n: list.length, all: db.items.length });
    $("#cd-rows").innerHTML = list.map(function (x) {
      return '<tr data-file="' + esc(x.file) + '"' + (current && current.file === x.file ? ' class="on" aria-current="true"' : "") + '><td><button type="button" class="cd-open"><code>' + esc(x.id.code) + "</code></button></td><td" + S1K.langAttr(x.id) + ">" + esc(x.id.title) + "</td><td>" + esc(T(x.id.type)) + "</td><td>" + esc(x.id.issue + "-" + x.id.inWork) + "</td><td>" + esc(x.id.date) + "</td><td>" + status(x.id) + "</td><td>" + ciChip(x.file) + "</td></tr>";
    }).join("") || '<tr><td colspan="7">' + esc(T("No module matches.")) + "</td></tr>";
    var saved = {};
    try { saved = JSON.parse(localStorage.getItem("s1k-work") || "{}"); } catch (e) { saved = {}; }
    var names = Object.keys(saved);
    $("#cd-work").innerHTML = names.length ? '<h3 class="ae-h3">' + esc(T("Saved in this browser")) + "</h3><ul>" + names.map(function (n) { return '<li><a href="' + esc(S1K.pageHref("/studio/s1000d?open=" + encodeURIComponent("saved:" + n))) + '"><code>' + esc(n) + "</code></a> <small>" + esc(T("saved {when}", { when: saved[n].at.slice(0, 16).replace("T", " ") })) + "</small></li>"; }).join("") + "</ul>" : "";
  }

  /* ---------- One module ---------- */
  function referencedBy(x) {
    return db.items.filter(function (o) { return o !== x && S1K.refs(o.doc).dm.some(function (r) { return r.code === x.id.code && !r.brex; }); });
  }
  function pretty(text) {
    var rows = text.split("\n");
    return '<ol class="cd-xml">' + rows.map(function (l) {
      var h = esc(l).replace(/(&lt;\/?)([\w:.-]+)/g, '$1<span class="x-t">$2</span>').replace(/([\w:.-]+)=(&quot;[^&]*?&quot;|"[^"]*")/g, '<span class="x-a">$1</span>=<span class="x-v">$2</span>');
      return "<li>" + (h || " ") + "</li>";
    }).join("") + "</ol>";
  }
  function diff(a, b) {
    var x = a.split("\n"), y = b.split("\n"), n = x.length, m = y.length, L = [];
    for (var i = 0; i <= n; i++) { L.push(new Array(m + 1).fill(0)); }
    for (i = n - 1; i >= 0; i--) for (var j = m - 1; j >= 0; j--) L[i][j] = x[i] === y[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
    var out = [], ii = 0, jj = 0;
    while (ii < n && jj < m) {
      if (x[ii] === y[jj]) { out.push([" ", x[ii]]); ii++; jj++; }
      else if (L[ii + 1][jj] >= L[ii][jj + 1]) out.push(["-", x[ii++]]);
      else out.push(["+", y[jj++]]);
    }
    while (ii < n) out.push(["-", x[ii++]]);
    while (jj < m) out.push(["+", y[jj++]]);
    // only the changed lines, with two lines of context
    var keep = out.map(function (o, k) { for (var d = -2; d <= 2; d++) { var p = out[k + d]; if (p && p[0] !== " ") return true; } return false; });
    var html = "", gap = false;
    out.forEach(function (o, k) {
      if (!keep[k]) { if (!gap) html += '<li class="d-gap">…</li>'; gap = true; return; }
      gap = false;
      html += '<li class="d-' + (o[0] === "+" ? "add" : o[0] === "-" ? "del" : "same") + '"><span aria-hidden="true">' + o[0] + "</span>" + (o[0] === "+" ? '<span class="vh">' + esc(T("added")) + " </span>" : o[0] === "-" ? '<span class="vh">' + esc(T("removed")) + " </span>" : "") + esc(o[1]) + "</li>";
    });
    return { html: '<ol class="cd-diff">' + html + "</ol>", added: out.filter(function (o) { return o[0] === "+"; }).length, removed: out.filter(function (o) { return o[0] === "-"; }).length };
  }
  function select(file, focus) {
    var x = db.items.filter(function (i) { return i.file === file; })[0];
    if (!x) return;
    current = x; paintList();
    var id = x.id, R = S1K.refs(x.doc), by = referencedBy(x), issues = db.byCode[id.code];
    var pubs = by.filter(function (o) { return o.id.kind === "pm"; });
    var check = S1K.validate(x.text, db, x.file), ci = ciOf(x.file);
    var dl = function (k, v) { return v ? "<div><dt>" + esc(k) + "</dt><dd>" + v + "</dd></div>" : ""; };
    var link = function (o) { return '<a href="#" data-file="' + esc(o.file) + '"><code>' + esc(o.id.code) + "</code></a> " + S1K.inLang(o.id.title, o.id) + ' <span class="s1k-iss">' + esc(T("issue {n}", { n: o.id.issue })) + "</span>"; };
    var html = '<dl class="s1k-meta">' + dl(T("Code"), "<code>" + esc(id.code) + "</code>") + dl(T("File"), "<code>" + esc(x.file) + "</code>") + dl(T("Type"), esc(T(id.type)) + (id.schema ? " · <code>" + esc(id.schema) + ".xsd</code>" : "")) +
      dl(T("Issue"), esc(id.issue + "-" + id.inWork) + " · " + esc(T(id.issueType))) + dl(T("Issue date"), esc(id.date)) + dl(T("Quality assurance"), esc(id.qa)) + dl(T("Applicability"), S1K.inLang(id.applic, id)) +
      dl(T("Responsible partner"), esc(id.owner)) + dl(T("Security"), esc(id.security === "01" ? T("01, unclassified") : id.security)) + (id.rfu.length ? dl(T("Reason for update"), S1K.inLang(id.rfu.map(function (r) { return r.text; }).join(" "), id)) : "") + "</dl>";
    html += '<p class="ann-btns"><a class="btn ink sm" href="' + esc(S1K.BASE + x.file) + '" download>' + esc(T("Download the XML")) + '</a><a class="btn line sm" href="' + esc(S1K.pageHref("/studio/s1000d?open=" + encodeURIComponent(x.file))) + '">' + esc(T("Open in the S1000D editor")) + "</a>" +
      (id.kind === "dm" && !/^(022|00W|00Q|00P)$/.test(id.infoCode) ? '<a class="btn line sm" href="' + esc(S1K.pageHref("/studio/ietm?dm=" + encodeURIComponent(id.code))) + '">' + esc(T("Read it in the IETM")) + "</a>" : "") + "</p>";
    // relationships
    var out = R.dm.filter(function (r) { return !r.brex && !r.act; }).map(function (r) { var t = db.get(r.code, r.issue) || db.latest(r.code); return t ? "<li>" + link(t) + "</li>" : "<li><code>" + esc(r.code) + "</code> " + esc(T("(not in the CSDB)")) + "</li>"; });
    html += '<h3 class="ae-h3">' + esc(T("Relationships")) + '</h3><div class="cd-rel"><div><h4>' + esc(T("Refers to")) + "</h4><ul>" + (out.join("") || "<li>" + esc(T("No other module")) + "</li>") + "</ul></div>" +
      "<div><h4>" + esc(T("Referred to by")) + "</h4><ul>" + (by.filter(function (o) { return o.id.kind === "dm"; }).map(function (o) { return "<li>" + link(o) + "</li>"; }).join("") || "<li>" + esc(T("No data module")) + "</li>") + "</ul></div>" +
      "<div><h4>" + esc(T("In publications")) + "</h4><ul>" + (pubs.map(function (o) { var r = S1K.refs(o.doc).dm.filter(function (q) { return q.code === id.code; })[0]; return "<li>" + link(o) + (r && r.issue ? " " + esc(T("contains issue {n}", { n: r.issue })) : "") + "</li>"; }).join("") || "<li>" + esc(id.kind === "pm" ? T("This is a publication module.") : T("Not in a publication")) + "</li>") + "</ul></div>" +
      "<div><h4>" + esc(T("Illustrations")) + "</h4><ul>" + (R.icn.map(function (g) { return '<li><a href="' + esc(S1K.icnUrl(g.icn)) + '"><code>' + esc(g.icn) + "</code></a></li>"; }).join("") || "<li>" + esc(T("None")) + "</li>") + "</ul></div></div>";
    // checks
    html += '<h3 class="ae-h3">' + esc(T("Checks")) + '</h3><ul class="cd-checks">' + (ci && ci.schema ? '<li class="ae-' + (ci.schema === "pass" ? "pass" : "fail") + '">' + esc(ci.schema === "pass" ? T("Valid against the official S1000D Issue 6 schema (build check, {date}).", { date: db.index.validation.checked.slice(0, 10) }) : T("Not valid against the official schema in the build check.")) + "</li>" : "") +
      (ci && ci["default-brex"] ? '<li class="ae-' + (ci["default-brex"] === "pass" ? "pass" : "fail") + '">' + esc(ci["default-brex"] === "pass" ? T("No rule of the S1000D Issue 6 default BREX is broken (build check).") : T("The S1000D default BREX check found a problem.")) + "</li>" : "") +
      check.layers.map(function (l) { return '<li class="ae-' + l.status + '">' + esc(l.name) + ": " + esc(l.findings[0] ? l.findings[0].message : "") + (l.findings.length > 1 ? " " + esc(T("(+{n} more)", { n: l.findings.length - 1 })) : "") + "</li>"; }).join("") + "</ul>";
    // history
    if (issues.length > 1) {
      html += '<h3 class="ae-h3">' + esc(T("History")) + "</h3><ol class=\"cd-hist\">" + issues.map(function (o) { return "<li>" + link(o) + " · " + esc(o.id.date) + (o.id.rfu.length ? "<br><small" + S1K.langAttr(o.id) + ">" + esc(o.id.rfu[0].text) + "</small>" : "") + "</li>"; }).join("") + "</ol>";
      var prev = issues[issues.indexOf(x) - 1] || issues[0], next = prev === x ? issues[1] : x, d = diff(prev.text, next.text);
      html += '<h4>' + esc(T("Issue {a} compared with issue {b}: {add} lines added, {del} removed", { a: prev.id.issue, b: next.id.issue, add: d.added, del: d.removed })) + '</h4><div class="cd-diffbox" role="region" tabindex="0" aria-label="' + esc(T("Changes between issues")) + '">' + d.html + "</div>";
    }
    html += '<details class="cd-src"><summary>' + esc(T("XML source ({n} lines)", { n: x.text.split("\n").length })) + '</summary><div class="cd-xmlbox" role="region" tabindex="0" aria-label="' + esc(T("XML source")) + '">' + pretty(x.text) + "</div></details>";
    $("#cd-d-h").textContent = id.title;
    var hl = S1K.langAttr(id); if (hl) $("#cd-d-h").setAttribute("lang", S1K.langOf(id)); else $("#cd-d-h").removeAttribute("lang");
    $("#cd-body").innerHTML = html;
    history.replaceState(null, "", "?file=" + encodeURIComponent(x.file));
    if (focus) $("#cd-detail").focus();
  }

  /* ---------- The relationship drawing ---------- */
  function graph() {
    var latest = db.items.filter(latestOnly), pms = latest.filter(function (x) { return x.id.kind === "pm"; });
    var dms = latest.filter(function (x) { return x.id.kind === "dm" && !/^(022|00W|00Q|00P)$/.test(x.id.infoCode); });
    var rules = latest.filter(function (x) { return /^(022|00W|00Q|00P)$/.test(x.id.infoCode); });
    var icns = {};
    dms.forEach(function (x) { S1K.refs(x.doc).icn.forEach(function (g) { icns[g.icn] = 1; }); });
    icns = Object.keys(icns).sort();
    var W = 1000, rowH = 44, top = 40, H = top + Math.max(dms.length, icns.length + 1, rules.length + pms.length + 2) * rowH + 20;
    var pos = {}, svg = "", boxes = "";
    function box(key, x, y, w, label, sub, cls, href, id) {
      pos[key] = { x: x, y: y, w: w };
      boxes += '<a href="' + esc(href) + '"' + (href.charAt(0) === "#" ? ' data-file="' + esc(href.slice(1)) + '"' : "") + '><g class="cg ' + cls + '"><rect x="' + x + '" y="' + (y - 16) + '" width="' + w + '" height="32" rx="5"/><text x="' + (x + 8) + '" y="' + (y - 2) + '"' + (id ? S1K.langAttr(id) : "") + ">" + esc(label) + '</text><text class="cg-sub" x="' + (x + 8) + '" y="' + (y + 11) + '">' + esc(sub) + "</text></g></a>";
    }
    pms.forEach(function (x, i) { box(x.id.code, 10, top + 20 + i * 70, 210, x.id.pmTitle.replace("ARF-1 training rig - ", ""), x.id.code.replace("PMC-", ""), "cg-pm", "#" + x.file, x.id); });
    rules.forEach(function (x, i) { box(x.id.code, 10, top + 220 + i * rowH, 210, x.id.infoName, x.id.code.replace(/^DMC-ARFRIG-A-/, ""), "cg-rule", "#" + x.file, x.id); });
    dms.forEach(function (x, i) { box(x.id.code, 330, top + i * rowH, 300, x.id.title, x.id.code.replace(/^DMC-ARFRIG-A-/, "") + " · " + T("issue {n}", { n: x.id.issue }), "cg-dm", "#" + x.file, x.id); });
    icns.forEach(function (n, i) { box(n, 740, top + i * rowH, 250, n.replace("ICN-0DEMO-", ""), T("illustration"), "cg-icn", S1K.icnUrl(n)); });
    var curve = function (a, b, cls) { var x1 = a.x + a.w, y1 = a.y, x2 = b.x, y2 = b.y, mx = (x1 + x2) / 2; return '<path class="' + cls + '" d="M' + x1 + "," + y1 + " C" + mx + "," + y1 + " " + mx + "," + y2 + " " + x2 + "," + y2 + '"/>'; };
    pms.forEach(function (p) { S1K.refs(p.doc).dm.forEach(function (r) { if (!r.brex && !r.act && pos[r.code]) svg += curve(pos[p.id.code], pos[r.code], "cl-pm"); }); });
    dms.forEach(function (d) { S1K.refs(d.doc).icn.forEach(function (g) { if (pos[g.icn]) svg += curve(pos[d.id.code], pos[g.icn], "cl-icn"); }); });
    dms.forEach(function (d) {
      S1K.refs(d.doc).dm.forEach(function (r) {
        var t = pos[r.code], s = pos[d.id.code];
        if (r.brex || r.act || !t || t === s || t.x !== s.x) return;
        svg += '<path class="cl-dm" d="M' + (s.x + s.w) + "," + s.y + " C" + (s.x + s.w + 40) + "," + s.y + " " + (t.x + t.w + 40) + "," + t.y + " " + (t.x + t.w) + "," + t.y + '"/>';
      });
    });
    $("#cd-graph").innerHTML = '<svg viewBox="0 0 ' + W + " " + H + '" role="group" aria-labelledby="cd-g-t"><title id="cd-g-t">' + esc(T("Publications on the left refer to data modules in the middle; data modules refer to illustrations on the right, and to each other (dotted).")) + "</title>" +
      '<text class="cg-h" x="10" y="18">' + esc(T("Publication modules")) + '</text><text class="cg-h" x="330" y="18">' + esc(T("Data modules (latest issues)")) + '</text><text class="cg-h" x="740" y="18">' + esc(T("Illustrations")) + '</text><text class="cg-h" x="10" y="' + (top + 196) + '">' + esc(T("Rules and applicability")) + "</text>" + svg + boxes + "</svg>";
  }

  /* ---------- Wiring ---------- */
  function wire() {
    ["#cd-q", "#cd-type", "#cd-sns", "#cd-latest"].forEach(function (s) { $(s).addEventListener(s === "#cd-q" ? "input" : "change", paintList); });
    $("#cd-rows").addEventListener("click", function (e) { var tr = e.target.closest("tr[data-file]"); if (tr) select(tr.dataset.file, !!e.target.closest(".cd-open")); });
    document.addEventListener("click", function (e) { var a = e.target.closest("a[data-file]"); if (a && (a.closest("#cd-body") || a.closest("#cd-graph"))) { e.preventDefault(); select(a.dataset.file, true); } });
  }
  Kit.wait(S1K.load().then(function (d) {
    db = d;
    var types = {}; db.items.forEach(function (x) { types[x.id.type] = 1; });
    $("#cd-type").innerHTML += Object.keys(types).map(function (t) { return '<option value="' + esc(t) + '">' + esc(T(t)) + "</option>"; }).join("");
    $("#cd-sns").innerHTML += Object.keys(SNS).map(function (k) { return '<option value="' + k + '">' + esc(k + " " + SNS[k]) + "</option>"; }).join("");
    wire(); paintList(); graph();
    var want = new URLSearchParams(location.search).get("file");
    select(want && db.items.some(function (i) { return i.file === want; }) ? want : "DMC-ARFRIG-A-00-00-00-00A-040A-D_002-00_EN-US.XML");
    say(T("{n} modules and {i} illustrations, read from their XML.", { n: db.items.length, i: db.icns.length }));
  }).catch(function (e) { say(e.message, true); }));
})();
