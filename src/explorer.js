/* /kc1-api-explorer: filters over the recorded exchanges. The page is whole without this file: every exchange is a
   closed block that opens on a click or a key press (the browser's own details element). With it, a reader can show
   only the accepted or the refused requests, only one address, and open or close them all. Nothing is sent anywhere:
   the requests and the responses were written into the page by the build (lib/explorer.mjs). */
(function () {
  "use strict";
  var list = document.querySelector(".kx-list");
  if (!list) return;
  var items = list.querySelectorAll(".kx-x"), paths = [];
  Array.prototype.forEach.call(items, function (li) { var p = li.getAttribute("data-path"); if (paths.indexOf(p) < 0) paths.push(p); });

  var bar = document.createElement("div");
  bar.className = "kx-bar";
  bar.innerHTML = '<div class="kx-seg" role="group" aria-label="Show by outcome">' +
    '<button type="button" class="btn line sm" data-status="" aria-pressed="true">All</button>' +
    '<button type="button" class="btn line sm" data-status="ok" aria-pressed="false">Accepted</button>' +
    '<button type="button" class="btn line sm" data-status="error" aria-pressed="false">Refused</button></div>' +
    '<label class="kx-pick">Address <select><option value="">Every address</option>' + paths.map(function (p) { return '<option value="' + p.replace(/"/g, "&quot;") + '">' + p.replace(/</g, "&lt;") + "</option>"; }).join("") + "</select></label>" +
    '<button type="button" class="btn line sm kx-openall" aria-pressed="false">Open all</button>' +
    '<p class="kx-count" role="status" aria-live="polite"></p>';
  list.parentNode.insertBefore(bar, list);
  var status = "", path = "", select = bar.querySelector("select"), openAll = bar.querySelector(".kx-openall"), count = bar.querySelector(".kx-count");

  function paint() {
    var shown = 0;
    Array.prototype.forEach.call(items, function (li) {
      var on = (!status || li.getAttribute("data-status") === status) && (!path || li.getAttribute("data-path") === path);
      li.hidden = !on;
      if (on) shown++;
    });
    Array.prototype.forEach.call(bar.querySelectorAll("[data-status]"), function (b) { b.setAttribute("aria-pressed", String(b.getAttribute("data-status") === status)); });
    count.textContent = shown === items.length ? "All " + shown + " exchanges" : shown + " of " + items.length + " exchanges";
  }
  bar.addEventListener("click", function (e) {
    var b = e.target.closest("button");
    if (!b) return;
    if (b === openAll) {
      var open = b.getAttribute("aria-pressed") !== "true";
      Array.prototype.forEach.call(items, function (li) { li.querySelector("details").open = open; });
      b.setAttribute("aria-pressed", String(open));
      b.textContent = open ? "Close all" : "Open all";
      return;
    }
    status = b.getAttribute("data-status");
    paint();
  });
  select.addEventListener("change", function () { path = select.value; paint(); });

  // A link to one exchange (#x-missing-fields) opens it, whatever the filters say.
  function fromHash() {
    var li = /^#x-/.test(location.hash) && document.getElementById(location.hash.slice(1));
    if (!li) return;
    status = ""; path = ""; select.value = ""; paint();
    li.querySelector("details").open = true;
    li.scrollIntoView({ block: "start" });
  }
  window.addEventListener("hashchange", fromHash);
  paint();
  fromHash();
})();
