/* /sign-in-flows: each flow, one step at a time. The page is whole without this file: every step is in the list
   under its diagram. With it, a flow shows the current step beside the diagram, marks that step's message in the
   picture, and has Previous, Next and a button that shows every step again. Nothing plays by itself: the reader sets
   the pace. A step in the diagram can be clicked; the buttons and the list are the keyboard's way through.

   A link to a step (#oauth-5) opens that step. The words are in English, like the page (lib/flows.mjs). */
(function () {
  "use strict";
  var flows = document.querySelectorAll(".sf-flow");
  if (!flows.length) return;
  var still = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;

  Array.prototype.forEach.call(flows, function (sec) {
    var list = sec.querySelector(".sf-steps"), steps = list.querySelectorAll(".sf-step"), marks = sec.querySelectorAll(".sf-m");
    var n = steps.length, at = 1, all = false;
    var name = sec.querySelector("h2").textContent;

    var bar = document.createElement("div");
    bar.className = "sf-bar";
    bar.setAttribute("role", "group");
    bar.setAttribute("aria-label", "Steps of " + name);
    bar.innerHTML = '<button type="button" class="btn line sm" data-go="-1">Previous</button>' +
      '<p class="sf-pos" role="status" aria-live="polite"></p>' +
      '<button type="button" class="btn ink sm" data-go="1">Next</button>' +
      '<button type="button" class="btn line sm sf-all" aria-pressed="false">Show every step</button>';
    list.parentNode.insertBefore(bar, list);
    var pos = bar.querySelector(".sf-pos"), prev = bar.querySelector('[data-go="-1"]'), next = bar.querySelector('[data-go="1"]'), every = bar.querySelector(".sf-all");
    sec.classList.add("sf-live");

    function show(k, tell) {
      at = Math.max(1, Math.min(n, k));
      Array.prototype.forEach.call(steps, function (li, i) { li.hidden = !all && i + 1 !== at; li.classList.toggle("on", i + 1 === at); });
      Array.prototype.forEach.call(marks, function (g) { var s = +g.getAttribute("data-step"); g.classList.toggle("on", !all && s === at); g.classList.toggle("done", !all && s < at); g.classList.toggle("todo", !all && s > at); });
      prev.disabled = all || at === 1;
      next.disabled = all || at === n;
      // The status is read aloud when the step changes, so it names the step, not only its number.
      pos.textContent = all ? "All " + n + " steps" : "Step " + at + " of " + n + (tell ? ": " + steps[at - 1].querySelector("h3").textContent.replace(/^\d+/, "") : "");
    }
    bar.addEventListener("click", function (e) {
      var b = e.target.closest("button");
      if (!b) return;
      if (b === every) { all = !all; every.setAttribute("aria-pressed", String(all)); every.textContent = all ? "Show one step at a time" : "Show every step"; sec.classList.toggle("sf-open", all); show(at, false); return; }
      show(at + (+b.getAttribute("data-go")), true);
    });
    Array.prototype.forEach.call(marks, function (g) {
      g.addEventListener("click", function () {
        var k = +g.getAttribute("data-step");
        if (all) { var li = steps[k - 1]; if (li.scrollIntoView) li.scrollIntoView({ block: "nearest", behavior: still ? "auto" : "smooth" }); return; }
        show(k, true);
      });
    });
    sec._sfShow = function (k) { if (all) every.click(); show(k, true); };
    show(1, false);
  });

  // #oauth-5 opens step 5 of the OAuth flow, on load and when the address changes.
  function fromHash() {
    var m = /^#([a-z]+)-(\d+)$/.exec(location.hash);
    if (!m) return;
    var sec = document.getElementById(m[1]);
    if (!sec || !sec._sfShow) return;
    sec._sfShow(+m[2]);
    sec.scrollIntoView({ block: "start" });
  }
  window.addEventListener("hashchange", fromHash);
  fromHash();
})();
