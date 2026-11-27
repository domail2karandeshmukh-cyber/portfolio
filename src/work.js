// The software and SaaS documentation pages: tabs, the skills filter, and the case study's stage rail.
// Everything works without it: the tab panels are a list, the skills are all shown, the rail is a list of links.
(function () {
  "use strict";
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  // Tabs, as the WAI-ARIA authoring practices describe them: arrows move between tabs, Home and End go to the ends,
  // and the selected tab is the one in the page's tab order.
  $$("[data-tabs]").forEach(function (box) {
    var tabs = $$("[role=tab]", box);
    function select(t, focus) {
      tabs.forEach(function (x) {
        var on = x === t;
        x.setAttribute("aria-selected", String(on));
        x.tabIndex = on ? 0 : -1;
        document.getElementById(x.getAttribute("aria-controls")).hidden = !on;
      });
      if (focus) t.focus();
    }
    tabs.forEach(function (t, i) {
      t.addEventListener("click", function () { select(t, false); });
      t.addEventListener("keydown", function (e) {
        var j = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: tabs.length - 1 }[e.key];
        if (j === undefined) return;
        e.preventDefault();
        select(tabs[(j + tabs.length) % tabs.length], true);
      });
    });
  });

  // The skills filter: show one kind of evidence, and hide the groups left empty.
  $$("[data-skills]").forEach(function (box) {
    var bar = box.querySelector(".sk-filter");
    if (!bar) return;
    bar.hidden = false;
    var buttons = $$("button", bar);
    buttons.forEach(function (b) {
      b.addEventListener("click", function () {
        var f = b.getAttribute("data-f");
        buttons.forEach(function (x) { x.setAttribute("aria-pressed", String(x === b)); });
        $$("li[data-cls]", box).forEach(function (li) { li.hidden = f !== "all" && li.getAttribute("data-cls") !== f; });
        $$(".sk-group", box).forEach(function (g) {
          var shown = $$("li[data-cls]", g).filter(function (li) { return !li.hidden; }).length;
          g.hidden = shown === 0;
          if (f !== "all" && shown) g.open = true;
        });
        var rest = box.querySelector(".sk-rest");
        if (rest && f !== "all") rest.open = true;
      });
    });
  });

  // The case study's rail marks the stage being read.
  var links = $$(".w-steps a");
  if (links.length && "IntersectionObserver" in window) {
    var byId = {};
    links.forEach(function (a) { byId[a.getAttribute("href").slice(1)] = a; });
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        links.forEach(function (a) { a.removeAttribute("aria-current"); });
        var a = byId[e.target.id];
        if (a) a.setAttribute("aria-current", "step");
      });
    }, { rootMargin: "-30% 0px -60% 0px" });
    $$(".wst").forEach(function (s) { io.observe(s); });
  }
})();
