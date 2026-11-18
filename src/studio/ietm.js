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
    $("#ie-toc").innerHTML = '<p class="ie-pubtitle">' + esc(pm.id.pmTitle) + "<br><small><code>" + esc(pm.id.code) + "</code> · " + esc(T("issue {n}", { n: pm.id.issue })) + " · " + esc(pm.id.date) + "</small></p>" +
      entries.map(function (e) {
        return '<details open class="ie-entry"><summary>' + esc(e.title) + "</summary><ul>" + e.items.map(function (it) {
          var x = it.item;
          return "<li>" + (x ? '<a href="?dm=' + encodeURIComponent(it.code) + '" data-file="' + esc(x.file) + '"' + (cur && cur.file === x.file ? ' aria-current="page"' : "") + ">" + esc(x.id.title) + "</a>" : esc(it.code) + " " + esc(T("(missing)"))) + "</li>";
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
      (ipd ? '<p class="ann-btns"><a class="btn line sm" href="/studio/ipc">' + esc(T("Open it in the parts catalogue")) + "</a></p>" : "");
    var render = function (inline) {
      main.innerHTML = note + S1K.header(id) + tools + '<div class="s1k-body">' + S1K.render(x.doc, { db: db, product: product, changes: $("#ie-changes").checked, interactive: fault, inline: inline, href: function (code) { return "?dm=" + encodeURIComponent(code); } }) + "</div>";
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
    Array.prototype.forEach.call(svg.querySelectorAll(".part"), function (g) { g.setAttribute("tabindex", "0"); g.setAttribute("role", "button"); g.setAttribute("aria-label", T("Item {n}", { n: +g.dataset.item })); });
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
  /** Puts the whole publication, filtered for the chosen product, where the print stylesheet shows it. */
  function renderAll() {
    var area = $("#ie-printarea"), html = '<header class="ie-ptitle"><h1>' + esc(pm.id.pmTitle) + "</h1><p><code>" + esc(pm.id.code) + "</code> · " + esc(T("issue {n}", { n: pm.id.issue })) + " · " + esc(pm.id.date) + (product ? " · " + esc(product.label) : "") + "</p><p>" + esc(pm.id.distribution) + "</p></header>";
    entries.forEach(function (e) { e.items.forEach(function (it) { if (it.item) html += '<section class="ie-psec">' + S1K.header(it.item.id) + '<div class="s1k-body">' + S1K.render(it.item.doc, { db: db, product: product, changes: $("#ie-changes").checked }) + "</div></section>"; }); });
    area.innerHTML = html;
    document.body.classList.add("ie-printing-all");
  }
  // For scripts/aero/publish.py, which prints the publications to PDF with the same rendering.
  window.IETM = { renderAll: function () { renderAll(); return pm.id.code; }, show: function (code) { var x = db.latest(code); if (x) show(x); return !!x; } };

  function choosePub(code) {
    pm = db.latest(code);
    entries = walk(pm.doc);
    toc();
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
