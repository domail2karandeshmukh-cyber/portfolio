// The aerospace overview, one section at a time (lib/aero.mjs writes the sections and the side menu).
// The address names the open section, so a link to /studio/aerospace#illustrations opens the illustrations, and the old
// links still land where they did: #change, #downloads, #film and #step-n open the section that holds them.
(function () {
  var panels = [].slice.call(document.querySelectorAll(".ae-panel"));
  if (!panels.length) return;
  var links = [].slice.call(document.querySelectorAll(".ae-secnav a[data-panel]"));
  document.documentElement.classList.add("ae-tabs");
  function panelFor(hash) {
    var id = (hash || "").replace(/^#/, "");
    if (!id) return null;
    if (/^step-\d+$/.test(id) || id === "film") return document.getElementById("guided");
    var el = document.getElementById(id);
    if (!el) return null;
    return el.classList.contains("ae-panel") ? el : el.closest(".ae-panel");
  }
  function show(panel, opts) {
    opts = opts || {};
    panels.forEach(function (p) { p.hidden = p !== panel; });
    links.forEach(function (a) { if (a.getAttribute("data-panel") === panel.id) a.setAttribute("aria-current", "true"); else a.removeAttribute("aria-current"); });
    var target = opts.target && opts.target !== panel ? opts.target : null;
    if (target) target.scrollIntoView({ block: "start" });
    else if (opts.scroll) {
      var top = document.querySelector(".ae-layout").getBoundingClientRect().top + window.scrollY - 84;
      if (window.scrollY > top) window.scrollTo(0, top);
    }
    if (opts.focus) { var h = panel.querySelector("h1, h2"); if (h) { h.setAttribute("tabindex", "-1"); h.focus({ preventScroll: true }); } }
  }
  function fromHash(focus) {
    var p = panelFor(location.hash);
    if (!p) { show(document.getElementById("overview") || panels[0], {}); return; }
    var id = location.hash.slice(1), el = document.getElementById(id);
    show(p, { target: el && el !== p ? el : null, scroll: true, focus: focus });
  }
  document.addEventListener("click", function (e) {
    var a = e.target.closest("a[data-panel]");
    if (!a) return;
    e.preventDefault();
    var p = document.getElementById(a.getAttribute("data-panel"));
    history.pushState(null, "", "#" + p.id);
    show(p, { scroll: true, focus: true });
  });
  // "Play the film" in the video section opens the guided demonstration and starts the film there.
  document.addEventListener("click", function (e) {
    var a = e.target.closest("a[data-play]");
    if (!a) return;
    e.preventDefault();
    var g = document.getElementById("guided"), v = g && g.querySelector("video");
    history.pushState(null, "", "#film");
    show(g, { target: document.getElementById("film") });
    if (v) { try { v.play(); } catch (err) {} }
  });
  window.addEventListener("hashchange", function () { fromHash(true); });
  window.addEventListener("popstate", function () { fromHash(false); });
  fromHash(false);
})();
