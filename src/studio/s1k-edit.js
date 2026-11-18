/* /studio/s1000d: an S1000D editor and validator. A module opens from the ARF-1 CSDB, from a file or from a template;
   the form edits the identification in the XML text itself, so nothing else in the file changes; the checks run in
   the browser as you type, and the official-schema check runs on the site's server only when asked. */
(function () {
  "use strict";
  var T = Kit.t, esc = Kit.esc, $ = function (s) { return document.querySelector(s); };
  var xml = $("#se-xml"), gutter = $("#se-gutter"), db = null, file = "", origin = "", timer = 0, report = null, lastSchema = null;
  var STORE = "s1k-work";
  function say(t, bad) { Kit.say($("#se-status"), t, bad); }

  /* ---------- Saved work ---------- */
  function saved() { try { return JSON.parse(localStorage.getItem(STORE) || "{}"); } catch (e) { return {}; } }
  function keep(name, text) { try { var s = saved(); s[name] = { text: text, at: new Date().toISOString() }; localStorage.setItem(STORE, JSON.stringify(s)); return true; } catch (e) { return false; } }

  /* ---------- Opening ---------- */
  function fill() {
    var sel = $("#se-open"), groups = {}, s = saved();
    db.items.forEach(function (x) { (groups[x.id.type] = groups[x.id.type] || []).push(x); });
    var html = '<option value="">' + esc(T("Choose a module")) + "</option>";
    Object.keys(s).length && (html += '<optgroup label="' + esc(T("Saved in this browser")) + '">' + Object.keys(s).map(function (k) { return '<option value="saved:' + esc(k) + '">' + esc(k) + "</option>"; }).join("") + "</optgroup>");
    Object.keys(groups).forEach(function (g) {
      html += '<optgroup label="' + esc(T(g)) + '">' + groups[g].map(function (x) { return '<option value="' + esc(x.file) + '">' + esc(x.id.title + " · " + T("issue {n}", { n: x.id.issue })) + "</option>"; }).join("") + "</optgroup>";
    });
    sel.innerHTML = html;
  }
  function open(text, name, from) {
    xml.value = text; file = name || ""; origin = from || "";
    lastSchema = null; $("#se-schema-out").innerHTML = "";
    lines(); toForm(); check();
    say(T("Opened {name}.", { name: name || T("a new module") }));
  }
  function openFile(name) {
    if (/^saved:/.test(name)) { var s = saved()[name.slice(6)]; if (s) open(s.text, name.slice(6), "saved"); return; }
    var x = db.items.filter(function (i) { return i.file === name; })[0];
    if (x) open(x.text, x.file, "csdb");
  }

  /* ---------- Templates for new modules ---------- */
  function today() { return new Date().toISOString().slice(0, 10).split("-"); }
  function template(schema) {
    var ic = { descript: "040", proced: "520", ipd: "941" }[schema], ilc = schema === "proced" ? "A" : "D", d = today();
    var names = { descript: ["Access panel", "Description"], proced: ["Access panel", "Remove procedure"], ipd: ["Access panel", "Illustrated parts data"] }[schema];
    var body = {
      descript: "<description>\n<levelledPara id=\"par-0001\">\n<title>General</title>\n<para>The access panel covers the front of the rig.</para>\n</levelledPara>\n</description>",
      proced: "<procedure>\n<preliminaryRqmts>\n<reqCondGroup><noConds/></reqCondGroup>\n<reqSupportEquips><noSupportEquips/></reqSupportEquips>\n<reqSupplies><noSupplies/></reqSupplies>\n<reqSpares><noSpares/></reqSpares>\n<reqSafety><noSafety/></reqSafety>\n</preliminaryRqmts>\n<mainProcedure>\n<proceduralStep id=\"stp-0001\"><para>Open the access panel.</para></proceduralStep>\n</mainProcedure>\n<closeRqmts><reqCondGroup><noConds/></reqCondGroup></closeRqmts>\n</procedure>",
      ipd: "<illustratedPartsCatalog>\n<catalogSeqNumber figureNumber=\"01\" item=\"001\" indenture=\"1\">\n<itemSeqNumber itemSeqNumberValue=\"00A\"><quantityPerNextHigherAssy>1</quantityPerNextHigherAssy><partRef manufacturerCodeValue=\"0DEMO\" partNumberValue=\"ARF-1100\"/><partSegment><itemIdentData><descrForPart>Access panel</descrForPart></itemIdentData></partSegment></itemSeqNumber>\n</catalogSeqNumber>\n</illustratedPartsCatalog>",
    }[schema];
    var dmc = function (ic2) { return '<dmCode modelIdentCode="ARFRIG" systemDiffCode="A" systemCode="00" subSystemCode="0" subSubSystemCode="0" assyCode="00" disassyCode="00" disassyCodeVariant="A" infoCode="' + ic2 + '" infoCodeVariant="A" itemLocationCode="D"/>'; };
    return '<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE dmodule>\n<dmodule xmlns:dc="http://www.purl.org/dc/elements/1.1/" xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns:xlink="http://www.w3.org/1999/xlink" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="http://www.s1000d.org/S1000D_6/xml_schema_flat/' + schema + '.xsd">\n' +
      "<identAndStatusSection>\n<dmAddress>\n<dmIdent>\n" + '<dmCode modelIdentCode="ARFRIG" systemDiffCode="A" systemCode="10" subSystemCode="0" subSubSystemCode="0" assyCode="00" disassyCode="00" disassyCodeVariant="A" infoCode="' + ic + '" infoCodeVariant="A" itemLocationCode="' + ilc + '"/>\n' +
      '<language languageIsoCode="en" countryIsoCode="US"/>\n<issueInfo issueNumber="001" inWork="01"/>\n</dmIdent>\n<dmAddressItems>\n<issueDate year="' + d[0] + '" month="' + d[1] + '" day="' + d[2] + '"/>\n<dmTitle><techName>' + names[0] + "</techName><infoName>" + names[1] + "</infoName></dmTitle>\n</dmAddressItems>\n</dmAddress>\n" +
      '<dmStatus issueType="new">\n<security securityClassification="01"/>\n<dataRestrictions><restrictionInstructions><dataDistribution>Demonstration data for a fictional training rig. Not approved maintenance data. Do not use on real equipment.</dataDistribution></restrictionInstructions></dataRestrictions>\n' +
      "<responsiblePartnerCompany><enterpriseName>Documentation Studio demonstration team (fictional)</enterpriseName></responsiblePartnerCompany>\n<originator><enterpriseName>Documentation Studio demonstration team (fictional)</enterpriseName></originator>\n" +
      "<applicCrossRefTableRef><dmRef><dmRefIdent>" + dmc("00W") + "</dmRefIdent></dmRef></applicCrossRefTableRef>\n<applic><displayText><simplePara>All</simplePara></displayText></applic>\n" +
      "<brexDmRef><dmRef><dmRefIdent>" + dmc("022") + "</dmRefIdent></dmRef></brexDmRef>\n<qualityAssurance><unverified/></qualityAssurance>\n</dmStatus>\n</identAndStatusSection>\n<content>\n" + body + "\n</content>\n</dmodule>\n";
  }

  /* ---------- The form edits the text ---------- */
  var FIELDS = ["#se-issue", "#se-inwork", "#se-date", "#se-type", "#se-tech", "#se-info", "#se-applic", "#se-sec", "#se-qa"];
  function toForm() {
    var p = S1K.parse(xml.value), id = p.doc && S1K.ident(p.doc);
    $("#se-app").classList.toggle("ae-noform", !id || id.kind !== "dm");
    if (!id) { $("#se-code").textContent = p.doc ? T("Not a data module.") : T("The XML is not well-formed, so the form is paused."); return; }
    $("#se-code").innerHTML = "<code>" + esc(id.file) + "</code>";
    if (id.kind !== "dm") return;
    Array.prototype.forEach.call(document.querySelectorAll("#se-dmc [data-a]"), function (inp) { if (document.activeElement !== inp) inp.value = id.codeEl.getAttribute(inp.dataset.a) || ""; });
    var set = function (sel, v) { var e = $(sel); if (document.activeElement !== e) e.value = v; };
    set("#se-issue", id.issue); set("#se-inwork", id.inWork); set("#se-date", id.date); set("#se-type", id.issueType); set("#se-tech", id.techName); set("#se-info", id.infoName); set("#se-applic", id.applic); set("#se-sec", id.security);
    set("#se-qa", id.qaCode === "unverified" ? "unverified" : (/\((\w+)\)/.exec(id.qa) || [0, "tabtop"])[1]);
  }
  function xesc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  /** Replaces one attribute of the first element of a name in the text. */
  function setAttr(src, el, attr, v) {
    var re = new RegExp("<" + el + "\\b[^>]*>"), m = re.exec(src);
    if (!m) return src;
    var tag = m[0], at = new RegExp("(\\s" + attr + '\\s*=\\s*")[^"]*(")');
    var out = at.test(tag) ? tag.replace(at, "$1" + xesc(v) + "$2") : tag.replace(/(\/?>)$/, " " + attr + '="' + xesc(v) + '"$1');
    return src.slice(0, m.index) + out + src.slice(m.index + tag.length);
  }
  function setText(src, el, v) {
    var re = new RegExp("(<" + el + "\\b[^>]*>)([\\s\\S]*?)(</" + el + ">)"), m = re.exec(src);
    return m ? src.slice(0, m.index) + m[1] + xesc(v) + m[3] + src.slice(m.index + m[0].length) : src;
  }
  function fromForm(e) {
    var src = xml.value, t = e.target;
    if (t.dataset.a) src = setAttr(src, "dmCode", t.dataset.a, t.value.trim());
    else if (t.id === "se-issue") src = setAttr(src, "issueInfo", "issueNumber", t.value.trim());
    else if (t.id === "se-inwork") src = setAttr(src, "issueInfo", "inWork", t.value.trim());
    else if (t.id === "se-date" && t.value) { var d = t.value.split("-"); src = setAttr(setAttr(setAttr(src, "issueDate", "year", d[0]), "issueDate", "month", d[1]), "issueDate", "day", d[2]); }
    else if (t.id === "se-type") src = setAttr(src, "dmStatus", "issueType", t.value);
    else if (t.id === "se-tech") src = setText(src, "techName", t.value);
    else if (t.id === "se-info") src = setText(src, "infoName", t.value);
    else if (t.id === "se-sec") src = setAttr(src, "security", "securityClassification", t.value);
    else if (t.id === "se-applic") src = src.replace(/(<applic>\s*<displayText>\s*<simplePara>)([\s\S]*?)(<\/simplePara>)/, function (m, a, b, c) { return a + xesc(t.value) + c; });
    else if (t.id === "se-qa") src = src.replace(/(<qualityAssurance>)[\s\S]*?(<\/qualityAssurance>)/, "$1" + (t.value === "unverified" ? "<unverified/>" : '<firstVerification verificationType="' + t.value + '"/>') + "$2");
    if (src !== xml.value) { var at = xml.scrollTop; xml.value = src; xml.scrollTop = at; lines(); check(); }
  }

  /* ---------- Line numbers ---------- */
  function lines() {
    var n = xml.value.split("\n").length, out = "";
    for (var i = 1; i <= n; i++) out += i + "\n";
    gutter.textContent = out;
    gutter.scrollTop = xml.scrollTop;
  }
  function jump(line) {
    var parts = xml.value.split("\n"), at = 0;
    for (var i = 0; i < line - 1 && i < parts.length; i++) at += parts[i].length + 1;
    xml.focus();
    xml.setSelectionRange(at, at + (parts[line - 1] || "").length);
    var lh = parseFloat(getComputedStyle(xml).lineHeight) || 18;
    xml.scrollTop = Math.max(0, (line - 4) * lh);
    gutter.scrollTop = xml.scrollTop;
  }

  /* ---------- Checks ---------- */
  var STATUS = { pass: T("Passes"), fail: T("Fails"), warn: T("Warnings"), human: T("Needs a person"), skip: T("Not checked") };
  function check() {
    report = S1K.validate(xml.value, db, file);
    var errors = 0, warnings = 0;
    report.layers.forEach(function (l) { l.findings.forEach(function (f) { if (f.level === "error") errors++; if (f.level === "warning") warnings++; }); });
    var ci = ciResult();
    var layers = report.layers.slice();
    layers.splice(1, 0, ci ? { id: "schema", name: T("Official S1000D Issue 6 schema"), status: ci.status, findings: ci.findings } :
      { id: "schema", name: T("Official S1000D Issue 6 schema"), status: lastSchema ? lastSchema.status : "skip", findings: lastSchema ? lastSchema.findings : [{ level: "skip", message: T("Not checked yet. Use the button below.") }] });
    $("#se-layers").innerHTML = layers.map(function (l) {
      return '<li class="ae-layer ae-' + l.status + '"><p><b>' + esc(l.name) + '</b> <span class="ae-chip ae-' + l.status + '">' + esc(STATUS[l.status] || l.status) + "</span></p><ul>" +
        l.findings.map(function (f) {
          return '<li class="ae-f ae-f-' + f.level + '">' + (f.line ? '<button type="button" class="ae-line" data-line="' + f.line + '">' + esc(T("Line {n}", { n: f.line })) + "</button> " : "") + esc(f.message) +
            (f.fix ? '<span class="ae-fix">' + esc(f.fix) + "</span>" : "") + (/^<!ENTITY/.test(f.fix || "") ? ' <button type="button" class="btn line sm ae-apply" data-decl="' + esc(f.fix) + '">' + esc(T("Declare it")) + "</button>" : "") + "</li>";
        }).join("") + "</ul></li>";
    }).join("");
    $("#se-sum").innerHTML = report.doc ? (errors ? '<b class="ae-bad">' + esc(T("{e} error(s), {w} warning(s).", { e: errors, w: warnings })) + "</b> " : "<b>" + esc(T("No errors in the checks that run here.")) + "</b> ") + esc(T("Technical accuracy and approval still need a person.")) : '<b class="ae-bad">' + esc(T("The XML is not well-formed.")) + "</b>";
    preview();
  }
  /** The build's result for a module opened from the CSDB and not changed since. */
  function ciResult() {
    if (origin !== "csdb" || !db || !db.index.validation) return null;
    var orig = db.items.filter(function (i) { return i.file === file; })[0];
    if (!orig || orig.text !== xml.value) return null;
    var v = db.index.validation, r = (v.results || {})[file];
    if (!r || !r.schema) return null;
    return { status: r.schema === "pass" ? "pass" : "fail", findings: [{ level: r.schema === "pass" ? "pass" : "error", message: T("Valid against the official schema in the build check of {date} (GitHub Actions, libxml2 {v}). Edit the module, and this check runs again on request.", { date: v.checked.slice(0, 10), v: v.libxml2 }) }] };
  }
  function schemaCheck() {
    var b = $("#se-schema"), out = $("#se-schema-out");
    b.disabled = true; out.innerHTML = '<p class="st-wait">' + esc(T("Checking against the official schema…")) + "</p>";
    S1K.schemaCheck(xml.value).then(function (r) {
      if (!r.ok) { lastSchema = { status: "skip", findings: [{ level: "skip", message: r.error || T("The check could not run.") }] }; }
      else if (r.valid) lastSchema = { status: "pass", findings: [{ level: "pass", message: T("Valid against {schema} (S1000D Issue 6, fetched from www.s1000d.org), checked by libxml2.", { schema: r.schema }) }] };
      else lastSchema = { status: "fail", findings: (r.errors || []).map(function (e) { return { level: "error", message: e.message, line: e.line || null }; }) };
      origin = origin === "csdb" ? "csdb-checked" : origin;
      out.innerHTML = ""; check();
    }).catch(function () {
      lastSchema = { status: "skip", findings: [{ level: "skip", message: T("The validation service can't be reached from here. The other checks still work.") }] };
      out.innerHTML = ""; check();
    }).then(function () { b.disabled = false; });
  }
  function declare(decl) {
    var src = xml.value, m = /<!DOCTYPE\s+(\w+)\s*(\[([\s\S]*?)\])?\s*>/.exec(src);
    var notation = /<!NOTATION\s+svg\b/.test(src) ? "" : '\n<!NOTATION svg SYSTEM "svg">';
    if (m && m[2]) src = src.slice(0, m.index) + m[0].replace(/\]\s*>$/, notation + "\n" + decl + "\n]>") + src.slice(m.index + m[0].length);
    else if (m) src = src.slice(0, m.index) + "<!DOCTYPE " + m[1] + " [" + notation + "\n" + decl + "\n]>" + src.slice(m.index + m[0].length);
    else src = src.replace(/(<\?xml[^>]*\?>\s*)?/, function (h) { return (h || "") + "<!DOCTYPE dmodule [" + notation + "\n" + decl + "\n]>\n"; });
    xml.value = src; lines(); check();
    say(T("Declared in the DOCTYPE."));
  }

  /* ---------- Preview ---------- */
  function preview() {
    var host = $("#se-preview");
    if (host.hidden) return;
    if (!report || !report.doc || !report.ident) { host.innerHTML = '<p class="kb-hint">' + esc(T("The preview needs well-formed XML of a data module or publication module.")) + "</p>"; return; }
    try { host.innerHTML = S1K.header(report.ident) + '<div class="s1k-body">' + S1K.render(report.doc, { db: db, changes: true, href: function (code) { var t = db.latest(code); return t ? "/studio/s1000d?open=" + encodeURIComponent(t.file) : "#"; } }) + "</div>"; }
    catch (e) { host.innerHTML = '<p class="kb-hint">' + esc(T("This part of the module can't be previewed: {msg}", { msg: e.message })) + "</p>"; }
  }
  function tab(which) {
    var checks = which === "checks";
    $("#se-tab-checks").setAttribute("aria-selected", String(checks)); $("#se-tab-preview").setAttribute("aria-selected", String(!checks));
    $("#se-tab-checks").tabIndex = checks ? 0 : -1; $("#se-tab-preview").tabIndex = checks ? -1 : 0;
    $("#se-checks").hidden = !checks; $("#se-preview").hidden = checks;
    if (!checks) preview();
  }

  /* ---------- Wiring ---------- */
  xml.addEventListener("input", function () { lines(); clearTimeout(timer); timer = setTimeout(function () { if (origin === "csdb") origin = "edited"; lastSchema = null; toForm(); check(); }, 350); });
  xml.addEventListener("scroll", function () { gutter.scrollTop = xml.scrollTop; });
  document.querySelector(".ae-form").addEventListener("change", fromForm);
  document.querySelector(".ae-form").addEventListener("input", function (e) { if (e.target.tagName === "INPUT" && e.target.type !== "date") fromForm(e); });
  $("#se-layers").addEventListener("click", function (e) {
    var b = e.target.closest(".ae-line"); if (b) jump(+b.dataset.line);
    var d = e.target.closest(".ae-apply"); if (d) declare(d.dataset.decl);
  });
  $("#se-open").addEventListener("change", function (e) { if (e.target.value) openFile(e.target.value); });
  document.querySelectorAll("[data-new]").forEach(function (b) { b.addEventListener("click", function () { open(template(b.dataset.new), "", "new"); }); });
  $("#se-file").addEventListener("change", function (e) {
    var f = e.target.files[0]; e.target.value = "";
    if (!f) return;
    Kit.readText(f, 2 * 1024 * 1024).then(function (t) { open(t, f.name, "file"); }).catch(function (err) { say(err.message, true); });
  });
  $("#se-save").addEventListener("click", function () {
    var id = report && report.ident, name = id ? id.file : file || "module.xml";
    if (keep(name, xml.value)) { say(T("Saved in this browser as {name}. It stays on this device.", { name: name })); fill(); }
    else say(T("This browser didn't let the page save. Download the XML instead."), true);
  });
  $("#se-download").addEventListener("click", function () {
    var id = report && report.ident;
    Kit.save(new Blob([xml.value], { type: "application/xml" }), id ? id.file : file || "module.xml");
  });
  $("#se-schema").addEventListener("click", schemaCheck);
  [$("#se-tab-checks"), $("#se-tab-preview")].forEach(function (b, i, all) {
    b.addEventListener("click", function () { tab(i ? "preview" : "checks"); });
    b.addEventListener("keydown", function (e) { if (e.key === "ArrowRight" || e.key === "ArrowLeft") { var o = all[1 - i]; o.focus(); tab(o === all[0] ? "checks" : "preview"); } });
  });

  S1K.load().then(function (d) {
    db = d; fill();
    var want = new URLSearchParams(location.search).get("open");
    openFile(want && db.items.some(function (i) { return i.file === want; }) ? want : "DMC-ARFRIG-A-20-00-00-00A-520A-A_002-00_EN-US.XML");
    $("#se-open").value = file;
  }).catch(function (e) { say(e.message, true); open(template("descript"), "", "new"); });
})();
