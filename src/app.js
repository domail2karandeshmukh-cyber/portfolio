(function () {
  "use strict";
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* Header border once the page scrolls */
  var nav = $(".nav");
  function onScroll() { nav.classList.toggle("stuck", window.scrollY > 8); }
  onScroll();
  addEventListener("scroll", onScroll, { passive: true });

  /* Hero: engineer's message versus the published procedure */
  var frame = $(".cmp-frame"), range = $(".cmp-range"), tabs = $$(".cmp-tabs button"), raf = 0, touched = false;
  function setX(v) {
    v = Math.max(0, Math.min(100, v));
    frame.style.setProperty("--x", v + "%");
    range.value = v;
    tabs[0].setAttribute("aria-pressed", v >= 50);
    tabs[1].setAttribute("aria-pressed", v < 50);
  }
  function glide(to, ms) {
    cancelAnimationFrame(raf);
    if (reduce) { setX(to); return; }
    var from = parseFloat(range.value), t0 = performance.now();
    (function step(t) {
      var p = Math.min(1, Math.max(0, (t - t0) / ms)), e = 1 - Math.pow(1 - p, 3);
      setX(from + (to - from) * e);
      if (p < 1) raf = requestAnimationFrame(step);
    })(t0);
  }
  range.addEventListener("input", function () { touched = true; cancelAnimationFrame(raf); setX(+range.value); });
  tabs.forEach(function (b) {
    b.addEventListener("click", function () { touched = true; glide(+b.dataset.x, 650); });
  });
  if (reduce || !("IntersectionObserver" in window)) {
    setX(0);
  } else {
    setX(100);
    var io = new IntersectionObserver(function (es) {
      if (!es[0].isIntersecting) return;
      io.disconnect();
      setTimeout(function () { if (!touched) glide(0, 1500); }, 1100);
    }, { threshold: 0.4 });
    io.observe(frame);
  }

  /* Writing samples: filter by document type */
  var chips = $$(".filters .chip"), cards = $$("#docs > li");
  chips.forEach(function (c) {
    c.addEventListener("click", function () {
      var t = c.dataset.t;
      chips.forEach(function (o) { o.setAttribute("aria-pressed", o === c); });
      cards.forEach(function (li) { li.hidden = !(t === "all" || li.dataset.t === t); });
      showAll();
    });
  });
  var list = $("#docs"), allBtn = $("#alldocs");
  function showAll() { list.classList.remove("short"); }
  if (allBtn) allBtn.addEventListener("click", showAll);

  /* Header: mark the section in view */
  var links = $$(".nav nav a");
  if ("IntersectionObserver" in window) {
    var so = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (!e.isIntersecting) return;
        links.forEach(function (a) {
          if (a.getAttribute("href") === "#" + e.target.id) a.setAttribute("aria-current", "true");
          else a.removeAttribute("aria-current");
        });
      });
    }, { rootMargin: "-45% 0px -50% 0px" });
    links.forEach(function (a) { var s = $(a.getAttribute("href")); if (s) so.observe(s); });
  }

  /* Video: load YouTube only when asked */
  var yt = $("#yt");
  if (yt) yt.addEventListener("click", function () {
    var f = document.createElement("iframe");
    f.title = "Karan Deshmukh video portfolio";
    f.allow = "autoplay; encrypted-media; picture-in-picture";
    f.allowFullscreen = true;
    f.src = "https://www.youtube-nocookie.com/embed/videoseries?list=" + yt.dataset.list + "&autoplay=1";
    yt.replaceWith(f);
  });

  /* APRIL */
  var FAQ = JSON.parse($("#faq").textContent), panel = $("#april"), log = $("#log"), q = $("#q"), orb = $("#orb");
  var voice = $("#voice"), dock = $(".dock"), sugg = $("#sugg"), hist = [], opener = null, greeted = false;
  function esc(t) { return t.replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function rich(t) {
    return esc(t).replace(/https?:\/\/[^\s<]+[^\s<.,;:!?)]/g, function (u) {
      return '<a href="' + u + '" target="_blank" rel="noopener">' + u.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "") + "</a>";
    });
  }
  function add(cls, html) {
    var d = document.createElement("div");
    d.className = "msg " + cls;
    d.innerHTML = html;
    log.appendChild(d);
    log.scrollTop = log.scrollHeight;
    return d;
  }
  function speak(t) {
    if (!voice.checked || !window.speechSynthesis) return;
    speechSynthesis.cancel();
    var u = new SpeechSynthesisUtterance(t.replace(/https?:\/\/\S+/g, ""));
    u.rate = 0.98;
    u.onstart = function () { orb.classList.add("talk"); };
    u.onend = u.onerror = function () { orb.classList.remove("talk"); };
    speechSynthesis.speak(u);
  }
  function offline(text) {
    var s = text.toLowerCase();
    for (var i = 0; i < FAQ.length; i++) if (new RegExp(FAQ[i].keys).test(s)) return FAQ[i].a;
    return "I can't reach my AI model right now. Try one of the suggested questions, or message Karan on LinkedIn: " + document.body.dataset.linkedin;
  }
  function ask(text) {
    text = String(text || "").trim();
    if (!text) return;
    sugg.hidden = true;
    add("u", esc(text));
    var w = add("a wait", "Thinking...");
    orb.classList.add("talk");
    fetch("/api/april", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ q: text, history: hist }) })
      .then(function (r) { if (!r.ok) throw 0; return r.json(); })
      .then(function (d) { if (!d.answer) throw 0; return d.answer; })
      .catch(function () { return offline(text); })
      .then(function (a) {
        orb.classList.remove("talk");
        w.className = "msg a";
        w.innerHTML = rich(a);
        log.scrollTop = log.scrollHeight;
        hist.push({ role: "user", content: text }, { role: "assistant", content: a });
        hist = hist.slice(-6);
        speak(a);
      });
  }
  function openPanel(pre) {
    if (panel.hidden) opener = document.activeElement;
    panel.hidden = false;
    dock.hidden = true;
    if (!greeted) {
      greeted = true;
      var h = new Date().getHours();
      add("a", (h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening") + ". I'm APRIL, Karan's assistant. Ask me about his writing, his projects or his availability.");
    }
    if (pre) ask(pre); else q.focus();
  }
  function closePanel() {
    panel.hidden = true;
    dock.hidden = false;
    if (window.speechSynthesis) speechSynthesis.cancel();
    if (opener && opener.focus) opener.focus();
  }
  $$("[data-april]").forEach(function (b) {
    b.addEventListener("click", function () { openPanel(b.dataset.ask || ""); });
  });
  $("#april-x").addEventListener("click", closePanel);
  addEventListener("keydown", function (e) { if (e.key === "Escape" && !panel.hidden) closePanel(); });
  $("#ask").addEventListener("submit", function (e) { e.preventDefault(); var t = q.value; q.value = ""; ask(t); });
  FAQ.forEach(function (f) {
    var b = document.createElement("button");
    b.type = "button";
    b.className = "chip sm";
    b.textContent = f.q;
    b.addEventListener("click", function () { ask(f.q); });
    sugg.appendChild(b);
  });
  if (!window.speechSynthesis) voice.parentNode.hidden = true;
  var SR = window.SpeechRecognition || window.webkitSpeechRecognition, mic = $("#mic");
  if (SR) {
    mic.hidden = false;
    mic.addEventListener("click", function () {
      var r = new SR();
      r.lang = "en-US";
      mic.classList.add("on");
      r.onresult = function (e) { voice.checked = true; ask(e.results[0][0].transcript); };
      r.onend = r.onerror = function () { mic.classList.remove("on"); };
      r.start();
    });
  }
})();
