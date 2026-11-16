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

  /* Hero: the engineer's message versus the published procedure */
  var frame = $(".cmp-frame");
  if (frame) (function () {
    var range = $(".cmp-range"), tabs = $$(".cmp-tabs button"), raf = 0, touched = false;
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
    tabs.forEach(function (b) { b.addEventListener("click", function () { touched = true; glide(+b.dataset.x, 650); }); });
    if (reduce || !("IntersectionObserver" in window)) setX(0);
    else {
      setX(100);
      var io = new IntersectionObserver(function (es) {
        if (!es[0].isIntersecting) return;
        io.disconnect();
        setTimeout(function () { if (!touched) glide(0, 1500); }, 1500);
      }, { threshold: 0.4 });
      io.observe(frame);
    }
  })();

  /* Key figures count up when they come into view */
  if (!reduce && "IntersectionObserver" in window) $$("[data-count]").forEach(function (el) {
    var m = /^(\d+)(.*)$/.exec(el.textContent.trim());
    if (!m) return;
    var to = +m[1], tail = m[2];
    var io = new IntersectionObserver(function (es) {
      if (!es[0].isIntersecting) return;
      io.disconnect();
      var t0 = performance.now();
      (function step(t) {
        var p = Math.min(1, (t - t0) / 1300), e = 1 - Math.pow(1 - p, 3);
        el.textContent = Math.round(to * e) + tail;
        if (p < 1) requestAnimationFrame(step);
      })(t0);
    }, { threshold: 0.6 });
    io.observe(el);
  });

  /* Documents: filter by type */
  var chips = $$(".filters .chip"), cards = $$("#docs > li, [data-docs] > li");
  chips.forEach(function (c) {
    c.addEventListener("click", function () {
      var t = c.dataset.t;
      chips.forEach(function (o) { o.setAttribute("aria-pressed", o === c); });
      cards.forEach(function (li) { li.hidden = !(t === "all" || li.dataset.t === t); });
      $$(".shelf").forEach(function (s) { s.hidden = !$$("[data-docs] > li", s).some(function (li) { return !li.hidden; }); });
    });
  });

  /* Header: mark the section in view */
  var links = $$(".home .nav nav a");
  if (links.length && "IntersectionObserver" in window) {
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

  /* Video: plays in place. YouTube is contacted only after a press on play. */
  var theater = $("#theater");
  if (theater) theater.addEventListener("click", function (e) {
    var b = e.target.closest("[data-video],[data-list]");
    if (!b) return;
    var f = document.createElement("iframe");
    f.title = b.textContent.trim() || "Video";
    f.allow = "autoplay; encrypted-media; picture-in-picture; fullscreen";
    f.allowFullscreen = true;
    f.src = "https://www.youtube-nocookie.com/embed/" + (b.dataset.video || "videoseries") + "?autoplay=1&rel=0&playsinline=1" + (b.dataset.list ? "&list=" + b.dataset.list : "");
    var stage = $(".stage", theater);
    stage.innerHTML = "";
    stage.appendChild(f);
    $$(".reel button", theater).forEach(function (o) { o.setAttribute("aria-pressed", o.dataset.video === b.dataset.video); });
  });

  /* ---------- April ---------- */
  var panel = $("#april"), log = $("#log"), q = $("#q"), orb = $("#orb"), dock = $(".dock"), sugg = $("#sugg"), speakBtn = $("#speak");
  var hist = [], opener = null, greeted = false, voiceOn = store("april-voice") === "1";
  var ctx = null, node = null;
  function speaking(on) {
    if (orb) orb.classList.toggle("talk", on);
    var big = $(".orb-stage");
    if (big) big.classList.toggle("speaking", on);
  }
  function unlock() {
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctx = ctx || new AC();
      if (ctx.state === "suspended") ctx.resume();
    } catch (e) {}
  }
  function hush() {
    try { if (node) { node.onended = null; node.stop(); } } catch (e) {}
    node = null;
    if (window.speechSynthesis) speechSynthesis.cancel();
    speaking(false);
  }
  function playBytes(buf) {
    return new Promise(function (ok, no) {
      if (!ctx) return no();
      ctx.decodeAudioData(buf, function (audio) {
        hush();
        node = ctx.createBufferSource();
        node.buffer = audio;
        node.connect(ctx.destination);
        node.onended = function () { speaking(false); };
        node.start();
        speaking(true);
        ok();
      }, no);
    });
  }
  function bytes(b64) {
    var bin = atob(b64), a = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i);
    return a.buffer;
  }
  /* The browser's own voices are the fallback: pick a woman's voice in the page's language. */
  var WOMAN = /female|woman|samantha|karen|moira|tessa|fiona|victoria|allison|ava|susan|serena|zira|jenny|aria|libby|sonia|michelle|am[eé]lie|audrey|marie|denise|julie|anna|petra|katja|vicki|marlene|m[oó]nica|paulina|elvira|luc[ií]a|sabina|lekha|swara|heera|kalpana/i;
  function browserVoice(text) {
    if (!window.speechSynthesis) return;
    speechSynthesis.cancel();
    var u = new SpeechSynthesisUtterance(text.replace(/https?:\/\/\S+/g, ""));
    var mine = speechSynthesis.getVoices().filter(function (v) { return v.lang.toLowerCase().indexOf(LANG) === 0; });
    function score(v) {
      var woman = WOMAN.test(v.name) || (/google/i.test(v.name) && !/\bmale\b/i.test(v.name));
      return (woman ? 4 : 0) + (/natural|neural|premium|enhanced|online/i.test(v.name) ? 2 : 0) + (v.localService ? 0 : 1);
    }
    mine.sort(function (a, b) { return score(b) - score(a); });
    if (mine[0]) u.voice = mine[0];
    u.lang = mine[0] ? mine[0].lang : LANG;
    u.rate = 0.98;
    u.onstart = function () { speaking(true); };
    u.onend = u.onerror = function () { speaking(false); };
    speechSynthesis.speak(u);
  }
  function say(text, audio) {
    if (!voiceOn) return;
    if (audio) playBytes(bytes(audio)).catch(function () { browserVoice(text); });
    else browserVoice(text);
  }
  function setVoice(on) {
    voiceOn = on;
    store("april-voice", on ? "1" : "0");
    if (speakBtn) speakBtn.setAttribute("aria-pressed", on);
    if (!on) hush();
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
    function offline(text) {
      var s = text.toLowerCase(), i;
      for (i = 0; i < FAQ.length; i++) if (FAQ[i].q.toLowerCase() === s) return FAQ[i].a;
      for (i = 0; i < FAQ.length; i++) if (new RegExp(FAQ[i].keys).test(s)) return FAQ[i].a;
      return I.offline + " " + body.dataset.linkedin;
    }
    function ask(text) {
      text = String(text || "").trim();
      if (!text) return;
      sugg.hidden = true;
      hush();
      add("u", esc(text));
      var w = add("a wait", esc(I.thinking));
      speaking(true);
      fetch("/api/april", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ q: text, history: hist, lang: LANG, voice: voiceOn }) })
        .then(function (r) { if (!r.ok) throw 0; return r.json(); })
        .then(function (d) { if (!d.answer) throw 0; return d; })
        .catch(function () { return { answer: offline(text) }; })
        .then(function (d) {
          speaking(false);
          w.className = "msg a";
          w.innerHTML = rich(d.answer);
          log.scrollTop = log.scrollHeight;
          hist.push({ role: "user", content: text }, { role: "assistant", content: d.answer });
          hist = hist.slice(-6);
          say(d.answer, d.audio);
        });
    }
    function openPanel(pre) {
      if (panel.hidden) opener = document.activeElement;
      panel.hidden = false;
      dock.hidden = true;
      unlock();
      if (!greeted) {
        greeted = true;
        var h = new Date().getHours();
        add("a", esc((h < 12 ? I.morning : h < 18 ? I.afternoon : I.evening) + " " + I.intro));
      }
      if (pre) ask(pre); else q.focus();
    }
    function closePanel() {
      panel.hidden = true;
      dock.hidden = false;
      hush();
      if (opener && opener.focus) opener.focus();
    }
    window.askApril = openPanel;
    $$("[data-april]").forEach(function (b) { b.addEventListener("click", function () { openPanel(b.dataset.ask || ""); }); });
    $("#april-x").addEventListener("click", closePanel);
    addEventListener("keydown", function (e) { if (e.key === "Escape" && !panel.hidden && (!$("#pal") || $("#pal").hidden)) closePanel(); });
    $("#ask").addEventListener("submit", function (e) { e.preventDefault(); unlock(); var t = q.value; q.value = ""; ask(t); });
    FAQ.forEach(function (f) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "chip sm";
      b.textContent = f.q;
      b.addEventListener("click", function () { unlock(); ask(f.q); });
      sugg.appendChild(b);
    });
    speakBtn.setAttribute("aria-pressed", voiceOn);
    speakBtn.addEventListener("click", function () {
      unlock();
      setVoice(!voiceOn);
      add("note", esc(voiceOn ? I.voiceOn : I.voiceOff));
      if (voiceOn) browserVoice(I.voiceOn);
    });
    var SR = window.SpeechRecognition || window.webkitSpeechRecognition, mic = $("#mic");
    if (SR) {
      mic.hidden = false;
      mic.addEventListener("click", function () {
        unlock();
        var r = new SR();
        r.lang = { en: "en-US", fr: "fr-FR", de: "de-DE", es: "es-ES", hi: "hi-IN" }[LANG] || "en-US";
        mic.classList.add("on");
        r.onresult = function (e) { setVoice(true); ask(e.results[0][0].transcript); };
        r.onend = r.onerror = function () { mic.classList.remove("on"); };
        r.start();
      });
    }
  })();

  /* "Hear her voice": one spoken line, so a visitor can judge the voice before asking anything */
  $$("[data-hear]").forEach(function (b) {
    if (!(window.AudioContext || window.webkitAudioContext || window.speechSynthesis)) return;
    b.hidden = false;
    b.addEventListener("click", function () {
      unlock();
      hush();
      speaking(true);
      fetch("/api/april?say=hello&lang=" + LANG)
        .then(function (r) { if (!r.ok) throw 0; return r.arrayBuffer(); })
        .then(playBytes)
        .catch(function () { speaking(false); browserVoice(I.hello); });
    });
  });

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
        enlarge(d, copy, "Diagram");
      }
    });
    article.addEventListener("keydown", function (e) {
      if ((e.key === "Enter" || e.key === " ") && e.target.classList && e.target.classList.contains("diagram")) { e.preventDefault(); e.target.click(); }
    });
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
