// The header menus (built by lib/nav.mjs): one open at a time, closed by Escape, by a click outside or when focus
// leaves; the link to the open page is marked. The menus are <details>, so they open and close without this script.
(function () {
  var all = [].slice.call(document.querySelectorAll(".gnav details, .mnav"));
  function closeAll(except) { all.forEach(function (d) { if (d !== except && !d.contains(except)) d.open = false; }); }
  all.forEach(function (d) {
    d.addEventListener("toggle", function () { if (d.open) { closeAll(d); if (d.classList.contains("mnav")) document.documentElement.classList.add("mnav-open"); } else if (d.classList.contains("mnav")) document.documentElement.classList.remove("mnav-open"); });
    if (!d.classList.contains("mnav")) d.addEventListener("focusout", function (e) { if (d.open && e.relatedTarget && !d.contains(e.relatedTarget)) d.open = false; });
  });
  document.addEventListener("keydown", function (e) {
    if (e.key !== "Escape") return;
    var open = all.filter(function (d) { return d.open; });
    open.forEach(function (d) { d.open = false; });
    if (open.length) open[open.length - 1].querySelector("summary").focus();
  });
  document.addEventListener("click", function (e) {
    all.forEach(function (d) { if (d.open && (!d.contains(e.target) || e.target.closest("a"))) d.open = false; });
  });
  // In the phone menu: the search and the languages, which the header hides on a narrow screen.
  var m = document.querySelector(".mnav"), panel = m && m.querySelector(".mnav-panel");
  if (panel) {
    var tools = document.createElement("div"); tools.className = "mnav-tools";
    var find = document.querySelector(".nav-act [data-search]");
    if (find) { var b = document.createElement("button"); b.type = "button"; b.className = "btn line"; b.textContent = find.getAttribute("aria-label") || "Search"; b.addEventListener("click", function () { m.open = false; find.click(); }); tools.appendChild(b); }
    [].forEach.call(document.querySelectorAll(".nav-act .lang a[lang]"), function (a) { var c = a.cloneNode(true); c.removeAttribute("tabindex"); tools.appendChild(c); });
    if (tools.children.length) panel.insertBefore(tools, panel.firstChild);
  }
  // A table or a block of code that scrolls sideways on a narrow screen can be reached with the keyboard, so its
  // hidden part can be scrolled into view (WCAG 2.1.1). When it fits again, it leaves the tab order.
  function scrollables() {
    [].forEach.call(document.querySelectorAll("main table, main pre"), function (e) {
      var s = getComputedStyle(e), scrolls = (s.overflowX === "auto" || s.overflowX === "scroll") && e.scrollWidth > e.clientWidth + 1;
      if (scrolls && !e.hasAttribute("tabindex")) { e.tabIndex = 0; e.setAttribute("data-scrolls", ""); }
      else if (!scrolls && e.hasAttribute("data-scrolls")) { e.removeAttribute("tabindex"); e.removeAttribute("data-scrolls"); }
    });
  }
  scrollables();
  var later; addEventListener("resize", function () { clearTimeout(later); later = setTimeout(scrollables, 150); });
  // The open page: its link in a menu says so, and so does the menu that holds it.
  var here = location.pathname.replace(/index\.html$/, "").replace(/\/+$/, "") || "/";
  [].forEach.call(document.querySelectorAll(".gnav a[href], .mnav a[href]"), function (a) {
    var h = a.getAttribute("href");
    if (!h || h.charAt(0) !== "/" || h.indexOf("#") >= 0) return;
    if ((h.replace(/\/+$/, "") || "/") === here) {
      a.setAttribute("aria-current", "page");
      var g = a.closest("details.dd"); if (g) g.classList.add("here");
    }
  });
})();

/* The studio's tools: beside the page on a wide screen, behind "Studio tools" on a narrow one, where they stay as the
   visitor leaves them. */
(function () {
  var side = document.querySelector(".st-side-all");
  if (!side || !window.matchMedia) return;
  var wide = window.matchMedia("(min-width: 1200px)"), mine = false;
  side.querySelector("summary").addEventListener("click", function () { mine = !side.open; });
  function fit() { side.open = wide.matches || mine; }
  fit();
  if (wide.addEventListener) wide.addEventListener("change", fit); else wide.addListener(fit);
})();

// Version 10.1: the lifecycle's phase rail (/documentation-lifecycle). It marks the phase being read (aria-current), fills
// its bar with the reader's progress from the first phase to the end of the last, and on a narrow screen keeps the
// current phase in view inside the rail.
(function () {
  var rail = document.querySelector(".lc-rail");
  if (!rail) return;
  var list = rail.querySelector("ol"), bar = rail.querySelector(".lc-bar i"), links = [].slice.call(rail.querySelectorAll("a"));
  var phases = links.map(function (a) { return document.getElementById(a.getAttribute("href").slice(1)); });
  var still = window.matchMedia("(prefers-reduced-motion: reduce)"), cur = -1, queued = false;
  function update() {
    queued = false;
    var line = rail.getBoundingClientRect().bottom + 44, first = phases[0].getBoundingClientRect(), last = phases[phases.length - 1].getBoundingClientRect();
    var p = Math.min(1, Math.max(0, (line - first.top) / Math.max(1, last.bottom - innerHeight - first.top + line)));
    var k = 0;
    phases.forEach(function (ph, i) { if (ph.getBoundingClientRect().top <= line) k = i; });
    if (p >= 0.999) k = phases.length - 1;
    bar.style.transform = "scaleX(" + p.toFixed(4) + ")";
    if (k === cur) return;
    if (links[cur]) links[cur].removeAttribute("aria-current");
    links[k].setAttribute("aria-current", "step");
    cur = k;
    if (list.scrollWidth > list.clientWidth + 1) {
      var a = links[k];
      list.scrollTo({ left: a.offsetLeft - (list.clientWidth - a.offsetWidth) / 2, behavior: still.matches ? "auto" : "smooth" });
    }
  }
  function soon() { if (!queued) { queued = true; requestAnimationFrame(update); } }
  addEventListener("scroll", soon, { passive: true });
  addEventListener("resize", soon);
  update();
})();

// Version 10.1: a document's contents (lib/library.mjs) stay open beside the page on a wide screen, and fold under one
// button on a phone, where choosing a section folds them again.
(function () {
  var dd = document.querySelector(".toc-dd");
  if (!dd || !window.matchMedia) return;
  var narrow = window.matchMedia("(max-width: 880px)");
  function fit() { dd.open = !narrow.matches; }
  fit();
  if (narrow.addEventListener) narrow.addEventListener("change", fit); else narrow.addListener(fit);
  dd.addEventListener("click", function (e) { if (narrow.matches && e.target.closest("a")) dd.open = false; });
})();
