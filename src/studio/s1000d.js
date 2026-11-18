/* S1000D in the browser, for the aerospace demonstrations (/studio/s1000d, /studio/csdb, /studio/ipc, /studio/ietm).
   It parses data modules safely, reads their identification and references, evaluates applicability against the
   ACT, CCT and PCT, applies the project BREX with XPath, and renders the content types the fictional ARF-1 CSDB uses.
   The CSDB is fetched from this site; everything is checked and rendered in the browser.
   Not a certified S1000D tool: it checks what it says it checks, and leaves technical accuracy and approval to people. */
var S1K = (function () {
  "use strict";
  var T = typeof window !== "undefined" && window.Kit ? Kit.t : function (s, v) { return String(s).replace(/\{(\w+)\}/g, function (m, k) { return v && v[k] != null ? v[k] : m; }); };
  var esc = function (s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); };
  /** Generated text: the words a publication adds around a module's content (WARNING, Procedure, Table 2, Step 3).
      It is part of the publication, so it is in the module's language, English here, whatever language the
      interface is in. Only the interface around the publication is translated. */
  var G = function (s, v) { return String(s).replace(/\{(\w+)\}/g, function (m, k) { return v && v[k] != null ? v[k] : m; }); };
  /* The interface may be in French, German, Spanish or Hindi; the modules are in English (their <language> says en-US).
     Module text shown inside the interface carries its language, so that a screen reader reads it as English
     (WCAG 3.1.2). Nothing is marked on an English page. */
  var PAGE = typeof document !== "undefined" ? (document.documentElement.lang || "en") : "en";
  function langOf(id) { return id && id.lang ? id.lang + (id.country ? "-" + id.country : "") : "en-US"; }
  function differs(lang) { return lang.slice(0, 2).toLowerCase() !== PAGE.slice(0, 2).toLowerCase(); }
  /** Escaped module text, marked with its language when the page is in another. */
  function inLang(s, id) { var l = langOf(id); return differs(l) ? '<span lang="' + esc(l) + '">' + esc(s) + "</span>" : esc(s); }
  /** A lang attribute for an element that holds a module's content, or nothing when the page is in the same language. */
  function langAttr(id) { var l = langOf(id); return differs(l) ? ' lang="' + esc(l) + '"' : ""; }
  /** A link to another studio page in the language of this one: the translated pages live under /fr, /de, /es and /hi. */
  function pageHref(path) { var m = typeof location !== "undefined" && /^\/([a-z]{2})\/studio(\/|$)/.exec(location.pathname); return m ? "/" + m[1] + path : path; }
  var MAX = 2 * 1024 * 1024, BASE = (typeof window !== "undefined" && window.S1K_BASE) || "/studio/aerospace/csdb/";
  var ISSUE = "S1000D Issue 6", SCHEMA = "http://www.s1000d.org/S1000D_6/xml_schema_flat/";
  var NAMES = { "022": "Business rules exchange", "00W": "Applicability cross-reference table", "00Q": "Conditions cross-reference table", "00P": "Product cross-reference table",
    "040": "Description", "131": "Normal operation procedure", "271": "Adjust", "310": "Visual examination", "340": "Function test", "421": "Fault isolation procedure",
    "520": "Remove procedure", "720": "Install procedure", "941": "Illustrated parts data" };
  var K = function (s) { return s; };     // marks English that is stored as data and translated where it is shown
  /** What each schema is called in the interface (translated where it is shown; the abbreviations stay as they are). */
  var KINDS = { descript: K("Descriptive"), proced: K("Procedural"), fault: K("Fault isolation"), ipd: K("Illustrated parts data"), brex: "BREX", appliccrossreftable: "ACT", condcrossreftable: "CCT", prdcrossreftable: "PCT", pm: K("Publication module") };

  /* ---------- Safe parsing ---------- */
  var DECL = /<!(ENTITY|NOTATION|ELEMENT|ATTLIST)\b[^>]*>/g;
  var SAFE_ENTITY = /^<!ENTITY\s+[A-Za-z_][\w.-]*\s+SYSTEM\s+"[^"%&<]*"\s+NDATA\s+[A-Za-z_][\w.-]*\s*>$/;
  var SAFE_NOTATION = /^<!NOTATION\s+[A-Za-z_][\w.-]*\s+(SYSTEM\s+"[^"%&<]*"|PUBLIC\s+"[^"%&<]*"(\s+"[^"%&<]*")?)\s*>$/;
  /** Null if the DOCTYPE is safe, or why it isn't. A DOCTYPE may declare notations and unparsed (NDATA) entities only:
      no external DTD, no parameter entities, no parsed entities, so nothing can expand. */
  function doctypeProblem(text) {
    var m = /<!DOCTYPE\s+[A-Za-z_][\w.-]*/.exec(text);
    if (!m) return null;
    var head = text.slice(m.index, m.index + 200);
    if (/^<!DOCTYPE\s+[\w.-]+\s+(SYSTEM|PUBLIC)\b/.test(head)) return T("The DOCTYPE names an external DTD. External DTDs are not loaded.");
    var sub = /<!DOCTYPE\s+[\w.-]+\s*\[([\s\S]*?)\]\s*>/.exec(text);
    if (!sub) return null;
    var body = sub[1], d, bad = null;
    if (body.indexOf("%") > -1) return T("The DOCTYPE declares a parameter entity. Only notations and unparsed entities are allowed.");
    DECL.lastIndex = 0;
    while ((d = DECL.exec(body))) if (!SAFE_ENTITY.test(d[0]) && !SAFE_NOTATION.test(d[0])) { bad = d[0]; break; }
    if (bad) return T("The DOCTYPE declares something other than a notation or an unparsed (NDATA) entity: {decl}", { decl: bad.slice(0, 80) });
    if (body.replace(/<!--[\s\S]*?-->/g, "").replace(DECL, "").trim()) return T("The DOCTYPE contains text that is not a declaration.");
    return null;
  }
  /** Parses XML text. Returns {doc} or {error: {message, line, col}}. */
  function parse(text) {
    if (text.length > MAX) return { error: { message: T("The file is larger than 2 MB.") } };
    var bad = doctypeProblem(text);
    if (bad) return { error: { message: bad, line: lineOf(text, text.indexOf("<!DOCTYPE")) } };
    var doc = new DOMParser().parseFromString(text, "application/xml"), pe = doc.getElementsByTagName("parsererror")[0];
    if (pe) {
      var msg = pe.textContent.replace(/\s+/g, " ").trim(), line = /line (?:number )?(\d+)/i.exec(msg), col = /column (\d+)/i.exec(msg);
      msg = msg.replace(/^This page contains the following errors:\s*/i, "").replace(/Below is a rendering of the page.*$/i, "").replace(/^error on line \d+ at column \d+:\s*/i, "");
      return { error: { message: msg || T("The XML is not well-formed."), line: line ? +line[1] : null, col: col ? +col[1] : null } };
    }
    mapLines(text, doc);
    return { doc: doc };
  }
  function lineOf(text, at) { return at < 0 ? null : text.slice(0, at).split("\n").length; }
  /** Gives every element its line in the source (el._line), from the start tags in document order. */
  function mapLines(text, doc) {
    var re = /<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<\?[\s\S]*?\?>|<!DOCTYPE[^[>]*(\[[\s\S]*?\])?\s*>|<([A-Za-z_][\w.:-]*)/g, m, starts = [];
    while ((m = re.exec(text))) if (m[2]) starts.push(m.index);
    var all = doc.getElementsByTagName("*"), line = 1, pos = 0;
    for (var i = 0; i < all.length && i < starts.length; i++) {
      for (; pos < starts[i]; pos++) if (text.charCodeAt(pos) === 10) line++;
      all[i]._line = line;
    }
  }

  /* ---------- Identification ---------- */
  var $1 = function (el, sel) { return el ? el.querySelector(sel) : null; };
  function attrs(el, names) { var o = {}; names.forEach(function (n) { o[n] = el ? el.getAttribute(n) || "" : ""; }); return o; }
  function dmCodeText(c) {
    var a = attrs(c, ["modelIdentCode", "systemDiffCode", "systemCode", "subSystemCode", "subSubSystemCode", "assyCode", "disassyCode", "disassyCodeVariant", "infoCode", "infoCodeVariant", "itemLocationCode"]);
    return "DMC-" + a.modelIdentCode + "-" + a.systemDiffCode + "-" + a.systemCode + "-" + a.subSystemCode + a.subSubSystemCode + "-" + a.assyCode + "-" + a.disassyCode + a.disassyCodeVariant + "-" + a.infoCode + a.infoCodeVariant + "-" + a.itemLocationCode;
  }
  function pmCodeText(c) { var a = attrs(c, ["modelIdentCode", "pmIssuer", "pmNumber", "pmVolume"]); return "PMC-" + a.modelIdentCode + "-" + a.pmIssuer + "-" + a.pmNumber + "-" + a.pmVolume; }
  function text(el) { return el ? el.textContent.replace(/\s+/g, " ").trim() : ""; }
  /** The identification and status of a data module or publication module. */
  function ident(doc) {
    var r = doc.documentElement, dm = r.nodeName === "dmodule", pm = r.nodeName === "pm";
    if (!dm && !pm) return null;
    var idt = $1(r, dm ? "identAndStatusSection > dmAddress > dmIdent" : "identAndStatusSection > pmAddress > pmIdent");
    var st = $1(r, dm ? "identAndStatusSection > dmStatus" : "identAndStatusSection > pmStatus");
    var code = $1(idt, dm ? "dmCode" : "pmCode"), iss = $1(idt, "issueInfo"), lang = $1(idt, "language"), d = $1(r, "issueDate");
    var loc = r.getAttributeNS("http://www.w3.org/2001/XMLSchema-instance", "noNamespaceSchemaLocation") || "";
    var schema = loc.replace(/^.*\//, "").replace(/\.xsd$/, "");
    var qa = $1(st, "qualityAssurance"), q1 = $1(qa, "firstVerification"), q2 = $1(qa, "secondVerification");
    var o = {
      kind: dm ? "dm" : "pm", code: code ? (dm ? dmCodeText(code) : pmCodeText(code)) : "", codeEl: code,
      issue: iss ? iss.getAttribute("issueNumber") : "", inWork: iss ? iss.getAttribute("inWork") : "",
      lang: lang ? lang.getAttribute("languageIsoCode") : "", country: lang ? lang.getAttribute("countryIsoCode") : "",
      date: d ? [d.getAttribute("year"), d.getAttribute("month"), d.getAttribute("day")].join("-") : "",
      techName: text($1(r, "dmAddressItems > dmTitle > techName")), infoName: text($1(r, "dmAddressItems > dmTitle > infoName")),
      pmTitle: text($1(r, "pmAddressItems > pmTitle")), infoCode: code && dm ? code.getAttribute("infoCode") : "",
      systemCode: code && dm ? code.getAttribute("systemCode") : "", schemaLocation: loc, schema: pm ? "pm" : schema,
      issueType: st ? st.getAttribute("issueType") : "", security: (($1(st, "security") || {}).getAttribute || function () { return ""; }).call($1(st, "security"), "securityClassification"),
      qa: q2 ? T("Second verification ({type})", { type: q2.getAttribute("verificationType") }) : q1 ? T("First verification ({type})", { type: q1.getAttribute("verificationType") }) : T("Unverified"),
      qaCode: q2 ? "second" : q1 ? "first" : "unverified",
      applic: text($1(st, "applic > displayText")), owner: text($1(st, "responsiblePartnerCompany > enterpriseName")), originator: text($1(st, "originator > enterpriseName")),
      distribution: text($1(st, "dataDistribution")), remarks: text($1(st, "remarks")),
      rfu: Array.prototype.map.call(st ? st.querySelectorAll("reasonForUpdate") : [], function (x) { return { id: x.getAttribute("id"), type: x.getAttribute("updateReasonType"), text: text(x) }; }),
    };
    o.title = dm ? o.techName + (o.infoName ? " - " + o.infoName : "") : o.pmTitle;
    o.file = o.code + "_" + o.issue + "-" + o.inWork + "_" + (o.lang || "").toUpperCase() + "-" + o.country + ".XML";
    o.type = KINDS[o.schema] || o.schema;
    return o;
  }

  /* ---------- The CSDB ---------- */
  var csdb = null;
  /** Loads the CSDB of the demonstration: every module, parsed. Resolves to {items, byCode}. */
  function load() {
    if (csdb) return csdb;
    // The offline IETM package carries the CSDB in a script (window.S1K_EMBED), because a page opened from a file can't fetch.
    var embed = typeof window !== "undefined" && window.S1K_EMBED;
    var getIndex = embed ? Promise.resolve(embed.index) : fetch(BASE + "index.json").then(function (r) { if (!r.ok) throw new Error(T("The CSDB couldn't be loaded ({status}).", { status: r.status })); return r.json(); });
    var getText = function (name) { return embed ? Promise.resolve(embed.files[name]) : fetch(BASE + name).then(function (r) { return r.text(); }); };
    csdb = getIndex.then(function (index) {
      return Promise.all(index.files.filter(function (f) { return /\.XML$/.test(f.file); }).map(function (f) {
        return getText(f.file).then(function (t) {
          var p = parse(t); if (!p.doc) throw new Error(f.file + ": " + p.error.message);
          return { file: f.file, text: t, doc: p.doc, id: ident(p.doc), bytes: f.bytes };
        });
      })).then(function (items) {
        var byCode = {};
        items.forEach(function (x) { (byCode[x.id.code] = byCode[x.id.code] || []).push(x); });
        Object.keys(byCode).forEach(function (k) { byCode[k].sort(function (a, b) { return (a.id.issue + a.id.inWork).localeCompare(b.id.issue + b.id.inWork); }); });
        var db = { items: items, byCode: byCode, index: index, icns: index.files.filter(function (f) { return /\.SVG$/.test(f.file); }).map(function (f) { return f.file; }) };
        db.latest = function (code) { var l = byCode[code]; return l ? l[l.length - 1] : null; };
        db.get = function (code, issue) { var l = byCode[code] || []; for (var i = 0; i < l.length; i++) if (!issue || l[i].id.issue === issue) return l[i]; return null; };
        db.find = function (pred) { for (var i = items.length - 1; i >= 0; i--) if (pred(items[i])) return items[i]; return null; };
        db.brex = db.find(function (x) { return x.id.schema === "brex"; });
        db.act = db.find(function (x) { return x.id.schema === "appliccrossreftable"; });
        db.cct = db.find(function (x) { return x.id.schema === "condcrossreftable"; });
        db.pct = db.find(function (x) { return x.id.schema === "prdcrossreftable"; });
        db.props = properties(db);
        db.products = products(db);
        return db;
      });
    });
    csdb.catch(function () { csdb = null; });
    return csdb;
  }
  function icnUrl(icn) { return BASE + icn + ".SVG"; }
  var svgCache = {};
  /** The text of an illustration, for drawing it inline with its hotspots. */
  function icnText(icn) {
    var embed = typeof window !== "undefined" && window.S1K_EMBED;
    if (embed && embed.files[icn + ".SVG"]) return Promise.resolve(embed.files[icn + ".SVG"]);
    return svgCache[icn] || (svgCache[icn] = fetch(icnUrl(icn)).then(function (r) { if (!r.ok) throw new Error(icn); return r.text(); }));
  }

  /* ---------- References ---------- */
  function refs(doc) {
    var out = { dm: [], pm: [], icn: [], internal: [] };
    Array.prototype.forEach.call(doc.getElementsByTagName("dmRef"), function (r) {
      var c = $1(r, "dmRefIdent > dmCode"), i = $1(r, "dmRefIdent > issueInfo");
      if (c) out.dm.push({ code: dmCodeText(c), issue: i ? i.getAttribute("issueNumber") : "", inWork: i ? i.getAttribute("inWork") : "", el: r, brex: !!(r.parentNode && r.parentNode.nodeName === "brexDmRef"), act: !!(r.parentNode && /CrossRefTableRef$/.test(r.parentNode.nodeName)) });
    });
    Array.prototype.forEach.call(doc.getElementsByTagName("graphic"), function (g) { out.icn.push({ icn: g.getAttribute("infoEntityIdent"), el: g }); });
    Array.prototype.forEach.call(doc.getElementsByTagName("internalRef"), function (r) { out.internal.push({ id: r.getAttribute("internalRefId"), type: r.getAttribute("internalRefTargetType"), el: r }); });
    return out;
  }
  /** The unparsed entities the DOCTYPE declares: {name: file}. */
  function entities(textSrc) {
    var o = {}, re = /<!ENTITY\s+([A-Za-z_][\w.-]*)\s+SYSTEM\s+"([^"]*)"\s+NDATA/g, m;
    while ((m = re.exec(textSrc))) o[m[1]] = m[2];
    return o;
  }

  /* ---------- Applicability ---------- */
  function values(node) {
    var vals = [];
    Array.prototype.forEach.call(node.getElementsByTagName("enumeration"), function (e) { (e.getAttribute("applicPropertyValues") || "").split("|").forEach(function (v) { if (v) vals.push(v); }); });
    return { values: vals, pattern: node.getAttribute("valuePattern") || "" };
  }
  function properties(db) {
    var p = {};
    if (db.act) Array.prototype.forEach.call(db.act.doc.getElementsByTagName("productAttribute"), function (a) { var v = values(a); p["prodattr:" + a.getAttribute("id")] = { type: "prodattr", id: a.getAttribute("id"), name: text($1(a, "displayName")) || text($1(a, "name")), values: v.values, pattern: v.pattern }; });
    if (db.cct) {
      var types = {};
      Array.prototype.forEach.call(db.cct.doc.getElementsByTagName("condType"), function (t) { types[t.getAttribute("id")] = values(t); });
      Array.prototype.forEach.call(db.cct.doc.getElementsByTagName("cond"), function (c) { var v = types[c.getAttribute("condTypeRefId")] || { values: [] }; p["condition:" + c.getAttribute("id")] = { type: "condition", id: c.getAttribute("id"), name: text($1(c, "name")), values: v.values, pattern: v.pattern || "" }; });
    }
    return p;
  }
  function products(db) {
    if (!db.pct) return [];
    return Array.prototype.map.call(db.pct.doc.getElementsByTagName("product"), function (pr) {
      var a = {};
      Array.prototype.forEach.call(pr.getElementsByTagName("assign"), function (x) { a[x.getAttribute("applicPropertyType") + ":" + x.getAttribute("applicPropertyIdent")] = x.getAttribute("applicPropertyValue"); });
      var label = T("Serial number {sn}", { sn: a["prodattr:serialNumber"] || "?" }) + " · " + (a["prodattr:variant"] || "") + " · M01 " + (a["condition:M01"] === "post" ? T("incorporated") : T("not incorporated"));
      return { id: pr.getAttribute("id"), assign: a, label: label };
    });
  }
  /** Whether an applic element is true for a product: true, false, or null when no product is chosen. */
  function applies(node, product) {
    if (!product || !node) return null;
    var kids = Array.prototype.filter.call(node.children, function (c) { return c.nodeName === "assert" || c.nodeName === "evaluate"; });
    if (!kids.length) return true;
    return kids.every(function (k) { return evalNode(k, product); });
  }
  function evalNode(n, product) {
    if (n.nodeName === "assert") {
      var have = product.assign[n.getAttribute("applicPropertyType") + ":" + n.getAttribute("applicPropertyIdent")];
      if (have == null) return true; // a property the product doesn't state is not held against it
      return (n.getAttribute("applicPropertyValues") || "").split("|").some(function (v) { var r = v.split("~"); return r.length === 2 ? have >= r[0] && have <= r[1] : have === v; });
    }
    var ks = Array.prototype.filter.call(n.children, function (c) { return c.nodeName === "assert" || c.nodeName === "evaluate"; }).map(function (k) { return evalNode(k, product); });
    return n.getAttribute("andOr") === "or" ? ks.some(Boolean) : ks.every(Boolean);
  }

  /* ---------- Validation, layer by layer ---------- */
  function F(level, msg, el, fix) { return { level: level, message: msg, line: el && el._line ? el._line : typeof el === "number" ? el : null, fix: fix || "" }; }
  /** Applies a BREX's structure object rules with XPath. */
  function brexCheck(doc, brexDoc, label) {
    var out = [], schema = doc.documentElement.getAttributeNS("http://www.w3.org/2001/XMLSchema-instance", "noNamespaceSchemaLocation") || "";
    Array.prototype.forEach.call(brexDoc.getElementsByTagName("contextRules"), function (ctx) {
      var rc = ctx.getAttribute("rulesContext");
      if (rc && rc !== schema) return;
      Array.prototype.forEach.call(ctx.getElementsByTagName("structureObjectRule"), function (rule) {
        var op = $1(rule, "objectPath"), flag = op.getAttribute("allowedObjectFlag"), path = op.textContent.trim(), use = text($1(rule, "objectUse"));
        var vals = Array.prototype.map.call(rule.getElementsByTagName("objectValue"), function (v) { return { form: v.getAttribute("valueForm") || "single", v: v.getAttribute("valueAllowed") }; });
        var res, nodes = [], bool = null;
        try { res = doc.evaluate(path, doc, null, XPathResult.ANY_TYPE, null); }
        catch (e) { out.push(F("error", T("The BREX rule cannot be evaluated: {path}", { path: path }))); return; }
        if (res.resultType === XPathResult.BOOLEAN_TYPE) bool = res.booleanValue;
        else if (res.resultType === XPathResult.UNORDERED_NODE_ITERATOR_TYPE || res.resultType === XPathResult.ORDERED_NODE_ITERATOR_TYPE) { var n; while ((n = res.iterateNext())) nodes.push(n); }
        var where = function (n) { return n.nodeType === 2 ? n.ownerElement : n; };
        if (flag === "0" && (nodes.length || bool === true)) nodes.slice(0, 5).forEach(function (n) { out.push(F("error", label + use, where(n), T("Rule: {path}", { path: path }))); });
        if (flag === "0" && bool === true && !nodes.length) out.push(F("error", label + use, null, T("Rule: {path}", { path: path })));
        if (flag === "1" && !nodes.length && bool !== true) out.push(F("error", label + use, null, T("Rule: {path}", { path: path })));
        if (vals.length) nodes.forEach(function (n) {
          var val = n.nodeType === 2 ? n.nodeValue : n.textContent;
          var ok = vals.some(function (x) {
            if (x.form === "pattern") { try { return new RegExp("^(?:" + x.v + ")$").test(val); } catch (e) { return true; } }
            if (x.v.indexOf("~") > -1) { var r = x.v.split("~"); return val.length === r[0].length && val >= r[0] && val <= r[1]; }
            return x.v === val;
          });
          if (!ok) out.push(F("error", label + T("\"{value}\" is not allowed. {rule}", { value: val, rule: use }), where(n), T("Allowed: {list}", { list: vals.map(function (x) { return x.v; }).join(", ") })));
        });
      });
    });
    return out;
  }
  /** The checks, in order. db is the loaded CSDB (for references, applicability and the BREX). Schema validation is
      not here: it needs the official schemas, which this site doesn't redistribute (see S1K.schemaCheck). */
  function validate(src, db, fileName) {
    var layers = [], add = function (id, name, findings, passText) {
      var st = findings.some(function (f) { return f.level === "error"; }) ? "fail" : findings.some(function (f) { return f.level === "warning"; }) ? "warn" : "pass";
      layers.push({ id: id, name: name, status: st, findings: findings.length ? findings : [F("pass", passText)] });
    };
    var p = parse(src);
    if (!p.doc) {
      layers.push({ id: "wellformed", name: T("Well-formed XML"), status: "fail", findings: [F("error", p.error.message, p.error.line, T("Correct the XML at this line. A start tag needs its end tag, attribute values need quotes, and & is written &amp;."))] });
      return { layers: layers, doc: null };
    }
    var doc = p.doc, id = ident(doc);
    layers.push({ id: "wellformed", name: T("Well-formed XML"), status: "pass", findings: [F("pass", T("Well-formed. Parsed in the browser with no external DTD and no entity expansion."))] });
    if (!id) { layers.push({ id: "ident", name: T("Identification"), status: "fail", findings: [F("error", T("The root element is <{name}>. A data module is <dmodule>; a publication module is <pm>.", { name: doc.documentElement.nodeName }), doc.documentElement)] }); return { layers: layers, doc: doc }; }
    // Identification
    var fi = [], codeRe = id.kind === "dm" ? /^DMC-[A-Z0-9]{2,14}-[A-Z0-9]{1,4}-[A-Z0-9]{2,3}-[A-Z0-9]{2}-[A-Z0-9]{2,4}-[A-Z0-9]{2}[A-Z0-9]{1,3}-[A-Z0-9]{3}[A-Z0-9]-[ABCDT]$/ : /^PMC-[A-Z0-9]{2,14}-[A-Z0-9]{5}-[A-Z0-9]{5}-[A-Z0-9]{2}$/;
    if (!codeRe.test(id.code)) fi.push(F("error", T("The code {code} doesn't have the form S1000D gives it.", { code: id.code }), id.codeEl, T("Check each part of the code: model, system difference, SNS, disassembly, information code and item location.")));
    if (!/^\d{3}$/.test(id.issue) || !/^\d{2}$/.test(id.inWork)) fi.push(F("error", T("The issue number needs three digits and the in-work number two."), $1(doc, "issueInfo")));
    if (fileName && fileName !== id.file) fi.push(F("warning", T("The file name doesn't agree with the identification. Expected {name}.", { name: id.file }), id.codeEl));
    var dt = new Date(id.date + "T00:00:00Z"); if (isNaN(dt) || dt.toISOString().slice(0, 10) !== id.date) fi.push(F("error", T("The issue date {date} is not a real date.", { date: id.date }), $1(doc, "issueDate")));
    if (id.issueType === "changed" && id.issue === "001") fi.push(F("error", T("Issue type is changed, but this is issue 001."), $1(doc, "dmStatus, pmStatus")));
    if (id.issueType === "changed" && !id.rfu.length) fi.push(F("error", T("A changed module needs a reason for update."), $1(doc, "dmStatus, pmStatus"), T("Add a reasonForUpdate after qualityAssurance.")));
    if (id.issueType === "new" && +id.issue > 1) fi.push(F("warning", T("Issue type is new, but the issue number is {n}.", { n: id.issue }), $1(doc, "dmStatus, pmStatus")));
    if (id.schemaLocation && id.schemaLocation.indexOf(SCHEMA) !== 0) fi.push(F("warning", T("The schema location is not an S1000D Issue 6 schema. This demonstration checks Issue 6."), doc.documentElement));
    if (id.kind === "dm" && id.infoCode && NAMES[id.infoCode] && id.infoName && id.infoName !== NAMES[id.infoCode]) fi.push(F("warning", T("Information code {code} is usually titled \"{name}\".", { code: id.infoCode, name: NAMES[id.infoCode] }), $1(doc, "infoName")));
    add("ident", T("Identification and status"), fi, T("The code, issue, language, date and status agree with each other."));
    // References
    var fr = [], R = refs(doc), ids = {};
    Array.prototype.forEach.call(doc.querySelectorAll("[id]"), function (e) { ids[e.getAttribute("id")] = e; });
    R.internal.forEach(function (r) { if (!ids[r.id]) fr.push(F("error", T("internalRef points to \"{id}\", which is not in this module.", { id: r.id }), r.el)); });
    Array.prototype.forEach.call(doc.querySelectorAll("[nextActionRefId]"), function (e) { if (!ids[e.getAttribute("nextActionRefId")]) fr.push(F("error", T("{el} points to step \"{id}\", which is not in this module.", { el: e.nodeName, id: e.getAttribute("nextActionRefId") }), e)); });
    if (db) R.dm.forEach(function (r) {
      if (/^DMC-S1000D-/.test(r.code)) return;
      var held = db.byCode[r.code];
      if (!held) fr.push(F("error", T("dmRef points to {code}, which is not in the CSDB.", { code: r.code }), r.el, T("Correct the code, or add the module to the CSDB.")));
      else if (r.issue && !held.some(function (x) { return x.id.issue === r.issue && x.id.inWork === r.inWork; })) fr.push(F("error", T("dmRef points to issue {issue} of {code}, which is not in the CSDB.", { issue: r.issue, code: r.code }), r.el));
    });
    var ents = entities(src);
    R.icn.forEach(function (g) {
      if (!ents[g.icn]) fr.push(F("error", T("graphic refers to {icn}, which the DOCTYPE does not declare.", { icn: g.icn }), g.el, "<!ENTITY " + g.icn + " SYSTEM \"" + g.icn + ".SVG\" NDATA svg>"));
      else if (db && db.icns.indexOf(ents[g.icn]) < 0) fr.push(F("warning", T("The illustration {file} is not in this CSDB.", { file: ents[g.icn] }), g.el));
    });
    add("refs", T("References"), fr, T("Every reference resolves: {n} data module references, {g} illustrations, {i} internal references.", { n: R.dm.length, g: R.icn.length, i: R.internal.length }));
    // Applicability
    var fa = [];
    Array.prototype.forEach.call(doc.querySelectorAll("[applicRefId]"), function (e) { var a = ids[e.getAttribute("applicRefId")]; if (!a || a.nodeName !== "applic") fa.push(F("error", T("applicRefId \"{id}\" has no applicability annotation in this module.", { id: e.getAttribute("applicRefId") }), e)); });
    if (db) Array.prototype.forEach.call(doc.getElementsByTagName("assert"), function (a) {
      var key = a.getAttribute("applicPropertyType") + ":" + a.getAttribute("applicPropertyIdent"), prop = db.props[key];
      if (!prop) { fa.push(F("error", T("assert names {type} \"{id}\", which the ACT and CCT do not define.", { type: a.getAttribute("applicPropertyType"), id: a.getAttribute("applicPropertyIdent") }), a, T("Defined: {list}", { list: Object.keys(db.props).join(", ") }))); return; }
      (a.getAttribute("applicPropertyValues") || "").split(/[|~]/).forEach(function (v) {
        if (prop.values.length && prop.values.indexOf(v) < 0) fa.push(F("error", T("\"{v}\" is not a value of {name}. Allowed: {list}.", { v: v, name: prop.id, list: prop.values.join(", ") }), a));
        else if (prop.pattern && !new RegExp("^(?:" + prop.pattern + ")$").test(v)) fa.push(F("error", T("\"{v}\" does not match the pattern {p} of {name}.", { v: v, p: prop.pattern, name: prop.id }), a));
      });
    });
    Array.prototype.forEach.call(doc.getElementsByTagName("applic"), function (a) { if (!$1(a, "displayText") && a.parentNode.nodeName !== "dmStatus") fa.push(F("warning", T("An applicability annotation has no display text, so a reader sees only the logic."), a)); });
    add("applic", T("Applicability"), fa, T("Every annotation names a defined property and an allowed value."));
    // Business rules
    if (db && db.brex) {
      var fb = id.schema === "brex" ? [] : brexCheck(doc, db.brex.doc, "");
      var sns = Array.prototype.map.call(db.brex.doc.querySelectorAll("snsSystem > snsCode"), function (c) { return c.textContent; });
      if (id.kind === "dm" && id.schema !== "brex" && sns.length && sns.indexOf(id.systemCode) < 0) fb.push(F("error", T("System code {c} is not in the project SNS ({list}).", { c: id.systemCode, list: sns.join(", ") }), id.codeEl));
      add("brex", T("Project business rules (BREX)"), fb, T("No rule of the project BREX is broken. The S1000D default BREX layer is checked when the demonstration is built."));
    }
    layers.push({ id: "review", name: T("Technical accuracy and approval"), status: "human", findings: [F("human", T("A qualified person decides these. No program checks them, and this one doesn't pretend to."))] });
    return { layers: layers, doc: doc, ident: id };
  }
  /** Sends the XML to this site's validation function, which checks it against the official S1000D Issue 6 schema
      fetched from www.s1000d.org. The XML is not stored. Only on request. */
  function schemaCheck(src) {
    return fetch("/api/s1000d", { method: "POST", headers: { "Content-Type": "application/xml" }, body: src }).then(function (r) {
      return r.json().catch(function () { return { ok: false, error: T("The validation service answered {status}.", { status: r.status }) }; });
    });
  }

  /* ---------- Rendering ---------- */
  /** Renders a module's content as HTML. opts: product (filter by applicability), changes (mark changes), db (titles of
      referenced modules), interactive (fault isolation one step at a time), inline (SVG text by ICN, for hotspots). */
  function render(doc, opts) {
    opts = opts || {};
    var root = doc.documentElement, content = $1(root, "content"), ids = {}, nums = { figure: 0, table: 0 }, label = {};
    if (!content) return "";
    Array.prototype.forEach.call(doc.querySelectorAll("[id]"), function (e) { ids[e.getAttribute("id")] = e; });
    // Numbers for figures, tables and steps, so that internal references can name them.
    Array.prototype.forEach.call(content.getElementsByTagName("figure"), function (f) { if (f.getAttribute("id")) label[f.getAttribute("id")] = G("Figure {n}", { n: ++nums.figure }); else ++nums.figure; });
    Array.prototype.forEach.call(content.getElementsByTagName("table"), function (t) { if (t.getAttribute("id")) label[t.getAttribute("id")] = G("Table {n}", { n: ++nums.table }); else ++nums.table; });
    function stepNums(parent, prefix) {
      var n = 0;
      Array.prototype.forEach.call(parent.children, function (c) { if (c.nodeName === "proceduralStep") { n++; var num = prefix ? prefix + "." + n : String(n); c._num = num; if (c.getAttribute("id")) label[c.getAttribute("id")] = G("Step {n}", { n: num }); stepNums(c, num); } });
    }
    var main = $1(content, "mainProcedure"); if (main) stepNums(main, "");
    var iso = $1(content, "isolationMainProcedure");
    if (iso) { var k = 0; Array.prototype.forEach.call(iso.children, function (c) { if (c.nodeName === "isolationStep" || c.nodeName === "isolationProcedureEnd") { c._num = ++k; label[c.getAttribute("id")] = G("Step {n}", { n: k }); } }); }
    function hidden(el) {
      var ref = el.getAttribute && el.getAttribute("applicRefId");
      return !!(ref && opts.product && applies(ids[ref], opts.product) === false);
    }
    function chg(el) {
      var t = el.getAttribute && el.getAttribute("changeType");
      return t && opts.changes ? " s1k-chg s1k-chg-" + t : "";
    }
    function applicTag(el) {
      var ref = el.getAttribute && el.getAttribute("applicRefId");
      return ref && ids[ref] ? '<span class="s1k-applic">' + esc(text($1(ids[ref], "displayText"))) + "</span>" : "";
    }
    function inline(el) {
      var out = "";
      Array.prototype.forEach.call(el.childNodes, function (n) {
        if (n.nodeType === 3) { out += esc(n.nodeValue); return; }
        if (n.nodeType !== 1) return;
        var nm = n.nodeName;
        if (nm === "emphasis") out += "<b>" + inline(n) + "</b>";
        else if (nm === "internalRef") { var id = n.getAttribute("internalRefId"); out += '<a class="s1k-iref" href="#s1k-' + esc(id) + '">' + esc(label[id] || (ids[id] && ids[id].nodeName === "supportEquipDescr" ? text($1(ids[id], "name")) : id)) + "</a>"; }
        else if (nm === "dmRef") out += dmLink(n);
        else if (nm === "randomList" || nm === "sequentialList") out += list(n);
        else if (nm === "subScript") out += "<sub>" + inline(n) + "</sub>";
        else if (nm === "superScript") out += "<sup>" + inline(n) + "</sup>";
        else out += inline(n);
      });
      return out;
    }
    function dmLink(n) {
      var c = $1(n, "dmRefIdent > dmCode"); if (!c) return "";
      var code = dmCodeText(c), title = text($1(n, "dmRefAddressItems > dmTitle")), target = opts.db ? opts.db.latest(code) : null;
      if (!title && target) title = target.id.title;
      title = title.replace(/^(.*?) (.*)$/, "$1 $2");
      return '<a class="s1k-dmref" href="' + (opts.href ? esc(opts.href(code)) : "#") + '" data-code="' + esc(code) + '">' + esc(title || code) + "</a> <code class=\"s1k-code\">" + esc(code.replace(/^DMC-/, "")) + "</code>";
    }
    function list(n) {
      var tag = n.nodeName === "sequentialList" ? "ol" : "ul";
      return "<" + tag + ">" + Array.prototype.map.call(n.children, function (li) { return li.nodeName === "listItem" && !hidden(li) ? "<li>" + blocks(li) + "</li>" : ""; }).join("") + "</" + tag + ">";
    }
    function para(p) { return hidden(p) ? "" : '<p class="' + chg(p).trim() + '">' + applicTag(p) + inline(p) + "</p>"; }
    function caution(n) {
      var kind = n.nodeName;
      return hidden(n) ? "" : '<div class="s1k-' + kind + chg(n) + '" role="note"><b>' + (kind === "warning" ? G("WARNING") : kind === "caution" ? G("CAUTION") : G("NOTE")) + "</b>" +
        Array.prototype.map.call(n.children, function (x) { return "<p>" + inline(x) + "</p>"; }).join("") + "</div>";
    }
    function figure(f) {
      if (hidden(f)) return "";
      var id = f.getAttribute("id"), gs = f.getElementsByTagName("graphic"), body = "";
      Array.prototype.forEach.call(gs, function (g) {
        var icn = g.getAttribute("infoEntityIdent");
        body += opts.inline && opts.inline[icn] ? '<div class="s1k-svg" data-icn="' + esc(icn) + '">' + opts.inline[icn] + "</div>"
          : '<img src="' + esc(icnUrl(icn)) + '" alt="' + esc(text($1(f, "title"))) + '" loading="lazy" width="800" height="560">';
        body += '<span class="s1k-icn">' + esc(icn) + "</span>";
      });
      return '<figure class="s1k-fig' + chg(f) + '" id="s1k-' + esc(id || "") + '">' + applicTag(f) + body + "<figcaption>" + esc(label[id] || "") + " " + esc(text($1(f, "title"))) + "</figcaption></figure>";
    }
    function table(t) {
      if (hidden(t)) return "";
      var id = t.getAttribute("id"), html = '<div class="s1k-tbl' + chg(t) + '" id="s1k-' + esc(id || "") + '" role="region" tabindex="0" aria-label="' + esc(label[id] || G("Table")) + '"><table>';
      html += "<caption>" + esc(label[id] || "") + " " + esc(text($1(t, "title"))) + "</caption>";
      Array.prototype.forEach.call(t.querySelectorAll("tgroup > thead, tgroup > tbody"), function (sec) {
        var head = sec.nodeName === "thead";
        html += head ? "<thead>" : "<tbody>";
        Array.prototype.forEach.call(sec.children, function (row) {
          if (row.nodeName !== "row" || hidden(row)) return;
          html += '<tr class="' + chg(row).trim() + '">' + Array.prototype.map.call(row.children, function (e) { return (head ? '<th scope="col">' : "<td>") + blocks(e) + (head ? "</th>" : "</td>"); }).join("") + "</tr>";
        });
        html += head ? "</thead>" : "</tbody>";
      });
      return html + "</table></div>";
    }
    function blocks(el) {
      var out = "";
      Array.prototype.forEach.call(el.childNodes, function (n) {
        if (n.nodeType === 3) { if (n.nodeValue.trim()) out += esc(n.nodeValue); return; }
        if (n.nodeType !== 1 || hidden(n)) return;
        var nm = n.nodeName;
        if (nm === "para" || nm === "simplePara" || nm === "notePara" || nm === "warningAndCautionPara") out += para(n);
        else if (nm === "title") return;
        else if (nm === "levelledPara") out += levelled(n);
        else if (nm === "figure") out += figure(n);
        else if (nm === "table") out += table(n);
        else if (nm === "warning" || nm === "caution" || nm === "note") out += caution(n);
        else if (nm === "randomList" || nm === "sequentialList") out += list(n);
        else out += inline(n);
      });
      return out;
    }
    var depth = 0;
    function levelled(lp) {
      if (hidden(lp)) return "";
      depth++;
      var h = Math.min(depth + 2, 6), html = '<section class="s1k-lp' + chg(lp) + '" id="s1k-' + esc(lp.getAttribute("id") || "") + '"><h' + h + ">" + esc(text($1(lp, "title"))) + "</h" + h + ">" + applicTag(lp) + blocks(lp) + "</section>";
      depth--;
      return html;
    }
    function step(s) {
      if (hidden(s)) return "";
      var title = Array.prototype.filter.call(s.children, function (c) { return c.nodeName === "title"; })[0];
      return '<li class="s1k-step' + chg(s) + '" id="s1k-' + esc(s.getAttribute("id") || "") + '"><span class="s1k-num">' + esc(s._num) + "</span><div>" + (title ? "<h4>" + esc(text(title)) + "</h4>" : "") + applicTag(s) +
        Array.prototype.map.call(s.children, function (c) {
          if (c.nodeName === "proceduralStep" || c.nodeName === "title") return "";
          return blocks({ childNodes: [c] });
        }).join("") + (s.querySelector(":scope > proceduralStep") ? '<ol class="s1k-steps">' + Array.prototype.map.call(s.children, function (c) { return c.nodeName === "proceduralStep" ? step(c) : ""; }).join("") + "</ol>" : "") + "</div></li>";
    }
    function prelim(pr, heading) {
      if (!pr) return "";
      var html = "<section class=\"s1k-prelim\"><h3>" + esc(heading) + "</h3>";
      var cond = $1(pr, "reqCondGroup");
      if (cond) {
        var items = Array.prototype.map.call(cond.children, function (c) {
          if (c.nodeName === "noConds") return "<li>" + G("None") + "</li>";
          return "<li>" + esc(text($1(c, "reqCond"))) + ($1(c, "dmRef") ? " " + G("Refer to {ref}.", { ref: dmLink($1(c, "dmRef")) }) : "") + "</li>";
        }).join("");
        html += "<h4>" + G("Required conditions") + "</h4><ul>" + items + "</ul>";
      }
      [["reqSupportEquips", "supportEquipDescr", G("Support equipment")], ["reqSupplies", "supplyDescr", G("Supplies")], ["reqSpares", "spareDescr", G("Spares")]].forEach(function (g) {
        var sec = $1(pr, g[0]); if (!sec) return;
        var rows = Array.prototype.filter.call(sec.getElementsByTagName(g[1]), function (x) { return !hidden(x); });
        html += "<h4>" + esc(g[2]) + "</h4>";
        if (!rows.length) { html += "<p>" + G("None") + "</p>"; return; }
        html += '<div class="s1k-tbl" role="region" tabindex="0" aria-label="' + esc(g[2]) + '"><table><thead><tr><th scope="col">' + G("Name") + '</th><th scope="col">' + G("Identification") + '</th><th scope="col">' + G("Quantity") + "</th></tr></thead><tbody>" +
          rows.map(function (x) { return '<tr id="s1k-' + esc(x.getAttribute("id") || "") + '"><td>' + esc(text($1(x, "name"))) + applicTag(x) + "</td><td><code>" + esc(text($1(x, "partNumber"))) + "</code></td><td>" + esc(text($1(x, "reqQuantity"))) + "</td></tr>"; }).join("") + "</tbody></table></div>";
      });
      var safe = $1(pr, "reqSafety");
      if (safe) html += "<h4>" + G("Safety conditions") + "</h4>" + ($1(safe, "noSafety") ? "<p>" + G("None") + "</p>" : blocks($1(safe, "safetyRqmts") || safe));
      return html + "</section>";
    }
    var kind = Array.prototype.filter.call(content.children, function (c) { return c.nodeName !== "referencedApplicGroup" && c.nodeName !== "refs"; })[0];
    if (!kind) return "";
    var html = "";
    if (kind.nodeName === "description") html = blocks(kind);
    else if (kind.nodeName === "procedure") {
      html = prelim($1(kind, "preliminaryRqmts"), G("Preliminary requirements"));
      html += '<section class="s1k-main"><h3>' + G("Procedure") + "</h3>" + Array.prototype.map.call(main.children, function (c) { return c.nodeName === "figure" ? figure(c) : ""; }).join("") +
        '<ol class="s1k-steps">' + Array.prototype.map.call(main.children, function (c) { return c.nodeName === "proceduralStep" ? step(c) : ""; }).join("") + "</ol></section>";
      var close = $1(kind, "closeRqmts");
      if (close) html += '<section class="s1k-prelim"><h3>' + G("Requirements after job completion") + "</h3><ul>" + Array.prototype.map.call($1(close, "reqCondGroup").children, function (c) { return "<li>" + (c.nodeName === "noConds" ? G("None") : esc(text($1(c, "reqCond")))) + "</li>"; }).join("") + "</ul></section>";
    } else if (kind.nodeName === "faultIsolation") {
      var ip = $1(kind, "isolationProcedure");
      html = prelim($1(ip, "preliminaryRqmts"), G("Preliminary requirements"));
      html += Array.prototype.map.call(iso.children, function (c) { return c.nodeName === "figure" ? figure(c) : ""; }).join("");
      html += '<section class="s1k-fault' + (opts.interactive ? " s1k-interactive" : "") + '"><h3>' + G("Fault isolation") + "</h3><ol class=\"s1k-isol\">" + Array.prototype.map.call(iso.children, function (c) {
        if (c.nodeName === "isolationStep") {
          var yes = $1(c, "yesAnswer"), no = $1(c, "noAnswer");
          return '<li class="s1k-is" id="s1k-' + esc(c.getAttribute("id")) + '" data-step="' + esc(c.getAttribute("id")) + '"><span class="s1k-num">' + c._num + "</span><div>" +
            Array.prototype.map.call(c.getElementsByTagName("action"), function (a) { return "<p>" + inline(a) + "</p>"; }).join("") +
            '<p class="s1k-q">' + esc(text($1(c, "isolationStepQuestion"))) + "</p>" +
            '<p class="s1k-ans"><a class="s1k-yes" href="#s1k-' + esc(yes.getAttribute("nextActionRefId")) + '" data-next="' + esc(yes.getAttribute("nextActionRefId")) + '">' + G("Yes: go to {step}", { step: label[yes.getAttribute("nextActionRefId")] || "" }) + "</a>" +
            '<a class="s1k-no" href="#s1k-' + esc(no.getAttribute("nextActionRefId")) + '" data-next="' + esc(no.getAttribute("nextActionRefId")) + '">' + G("No: go to {step}", { step: label[no.getAttribute("nextActionRefId")] || "" }) + "</a></p></div></li>";
        }
        if (c.nodeName === "isolationProcedureEnd") return '<li class="s1k-end" id="s1k-' + esc(c.getAttribute("id")) + '" data-step="' + esc(c.getAttribute("id")) + '"><span class="s1k-num">' + c._num + "</span><div><p><b>" + G("End of the procedure.") + "</b></p>" + Array.prototype.map.call(c.getElementsByTagName("action"), function (a) { return "<p>" + inline(a) + "</p>"; }).join("") + "</div></li>";
        return "";
      }).join("") + "</ol></section>";
    } else if (kind.nodeName === "illustratedPartsCatalog") {
      html = Array.prototype.map.call(kind.children, function (c) { return c.nodeName === "figure" ? figure(c) : ""; }).join("") + partsTable(kind, ids, opts);
    } else if (kind.nodeName === "applicCrossRefTable") {
      html = "<h3>" + G("Product attributes") + '</h3><div class="s1k-tbl" role="region" tabindex="0" aria-label="' + G("Product attributes") + '"><table><thead><tr><th scope="col">' + G("Identifier") + '</th><th scope="col">' + G("Name") + '</th><th scope="col">' + G("Description") + '</th><th scope="col">' + G("Values") + "</th></tr></thead><tbody>" +
        Array.prototype.map.call(kind.getElementsByTagName("productAttribute"), function (a) { var v = values(a); return "<tr><td><code>" + esc(a.getAttribute("id")) + "</code></td><td>" + esc(text($1(a, "name"))) + "</td><td>" + esc(text($1(a, "descr"))) + "</td><td>" + esc(v.values.join(", ") || (v.pattern ? G("pattern {p}", { p: v.pattern }) : "")) + "</td></tr>"; }).join("") + "</tbody></table></div>";
    } else if (kind.nodeName === "condCrossRefTable") {
      html = "<h3>" + G("Conditions") + '</h3><div class="s1k-tbl" role="region" tabindex="0" aria-label="' + G("Conditions") + '"><table><thead><tr><th scope="col">' + G("Identifier") + '</th><th scope="col">' + G("Name") + '</th><th scope="col">' + G("Description") + '</th><th scope="col">' + G("Values") + "</th></tr></thead><tbody>" +
        Array.prototype.map.call(kind.getElementsByTagName("cond"), function (c) { var t = doc.querySelector('condType[id="' + c.getAttribute("condTypeRefId") + '"]'); return "<tr><td><code>" + esc(c.getAttribute("id")) + "</code></td><td>" + esc(text($1(c, "name"))) + "</td><td>" + esc(text($1(c, "descr"))) + "</td><td>" + esc(t ? values(t).values.join(", ") : "") + "</td></tr>"; }).join("") + "</tbody></table></div>";
    } else if (kind.nodeName === "productCrossRefTable") {
      var cols = {};
      Array.prototype.forEach.call(kind.getElementsByTagName("assign"), function (a) { cols[a.getAttribute("applicPropertyIdent")] = 1; });
      cols = Object.keys(cols);
      html = "<h3>" + G("Products") + '</h3><div class="s1k-tbl" role="region" tabindex="0" aria-label="' + G("Products") + '"><table><thead><tr><th scope="col">' + G("Product") + "</th>" + cols.map(function (c) { return '<th scope="col"><code>' + esc(c) + "</code></th>"; }).join("") + "</tr></thead><tbody>" +
        Array.prototype.map.call(kind.getElementsByTagName("product"), function (p) { return "<tr><td><code>" + esc(p.getAttribute("id")) + "</code></td>" + cols.map(function (c) { var a = p.querySelector('assign[applicPropertyIdent="' + c + '"]'); return "<td>" + esc(a ? a.getAttribute("applicPropertyValue") : "") + "</td>"; }).join("") + "</tr>"; }).join("") + "</tbody></table></div>";
    } else if (kind.nodeName === "brex") {
      html = blocks($1(kind, "commonInfo") || doc.createElement("x"));
      html += "<h3>" + G("Structure object rules") + '</h3><div class="s1k-tbl" role="region" tabindex="0" aria-label="' + G("Structure object rules") + '"><table><thead><tr><th scope="col">' + G("Object path (XPath)") + '</th><th scope="col">' + G("Flag") + '</th><th scope="col">' + G("Rule") + '</th><th scope="col">' + G("Allowed values") + "</th></tr></thead><tbody>" +
        Array.prototype.map.call(kind.getElementsByTagName("structureObjectRule"), function (r) { var op = $1(r, "objectPath"), f = op.getAttribute("allowedObjectFlag"); return "<tr><td><code>" + esc(op.textContent.trim()) + "</code></td><td>" + esc(f === "0" ? G("must not exist") : f === "1" ? G("must exist") : G("may exist")) + "</td><td>" + esc(text($1(r, "objectUse"))) + "</td><td>" + esc(Array.prototype.map.call(r.getElementsByTagName("objectValue"), function (v) { return v.getAttribute("valueAllowed"); }).join(", ")) + "</td></tr>"; }).join("") + "</tbody></table></div>";
      html += "<h3>" + G("Standard numbering system") + "</h3><ul>" + Array.prototype.map.call(kind.querySelectorAll("snsSystem"), function (s) { return "<li><code>" + esc(text($1(s, "snsCode"))) + "</code> " + esc(text($1(s, "snsTitle"))) + "</li>"; }).join("") + "</ul>";
    } else if (root.nodeName === "pm") {
      html = '<ol class="s1k-toc">' + Array.prototype.map.call(content.children, function e(pe) {
        if (pe.nodeName !== "pmEntry") return "";
        return "<li><b>" + esc(text($1(pe, "pmEntryTitle"))) + "</b><ul>" + Array.prototype.map.call(pe.children, function (c) {
          if (c.nodeName === "dmRef") { var i = $1(c, "issueInfo"); return "<li>" + dmLink(c) + (i ? ' <span class="s1k-iss">' + G("issue {n}", { n: i.getAttribute("issueNumber") }) + "</span>" : "") + "</li>"; }
          if (c.nodeName === "pmEntry") return e(c);
          return "";
        }).join("") + "</ul></li>";
      }).join("") + "</ol>";
    }
    return html;
  }
  /** The parts list of an illustrated parts data module: one row per catalogue sequence number. */
  function parts(doc) {
    var ids = {};
    Array.prototype.forEach.call(doc.querySelectorAll("[id]"), function (e) { ids[e.getAttribute("id")] = e; });
    return Array.prototype.map.call(doc.getElementsByTagName("catalogSeqNumber"), function (c) {
      var isn = $1(c, "itemSeqNumber"), pr = $1(isn, "partRef"), app = c.getAttribute("applicRefId");
      return { item: c.getAttribute("item"), variant: c.getAttribute("itemVariant") || "", indenture: +c.getAttribute("indenture") || 1, qty: text($1(isn, "quantityPerNextHigherAssy")),
        pn: pr ? pr.getAttribute("partNumberValue") : "", mfr: pr ? pr.getAttribute("manufacturerCodeValue") : "", descr: text($1(isn, "descrForPart")),
        applicRef: app || "", applic: app && ids[app] ? text($1(ids[app], "displayText")) : G("All"), applicEl: app ? ids[app] : null, change: c.getAttribute("changeType") || "", el: c };
    });
  }
  function partsTable(ipc, ids, opts) {
    var rows = parts(ipc.ownerDocument).filter(function (p) { return !(opts.product && p.applicEl && applies(p.applicEl, opts.product) === false); });
    return '<div class="s1k-tbl" role="region" tabindex="0" aria-label="' + G("Parts list") + '"><table class="s1k-parts"><thead><tr><th scope="col">' + G("Item") + '</th><th scope="col">' + G("Part number") + '</th><th scope="col">' + G("Description") + '</th><th scope="col">' + G("Qty") + '</th><th scope="col">' + G("Applicability") + "</th></tr></thead><tbody>" +
      rows.map(function (p) { return '<tr data-item="' + esc(p.item) + '" class="' + (opts.changes && p.change ? "s1k-chg s1k-chg-" + esc(p.change) : "") + '"><td>' + esc(String(+p.item) + p.variant) + "</td><td><code>" + esc(p.pn) + "</code></td><td" + (p.indenture > 1 ? ' class="s1k-ind"' : "") + ">" + (p.indenture > 1 ? "· " : "") + esc(p.descr) + "</td><td>" + esc(p.qty) + "</td><td>" + esc(p.applic) + "</td></tr>"; }).join("") + "</tbody></table></div>";
  }
  /** The identification block shown above a module. */
  function header(id) {
    var row = function (k, v) { return v ? "<div><dt>" + esc(k) + "</dt><dd>" + v + "</dd></div>" : ""; };
    return '<header class="s1k-head"><p class="s1k-kicker">' + esc(T(id.type)) + " · " + esc(ISSUE) + "</p><h2" + langAttr(id) + ">" + esc(id.title) + '</h2><dl class="s1k-meta">' +
      row(T("Code"), "<code>" + esc(id.code) + "</code>") + row(T("Issue"), esc(id.issue + "-" + id.inWork) + " · " + esc(id.issueType === "changed" ? T("changed") : id.issueType === "new" ? T("new") : id.issueType)) +
      row(T("Issue date"), esc(id.date)) + row(T("Applicability"), inLang(id.applic, id)) + row(T("Quality assurance"), esc(id.qa)) + row(T("Security"), esc(id.security === "01" ? T("01, unclassified") : id.security)) +
      (id.rfu.length ? row(T("Reason for update"), inLang(id.rfu.map(function (r) { return r.text; }).join(" "), id)) : "") + "</dl>" +
      (id.distribution ? '<p class="s1k-restrict"' + langAttr(id) + ">" + esc(id.distribution) + "</p>" : "") + "</header>";
  }

  return { parse: parse, doctypeProblem: doctypeProblem, ident: ident, refs: refs, entities: entities, load: load, icnUrl: icnUrl, icnText: icnText, applies: applies, validate: validate,
    brexCheck: brexCheck, schemaCheck: schemaCheck, render: render, header: header, parts: parts, langOf: langOf, inLang: inLang, langAttr: langAttr, pageHref: pageHref, dmCodeText: dmCodeText, esc: esc, text: text, NAMES: NAMES, KINDS: KINDS, ISSUE: ISSUE, BASE: BASE };
})();
if (typeof module !== "undefined") module.exports = S1K;
