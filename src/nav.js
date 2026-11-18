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
