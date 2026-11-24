/* The hero's three pages, in depth. On a wide screen the three publication pages beside the headline lift off the
   desk into a small 3D stack: they turn a little toward the pointer, and they come apart into layers as the reader
   scrolls on. It is CSS 3D transforms on the three images the page already has: no library, no canvas, no WebGL, and
   nothing to download but this file.

   It does nothing, and the pages stay exactly as the style sheet lays them out, when the screen is narrower than
   1,080 pixels (the pages aren't shown there), when the reader asks for reduced motion, or when the browser doesn't
   keep 3D transforms. The pages are decoration (the container is aria-hidden), so nothing here is read aloud or
   takes the keyboard's focus. No layout changes: only transform, box-shadow and opacity are animated. */
(function () {
  "use strict";
  var box = document.querySelector(".hero-pubs");
  var hero = document.querySelector(".hero");
  if (!box || !hero || !window.matchMedia || !window.requestAnimationFrame) return;
  var wide = matchMedia("(min-width:1080px)");
  var still = matchMedia("(prefers-reduced-motion: reduce)");
  if (!window.CSS || !CSS.supports || !CSS.supports("transform-style", "preserve-3d")) return;

  var stage = null, cards = [], raf = 0, on = false;
  /* Where things are (cur) and where they are going (to). lift: 0 flat on the desk, 1 in depth. tx, ty: the pointer,
     from -1 to 1 across the hero. open: 0 a stack, 1 the layers apart, from the scroll position. */
  var cur = { lift: 0, tx: 0, ty: 0, open: 0 };
  var to = { lift: 0, tx: 0, ty: 0, open: 0 };
  /* Each page: its place in the stack (the same left, top and turn the style sheet gives the flat pages) and its
     layer, back (-1), middle (0) or front (1). */
  var PLACE = [{ x: 0, y: 56, r: -6, d: -1 }, { x: 46, y: 14, r: 1.5, d: 0 }, { x: 88, y: 78, r: 6, d: 1 }];

  function build() {
    var imgs = box.querySelectorAll("img.hp");
    if (imgs.length !== 3) return false;
    stage = document.createElement("div");
    stage.className = "hp-stage";
    for (var i = 0; i < imgs.length; i++) {
      var card = document.createElement("div");
      card.className = "hp-card";
      card.appendChild(imgs[i]);
      stage.appendChild(card);
      cards.push(card);
    }
    box.appendChild(stage);
    box.classList.add("h3d");
    return true;
  }

  function draw() {
    var l = cur.lift, o = cur.open;
    stage.style.transform = "rotateX(" + ((5 - cur.ty * 7 + o * 8) * l).toFixed(2) + "deg) rotateY(" + ((-21 + cur.tx * 12 - o * 13) * l).toFixed(2) + "deg)";
    for (var i = 0; i < cards.length; i++) {
      var p = PLACE[i];
      var z = p.d * (46 * l + 104 * o);
      var y = p.y - p.d * 22 * o;
      var x = p.x - p.d * 10 * o;
      cards[i].style.transform = "translate3d(" + x.toFixed(1) + "px," + y.toFixed(1) + "px," + z.toFixed(1) + "px) rotate(" + (p.r * (1 - o * 0.55)).toFixed(2) + "deg)";
      /* The front page throws the longest shadow; the light follows the pointer a little. */
      var depth = 1 + (p.d + 1) * 0.5 * l + o * 0.8;
      cards[i].style.boxShadow = (-cur.tx * 6 * l).toFixed(1) + "px " + (18 * depth).toFixed(1) + "px " + (30 * depth).toFixed(1) + "px " + (-14 * depth).toFixed(1) + "px rgba(0,0,0," + (0.24 + 0.06 * l).toFixed(2) + ")";
      cards[i].style.setProperty("--sheen", (50 + cur.tx * 34).toFixed(1) + "%");
      cards[i].style.setProperty("--sheen-a", (0.5 * l).toFixed(2));
    }
  }

  function frame() {
    raf = 0;
    var moving = false;
    for (var k in cur) {
      var gap = to[k] - cur[k];
      /* lift is slow, so the pages rise once and calmly; the pointer and the scroll are followed closely. */
      cur[k] += gap * (k === "lift" ? 0.07 : k === "open" ? 0.2 : 0.12);
      if (Math.abs(gap) > 0.0015) moving = true; else cur[k] = to[k];
    }
    draw();
    if (moving) raf = requestAnimationFrame(frame);
  }
  function wake() { if (on && !raf) raf = requestAnimationFrame(frame); }

  function onMove(e) {
    if (e.pointerType && e.pointerType !== "mouse") return;
    var r = hero.getBoundingClientRect();
    to.tx = Math.max(-1, Math.min(1, ((e.clientX - r.left) / r.width) * 2 - 1));
    to.ty = Math.max(-1, Math.min(1, ((e.clientY - r.top) / r.height) * 2 - 1));
    wake();
  }
  function onLeave() { to.tx = 0; to.ty = 0; wake(); }
  function onScroll() {
    var h = hero.offsetHeight || 1;
    to.open = Math.max(0, Math.min(1, (window.scrollY || window.pageYOffset || 0) / (h * 0.5)));
    wake();
  }

  function start() {
    if (on || !wide.matches || still.matches) return;
    if (!stage && !build()) return;
    on = true;
    box.classList.add("h3d");
    to.lift = 1;
    onScroll();
    draw();
    hero.addEventListener("pointermove", onMove, { passive: true });
    hero.addEventListener("pointerleave", onLeave, { passive: true });
    window.addEventListener("scroll", onScroll, { passive: true });
    wake();
  }
  /* Back to the flat pages of the style sheet: the wrappers stay, without their transforms. */
  function stop() {
    if (!on) return;
    on = false;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    hero.removeEventListener("pointermove", onMove);
    hero.removeEventListener("pointerleave", onLeave);
    window.removeEventListener("scroll", onScroll);
    cur = { lift: 0, tx: 0, ty: 0, open: 0 };
    to = { lift: 0, tx: 0, ty: 0, open: 0 };
    stage.style.transform = "";
    for (var i = 0; i < cards.length; i++) { cards[i].style.transform = ""; cards[i].style.boxShadow = ""; cards[i].style.removeProperty("--sheen-a"); }
    box.classList.remove("h3d");
  }
  function check() { if (wide.matches && !still.matches) start(); else stop(); }
  function listen(q) { if (q.addEventListener) q.addEventListener("change", check); else if (q.addListener) q.addListener(check); }
  listen(wide);
  listen(still);
  check();
})();
