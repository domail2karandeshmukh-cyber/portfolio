/* /studio/ipc: the illustrated parts catalogue of the fictional ARF-1 rig. The rows come from the illustrated parts
   data module (catalogSeqNumber); the picture is the ICN its figure names, and each hotspot in the module points to a
   group in the SVG (applicationStructureIdent), so a part selected in one is selected in the other. */
(function () {
  "use strict";
  var T = Kit.t, esc = Kit.esc, $ = function (s) { return document.querySelector(s); };
  var db = null, ipd = null, rows = [], selected = "", svgs = {}, product = null;
  var CODE = "DMC-ARFRIG-A-00-00-00-00A-941A-D";
  function say(t, bad) { Kit.say($("#ip-status"), t, bad); }

  /** Procedures whose steps name a figure item by its callout number, "(n)". */
  function procedures(item) {
    var n = String(+item), re = new RegExp("\\(" + n + "\\)");
    var latest = db.items.filter(function (x) { return x.id.kind === "dm" && db.latest(x.id.code) === x && /^(520|720|310|271|340|421)$/.test(x.id.infoCode); });
    return latest.filter(function (x) {
      return Array.prototype.some.call(x.doc.querySelectorAll("proceduralStep > para, action"), function (p) { return re.test(p.textContent); });
    });
  }
  function open(file) {
    ipd = db.items.filter(function (x) { return x.file === file; })[0];
    rows = S1K.parts(ipd.doc);
    var g = ipd.doc.querySelector("figure graphic"), icn = g.getAttribute("infoEntityIdent");
    $("#ip-icn").textContent = icn;
    var show = function (text) {
      $("#ip-svg").innerHTML = text.replace(/<\?xml[^>]*\?>/, "");
      var svg = $("#ip-svg svg");
      svg.removeAttribute("width"); svg.removeAttribute("height");
      // a picture with controls inside is a group, not an image
      svg.setAttribute("role", "group");
      // the drawing's title and description are the module's, in its language
      if (S1K.langAttr(ipd.id)) Array.prototype.forEach.call(svg.querySelectorAll(":scope > title, :scope > desc"), function (e) { e.setAttribute("lang", S1K.langOf(ipd.id)); });
      // every hotspot of the module makes its SVG group a control
      Array.prototype.forEach.call(ipd.doc.querySelectorAll("hotspot"), function (h) {
        var el = svg.querySelector("#" + CSS.escape(h.getAttribute("applicationStructureIdent")));
        if (!el) return;
        el.setAttribute("tabindex", "0"); el.setAttribute("role", "button");
        el.setAttribute("aria-label", T("Item {n}: {name}", { n: +el.dataset.item, name: h.getAttribute("applicationStructureName") }));
      });
      paint();
    };
    if (svgs[icn]) show(svgs[icn]);
    else fetch(S1K.icnUrl(icn)).then(function (r) { return r.text(); }).then(function (t) { svgs[icn] = t; show(t); });
    paint();
  }
  function visible(p) {
    var q = $("#ip-q").value.trim().toLowerCase();
    if (q && (p.pn + " " + p.descr).toLowerCase().indexOf(q) < 0) return false;
    return true;
  }
  function fits(p) { return !(product && p.applicEl && S1K.applies(p.applicEl, product) === false); }
  function paint() {
    var shown = rows.filter(visible);
    $("#ip-count").textContent = T("{n} rows", { n: shown.length });
    $("#ip-rows").innerHTML = shown.map(function (p) {
      var cls = [p.item === selected ? "on" : "", fits(p) ? "" : "na", p.change ? "s1k-chg s1k-chg-" + p.change : ""].join(" ").trim();
      return '<tr data-item="' + esc(p.item) + '" class="' + cls + '" tabindex="0" aria-selected="' + (p.item === selected) + '"><td>' + esc(String(+p.item) + p.variant) + "</td><td><code>" + esc(p.pn) + "</code></td><td" + (p.indenture > 1 ? ' class="s1k-ind"' : "") + ">" + (p.indenture > 1 ? "· " : "") + S1K.inLang(p.descr, ipd.id) + "</td><td>" + esc(p.qty) + "</td><td>" + S1K.inLang(p.applic, ipd.id) + (fits(p) ? "" : ' <small>' + esc(T("(not on this product)")) + "</small>") + "</td></tr>";
    }).join("");
    var svg = $("#ip-svg svg");
    if (svg) {
      Array.prototype.forEach.call(svg.querySelectorAll(".part, .callout"), function (g) {
        var item = g.dataset.item, list = rows.filter(function (r) { return r.item === item; });
        g.classList.toggle("on", item === selected);
        g.classList.toggle("na", !!list.length && list.every(function (r) { return !fits(r); }));
      });
    }
    detail();
  }
  function detail() {
    var list = rows.filter(function (r) { return r.item === selected; });
    if (!list.length) { $("#ip-detail").innerHTML = '<p class="kb-hint">' + esc(T("Select a part to see its details and the procedures that use it.")) + "</p>"; return; }
    var procs = procedures(selected);
    $("#ip-detail").innerHTML = "<h3>" + esc(T("Item {n}", { n: +selected })) + "</h3>" + list.map(function (p) {
      return '<dl class="s1k-meta"><div><dt>' + esc(T("Part number")) + "</dt><dd><code>" + esc(p.pn) + "</code> " + esc(T("(fictional)")) + "</dd></div><div><dt>" + esc(T("Description")) + "</dt><dd>" + S1K.inLang(p.descr, ipd.id) + "</dd></div><div><dt>" + esc(T("Manufacturer code")) + "</dt><dd><code>" + esc(p.mfr) + "</code> " + esc(T("(invented, not a CAGE code)")) + "</dd></div><div><dt>" + esc(T("Quantity per assembly")) + "</dt><dd>" + esc(p.qty) + "</dd></div><div><dt>" + esc(T("Applicability")) + "</dt><dd>" + S1K.inLang(p.applic, ipd.id) + "</dd></div>" +
        (p.change ? "<div><dt>" + esc(T("Change")) + "</dt><dd>" + esc(p.change === "add" ? T("Added in this issue (EC-ARF-01)") : p.change) + "</dd></div>" : "") + "</dl>";
    }).join("") + "<h4>" + esc(T("Procedures that use it")) + "</h4><ul>" + (procs.map(function (x) { return '<li><a href="' + esc(S1K.pageHref("/studio/ietm?dm=" + encodeURIComponent(x.id.code))) + '"' + S1K.langAttr(x.id) + ">" + esc(x.id.title) + "</a> <code>" + esc(x.id.code.replace("DMC-", "")) + "</code></li>"; }).join("") || "<li>" + esc(T("None in this CSDB")) + "</li>") + "</ul>";
  }
  function choose(item, from) {
    selected = selected === item && from === "svg" ? "" : item;
    paint();
    if (from === "svg") { var tr = document.querySelector('#ip-rows tr[data-item="' + item + '"]'); if (tr) tr.scrollIntoView({ block: "nearest" }); }
    if (from === "row") { var g = document.querySelector('#ip-svg .part[data-item="' + item + '"]'); if (g && g.scrollIntoView) g.scrollIntoView({ block: "nearest" }); }
    say(selected ? T("Item {n} selected.", { n: +selected }) : T("No part selected."));
  }
  S1K.load().then(function (d) {
    db = d;
    var issues = db.byCode[CODE] || [];
    $("#ip-issue").innerHTML = issues.slice().reverse().map(function (x, i) { return '<option value="' + esc(x.file) + '">' + esc(T("Issue {n}, {date}", { n: x.id.issue, date: x.id.date }) + (i === 0 ? " · " + T("latest") : "")) + "</option>"; }).join("");
    $("#ip-product").innerHTML += db.products.map(function (p, i) { return '<option value="' + i + '">' + esc(p.label) + "</option>"; }).join("");
    $("#ip-issue").addEventListener("change", function (e) { selected = ""; open(e.target.value); });
    $("#ip-product").addEventListener("change", function (e) { product = e.target.value === "" ? null : db.products[+e.target.value]; paint(); });
    $("#ip-q").addEventListener("input", paint);
    $("#ip-rows").addEventListener("click", function (e) { var tr = e.target.closest("tr[data-item]"); if (tr) choose(tr.dataset.item, "row"); });
    $("#ip-rows").addEventListener("keydown", function (e) { var tr = e.target.closest("tr[data-item]"); if (tr && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); choose(tr.dataset.item, "row"); } });
    $("#ip-svg").addEventListener("click", function (e) { var g = e.target.closest("[data-item]"); if (g) choose(g.dataset.item, "svg"); });
    $("#ip-svg").addEventListener("keydown", function (e) { var g = e.target.closest("[data-item]"); if (g && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); choose(g.dataset.item, "svg"); } });
    $("#ip-svg").addEventListener("mouseover", function (e) { var g = e.target.closest("[data-item]"); document.querySelectorAll("#ip-rows tr").forEach(function (tr) { tr.classList.toggle("hover", !!g && tr.dataset.item === g.dataset.item); }); });
    var want = new URLSearchParams(location.search).get("item");
    open(issues[issues.length - 1].file);
    if (want) choose(("00" + want).slice(-3), "row");
  }).catch(function (e) { say(e.message, true); });
})();
