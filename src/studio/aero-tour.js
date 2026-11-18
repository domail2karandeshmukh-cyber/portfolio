/* The guided path on /studio/aerospace: nine steps shown one at a time, with a rail to jump between them and
   Previous and Next. "Watch it in the film" plays that part of the film above. Without this script, the steps are a
   plain numbered list and the film links open the video file at the right time. The overview is in English. */
(function () {
  "use strict";
  var tour = document.querySelector("[data-tour]");
  if (!tour) return;
  var steps = Array.prototype.slice.call(tour.querySelectorAll(".ae-step")), video = document.querySelector("#film video"), at = 0;
  var still = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var rail = document.createElement("div");
  rail.className = "ae-rail";
  rail.setAttribute("role", "group");
  rail.setAttribute("aria-label", "Steps of the workflow");
  rail.innerHTML = steps.map(function (li, i) {
    var t = li.querySelector("h3").textContent.replace(/^\d+/, "");
    return '<button type="button" class="ae-dot" data-i="' + i + '" aria-controls="' + li.id + '"><span class="ae-num" aria-hidden="true">' + (i + 1) + '</span><span class="ae-dot-t">' + t + "</span></button>";
  }).join("");
  var nav = document.createElement("p");
  nav.className = "ae-nav";
  nav.innerHTML = '<button type="button" class="btn sm line" data-go="-1">Previous step</button><button type="button" class="btn sm ink" data-go="1">Next step</button>';
  tour.insertBefore(rail, tour.firstChild);
  tour.appendChild(nav);
  var count = tour.querySelector(".ae-tour-n");
  function show(i, focus) {
    at = Math.max(0, Math.min(steps.length - 1, i));
    steps.forEach(function (li, k) { li.hidden = k !== at; });
    rail.querySelectorAll(".ae-dot").forEach(function (b, k) {
      if (k === at) b.setAttribute("aria-current", "step"); else b.removeAttribute("aria-current");
      b.classList.toggle("done", k < at);
    });
    var prev = nav.querySelector('[data-go="-1"]'), next = nav.querySelector('[data-go="1"]');
    prev.disabled = at === 0;
    next.textContent = at === steps.length - 1 ? "Back to step 1" : "Next step";
    count.textContent = "Step " + (at + 1) + " of " + steps.length;
    if (focus) { var h = steps[at].querySelector("h3"); h.tabIndex = -1; h.focus({ preventScroll: true }); }
    if (focus && history.replaceState) history.replaceState(null, "", "#step-" + (at + 1));
  }
  rail.addEventListener("click", function (e) { var b = e.target.closest(".ae-dot"); if (b) show(+b.dataset.i, true); });
  nav.addEventListener("click", function (e) {
    var b = e.target.closest("[data-go]");
    if (!b) return;
    var to = at === steps.length - 1 && b.dataset.go === "1" ? 0 : at + +b.dataset.go;
    show(to, true);
  });
  tour.addEventListener("click", function (e) {
    var a = e.target.closest("[data-seek]");
    if (!a || !video) return;
    e.preventDefault();
    video.currentTime = +a.dataset.seek;
    var p = video.play();
    if (p && p.catch) p.catch(function () {});
    video.scrollIntoView({ behavior: still ? "auto" : "smooth", block: "center" });
  });
  tour.classList.add("ae-js");
  var m = /^#step-(\d+)$/.exec(location.hash);
  show(m ? +m[1] - 1 : 0, false);
})();
