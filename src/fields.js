// The field explorer on the home page (lib/hubs.mjs writes it): one tab for each field. Without this script the six
// fields are listed one after another, so nothing is hidden from a reader without JavaScript.
(function () {
  var root = document.querySelector(".fx");
  if (!root) return;
  var list = root.querySelector(".fx-tabs");
  var tabs = [].slice.call(list.querySelectorAll("[role=tab]"));
  var panels = tabs.map(function (t) { return document.getElementById(t.getAttribute("aria-controls")); });
  panels.forEach(function (p, i) { p.setAttribute("role", "tabpanel"); p.setAttribute("aria-labelledby", tabs[i].id); });
  function show(i, focus) {
    tabs.forEach(function (t, k) {
      var on = k === i;
      t.setAttribute("aria-selected", String(on));
      t.tabIndex = on ? 0 : -1;
      panels[k].hidden = !on;
    });
    if (focus) tabs[i].focus();
  }
  tabs.forEach(function (t, i) {
    t.addEventListener("click", function () { show(i, false); });
    t.addEventListener("keydown", function (e) {
      var n = tabs.length, to = null;
      if (e.key === "ArrowRight" || e.key === "ArrowDown") to = (i + 1) % n;
      else if (e.key === "ArrowLeft" || e.key === "ArrowUp") to = (i - 1 + n) % n;
      else if (e.key === "Home") to = 0;
      else if (e.key === "End") to = n - 1;
      if (to === null) return;
      e.preventDefault();
      show(to, true);
    });
  });
  list.hidden = false;
  root.classList.add("fx-on");
  show(0, false);
})();
