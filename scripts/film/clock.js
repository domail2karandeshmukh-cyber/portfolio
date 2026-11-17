/* The film's clock, and the few things the film adds to the page.

   film.py loads this file into the page before any of the page's own scripts run. It replaces the clock:
   timers, animation frames, CSS animations, CSS transitions and smooth scrolling all stand still until
   step() is called, and then move by exactly the time asked for. Every frame of the film is therefore
   1/30 s after the one before it, however long the screenshot took.

   The additions are a caption bar, a finger, and the last card. Everything else on screen is the site.
   A film wider than it is tall gets one line of caption and a smaller pointer. */
(function () {
  var realTimeout = window.setTimeout.bind(window);
  var realFrame = window.requestAnimationFrame.bind(window);
  var realScroll = window.scrollTo.bind(window);
  var now = 0, epoch = Date.now(), seq = 0;
  var timers = new Map(), frames = [], seen = new Map(), tween = null, held = null, pans = [];

  /* ----- The clock ----- */
  window.setTimeout = function (fn, ms) {
    var id = ++seq;
    timers.set(id, { at: now + Math.max(0, +ms || 0), fn: fn, args: [].slice.call(arguments, 2) });
    return id;
  };
  window.clearTimeout = function (id) { timers.delete(id); };
  window.setInterval = function (fn, ms) {
    var id = ++seq, every = Math.max(1, +ms || 0);
    timers.set(id, { at: now + every, every: every, fn: fn, args: [].slice.call(arguments, 2) });
    return id;
  };
  window.clearInterval = window.clearTimeout;
  window.requestAnimationFrame = function (fn) { var id = ++seq; frames.push({ id: id, fn: fn }); return id; };
  window.cancelAnimationFrame = function (id) { frames = frames.filter(function (f) { return f.id !== id; }); };
  performance.now = function () { return now; };
  Date.now = function () { return epoch + now; };

  /* ----- The camera: every scroll is a move the film times ----- */
  function ease(p) { return p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2; }
  function limit(top) { return Math.max(0, Math.min(top, document.documentElement.scrollHeight - innerHeight)); }
  function glide(top, ms) { tween = { from: window.pageYOffset, to: limit(top), t0: now, ms: ms || 700 }; }
  window.scrollTo = function (a, b) {
    if (a && typeof a === "object") {
      var top = a.top == null ? window.pageYOffset : a.top;
      if (a.behavior === "smooth") return glide(top, 700);
      return realScroll(a.left == null ? window.pageXOffset : a.left, top);
    }
    return realScroll(a, b);
  };
  window.scroll = window.scrollTo;

  /* ----- Animations and transitions -----
     One that the page has just started is stopped at its first moment, and moved by hand from then on.
     `seen` holds the film time each one started at, or null once it has finished. */
  function hold(a) {
    try { a.pause(); a.currentTime = 0; } catch (e) {}
    seen.set(a, now);
  }
  function sweep() {
    document.getAnimations().forEach(function (a) { if (!seen.has(a)) hold(a); });
  }
  function move() {
    var live = document.getAnimations();
    live.forEach(function (a) {
      var t0 = seen.get(a);
      if (t0 === undefined) return hold(a);
      if (t0 === null) return;
      var end = a.effect ? Number(a.effect.getComputedTiming().endTime) : 0, t = now - t0;
      try {
        if (isFinite(end) && t >= end) { seen.set(a, null); a.finish(); }
        else a.currentTime = t;
      } catch (e) {}
    });
    if (seen.size > 600) {
      var keep = new Set(live);
      seen.forEach(function (v, a) { if (!keep.has(a)) seen.delete(a); });
    }
  }

  // One step of film time: due timers in order, then animation frames, the camera, the progress line, the animations.
  function step(ms, part) {
    var target = now + ms, guard = 0;
    for (;;) {
      var next = null, nid = 0;
      timers.forEach(function (t, id) {
        if (t.at <= target && (!next || t.at < next.at || (t.at === next.at && id < nid))) { next = t; nid = id; }
      });
      if (!next || ++guard > 5000) break;
      if (next.at > now) now = next.at;
      if (next.every) next.at += next.every; else timers.delete(nid);
      try { next.fn.apply(window, next.args); } catch (e) { console.error("film: timer", e); }
    }
    now = target;
    var run = frames;
    frames = [];
    run.forEach(function (f) { try { f.fn(now); } catch (e) { console.error("film: frame", e); } });
    if (tween) {
      var p = Math.min(1, (now - tween.t0) / tween.ms);
      realScroll(0, tween.from + (tween.to - tween.from) * ease(p));
      if (p >= 1) tween = null;
    }
    // A part of the page with its own scroll bar moves the same way.
    pans = pans.filter(function (q) {
      var done = Math.min(1, (now - q.t0) / q.ms);
      q.el.scrollTop = q.from + (q.to - q.from) * ease(done);
      return done < 1;
    });
    if (part != null) {
      var bar = document.getElementById("film-bar");
      if (bar) bar.style.transform = "scaleX(" + Math.min(1, part).toFixed(5) + ")";
    }
    move();
    // Two real frames pass before the screenshot, so that what the browser owes the page (observers, layout, loaded data) has arrived.
    return new Promise(function (done) {
      var over = false;
      function end() { if (over) return; over = true; sweep(); done(now); }
      realFrame(function () { realFrame(function () { realTimeout(end, 0); }); });
      realTimeout(end, 120);
    });
  }

  /* ----- What the film adds to the page ----- */
  var CSS = [
    // The page, as the film wants it: scrolling by the film only, no scrollbar, no assistant button over the picture.
    "html{scroll-behavior:auto!important;scrollbar-width:none}",
    "::-webkit-scrollbar{display:none}",
    ".dock,.skip,#tour{display:none!important}",
    // A caret blinks by the computer's clock, not the film's. Text is typed without one.
    "textarea,input{caret-color:transparent!important}",
    // For the close-ups the site's own bar slides away.
    ".nav{transition:transform .45s cubic-bezier(.4,0,.2,1),border-color .2s!important}",
    ".film-close .nav{transform:translateY(-102%)}",
    // The caption bar. The text sits high in it, clear of the corners where a feed draws its timer and its sound button.
    "#film-cap{position:fixed;left:0;right:0;bottom:0;z-index:9990;background:#0B0B0C;color:#fff;height:104px;padding:17px 24px 0;transform:translateY(125%);transition:transform .5s cubic-bezier(.2,.7,.2,1)}",
    "#film-cap.on{transform:none}",
    "#film-cap::before{content:\"\";position:absolute;left:0;right:0;bottom:100%;height:8px;background:linear-gradient(rgba(255,255,255,0),#fff);pointer-events:none}",
    "html:not(.film-close) #film-cap::before{background:linear-gradient(rgba(255,255,255,0),#fff 55%)}",
    "#film-bar{position:absolute;left:0;top:0;height:4px;width:100%;background:#FFDF2B;transform-origin:0 50%;transform:scaleX(0)}",
    "#film-text{margin:0;font:500 22px/1.28 Newsreader,Georgia,serif;letter-spacing:-.005em;white-space:nowrap;transition:opacity .18s linear,transform .18s ease-out}",
    "#film-cap.out #film-text{opacity:0;transform:translateY(5px)}",
    "#film-text mark{background:#FFDF2B;color:#0B0B0C;padding:0 .18em;border-radius:2px;-webkit-box-decoration-break:clone;box-decoration-break:clone}",
    "#film-text s{text-decoration:line-through;text-decoration-color:#FF5A4A;text-decoration-thickness:.09em;color:#B7B9BF}",
    "#film-site{position:absolute;right:24px;bottom:11px;font:600 12px/1 Hanken,system-ui,sans-serif;letter-spacing:.01em;color:#8E9097}",
    // The finger.
    "#film-tap{position:fixed;left:0;top:0;z-index:9995;width:58px;height:58px;margin:-29px 0 0 -29px;border-radius:50%;background:rgba(11,11,12,.16);box-shadow:0 0 0 2px rgba(11,11,12,.6),0 0 0 5px rgba(255,255,255,.75);opacity:0;pointer-events:none}",
    "#film-tap.go{animation:film-tap .6s cubic-bezier(.3,0,.2,1) both}",
    "@keyframes film-tap{0%{opacity:0;transform:scale(1.7)}30%{opacity:1;transform:scale(1)}40%{opacity:1;transform:scale(.8)}56%{opacity:1;transform:scale(.8)}100%{opacity:0;transform:scale(1.1)}}",
    // The last card rises from the caption bar. Its lines come in one after another.
    "#film-end{position:fixed;inset:0;z-index:9992;background:#0B0B0C;color:#fff;display:flex;flex-direction:column;justify-content:center;padding:0 34px 16px;clip-path:inset(100% 0 0 0);transition:clip-path .62s cubic-bezier(.65,0,.2,1)}",
    "#film-end.on{clip-path:inset(0 0 0 0)}",
    "#film-end>*{opacity:0;transform:translateY(12px);transition:opacity .45s ease-out,transform .55s cubic-bezier(.2,.7,.2,1)}",
    "#film-end.on>*{opacity:1;transform:none}",
    "#film-end.on>:nth-child(1){transition-delay:.42s}#film-end.on>:nth-child(2){transition-delay:.62s}#film-end.on>:nth-child(3){transition-delay:.86s}",
    "#film-end h2{margin:0;font:500 39px/1.1 Newsreader,Georgia,serif;letter-spacing:-.02em;text-wrap:balance}",
    "#film-end .url{margin:26px 0 0;align-self:flex-start;font:650 25px/1.2 Hanken,system-ui,sans-serif;letter-spacing:-.01em;background:#FFDF2B;color:#0B0B0C;padding:9px 14px 10px;border-radius:3px}",
    "#film-end .who{margin:46px 0 0;padding-top:22px;border-top:1px solid #303136;font:400 16.5px/1.45 Hanken,system-ui,sans-serif;color:#B7B9BF;text-wrap:pretty}",
    "#film-end .who b{display:block;font-weight:650;font-size:21px;letter-spacing:-.01em;color:#fff;margin-bottom:4px}",
    // A wide film: one line of caption, the site's name beside it, a pointer the size of a cursor.
    ".film-wide #film-cap{height:92px;padding:0 44px;display:flex;align-items:center}",
    ".film-wide #film-cap::before{display:none}",
    ".film-wide #film-text{font-size:31px}",
    ".film-wide #film-site{right:44px;bottom:auto;top:50%;margin-top:-7px;font-size:15px}",
    ".film-wide #film-tap{width:44px;height:44px;margin:-22px 0 0 -22px}",
    ".film-wide #film-end{padding:0 110px 20px}",
    ".film-wide #film-end h2{font-size:64px;max-width:16em}",
    ".film-wide #film-end .url{margin-top:36px;font-size:33px;padding:11px 18px 12px}",
    ".film-wide #film-end .who{margin-top:56px;padding-top:26px;max-width:40em;font-size:21px}",
    ".film-wide #film-end .who b{font-size:27px;margin-bottom:6px}"
  ];
  function build() {
    if (document.getElementById("film-cap")) return;
    if (innerWidth > innerHeight) document.documentElement.classList.add("film-wide");
    var css = document.createElement("style");
    css.textContent = CSS.join("\n");
    document.head.appendChild(css);
    var cap = document.createElement("div"), finger = document.createElement("div"), card = document.createElement("div");
    cap.id = "film-cap";
    cap.innerHTML = '<i id="film-bar"></i><p id="film-text"></p><span id="film-site">karandeshmukh.dev</span>';
    finger.id = "film-tap";
    card.id = "film-end";
    document.body.appendChild(cap);
    document.body.appendChild(finger);
    document.body.appendChild(card);
  }
  // The first caption brings the bar up. A later one takes the place of the one before it. An empty one sends the bar away.
  function caption(html) {
    var cap = document.getElementById("film-cap"), text = document.getElementById("film-text");
    if (!html) { cap.classList.remove("on"); return; }
    if (!cap.classList.contains("on")) { text.innerHTML = html; cap.classList.add("on"); return; }
    cap.classList.add("out");
    window.setTimeout(function () { text.innerHTML = html; cap.classList.remove("out"); }, 190);
  }
  // The finger comes down on the middle of an element.
  function tap(selector) {
    var el = document.querySelector(selector), ring = document.getElementById("film-tap");
    if (!el) return false;
    var r = el.getBoundingClientRect();
    ring.style.left = Math.round(r.left + r.width / 2) + "px";
    ring.style.top = Math.round(r.top + r.height / 2) + "px";
    ring.classList.remove("go");
    void ring.offsetWidth;
    ring.classList.add("go");
    return true;
  }
  // A press shows on the thing pressed, the way a phone shows it: down first, then the click as the finger lifts.
  function down(selector) {
    var el = document.querySelector(selector);
    if (!el) return false;
    held = { el: el, style: el.getAttribute("style") };
    el.style.transition = "none";
    el.style.background = "#0B0B0C";
    el.style.borderColor = "#0B0B0C";
    el.style.color = "#fff";
    return true;
  }
  function up() {
    if (!held) return false;
    var el = held.el;
    if (held.style == null) el.removeAttribute("style"); else el.setAttribute("style", held.style);
    held = null;
    el.click();
    return true;
  }
  function end(html) {
    var card = document.getElementById("film-end");
    card.innerHTML = html;
    void card.offsetWidth;
    card.classList.add("on");
  }
  // Where a part of the page is, measured from the top of the document. `starts` picks among several by their first words.
  function find(selector, starts) {
    var all = [].slice.call(document.querySelectorAll(selector));
    return starts ? all.filter(function (e) { return e.textContent.trim().indexOf(starts) === 0; })[0] : all[0];
  }
  function top(selector, starts) {
    var el = find(selector, starts);
    return el ? el.getBoundingClientRect().top + window.pageYOffset : null;
  }
  function box(selector) {
    var el = find(selector);
    if (!el) return null;
    var r = el.getBoundingClientRect();
    return [r.top + window.pageYOffset, r.height];
  }
  function close(on) { document.documentElement.classList.toggle("film-close", !!on); }
  function pan(selector, to, ms) {
    var el = find(selector);
    if (!el) return false;
    pans.push({ el: el, from: el.scrollTop, to: Math.max(0, Math.min(to, el.scrollHeight - el.clientHeight)), t0: now, ms: ms || 700 });
    return true;
  }
  // Typing: one character at a time on the film's clock, each one arriving the way a key press does.
  function type(selector, text, each) {
    var el = find(selector);
    if (!el) return false;
    el.focus({ preventScroll: true });
    try { el.setSelectionRange(el.value.length, el.value.length); } catch (e) {}
    text.split("").forEach(function (ch, i) {
      window.setTimeout(function () {
        var ok = false;
        el.focus({ preventScroll: true });
        try { ok = document.execCommand("insertText", false, ch); } catch (e) {}
        if (!ok) { el.value += ch; el.dispatchEvent(new Event("input", { bubbles: true })); }
      }, (i + 1) * (each || 55));
    });
    return true;
  }
  // A choice in a list of choices. The list itself belongs to the browser and is not part of the page's picture.
  function pick(selector, value) {
    var el = find(selector);
    if (!el) return false;
    el.value = value;
    if (el.value !== value) return false;
    el.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }

  window.__film = { step: step, sweep: sweep, glide: glide, caption: caption, tap: tap, down: down, up: up, end: end, top: top, box: box, close: close, pan: pan, type: type, pick: pick, now: function () { return now; } };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function () { build(); sweep(); });
  else { build(); sweep(); }
})();
