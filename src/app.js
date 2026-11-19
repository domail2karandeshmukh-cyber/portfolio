/* karandeshmukh.dev: one script for every page. Each part runs only where its elements exist. */
(function () {
  "use strict";
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  var body = document.body, LANG = body.dataset.lang || "en";
  function read(id, fallback) { var el = document.getElementById(id); try { return el ? JSON.parse(el.textContent) : fallback; } catch (e) { return fallback; } }
  function esc(t) { return String(t).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } }
  var I = read("i18n", {}), FAQ = read("faq", []);

  /* April's name: the dot of the i is her orb */
  $$(".aw").forEach(function (el) {
    if (el.textContent.trim() === "April") el.innerHTML = '<span class="vh">April</span><span aria-hidden="true">Apr<span class="aw-i">ı</span>l</span>';
  });

  /* Header border once the page scrolls */
  var nav = $(".nav");
  if (nav && !nav.classList.contains("stuck")) {
    var onNav = function () { nav.classList.toggle("stuck", window.scrollY > 8); };
    onNav();
    addEventListener("scroll", onNav, { passive: true });
  }

  /* The highlighter: a stroke is drawn when its words come into view */
  var strokes = $$(".hl");
  if (reduce || !("IntersectionObserver" in window)) strokes.forEach(function (m) { m.classList.add("on"); });
  else {
    var ho = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (!e.isIntersecting) return;
        ho.unobserve(e.target);
        setTimeout(function () { e.target.classList.add("on"); }, 280);
      });
    }, { threshold: 0.85 });
    strokes.forEach(function (m) { ho.observe(m); });
  }

  /* A button that copies the email address, and says so where the visitor is looking and to a screen reader. */
  $$("[data-copy]").forEach(function (b) {
    var label = b.querySelector("span"), was = label ? label.textContent : "";
    b.addEventListener("click", function () {
      var text = b.getAttribute("data-copy");
      function done(ok) {
        if (label) label.textContent = ok ? (I.copied || "Copied") : was;
        b.classList.toggle("done", ok);
        b.setAttribute("aria-live", "polite");
        setTimeout(function () { if (label) label.textContent = was; b.classList.remove("done"); }, 2400);
      }
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(function () { done(true); }, function () { fallback(); });
      else fallback();
      function fallback() {
        var t = document.createElement("textarea"); t.value = text; t.setAttribute("readonly", ""); t.style.position = "fixed"; t.style.opacity = "0";
        document.body.appendChild(t); t.select();
        var ok = false; try { ok = document.execCommand("copy"); } catch (e) { ok = false; }
        t.remove(); done(ok);
      }
    });
  });

  /* The featured documents are dealt onto the desk when they come into view */
  var deck = $(".docs.feature");
  if (deck && !reduce && "IntersectionObserver" in window) {
    deck.classList.add("deal");
    var dio = new IntersectionObserver(function (es) {
      if (!es[0].isIntersecting) return;
      dio.disconnect();
      deck.classList.remove("deal");
    }, { threshold: 0.18 });
    dio.observe(deck);
  }

  /* The case study in six stages: the message, its analysis, the markup, the procedure, its checks and its outputs
     (lib/casestudy.mjs). A fact carries the same data-f in the message and in the document, so it can be followed
     from one to the other.
     The same stage then takes a visitor's own message: /api/rewrite sends it back marked up, with a draft,
     the questions still open and a check of its names and numbers. Everything it sends is drawn as text. */
  var rw = $("#rewrite");
  if (rw) (function () {
    var stage = $(".rw-stage", rw), raw = $(".rw-raw", rw), doc = $(".rw-doc", rw), tabs = $$(".rw-tabs button", rw);
    var state = +rw.dataset.state, timers = [], settle = 0, auto = false;
    function stagger() {
      $$("mark", raw).forEach(function (m, i) { m.style.setProperty("--i", Math.min(i, 16)); });
      $$("s", raw).forEach(function (m, i) { m.style.setProperty("--i", Math.min(i + 3, 16)); });
    }
    stagger();
    // The message is on show in stages 1 and 3, the document in stage 4. The facts fly only between those two.
    function layer(s) { return s === 4 ? doc : s === 1 || s === 3 ? raw : null; }
    function later(fn, ms) { timers.push(setTimeout(fn, ms)); }
    // Each fact leaves its place in one version and lands on its place in the other.
    function fly(from, to) {
      var box = stage.getBoundingClientRect();
      $$("[data-f]", from).forEach(function (a, i) {
        var b = $('[data-f="' + a.dataset.f + '"]', to);
        var ra = a.getClientRects()[0], rb = b && b.getClientRects()[0];
        if (!ra || !rb) return;
        var chip = document.createElement("span"), wait = 80 + Math.min(i, 18) * 55;
        chip.className = "rw-fly";
        chip.textContent = a.textContent;
        stage.appendChild(chip);
        // Start and finish inside the stage, so a long fact never runs off the screen.
        var room = box.width - chip.offsetWidth, x0 = Math.max(0, Math.min(ra.left - box.left - 4, room)), x1 = Math.max(0, Math.min(rb.left - box.left - 4, room));
        chip.style.left = x0 + "px";
        chip.style.top = ra.top - box.top + "px";
        var end = "translate(" + (x1 - x0) + "px," + (rb.top - ra.top) + "px)";
        chip.animate([{ transform: "translate(0,0)", opacity: 1 }, { transform: end, opacity: 1, offset: 0.8 }, { transform: end, opacity: 0 }],
          { duration: 950, delay: wait, easing: "cubic-bezier(.6,0,.15,1)", fill: "both" }).onfinish = function () { chip.remove(); };
        later(function () { b.classList.add("lit"); }, wait + 720);
      });
    }
    function set(s, quick, again) {
      if (s === state && !again) return;
      var was = state, h0 = stage.offsetHeight;
      $$(".rw-fly", stage).forEach(function (c) { c.remove(); });
      $$(".lit", rw).forEach(function (e) { e.classList.remove("lit"); });
      if (!quick && !reduce && stage.animate && layer(was) && layer(s) && layer(was) !== layer(s)) fly(layer(was), layer(s));
      state = s;
      rw.dataset.state = s;
      tabs.forEach(function (b) { b.setAttribute("aria-pressed", +b.dataset.s === s); });
      var h1 = stage.offsetHeight;
      if (quick || reduce || h0 === h1) return;
      stage.style.height = h0 + "px";
      void stage.offsetHeight;
      stage.style.height = h1 + "px";
      clearTimeout(settle);
      settle = setTimeout(function () { stage.style.height = ""; }, 720);
    }
    function stop() {
      auto = false;
      timers.forEach(clearTimeout);
      timers = [];
    }
    // The edit, start to finish: the message, what it leaves out, the markup, then the document.
    // The checks and the outputs wait for the visitor: they are there to be read, not watched.
    function play() {
      stop();
      auto = true;
      var lead = state === 1 ? 0 : 1500;
      set(1);
      later(function () { if (auto) set(2); }, lead + 1300);
      later(function () { if (auto) set(3); }, lead + 1300 + 3600);
      later(function () { if (auto) set(4); auto = false; }, lead + 1300 + 3600 + 2900);
    }
    tabs.forEach(function (b) { b.addEventListener("click", function () { stop(); set(+b.dataset.s); }); });
    $(".rw-again", rw).addEventListener("click", play);

    /* ----- A visitor's own message ----- */
    var tray = $("#try"), ta = $("#try-text"), note = $("#try-msg"), mine = $(".rw-you", rw), theirs = $(".rw-ex", rw), acts = $(".rw-acts", rw), stats = $("#rw-stats"), copy = $("#rw-copy"), bench = $("#rw-open");
    var home = { raw: raw.innerHTML, doc: doc.innerHTML, lang: stage.getAttribute("lang") }, last = null, job = 0, busy = false, samples = null, sampled = false;
    var KIND = { "how-to": "#0A8F7A", troubleshooting: "#CF3F5A", reference: "#1F78D1", "release-note": "#C97800", policy: "#3D4AB0", explainer: "#6A58E6" };
    function el(tag, cls, text) {
      var e = document.createElement(tag);
      if (cls) e.className = cls;
      if (text != null) e.textContent = text;
      return e;
    }
    // One line of a draft: runs of text, bold where a label is named, in one wrapper where they carry a fact.
    function line(into, runs) {
      var box = null, id = null;
      (runs || []).forEach(function (r) {
        if ((r.f || null) !== id) {
          id = r.f || null;
          box = id ? into.appendChild(el("span")) : null;
          if (box) box.dataset.f = id;
        }
        (box || into).appendChild(r.b ? el("b", "", r.t) : document.createTextNode(r.t));
      });
      return into;
    }
    function words(runs, md) { return (runs || []).map(function (r) { return md && r.b ? "**" + r.t + "**" : r.t; }).join(""); }
    function fill(text, values) { return String(text || "").replace(/\{(\w)\}/g, function (m, k) { return k in values ? values[k] : m; }); }
    function source(own) {
      rw.dataset.src = own ? "yours" : "example";
      theirs.hidden = own;
      mine.hidden = !own;
      // On a phone April's button would sit on the draft, so it steps aside until the example is back.
      if (dock && innerWidth < 720 && panel && panel.hidden && (!tour || tour.hidden)) dock.hidden = own;
      // The samples are in English, like the example. A visitor's own message may be in any language.
      if (own && !sampled) stage.removeAttribute("lang"); else stage.setAttribute("lang", home.lang);
    }
    // The message as it was pasted, then, once the draft is back, with its facts marked and its noise struck.
    function message(text, parts) {
      raw.textContent = "";
      raw.appendChild(el("p", "raw-head", sampled ? I.rwSample : I.rwYours));
      var p = raw.appendChild(el("p", "raw-msg mine"));
      if (!parts) p.textContent = text;
      else parts.forEach(function (s) {
        if (s.k === "f") { var m = p.appendChild(el("mark", "", s.t)); if (s.f) m.dataset.f = s.f; }
        else p.appendChild(s.k === "n" ? el("s", "", s.t) : document.createTextNode(s.t));
      });
      stagger();
    }
    function sheet(r) {
      doc.textContent = "";
      var type = doc.appendChild(el("p", "doc-type", r.label));
      type.style.setProperty("--tc", KIND[r.kind] || KIND["how-to"]);
      type.appendChild(el("span", "draft", I.rwDraft));
      line(doc.appendChild(el("p", "doc-title")), r.title);
      line(doc.appendChild(el("p", "doc-meta")), r.audience);
      r.sections.forEach(function (s) {
        if (s.heading) doc.appendChild(el("p", "doc-h", s.heading));
        var list = s.style === "text" ? null : doc.appendChild(el(s.style === "steps" ? "ol" : "ul"));
        s.items.forEach(function (it) {
          var at = line(list ? list.appendChild(el("li")) : doc.appendChild(el("p")), it.runs);
          if (it.caution) line((list ? at : doc).appendChild(el("p", "callout")), it.caution);
        });
      });
      var open = doc.appendChild(el("div", "rw-q"));
      if (r.questions.length) {
        open.appendChild(el("p", "doc-h", I.rwAsk));
        var ul = open.appendChild(el("ul"));
        r.questions.forEach(function (t) { ul.appendChild(el("li", "", t)); });
      }
      // The check is made by rule on the server: a name or a number the draft lost, or a number it brought.
      var c = r.check || {}, bad = [];
      function quoted(list) { return list.map(function (m) { return "“" + m + "”"; }).join(", "); }
      if (c.missing && c.missing.length) bad.push(fill(I.rwLost, { l: quoted(c.missing) }));
      if (c.added && c.added.length) bad.push(fill(I.rwAdded, { l: c.added.join(", ") }));
      if (c.doubt && c.doubt.length) bad.push(fill(I.rwDoubt, { l: quoted(c.doubt) }));
      if (bad.length) open.appendChild(el("p", "rw-check bad", I.rwRule + " " + bad.join(" ")));
      else if (c.count) open.appendChild(el("p", "rw-check", I.rwRule + " " + fill(I.rwChecked, { n: c.count })));
      if (!open.firstChild) open.remove();
    }
    function markdown(r) {
      var L = ["# " + words(r.title)];
      if (r.audience && r.audience.length) L.push("", words(r.audience, true));
      r.sections.forEach(function (s) {
        L.push("", "## " + s.heading, "");
        s.items.forEach(function (it, i) {
          var lead = s.style === "steps" ? i + 1 + ". " : s.style === "bullets" ? "- " : "";
          L.push(lead + words(it.runs, true));
          if (it.caution) L.push((lead ? "   " : "") + "> " + words(it.caution, true));
          if (!lead) L.push("");
        });
      });
      if (r.questions.length) {
        L.push("", "---", "", "## " + I.rwAsk, "");
        r.questions.forEach(function (q) { L.push("- " + q); });
      }
      return L.join("\n").replace(/\n{3,}/g, "\n\n") + "\n";
    }
    function done(r) {
      last = r;
      message("", r.raw);
      sheet(r);
      delete rw.dataset.phase;
      tabs.forEach(function (b) { b.disabled = false; });
      stats.textContent = fill(I.rwStats, { f: r.stats.facts, n: r.stats.cut, q: r.questions.length, s: (Math.max(100, r.ms || 0) / 1000).toLocaleString(LANG, { minimumFractionDigits: 1, maximumFractionDigits: 1 }) });
      copy.hidden = !navigator.clipboard;
      if (bench) bench.hidden = false;
      if (reduce) return set(4, true, true);
      stop();
      auto = true;
      later(function () { if (auto) set(3); }, 450);
      later(function () { if (auto) set(4); auto = false; }, 450 + 2500 + Math.min(r.raw.length, 36) * 40);
    }
    // The example comes back, as it was.
    function back(why) {
      job++;
      busy = false;
      stop();
      raw.innerHTML = home.raw;
      doc.innerHTML = home.doc;
      stagger();
      source(false);
      delete rw.dataset.phase;
      tabs.forEach(function (b) { b.disabled = false; });
      acts.hidden = true;
      last = null;
      set(4, true, true);
      note.textContent = why || "";
    }
    function load() {
      samples = samples || fetch("/desk.json").then(function (r) { return r.json(); }).then(function (d) { samples.list = d.messages || []; return samples.list; }).catch(function () { samples = null; return []; });
      return samples;
    }
    function send(text) {
      text = String(text || "").trim();
      note.textContent = "";
      if (busy) return;
      if (text.length < 40) { note.textContent = I.rwShort; ta.focus(); return; }
      var run = ++job, began = Date.now();
      busy = true;
      sampled = !!(samples && samples.list && samples.list.some(function (m) { return m.text.trim() === text; }));
      tourOff();
      stop();
      source(true);
      rw.dataset.phase = "wait";
      message(text);
      doc.textContent = "";
      acts.hidden = false;
      copy.hidden = true;
      if (bench) bench.hidden = true;
      set(1, true, true);
      tabs.forEach(function (b) { b.disabled = +b.dataset.s > 1; });
      var top = rw.getBoundingClientRect().top;
      if (top < 70 || top > innerHeight * 0.4) window.scrollTo({ top: top + window.pageYOffset - 84, behavior: reduce ? "auto" : "smooth" });
      // A sample has its draft on file. Anything else goes to the model.
      load().then(function (list) {
        var known = list.filter(function (m) { return m.draft && m.text.trim() === text; })[0];
        if (known) return known.draft;
        if (sampled) { sampled = false; message(text); }
        var stopAt = window.AbortController ? new AbortController() : null;
        if (stopAt) setTimeout(function () { stopAt.abort(); }, 29000);
        return fetch("/api/rewrite", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text: text }), signal: stopAt ? stopAt.signal : undefined })
          .then(function (r) { if (!r.ok) throw r.status; return r.json(); });
      }).then(function (r) {
        if (run !== job) return;
        if (!r || !r.ok || !r.raw || !r.sections) throw 0;
        // Even a draft that is on file leaves the message on the stage for a moment before the pen comes down.
        setTimeout(function () { if (run === job) { busy = false; done(r); } }, Math.max(0, 1500 - (Date.now() - began)));
      }).catch(function (code) {
        if (run === job) back(code === 429 ? I.rwBusy : code === 422 ? I.rwNone : I.rwFail);
      });
    }
    if (tray && ta && I.rwYours) {
      // The tray stays folded until the visitor asks for it, so the example is all the home page shows.
      var own = $(".rw-own", rw);
      own.hidden = false;
      own.setAttribute("aria-expanded", "false");
      own.setAttribute("aria-controls", "try");
      own.addEventListener("click", function () {
        tray.hidden = false;
        own.setAttribute("aria-expanded", "true");
        tray.scrollIntoView({ block: "center", behavior: reduce ? "auto" : "smooth" });
        ta.focus({ preventScroll: true });
      });
      tray.addEventListener("submit", function (e) { e.preventDefault(); send(ta.value); });
      ta.addEventListener("keydown", function (e) { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); send(ta.value); } });
      ta.addEventListener("input", function () { ta.style.height = "auto"; ta.style.height = Math.min(ta.scrollHeight + 2, 352) + "px"; note.textContent = ""; });
      $$("[data-sample]", tray).forEach(function (b) {
        b.addEventListener("click", function () {
          load().then(function (list) {
            var s = list.filter(function (m) { return m.id === b.dataset.sample; })[0];
            if (!s) { note.textContent = I.rwFail; return; }
            ta.value = s.text;
            ta.dispatchEvent(new Event("input"));
            send(s.text);
          });
        });
      });
      $("#rw-back").addEventListener("click", function () { back(); });
      // The draft goes to the workbench through this browser's storage. Nothing is sent to a server for it.
      if (bench) bench.addEventListener("click", function () {
        if (!last) return;
        try { localStorage.setItem("wb:incoming", markdown(last)); } catch (e) { return; }
        location.href = "/workbench";
      });
      copy.addEventListener("click", function () {
        if (!last || !navigator.clipboard) return;
        var label = copy.dataset.label || (copy.dataset.label = copy.textContent);
        navigator.clipboard.writeText(markdown(last)).then(function () {
          copy.textContent = I.copied;
          setTimeout(function () { copy.textContent = label; }, 1600);
        });
      });
      // On a phone the keyboard leaves little room: April's button steps aside while a message is being typed.
      ta.addEventListener("focus", function () { if (dock && innerWidth < 720) dock.hidden = true; });
      // It comes back a moment after the box loses focus, never under a finger that is on its way to "Mark it up".
      ta.addEventListener("blur", function () {
        setTimeout(function () { if (dock && document.activeElement !== ta && panel && panel.hidden && (!tour || tour.hidden) && rw.dataset.src !== "yours") dock.hidden = false; }, 400);
      });
      if ("IntersectionObserver" in window) {
        var warm = new IntersectionObserver(function (es) { if (es[0].isIntersecting) { warm.disconnect(); load(); } }, { rootMargin: "200px" });
        warm.observe(tray);
      }
    }

    // Without motion the page opens on the finished document. With it, the edit plays once when the stage is in view.
    if (reduce || !("IntersectionObserver" in window)) { set(4, true); return; }
    // When the page opens on the stage, the headline is corrected first. The stage waits its turn.
    var opened = performance.now();
    var io = new IntersectionObserver(function (es) {
      if (!es[0].isIntersecting) return;
      io.disconnect();
      later(function () { if (rw.dataset.src === "example") play(); }, Math.max(0, 2700 - (performance.now() - opened)));
    }, { threshold: 0.55 });
    io.observe(stage);
  })();

  /* The case study page: a fact of the message shows where it went in the procedure, by pointer or keyboard,
     and the procedure opens in the workbench through this browser's storage. */
  var trace = $(".cs-trace");
  if (trace) (function () {
    var held = null;
    function light(f, on) { $$('[data-f="' + f + '"]', trace).forEach(function (e) { e.classList.toggle("on", on); }); }
    $$(".cs-before mark[data-f]", trace).forEach(function (m) {
      m.tabIndex = 0;
      m.setAttribute("role", "button");
      m.setAttribute("aria-pressed", "false");
      m.addEventListener("mouseenter", function () { if (!held) light(m.dataset.f, true); });
      m.addEventListener("mouseleave", function () { if (!held) light(m.dataset.f, false); });
      function hold() {
        var was = held;
        if (held) { light(held.dataset.f, false); held.setAttribute("aria-pressed", "false"); held = null; }
        if (was === m) return;
        held = m;
        m.setAttribute("aria-pressed", "true");
        light(m.dataset.f, true);
        var to = $('.cs-after [data-f="' + m.dataset.f + '"]', trace), r = to && to.getBoundingClientRect();
        if (r && (r.top < 80 || r.bottom > innerHeight)) to.scrollIntoView({ block: "center", behavior: reduce ? "auto" : "smooth" });
      }
      m.addEventListener("click", hold);
      m.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); hold(); } });
    });
  })();
  var csBench = $("#cs-bench"), csMd = $("#cs-md");
  if (csBench && csMd) csBench.addEventListener("click", function () {
    try { localStorage.setItem("wb:incoming", csMd.textContent.replace(/<\\\//g, "</")); } catch (e) { return; }
    location.href = "/workbench";
  });

  /* Key figures count up when they come into view */
  if (!reduce && "IntersectionObserver" in window) $$("[data-count]").forEach(function (el) {
    var m = /^(\d[\d,]*)(.*)$/.exec(el.textContent.trim());
    if (!m) return;
    var to = +m[1].replace(/,/g, ""), tail = m[2];
    var io = new IntersectionObserver(function (es) {
      if (!es[0].isIntersecting) return;
      io.disconnect();
      var t0 = performance.now();
      (function step(t) {
        var p = Math.min(1, (t - t0) / 1300), e = 1 - Math.pow(1 - p, 3);
        el.textContent = Math.round(to * e).toLocaleString(LANG) + tail;
        if (p < 1) requestAnimationFrame(step);
      })(t0);
    }, { threshold: 0.6 });
    io.observe(el);
  });

  /* Documents: filter by kind and by facet (field, reader, standard, format), and group by kind or by project.
     The facets are kept in the address (?field=cybersecurity), so a link can open the library filtered. */
  var chips = $$(".filters .chip"), cards = $$("#docs > li, [data-docs] > li"), kind = "all", grouping = "kind";
  var refine = $(".lib-refine"), FACETS = ["field", "audience", "standard", "format"], want = {};
  var rows = $$(".demo-rows > li");
  function fits(li) {
    return FACETS.every(function (k) { return !want[k] || (" " + (li.getAttribute("data-" + k) || "") + " ").indexOf(" " + want[k] + " ") >= 0; });
  }
  function showDocs() {
    var faceted = FACETS.some(function (k) { return want[k]; });
    cards.forEach(function (li) { li.hidden = !((kind === "all" || li.dataset.t === kind) && fits(li)); });
    rows.forEach(function (li) { li.hidden = !fits(li); });
    $$(".shelf").forEach(function (s) {
      var own = $$("[data-docs] > li", s), demo = $(".demo-rows", s), head = $(".demo-head", s);
      var demoOn = demo && (kind === "all" || s.dataset.kind === kind || !own.length) && $$("li", demo).some(function (li) { return !li.hidden; });
      if (demo) { demo.hidden = !demoOn; if (head) head.hidden = !demoOn; }
      var ownOn = own.some(function (li) { return !li.hidden; });
      s.hidden = !(ownOn || (demoOn && (kind === "all" || s.dataset.kind === kind)));
    });
    $$(".lib-group").forEach(function (g) { g.hidden = g.dataset.group !== grouping; });
    if (refine) {
      var group = $('.lib-group[data-group="' + grouping + '"]');
      var n = $$("[data-docs] > li", group).filter(function (li) { return !li.hidden; }).length + (grouping === "kind" ? $$(".demo-rows > li", group).filter(function (li) { return !li.hidden && !li.closest("[hidden]"); }).length : 0);
      $(".lib-n", refine).textContent = faceted ? (n === 1 ? "1 document" : n + " documents") : "";
      $("[data-refine-clear]", refine).hidden = !faceted;
    }
  }
  if (refine) {
    var q0 = new URLSearchParams(location.search);
    FACETS.forEach(function (k) {
      var s = $("select[name=" + k + "]", refine), v = q0.get(k) || "";
      if (v && [].some.call(s.options, function (o) { return o.value === v; })) { s.value = v; want[k] = v; }
      s.addEventListener("change", function () {
        want[k] = s.value;
        var q = new URLSearchParams(location.search);
        if (s.value) q.set(k, s.value); else q.delete(k);
        history.replaceState(null, "", location.pathname + (q.toString() ? "?" + q : "") + location.hash);
        showDocs();
      });
    });
    $("[data-refine-clear]", refine).addEventListener("click", function () {
      FACETS.forEach(function (k) { want[k] = ""; $("select[name=" + k + "]", refine).value = ""; });
      history.replaceState(null, "", location.pathname + location.hash);
      showDocs();
      $("select", refine).focus();
    });
    refine.hidden = false;
  }
  chips.forEach(function (c) {
    c.addEventListener("click", function () {
      kind = c.dataset.t;
      chips.forEach(function (o) { o.setAttribute("aria-pressed", o === c); });
      showDocs();
    });
  });
  $$(".lib-tabs [data-group]").forEach(function (b) {
    b.addEventListener("click", function () {
      grouping = b.dataset.group;
      $$(".lib-tabs [data-group]").forEach(function (o) { o.setAttribute("aria-selected", o === b); });
      try { localStorage.setItem("lib:group", grouping); } catch (e) {}
      showDocs();
    });
  });
  if ($(".lib-tabs")) { try { var g0 = localStorage.getItem("lib:group"); if (g0 === "project") { grouping = g0; $$(".lib-tabs [data-group]").forEach(function (o) { o.setAttribute("aria-selected", o.dataset.group === g0); }); } } catch (e) {} showDocs(); }
  /* A link to a shelf (/docs#kc1, from a document's breadcrumb) opens the grouping that holds it, then goes to it. */
  function toShelf() {
    var id = decodeURIComponent(location.hash.slice(1)), t = id && document.getElementById(id), g = t && t.closest(".lib-group");
    if (!g || g.dataset.group === grouping) return;
    grouping = g.dataset.group;
    $$(".lib-tabs [data-group]").forEach(function (o) { o.setAttribute("aria-selected", o.dataset.group === grouping); });
    showDocs();
    t.scrollIntoView({ block: "start" });
  }
  if ($(".lib-tabs")) { toShelf(); window.addEventListener("hashchange", toShelf); }

  /* Header: mark the section in view */
  var links = $$('.home .nav nav a[href^="#"]');
  if (links.length && "IntersectionObserver" in window) {
    var so = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (!e.isIntersecting) return;
        links.forEach(function (a) {
          if (a.getAttribute("href") === "#" + e.target.id) a.setAttribute("aria-current", "true");
          else a.removeAttribute("aria-current");
        });
        // The Projects menu stands for its section in the row of links.
        var pm = $(".nav .pm");
        if (pm) pm.classList.toggle("here", e.target.id === "projects");
      });
    }, { rootMargin: "-45% 0px -50% 0px" });
    links.forEach(function (a) { var s = $(a.getAttribute("href")); if (s) so.observe(s); });
  }

  /* Films: each one plays in place, from this site. */
  var theater = $("#theater");
  if (theater) theater.addEventListener("click", function (e) {
    var b = e.target.closest("[data-film]");
    if (!b) return;
    tourOff();
    var v = document.createElement("video"), title = $("b", b);
    v.controls = true;
    v.autoplay = true;
    v.playsInline = true;
    v.src = b.dataset.film;
    if (b.dataset.poster) v.poster = b.dataset.poster;
    // A narrated film's spoken words, as captions the viewer can turn on: its own titles are already drawn in the picture.
    if (b.dataset.captions) {
      var tr = document.createElement("track");
      tr.kind = "captions"; tr.srclang = "en"; tr.label = "English"; tr.src = b.dataset.captions;
      v.appendChild(tr);
    }
    v.setAttribute("aria-label", title ? title.textContent.trim() : "Film");
    var stage = $(".stage", theater);
    stage.innerHTML = "";
    stage.appendChild(v);
    $$(".reel button", theater).forEach(function (o) { o.setAttribute("aria-pressed", o.dataset.film === b.dataset.film); });
  });

  /* ---------- April ---------- */
  var panel = $("#april"), log = $("#log"), q = $("#q"), orb = $("#orb"), dock = $(".dock") || {}, sugg = $("#sugg"), speakBtn = $("#speak");
  var hist = [], opener = null, greeted = false, voiceOn = store("april-voice") !== "0";      // her voice is on until a visitor mutes it
  var ctx = null, node = null, meter = null, level = 0, turn = 0, tourOff = function () {}, tourSay = function () {};
  // While she thinks, her orb beats. While she speaks, it moves to the sound of her voice.
  function speaking(on, heard) {
    $$(".orb").forEach(function (o) { o.classList.toggle("talk", on && !heard); o.classList.toggle("live", !!(on && heard)); });
    var big = $(".orb-stage");
    if (big) { big.classList.toggle("speaking", on && !heard); big.classList.toggle("live", !!(on && heard)); }
    if (!on) document.documentElement.style.removeProperty("--lvl");
  }
  function listen(source) {
    if (reduce || !ctx.createAnalyser) { source.connect(ctx.destination); return false; }
    if (!meter) {
      meter = ctx.createAnalyser();
      meter.fftSize = 256;
      meter.connect(ctx.destination);
    }
    source.connect(meter);
    var wave = new Uint8Array(meter.fftSize);
    (function tick() {
      if (node !== source) return;
      meter.getByteTimeDomainData(wave);
      for (var i = 0, sum = 0; i < wave.length; i++) { var v = (wave[i] - 128) / 128; sum += v * v; }
      level += (Math.min(1, Math.sqrt(sum / wave.length) * 4.5) - level) * 0.4;
      document.documentElement.style.setProperty("--lvl", level.toFixed(3));
      requestAnimationFrame(tick);
    })();
    return true;
  }
  function unlock() {
    session();
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctx = ctx || new AC();
      if (ctx.state === "suspended") ctx.resume();
    } catch (e) {}
  }
  /* An iPhone with its ring switch set to silent plays no sound from a page, unless the page says that the sound is
     speech or music. The page says so while her voice is on, and takes it back when she is muted or the microphone
     listens. Only Safari has this setting. */
  function session(type) {
    try { if (navigator.audioSession) navigator.audioSession.type = type || (voiceOn ? "playback" : "auto"); } catch (e) {}
  }
  // A browser lets a page make sound only after a click or a key press. This waits a moment for that permission.
  function awake() {
    return new Promise(function (ok) {
      var tries = 0;
      (function look() {
        if (ctx && ctx.state === "running") return ok(true);
        if (++tries > 8) return ok(false);
        setTimeout(look, 100);
      })();
    });
  }
  function hush() {
    turn++;
    try { if (node) { node.onended = null; node.stop(); } } catch (e) {}
    node = null;
    speaking(false);
  }
  function playBytes(buf, done, still) {
    return new Promise(function (ok, no) {
      if (!ctx) return no();
      ctx.decodeAudioData(buf, function (audio) {
        if (still && !still()) return ok();   // something newer started while this clip was being decoded
        hush();
        var source = node = ctx.createBufferSource();
        source.buffer = audio;
        var heard = listen(source);
        source.onended = function () { if (node === source) { node = null; speaking(false); } if (done) done(); };
        source.start();
        speaking(true, heard);
        ok();
      }, no);
    });
  }
  function bytes(b64) {
    var bin = atob(b64), a = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i);
    return a.buffer;
  }
  /* Her fixed lines are recordings kept with the site. A line that has no recording yet is asked of her service.
     She has one voice. When it can't be had, her words stay on the screen and nothing else speaks for her. */
  var CLIPS = read("voice", {});
  function clipUrl(name) { return CLIPS[name] ? "/voice/" + LANG + "/" + CLIPS[name] : "/api/april?say=" + name + "&lang=" + LANG + "&v=8"; }
  function line(name) {
    var mine = turn, still = function () { return voiceOn && mine === turn; };
    Promise.all([fetch(clipUrl(name)).then(function (r) { if (!r.ok) throw 0; return r.arrayBuffer(); }), awake()])
      // She doesn't start a line after a visitor has asked something, muted her, or closed her panel.
      .then(function (got) { if (got[1] && still()) return playBytes(got[0], null, still); })
      .catch(function () {});
  }
  function say(audio) {
    if (voiceOn && audio) playBytes(bytes(audio)).catch(function () { speaking(false); });
    else speaking(false);
  }
  // Every control that mutes her shows the same state: the button in her panel, and the one in the tour's bar.
  var voiceButtons = [];
  function setVoice(on) {
    voiceOn = on;
    store("april-voice", on ? "1" : "0");
    voiceButtons.forEach(function (b) {
      var label = on ? I.voiceIsOn : I.voiceIsOff, text = $("span", b);
      b.setAttribute("aria-pressed", on);
      if (text) text.textContent = label; else b.setAttribute("aria-label", label);
    });
    if (!on) hush();
    session();
  }
  /* What the library says about a question: the three sections that match it best. They go with the question,
     so that she can answer from the documents themselves and link to the section she used. */
  var LIB = null, SKIP = /^(the|and|for|with|what|which|where|when|does|how|are|can|you|his|her|about|tell|show|explain|karan|deshmukh|this|that|from|have|has|who|why|did|was|will|would|should|could|there|their|into|more|most|some|any|all|use|used|using|him|she|they|them|its|our|your|please|give|find|say|says|mean|means|document|documents|docs|library|site|page|work|write|writes|written|read|open|handle|deal|cover|include|contain|provide|need|want|help|happen|look|see|know|list|define|different|difference|between|like|kind|thing|way|part|much|many|long|really|just|also|then|than|been|being|were|here|make|made|take|get|got|doe|thi|one|two|three|sentence|word|short|brief|briefly|simple|simply|plain|quick|quickly|line|paragraph|meaning|definition|stand|stands|term|exactly|actually|basically|summary|summarize|summarise|overview|detail)$/;
  // The names of the projects, as words. A question about a project as a whole is answered from her notes, which describe each one.
  var NAMES = {};
  $$(".pm-menu b").forEach(function (b) { (b.textContent.toLowerCase().match(/[a-z0-9]{3,}/g) || []).forEach(function (w) { NAMES[w] = 1; }); });
  function passages(question) {
    LIB = LIB || fetch("/search.json").then(function (r) { if (!r.ok) throw 0; return r.json(); }).then(function (docs) {
      // Every section once, with the words it can be found by: its title, its document, and its project.
      var all = [];
      docs.forEach(function (d) {
        if (/demonstration scenario|fictional|simulated/i.test(d.k || "")) return;       // the studio's simulated scenarios are not sources about Karan's work
        (d.s || []).forEach(function (sec) { all.push({ d: d, sec: sec, glossary: /glossary/i.test(d.t + " " + d.u), title: (d.t + " " + (d.p || "") + " " + sec[1]).toLowerCase(), text: String(sec[2] || "").toLowerCase() }); });
      });
      return all;
    });
    return LIB.then(function (all) {
      // The words that say what the question is about. A technical name keeps its marks: c/n0, v2.4, api_app.py.
      var terms = (question.toLowerCase().match(/[a-z0-9][a-z0-9/._-]{2,}/g) || [])
        .map(function (w) { w = w.replace(/[/._-]+$/, ""); return w.length > 4 ? w.replace(/s$/, "") : w; })
        .filter(function (w, i, list) { return w.length > 2 && !SKIP.test(w) && list.indexOf(w) === i; });
      // A question that names only a project ("what does TrustNav do?") is about the project as a whole.
      if (terms.every(function (w) { return w.split("-").every(function (part) { return part.length < 3 || NAMES[part]; }); })) return [];
      // A question that asks what something is, or what it means, is answered best by a glossary.
      var define = /^\s*(what|who)('s|\s+is|\s+are|\s+was)\b|\b(means?|meaning|stands? for|define|definition)\b/i.test(question);
      // A word that few sections hold says more about a question than a word that most of them hold.
      var weight = {}, known = 0;
      terms.forEach(function (w) {
        var held = all.filter(function (x) { return x.title.indexOf(w) > -1 || x.text.indexOf(w) > -1; }).length;
        weight[w] = held ? Math.log(1 + all.length / held) : 0;
        known += weight[w];
      });
      if (!known) return [];
      var found = [], usual = all.reduce(function (sum, x) { return sum + x.text.length; }, 0) / all.length;
      all.forEach(function (x) {
        var score = 0;
        terms.forEach(function (w) {
          if (!weight[w]) return;
          if (x.title.indexOf(w) > -1) score += weight[w] * 1.5;
          // A section that comes back to a word says more about it than one that mentions it in passing, and a short
          // section that holds the word says more than a long one (the usual measure for this is called BM25).
          var times = x.text.split(w).length - 1;
          if (times) score += weight[w] * times * 2.2 / (times + 1.2 * (0.25 + 0.75 * x.text.length / usual));
        });
        if (define && x.glossary) score *= 2.5;
        if (score) found.push({ x: x, score: score / known });
      });
      found.sort(function (m, n) { return n.score - m.score; });
      // Only a section that holds most of what the question asks about is sent, and a second one only when it is
      // nearly as good as the first: a weak match would lead her astray.
      var top = found.length ? found[0].score : 0;
      return found.filter(function (f) { return f.score >= 0.6 && f.score >= top * 0.7; }).slice(0, 2).map(function (f) {
        var text = String(f.x.sec[2] || ""), low = f.x.text, starts = [0], from = 0, best = -1;
        // The passage is the stretch of the section that holds the most of the question, with its words near the start.
        // It begins at the start of a sentence, and in a glossary at the entry itself.
        terms.forEach(function (w) {
          for (var at = low.indexOf(w), n = 0; at > -1 && n < 12; at = low.indexOf(w, at + 1), n++) {
            if (f.x.glossary) { starts.push(at); continue; }
            var before = low.slice(Math.max(0, at - 240), at), ends = before.match(/[.?!#:]\s+(?=\S)/g), cut = ends ? before.lastIndexOf(ends[ends.length - 1]) + ends[ends.length - 1].length : -1;
            starts.push(at < 240 ? 0 : cut > -1 ? at - before.length + cut : at - 120 + (low.slice(at - 120, at).indexOf(" ") + 1));
          }
        });
        starts.forEach(function (start) {
          var part = low.slice(start, start + 620), value = 0;
          // A word counts for more the nearer it is to the start. In a glossary, the word that opens an entry counts double.
          terms.forEach(function (w) {
            var at = part.indexOf(w);
            if (at > -1) value += weight[w] * (f.x.glossary ? (at < 40 ? 2 : 1) : 1.5 - 0.5 * at / 620);
          });
          if (value > best + 1e-9) { best = value; from = start; }
        });
        return { t: f.x.d.t, s: f.x.sec[1], u: f.x.d.u + (f.x.sec[0] ? "#" + f.x.sec[0] : ""), x: (from ? "…" : "") + text.slice(from, from + 620), k: true };
      });
    }).catch(function () { LIB = null; return []; });
  }

  if (panel) (function () {
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
    // What she offers under an answer: a document, the CV, a way to reach Karan, another language.
    function offer(bubble, label, href, how) {
      var a = document.createElement("a");
      a.className = "act";
      a.textContent = label;
      a.href = href;
      if (how === "new") { a.target = "_blank"; a.rel = "noopener"; }
      if (how === "save") a.setAttribute("download", "");
      bubble.appendChild(a);
      log.scrollTop = log.scrollHeight;
    }
    // What she does herself, on the home page: go to a section, play a video, run the desk, start her tour.
    function act(a, bubble, answer) {
      if (a.type === "doc") return offer(bubble, String(I.actOpen).replace("{t}", a.title), a.href);
      if (a.type === "cv") return offer(bubble, I.actCv, a.href, "save");
      if (a.type === "linkedin") return offer(bubble, I.actLinkedin, a.href, "new");
      if (a.type === "lang") return offer(bubble, a.name, a.href);
      var to = a.type === "go" ? a.to : a.type === "video" ? "video" : a.type === "desk" ? "rewrite" : "top", el = document.getElementById(to);
      if (!body.classList.contains("home") || !el) return offer(bubble, I.actGo, (LANG === "en" ? "/" : "/" + LANG) + "#" + to);
      if (a.type === "tour") { var start = $("[data-tour]"); if (start) setTimeout(function () { start.click(); }, 1100); return; }
      // On a phone her panel covers the page, so it steps aside and her answer follows in the bar at the bottom.
      if (innerWidth < 720) { closePanel(true); tourSay(answer); }
      window.scrollTo({ top: el.getBoundingClientRect().top + window.pageYOffset - 76, behavior: reduce ? "auto" : "smooth" });
      setTimeout(function () {
        if (a.type === "video") {
          var want = String(a.match || "").toLowerCase().split(/\s+/).filter(function (w) { return w.length > 2; }), best = null, most = 0;
          $$("#theater .reel button").forEach(function (b) {
            var title = b.textContent.toLowerCase(), hits = want.filter(function (w) { return title.indexOf(w) > -1; }).length;
            if (hits > most) { most = hits; best = b; }
          });
          (best || $("#theater .yt") || { click: function () {} }).click();
        }
        if (a.type === "desk") { var chip = $('#try [data-sample="' + a.sample + '"]'); if (chip) chip.click(); }
      }, reduce ? 50 : 900);
    }
    function offline(text) {
      var s = text.toLowerCase(), i;
      for (i = 0; i < FAQ.length; i++) if (FAQ[i].q.toLowerCase() === s) return FAQ[i].a;
      for (i = 0; i < FAQ.length; i++) if (new RegExp(FAQ[i].keys).test(s)) return FAQ[i].a;
      return I.offline + " " + body.dataset.linkedin;
    }
    var asked = {}, chipFor = {};
    // The chat is kept for this tab, so it is still there after a visit to a document she offered.
    function keep() {
      try {
        var last = $$(".msg", log).filter(function (m) { return !m.classList.contains("wait"); }).slice(-40);
        sessionStorage.setItem("april-chat", JSON.stringify({ log: last.map(function (m) { return m.outerHTML; }).join(""), hist: hist, asked: asked }));
      } catch (e) {}
    }
    function restore() {
      try {
        var was = JSON.parse(sessionStorage.getItem("april-chat") || "null");
        if (!was || !was.log) return false;
        log.innerHTML = was.log;
        hist = Array.isArray(was.hist) ? was.hist : [];
        asked = was.asked || {};
        return true;
      } catch (e) { return false; }
    }
    // Her greeting. She says it aloud once in a visit, when her panel first opens and her voice is on.
    function greet(aloud) {
      add("a", esc(I.hello));
      if (!aloud || !voiceOn) return;
      try { if (sessionStorage.getItem("april-hello")) return; sessionStorage.setItem("april-hello", "1"); } catch (e) {}
      line("hello");
    }
    // The suggested questions stay under the chat. After an answer, the ones on its subject come first and the ones already asked go last.
    function order(text, answer) {
      var both = ((text || "") + " " + (answer || "")).toLowerCase().trim();
      FAQ.map(function (f, i) { return { f: f, i: i, rank: asked[f.q] ? 2 : both && new RegExp(f.keys).test(both) ? 0 : 1 }; })
        .sort(function (a, b) { return a.rank - b.rank || a.i - b.i; })
        .forEach(function (x) { var b = chipFor[x.f.q]; if (b) { b.classList.toggle("asked", !!asked[x.f.q]); sugg.appendChild(b); } });
      sugg.scrollLeft = 0;
    }
    // Her words, then what the answer carries: a button, and the sections of the library it rests on.
    function finish(w, text, d) {
      speaking(false);
      w.className = "msg a";
      w.innerHTML = rich(d.answer);
      hist.push({ role: "user", content: text }, { role: "assistant", content: d.answer });
      hist = hist.slice(-6);
      if (d.action) act(d.action, w, d.answer);
      if (d.sources && d.sources.length) {
        var src = document.createElement("p");
        src.className = "src";
        src.innerHTML = "<span>" + esc(I.sources) + "</span>" + d.sources.map(function (x) { return '<a href="' + esc(x.href) + '">' + esc(x.title) + "</a>"; }).join("");
        w.appendChild(src);
      }
      order(text, d.answer);
      log.scrollTop = log.scrollHeight;
      keep();
    }
    // A reply comes as lines: her words on the first, shown at once, and her voice on the second when it is ready.
    function lines(r, each) {
      function feed(text) { text.split("\n").forEach(function (l) { if (l.trim()) { try { each(JSON.parse(l)); } catch (e) {} } }); }
      if (!r.body || !r.body.getReader || !window.TextDecoder) return r.text().then(feed);
      var reader = r.body.getReader(), dec = new TextDecoder(), rest = "";
      return (function pump() {
        return reader.read().then(function (x) {
          if (x.value) rest += dec.decode(x.value, { stream: true });
          var cut = rest.lastIndexOf("\n");
          if (cut > -1) { feed(rest.slice(0, cut)); rest = rest.slice(cut + 1); }
          if (!x.done) return pump();
          if (rest.trim()) feed(rest);
        });
      })();
    }
    function ask(text) {
      text = String(text || "").trim();
      if (!text) return;
      hush();
      // Her voice for this answer arrives a few seconds after her words. It is played only if nothing newer has
      // happened by then: another question, her tour, a click on mute, or her panel closed.
      var mine = turn;
      add("u", esc(text));
      asked[text] = 1;
      var w = add("a wait", esc(I.thinking)), done = false, spoke = false, silent = false;
      speaking(true);
      function fail() { if (!done) { done = true; finish(w, text, { answer: offline(text) }); } }
      function over() { if (!spoke && mine === turn) speaking(false); fail(); }
      // A question about Karan or about her is answered from her notes. A question about what a document says takes passages with it.
      var personal = /\b(he|his|him|karan|karan's|you|your|yourself|april)\b/i.test(text) || FAQ.some(function (f) { return f.q.toLowerCase() === text.toLowerCase(); });
      Promise.race([personal ? [] : passages(text), new Promise(function (ok) { setTimeout(function () { ok([]); }, 900); })]).then(function (found) {
        return fetch("/api/april", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ q: text, history: hist, lang: LANG, voice: voiceOn, context: found, stream: true }) });
      }).then(function (r) {
        if (!r.ok) throw 0;
        return lines(r, function (d) {
          if (d.answer && !done) {
            done = true;
            finish(w, text, d);
            // Her tour starts with her own recorded line, so the answer that starts it is not spoken.
            silent = !!(d.action && d.action.type === "tour");
            // Until her voice starts, her orb keeps beating: it is on its way.
            if (voiceOn && !silent && mine === turn) speaking(true);
          }
          if (d.audio && done && !silent && mine === turn) { spoke = true; say(d.audio); }
        });
      }).then(over, over);
    }
    function fresh() {
      hush();
      log.innerHTML = "";
      hist = [];
      asked = {};
      try { sessionStorage.removeItem("april-chat"); } catch (e) {}
      greet();
      order();
      q.focus();
    }
    function openPanel(pre) {
      tourOff();
      if (panel.hidden) opener = document.activeElement;
      panel.hidden = false;
      dock.hidden = true;
      unlock();
      if (!greeted) {
        greeted = true;
        if (restore()) { $$(".msg.wait", log).forEach(function (m) { m.remove(); }); order(); log.scrollTop = log.scrollHeight; }
        else greet(!pre);
      }
      if (pre) ask(pre); else q.focus();
    }
    function closePanel(keepVoice) {
      panel.hidden = true;
      dock.hidden = false;
      if (keepVoice !== true) hush();
      if (opener && opener.focus) opener.focus({ preventScroll: true });
    }
    window.askApril = openPanel;
    // A link to #april opens her, from any page that has her.
    if (location.hash === "#april") setTimeout(function () { openPanel(); }, 0);
    $$("[data-april]").forEach(function (b) { b.addEventListener("click", function () { openPanel(b.dataset.ask || ""); }); });
    $("#april-x").addEventListener("click", function () { closePanel(); });
    addEventListener("keydown", function (e) { if (e.key === "Escape" && !panel.hidden && (!$("#pal") || $("#pal").hidden)) closePanel(); });
    $("#ask").addEventListener("submit", function (e) { e.preventDefault(); unlock(); var t = q.value; q.value = ""; ask(t); });
    FAQ.forEach(function (f) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "chip sm";
      b.textContent = f.q;
      b.addEventListener("click", function () { unlock(); ask(f.q); });
      sugg.appendChild(b);
      chipFor[f.q] = b;
    });
    $("#april-new").addEventListener("click", fresh);
    voiceButtons.push(speakBtn);
    setVoice(voiceOn);
    speakBtn.addEventListener("click", function () {
      unlock();
      setVoice(!voiceOn);
      add("note", esc(voiceOn ? I.voiceOn : I.voiceOff));
      // What a visitor hears first is her own voice, saying that it is on.
      if (voiceOn) line("voiceon");
      keep();
    });
    var SR = window.SpeechRecognition || window.webkitSpeechRecognition, mic = $("#mic");
    if (SR) {
      mic.hidden = false;
      mic.addEventListener("click", function () {
        unlock();
        var r = new SR();
        r.lang = { en: "en-US", fr: "fr-FR", de: "de-DE", es: "es-ES", hi: "hi-IN" }[LANG] || "en-US";
        mic.classList.add("on");
        hush();
        session("auto");               // while the microphone listens, the browser chooses how sound is handled
        r.onresult = function (e) { ask(e.results[0][0].transcript); };
        r.onend = r.onerror = function () { mic.classList.remove("on"); session(); };
        r.start();
      });
    }
  })();

  /* ---------- The tour: April walks the page and says one line at each stop ---------- */
  var tour = $("#tour");
  if (tour && I.tour1) (function () {
    var stops = tour.dataset.stops.split(","), cap = $("#tour-say"), count = $("#tour-n"), fill = $(".tour-bar b", tour), pauseBtn = $("#tour-pause");
    var at = -1, run = 0, paused = false, wait = 0, clips = {}, from = null;
    // Each line is a recording. A line that fails is asked for again the next time it is wanted.
    function clip(i) {
      if (!clips[i]) clips[i] = fetch(clipUrl("tour" + (i + 1))).then(function (r) { if (!r.ok) throw 0; return r.arrayBuffer(); }).catch(function (e) { clips[i] = null; throw e; });
      return clips[i];
    }
    function go(i) {
      var mine = ++run;
      clearTimeout(wait);
      hush();
      if (i >= stops.length) return end();
      var text = I["tour" + (i + 1)], el = document.getElementById(stops[i]);
      at = i;
      paused = false;
      tour.classList.remove("paused");
      pauseBtn.setAttribute("aria-label", I.tourPause);
      cap.removeAttribute("aria-live");
      cap.textContent = text;
      count.textContent = (i + 1) + " / " + stops.length;
      fill.style.width = ((i + 1) / stops.length) * 100 + "%";
      window.scrollTo({ top: i && el ? el.getBoundingClientRect().top + window.pageYOffset - 76 : 0, behavior: reduce ? "auto" : "smooth" });
      function next() {
        if (mine !== run) return;
        clearTimeout(wait);
        wait = setTimeout(function () { if (mine === run) go(i + 1); }, 700);
      }
      // No voice, because she is muted or the recording can't be had: the caption stands for the time it takes to read it.
      function quiet() {
        if (mine !== run) return;
        cap.setAttribute("aria-live", "polite");
        cap.textContent = text;
        clearTimeout(wait);
        wait = setTimeout(next, 1500 + text.length * 50);
      }
      if (!voiceOn) return quiet();
      clip(i).then(function (buf) { if (mine === run) return playBytes(buf.slice(0), next, function () { return mine === run; }); }).catch(quiet);
      if (i + 1 < stops.length) clip(i + 1).catch(function () {});
    }
    function pause() {
      if (at < 0 || paused) return;
      run++;
      paused = true;
      clearTimeout(wait);
      hush();
      tour.classList.add("paused");
      pauseBtn.setAttribute("aria-label", I.tourResume);
    }
    function end() {
      if (at < 0) return;
      var inside = tour.contains(document.activeElement);
      run++;
      at = -1;
      paused = false;
      clearTimeout(wait);
      hush();
      tour.hidden = true;
      if (dock && panel && panel.hidden) dock.hidden = false;
      if (inside && from && from.focus) from.focus({ preventScroll: true });
    }
    tourOff = end;
    // One line of hers in the bar, outside a tour: her answer, while the page moves to what she is showing.
    function hide() { tour.classList.remove("solo"); tour.hidden = true; if (dock && panel && panel.hidden) dock.hidden = false; }
    tourSay = function (text) {
      if (at >= 0 || !text) return;
      clearTimeout(wait);
      tour.classList.add("solo");
      tour.hidden = false;
      if (dock) dock.hidden = true;
      cap.setAttribute("aria-live", "polite");
      cap.textContent = text;
      wait = setTimeout(hide, 3200 + text.length * 75);
    };
    $$("[data-tour]").forEach(function (b) {
      b.addEventListener("click", function () {
        if (panel && !panel.hidden) $("#april-x").click();
        from = b;
        unlock();
        tour.classList.remove("solo");
        tour.hidden = false;
        if (dock) dock.hidden = true;
        at = 0;
        go(0);
        pauseBtn.focus({ preventScroll: true });
      });
    });
    pauseBtn.addEventListener("click", function () { if (paused) { unlock(); go(at); } else pause(); });
    var mute = $("#tour-voice");
    if (mute) {
      voiceButtons.push(mute);
      setVoice(voiceOn);
      // The stop she is at starts again, with her voice or without it.
      mute.addEventListener("click", function () { unlock(); setVoice(!voiceOn); if (at >= 0 && !paused) go(at); });
    }
    $("#tour-next").addEventListener("click", function () { unlock(); go(at + 1); });
    $("#tour-x").addEventListener("click", function () { if (tour.classList.contains("solo")) { clearTimeout(wait); hush(); hide(); } else end(); });
    // A visitor who scrolls away takes over: the tour waits until they resume it.
    function took(e) { if (at >= 0 && !paused && !tour.contains(e.target)) pause(); }
    addEventListener("wheel", took, { passive: true });
    addEventListener("touchmove", took, { passive: true });
    addEventListener("keydown", function (e) {
      if (at < 0) return;
      if (e.key === "Escape" && (!$("#pal") || $("#pal").hidden)) end();
      else if (/^(ArrowUp|ArrowDown|PageUp|PageDown|Home|End| )$/.test(e.key) && !tour.contains(document.activeElement)) pause();
    });
  })();

  /* ---------- Search ---------- */
  var pal = $("#pal");
  if (pal) (function () {
    var input = $("#pal-q"), list = $("#pal-list"), INDEX = null, sel = 0, from = null;
    function mark(text, terms) {
      var out = esc(text);
      terms.forEach(function (t) {
        if (t.length < 2 || /^(amp|lt|gt|quot)$/.test(t)) return;
        out = out.replace(new RegExp("(" + t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ")", "ig"), "<mark>$1</mark>");
      });
      return out;
    }
    function snip(text, term) {
      var i = text.toLowerCase().indexOf(term), a = Math.max(0, i - 50);
      return (a ? "…" : "") + text.slice(a, a + 140);
    }
    function draw() {
      var query = input.value.trim(), terms = query.toLowerCase().split(/\s+/).filter(Boolean), items = [];
      if (!INDEX) { list.innerHTML = '<li class="pal-empty">' + esc(I.thinking) + "</li>"; return; }
      if (!terms.length) items = INDEX.map(function (d) { return { u: d.u, t: d.t, k: d.k, x: d.p }; });
      else {
        INDEX.forEach(function (d) {
          var title = d.t.toLowerCase(), inTitle = terms.every(function (t) { return title.indexOf(t) > -1; });
          if (inTitle) items.push({ u: d.u, t: d.t, k: d.k, x: d.p, sc: 20 });
          d.s.forEach(function (s) {
            var head = s[1].toLowerCase(), text = s[2].toLowerCase();
            if (!s[1] && inTitle) return;
            if (!terms.every(function (t) { return head.indexOf(t) > -1 || text.indexOf(t) > -1; })) return;
            var inHead = terms.every(function (t) { return head.indexOf(t) > -1; });
            items.push({ u: d.u + (s[0] ? "#" + s[0] : ""), t: s[1] || d.t, k: s[1] ? d.t : d.k, x: snip(s[2], terms[0]), sc: (inHead ? 10 : 3) + (inTitle ? 2 : 0) });
          });
        });
        items.sort(function (a, b) { return b.sc - a.sc; });
        items = items.slice(0, 14);
      }
      var html = items.length ? '<li class="pal-group" role="presentation">' + esc(I.palDocs) + "</li>" : "";
      html += items.map(function (it) {
        return '<li role="option"><a href="' + esc(it.u) + '"><b>' + mark(it.t, terms) + "</b><em>" + esc(it.k) + "</em><small>" + mark(it.x, terms) + "</small></a></li>";
      }).join("");
      if (query) html += '<li role="option"><a href="#" data-ask-april><b>' + esc(I.palAsk) + ": " + esc(query) + "</b><em></em><small>" + esc(items.length ? "" : I.palNone) + "</small></a></li>";
      else html += '<li class="pal-empty">' + esc(I.palHint) + "</li>";
      list.innerHTML = html;
      sel = 0;
      pick();
    }
    function options() { return $$('li[role="option"]', list); }
    function pick() {
      options().forEach(function (li, i) {
        li.setAttribute("aria-selected", i === sel);
        if (i === sel) li.scrollIntoView({ block: "nearest" });
      });
    }
    function go(a) {
      if (a.hasAttribute("data-ask-april")) { var text = input.value.trim(); shut(); if (window.askApril) window.askApril(text); }
      else location.href = a.getAttribute("href");
    }
    function open() {
      from = document.activeElement;
      pal.hidden = false;
      input.value = "";
      input.focus();
      if (!INDEX) fetch("/search.json").then(function (r) { return r.json(); }).then(function (d) { INDEX = d; draw(); }).catch(function () { INDEX = []; draw(); });
      draw();
    }
    function shut() { pal.hidden = true; if (from && from.focus) from.focus(); }
    $$("[data-search]").forEach(function (b) { b.addEventListener("click", open); });
    input.addEventListener("input", draw);
    input.addEventListener("keydown", function (e) {
      var n = options().length;
      if (e.key === "ArrowDown") { e.preventDefault(); sel = (sel + 1) % Math.max(1, n); pick(); }
      else if (e.key === "ArrowUp") { e.preventDefault(); sel = (sel - 1 + n) % Math.max(1, n); pick(); }
      else if (e.key === "Enter") { e.preventDefault(); var li = options()[sel]; if (li) go($("a", li)); }
    });
    list.addEventListener("click", function (e) {
      var a = e.target.closest("a");
      if (a && a.hasAttribute("data-ask-april")) { e.preventDefault(); go(a); }
      else if (a) shut();
    });
    pal.addEventListener("click", function (e) { if (e.target === pal) shut(); });
    addEventListener("keydown", function (e) {
      var typing = /^(input|textarea|select)$/i.test((e.target.tagName || "")) || e.target.isContentEditable;
      if (e.key === "Escape" && !pal.hidden) { e.preventDefault(); shut(); }
      else if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) { e.preventDefault(); pal.hidden ? open() : shut(); }
      else if (e.key === "/" && !typing && !e.metaKey && !e.ctrlKey && !e.altKey && pal.hidden) { e.preventDefault(); open(); }
    });
  })();

  /* ---------- Wide tables ---------- */
  /* A table wider than its column scrolls sideways. Then it takes the keyboard focus, so the arrow keys can scroll it,
     and it is announced as a region named after the section it is in. */
  var tbls = $$(".tbl");
  var wide = function (t) {
    var on = t.scrollWidth > t.clientWidth + 1;
    if (on === (t.getAttribute("role") === "region")) return;
    if (on) {
      // Named after its section; numbered when the section has more than one table.
      var h = t.previousElementSibling, n = 1, s = t.nextElementSibling, more = false;
      while (h && !/^H[2-4]$/.test(h.tagName)) { if (h.classList.contains("tbl")) n++; h = h.previousElementSibling; }
      while (s && !/^H[2-4]$/.test(s.tagName)) { if (s.classList.contains("tbl")) more = true; s = s.nextElementSibling; }
      t.setAttribute("role", "region");
      t.setAttribute("aria-label", (n > 1 || more ? "Table " + n : "Table") + (h ? ": " + h.textContent.replace(/#\s*$/, "").trim() : ""));
      t.tabIndex = 0;
    } else {
      t.removeAttribute("role"); t.removeAttribute("aria-label"); t.removeAttribute("tabindex");
    }
  };
  tbls.forEach(wide);
  if (tbls.length && "ResizeObserver" in window) {
    // The frame and the table inside it: a table grows without its frame changing size when the fonts arrive.
    var tro = new ResizeObserver(function (es) { es.forEach(function (e) { wide(e.target.closest(".tbl")); }); });
    tbls.forEach(function (t) { tro.observe(t); if (t.firstElementChild) tro.observe(t.firstElementChild); });
  }

  /* ---------- Library pages ---------- */
  var article = $(".article");
  if (article) {
    var bar = $(".progress i");
    if (bar) {
      var onRead = function () {
        var max = document.documentElement.scrollHeight - innerHeight;
        bar.style.width = (max > 0 ? Math.min(100, (scrollY / max) * 100) : 0) + "%";
      };
      onRead();
      addEventListener("scroll", onRead, { passive: true });
    }
    $$("pre.code", article).forEach(function (pre) {
      if (!navigator.clipboard) return;
      var b = document.createElement("button");
      b.type = "button";
      b.className = "copy";
      b.textContent = I.copy || "Copy";
      b.addEventListener("click", function () {
        navigator.clipboard.writeText($("code", pre).innerText).then(function () {
          b.textContent = I.copied || "Copied";
          setTimeout(function () { b.textContent = I.copy || "Copy"; }, 1600);
        });
      });
      pre.appendChild(b);
    });
    /* A screenshot or a diagram opens over the page; with a modifier key a link behaves as usual. */
    var enlarge = function (from, content, label) {
      var box = document.createElement("div");
      box.className = "lb";
      box.setAttribute("role", "dialog");
      box.setAttribute("aria-label", label);
      box.tabIndex = -1;
      box.appendChild(content);
      function close() { box.remove(); removeEventListener("keydown", key); from.focus(); }
      function key(ev) { if (ev.key === "Escape") close(); }
      box.addEventListener("click", close);
      addEventListener("keydown", key);
      document.body.appendChild(box);
      box.focus();
    };
    article.addEventListener("click", function (e) {
      var a = e.target.closest("a.fig"), d = e.target.closest(".diagram");
      if (a && !(e.metaKey || e.ctrlKey || e.shiftKey || e.button)) {
        e.preventDefault();
        var img = document.createElement("img"), alt = ($("img", a) || {}).alt || "";
        img.src = a.href;
        img.alt = alt;
        enlarge(a, img, alt || "Image");
      } else if (d && $("svg", d)) {
        var copy = $("svg", d).cloneNode(true);
        copy.removeAttribute("style");
        enlarge($(".diagram-open", d) || d, copy, "Diagram");
      }
    });
    $$(".doc-print", article).forEach(function (b) { b.hidden = false; b.addEventListener("click", function () { window.print(); }); });
    $$("[data-pdf]", article).forEach(function (b) {
      if (innerWidth < 880) return;
      b.hidden = false;
      b.addEventListener("click", function () {
        var f = document.createElement("iframe");
        f.className = "pdfview";
        f.title = document.title;
        f.src = b.dataset.pdf + "#view=FitH";
        var cover = $(".cover", article);
        if (cover) cover.replaceWith(f); else article.appendChild(f);
        b.hidden = true;
      });
    });
    var here = $$('.toc a[href^="#"]');
    if (here.length && "IntersectionObserver" in window) {
      var ho = new IntersectionObserver(function (es) {
        es.forEach(function (e) {
          if (!e.isIntersecting) return;
          here.forEach(function (a) { a.classList.toggle("on", a.getAttribute("href") === "#" + e.target.id); });
        });
      }, { rootMargin: "-18% 0px -72% 0px" });
      $$("h2[id]", article).forEach(function (h) { ho.observe(h); });
    }
  }
  /* On a phone the list of pages is one scrolling row: bring the current page into view. */
  var current = $(".toc [aria-current]");
  if (current) current.parentNode.scrollLeft += current.getBoundingClientRect().left - current.parentNode.getBoundingClientRect().left - 24;

  /* ---------- The Projects menu: it closes on a click outside it, on Escape, and when one of its links is chosen ---------- */
  var pmenu = $(".nav .pm");
  if (pmenu) {
    addEventListener("click", function (e) { if (pmenu.open && (!pmenu.contains(e.target) || e.target.closest(".pm-menu a"))) pmenu.open = false; });
    addEventListener("keydown", function (e) { if (e.key === "Escape" && pmenu.open) { pmenu.open = false; $("summary", pmenu).focus(); } });
  }

  /* ---------- Languages ---------- */
  var menu = $(".lang");
  if (menu) {
    addEventListener("click", function (e) { if (menu.open && !menu.contains(e.target)) menu.open = false; });
    addEventListener("keydown", function (e) { if (e.key === "Escape" && menu.open) { menu.open = false; $("summary", menu).focus(); } });
  }
  var offers = read("locales", []);
  if (offers.length && LANG === "en" && store("lang-offer") !== "no") {
    var wants = (navigator.languages || [navigator.language || ""]).map(function (l) { return String(l).slice(0, 2).toLowerCase(); });
    var first = wants[0], match = offers.filter(function (o) { return o.code === first; })[0];
    if (match) {
      var bar2 = document.createElement("div");
      bar2.className = "offer";
      bar2.lang = match.code;
      bar2.innerHTML = "<span>" + esc(match.offer) + '</span><a class="btn paper sm" href="' + esc(match.path) + '">' + esc(match.go) + '</a><button class="x" type="button" aria-label="' + esc(I.close || "Close") + '">&times;</button>';
      $(".x", bar2).addEventListener("click", function () { store("lang-offer", "no"); bar2.remove(); });
      document.body.appendChild(bar2);
    }
  }
})();
