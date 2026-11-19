// Drawn in the page while it is filmed: the pointer, the ring of a click, the house marks and the redaction.
// The marks follow standards/screenshots.md at CSS size: green #6CE975 2 px with a #0E5A2B keyline outside it, 3 px
// corners, about 4 px of space round the control, and 24 px numbered markers with #0B2E16 numbers. Filmed at a device
// scale of 1.5, they are the 1080p sizes of standards/video.md. Nothing here takes a click: the page gets them all.
(() => {
  const GREEN = "#6CE975", EDGE = "#0E5A2B", INK = "#0B2E16", PAD = 5;
  let fixed, doc, ptr, at = { x: 640, y: 340 }, marks = {};
  function install() {
    if (fixed && fixed.isConnected) return;
    const host = document.body || document.documentElement;
    fixed = document.createElement("div"); fixed.id = "__ovf";
    fixed.style.cssText = "position:fixed;inset:0;pointer-events:none;z-index:2147483647;overflow:hidden";
    doc = document.createElement("div"); doc.id = "__ovd";
    doc.style.cssText = "position:absolute;left:0;top:0;width:0;height:0;overflow:visible;pointer-events:none;z-index:2147483646";
    const st = document.createElement("style");
    st.textContent = "@keyframes __ovring{from{transform:translate(-50%,-50%) scale(.35);opacity:1}to{transform:translate(-50%,-50%) scale(1.45);opacity:0}}" +
      "@keyframes __ovin{from{opacity:0}to{opacity:1}}";
    fixed.appendChild(st);
    ptr = document.createElement("div");
    ptr.style.cssText = "position:absolute;left:0;top:0;width:0;height:0;will-change:transform";
    ptr.innerHTML = '<span style="position:absolute;left:-11px;top:-11px;width:22px;height:22px;border-radius:50%;background:rgba(108,233,117,.28)"></span>' +
      '<svg width="20" height="28" viewBox="0 0 20 28" style="position:absolute;left:-1px;top:-1px;overflow:visible"><path d="M1 1 L1 21 L6 16.5 L9.6 24.6 L12.9 23.2 L9.3 15.3 L16 15.3 Z" fill="#111" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>';
    fixed.appendChild(ptr); host.appendChild(fixed); host.appendChild(doc);
    marks = {}; place();
  }
  function place() { if (ptr) ptr.style.transform = "translate(" + at.x + "px," + at.y + "px)"; }
  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  function glide(x, y, ms) {
    install();
    const from = { x: at.x, y: at.y }, t0 = performance.now();
    return new Promise((done) => {
      (function step(now) {
        const k = Math.min(1, (now - t0) / ms), e = ease(k);
        at = { x: from.x + (x - from.x) * e, y: from.y + (y - from.y) * e }; place();
        if (k < 1) requestAnimationFrame(step); else done();
      })(t0);
    });
  }
  function ring(x, y) {
    install();
    const r = document.createElement("span");
    r.style.cssText = "position:absolute;left:" + x + "px;top:" + y + "px;width:38px;height:38px;border-radius:50%;border:3px solid " + EDGE +
      ";box-shadow:0 0 0 2px rgba(108,233,117,.55);animation:__ovring .4s ease-out forwards";
    fixed.insertBefore(r, ptr); setTimeout(() => r.remove(), 450);
  }
  function mark(key, b, n, side) {
    install(); unmark(key, true);
    const sx = window.scrollX, sy = window.scrollY;
    const R = { x: b.x - PAD + sx, y: b.y - PAD + sy, w: b.width + 2 * PAD, h: b.height + 2 * PAD };
    const g = document.createElement("div");
    g.style.cssText = "position:absolute;left:" + R.x + "px;top:" + R.y + "px;width:" + R.w + "px;height:" + R.h + "px;box-sizing:border-box;border:2px solid " + GREEN +
      ";outline:1px solid " + EDGE + ";border-radius:3px;animation:__ovin .2s ease-out";
    const parts = [g];
    if (n) {
      let cx = R.x - 15, cy = R.y + R.h / 2;
      if (side === "right" || (side === "left" && cx - 13 < sx)) { cx = R.x + R.w + 15; }
      if (side === "above") { cx = R.x + R.w / 2; cy = R.y - 15; }
      if (side === "below") { cx = R.x + R.w / 2; cy = R.y + R.h + 15; }
      const c = document.createElement("div");
      c.textContent = String(n);
      c.style.cssText = "position:absolute;left:" + (cx - 12) + "px;top:" + (cy - 12) + "px;width:24px;height:24px;box-sizing:border-box;border-radius:50%;background:" + GREEN +
        ";border:1px solid " + EDGE + ";color:" + INK + ";font:700 14px/22px Arial,Helvetica,sans-serif;text-align:center;animation:__ovin .2s ease-out";
      parts.push(c);
    }
    parts.forEach((p) => doc.appendChild(p)); marks[key] = parts;
  }
  function unmark(key, now) { (marks[key] || []).forEach((p) => p.remove()); delete marks[key]; }
  function clear() { Object.keys(marks).forEach((k) => unmark(k)); }
  function redact(key, b, label) {
    install(); unmark(key, true);
    const d = document.createElement("div"), sx = window.scrollX, sy = window.scrollY;
    d.textContent = label || "";
    d.style.cssText = "position:absolute;left:" + (b.x - 4 + sx) + "px;top:" + (b.y - 4 + sy) + "px;width:" + (b.width + 8) + "px;height:" + (b.height + 8) +
      "px;background:#2B2F36;color:#fff;font:600 13px/1.3 Arial,Helvetica,sans-serif;display:flex;align-items:center;justify-content:center;text-align:center;padding:12px;box-sizing:border-box;border-radius:2px";
    doc.appendChild(d); marks[key] = [d];
  }
  function nudge() { install(); ptr.style.opacity = "0.99"; requestAnimationFrame(() => { ptr.style.opacity = "1"; }); }
  window.__ov = { install, pointer: (x, y) => { install(); at = { x, y }; place(); }, glide, ring, mark, unmark, clear, redact, nudge };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install); else install();
})();
