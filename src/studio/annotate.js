/* Documentation Studio: the screenshot editor.
   One image, and a list of marks drawn over it in image pixels. The image itself changes only on crop, resize,
   rotate and redaction; every other mark stays editable until the image is exported, when it is drawn in.
   Redaction paints over the pixels of the image at once, so neither an export nor a saved project holds what was under it.
   Used by /studio/screenshots, and by the step guides for each step's picture. Needs kit.js. */
(function (root) {
  "use strict";
  var Kit = root.Kit;
  var T = Kit && Kit.t || function (s, v) { return String(s).replace(/\{(\w+)\}/g, function (m, k) { return v && k in v ? v[k] : m; }); };
  var A = {};

  /* ---------- The marks ---------- */
  var BOX = { rect: 1, ellipse: 1, highlight: 1, spotlight: 1, blur: 1, pixelate: 1, redact: 1 };
  var LINE = { arrow: 1, line: 1 };
  A.TYPES = ["arrow", "line", "rect", "ellipse", "callout", "text", "highlight", "spotlight", "blur", "pixelate"];
  A.NAMES = { arrow: T("Arrow"), line: T("Line"), rect: T("Rectangle"), ellipse: T("Ellipse"), callout: T("Numbered callout"), text: T("Text"), highlight: T("Highlight"), spotlight: T("Spotlight"), blur: T("Blur"), pixelate: T("Pixelate"), redact: T("Redaction") };
  /** The same names as they read inside a sentence of the history: Added arrow. */
  A.NOUNS = { arrow: T("arrow"), line: T("line"), rect: T("rectangle"), ellipse: T("ellipse"), callout: T("numbered callout"), text: T("text"), highlight: T("highlight"), spotlight: T("spotlight"), blur: T("blur"), pixelate: T("pixelation"), redact: T("redaction") };
  /* The house style (standards/screenshots.md): a bright green, #6CE975, measured from my published guides, with a 1 px dark
     keyline (#0E5A2B) so the mark stands out on white and on dark interfaces; numbers in dark type on the green. Red, blue
     and amber stay for meaning. */
  A.HOUSE = { color: "#6CE975", edge: "#0E5A2B" };
  A.COLORS = ["#6CE975", "#E5251B", "#0B0B0C", "#1D4ED8", "#FFDF2B", "#FFFFFF"];
  /** The house stroke for an image: 2 px for a capture at screen density, 4 px for a high-density (2x) capture. */
  A.houseStroke = function (W) { return W > 1800 ? 4 : 2; };

  function num(v, lo, hi, d) { v = Number(v); return isFinite(v) ? Math.max(lo, Math.min(hi, v)) : d; }
  /** A mark from a project file, checked field by field. Anything unknown is dropped. */
  A.clean = function (m, W, H) {
    if (!m || A.TYPES.indexOf(m.type) < 0) return null;
    var big = Math.max(W, H) * 2, out = { id: String(m.id || A.id()).slice(0, 40), type: m.type, color: /^#[0-9a-fA-F]{6}$/.test(m.color) ? m.color : "#E5251B",
      stroke: num(m.stroke, 1, 40, 6), hidden: !!m.hidden, x: num(m.x, -big, big, 0), y: num(m.y, -big, big, 0) };
    if (/^#[0-9a-fA-F]{6}$/.test(m.edge)) out.edge = m.edge;
    if (m.type === "rect" && m.radius != null) out.radius = num(m.radius, 0, 60, 0);
    if (BOX[m.type]) { out.w = num(m.w, 1, big, 10); out.h = num(m.h, 1, big, 10); out.amount = num(m.amount, 2, 60, 14); }
    if (LINE[m.type]) { out.x2 = num(m.x2, -big, big, out.x + 50); out.y2 = num(m.y2, -big, big, out.y); }
    if (m.type === "callout") { out.n = Math.round(num(m.n, 1, 999, 1)); out.size = num(m.size, 12, 200, 34); }
    if (m.type === "text") { out.text = String(m.text == null ? "" : m.text).slice(0, 500); out.size = num(m.size, 8, 300, 28); out.box = m.box !== false; }
    return out;
  };
  var seq = 0;
  A.id = function () { return "m" + Date.now().toString(36) + (seq++).toString(36); };

  /* ---------- Drawing ---------- */
  function boxOf(m) { return { x: Math.min(m.x, m.x + m.w), y: Math.min(m.y, m.y + m.h), w: Math.abs(m.w), h: Math.abs(m.h) }; }
  function textLines(ctx, m) { ctx.font = "600 " + m.size + "px 'Hanken', Arial, sans-serif"; return String(m.text || " ").split("\n"); }
  /** The rectangle a mark covers, for selection and for hit tests. */
  A.bounds = function (ctx, m) {
    if (BOX[m.type]) return boxOf(m);
    if (LINE[m.type]) return { x: Math.min(m.x, m.x2), y: Math.min(m.y, m.y2), w: Math.abs(m.x2 - m.x), h: Math.abs(m.y2 - m.y) };
    if (m.type === "callout") return { x: m.x - m.size / 2, y: m.y - m.size / 2, w: m.size, h: m.size };
    var lines = textLines(ctx, m), w = 0; lines.forEach(function (l) { w = Math.max(w, ctx.measureText(l).width); });
    var pad = m.box ? m.size * 0.35 : 0;
    return { x: m.x - pad, y: m.y - pad, w: w + pad * 2, h: lines.length * m.size * 1.25 + pad * 2 };
  };
  /** The arrowhead's side: in the house style six times the stroke (12 px long for a 2 px arrow), otherwise as before. */
  function headSize(m) { return m.edge ? Math.max(8, m.stroke * 6) : Math.max(14, m.stroke * 3.6); }
  function edgeWidth(m) { return Math.max(1, m.stroke / 2); }
  function arrowHead(ctx, m) {
    var a = Math.atan2(m.y2 - m.y, m.x2 - m.x), s = headSize(m);
    ctx.beginPath();
    ctx.moveTo(m.x2, m.y2);
    ctx.lineTo(m.x2 - s * Math.cos(a - 0.45), m.y2 - s * Math.sin(a - 0.45));
    ctx.lineTo(m.x2 - s * Math.cos(a + 0.45), m.y2 - s * Math.sin(a + 0.45));
    ctx.closePath();
    if (m.edge) { ctx.save(); ctx.strokeStyle = m.edge; ctx.lineWidth = edgeWidth(m) * 2; ctx.lineJoin = "round"; ctx.stroke(); ctx.restore(); }
    ctx.fill();
    return s;
  }
  function rounded(ctx, x, y, w, h, r) { ctx.beginPath(); if (r > 0 && ctx.roundRect) ctx.roundRect(x, y, w, h, r); else ctx.rect(x, y, w, h); }
  /** Draws one mark. base is the image under the marks: blur and pixelation are taken from it, never from other marks. */
  A.draw = function (ctx, m, base, W, H) {
    if (m.hidden) return;
    ctx.save();
    ctx.strokeStyle = ctx.fillStyle = m.color; ctx.lineWidth = m.stroke; ctx.lineCap = "round"; ctx.lineJoin = "round";
    var b = BOX[m.type] ? boxOf(m) : null;
    if (m.type === "rect") {
      var rr = m.radius || 0;
      if (m.edge) { var k = edgeWidth(m), o = m.stroke / 2 + k / 2; ctx.save(); ctx.strokeStyle = m.edge; ctx.lineWidth = k; rounded(ctx, b.x - o, b.y - o, b.w + 2 * o, b.h + 2 * o, rr ? rr + o : 0); ctx.stroke(); ctx.restore(); }
      rounded(ctx, b.x, b.y, b.w, b.h, rr); ctx.stroke();
    }
    else if (m.type === "ellipse") {
      ctx.beginPath(); ctx.ellipse(b.x + b.w / 2, b.y + b.h / 2, b.w / 2, b.h / 2, 0, 0, Math.PI * 2);
      if (m.edge) { ctx.save(); ctx.strokeStyle = m.edge; ctx.lineWidth = m.stroke + 2 * edgeWidth(m); ctx.stroke(); ctx.restore(); }
      ctx.stroke();
    }
    else if (m.type === "highlight") { ctx.globalCompositeOperation = "multiply"; ctx.globalAlpha = 0.55; ctx.fillRect(b.x, b.y, b.w, b.h); }
    else if (m.type === "spotlight") {
      ctx.fillStyle = "rgba(11,11,12,.58)"; ctx.beginPath(); ctx.rect(0, 0, W, H);
      ctx.roundRect ? ctx.roundRect(b.x, b.y, b.w, b.h, 6) : ctx.rect(b.x, b.y, b.w, b.h);
      ctx.fill("evenodd");
    } else if (m.type === "blur") {
      ctx.beginPath(); ctx.rect(b.x, b.y, b.w, b.h); ctx.clip();
      ctx.filter = "blur(" + m.amount + "px)"; ctx.drawImage(base, 0, 0); ctx.filter = "none";
    } else if (m.type === "pixelate") {
      var n = Math.max(2, m.amount), sw = Math.max(1, Math.ceil(b.w / n)), sh = Math.max(1, Math.ceil(b.h / n)), t = document.createElement("canvas");
      t.width = sw; t.height = sh;
      var tc = t.getContext("2d"); tc.imageSmoothingEnabled = true; tc.drawImage(base, b.x, b.y, b.w, b.h, 0, 0, sw, sh);
      ctx.beginPath(); ctx.rect(b.x, b.y, b.w, b.h); ctx.clip();
      ctx.imageSmoothingEnabled = false; ctx.drawImage(t, 0, 0, sw, sh, b.x, b.y, sw * n, sh * n);
    } else if (m.type === "redact") { ctx.fillStyle = "#000"; ctx.fillRect(b.x, b.y, b.w, b.h); }
    else if (LINE[m.type]) {
      var cut = m.type === "arrow" ? headSize(m) * 0.6 : 0;
      var a = Math.atan2(m.y2 - m.y, m.x2 - m.x);
      // The keyline goes under the shaft and round the head, then the green on top.
      if (m.edge) { ctx.save(); ctx.strokeStyle = m.edge; ctx.lineWidth = m.stroke + 2 * edgeWidth(m); ctx.beginPath(); ctx.moveTo(m.x, m.y); ctx.lineTo(m.x2 - cut * Math.cos(a), m.y2 - cut * Math.sin(a)); ctx.stroke(); ctx.restore(); }
      ctx.beginPath(); ctx.moveTo(m.x, m.y); ctx.lineTo(m.x2 - cut * Math.cos(a), m.y2 - cut * Math.sin(a)); ctx.stroke();
      if (m.type === "arrow") arrowHead(ctx, m);
    } else if (m.type === "callout") {
      var r = m.size / 2;
      ctx.beginPath(); ctx.arc(m.x, m.y, r, 0, Math.PI * 2); ctx.fill();
      if (m.edge) { ctx.lineWidth = Math.max(1, r / 12); ctx.strokeStyle = m.edge; } else { ctx.lineWidth = Math.max(2, r * 0.12); ctx.strokeStyle = "#fff"; }
      ctx.stroke();
      ctx.fillStyle = m.edge ? "#0B2E16" : light(m.color) ? "#0B0B0C" : "#fff"; ctx.font = "700 " + Math.round(r * (m.n > 9 ? 0.95 : 1.15)) + "px 'Hanken', Arial, sans-serif";
      ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(String(m.n), m.x, m.y + r * 0.05);
    } else if (m.type === "text") {
      var lines = textLines(ctx, m), bb = A.bounds(ctx, m);
      if (m.box) { ctx.fillStyle = light(m.color) ? "#0B0B0C" : "#fff"; ctx.globalAlpha = 0.92; ctx.fillRect(bb.x, bb.y, bb.w, bb.h); ctx.globalAlpha = 1; }
      ctx.fillStyle = m.color; ctx.textBaseline = "top";
      lines.forEach(function (l, i) { ctx.fillText(l, m.x, m.y + i * m.size * 1.25); });
    }
    ctx.restore();
  };
  function light(hex) { var n = parseInt(hex.slice(1), 16); return ((n >> 16) * 299 + ((n >> 8) & 255) * 587 + (n & 255) * 114) / 1000 > 160; }
  /** The image with every visible mark drawn in, at its own size. */
  A.flatten = function (state) {
    var c = document.createElement("canvas"); c.width = state.base.width; c.height = state.base.height;
    var ctx = c.getContext("2d"); ctx.drawImage(state.base, 0, 0);
    state.items.forEach(function (m) { A.draw(ctx, m, state.base, c.width, c.height); });
    return c;
  };
  /** An SVG: the image with its blur, pixelation and spotlight drawn in, and every other mark as an editable vector shape. */
  A.toSVG = function (state) {
    var W = state.base.width, H = state.base.height, raster = document.createElement("canvas"); raster.width = W; raster.height = H;
    var rc = raster.getContext("2d"); rc.drawImage(state.base, 0, 0);
    state.items.forEach(function (m) { if (/^(blur|pixelate|spotlight)$/.test(m.type)) A.draw(rc, m, state.base, W, H); });
    var e = Kit.esc, out = ['<svg xmlns="http://www.w3.org/2000/svg" width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + " " + H + '">',
      '<image href="' + raster.toDataURL("image/png") + '" width="' + W + '" height="' + H + '"/>'];
    state.items.forEach(function (m) {
      if (m.hidden || /^(blur|pixelate|spotlight)$/.test(m.type)) return;
      var s = ' stroke="' + m.color + '" stroke-width="' + m.stroke + '" stroke-linecap="round" stroke-linejoin="round" fill="none"', b = BOX[m.type] ? boxOf(m) : null;
      if (m.type === "rect") {
        var rr = m.radius || 0, k = Math.max(1, m.stroke / 2), o = m.stroke / 2 + k / 2;
        if (m.edge) out.push('<rect x="' + (b.x - o) + '" y="' + (b.y - o) + '" width="' + (b.w + 2 * o) + '" height="' + (b.h + 2 * o) + '"' + (rr ? ' rx="' + (rr + o) + '"' : "") + ' stroke="' + m.edge + '" stroke-width="' + k + '" fill="none"/>');
        out.push('<rect x="' + b.x + '" y="' + b.y + '" width="' + b.w + '" height="' + b.h + '"' + (rr ? ' rx="' + rr + '"' : "") + s + "/>");
      }
      if (m.type === "ellipse") out.push('<ellipse cx="' + (b.x + b.w / 2) + '" cy="' + (b.y + b.h / 2) + '" rx="' + b.w / 2 + '" ry="' + b.h / 2 + '"' + s + "/>");
      if (m.type === "highlight") out.push('<rect x="' + b.x + '" y="' + b.y + '" width="' + b.w + '" height="' + b.h + '" fill="' + m.color + '" opacity=".55" style="mix-blend-mode:multiply"/>');
      if (LINE[m.type]) {
        var a = Math.atan2(m.y2 - m.y, m.x2 - m.x), hs = headSize(m), cut = m.type === "arrow" ? hs * 0.6 : 0;
        if (m.edge) out.push('<line x1="' + m.x + '" y1="' + m.y + '" x2="' + (m.x2 - cut * Math.cos(a)) + '" y2="' + (m.y2 - cut * Math.sin(a)) + '" stroke="' + m.edge + '" stroke-width="' + (m.stroke + 2 * Math.max(1, m.stroke / 2)) + '" stroke-linecap="round"/>');
        out.push('<line x1="' + m.x + '" y1="' + m.y + '" x2="' + (m.x2 - cut * Math.cos(a)) + '" y2="' + (m.y2 - cut * Math.sin(a)) + '"' + s + "/>");
        if (m.type === "arrow") out.push('<polygon fill="' + m.color + '"' + (m.edge ? ' stroke="' + m.edge + '" stroke-width="' + 2 * Math.max(1, m.stroke / 2) + '" stroke-linejoin="round" paint-order="stroke"' : "") + ' points="'  + [m.x2, m.y2, m.x2 - hs * Math.cos(a - 0.45), m.y2 - hs * Math.sin(a - 0.45), m.x2 - hs * Math.cos(a + 0.45), m.y2 - hs * Math.sin(a + 0.45)].map(function (v) { return Math.round(v * 10) / 10; }).join(" ") + '"/>');
      }
      if (m.type === "callout") {
        var r = m.size / 2;
        out.push('<circle cx="' + m.x + '" cy="' + m.y + '" r="' + r + '" fill="' + m.color + '" stroke="' + (m.edge || "#fff") + '" stroke-width="' + (m.edge ? Math.max(1, r / 12) : Math.max(2, r * 0.12)) + '"/>');
        out.push('<text x="' + m.x + '" y="' + m.y + '" dy=".36em" text-anchor="middle" font-family="Hanken, Arial, sans-serif" font-weight="700" font-size="' + Math.round(r * (m.n > 9 ? 0.95 : 1.15)) + '" fill="' + (m.edge ? "#0B2E16" : light(m.color) ? "#0B0B0C" : "#fff") + '">' + m.n + "</text>");
      }
      if (m.type === "text") {
        var lines = String(m.text || "").split("\n");
        if (m.box) {
          var cv = document.createElement("canvas").getContext("2d"), bb = A.bounds(cv, m);
          out.push('<rect x="' + bb.x + '" y="' + bb.y + '" width="' + bb.w + '" height="' + bb.h + '" fill="' + (light(m.color) ? "#0B0B0C" : "#fff") + '" opacity=".92"/>');
        }
        out.push('<text font-family="Hanken, Arial, sans-serif" font-weight="600" font-size="' + m.size + '" fill="' + m.color + '">' + lines.map(function (l, i) { return '<tspan x="' + m.x + '" y="' + (m.y + i * m.size * 1.25 + m.size * 0.92) + '">' + e(l) + "</tspan>"; }).join("") + "</text>");
      }
    });
    out.push("</svg>");
    return out.join("\n");
  };

  /* ---------- Changes to the image itself ---------- */
  function canvas(w, h) { var c = document.createElement("canvas"); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; }
  /** Paints over a part of the image itself. What was there can't be got back from the image, an export or a saved project. */
  A.redact = function (state, r) {
    var c = canvas(state.base.width, state.base.height), ctx = c.getContext("2d");
    ctx.drawImage(state.base, 0, 0); ctx.fillStyle = "#000"; ctx.fillRect(Math.floor(r.x), Math.floor(r.y), Math.ceil(r.w) + 1, Math.ceil(r.h) + 1);
    state.base = c;
  };
  A.crop = function (state, r) {
    r = { x: Math.max(0, Math.round(r.x)), y: Math.max(0, Math.round(r.y)), w: Math.round(r.w), h: Math.round(r.h) };
    r.w = Math.min(r.w, state.base.width - r.x); r.h = Math.min(r.h, state.base.height - r.y);
    if (r.w < 8 || r.h < 8) return false;
    var c = canvas(r.w, r.h); c.getContext("2d").drawImage(state.base, r.x, r.y, r.w, r.h, 0, 0, r.w, r.h);
    state.base = c;
    state.items.forEach(function (m) { m.x -= r.x; m.y -= r.y; if (LINE[m.type]) { m.x2 -= r.x; m.y2 -= r.y; } });
    return true;
  };
  A.resize = function (state, w) {
    var s = w / state.base.width, h = state.base.height * s;
    if (!(w >= 16 && w <= Kit.LIMITS.pixels && h >= 16 && h <= Kit.LIMITS.pixels)) return false;
    var c = canvas(w, h), ctx = c.getContext("2d"); ctx.imageSmoothingQuality = "high"; ctx.drawImage(state.base, 0, 0, c.width, c.height);
    state.base = c;
    state.items.forEach(function (m) {
      m.x *= s; m.y *= s; m.stroke = Math.max(1, m.stroke * s);
      if (BOX[m.type]) { m.w *= s; m.h *= s; }
      if (LINE[m.type]) { m.x2 *= s; m.y2 *= s; }
      if (m.size) m.size *= s;
    });
    return true;
  };
  /** Turns the image a quarter turn clockwise, and every mark with it. */
  A.rotate = function (state) {
    var W = state.base.width, H = state.base.height, c = canvas(H, W), ctx = c.getContext("2d");
    ctx.translate(H, 0); ctx.rotate(Math.PI / 2); ctx.drawImage(state.base, 0, 0);
    state.base = c;
    function p(x, y) { return [H - y, x]; }
    state.items.forEach(function (m) {
      if (BOX[m.type]) { var b = boxOf(m), q = p(b.x, b.y + b.h); m.x = q[0]; m.y = q[1]; m.w = b.h; m.h = b.w; }
      else { var a = p(m.x, m.y); m.x = a[0]; m.y = a[1]; if (LINE[m.type]) { var z = p(m.x2, m.y2); m.x2 = z[0]; m.y2 = z[1]; } }
    });
  };

  /* ---------- Project files ---------- */
  A.toProject = function (state) {
    return { app: "karandeshmukh.dev/studio/screenshots", version: 1, name: state.name || "screenshot", width: state.base.width, height: state.base.height,
      image: state.base.toDataURL("image/png"), items: state.items.map(function (m) { return A.clean(m, state.base.width, state.base.height); }).filter(Boolean) };
  };
  A.fromProject = function (p) {
    if (!p || p.app !== "karandeshmukh.dev/studio/screenshots" || p.version !== 1) return Promise.reject(new Error(T("This isn't a screenshot project saved by this studio.")));
    return Kit.imageFromData(p.image).then(function (img) {
      var base = Kit.canvasOf(img);
      return { name: String(p.name || "screenshot").slice(0, 80), base: base, items: (Array.isArray(p.items) ? p.items : []).slice(0, 500).map(function (m) { return A.clean(m, base.width, base.height); }).filter(Boolean) };
    });
  };

  /* ---------- The editor ---------- */
  var TOOLS = [
    ["select", T("Select and move"), "V", '<path d="M5 3l14 8-6 2-2 6z"/>'],
    ["arrow", T("Arrow"), "A", '<path d="M4 20L19 5M19 5h-8M19 5v8"/>'],
    ["line", T("Line"), "L", '<path d="M4 20L20 4"/>'],
    ["rect", T("Rectangle"), "R", '<rect x="4" y="6" width="16" height="12" rx="1"/>'],
    ["ellipse", T("Ellipse"), "E", '<ellipse cx="12" cy="12" rx="8" ry="6"/>'],
    ["callout", T("Numbered callout"), "N", '<circle cx="12" cy="12" r="8"/><path d="M11 9l2-1v8"/>'],
    ["text", T("Text"), "T", '<path d="M5 6h14M12 6v13"/>'],
    ["highlight", T("Highlight"), "H", '<path d="M4 18h16"/><rect x="6" y="6" width="12" height="9" fill="currentColor" opacity=".35" stroke="none"/>'],
    ["spotlight", T("Spotlight"), "S", '<rect x="3" y="4" width="18" height="16" fill="currentColor" opacity=".25" stroke="none"/><rect x="8" y="8" width="8" height="8"/>'],
    ["blur", T("Blur"), "B", '<circle cx="12" cy="12" r="7" stroke-dasharray="2 3"/>'],
    ["pixelate", T("Pixelate"), "P", '<path d="M4 4h5v5H4zM9 9h6v6H9zM15 15h5v5h-5zM15 4h5v5h-5zM4 15h5v5H4z"/>'],
    ["redact", T("Redact (permanent)"), "X", '<rect x="4" y="8" width="16" height="8" fill="currentColor"/>'],
    ["crop", T("Crop"), "C", '<path d="M7 3v14h14M3 7h14v14"/>'],
  ];
  function icon(path) { return '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + path + "</svg>"; }

  /**
   * Builds the editor inside an element.
   * opts.compact: a smaller toolbar for the step guides. opts.onChange(state): called after every change.
   * Returns {load(img|canvas, name), loadProject(p), state(), exportCanvas(), undo(), redo(), setTool(t)}.
   */
  A.editor = function (host, opts) {
    opts = opts || {};
    var st = { name: "screenshot", base: null, items: [] }, tool = "arrow", color = A.HOUSE.color, stroke = 2, sel = null, zoom = 1, drag = null, crop = null;
    var past = [], future = [];
    host.classList.add("ann");
    host.innerHTML =
      '<div class="ann-tools" role="toolbar" aria-label="' + T("Drawing tools") + '">' + TOOLS.map(function (t) {
        return '<button type="button" class="ann-tool" data-tool="' + t[0] + '" aria-pressed="false" title="' + t[1] + " (" + t[2] + ')" aria-label="' + t[1] + '" aria-keyshortcuts="' + t[2] + '">' + icon(t[3]) + "</button>";
      }).join("") + "</div>" +
      '<div class="ann-stage" tabindex="0" aria-label="' + T("Image. Draw with the selected tool; use the arrow keys to move the selected mark.") + '"><div class="ann-empty"><p>' + T("<b>No image yet.</b> Open a sample, open a file, paste an image or capture your screen.") + '</p></div><canvas class="ann-canvas" hidden></canvas></div>' +
      '<aside class="ann-side">' +
      ' <section class="ann-props" aria-label="' + T("Properties") + '"><h2>' + T("Style") + "</h2>" +
      '  <div class="ann-swatches" role="radiogroup" aria-label="' + T("Color") + '">' + A.COLORS.map(function (c) { return '<button type="button" role="radio" aria-checked="false" class="ann-sw" data-color="' + c + '" style="--c:' + c + '" aria-label="' + T("Color {hex}", { hex: c }) + '"></button>'; }).join("") + '<input type="color" class="ann-color" aria-label="' + T("Another color") + '" value="#E5251B"></div>' +
      '  <label class="ann-row">' + T("Stroke") + ' <input type="range" class="ann-stroke" min="1" max="30" value="2"><output class="ann-stroke-v">2</output></label>' +
      '  <div class="ann-sel" hidden><h2 class="ann-sel-name">' + T("Selected") + "</h2>" +
      '   <label class="ann-row ann-f-text" hidden>' + T("Text") + ' <textarea class="ann-text" rows="2" maxlength="500"></textarea></label>' +
      '   <label class="ann-row ann-f-size" hidden>' + T("Size") + ' <input type="number" class="ann-size" min="8" max="300"></label>' +
      '   <label class="ann-row ann-f-n" hidden>' + T("Number") + ' <input type="number" class="ann-n" min="1" max="999"></label>' +
      '   <label class="ann-row ann-f-amount" hidden>' + T("Strength") + ' <input type="range" class="ann-amount" min="2" max="60"></label>' +
      '   <label class="ann-row ann-f-box" hidden><input type="checkbox" class="ann-box"> ' + T("Background behind the text") + "</label>" +
      '   <div class="ann-row ann-pos"><label>X <input type="number" class="ann-x"></label><label>Y <input type="number" class="ann-y"></label></div>' +
      '   <p class="ann-btns"><button type="button" class="btn line sm ann-up">' + T("Bring forward") + '</button><button type="button" class="btn line sm ann-down">' + T("Send back") + '</button><button type="button" class="btn line sm ann-del">' + T("Delete") + "</button></p>" +
      "  </div>" +
      '  <div class="ann-cropbar" hidden><p>' + T("Drag over the part to keep, then apply.") + '</p><p class="ann-btns"><button type="button" class="btn ink sm ann-crop-ok">' + T("Apply crop") + '</button><button type="button" class="btn line sm ann-crop-no">' + T("Cancel") + "</button></p></div>" +
      '  <p class="ann-note ann-redact-note" hidden>' + T("Redaction paints over the pixels of the image itself. After you draw it, no export or saved project holds what was under it. Undo works only until you leave this page.") + "</p>" +
      " </section>" +
      ' <section class="ann-layers" aria-label="' + T("Layers") + '"><h2>' + T("Layers") + '</h2><ol class="ann-list"></ol><p class="ann-hint">' + T("Top of the list is drawn last.") + "</p></section>" +
      ' <section class="ann-image" aria-label="' + T("Image") + '"><h2>' + T("Image") + "</h2>" +
      '  <p class="ann-btns"><button type="button" class="btn line sm ann-rot">' + T("Rotate 90°") + "</button></p>" +
      '  <label class="ann-row">' + T("Width") + ' <input type="number" class="ann-w" min="16" max="8000"> px <button type="button" class="btn line sm ann-resize">' + T("Resize") + "</button></label>" +
      '  <div class="ann-row ann-zoom"><button type="button" class="btn line sm ann-zout" aria-label="' + T("Zoom out") + '">−</button><output class="ann-zv">100%</output><button type="button" class="btn line sm ann-zin" aria-label="' + T("Zoom in") + '">+</button><button type="button" class="btn line sm ann-zfit">' + T("Fit") + "</button></div>" +
      " </section>" +
      ' <section class="ann-hist" aria-label="' + T("History") + '"><h2>' + T("History") + '</h2><p class="ann-btns"><button type="button" class="btn line sm ann-undo" aria-keyshortcuts="Control+Z">' + T("Undo") + '</button><button type="button" class="btn line sm ann-redo" aria-keyshortcuts="Control+Shift+Z">' + T("Redo") + '</button></p><ol class="ann-log"></ol></section>' +
      "</aside>";
    var $ = function (s) { return host.querySelector(s); }, $$ = function (s) { return Array.prototype.slice.call(host.querySelectorAll(s)); };
    var cv = $(".ann-canvas"), ctx = cv.getContext("2d"), stage = $(".ann-stage");
    if (opts.compact) host.classList.add("compact");

    /* history */
    function snap(label) {
      past.push({ label: label, base: st.base, items: JSON.parse(JSON.stringify(st.items)) });
      if (past.length > 80) past.shift();
      future = [];
      logList();
    }
    function restore(s) { st.base = s.base; st.items = JSON.parse(JSON.stringify(s.items)); sel = null; fit(false); paint(); panel(); }
    function undo() { if (past.length < 2) return; future.push(past.pop()); restore(past[past.length - 1]); logList(); changed(); }
    function redo() { if (!future.length) return; var s = future.pop(); past.push(s); restore(s); logList(); changed(); }
    function logList() {
      $(".ann-log").innerHTML = past.slice(-12).reverse().map(function (p, i) { return "<li" + (i ? "" : ' class="now"') + ">" + Kit.esc(p.label) + "</li>"; }).join("");
      $(".ann-undo").disabled = past.length < 2; $(".ann-redo").disabled = !future.length;
    }
    function changed() { if (opts.onChange) opts.onChange(api); }
    function commit(label) { snap(label); paint(); panel(); changed(); }

    /* view */
    function fit(force) {
      if (!st.base) return;
      if (cv.width !== st.base.width || cv.height !== st.base.height) { cv.width = st.base.width; cv.height = st.base.height; paint(); }   // a new size clears the canvas
      if (force !== false) {
        var avail = Math.max(200, stage.clientWidth - 32), availH = Math.max(200, (opts.compact ? 420 : stage.clientHeight) - 32);
        zoom = Math.min(1, avail / st.base.width, availH / st.base.height);
      }
      setZoom(zoom);
    }
    function setZoom(z) {
      zoom = Math.max(0.05, Math.min(8, z));
      if (!st.base) return;
      cv.style.width = Math.round(st.base.width * zoom) + "px"; cv.style.height = Math.round(st.base.height * zoom) + "px";
      $(".ann-zv").textContent = Math.round(zoom * 100) + "%";
    }
    function paint() {
      if (!st.base) return;
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height); ctx.drawImage(st.base, 0, 0);
      st.items.forEach(function (m) { A.draw(ctx, m, st.base, cv.width, cv.height); });
      if (drag && drag.preview) A.draw(ctx, drag.preview, st.base, cv.width, cv.height);
      var px = 1 / zoom;
      if (sel) {
        var m = find(sel);
        if (m) {
          var b = A.bounds(ctx, m);
          ctx.save(); ctx.setLineDash([6 * px, 4 * px]); ctx.lineWidth = 1.5 * px; ctx.strokeStyle = "#1D4ED8"; ctx.strokeRect(b.x - 4 * px, b.y - 4 * px, b.w + 8 * px, b.h + 8 * px); ctx.setLineDash([]);
          handles(m).forEach(function (h) { ctx.fillStyle = "#fff"; ctx.strokeStyle = "#1D4ED8"; ctx.lineWidth = 2 * px; ctx.beginPath(); ctx.arc(h.x, h.y, 6 * px, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); });
          ctx.restore();
        }
      }
      if (crop) {
        var c = norm(crop);
        ctx.save(); ctx.fillStyle = "rgba(0,0,0,.5)"; ctx.beginPath(); ctx.rect(0, 0, cv.width, cv.height); ctx.rect(c.x, c.y, c.w, c.h); ctx.fill("evenodd");
        ctx.setLineDash([8 * px, 6 * px]); ctx.strokeStyle = "#FFDF2B"; ctx.lineWidth = 2 * px; ctx.strokeRect(c.x, c.y, c.w, c.h); ctx.restore();
      }
    }
    function norm(r) { return { x: Math.min(r.x, r.x + r.w), y: Math.min(r.y, r.y + r.h), w: Math.abs(r.w), h: Math.abs(r.h) }; }
    function find(id) { for (var i = 0; i < st.items.length; i++) if (st.items[i].id === id) return st.items[i]; return null; }
    function handles(m) {
      if (BOX[m.type]) { var b = boxOf(m); return [{ k: "br", x: b.x + b.w, y: b.y + b.h }]; }
      if (LINE[m.type]) return [{ k: "p1", x: m.x, y: m.y }, { k: "p2", x: m.x2, y: m.y2 }];
      return [];
    }
    function at(e) { var r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) / zoom, y: (e.clientY - r.top) / zoom }; }
    function hit(p) {
      for (var i = st.items.length - 1; i >= 0; i--) {
        var m = st.items[i]; if (m.hidden) continue;
        var b = A.bounds(ctx, m), pad = 8 / zoom + (m.stroke || 0) / 2;
        if (LINE[m.type]) { if (distSeg(p, m) < pad + 4 / zoom) return m; continue; }
        if (p.x >= b.x - pad && p.x <= b.x + b.w + pad && p.y >= b.y - pad && p.y <= b.y + b.h + pad) return m;
      }
      return null;
    }
    function distSeg(p, m) {
      var dx = m.x2 - m.x, dy = m.y2 - m.y, l = dx * dx + dy * dy, t = l ? Math.max(0, Math.min(1, ((p.x - m.x) * dx + (p.y - m.y) * dy) / l)) : 0;
      return Math.hypot(p.x - (m.x + t * dx), p.y - (m.y + t * dy));
    }
    function nextNumber() { var n = 0; st.items.forEach(function (m) { if (m.type === "callout") n = Math.max(n, m.n); }); return n + 1; }

    /* pointer */
    cv.addEventListener("pointerdown", function (e) {
      if (!st.base) return;
      e.preventDefault(); cv.setPointerCapture(e.pointerId); stage.focus({ preventScroll: true });
      var p = at(e);
      if (tool === "crop") { crop = { x: p.x, y: p.y, w: 0, h: 0 }; drag = { kind: "crop", from: p }; return; }
      if (tool === "select") {
        var cur = sel && find(sel);
        if (cur) {
          var hs = handles(cur);
          for (var i = 0; i < hs.length; i++) if (Math.hypot(hs[i].x - p.x, hs[i].y - p.y) < 10 / zoom) { drag = { kind: "handle", k: hs[i].k, id: cur.id, moved: false }; return; }
        }
        var m = hit(p); sel = m ? m.id : null; panel(); paint();
        if (m) drag = { kind: "move", id: m.id, from: p, orig: JSON.parse(JSON.stringify(m)), moved: false };
        return;
      }
      if (tool === "callout" || tool === "text") {
        var house = color.toLowerCase() === A.HOUSE.color.toLowerCase();
        var nm = A.clean({ id: A.id(), type: tool, x: p.x, y: p.y, color: color, stroke: stroke, edge: house ? A.HOUSE.edge : "", n: nextNumber(), size: tool === "text" ? Math.max(18, Math.round(st.base.width / 45)) : house ? Math.max(20, stroke * 12) : Math.max(28, Math.round(st.base.width / 36)), text: T("Type your text"), box: true }, st.base.width, st.base.height);
        st.items.push(nm); sel = nm.id; commit(T("Added {mark}", { mark: A.NOUNS[tool] }));
        if (tool === "text") { var ta = $(".ann-text"); ta.focus(); ta.select(); }
        return;
      }
      drag = { kind: "draw", from: p, preview: null };
    });
    cv.addEventListener("pointermove", function (e) {
      if (!drag) { if (tool === "select" && st.base) cv.style.cursor = hit(at(e)) ? "move" : "default"; return; }
      var p = at(e);
      if (drag.kind === "crop") { crop.w = p.x - crop.x; crop.h = p.y - crop.y; paint(); return; }
      if (drag.kind === "move") {
        var m = find(drag.id), dx = p.x - drag.from.x, dy = p.y - drag.from.y; drag.moved = true;
        m.x = drag.orig.x + dx; m.y = drag.orig.y + dy; if (LINE[m.type]) { m.x2 = drag.orig.x2 + dx; m.y2 = drag.orig.y2 + dy; }
        paint(); return;
      }
      if (drag.kind === "handle") {
        var h = find(drag.id); drag.moved = true;
        if (drag.k === "br") { var b = boxOf(h); h.x = b.x; h.y = b.y; h.w = Math.max(4, p.x - b.x); h.h = Math.max(4, p.y - b.y); }
        if (drag.k === "p1") { h.x = p.x; h.y = p.y; } if (drag.k === "p2") { h.x2 = p.x; h.y2 = p.y; }
        paint(); return;
      }
      var house = color.toLowerCase() === A.HOUSE.color.toLowerCase() && tool !== "highlight";
      var f = drag.from, base = { id: A.id(), type: tool, color: tool === "highlight" && (color === "#E5251B" || color === A.HOUSE.color) ? "#FFDF2B" : color, stroke: stroke, edge: house ? A.HOUSE.edge : "", radius: tool === "rect" && house ? Math.round(stroke * 1.5) : undefined, x: f.x, y: f.y, amount: tool === "pixelate" ? 14 : 10 };
      if (LINE[tool]) { base.x2 = p.x; base.y2 = p.y; } else { base.w = p.x - f.x; base.h = p.y - f.y; }
      drag.preview = tool === "redact" ? { type: "redact", x: base.x, y: base.y, w: base.w, h: base.h, color: "#000", stroke: 1 } : A.clean(base, st.base.width, st.base.height);
      if (drag.preview && BOX[tool]) { var nb = boxOf(base); drag.preview.x = nb.x; drag.preview.y = nb.y; drag.preview.w = Math.max(1, nb.w); drag.preview.h = Math.max(1, nb.h); }
      paint();
    });
    function end() {
      if (!drag) return;
      var d = drag; drag = null;
      if (d.kind === "crop") { paint(); return; }
      if (d.kind === "move" || d.kind === "handle") { if (d.moved) commit(T("Moved {mark}", { mark: A.NOUNS[find(d.id).type] })); return; }
      var m = d.preview;
      if (!m) { paint(); return; }
      var size = BOX[m.type] ? Math.min(m.w, m.h) : Math.hypot(m.x2 - m.x, m.y2 - m.y);
      if (size < 4) { paint(); return; }
      if (m.type === "redact") { A.redact(st, boxOf(m)); fit(false); commit(T("Redacted an area (permanent)")); return; }
      st.items.push(m); sel = m.id; commit(T("Added {mark}", { mark: A.NOUNS[m.type] }));
    }
    cv.addEventListener("pointerup", end);
    cv.addEventListener("pointercancel", function () { drag = null; paint(); });
    cv.addEventListener("dblclick", function () { if (sel && find(sel) && find(sel).type === "text") $(".ann-text").focus(); });

    /* keyboard */
    host.addEventListener("keydown", function (e) {
      var typing = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName);
      var mod = e.ctrlKey || e.metaKey;
      if (mod && !typing && e.key.toLowerCase() === "z") { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
      if (mod && !typing && e.key.toLowerCase() === "y") { e.preventDefault(); redo(); return; }
      if (typing || mod || e.altKey) return;
      if (crop && e.key === "Enter") { e.preventDefault(); applyCrop(); return; }
      if (e.key === "Escape") { if (crop) { crop = null; setTool("select"); } else { sel = null; panel(); } paint(); return; }
      var m = sel && find(sel);
      if (m && (e.key === "Delete" || e.key === "Backspace")) { e.preventDefault(); remove(m.id); return; }
      if (m && /^Arrow/.test(e.key)) {
        e.preventDefault();
        var s = e.shiftKey ? 10 : 1, dx = e.key === "ArrowLeft" ? -s : e.key === "ArrowRight" ? s : 0, dy = e.key === "ArrowUp" ? -s : e.key === "ArrowDown" ? s : 0;
        m.x += dx; m.y += dy; if (LINE[m.type]) { m.x2 += dx; m.y2 += dy; }
        clearTimeout(host._nudge); host._nudge = setTimeout(function () { commit(T("Moved {mark}", { mark: A.NOUNS[m.type] })); }, 400);
        paint(); panel(); return;
      }
      TOOLS.forEach(function (t) { if (e.key.toUpperCase() === t[2] && e.key.length === 1) { setTool(t[0]); e.preventDefault(); } });
    });

    /* controls */
    var HINTS = { select: T("Select a mark to move or resize it; the arrow keys nudge it. Delete removes it."), arrow: T("Drag from the tail to the head of the arrow."), line: T("Drag from one end to the other."), rect: T("Drag a box around the control."), ellipse: T("Drag an oval around the detail."), callout: T("Select where the number goes. Each callout takes the next number."), text: T("Select where the label starts, then type. Enter adds a line; Escape finishes."), highlight: T("Drag over the words or the area to highlight."), spotlight: T("Drag the area to keep bright; the rest dims."), blur: T("Drag the area to blur. A blur softens the background but can be reversed: to hide a secret, use Redact."), pixelate: T("Drag the area to pixelate. Pixelation can be reversed: to hide a secret, use Redact."), redact: T("Drag the area to black out. It is burned into the picture at once and can't be undone later."), crop: T("Drag the part to keep, then select Apply crop.") };
    function setTool(t, quiet) {
      if (crop && t !== "crop") crop = null;
      tool = t;
      if (!quiet && opts.status && HINTS[t]) opts.status(HINTS[t]);
      $$(".ann-tool").forEach(function (b) { b.setAttribute("aria-pressed", b.dataset.tool === t); });
      $(".ann-cropbar").hidden = t !== "crop"; $(".ann-redact-note").hidden = t !== "redact";
      cv.style.cursor = t === "select" ? "default" : "crosshair";
      paint();
    }
    $$(".ann-tool").forEach(function (b) { b.addEventListener("click", function () { setTool(b.dataset.tool); }); });
    function setColor(c) {
      color = c; $(".ann-color").value = c;
      $$(".ann-sw").forEach(function (b) { b.setAttribute("aria-checked", b.dataset.color.toLowerCase() === c.toLowerCase()); });
      var m = sel && find(sel); if (m && m.type !== "redact") { m.color = c; if (c.toLowerCase() === A.HOUSE.color.toLowerCase() && m.type !== "highlight") m.edge = A.HOUSE.edge; else delete m.edge; commit(T("Changed color")); }
    }
    $$(".ann-sw").forEach(function (b) { b.addEventListener("click", function () { setColor(b.dataset.color); }); });
    $(".ann-color").addEventListener("change", function () { setColor(this.value); });
    $(".ann-stroke").addEventListener("input", function () { stroke = +this.value; $(".ann-stroke-v").textContent = stroke; var m = sel && find(sel); if (m) { m.stroke = stroke; paint(); } });
    $(".ann-stroke").addEventListener("change", function () { if (sel && find(sel)) commit(T("Changed stroke")); });
    function field(cls, key, label, parse) {
      var el = $(cls);
      el.addEventListener("input", function () { var m = sel && find(sel); if (!m) return; m[key] = parse ? parse(el) : el.value; paint(); });
      el.addEventListener("change", function () { if (sel && find(sel)) commit(label); });
    }
    field(".ann-text", "text", T("Edited text"));
    field(".ann-size", "size", T("Changed size"), function (el) { return num(el.value, 8, 300, 28); });
    field(".ann-n", "n", T("Changed number"), function (el) { return Math.round(num(el.value, 1, 999, 1)); });
    field(".ann-amount", "amount", T("Changed strength"), function (el) { return num(el.value, 2, 60, 12); });
    field(".ann-box", "box", T("Changed text background"), function (el) { return el.checked; });
    field(".ann-x", "x", T("Moved"), function (el) { var m = find(sel), v = +el.value || 0; if (LINE[m.type]) { m.x2 += v - m.x; } return v; });
    field(".ann-y", "y", T("Moved"), function (el) { var m = find(sel), v = +el.value || 0; if (LINE[m.type]) { m.y2 += v - m.y; } return v; });
    function remove(id) { st.items = st.items.filter(function (m) { return m.id !== id; }); sel = null; commit(T("Deleted a mark")); }
    function move(id, by) {
      var i = st.items.findIndex(function (m) { return m.id === id; }), j = i + by;
      if (i < 0 || j < 0 || j >= st.items.length) return;
      var t = st.items[i]; st.items[i] = st.items[j]; st.items[j] = t; commit(by > 0 ? T("Brought forward") : T("Sent back"));
    }
    $(".ann-del").addEventListener("click", function () { if (sel) remove(sel); });
    $(".ann-up").addEventListener("click", function () { if (sel) move(sel, 1); });
    $(".ann-down").addEventListener("click", function () { if (sel) move(sel, -1); });
    $(".ann-undo").addEventListener("click", undo); $(".ann-redo").addEventListener("click", redo);
    $(".ann-rot").addEventListener("click", function () { if (!st.base) return; A.rotate(st); fit(); commit(T("Rotated 90°")); });
    $(".ann-resize").addEventListener("click", function () {
      if (!st.base) return; var w = Math.round(+$(".ann-w").value);
      if (A.resize(st, w)) { fit(); commit(T("Resized to {w} px wide", { w: w })); } else if (opts.status) opts.status(T("Choose a width between 16 and 8,000 pixels."), true);
    });
    $(".ann-zin").addEventListener("click", function () { setZoom(zoom * 1.25); });
    $(".ann-zout").addEventListener("click", function () { setZoom(zoom / 1.25); });
    $(".ann-zfit").addEventListener("click", function () { fit(); });
    stage.addEventListener("wheel", function (e) { if (!e.ctrlKey || !st.base) return; e.preventDefault(); setZoom(zoom * (e.deltaY < 0 ? 1.1 : 1 / 1.1)); }, { passive: false });
    function applyCrop() {
      if (!crop) return;
      var r = norm(crop); crop = null;
      if (A.crop(st, r)) { fit(); commit(T("Cropped to {w} × {h}", { w: Math.round(r.w), h: Math.round(r.h) })); } else paint();
      setTool("select");
    }
    $(".ann-crop-ok").addEventListener("click", applyCrop);
    $(".ann-crop-no").addEventListener("click", function () { crop = null; setTool("select"); });

    function panel() {
      var m = sel && find(sel), box = $(".ann-sel");
      box.hidden = !m;
      if (m) {
        $(".ann-sel-name").textContent = A.NAMES[m.type];
        $(".ann-f-text").hidden = m.type !== "text"; $(".ann-f-box").hidden = m.type !== "text";
        $(".ann-f-size").hidden = !(m.type === "text" || m.type === "callout");
        $(".ann-f-n").hidden = m.type !== "callout"; $(".ann-f-amount").hidden = !(m.type === "blur" || m.type === "pixelate");
        if (m.type === "text") { $(".ann-text").value = m.text; $(".ann-box").checked = m.box; }
        if (m.size) $(".ann-size").value = Math.round(m.size);
        if (m.n) $(".ann-n").value = m.n;
        if (m.amount) $(".ann-amount").value = m.amount;
        $(".ann-x").value = Math.round(m.x); $(".ann-y").value = Math.round(m.y);
        $(".ann-stroke").value = Math.round(m.stroke); $(".ann-stroke-v").textContent = Math.round(m.stroke);
      }
      if (st.base) $(".ann-w").value = st.base.width;
      $(".ann-list").innerHTML = st.items.slice().reverse().map(function (it) {
        var label = A.NAMES[it.type] + (it.type === "callout" ? " " + it.n : it.type === "text" ? ": " + String(it.text).slice(0, 24) : "");
        return '<li class="' + (it.id === sel ? "on" : "") + '" data-id="' + it.id + '"><button type="button" class="ann-pick" aria-pressed="' + (it.id === sel) + '"><span class="ann-dot" style="background:' + it.color + '"></span>' + Kit.esc(label) + "</button>" +
          '<button type="button" class="ann-eye" aria-pressed="' + !it.hidden + '" aria-label="' + Kit.esc(it.hidden ? T("Show {mark}", { mark: label }) : T("Hide {mark}", { mark: label })) + '">' + (it.hidden ? T("Hidden") : T("Shown")) + "</button></li>";
      }).join("") || '<li class="ann-none">' + T("No marks yet.") + "</li>";
    }
    $(".ann-list").addEventListener("click", function (e) {
      var li = e.target.closest("li[data-id]"); if (!li) return;
      var m = find(li.dataset.id);
      if (e.target.closest(".ann-eye")) { m.hidden = !m.hidden; commit(m.hidden ? T("Hid a mark") : T("Showed a mark")); return; }
      sel = m.id; panel(); paint();
    });

    function load(img, name) {
      st = { name: name || "screenshot", base: img.tagName === "CANVAS" ? img : Kit.canvasOf(img), items: [] };
      // The house stroke for this picture: 2 px at screen density, 4 px for a high-density capture.
      stroke = A.houseStroke(st.base.width); var sl = $(".ann-stroke"); if (sl) { sl.value = stroke; $(".ann-stroke-v").textContent = stroke; }
      sel = null; crop = null; past = []; future = [];
      $(".ann-empty").hidden = true; cv.hidden = false; host.classList.add("has-image");
      requestAnimationFrame(function () { fit(); paint(); });
      fit(); snap(T("Opened {name}", { name: st.name })); paint(); panel(); changed();
    }
    var api = {
      load: load,
      loadProject: function (p) { return A.fromProject(p).then(function (s) { load(s.base, s.name); st.items = s.items; past = []; snap(T("Opened project {name}", { name: s.name })); paint(); panel(); changed(); }); },
      state: function () { return st; },
      hasImage: function () { return !!st.base; },
      exportCanvas: function () { return A.flatten(st); },
      project: function () { return A.toProject(st); },
      svg: function () { return A.toSVG(st); },
      undo: undo, redo: redo, setTool: setTool, fit: fit,
      history: function () { return past.map(function (p) { return p.label; }); },
    };
    setTool(opts.tool || "arrow", true); setColor(color); logList(); panel();
    // Text marks use the site's own typeface; draw again once it has loaded.
    if (document.fonts && document.fonts.load) document.fonts.load("600 20px Hanken").then(function () { paint(); }, function () {});
    addEventListener("resize", function () { if (st.base) { fit(); paint(); } });
    return api;
  };

  root.Annotate = A;
})(typeof window !== "undefined" ? window : globalThis);
