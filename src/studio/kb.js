/* /studio/kb: a knowledge base in the shape of a help center (categories, sections, articles), kept in this browser.
   Articles are written in the workbench's Markdown, checked with the style guide, and previewed as a help center
   with search. Exports: Markdown and HTML for every article, and the request bodies the Zendesk Help Center API takes.
   Nothing here talks to Zendesk: this is a local demonstration. Needs kit.js, doc.js and style.js. */
(function () {
  "use strict";
  var T = Kit.t;
  var K = function (s) { return s; };     // marks English that is stored as data and translated where it is shown
  var $ = function (s, r) { return (r || document).querySelector(s); }, esc = Kit.esc;
  function say(t, bad) { Kit.say($("#kb-status"), t, bad); }
  var uid = function (p) { return p + Date.now().toString(36) + Math.random().toString(36).slice(2, 5); };
  var LOCALES = { "en-us": K("English"), fr: K("French"), de: K("German"), es: K("Spanish"), hi: K("Hindi") };
  var L = function (code) { return T(LOCALES[code] || code); };
  var KB = null, cur = { article: null, locale: "en-us" }, view = "edit";

  function blankKB() { return { name: T("Help center"), categories: [] }; }
  function all() { var out = []; KB.categories.forEach(function (c) { c.sections.forEach(function (s) { s.articles.forEach(function (a) { out.push({ c: c, s: s, a: a }); }); }); }); return out; }
  function where(id) { return all().filter(function (x) { return x.a.id === id; })[0]; }
  function text(a, loc) { return loc === "en-us" ? a : (a.translations[loc] || null); }
  function html(md) { var d = Doc.parse(md || ""); return Doc.toHtml(Doc.resolve(d, Doc.GENERAL)); }

  /* ---------- The tree ---------- */
  function tree() {
    $("#kb-tree").innerHTML = KB.categories.map(function (c) {
      return '<li class="kb-cat"><div class="kb-row"><b>' + esc(c.name) + '</b><span><button type="button" class="kb-x" data-act="add-section" data-id="' + c.id + '" aria-label="' + esc(T("Add a section to {name}", { name: c.name })) + '">' + T("+ Section") + '</button><button type="button" class="kb-x" data-act="rename" data-id="' + c.id + '" aria-label="' + esc(T("Rename {name}", { name: c.name })) + '">' + T("Rename") + '</button><button type="button" class="kb-x" data-act="delete" data-id="' + c.id + '" aria-label="' + esc(T("Delete {name}", { name: c.name })) + '">' + T("Delete") + '</button></span></div><ul>' +
        c.sections.map(function (s) {
          return '<li class="kb-sec"><div class="kb-row"><span>' + esc(s.name) + '</span><span><button type="button" class="kb-x" data-act="add-article" data-id="' + s.id + '" aria-label="' + esc(T("Add an article to {name}", { name: s.name })) + '">' + T("+ Article") + '</button><button type="button" class="kb-x" data-act="rename" data-id="' + s.id + '" aria-label="' + esc(T("Rename {name}", { name: s.name })) + '">' + T("Rename") + '</button><button type="button" class="kb-x" data-act="delete" data-id="' + s.id + '" aria-label="' + esc(T("Delete {name}", { name: s.name })) + '">' + T("Delete") + '</button></span></div><ul>' +
            s.articles.map(function (a) { return '<li><button type="button" class="kb-art' + (cur.article === a.id ? " on" : "") + '" data-open="' + a.id + '" aria-current="' + (cur.article === a.id) + '">' + esc(a.title || T("Untitled")) + ' <small class="kb-st ' + a.status + '">' + (a.status === "published" ? T("Published") : T("Draft")) + "</small>" + (a.audience === "agents" ? ' <small class="kb-st internal">' + T("Internal") + "</small>" : "") + "</button></li>"; }).join("") + "</ul></li>";
        }).join("") + "</ul></li>";
    }).join("") || '<li class="kb-none">' + T("No categories yet.") + "</li>";
  }
  $("#kb-addcat").addEventListener("click", function () {
    Kit.ask(T("Add a category"), T("Name of the category"), "", { max: 80, ok: T("Add") }).then(function (n) {
      if (!n) return;
      KB.categories.push({ id: uid("c"), name: n.slice(0, 80), description: "", sections: [] }); save(T("Added the category {name}. Add a section to it, then articles to the section.", { name: n })); tree();
    });
  });
  $("#kb-tree").addEventListener("click", function (e) {
    var open = e.target.closest("[data-open]"); if (open) { cur.article = open.dataset.open; cur.locale = "en-us"; editor(); tree(); $("#kb-title").focus(); return; }
    var b = e.target.closest("[data-act]"); if (!b) return;
    var id = b.dataset.id, act = b.dataset.act, cat = KB.categories.filter(function (c) { return c.id === id; })[0], sec = null, parent = null;
    KB.categories.forEach(function (c) { c.sections.forEach(function (s) { if (s.id === id) { sec = s; parent = c; } }); });
    if (act === "add-section") return Kit.ask(T("Add a section to {name}", { name: cat.name }), T("Name of the section"), "", { max: 80, ok: T("Add") }).then(function (n) { if (n) { cat.sections.push({ id: uid("s"), name: n.slice(0, 80), description: "", articles: [] }); save(T("Added the section {name}.", { name: n })); tree(); } });
    if (act === "add-article") { var a = article(T("New article"), T("Write the answer here.") + "\n"); sec.articles.push(a); cur.article = a.id; cur.locale = "en-us"; save(T("Added an article to {name}.", { name: sec.name })); editor(); }
    if (act === "rename") { var o = cat || sec; return Kit.ask(T("Rename {name}", { name: o.name }), T("New name"), o.name, { max: 80, ok: T("Rename") }).then(function (m2) { if (m2) { o.name = m2.slice(0, 80); save(T("Renamed it to {name}.", { name: m2 })); tree(); } }); }
    if (act === "delete") {
      var target = cat || sec, count = cat ? cat.sections.reduce(function (n2, s) { return n2 + s.articles.length; }, 0) : sec.articles.length;
      return Kit.confirm(T("Delete {name}?", { name: target.name }), (count ? T("Its {n} article(s) go with it. ", { n: count }) : "") + T("You can't undo this, except from an exported project."), { ok: T("Delete"), danger: true }).then(function (yes) {
        if (!yes) return;
        if (cat) KB.categories = KB.categories.filter(function (c) { return c !== cat; }); else parent.sections = parent.sections.filter(function (s) { return s !== sec; });
        if (cur.article && !where(cur.article)) cur.article = null;
        save(T("Deleted {name}.", { name: target.name })); editor(); tree();
      });
    }
    tree();
  });
  function article(title, body, tags) { return { id: uid("a"), title: title, body: body, tags: tags || [], status: "draft", audience: "customers", updated: new Date().toISOString(), translations: {}, history: [] }; }

  /* ---------- The editor ---------- */
  function editor() {
    var w = cur.article && where(cur.article);
    $("#kb-edit").hidden = !w; $("#kb-empty").hidden = !!w;
    if (!w) return preview();
    var a = w.a, t = text(a, cur.locale);
    $("#kb-where").textContent = w.c.name + " › " + w.s.name;
    $("#kb-locales").innerHTML = Object.keys(LOCALES).map(function (l) {
      var has = l === "en-us" || a.translations[l];
      return '<button type="button" class="kb-loc' + (l === cur.locale ? " on" : "") + (has ? "" : " missing") + '" data-loc="' + l + '" aria-pressed="' + (l === cur.locale) + '">' + L(l) + (has ? "" : " +") + "</button>";
    }).join("");
    var missing = !t;
    $("#kb-fields").hidden = missing; $("#kb-prep").hidden = !missing;
    if (missing) { $("#kb-prep-text").textContent = T("There's no {language} version of this article yet.", { language: L(cur.locale) }); return preview(); }
    $("#kb-title").value = t.title; $("#kb-body").value = t.body; $("#kb-tags").value = (a.tags || []).join(", ");
    $("#kb-statusbox").value = t.status || a.status; $("#kb-audience").value = a.audience === "agents" ? "agents" : "customers"; $("#kb-audience").disabled = cur.locale !== "en-us";
    $("#kb-tags").disabled = cur.locale !== "en-us";
    history(); check(); preview();
  }
  $("#kb-locales").addEventListener("click", function (e) { var b = e.target.closest("[data-loc]"); if (b) { cur.locale = b.dataset.loc; editor(); } });
  $("#kb-prepare").addEventListener("click", function () {
    var a = where(cur.article).a;
    a.translations[cur.locale] = { title: a.title, body: a.body, status: "draft", needs: true };
    save(T("Prepared a {language} version: it starts as a copy of the English article, marked as a draft to translate. Nothing is translated by machine.", { language: L(cur.locale) })); editor();
  });
  function edit(field, v) {
    var a = where(cur.article).a, t = text(a, cur.locale);
    if (field === "tags") a.tags = v.split(",").map(function (s) { return s.trim().toLowerCase(); }).filter(Boolean).slice(0, 20);
    else t[field] = v;
    if (field !== "status") a.updated = new Date().toISOString();
    save(); tree(); preview(); if (field === "body") check();
  }
  $("#kb-title").addEventListener("input", function () { edit("title", this.value.slice(0, 150)); });
  $("#kb-body").addEventListener("input", function () { edit("body", this.value.slice(0, 50000)); });
  $("#kb-tags").addEventListener("change", function () { edit("tags", this.value); });
  $("#kb-audience").addEventListener("change", function () { var a = where(cur.article).a; a.audience = this.value === "agents" ? "agents" : "customers"; save(this.value === "agents" ? T("Marked the article as internal: readers of the help center don't see it, agents do.") : T("The article is for everyone.")); tree(); preview(); });
  $("#kb-statusbox").addEventListener("change", function () {
    var a = where(cur.article).a, t = text(a, cur.locale), was = t.status || a.status;
    if (cur.locale === "en-us") a.status = this.value; else t.status = this.value;
    snapshot(a, was === this.value ? K("Saved") : this.value === "published" ? K("Published") : K("Moved back to draft"));   // the version list shows the language beside the note
    save(this.value === "published" ? T("Set the {language} article to published in this demo help center. Nothing is sent to Zendesk.", { language: L(cur.locale) }) : T("Set the {language} article back to draft.", { language: L(cur.locale) })); tree(); history();
  });
  function snapshot(a, note) {
    var t = text(a, cur.locale);
    a.history.unshift({ at: new Date().toISOString(), locale: cur.locale, title: t.title, body: t.body, status: t.status || a.status, note: note });
    a.history = a.history.slice(0, 50);
  }
  $("#kb-version").addEventListener("click", function () { var a = where(cur.article).a; snapshot(a, K("Saved a version")); save(T("Saved a version of the article in its history.")); history(); });
  function history() {
    var a = where(cur.article).a;
    $("#kb-history").innerHTML = a.history.length ? a.history.map(function (h, i) {
      return "<li><span>" + esc(new Date(h.at).toLocaleString()) + " · " + esc(L(h.locale)) + " · " + esc(T(h.note)) + '</span><button type="button" class="kb-x" data-restore="' + i + '">' + T("Restore") + "</button></li>";
    }).join("") : "<li>" + T("No saved versions yet. Publishing or saving a version adds one.") + "</li>";
  }
  $("#kb-history").addEventListener("click", function (e) {
    var b = e.target.closest("[data-restore]"); if (!b) return;
    var a = where(cur.article).a, h = a.history[+b.dataset.restore], t = h.locale === "en-us" ? a : a.translations[h.locale];
    if (!t) return;
    snapshot(a, K("Before restoring a version")); t.title = h.title; t.body = h.body; cur.locale = h.locale;
    save(T("Restored the version from {when}.", { when: new Date(h.at).toLocaleString() })); editor(); tree();
  });
  $("#kb-del").addEventListener("click", function () {
    var w = where(cur.article);
    Kit.confirm(T("Delete the article?"), T("{title} and its history are removed from this knowledge base.", { title: w.a.title }), { ok: T("Delete"), danger: true }).then(function (yes) {
      if (!yes) return;
      w.s.articles = w.s.articles.filter(function (a) { return a !== w.a; }); cur.article = null; save(T("Deleted the article.")); tree(); editor();
    });
  });
  var checkT = 0;
  function check() {
    clearTimeout(checkT);
    checkT = setTimeout(function () {
      var t = text(where(cur.article).a, cur.locale); if (!t) return;
      var md = "# " + t.title + "\n\n" + t.body, sum = Style.summary(Style.check(md));
      $("#kb-check").className = "kb-check" + (sum.passes ? " ok" : "");
      $("#kb-check").textContent = cur.locale !== "en-us" ? T("The style guide checks English only.") : sum.passes ? T("Passes the style check.") + (sum.suggestion ? " " + T("{n} suggestion(s).", { n: sum.suggestion }) : "") : T("{e} error(s) and {w} warning(s) to fix. Open the article in the workbench to see each one.", { e: sum.error, w: sum.warning });
    }, 250);
  }
  $("#kb-bench").addEventListener("click", function () {
    var t = text(where(cur.article).a, cur.locale);
    try { localStorage.setItem("wb:doc", "# " + t.title + "\n\n" + t.body); } catch (e) {}
    location.href = "/workbench";
  });

  /* ---------- The help center preview ---------- */
  var q = "";
  function preview() {
    $("#kb-preview").lang = cur.locale === "en-us" ? "en" : cur.locale;   // the help center's language, which isn't the interface's
    if (view !== "center" && view !== "agent") { var w = cur.article && where(cur.article), t = w && text(w.a, cur.locale); $("#kb-preview").innerHTML = t ? '<article class="kb-article"><h1>' + esc(t.title) + "</h1>" + html(t.body) + (w.a.tags.length ? '<p class="kb-tags">' + w.a.tags.map(function (g) { return "<span>" + esc(g) + "</span>"; }).join("") + "</p>" : "") + "</article>" : ""; return; }
    var loc = cur.locale, agent = view === "agent", pub = function (a) { var t = text(a, loc); return t && (loc === "en-us" ? a.status : t.status) === "published" && (agent || a.audience !== "agents"); };
    var h = '<div class="kb-hc' + (agent ? " agent" : "") + '"><p class="kb-hc-name">' + esc(KB.name) + (agent ? ' <small class="kb-st internal">' + T("Agent view: internal articles included") + "</small>" : "") + '</p><label class="kb-search">' + T("Search") + ' <input type="search" id="kb-q" value="' + esc(q) + '" placeholder="' + esc(T("How do I…")) + '"></label>';
    if (q.trim()) {
      var terms = q.toLowerCase().split(/\s+/).filter(function (w) { return w.length > 1; });
      var hits = all().filter(function (x) { if (!pub(x.a)) return false; var t = text(x.a, loc), hay = (t.title + " " + t.body + " " + x.a.tags.join(" ")).toLowerCase(); return terms.every(function (w) { return hay.indexOf(w) > -1; }); });
      h += "<p>" + T("{n} result(s) for {q}", { n: hits.length, q: "<b>" + esc(q) + "</b>" }) + '</p><ul class="kb-hits">' + hits.map(function (x) { return '<li><button type="button" class="kb-link" data-read="' + x.a.id + '">' + esc(text(x.a, loc).title) + "</button><small>" + esc(x.c.name + " › " + x.s.name) + "</small></li>"; }).join("") + "</ul>";
    } else {
      h += KB.categories.map(function (c) {
        return '<section class="kb-hc-cat"><h2>' + esc(c.name) + "</h2>" + c.sections.map(function (s) {
          var arts = s.articles.filter(pub); if (!arts.length) return "";
          return "<h3>" + esc(s.name) + "</h3><ul>" + arts.map(function (a) { return '<li><button type="button" class="kb-link" data-read="' + a.id + '">' + esc(text(a, loc).title) + "</button></li>"; }).join("") + "</ul>";
        }).join("") + "</section>";
      }).join("");
      var hidden = all().filter(function (x) { return !pub(x.a); }), drafts = hidden.filter(function (x) { return x.a.status !== "published"; }).length, internal = hidden.length - drafts;
      if (hidden.length) h += '<p class="kb-hint">' + T("{what} aren't shown here. Readers see published articles for everyone; the agent view adds the internal ones.", { what: (drafts ? T("{n} draft(s)", { n: drafts }) : "") + (drafts && internal ? T(" and ") : "") + (internal ? T("{n} internal article(s)", { n: internal }) : "") }) + "</p>";
    }
    $("#kb-preview").innerHTML = h + "</div>";
    var qi = $("#kb-q"); if (qi) { qi.oninput = function () { q = this.value; var pos = this.selectionStart; preview(); var n = $("#kb-q"); n.focus(); n.setSelectionRange(pos, pos); }; }
  }
  $("#kb-preview").addEventListener("click", function (e) {
    var b = e.target.closest("[data-read]"); if (!b) return;
    var w = where(b.dataset.read), t = text(w.a, cur.locale);
    $("#kb-preview").innerHTML = '<div class="kb-hc"><p><button type="button" class="kb-link" id="kb-back">‹ ' + esc(KB.name) + '</button> › ' + esc(w.c.name) + " › " + esc(w.s.name) + '</p><article class="kb-article"><h1>' + esc(t.title) + "</h1>" + html(t.body) + "</article></div>";
    $("#kb-back").onclick = function () { preview(); };
  });
  document.querySelectorAll("[data-view]").forEach(function (b) {
    b.addEventListener("click", function () { view = b.dataset.view; document.querySelectorAll("[data-view]").forEach(function (x) { x.setAttribute("aria-pressed", x === b); }); preview(); });
  });

  /* ---------- Exports ---------- */
  function name() { return Kit.slug(KB.name, "help-center"); }
  $("#kb-export").addEventListener("click", function () {
    var files = [], api = { note: "Request bodies for the Zendesk Help Center API: POST /api/v2/help_center/sections/{section_id}/articles for each article, and POST /api/v2/help_center/articles/{article_id}/translations for each translation. Create the categories and sections first, and set user_segment_id and permission_group_id for your account. Made by karandeshmukh.dev/studio/kb; nothing has been sent.", categories: [] };
    KB.categories.forEach(function (c, ci) {
      var cat = { name: c.name, sections: [] }; api.categories.push(cat);
      c.sections.forEach(function (s, si) {
        var sec = { name: s.name, articles: [] }; cat.sections.push(sec);
        s.articles.forEach(function (a, ai) {
          var dir = (ci + 1) + "-" + Kit.slug(c.name) + "/" + (si + 1) + "-" + Kit.slug(s.name) + "/", base = (ai + 1) + "-" + Kit.slug(a.title);
          [["en-us", a]].concat(Object.keys(a.translations).map(function (l) { return [l, a.translations[l]]; })).forEach(function (pair) {
            var l = pair[0], t = pair[1], st = l === "en-us" ? a.status : t.status, suffix = l === "en-us" ? "" : "." + l;
            files.push({ name: dir + base + suffix + ".md", data: "---\nstatus: " + st + "\nlocale: " + l + (a.tags.length ? "\nlabels: " + a.tags.join(", ") : "") + "\n---\n# " + t.title + "\n\n" + t.body.trim() + "\n" });
            files.push({ name: dir + base + suffix + ".html", data: "<h1>" + esc(t.title) + "</h1>\n" + html(t.body) + "\n" });
          });
          sec.articles.push({ article: { title: a.title, body: html(a.body), locale: "en-us", draft: a.status !== "published", label_names: a.tags, user_segment_id: null, permission_group_id: null, note: a.audience === "agents" ? "Internal: set user_segment_id to the segment of your agents before publishing." : "For everyone: user_segment_id null means signed-out visitors can read it." },
            translations: Object.keys(a.translations).map(function (l) { var t = a.translations[l]; return { translation: { locale: l, title: t.title, body: html(t.body), draft: t.status !== "published" } }; }) });
        });
      });
    });
    files.push({ name: "zendesk-help-center-api.json", data: JSON.stringify(api, null, 1) });
    files.push({ name: "knowledge-base.json", data: JSON.stringify({ app: "karandeshmukh.dev/studio/kb", version: 1, kb: KB }, null, 1) });
    Kit.save(Kit.zip(files), name() + ".zip");
    say(T("Exported {n} article version(s) as Markdown and HTML, the API request bodies, and the project, in one ZIP.", { n: (files.length - 2) / 2 }));
  });
  $("#kb-open").addEventListener("change", function () {
    var f = this.files[0]; this.value = "";
    Kit.readBytes(f).then(function (bytes) {
      var j;
      if (/\.zip$/i.test(f.name)) { var files = Kit.unzip(bytes); j = JSON.parse(new TextDecoder().decode(files["knowledge-base.json"] || new Uint8Array())); }
      else j = JSON.parse(new TextDecoder().decode(bytes));
      use(clean(j)); say(T("Opened {file}.", { file: f.name }));
    }).catch(function (e) { say(e instanceof SyntaxError ? T("This file isn't a knowledge base saved by this studio.") : e.message, true); });
  });
  function clean(j) {
    if (!j || j.app !== "karandeshmukh.dev/studio/kb" || !j.kb || !Array.isArray(j.kb.categories)) throw new Error(T("This file isn't a knowledge base saved by this studio."));
    var s = function (v, n) { return String(v == null ? "" : v).slice(0, n); };
    var art = function (a) { var tr = {}; Object.keys(a.translations || {}).forEach(function (l) { if (LOCALES[l] && l !== "en-us") { var t = a.translations[l]; tr[l] = { title: s(t.title, 150), body: s(t.body, 50000), status: t.status === "published" ? "published" : "draft" }; } });
      return { id: uid("a"), title: s(a.title, 150), body: s(a.body, 50000), tags: (Array.isArray(a.tags) ? a.tags : []).map(function (x) { return s(x, 40); }).slice(0, 20), status: a.status === "published" ? "published" : "draft", audience: a.audience === "agents" ? "agents" : "customers", updated: s(a.updated, 40), translations: tr,
        history: (Array.isArray(a.history) ? a.history : []).slice(0, 50).map(function (h) { return { at: s(h.at, 40), locale: LOCALES[h.locale] ? h.locale : "en-us", title: s(h.title, 150), body: s(h.body, 50000), status: h.status === "published" ? "published" : "draft", note: s(h.note, 80) }; }) }; };
    return { name: s(j.kb.name, 80) || "Help center", categories: j.kb.categories.slice(0, 50).map(function (c) { return { id: uid("c"), name: s(c.name, 80), description: s(c.description, 300), sections: (c.sections || []).slice(0, 100).map(function (x) { return { id: uid("s"), name: s(x.name, 80), description: s(x.description, 300), articles: (x.articles || []).slice(0, 500).map(art) }; }) }; }) };
  }

  /* ---------- The samples, and keeping the knowledge base in this browser ---------- */
  var start = Kit.start($("#kb-start"), {
    tool: "kb", title: T("Open a knowledge base"),
    lead: T("Two help centers for invented products, with real article structure: one for customers of an accounting application, with an internal agent handbook kept apart, and one internal IT knowledge base. Open one and edit it, or start your own."),
    open: function (s) {
      return (KB.categories.length ? Kit.confirm(T("Replace the knowledge base on screen?"), T("{title} takes its place. Export the current one first if you want to keep it.", { title: T(s.title) }), { ok: T("Replace") }) : Promise.resolve(true)).then(function (yes) {
        if (!yes) return;
        say(T("Opening {title}…", { title: T(s.title) }));
        return Kit.fetchJson(s.project).then(function (j) { use(clean(j)); var first = all()[0]; if (first) { cur.article = first.a.id; editor(); tree(); } sw.close(); say(T("Opened {title}: {a} articles in {c} categories{internal}.", { title: T(s.title), a: s.articles, c: s.categories, internal: s.internal ? T(", {n} of them internal", { n: s.internal }) : "" })); });
      });
    },
    fail: function (e) { say(e.message, true); },
    blank: function () { (KB.categories.length ? Kit.confirm(T("Start an empty knowledge base?"), T("The one on screen is replaced. Export it first if you want to keep it."), { ok: T("Start empty") }) : Promise.resolve(true)).then(function (yes) { if (!yes) return; use(blankKB()); sw.close(); say(T("Started an empty knowledge base. Add a category first.")); $("#kb-addcat").focus(); }); }, blankLabel: T("Start empty"),
    files: [{ label: T("Open a file"), input: "kb-open" }],
  });
  var sw = Kit.startSwitch(start, $("#kb-slot"), $("#kb-samples"));
  function use(k) { KB = k; cur = { article: null, locale: "en-us" }; save(); tree(); editor(); sw.inline(!KB.categories.length); }
  var t0 = 0;
  function save(msg) { if (msg) say(msg); clearTimeout(t0); t0 = setTimeout(function () { Kit.store.put("kb", { kb: KB }).catch(function () {}); }, 400); }
  Kit.store.get("kb").then(function (s) { if (s && s.kb) { KB = s.kb; say(T("Reopened your knowledge base from this browser.")); } }).catch(function () {}).then(function () { if (!KB) KB = blankKB(); tree(); editor(); sw.inline(!KB.categories.length); });
  window.studioKB = { get: function () { return KB; }, current: function () { return cur; } };
})();
