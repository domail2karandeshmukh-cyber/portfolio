/* /studio/ietm: an interactive viewer for the publications of the fictional ARF-1 rig. The table of contents comes from
   the publication module, the content from the data modules it lists (at the issues it lists), and the product
   filter from the PCT: what doesn't apply to the chosen serial number is left out. Runs the same way from the offline
   package, where the CSDB is embedded in a script. */
(function () {
  "use strict";
  var T = Kit.t, esc = Kit.esc, $ = function (s) { return document.querySelector(s); };
  var db = null, pm = null, entries = [], cur = null, product = null, trail = [], offline = !!window.S1K_EMBED;
  function say(t, bad) { Kit.say($("#ie-status"), t, bad); }

  /** The publication's entries, in order: {title, items: [{code, issue, item}]}, with nested entries flattened. */
  function walk(pmDoc) {
    var out = [];
    (function rec(node, depth) {
      Array.prototype.forEach.call(node.children, function (c) {
        if (c.nodeName !== "pmEntry") return;
        var e = { title: S1K.text(c.querySelector(":scope > pmEntryTitle")), depth: depth, items: [] };
        Array.prototype.forEach.call(c.children, function (r) {
          if (r.nodeName !== "dmRef") return;
          var code = S1K.dmCodeText(r.querySelector("dmCode")), i = r.querySelector("issueInfo"), item = i ? db.get(code, i.getAttribute("issueNumber")) : db.latest(code);
          e.items.push({ code: code, issue: i ? i.getAttribute("issueNumber") : "", item: item });
        });
        out.push(e);
        rec(c, depth + 1);
      });
    })(pmDoc.querySelector("content"), 0);
    return out;
  }
  function toc() {
    $("#ie-toc").innerHTML = '<p class="ie-pubtitle">' + S1K.inLang(pm.id.pmTitle, pm.id) + "<br><small><code>" + esc(pm.id.code) + "</code> · " + esc(T("issue {n}", { n: pm.id.issue })) + " · " + esc(pm.id.date) + "</small></p>" +
      entries.map(function (e) {
        return '<details open class="ie-entry"><summary>' + S1K.inLang(e.title, pm.id) + "</summary><ul>" + e.items.map(function (it) {
          var x = it.item;
          return "<li>" + (x ? '<a href="?dm=' + encodeURIComponent(it.code) + '" data-file="' + esc(x.file) + '"' + (cur && cur.file === x.file ? ' aria-current="page"' : "") + S1K.langAttr(x.id) + ">" + esc(x.id.title) + "</a>" : esc(it.code) + " " + esc(T("(missing)"))) + "</li>";
        }).join("") + "</ul></details>";
      }).join("");
  }
  function inPublication(file) { return entries.some(function (e) { return e.items.some(function (i) { return i.item && i.item.file === file; }); }); }
  function show(x, opts) {
    opts = opts || {};
    cur = x; trail = [];
    var id = x.id, fault = id.infoCode === "421", ipd = id.infoCode === "941";
    var main = $("#ie-main");
    var note = !inPublication(x.file) ? '<p class="ie-outside">' + esc(T("This module is not in the publication you are reading. It opened because a cross-reference points to it.")) + "</p>" : "";
    var tools = (fault ? '<p class="ann-btns ie-modes"><button type="button" class="btn sm ink" data-mode="steps">' + esc(T("Step by step")) + '</button><button type="button" class="btn sm line" data-mode="all">' + esc(T("The whole procedure")) + "</button></p>" : "") +
      (ipd && !offline ? '<p class="ann-btns ie-noprint"><a class="btn line sm" href="' + esc(S1K.pageHref("/studio/ipc")) + '">' + esc(T("Open it in the parts catalogue")) + "</a></p>" : "");
    var render = function (inline) {
      main.innerHTML = note + S1K.header(id) + tools + '<div class="s1k-body"' + S1K.langAttr(id) + ">" + S1K.render(x.doc, { db: db, product: product, changes: $("#ie-changes").checked, interactive: fault, inline: inline, href: function (code) { return "?dm=" + encodeURIComponent(code); } }) + "</div>";
      if (fault) stepMode(true);
      if (ipd) hotspots();
      if (opts.q) mark(opts.q);
      if (opts.hash) { var t = document.getElementById(opts.hash); if (t) t.scrollIntoView(); }
    };
    if (ipd) {
      var icn = x.doc.querySelector("graphic").getAttribute("infoEntityIdent"), inline = {};
      S1K.icnText(icn).then(function (t) { inline[icn] = t.replace(/<\?xml[^>]*\?>/, ""); render(inline); }).catch(function () { render(null); });
    } else render(null);
    toc();
    if (!offline) history.replaceState(null, "", "?pub=" + encodeURIComponent(pm.id.code) + "&dm=" + encodeURIComponent(id.code) + (product ? "&sn=" + encodeURIComponent(product.assign["prodattr:serialNumber"]) : ""));
    if (opts.focus) main.focus();
    say(T("{title}, issue {n}.", { title: id.title, n: id.issue }) + (product ? " " + T("Shown for {p}.", { p: product.label }) : ""));
  }
  /* ---------- Fault isolation, one question at a time ---------- */
  function stepMode(on) {
    var list = document.querySelector(".s1k-isol");
    if (!list) return;
    list.classList.toggle("ie-one", on);
    document.querySelectorAll(".ie-modes button").forEach(function (b) { var m = b.dataset.mode === (on ? "steps" : "all"); b.className = "btn sm " + (m ? "ink" : "line"); b.setAttribute("aria-pressed", String(m)); });
    if (on) go(list.querySelector("li").dataset.step, true);
    else { list.querySelectorAll("li").forEach(function (li) { li.hidden = false; }); var tr = document.querySelector(".ie-trail"); if (tr) tr.remove(); }
  }
  function go(stepId, reset) {
    var list = document.querySelector(".s1k-isol");
    if (reset) trail = [];
    trail.push(stepId);
    list.querySelectorAll("li").forEach(function (li) { li.hidden = li.dataset.step !== stepId; });
    var tr = document.querySelector(".ie-trail");
    if (!tr) { tr = document.createElement("p"); tr.className = "ie-trail"; list.parentNode.insertBefore(tr, list); }
    var nums = trail.map(function (s) { var li = list.querySelector('[data-step="' + s + '"] .s1k-num'); return li ? li.textContent : s; });
    tr.innerHTML = esc(T("Your path: step {list}", { list: nums.join(" → ") })) + ' <button type="button" class="btn line sm" id="ie-restart">' + esc(T("Start again")) + "</button>";
    var shown = list.querySelector('[data-step="' + stepId + '"]');
    if (shown) { var h = shown.querySelector(".s1k-q, p"); shown.setAttribute("tabindex", "-1"); shown.focus(); }
  }
  /* ---------- Parts data: the picture and the list select each other ---------- */
  function hotspots() {
    var svg = document.querySelector("#ie-main .s1k-svg svg");
    if (!svg) return;
    svg.removeAttribute("width"); svg.removeAttribute("height");
    svg.setAttribute("role", "group");
    // the controls are the viewer's, so they speak the interface's language inside the English module
    var ui = document.documentElement.lang;
    Array.prototype.forEach.call(svg.querySelectorAll(".part"), function (g) { g.setAttribute("tabindex", "0"); g.setAttribute("role", "button"); g.setAttribute("aria-label", T("Item {n}", { n: +g.dataset.item })); if (S1K.langAttr(cur.id)) g.setAttribute("lang", ui); });
    Array.prototype.forEach.call(document.querySelectorAll("#ie-main tr[data-item]"), function (tr) { tr.tabIndex = 0; });
  }
  function pick(item) {
    document.querySelectorAll("#ie-main [data-item]").forEach(function (el) { el.classList.toggle("on", el.dataset.item === item); });
    var tr = document.querySelector('#ie-main tr[data-item="' + item + '"]'); if (tr) tr.scrollIntoView({ block: "nearest" });
    say(T("Item {n} selected.", { n: +item }));
  }
  /* ---------- Search ---------- */
  function search(q) {
    var box = $("#ie-hits");
    if (q.length < 2) { box.hidden = true; return; }
    var low = q.toLowerCase(), hits = [];
    entries.forEach(function (e) { e.items.forEach(function (it) {
      if (!it.item) return;
      var body = it.item.doc.querySelector("content").textContent.replace(/\s+/g, " "), at = body.toLowerCase().indexOf(low), title = it.item.id.title.toLowerCase().indexOf(low) > -1;
      if (at > -1 || title) hits.push({ x: it.item, snip: at > -1 ? body.slice(Math.max(0, at - 40), at + q.length + 60) : "" });
    }); });
    box.hidden = false;
    box.innerHTML = "<p><b>" + esc(T("{n} module(s) contain \"{q}\"", { n: hits.length, q: q })) + "</b></p><ul>" + hits.map(function (h) {
      return '<li><a href="?dm=' + encodeURIComponent(h.x.id.code) + '" data-file="' + esc(h.x.file) + '" data-q="' + esc(q) + '">' + esc(h.x.id.title) + "</a>" + (h.snip ? "<br><small>…" + esc(h.snip) + "…</small>" : "") + "</li>";
    }).join("") + "</ul>";
  }
  function mark(q) {
    var main = $("#ie-main"), walker = document.createTreeWalker(main.querySelector(".s1k-body"), NodeFilter.SHOW_TEXT), nodes = [], n, low = q.toLowerCase();
    while ((n = walker.nextNode())) if (n.nodeValue.toLowerCase().indexOf(low) > -1) nodes.push(n);
    nodes.forEach(function (node) {
      var at = node.nodeValue.toLowerCase().indexOf(low), after = node.splitText(at); after.splitText(q.length);
      var m = document.createElement("mark"); m.className = "ie-hit"; after.parentNode.replaceChild(m, after); m.appendChild(after);
    });
    var first = main.querySelector("mark.ie-hit"); if (first) first.scrollIntoView({ block: "center" });
  }
  /* ---------- Print ---------- */
  function printAll() {
    renderAll();
    window.print();
    setTimeout(function () { document.body.classList.remove("ie-printing-all"); $("#ie-printarea").innerHTML = ""; }, 500);
  }
  /** The front matter of a printed publication, made from its publication module: a title page, the highlights of
      this issue against the one before, the list of effective data modules and the contents. Written in the
      publication's language (English), whatever the language of the viewer. */
  function frontMatter(list) {
    var id = pm.id, issues = db.byCode[id.code] || [], at = issues.indexOf(pm), prev = at > 0 ? issues[at - 1] : null, before = {};
    if (prev) walk(prev.doc).forEach(function (e) { e.items.forEach(function (it) { before[it.code] = it.issue; }); });
    var flag = function (it) { return !(it.code in before) ? "N" : before[it.code] !== it.issue ? "C" : ""; };
    var changed = list.filter(function (it) { return flag(it); });
    var row = function (cells) { return "<tr>" + cells.map(function (c) { return "<td>" + c + "</td>"; }).join("") + "</tr>"; };
    var head = function (cells) { return "<thead><tr>" + cells.map(function (c) { return '<th scope="col">' + c + "</th>"; }).join("") + "</tr></thead>"; };
    var html = '<section class="ie-front"' + S1K.langAttr(id) + '><div class="ie-tp"><p class="ie-tp-k">S1000D Issue 6 publication</p><h1>' + esc(id.pmTitle) + "</h1>" +
      '<dl class="ie-tp-meta">' +
      "<div><dt>Publication module code</dt><dd><code>" + esc(id.code) + "</code></dd></div>" +
      "<div><dt>Issue</dt><dd>" + esc(id.issue + "-" + id.inWork + ", " + id.date + (id.issueType ? " (" + id.issueType + ")" : "")) + "</dd></div>" +
      "<div><dt>Applicability</dt><dd>" + esc(id.applic) + (product ? "<br>Printed for " + esc(product.label) + ": what does not apply to it is left out." : "") + "</dd></div>" +
      "<div><dt>Verification</dt><dd>" + esc(id.qaCode === "unverified" ? "Unverified. No qualified person has verified this content." : id.qa) + "</dd></div>" +
      "<div><dt>Security classification</dt><dd>" + esc(id.security) + (id.security === "01" ? ", unclassified" : "") + "</dd></div>" +
      "<div><dt>Responsible partner company</dt><dd>" + esc(id.owner) + "</dd></div></dl>" +
      '<p class="ie-tp-warn"><b>Demonstration data.</b> ' + esc(id.distribution) + " Written by Karan Deshmukh as an independent portfolio piece: not work for an employer, a customer or a defence programme.</p></div>";
    if (prev && changed.length) {
      html += '<h2 id="ie-hl">Highlights of issue ' + esc(id.issue) + "</h2>" + (id.rfu.length ? "<p>" + esc(id.rfu.map(function (r) { return r.text; }).join(" ")) + "</p>" : "") +
        '<table class="ie-fm">' + head(["Data module", "Code", "Issue", "Reason for update"]) + "<tbody>" + changed.map(function (it) {
          var x = it.item;
          return row([esc(x.id.title), "<code>" + esc(it.code) + "</code>", '<span class="ie-nw">' + esc((before[it.code] ? before[it.code] + " → " : "") + it.issue) + "</span>", esc(x.id.rfu.map(function (r) { return r.text; }).join(" ") || "-")]);
        }).join("") + "</tbody></table>";
    }
    html += '<h2 id="ie-loedm">List of effective data modules</h2><table class="ie-fm">' + head(["Code", "Title", "Issue", "Date", "Change"]) + "<tbody>" + list.map(function (it) {
      var x = it.item;
      return row(['<code class="ie-nw">' + esc(it.code) + "</code>", esc(x.id.title), esc(it.issue || x.id.issue), '<span class="ie-nw">' + esc(x.id.date) + "</span>", esc(flag(it))]);
    }).join("") + '</tbody></table><p class="ie-fm-key">N: new in this issue of the publication. ' + (prev ? "C: a new issue of the data module since publication issue " + esc(prev.id.issue) + "." : "Issue " + esc(id.issue) + " is the first issue of the publication.") + "</p>" +
      '<h2 id="ie-contents">Contents</h2><ol class="ie-fm-toc">' + entries.map(function (e) {
        return "<li>" + esc(e.title) + "<ul>" + e.items.filter(function (it) { return it.item; }).map(function (it) { return '<li><a href="#ie-sec-' + list.indexOf(it) + '">' + esc(it.item.id.title) + "</a></li>"; }).join("") + "</ul></li>";
      }).join("") + "</ol></section>";
    return html;
  }
  /** Puts the whole publication, filtered for the chosen product, where the print stylesheet shows it. */
  // Version 10.1: the publication's illustrations are fetched once, so that a printed publication carries them inline.
  // Their labels then print in the page's face and at the print sizes of aero.css, and stay searchable in the PDF.
  var svgs = {};
  function prefetch() {
    entries.forEach(function (e) { e.items.forEach(function (it) {
      if (it.item) Array.prototype.forEach.call(it.item.doc.getElementsByTagName("graphic"), function (g) {
        var icn = g.getAttribute("infoEntityIdent");
        if (icn && !(icn in svgs)) { svgs[icn] = ""; S1K.icnText(icn).then(function (t) { svgs[icn] = t.replace(/<\?xml[^>]*\?>/, ""); }).catch(function () {}); }
      });
    }); });
  }
  // An illustration that appears in several modules keeps its accessible name: its IDs (its title and description)
  // are made unique to the module that shows it. Not yet fetched, it prints as an image, as before.
  function inlineFor(doc, k) {
    var out = {}, pre = "ie" + k + "-";
    Array.prototype.forEach.call(doc.getElementsByTagName("graphic"), function (g) {
      var icn = g.getAttribute("infoEntityIdent");
      if (svgs[icn]) out[icn] = svgs[icn].replace(/\b(id|aria-labelledby|aria-describedby)="([^"]*)"/g, function (m, a, v) { return a + '="' + v.split(/\s+/).filter(Boolean).map(function (x) { return pre + x; }).join(" ") + '"'; })
        .replace(/url\(#([^)]+)\)/g, "url(#" + pre + "$1)").replace(/href="#([^"]+)"/g, 'href="#' + pre + '$1"');
    });
    return out;
  }
  function renderAll() {
    var area = $("#ie-printarea"), list = [];
    entries.forEach(function (e) { e.items.forEach(function (it) { if (it.item) list.push(it); }); });
    var html = frontMatter(list);
    list.forEach(function (it, k) { html += '<section class="ie-psec" id="ie-sec-' + k + '">' + S1K.header(it.item.id) + '<div class="s1k-body"' + S1K.langAttr(it.item.id) + ">" + S1K.render(it.item.doc, { db: db, product: product, changes: $("#ie-changes").checked, inline: inlineFor(it.item.doc, k) }) + "</div></section>"; });
    area.innerHTML = html;
    // In the whole publication each module numbers its own tables, so a table's region is named with its module too.
    Array.prototype.forEach.call(area.querySelectorAll(".ie-psec"), function (sec, k) {
      Array.prototype.forEach.call(sec.querySelectorAll('.s1k-tbl[role="region"]'), function (r) { r.setAttribute("aria-label", r.getAttribute("aria-label") + ", " + list[k].item.id.title); });
    });
    document.body.classList.add("ie-printing-all");
  }
  // For scripts/aero/publish.py, which prints the publications to PDF with the same rendering.
  window.IETM = { renderAll: function () { renderAll(); return pm.id.code; }, show: function (code) { var x = db.latest(code); if (x) show(x); return !!x; } };

  function choosePub(code) {
    pm = db.latest(code);
    entries = walk(pm.doc);
    toc();
    prefetch();
  }
  function wire() {
    $("#ie-pub").addEventListener("change", function (e) { choosePub(e.target.value); var first = entries[0] && entries[0].items[0]; if (first && first.item) show(first.item); });
    $("#ie-product").addEventListener("change", function (e) { product = e.target.value === "" ? null : db.products[+e.target.value]; if (cur) show(cur); });
    $("#ie-changes").addEventListener("change", function () { if (cur) show(cur); });
    $("#ie-q").addEventListener("input", function (e) { search(e.target.value.trim()); });
    $("#ie-print").addEventListener("click", function () { window.print(); });
    $("#ie-printall").addEventListener("click", printAll);
    $("#ie-main").addEventListener("click", function (e) { var g = e.target.closest("[data-item]"); if (g) pick(g.dataset.item); });
    $("#ie-main").addEventListener("keydown", function (e) { var g = e.target.closest("[data-item]"); if (g && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); pick(g.dataset.item); } });
    $("#ie-navbtn").addEventListener("click", function (e) { var open = e.currentTarget.getAttribute("aria-expanded") !== "true"; e.currentTarget.setAttribute("aria-expanded", String(open)); $("#ie-app").classList.toggle("ie-navopen", open); });
    document.addEventListener("click", function (e) {
      var a = e.target.closest("a[data-file], a.s1k-dmref, a.s1k-yes, a.s1k-no, button[data-mode], #ie-restart, a.s1k-iref");
      if (!a) return;
      if (a.matches("button[data-mode]")) { stepMode(a.dataset.mode === "steps"); return; }
      if (a.id === "ie-restart") { stepMode(true); return; }
      if (a.matches(".s1k-yes, .s1k-no") && document.querySelector(".s1k-isol.ie-one")) { e.preventDefault(); go(a.dataset.next); return; }
      if (a.matches(".s1k-iref")) return;
      e.preventDefault();
      var x = a.dataset.file ? db.items.filter(function (i) { return i.file === a.dataset.file; })[0] : db.latest(a.dataset.code);
      if (x) { show(x, { focus: true, q: a.dataset.q }); $("#ie-app").classList.remove("ie-navopen"); $("#ie-navbtn").setAttribute("aria-expanded", "false"); }
      else say(T("That module is not in this CSDB."), true);
    });
  }
  S1K.load().then(function (d) {
    db = d;
    var pubs = db.items.filter(function (x) { return x.id.kind === "pm" && db.latest(x.id.code) === x; });
    $("#ie-pub").innerHTML = pubs.map(function (p) { return '<option value="' + esc(p.id.code) + '">' + esc(p.id.pmTitle.replace("ARF-1 training rig - ", "")) + "</option>"; }).join("");
    $("#ie-product").innerHTML += db.products.map(function (p, i) { return '<option value="' + i + '">' + esc(p.label) + "</option>"; }).join("");
    var q = new URLSearchParams(location.search), want = q.get("dm"), pub = q.get("pub"), sn = q.get("sn");
    if (sn) db.products.forEach(function (p, i) { if (p.assign["prodattr:serialNumber"] === sn) { product = p; $("#ie-product").value = String(i); } });
    var start = pub && pubs.some(function (p) { return p.id.code === pub; }) ? pub : pubs[0].id.code;
    if (want && !pub) pubs.forEach(function (p) { if (walk(p.doc).some(function (e) { return e.items.some(function (i) { return i.code === want; }); })) start = p.id.code; });
    $("#ie-pub").value = start; choosePub(start); wire();
    var target = want ? (entries.reduce(function (f, e) { return f || e.items.filter(function (i) { return i.code === want; }).map(function (i) { return i.item; })[0]; }, null) || db.latest(want)) : entries[0].items[0].item;
    show(target || entries[0].items[0].item);
  }).catch(function (e) { say(e.message, true); });
})();
