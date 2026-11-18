/* /studio/video: a training-video editor that renders a real file in the browser.
   Footage is cut into clips on one track. Titles, arrows, boxes, callouts, warnings, zoom and blur regions, captions,
   a cursor drawn from recorded pointer events, and narration are layers over it, each with its own time.
   One function draws a frame at a time t; the preview and the export both use it, so the file shows what the preview shows.
   The export plays the timeline once in real time, records the canvas and the mixed sound with MediaRecorder, and checks
   that the file it made can be played. Nothing is uploaded. Needs kit.js. */
(function () {
  "use strict";
  var T = Kit.t;
  var $ = function (s, r) { return (r || document).querySelector(s); }, $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var esc = Kit.esc, status = $("#vd-status");
  function say(t, bad) { Kit.say(status, t, bad); }
  function fail(e) { say(e && e.message ? e.message : String(e), true); }
  var W = 1280, H = 720, FPS = 30;
  var cv = $("#vd-canvas"), ctx = cv.getContext("2d");
  cv.width = W; cv.height = H;

  /* ---------- The project ---------- */
  var MEDIA = {};                       // id -> {kind, name, blob, url, el, duration, w, h, cursor: [{t,x,y,click}]}
  var P = blank(), sel = null, playhead = 0, playing = false;
  function blank() {
    return { version: 1, name: "training-video", clips: [], overlays: [], captions: [], markers: [], narration: null, clipVolume: 1, burnCaptions: true,
      cursor: { show: true, size: 1, halo: true, ripple: true, spotlight: false, numbers: false, follow: false, factor: 1.6 } };
  }
  var uid = function (p) { return (p || "x") + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); };
  function duration() { return P.clips.reduce(function (s, c) { return s + (c.out - c.in); }, 0); }
  /** The clip under timeline time t, with its start on the timeline. */
  function clipAt(t) {
    var acc = 0;
    for (var i = 0; i < P.clips.length; i++) { var c = P.clips[i], d = c.out - c.in; if (t < acc + d || i === P.clips.length - 1) return { clip: c, start: acc, index: i }; acc += d; }
    return null;
  }
  function clipStart(c) { var acc = 0; for (var i = 0; i < P.clips.length; i++) { if (P.clips[i] === c) return acc; acc += P.clips[i].out - P.clips[i].in; } return 0; }

  /* ---------- Media ---------- */
  var VIDEO = ["video/mp4", "video/webm", "video/quicktime"], AUDIO = ["audio/mpeg", "audio/mp4", "audio/wav", "audio/x-wav", "audio/webm", "audio/ogg", "audio/aac", "video/webm"];
  function addMedia(blob, name, kind, cursor) {
    var limit = kind === "audio" ? Kit.LIMITS.audio : kind === "image" ? Kit.LIMITS.image : Kit.LIMITS.video;
    if (blob.size > limit) return Promise.reject(new Error(T("{name} is larger than {mb} MB.", { name: name, mb: Math.round(limit / 1048576) })));
    var id = uid("m"), url = URL.createObjectURL(blob), m = { id: id, kind: kind, name: name, blob: blob, url: url, cursor: cursor || [] };
    return new Promise(function (ok, no) {
      if (kind === "image") {
        var img = new Image(); img.onload = function () { m.el = img; m.w = img.naturalWidth; m.h = img.naturalHeight; m.duration = 4; ok(m); };
        img.onerror = function () { no(new Error(T("{name} can't be read as an image.", { name: name }))); }; img.src = url; return;
      }
      var el = document.createElement(kind === "audio" ? "audio" : "video");
      el.preload = "auto"; el.muted = false; el.playsInline = true; el.crossOrigin = "anonymous";
      el.onloadedmetadata = function () {
        if (!isFinite(el.duration)) {      // a recording made in the browser may not know its length until it has been read to the end
          el.currentTime = 1e9;
          el.ontimeupdate = function () { el.ontimeupdate = null; m.duration = el.duration; el.currentTime = 0; done(); };
          return;
        }
        m.duration = el.duration; done();
      };
      function done() { m.el = el; m.w = el.videoWidth || 0; m.h = el.videoHeight || 0; ok(m); }
      el.onerror = function () { no(new Error(T("{name} can't be played in this browser.", { name: name }))); };
      el.src = url;
    }).then(function (m2) { MEDIA[id] = m2; return m2; });
  }
  function addClip(m) {
    P.clips.push({ id: uid("c"), media: m.id, in: 0, out: m.kind === "image" ? 4 : Math.max(0.1, m.duration) });
  }

  /* ---------- Cursor ---------- */
  /** The pointer events of the whole timeline, in timeline seconds: each clip keeps the events of its stretch of footage. */
  function timelineEvents() {
    var out = [], acc = 0, n = 0;
    P.clips.forEach(function (c) {
      var m = MEDIA[c.media];
      (m && m.cursor || []).forEach(function (e) { if (!e.id) e.id = uid("e"); if (e.t >= c.in && e.t < c.out) out.push({ t: acc + e.t - c.in, x: e.x * W / (m.w || W), y: e.y * H / (m.h || H), click: !!e.click, src: e, clip: c }); });
      acc += c.out - c.in;
    });
    out.sort(function (a, b) { return a.t - b.t; });
    out.forEach(function (e) { if (e.click) e.n = ++n; });
    return out;
  }
  var ease = function (k) { return k < 0 ? 0 : k > 1 ? 1 : k * k * (3 - 2 * k); };
  function pointerAt(ev, t) {
    if (!ev.length) return null;
    if (t <= ev[0].t) return ev[0].t - t < 0.5 ? { x: ev[0].x, y: ev[0].y } : null;
    for (var i = 1; i < ev.length; i++) {
      if (t < ev[i].t) {
        var a = ev[i - 1], b = ev[i], gap = b.t - a.t;
        if (gap > 4 || a.clip !== b.clip) return { x: a.x, y: a.y };          // a long gap or a cut: the pointer rests
        var k = ease((t - a.t) / gap);
        return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k };
      }
    }
    var last = ev[ev.length - 1]; return t - last.t < 3 ? { x: last.x, y: last.y } : null;
  }

  /* ---------- Camera: zoom regions, and zoom that follows the pointer around each click ---------- */
  function camera(t, ev) {
    var z = 1, cx = W / 2, cy = H / 2;
    var zr = P.overlays.filter(function (o) { return o.type === "zoom" && t >= o.start - 0.5 && t <= o.end + 0.5; })[0];
    if (zr) {
      var k = Math.min(ease((t - (zr.start - 0.5)) / 0.5), ease((zr.end + 0.5 - t) / 0.5));
      var target = Math.min(4, W / Math.max(40, zr.w * W));
      z = 1 + (target - 1) * k; cx = W / 2 + ((zr.x + zr.w / 2) * W - W / 2) * k; cy = H / 2 + ((zr.y + zr.h / 2) * H - H / 2) * k;
    } else if (P.cursor.follow && ev.length) {
      // The zoom rises before a click and settles after it. Clicks less than three seconds apart share one zoom, so the picture doesn't pump.
      var env = 0, clicks = ev.filter(function (e) { return e.click; });
      clicks.forEach(function (e, i) {
        var next = clicks[i + 1], hold = next && next.t - e.t < 3 ? next.t : e.t + 1.6;
        env = Math.max(env, Math.min(ease((t - (e.t - 1.0)) / 0.7), ease((hold - t) / 0.7)));
      });
      if (env > 0) {
        var sx = 0, sy = 0, n = 0;
        for (var s = 0; s < 10; s++) { var p = pointerAt(ev, t - s * 0.1); if (p) { sx += p.x; sy += p.y; n++; } }
        if (n) { z = 1 + (P.cursor.factor - 1) * env; cx = W / 2 + (sx / n - W / 2) * env; cy = H / 2 + (sy / n - H / 2) * env; }
      }
    }
    var hw = W / 2 / z, hh = H / 2 / z;
    cx = Math.max(hw, Math.min(W - hw, cx)); cy = Math.max(hh, Math.min(H - hh, cy));
    return { z: z, x: cx - hw, y: cy - hh };
  }

  /* ---------- Drawing one frame ---------- */
  // The house annotation green and its dark keyline (standards/screenshots.md), at the video scale of 1.5.
  var HOUSE = "#6CE975", EDGE = "#0E5A2B";
  var COLORS = { title: "#0B0B0C", step: HOUSE, arrow: HOUSE, box: HOUSE, callout: HOUSE, warning: "#C62828", instruction: "#0B0B0C", zoom: "#1D4ED8", blur: "#1D4ED8", intro: "#0B0B0C", outro: "#0B0B0C", lower: "#0B0B0C", done: "#0D9A57" };
  var TYPES = { title: T("Title"), step: T("Step number"), arrow: T("Arrow"), box: T("Highlight box"), callout: T("Callout"), warning: T("Warning"), instruction: T("Instruction"), done: T("Confirmation"), zoom: T("Zoom region"), blur: T("Blur region"), intro: T("Intro slide"), outro: T("Closing slide"), lower: T("Lower-third label") };
  var WORLD = { arrow: 1, box: 1, callout: 1, blur: 1, step: 1 };          // drawn in the picture, so they zoom with it
  function font(px, w) { return (w || 600) + " " + Math.round(px) + "px 'Hanken', Arial, sans-serif"; }
  function fade(o, t) { var f = o.type === "intro" || o.type === "outro" ? 0.5 : 0.25; return Math.min(1, o.start <= 0 ? 1 : (t - o.start) / f, (o.end - t) / f); }   // a slide that opens the video is there from the first frame
  function wrap(text, max, px) {
    ctx.font = font(px); var words = String(text || "").split(/\s+/), lines = [], line = "";
    words.forEach(function (w) { var test = line ? line + " " + w : w; if (ctx.measureText(test).width > max && line) { lines.push(line); line = w; } else line = test; });
    if (line) lines.push(line);
    return lines;
  }
  function source(c) { var m = MEDIA[c.media]; return m && m.el; }
  function drawSource(el, m) {
    var sw = m.w || W, sh = m.h || H, s = Math.min(W / sw, H / sh), dw = sw * s, dh = sh * s;
    ctx.fillStyle = "#0B0B0C"; ctx.fillRect(0, 0, W, H);
    try { ctx.drawImage(el, (W - dw) / 2, (H - dh) / 2, dw, dh); } catch (e) { /* not ready yet */ }
  }
  function drawWorld(o, t) {
    var a = fade(o, t); if (a <= 0) return;
    var x = o.x * W, y = o.y * H, w = o.w * W, h = o.h * H, c = o.color || COLORS[o.type];
    var house = String(c).toLowerCase() === HOUSE.toLowerCase();
    ctx.save(); ctx.globalAlpha = a; ctx.strokeStyle = ctx.fillStyle = c; ctx.lineWidth = house ? 4 : 6; ctx.lineCap = ctx.lineJoin = "round";
    if (o.type === "box") {
      // The house box: 4 px of green with a 2 px dark keyline outside it and 5 px corners; it never covers the control.
      if (house) { ctx.save(); ctx.strokeStyle = EDGE; ctx.lineWidth = 2; roundRect(x - 3, y - 3, w + 6, h + 6, 8); ctx.stroke(); ctx.restore(); roundRect(x, y, w, h, 5); ctx.stroke(); }
      else ctx.strokeRect(x, y, w, h);
    }
    else if (o.type === "arrow") {
      var x2 = x + w, y2 = y + h, ang = Math.atan2(y2 - y, x2 - x), s = house ? 24 : 26, cut = house ? 14 : 14;
      if (house) { ctx.save(); ctx.strokeStyle = EDGE; ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x2 - cut * Math.cos(ang), y2 - cut * Math.sin(ang)); ctx.stroke(); ctx.restore(); }
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x2 - cut * Math.cos(ang), y2 - cut * Math.sin(ang)); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x2, y2); ctx.lineTo(x2 - s * Math.cos(ang - 0.45), y2 - s * Math.sin(ang - 0.45)); ctx.lineTo(x2 - s * Math.cos(ang + 0.45), y2 - s * Math.sin(ang + 0.45)); ctx.closePath();
      if (house) { ctx.save(); ctx.strokeStyle = EDGE; ctx.lineWidth = 4; ctx.stroke(); ctx.restore(); }
      ctx.fill();
    } else if (o.type === "step") {
      var r = (o.size || (house ? 30 : 36)) / 2 * (house ? 1 : 1.2);
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); ctx.lineWidth = house ? 2 : 4; ctx.strokeStyle = house ? EDGE : "#fff"; ctx.stroke();
      ctx.fillStyle = house ? "#0B2E16" : "#fff"; ctx.font = font(r * 1.15, 700); ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(String(o.text || "1"), x, y + 1);
    } else if (o.type === "callout") {
      var px = o.size || 26, lines = wrap(o.text, Math.max(120, w), px), bw = 0;
      ctx.font = font(px); lines.forEach(function (l) { bw = Math.max(bw, ctx.measureText(l).width); });
      var bh = lines.length * px * 1.3 + px * 0.8;
      ctx.fillStyle = "#fff"; ctx.strokeStyle = c; ctx.lineWidth = 4; roundRect(x, y, bw + px * 1.2, bh, 10); ctx.fill(); ctx.stroke();
      ctx.fillStyle = "#0B0B0C"; ctx.textBaseline = "top"; lines.forEach(function (l, i) { ctx.fillText(l, x + px * 0.6, y + px * 0.45 + i * px * 1.3); });
    }
    ctx.restore();
  }
  function roundRect(x, y, w, h, r) { ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x, y, w, h, r); else ctx.rect(x, y, w, h); }
  function drawScreen(o, t) {
    var a = fade(o, t); if (a <= 0) return;
    ctx.save(); ctx.globalAlpha = a;
    var c = o.color || COLORS[o.type], px = o.size || 30;
    if (o.type === "intro" || o.type === "outro") {
      ctx.fillStyle = "#FFFFFF"; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "#FFDF2B"; ctx.fillRect(96, H / 2 - 80, 72, 10);
      ctx.fillStyle = c; ctx.font = font(px * 2, 700); ctx.textBaseline = "top";
      var lines = wrap(String(o.text || "").split("\n")[0], W - 192, px * 2);
      ctx.font = font(px * 2, 700); lines.forEach(function (l, i) { ctx.fillText(l, 96, H / 2 - 50 + i * px * 2.3); });
      var sub = String(o.text || "").split("\n").slice(1).join(" ");
      if (sub) { ctx.fillStyle = "#3B3D42"; ctx.font = font(px * 0.85, 500); wrap(sub, W - 192, px * 0.85).forEach(function (l, i) { ctx.font = font(px * 0.85, 500); ctx.fillText(l, 96, H / 2 - 40 + lines.length * px * 2.3 + i * px * 1.25); }); }
    } else if (o.type === "title" || o.type === "instruction" || o.type === "warning") {
      var ls = wrap(o.text, W * 0.6, px), bw = 0; ctx.font = font(px, o.type === "title" ? 700 : 600); ls.forEach(function (l) { bw = Math.max(bw, ctx.measureText(l).width); });
      var pad = px * 0.6, bh = ls.length * px * 1.3 + pad * 1.4, x = o.x * W, y = o.y * H;
      ctx.fillStyle = o.type === "warning" ? "#FDECEA" : "#FFFFFF"; roundRect(x, y, bw + pad * 2 + (o.type === "warning" ? px * 1.4 : 0), bh, 10); ctx.fill();
      if (o.type === "warning") { ctx.fillStyle = c; ctx.fillRect(x, y, 8, bh); ctx.font = font(px, 800); ctx.fillText("!", x + pad + 2, y + pad + px * 0.95); }
      else { ctx.fillStyle = "#FFDF2B"; ctx.fillRect(x, y + bh - 6, bw + pad * 2, 6); }
      ctx.fillStyle = o.type === "warning" ? "#7A1010" : c; ctx.textBaseline = "top"; ctx.font = font(px, o.type === "title" ? 700 : 600);
      ls.forEach(function (l, i) { ctx.fillText(l, x + pad + (o.type === "warning" ? px * 1.4 : 0), y + pad * 0.7 + i * px * 1.3); });
    } else if (o.type === "done") {
      // A confirmation: a green pill with a check mark, for the moment an action has visibly worked.
      ctx.font = font(px, 700); var dw = ctx.measureText(o.text || T("Done")).width, dx = o.x * W, dy = o.y * H, dh = px * 1.9, pop = Math.min(1, (t - o.start) / 0.3);
      ctx.translate(dx + (dw + px * 2.6) / 2, dy + dh / 2); ctx.scale(0.85 + 0.15 * pop, 0.85 + 0.15 * pop); ctx.translate(-(dx + (dw + px * 2.6) / 2), -(dy + dh / 2));
      ctx.fillStyle = c; roundRect(dx, dy, dw + px * 2.6, dh, dh / 2); ctx.fill();
      ctx.strokeStyle = "#fff"; ctx.lineWidth = Math.max(3, px * 0.14); ctx.lineCap = ctx.lineJoin = "round";
      ctx.beginPath(); ctx.moveTo(dx + px * 0.75, dy + dh * 0.52); ctx.lineTo(dx + px * 1.05, dy + dh * 0.7); ctx.lineTo(dx + px * 1.55, dy + dh * 0.32); ctx.stroke();
      ctx.fillStyle = "#fff"; ctx.textBaseline = "middle"; ctx.fillText(o.text || T("Done"), dx + px * 1.95, dy + dh / 2 + 1);
    } else if (o.type === "lower") {
      var y2 = H - 250; ctx.font = font(px, 700); var tw = ctx.measureText(o.text || "").width;
      ctx.fillStyle = "#0B0B0C"; ctx.fillRect(64, y2, tw + 48, px * 1.8); ctx.fillStyle = "#FFDF2B"; ctx.fillRect(64, y2, 8, px * 1.8);
      ctx.fillStyle = "#fff"; ctx.textBaseline = "middle"; ctx.fillText(o.text || "", 64 + 28, y2 + px * 0.92);
    }
    ctx.restore();
  }
  function drawCaption(t) {
    var c = P.captions.filter(function (x) { return t >= x.start && t < x.end; })[0];
    if (!c) return;
    var px = 32, ls = wrap(c.text, W * 0.8, px).slice(0, 3), bw = 0;
    ctx.save(); ctx.font = font(px, 600); ls.forEach(function (l) { bw = Math.max(bw, ctx.measureText(l).width); });
    var bh = ls.length * px * 1.3 + 20, y = H - 56 - bh;
    ctx.fillStyle = "rgba(11,11,12,.82)"; roundRect(W / 2 - bw / 2 - 18, y, bw + 36, bh, 8); ctx.fill();
    ctx.fillStyle = "#fff"; ctx.textAlign = "center"; ctx.textBaseline = "top"; ls.forEach(function (l, i) { ctx.fillText(l, W / 2, y + 10 + i * px * 1.3); });
    ctx.restore();
  }
  function drawCursor(ev, t, cam) {
    var p = pointerAt(ev, t); if (!p || !P.cursor.show) return;
    var s = P.cursor.size, x = (p.x - cam.x) * cam.z, y = (p.y - cam.y) * cam.z;
    if (P.cursor.spotlight) { ctx.save(); ctx.fillStyle = "rgba(11,11,12,.45)"; ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.arc(x, y, 150 * s, 0, Math.PI * 2, true); ctx.fill(); ctx.restore(); }
    var pressed = 0;
    ev.forEach(function (e) {
      if (!e.click) return;
      var d = t - e.t;
      if (d >= -0.12 && d < 0.15) pressed = Math.max(pressed, 1 - Math.abs(d) / 0.15);
      if (P.cursor.ripple && d >= 0 && d < 0.7) {
        var ex = (e.x - cam.x) * cam.z, ey = (e.y - cam.y) * cam.z;
        // The click ring, in the house green over a dark keyline, gone in 0.7 seconds.
        ctx.save(); ctx.lineWidth = 6 * s; ctx.strokeStyle = "rgba(14,90,43," + (1 - d / 0.7) + ")"; ctx.beginPath(); ctx.arc(ex, ey, (14 + d * 60) * s, 0, Math.PI * 2); ctx.stroke();
        ctx.lineWidth = 3 * s; ctx.strokeStyle = "rgba(108,233,117," + (1 - d / 0.7) + ")"; ctx.stroke(); ctx.restore();
      }
      if (P.cursor.numbers && d >= 0 && d < 2.2) {
        var nx = (e.x - cam.x) * cam.z + 30 * s, ny = (e.y - cam.y) * cam.z - 30 * s;
        ctx.save(); ctx.globalAlpha = Math.min(1, (2.2 - d) / 0.3); ctx.fillStyle = HOUSE; ctx.beginPath(); ctx.arc(nx, ny, 17 * s, 0, Math.PI * 2); ctx.fill(); ctx.lineWidth = 2 * s; ctx.strokeStyle = EDGE; ctx.stroke();
        ctx.fillStyle = "#0B2E16"; ctx.font = font(19 * s, 700); ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(String(e.n), nx, ny + 1); ctx.restore();
      }
    });
    if (P.cursor.halo) { ctx.save(); ctx.fillStyle = "rgba(255,223,43,.45)"; ctx.beginPath(); ctx.arc(x, y, (28 - pressed * 8) * s, 0, Math.PI * 2); ctx.fill(); ctx.restore(); }
    // The arrow pointer, drawn at a constant size whatever the zoom.
    ctx.save(); ctx.translate(x, y); ctx.scale(s * (1 - pressed * 0.15), s * (1 - pressed * 0.15));
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 30); ctx.lineTo(7.5, 23); ctx.lineTo(13, 35); ctx.lineTo(18, 33); ctx.lineTo(12.5, 21.5); ctx.lineTo(22, 21.5); ctx.closePath();
    ctx.fillStyle = "#0B0B0C"; ctx.strokeStyle = "#fff"; ctx.lineWidth = 2.4; ctx.fill(); ctx.stroke(); ctx.restore();
  }
  /** Draws the frame at timeline time t. The picture of the clip must already show the right moment. */
  function frame(t) {
    var hit = clipAt(t), ev = timelineEvents(), cam = camera(t, ev);
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, W, H);
    ctx.setTransform(cam.z, 0, 0, cam.z, -cam.x * cam.z, -cam.y * cam.z);
    if (hit) drawSource(source(hit.clip), MEDIA[hit.clip.media]);
    else {
      // Nothing on the timeline yet: say so in the frame instead of showing a black picture.
      ctx.fillStyle = "#1E1F23"; ctx.fillRect(0, 0, W, H); ctx.fillStyle = "#FFDF2B"; ctx.fillRect(96, H / 2 - 64, 72, 10);
      ctx.fillStyle = "#fff"; ctx.font = font(40, 700); ctx.textBaseline = "top"; ctx.fillText(T("No footage yet"), 96, H / 2 - 36);
      ctx.fillStyle = "#B7B9BF"; ctx.font = font(26, 500); ctx.fillText(T("Open a sample, add a recording, or record the screen or the demo app."), 96, H / 2 + 22);
    }
    var live = P.overlays.filter(function (o) { return t >= o.start && t < o.end; }).sort(function (a, b) { return (a.layer || 0) - (b.layer || 0); });
    live.forEach(function (o) {
      if (o.type === "blur") {
        ctx.save(); ctx.beginPath(); ctx.rect(o.x * W, o.y * H, o.w * W, o.h * H); ctx.clip(); ctx.filter = "blur(18px)";
        if (hit) drawSource(source(hit.clip), MEDIA[hit.clip.media]); ctx.restore();
      }
    });
    live.forEach(function (o) { if (WORLD[o.type] && o.type !== "blur") drawWorld(o, t); });
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    // No pointer over an intro or a closing slide: they cover the picture.
    if (!live.some(function (o) { return (o.type === "intro" || o.type === "outro") && fade(o, t) > 0.5; })) drawCursor(ev, t, cam);
    live.forEach(function (o) { if (!WORLD[o.type] && o.type !== "zoom") drawScreen(o, t); });
    if (P.burnCaptions) drawCaption(t);
    if (!exporting && sel && sel.kind === "cursor") {
      var se = ev.filter(function (e) { return e.src && e.src.id === sel.id; })[0];
      if (se) { ctx.setLineDash([6, 5]); ctx.strokeStyle = "#1D4ED8"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc((se.x - cam.x) * cam.z, (se.y - cam.y) * cam.z, 24, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]); }
    }
    if (!exporting && sel && sel.kind === "overlay") {
      var so = find(P.overlays, sel.id);
      if (so && t >= so.start && t < so.end && so.type !== "intro" && so.type !== "outro" && so.type !== "lower") {
        var b = WORLD[so.type] || so.type === "zoom" ? { x: (so.x * W - cam.x) * cam.z, y: (so.y * H - cam.y) * cam.z, w: so.w * W * cam.z, h: so.h * H * cam.z } : { x: so.x * W, y: so.y * H, w: so.w * W, h: so.h * H };
        ctx.setLineDash([8, 6]); ctx.strokeStyle = "#1D4ED8"; ctx.lineWidth = 2; ctx.strokeRect(b.x, b.y, Math.max(20, b.w), Math.max(20, b.h)); ctx.setLineDash([]);
      }
    }
    ctx.restore();
  }

  /* ---------- Preview playback ---------- */
  var exporting = false, raf = 0, audio = null;
  function audioGraph() {
    if (audio) return audio;
    var AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
    var ac = new AC(), out = ac.createGain(); out.connect(ac.destination);
    audio = { ac: ac, out: out, nodes: {} };
    return audio;
  }
  function route(m) {
    var a = audioGraph(); if (!a || !m || !m.el || a.nodes[m.id] || m.kind === "image") return a && a.nodes[m.id];
    try { var src = a.ac.createMediaElementSource(m.el), g = a.ac.createGain(); src.connect(g); g.connect(a.out); a.nodes[m.id] = g; } catch (e) { /* already routed */ }
    return a.nodes[m.id];
  }
  function narrationAt(t) {
    var n = P.narration, m = n && MEDIA[n.media]; if (!m) return null;
    var len = (n.trimOut || m.duration) - (n.trimIn || 0), k = t - n.offset;
    if (k < 0 || k >= len) return { m: m, active: false };
    var vol = n.volume; if (n.fadeIn && k < n.fadeIn) vol *= k / n.fadeIn; if (n.fadeOut && len - k < n.fadeOut) vol *= (len - k) / n.fadeOut;
    return { m: m, active: true, at: (n.trimIn || 0) + k, vol: vol };
  }
  function seekClip(t) {
    var hit = clipAt(t); if (!hit) return Promise.resolve();
    var m = MEDIA[hit.clip.media]; if (!m || m.kind !== "video") return Promise.resolve();
    var want = hit.clip.in + (t - hit.start);
    if (Math.abs(m.el.currentTime - want) < 0.02 && m.el.readyState >= 2) return Promise.resolve();   // until a frame is decoded, seeking is what makes one
    return new Promise(function (ok) { var done = function () { m.el.removeEventListener("seeked", done); ok(); }; m.el.addEventListener("seeked", done); m.el.currentTime = want; setTimeout(ok, 1500); });
  }
  function show(t) { playhead = Math.max(0, Math.min(duration(), t)); return seekClip(playhead).then(function () { frame(playhead); ruler(); }); }
  function stopAll() { Object.keys(MEDIA).forEach(function (k) { var m = MEDIA[k]; if (m.el && m.el.pause) m.el.pause(); }); }
  /** Plays the timeline from t. Used by the preview, and by the export with record = true. */
  function run(from, record, onTick) {
    return new Promise(function (resolve) {
      var a = audioGraph(); if (a && a.ac.state === "suspended") a.ac.resume();
      Object.keys(MEDIA).forEach(function (k) { if (MEDIA[k].kind !== "image") route(MEDIA[k]); });
      var cur = null, wall0 = performance.now(), t0 = from, stillT = null;
      function tick() {
        if (!playing) { stopAll(); return resolve(false); }
        var hit = clipAt(Math.min(playhead, duration() - 1e-3)), m = hit && MEDIA[hit.clip.media];
        if (!hit) { playing = false; return resolve(true); }
        if (cur !== hit.clip) {
          stopAll(); cur = hit.clip;
          if (m.kind === "video") { m.el.currentTime = hit.clip.in + (playhead - hit.start); var g = route(m); if (g) g.gain.value = P.clipVolume; m.el.play().catch(function () {}); }
          else { stillT = { wall: performance.now(), t: playhead }; }
        }
        if (m.kind === "video") {
          playhead = hit.start + (m.el.currentTime - hit.clip.in);
          if (m.el.currentTime >= hit.clip.out - 1 / FPS || m.el.ended) { m.el.pause(); playhead = hit.start + (hit.clip.out - hit.clip.in) + 1e-4; }
        } else playhead = stillT.t + (performance.now() - stillT.wall) / 1000;
        var nr = narrationAt(playhead);
        if (nr) {
          var ng = route(nr.m);
          if (nr.active) { if (ng) ng.gain.value = nr.vol; if (nr.m.el.paused) { nr.m.el.currentTime = nr.at; nr.m.el.play().catch(function () {}); } else if (Math.abs(nr.m.el.currentTime - nr.at) > 0.25) nr.m.el.currentTime = nr.at; }
          else if (!nr.m.el.paused) nr.m.el.pause();
        }
        if (playhead >= duration() - 1e-3) { frame(duration() - 1e-3); playing = false; stopAll(); ruler(); return resolve(true); }
        frame(playhead); if (onTick) onTick(playhead); else if (performance.now() - wall0 > 0) ruler();
        raf = requestAnimationFrame(tick);
      }
      playhead = t0; tick();
    });
  }
  $("#vd-play").addEventListener("click", function () {
    if (!P.clips.length) return;
    if (playing) { playing = false; return; }
    playing = true; this.textContent = T("Pause"); var b = this;
    if (playhead >= duration() - 0.05) playhead = 0;
    run(playhead).then(function () { b.textContent = T("Play"); ruler(); });
  });

  /* ---------- Timeline ---------- */
  var tl = $("#vd-timeline"), scale = 60;            // pixels a second
  function ruler() {
    var d = duration(); $("#vd-time").textContent = clock(playhead) + " / " + clock(d);
    $("#vd-head").style.left = playhead * scale + "px";
  }
  function clock(s) { s = Math.max(0, s || 0); var m = Math.floor(s / 60), r = s - m * 60; return m + ":" + (r < 10 ? "0" : "") + r.toFixed(1); }
  function timeline() {
    var d = Math.max(duration(), 1);
    scale = Math.max(24, Math.min(160, (tl.clientWidth - 140) / d));
    var w = d * scale + 40, acc = 0, ev = timelineEvents();
    var rows = [
      [T("Video"), P.clips.map(function (c, i) { var x = acc * scale, cw = (c.out - c.in) * scale; acc += c.out - c.in; var m = MEDIA[c.media];
        return '<button type="button" class="vd-item vd-clip' + on("clip", c.id) + '" data-kind="clip" data-id="' + c.id + '" style="left:' + x + "px;width:" + Math.max(8, cw - 2) + 'px" aria-label="' + esc(T("Clip {n}: {name}, {s} seconds", { n: i + 1, name: m ? m.name : "", s: (c.out - c.in).toFixed(1) })) + '">' + esc(m ? m.name : "?") + "</button>"; }).join("")],
      [T("Layers"), P.overlays.map(function (o) { return bar("overlay", o, TYPES[o.type] + (o.text ? ": " + o.text.split("\n")[0] : "")); }).join("")],
      [T("Captions"), P.captions.map(function (c) { return bar("caption", c, c.text); }).join("")],
      [T("Cursor"), ev.map(function (e) {
        if (!e.click) return '<span class="vd-ev" style="left:' + e.t * scale + 'px"></span>';
        var lb = esc(T("Click {n} at {t} s", { n: e.n, t: e.t.toFixed(2) }));
        return '<button type="button" class="vd-ev click' + (sel && sel.kind === "cursor" && sel.id === e.src.id ? " on" : "") + '" data-kind="cursor" data-id="' + esc(e.src.id) + '" data-media="' + esc(e.clip.media) + '" data-t="' + e.t.toFixed(3) + '" style="left:' + e.t * scale + 'px" title="' + lb + '" aria-label="' + lb + '"></button>'; }).join("")],
      [T("Narration"), P.narration && MEDIA[P.narration.media] ? bar("narration", { id: "n", start: P.narration.offset, end: P.narration.offset + ((P.narration.trimOut || MEDIA[P.narration.media].duration) - (P.narration.trimIn || 0)) }, MEDIA[P.narration.media].name) : ""],
      [T("Markers"), P.markers.map(function (k) { return '<button type="button" class="vd-mark' + on("marker", k.id) + '" data-kind="marker" data-id="' + k.id + '" style="left:' + k.t * scale + 'px" title="' + esc(k.label) + '" aria-label="' + esc(T("Marker: {label}", { label: k.label })) + '"></button>'; }).join("")],
    ];
    tl.innerHTML = '<div class="vd-tracks" style="width:' + (w + 120) + 'px">' + rows.map(function (r) { return '<div class="vd-row"><span class="vd-label">' + r[0] + '</span><div class="vd-lane" style="width:' + w + 'px">' + r[1] + "</div></div>"; }).join("") +
      '<div class="vd-head" id="vd-head" aria-hidden="true"></div></div>';
    ruler();
  }
  function on(kind, id) { return sel && sel.kind === kind && sel.id === id ? " on" : ""; }
  function bar(kind, o, label) {
    return '<button type="button" class="vd-item vd-' + kind + on(kind, o.id) + '" data-kind="' + kind + '" data-id="' + o.id + '" style="left:' + o.start * scale + "px;width:" + Math.max(10, (o.end - o.start) * scale - 2) + 'px" aria-label="' + esc(T("{label}, {a} to {b} seconds", { label: label, a: o.start.toFixed(1), b: o.end.toFixed(1) })) + '">' + esc(label) + "</button>";
  }
  function find(list, id) { for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i]; return null; }
  // Click on the timeline: choose an item, or move the playhead. Drag a layer, caption or narration bar to move it in time.
  var drag = null;
  tl.addEventListener("pointerdown", function (e) {
    var lane = e.target.closest(".vd-lane"); if (!lane) return;
    var x = e.clientX - lane.getBoundingClientRect().left, item = e.target.closest(".vd-item,.vd-mark,.vd-ev.click");
    if (item) {
      sel = { kind: item.dataset.kind, id: item.dataset.id, media: item.dataset.media }; props(); timeline();
      if (sel.kind === "cursor") { show(+item.dataset.t); return; }
      var o = sel.kind === "overlay" ? find(P.overlays, sel.id) : sel.kind === "caption" ? find(P.captions, sel.id) : sel.kind === "narration" ? P.narration : null;
      if (o) { drag = { o: o, x: e.clientX, start: o.start != null ? o.start : o.offset, end: o.end, edge: e.target.closest(".vd-item") && x > (o.end || 0) * scale - 10 && sel.kind !== "narration" }; tl.setPointerCapture(e.pointerId); }
      show(Math.max(0, x / scale));
      return;
    }
    show(Math.max(0, x / scale));
  });
  tl.addEventListener("pointermove", function (e) {
    if (!drag) return;
    var dt = (e.clientX - drag.x) / scale;
    if (sel.kind === "narration") P.narration.offset = Math.max(0, +(drag.start + dt).toFixed(2));
    else if (drag.edge) drag.o.end = Math.max(drag.start + 0.2, +(drag.end + dt).toFixed(2));
    else { var len = drag.end - drag.start; drag.o.start = Math.max(0, +(drag.start + dt).toFixed(2)); drag.o.end = +(drag.o.start + len).toFixed(2); }
    drag.moved = true; timeline(); props(); frame(playhead);
  });
  tl.addEventListener("pointerup", function () { if (drag && drag.moved) changed(); drag = null; });

  /* ---------- Editing ---------- */
  function addOverlay(type) {
    if (!P.clips.length) return say(T("Add footage first."), true);
    var t = Math.min(playhead, Math.max(0, duration() - 0.5)), len = type === "intro" || type === "outro" ? 3 : type === "zoom" ? 2.5 : 3;
    var o = { id: uid("o"), type: type, start: +t.toFixed(2), end: +Math.min(duration(), t + len).toFixed(2), x: 0.36, y: 0.32, w: 0.24, h: 0.14, text: "", color: COLORS[type], size: type === "step" ? 40 : type === "done" ? 28 : 30, layer: P.overlays.length };
    if (type === "done") { o.text = T("Saved"); o.x = 0.62; o.y = 0.12; }
    if (type === "title") { o.x = 0.05; o.y = 0.06; o.text = T("Name this part of the task"); }
    if (type === "instruction") { o.x = 0.05; o.y = 0.06; o.text = T("Select the control the pointer moves to"); }
    if (type === "warning") { o.x = 0.05; o.y = 0.06; o.text = T("Say what to check before going on"); }
    if (type === "callout") o.text = T("Explain this part of the screen");
    if (type === "step") { o.text = String(P.overlays.filter(function (x) { return x.type === "step"; }).length + 1); o.w = o.h = 0.04; }
    if (type === "lower") o.text = T("Name of the application · fictional demo");
    if (type === "intro") { o.text = T("Title of the video") + "\n" + T("What the viewer will be able to do."); if (!t) o.start = 0; }
    if (type === "outro") { o.text = T("You're done") + "\n" + T("What the viewer should now see on the screen."); o.end = +duration().toFixed(2); o.start = +Math.max(0, duration() - 3).toFixed(2); }
    if (type === "arrow") { o.w = 0.12; o.h = 0.12; }
    P.overlays.push(o); sel = { kind: "overlay", id: o.id }; changed(); props();
    say(T("New layer: {type}, from {a} s to {b} s. Drag it on the picture to place it.", { type: TYPES[type], a: o.start.toFixed(1), b: o.end.toFixed(1) }));
  }
  $$("[data-add]").forEach(function (b) { b.addEventListener("click", function () { addOverlay(b.dataset.add); }); });
  $("#vd-split").addEventListener("click", function () {
    var hit = clipAt(playhead); if (!hit) return;
    var at = hit.clip.in + (playhead - hit.start);
    if (at - hit.clip.in < 0.2 || hit.clip.out - at < 0.2) return say(T("Move the playhead away from the edge of the clip to split it."), true);
    var b = { id: uid("c"), media: hit.clip.media, in: at, out: hit.clip.out }; hit.clip.out = at;
    P.clips.splice(hit.index + 1, 0, b); sel = { kind: "clip", id: b.id }; changed(); props(); say(T("Split the clip at {t}.", { t: clock(playhead) }));
  });
  $("#vd-caption").addEventListener("click", function () {
    if (!P.clips.length) return say(T("Add footage first."), true);
    var c = { id: uid("k"), start: +playhead.toFixed(2), end: +Math.min(duration(), playhead + 2.5).toFixed(2), text: T("Caption text") };
    P.captions.push(c); P.captions.sort(function (a, b) { return a.start - b.start; }); sel = { kind: "caption", id: c.id }; changed(); props();
    var f = $("#vd-props [data-f=text]"); if (f) { f.focus(); f.select(); }
  });
  $("#vd-marker").addEventListener("click", function () {
    var k = { id: uid("k"), t: +playhead.toFixed(2), label: T("Chapter {n}", { n: P.markers.length + 1 }) }; P.markers.push(k); P.markers.sort(function (a, b) { return a.t - b.t; }); sel = { kind: "marker", id: k.id }; changed(); props();
  });
  $("#vd-click").addEventListener("click", function () {
    // A click added by hand, for footage that has no recorded pointer: at the playhead, where the last pointer event was, or the middle.
    var hit = clipAt(playhead); if (!hit) return say(T("Add footage first."), true);
    var m = MEDIA[hit.clip.media], ev = timelineEvents(), p = pointerAt(ev, playhead) || { x: W / 2, y: H / 2 };
    var ne = { id: uid("e"), t: +(hit.clip.in + playhead - hit.start).toFixed(3), x: p.x * (m.w || W) / W, y: p.y * (m.h || H) / H, click: true };
    m.cursor = (m.cursor || []).concat([ne]).sort(function (a, b) { return a.t - b.t; });
    sel = { kind: "cursor", id: ne.id, media: m.id }; changed(); props(); frame(playhead); say(T("Added a click at {t}. Drag on the picture to move it.", { t: clock(playhead) }));
  });

  /* ---------- Properties ---------- */
  function field(label, f, v, type, extra) {
    if (type === "textarea") return '<label>' + label + '<textarea data-f="' + f + '" rows="2" maxlength="300">' + esc(v) + "</textarea></label>";
    return '<label>' + label + '<input data-f="' + f + '" type="' + (type || "number") + '" value="' + esc(v) + '"' + (extra || ' step="0.1"') + "></label>";
  }
  function props() {
    var box = $("#vd-props"), h = "";
    if (!sel) { box.innerHTML = '<p class="vd-hint">' + T("Choose a clip, layer, caption, click or marker on the timeline to edit it.") + "</p>" + cursorPanel(); bindProps(); return; }
    if (sel.kind === "clip") {
      var c = find(P.clips, sel.id); if (!c) { sel = null; return props(); }
      var m = MEDIA[c.media], i = P.clips.indexOf(c);
      h = "<h3>" + esc(T("Clip {n}: {name}", { n: i + 1, name: m.name })) + "</h3>" + field(T("Starts at (s in the footage)"), "in", c.in.toFixed(2)) + field(T("Ends at (s in the footage)"), "out", c.out.toFixed(2)) +
        '<p class="ann-btns"><button type="button" class="btn line sm" data-act="in-here">' + T("Start here") + '</button><button type="button" class="btn line sm" data-act="out-here">' + T("End here") + "</button>" +
        '<button type="button" class="btn line sm" data-act="left"' + (i ? "" : " disabled") + ">" + T("Move earlier") + '</button><button type="button" class="btn line sm" data-act="right"' + (i < P.clips.length - 1 ? "" : " disabled") + ">" + T("Move later") + '</button><button type="button" class="btn line sm" data-act="del">' + T("Delete clip") + "</button></p>";
    } else if (sel.kind === "overlay") {
      var o = find(P.overlays, sel.id); if (!o) { sel = null; return props(); }
      h = "<h3>" + TYPES[o.type] + "</h3>" + (/zoom|blur|arrow|box/.test(o.type) ? "" : field(o.type === "intro" || o.type === "outro" ? T("Text (first line is the title)") : T("Text"), "text", o.text, "textarea")) +
        '<div class="vd-two">' + field(T("Start (s)"), "start", o.start.toFixed(2)) + field(T("End (s)"), "end", o.end.toFixed(2)) + "</div>" +
        (o.type === "intro" || o.type === "outro" || o.type === "lower" ? "" : '<div class="vd-two">' + field(T("X (%)"), "x", Math.round(o.x * 100), "number", ' step="1"') + field(T("Y (%)"), "y", Math.round(o.y * 100), "number", ' step="1"') + "</div>") +
        (/zoom|blur|box|arrow|callout/.test(o.type) ? '<div class="vd-two">' + field(T("Width (%)"), "w", Math.round(o.w * 100), "number", ' step="1"') + field(T("Height (%)"), "h", Math.round(o.h * 100), "number", ' step="1"') + "</div>" : "") +
        (/zoom|blur/.test(o.type) ? "" : '<div class="vd-two">' + field(T("Size (px)"), "size", o.size, "number", ' step="1"') + field(T("Color"), "color", o.color, "color", "") + "</div>") +
        '<p class="ann-btns"><button type="button" class="btn line sm" data-act="up">' + T("Bring forward") + '</button><button type="button" class="btn line sm" data-act="down">' + T("Send back") + '</button><button type="button" class="btn line sm" data-act="del">' + T("Delete") + "</button></p>";
    } else if (sel.kind === "caption") {
      var k = find(P.captions, sel.id); if (!k) { sel = null; return props(); }
      h = "<h3>" + T("Caption") + "</h3>" + field(T("Text"), "text", k.text, "textarea") + '<div class="vd-two">' + field(T("Start (s)"), "start", k.start.toFixed(2)) + field(T("End (s)"), "end", k.end.toFixed(2)) + "</div>" +
        '<p class="ann-btns"><button type="button" class="btn line sm" data-act="del">' + T("Delete") + "</button></p>";
    } else if (sel.kind === "marker") {
      var mk = find(P.markers, sel.id); if (!mk) { sel = null; return props(); }
      h = "<h3>" + T("Marker") + "</h3>" + field(T("Label"), "label", mk.label, "text") + field(T("Time (s)"), "t", mk.t.toFixed(2)) + '<p class="ann-btns"><button type="button" class="btn line sm" data-act="del">' + T("Delete") + "</button></p>";
    } else if (sel.kind === "narration") {
      var n = P.narration, nm = MEDIA[n.media];
      h = "<h3>" + esc(T("Narration: {name}", { name: nm.name })) + "</h3>" + '<div class="vd-two">' + field(T("Starts at (s on the timeline)"), "offset", n.offset.toFixed(2)) + field(T("Volume (%)"), "volume", Math.round(n.volume * 100), "number", ' step="5" min="0" max="200"') + "</div>" +
        '<div class="vd-two">' + field(T("Trim start (s)"), "trimIn", (n.trimIn || 0).toFixed(2)) + field(T("Trim end (s)"), "trimOut", (n.trimOut || nm.duration).toFixed(2)) + "</div>" +
        '<div class="vd-two">' + field(T("Fade in (s)"), "fadeIn", n.fadeIn) + field(T("Fade out (s)"), "fadeOut", n.fadeOut) + "</div>" + '<p class="ann-btns"><button type="button" class="btn line sm" data-act="del">' + T("Remove narration") + "</button></p>";
    } else if (sel.kind === "cursor") {
      var ce = clickEvent(); if (!ce) { sel = null; return props(); }
      h = "<h3>" + T("Click") + "</h3>" + '<div class="vd-two">' + field(T("X (px in the footage)"), "x", Math.round(ce.x), "number", ' step="1"') + field(T("Y (px in the footage)"), "y", Math.round(ce.y), "number", ' step="1"') + "</div>" +
        field(T("Time (s in the footage)"), "t", ce.t.toFixed(2)) + '<p class="ann-btns"><button type="button" class="btn line sm" data-act="del">' + T("Delete click") + "</button></p>";
    }
    box.innerHTML = h + cursorPanel(); bindProps();
  }
  function cursorPanel() {
    var c = P.cursor, chk = function (k, l) { return '<label class="vd-chk"><input type="checkbox" data-cur="' + k + '"' + (c[k] ? " checked" : "") + "> " + l + "</label>"; };
    return '<h3 class="vd-sep">' + T("Cursor") + "</h3>" + chk("show", T("Show the pointer")) + chk("halo", T("Halo")) + chk("ripple", T("Click ripple")) + chk("spotlight", T("Spotlight around the pointer")) + chk("numbers", T("Number the clicks")) + chk("follow", T("Zoom in on each click")) +
      '<label class="vd-row">' + T("Size") + ' <input type="range" data-cur="size" min="0.6" max="2" step="0.1" value="' + c.size + '"></label><label class="vd-row">' + T("Zoom") + ' <input type="range" data-cur="factor" min="1.2" max="3" step="0.1" value="' + c.factor + '"></label>' +
      '<p class="vd-hint">' + T("{n} click(s) on the timeline. Footage recorded in the demo app brings its pointer with it; for other footage, add clicks by hand.", { n: timelineEvents().filter(function (e) { return e.click; }).length }) + "</p>";
  }
  function bindProps() {
    var box = $("#vd-props");
    box.oninput = box.onchange = function (e) {
      var el = e.target, f = el.dataset.f, k = el.dataset.cur;
      if (k) { P.cursor[k] = el.type === "checkbox" ? el.checked : +el.value; frame(playhead); if (e.type === "change") changed(true); return; }
      if (!f || !sel) return;
      var v = el.type === "number" ? +el.value : el.value;
      if (sel.kind === "clip") { var c = find(P.clips, sel.id), m = MEDIA[c.media]; if (!isFinite(v)) return; c[f] = Math.max(0, Math.min(m.kind === "image" ? 600 : m.duration, v)); if (c.out - c.in < 0.1) c.out = c.in + 0.1; }
      if (sel.kind === "overlay") { var o = find(P.overlays, sel.id); o[f] = /^(x|y|w|h)$/.test(f) ? Math.max(0, Math.min(1, v / 100)) : v; if (o.end <= o.start) o.end = o.start + 0.2; }
      if (sel.kind === "caption") { var k2 = find(P.captions, sel.id); k2[f] = v; if (k2.end <= k2.start) k2.end = k2.start + 0.2; }
      if (sel.kind === "marker") { var mk = find(P.markers, sel.id); mk[f] = f === "t" ? Math.max(0, v) : v; }
      if (sel.kind === "narration") { P.narration[f] = f === "volume" ? Math.max(0, Math.min(2, v / 100)) : Math.max(0, v); }
      if (sel.kind === "cursor") { var ce = clickEvent(); if (!ce || !isFinite(v)) return; ce[f] = Math.max(0, v); if (f === "t") MEDIA[sel.media].cursor.sort(function (a, b) { return a.t - b.t; }); }
      if (e.type === "change") { changed(true); props(); } else { frame(playhead); }
    };
    box.onclick = function (e) {
      var b = e.target.closest("[data-act]"); if (!b || !sel) return;
      var a = b.dataset.act;
      if (sel.kind === "clip") {
        var c = find(P.clips, sel.id), i = P.clips.indexOf(c), hit = clipAt(playhead);
        if (a === "in-here" && hit && hit.clip === c) c.in = Math.min(c.out - 0.1, c.in + playhead - hit.start);
        if (a === "out-here" && hit && hit.clip === c) c.out = Math.max(c.in + 0.1, c.in + playhead - hit.start);
        if (a === "left" && i > 0) { P.clips.splice(i - 1, 0, P.clips.splice(i, 1)[0]); }
        if (a === "right" && i < P.clips.length - 1) { P.clips.splice(i + 1, 0, P.clips.splice(i, 1)[0]); }
        if (a === "del") { P.clips.splice(i, 1); sel = null; }
      } else if (sel.kind === "overlay") {
        var o = find(P.overlays, sel.id);
        if (a === "up") o.layer = (o.layer || 0) + 1; if (a === "down") o.layer = (o.layer || 0) - 1;
        if (a === "del") { P.overlays = P.overlays.filter(function (x) { return x !== o; }); sel = null; }
      } else if (a === "del") {
        if (sel.kind === "caption") P.captions = P.captions.filter(function (x) { return x.id !== sel.id; });
        if (sel.kind === "marker") P.markers = P.markers.filter(function (x) { return x.id !== sel.id; });
        if (sel.kind === "narration") P.narration = null;
        if (sel.kind === "cursor" && MEDIA[sel.media]) MEDIA[sel.media].cursor = MEDIA[sel.media].cursor.filter(function (x) { return x.id !== sel.id; });
        sel = null;
      }
      changed(true); props(); show(Math.min(playhead, duration()));
    };
  }
  // Drag a selected layer on the picture to place it. Drag the pointer of a hand-added click to move it.
  function clickEvent() { var m = sel && MEDIA[sel.media], list = m && m.cursor || []; for (var i = 0; i < list.length; i++) if (list[i].id === sel.id) return list[i]; return null; }
  cv.addEventListener("pointerdown", function (e) {
    if (sel && sel.kind === "cursor") {
      var ce = clickEvent(), m = MEDIA[sel.media]; if (!ce) return;
      var r0 = cv.getBoundingClientRect(), cam0 = camera(playhead, timelineEvents());
      var at = function (ev) { var x = (ev.clientX - r0.left) * W / r0.width, y = (ev.clientY - r0.top) * H / r0.height; return { x: (x / cam0.z + cam0.x) * (m.w || W) / W, y: (y / cam0.z + cam0.y) * (m.h || H) / H }; };
      cv.setPointerCapture(e.pointerId); var p0 = at(e); ce.x = Math.max(0, p0.x); ce.y = Math.max(0, p0.y); frame(playhead);
      cv.onpointermove = function (ev) { var p = at(ev); ce.x = Math.max(0, p.x); ce.y = Math.max(0, p.y); frame(playhead); };
      cv.onpointerup = function () { cv.onpointermove = cv.onpointerup = null; changed(true); props(); };
      return;
    }
    if (!sel || sel.kind !== "overlay") return;
    var o = find(P.overlays, sel.id); if (!o || /intro|outro|lower/.test(o.type)) return;
    var r = cv.getBoundingClientRect(), sx = W / r.width, sy = H / r.height, cam = camera(playhead, timelineEvents()), world = WORLD[o.type] || o.type === "zoom";
    var pt = function (ev) { var x = (ev.clientX - r.left) * sx, y = (ev.clientY - r.top) * sy; return world ? { x: (x / cam.z + cam.x) / W, y: (y / cam.z + cam.y) / H } : { x: x / W, y: y / H }; };
    var p0 = pt(e), o0 = { x: o.x, y: o.y }; cv.setPointerCapture(e.pointerId);
    cv.onpointermove = function (ev) { var p = pt(ev); o.x = Math.max(0, Math.min(1, o0.x + p.x - p0.x)); o.y = Math.max(0, Math.min(1, o0.y + p.y - p0.y)); frame(playhead); };
    cv.onpointerup = function () { cv.onpointermove = cv.onpointerup = null; changed(true); props(); };
  });

  /* ---------- Captions as files ---------- */
  function stamp(s, sep) { s = Math.max(0, s); var h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60, r = s % 60; return pad(h) + ":" + pad(m) + ":" + pad(Math.floor(r)) + sep + String(Math.round((r % 1) * 1000)).padStart(3, "0"); }
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function toSRT(list) { return list.map(function (c, i) { return (i + 1) + "\n" + stamp(c.start, ",") + " --> " + stamp(c.end, ",") + "\n" + c.text + "\n"; }).join("\n"); }
  function toVTT(list) { return "WEBVTT\n\n" + list.map(function (c, i) { return (i + 1) + "\n" + stamp(c.start, ".") + " --> " + stamp(c.end, ".") + "\n" + c.text + "\n"; }).join("\n"); }
  function parseTime(s) { var m = /(?:(\d+):)?(\d{1,2}):(\d{2})[.,](\d{1,3})/.exec(s); return m ? (+(m[1] || 0)) * 3600 + (+m[2]) * 60 + (+m[3]) + (+m[4].padEnd(3, "0")) / 1000 : NaN; }
  function parseCaptions(text) {
    var out = [];
    String(text).replace(/\r/g, "").split(/\n\s*\n/).forEach(function (block) {
      var lines = block.split("\n").filter(Boolean), i = lines.findIndex(function (l) { return l.indexOf("-->") > -1; });
      if (i < 0) return;
      var parts = lines[i].split("-->"), a = parseTime(parts[0]), b = parseTime(parts[1]);
      var txt = lines.slice(i + 1).join("\n").replace(/<[^>]+>/g, "").trim();
      if (isFinite(a) && isFinite(b) && b > a && txt) out.push({ id: uid("k"), start: +a.toFixed(3), end: +b.toFixed(3), text: txt.slice(0, 300) });
    });
    return out.slice(0, 2000);
  }
  $("#vd-srt").addEventListener("click", function () { if (!P.captions.length) return say(T("There are no captions yet."), true); Kit.save(new Blob([toSRT(P.captions)], { type: "application/x-subrip" }), name() + ".srt"); say(T("Exported {file}.", { file: name() + ".srt" })); });
  $("#vd-vtt").addEventListener("click", function () {
    if (!P.captions.length) return say(T("There are no captions yet."), true);
    Kit.save(new Blob([toVTT(P.captions)], { type: "text/vtt" }), name() + ".vtt");
    if (P.markers.length) Kit.save(new Blob(["WEBVTT\n\n" + P.markers.map(function (k, i) { var next = P.markers[i + 1] ? P.markers[i + 1].t : duration(); return "chapter-" + (i + 1) + "\n" + stamp(k.t, ".") + " --> " + stamp(next, ".") + "\n" + k.label + "\n"; }).join("\n")], { type: "text/vtt" }), name() + ".chapters.vtt");
    say(P.markers.length ? T("Exported {file}, and the markers as {chapters}.", { file: name() + ".vtt", chapters: name() + ".chapters.vtt" }) : T("Exported {file}.", { file: name() + ".vtt" }));
  });
  $("#vd-burn").addEventListener("change", function () { P.burnCaptions = this.checked; frame(playhead); changed(true); });

  /* ---------- Opening files ---------- */
  function kindOf(f) { if (/^image\//.test(f.type)) return "image"; if (/^audio\//.test(f.type)) return "audio"; if (VIDEO.indexOf(f.type) > -1) return "video"; if (/\.(srt|vtt)$/i.test(f.name)) return "captions"; return ""; }
  $("#vd-files").addEventListener("change", function () {
    var files = Array.prototype.slice.call(this.files); this.value = "";
    files.reduce(function (p, f) {
      return p.then(function () {
        var k = kindOf(f);
        if (k === "captions") return Kit.readText(f).then(function (t) { var c = parseCaptions(t); if (!c.length) throw new Error(T("{name} holds no captions this studio can read.", { name: f.name })); P.captions = P.captions.concat(c).sort(function (a, b) { return a.start - b.start; }); say(T("Imported {n} captions from {name}.", { n: c.length, name: f.name })); });
        if (k === "audio") return addMedia(f, f.name, "audio").then(function (m) { P.narration = { media: m.id, offset: +playhead.toFixed(2), volume: 1, fadeIn: 0.3, fadeOut: 0.5, trimIn: 0, trimOut: +m.duration.toFixed(2) }; say(T("Added {name} as narration, starting at {t}.", { name: f.name, t: clock(playhead) })); });
        if (k === "video" || k === "image") return addMedia(f, f.name, k).then(function (m) { addClip(m); say(T("Added {name} to the end of the video.", { name: f.name })); });
        throw new Error(T("{name} isn't a video, image, audio or caption file this studio opens.", { name: f.name }));
      });
    }, Promise.resolve()).then(function () { changed(); props(); show(playhead); }, fail);
  });

  /* ---------- Recording: the screen, with permission; the demo app, with its pointer; narration, with the microphone ---------- */
  function recordStream(stream, ms, onStop) {
    var type = ["video/webm;codecs=vp9,opus", "video/webm", "audio/webm;codecs=opus", "audio/webm"].filter(function (t) { return window.MediaRecorder && MediaRecorder.isTypeSupported(t); })[stream.getVideoTracks().length ? 0 : 2] || "";
    var rec = new MediaRecorder(stream, type ? { mimeType: type } : undefined), parts = [];
    rec.ondataavailable = function (e) { if (e.data.size) parts.push(e.data); };
    rec.onstop = function () { stream.getTracks().forEach(function (t) { t.stop(); }); onStop(new Blob(parts, { type: rec.mimeType || type })); };
    rec.start(250);
    return rec;
  }
  var screenRec = null;
  $("#vd-screen").addEventListener("click", function () {
    if (screenRec) { screenRec.stop(); return; }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia || !window.MediaRecorder) return fail(new Error(T("This browser can't record the screen. Record it with another tool and add the file.")));
    navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 30 }, audio: false }).then(function (stream) {
      var b = $("#vd-screen"); b.textContent = T("Stop recording"); say(T("Recording what you chose to share. Select Stop recording when you're done. The pointer of another app or tab isn't recorded as events, only as pixels."));
      stream.getVideoTracks()[0].addEventListener("ended", function () { if (screenRec) screenRec.stop(); });
      screenRec = recordStream(stream, 0, function (blob) {
        screenRec = null; b.textContent = T("Record the screen");
        addMedia(blob, T("screen recording"), "video").then(function (m) { addClip(m); changed(); props(); show(0); say(T("Added the screen recording: {s} s.", { s: m.duration.toFixed(1) })); }, fail);
      });
    }, function (e) { fail(new Error(e && e.name === "NotAllowedError" ? T("Screen recording was cancelled. Nothing was recorded.") : T("The screen couldn't be recorded."))); });
  });
  var micRec = null;
  $("#vd-mic").addEventListener("click", function () {
    if (micRec) { micRec.stop(); return; }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || !window.MediaRecorder) return fail(new Error(T("This browser can't record from a microphone. Record the narration elsewhere and add the file.")));
    navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }).then(function (stream) {
      var b = $("#vd-mic"), at = +playhead.toFixed(2); b.textContent = T("Stop narration"); say(T("Recording narration from {t}. Read your script, then select Stop narration.", { t: clock(at) }));
      micRec = recordStream(stream, 0, function (blob) {
        micRec = null; b.textContent = T("Record narration");
        addMedia(blob, T("narration"), "audio").then(function (m) { P.narration = { media: m.id, offset: at, volume: 1, fadeIn: 0.2, fadeOut: 0.4, trimIn: 0, trimOut: +m.duration.toFixed(2) }; sel = { kind: "narration", id: "n" }; changed(); props(); say(T("Added the narration: {s} s, starting at {t}.", { s: m.duration.toFixed(1), t: clock(at) })); }, fail);
      });
    }, function (e) { fail(new Error(e && e.name === "NotAllowedError" ? T("The microphone wasn't allowed. Nothing was recorded.") : T("The microphone couldn't be used."))); });
  });

  /* The demo app, recorded with its pointer. It fills this tab while it records; sharing this tab makes the recorded
     pixels and the logged pointer events line up. Pointer events from other tabs or apps aren't visible to a web page. */
  var demoRec = null;
  $("#vd-demo").addEventListener("click", function () {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia || !window.MediaRecorder) return fail(new Error(T("This browser can't record the screen.")));
    var box = document.createElement("div"); box.className = "vd-demo";
    box.innerHTML = '<iframe src="/studio/demo-console.html" title="' + esc(T("Demo app: a fictional maintenance console")) + '"></iframe><button class="btn ink sm" type="button">' + T("Stop recording") + "</button>";
    document.body.appendChild(box);
    var ifr = box.querySelector("iframe"), events = [], t0 = 0, last = 0;
    function log(e, click) {
      if (!t0) return; var now = performance.now();
      if (!click && now - last < 30) return; last = now;
      events.push({ t: +((now - t0) / 1000).toFixed(3), x: e.clientX, y: e.clientY, click: !!click });
    }
    ifr.addEventListener("load", function () {
      var d = ifr.contentWindow.document;
      d.addEventListener("pointermove", function (e) { log(e, false); }); d.addEventListener("pointerdown", function (e) { log(e, true); });
    });
    navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 30 }, audio: false, preferCurrentTab: true, selfBrowserSurface: "include" }).then(function (stream) {
      var surface = (stream.getVideoTracks()[0].getSettings() || {}).displaySurface, vw = innerWidth, vh = innerHeight;
      demoRec = recordStream(stream, 0, function (blob) {
        demoRec = null; box.remove();
        var good = !surface || surface === "browser";
        addMedia(blob, T("demo app recording"), "video").then(function (m) {
          // The events were logged in page pixels; the footage has its own size.
          m.cursor = good ? events.map(function (e) { return { t: e.t, x: e.x * (m.w || vw) / vw, y: e.y * (m.h || vh) / vh, click: e.click }; }) : [];
          addClip(m); changed(); props(); show(0);
          say(good ? T("Added the demo recording: {s} s, with {n} click(s) and the pointer's path.", { s: m.duration.toFixed(1), n: events.filter(function (e) { return e.click; }).length }) : T("Added the demo recording: {s} s. You shared something other than this tab, so the pointer events don't match the picture and weren't kept.", { s: m.duration.toFixed(1) }));
        }, fail);
      });
      t0 = performance.now();
      stream.getVideoTracks()[0].addEventListener("ended", function () { if (demoRec) demoRec.stop(); });
      box.querySelector("button").addEventListener("click", function () { if (demoRec) demoRec.stop(); });
      say(T("Recording the demo app. Use it as a reader would, then select Stop recording."));
    }, function (e) { box.remove(); fail(new Error(e && e.name === "NotAllowedError" ? T("Recording was cancelled. Nothing was recorded.") : T("The tab couldn't be recorded."))); });
  });

  /* ---------- The sample ---------- */
  /* The samples: projects this studio saved, with footage of the fictional demo apps, their pointer, narration and captions. */
  function openProject(bytes) {
    var files = Kit.unzip(bytes), j;
    try { j = JSON.parse(new TextDecoder().decode(files["project.json"])); } catch (e) { throw new Error(T("This archive isn't a video project.")); }
    return load(j, files);
  }
  var start = Kit.start($("#vd-start"), {
    tool: "video", title: T("Open a video project"),
    lead: T("Two training videos made in this studio from recordings of fictional applications: the pointer with its halo and click ripples, zoom that follows each click, highlight boxes and step numbers on the controls, and captions. Open one to play it, change it, and render it again. Or start from your own recording."),
    open: function (s) {
      return (P.clips.length ? Kit.confirm(T("Replace the project on screen?"), T("{title} takes its place. Save the current project first if you want to keep it.", { title: T(s.title) }), { ok: T("Replace") }) : Promise.resolve(true)).then(function (yes) {
        if (!yes) return;
        say(T("Opening {title}…", { title: T(s.title) }));
        return Kit.fetchBytes(s.project).then(openProject).then(function () { sw.close(); say(T("Opened {title}: {s} s of footage with its recorded pointer, {layers} layers and {captions} captions.", { title: T(s.title), s: Math.round(duration()), layers: P.overlays.length, captions: P.captions.length }) + (P.narration ? " " + T("It has narration.") : "") + " " + T("Play it, then export it.")); });
      });
    },
    fail: fail, blank: function () { (P.clips.length ? Kit.confirm(T("Start an empty project?"), T("The one on screen is replaced. Save it first if you want to keep it."), { ok: T("Start empty") }) : Promise.resolve(true)).then(function (yes) { if (!yes) return; stopAll(); MEDIA = {}; P = blank(); sel = null; changed(); hist.reset(); props(); show(0); sw.close(); say(T("Started an empty project. Add a recording, record the screen, or record the demo app.")); }); }, blankLabel: T("Start empty"),
    files: [{ label: T("Open project"), input: "vd-open" }, { label: T("Add files"), input: "vd-files" }],
    links: function (s) { return (s.video ? '<a href="' + Kit.esc(s.video) + '">MP4</a>' : "") + (s.captions ? '<a href="' + Kit.esc(s.captions) + '">WebVTT</a>' : ""); },
  });
  var sw = Kit.startSwitch(start, $("#vd-slot"), $("#vd-samples"));

  /* ---------- Export ---------- */
  function name() { return Kit.slug(P.name, "training-video"); }
  function pickType() {
    // H.264 with AAC plays everywhere; Chrome on Windows and macOS makes it. Chrome on Linux has no AAC encoder, so it gets H.264 with Opus.
    var list = ["video/mp4;codecs=avc1.640028,mp4a.40.2", "video/mp4;codecs=avc1.42E01E,mp4a.40.2", "video/mp4;codecs=avc1.640028,opus", "video/mp4;codecs=avc1,opus", "video/mp4", "video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"];
    for (var i = 0; i < list.length; i++) if (window.MediaRecorder && MediaRecorder.isTypeSupported(list[i])) return list[i];
    return "";
  }
  $("#vd-export").addEventListener("click", function () {
    if (!P.clips.length) return say(T("Add footage first."), true);
    if (exporting) return;
    var type = pickType(); if (!type) return fail(new Error(T("This browser can't make a video file. Use a current version of Chrome, Edge, Firefox or Safari.")));
    var a = audioGraph(); if (a.ac.state === "suspended") a.ac.resume();
    var dest = a.ac.createMediaStreamDestination(); a.out.connect(dest);
    var stream = new MediaStream(cv.captureStream(FPS).getVideoTracks().concat(dest.stream.getAudioTracks()));
    var rec = new MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: 6000000, audioBitsPerSecond: 160000 }), parts = [];
    rec.ondataavailable = function (e) { if (e.data.size) parts.push(e.data); };
    exporting = true; sel = null; props(); var prog = $("#vd-progress"), total = duration(); prog.hidden = false; prog.value = 0; prog.max = total;
    $("#vd-export").disabled = true; say(T("Rendering in real time: {t}. Keep this tab open and visible.", { t: clock(total) }));
    var stopped = new Promise(function (ok) { rec.onstop = ok; });
    show(0).then(function () {
      rec.start(500); playing = true;
      return run(0, true, function (t) { prog.value = t; $("#vd-time").textContent = clock(t) + " / " + clock(total); });
    }).then(function () { return new Promise(function (ok) { setTimeout(ok, 300); }); }).then(function () { rec.stop(); return stopped; }).then(function () {
      a.out.disconnect(dest);
      var ext = /mp4/.test(type) ? "mp4" : "webm", blob = new Blob(parts, { type: type.split(";")[0] });
      return (ext === "mp4" && window.Mp4 ? blob.arrayBuffer().then(function (buf) {
        // The recorder writes the file in pieces and never records its length. Rewrite it with one index so players show the right length and can seek.
        var flat; try { flat = Mp4.flatten(buf); } catch (e) { return blob; }   // the recorder's own file still plays
        return flat.unchanged ? blob : new Blob([flat.bytes], { type: "video/mp4" });
      }) : Promise.resolve(blob)).then(function (b) { blob = b; return verify(blob); }).then(function (len) {
        lastExport = { blob: blob, ext: ext, seconds: len };
        Kit.save(blob, name() + "." + ext);
        var codecs = (/codecs=([^;]+)/.exec(rec.mimeType || type) || [0, ""])[1].replace(/avc1[.\w]*/, "H.264").replace(/mp4a[.\w]*/, "AAC").replace(/opus/, "Opus").replace(/vp9/, "VP9").replace(/,/g, " " + T("and") + " ");
        say(T("Exported {file}: {mb} MB, {s} s, checked by playing it back.", { file: name() + "." + ext, mb: (blob.size / 1048576).toFixed(1), s: len.toFixed(1) }) + (codecs ? " " + T("Picture and sound: {codecs}.", { codecs: codecs }) : "") + (ext === "webm" ? " " + T("This browser makes WebM, not MP4.") : /Opus/.test(codecs) ? " " + T("Some players, such as QuickTime, don't play Opus sound; Chrome on Windows or macOS makes AAC sound.") : ""));
      });
    }).catch(fail).then(function () { exporting = false; playing = false; prog.hidden = true; $("#vd-export").disabled = false; frame(playhead); });
  });
  var lastExport = null;
  /** A file counts as exported only when a browser can open it and it lasts about as long as the timeline. */
  function verify(blob) {
    return new Promise(function (ok, no) {
      var v = document.createElement("video"), url = URL.createObjectURL(blob); v.muted = true; v.preload = "metadata";
      var settle = function (d) { URL.revokeObjectURL(url); if (d > 0.5 && Math.abs(d - duration()) < Math.max(1, duration() * 0.05)) ok(d); else if (d > 0.5) no(new Error(T("The video file lasts {d} s but the timeline lasts {t} s, so it wasn't saved. Keep this tab visible while it renders, then try again.", { d: d.toFixed(1), t: duration().toFixed(1) }))); else no(new Error(T("The video file was made but can't be played back. Nothing was saved."))); };
      v.onloadedmetadata = function () { if (isFinite(v.duration)) return settle(v.duration); v.currentTime = 1e9; v.ontimeupdate = function () { v.ontimeupdate = null; settle(v.duration); }; };
      v.onerror = function () { URL.revokeObjectURL(url); no(new Error(T("The video file was made but can't be played back. Nothing was saved."))); };
      v.src = url;
    });
  }

  /* ---------- Projects ---------- */
  function projectJson() {
    var media = {}; Object.keys(MEDIA).forEach(function (k) { var m = MEDIA[k]; media[k] = { kind: m.kind, name: m.name, type: m.blob.type, file: "media/" + k + "." + ext(m), cursor: m.cursor || [] }; });
    return { app: "karandeshmukh.dev/studio/video", version: 1, project: P, media: media };
  }
  function ext(m) { return (m.blob.type.split("/")[1] || "bin").split(";")[0].replace("quicktime", "mov").replace("mpeg", "mp3").replace("x-wav", "wav"); }
  $("#vd-save").addEventListener("click", function () {
    var j = projectJson(), keys = Object.keys(MEDIA);
    Promise.all(keys.map(function (k) { return MEDIA[k].blob.arrayBuffer(); })).then(function (bufs) {
      var files = [{ name: "project.json", data: JSON.stringify(j, null, 1) }].concat(keys.map(function (k, i) { return { name: j.media[k].file, data: new Uint8Array(bufs[i]) }; }));
      Kit.save(Kit.zip(files), name() + ".video.zip"); say(T("Saved the project with its footage and sound. Open it here to keep editing."));
    }, fail);
  });
  function num(v, lo, hi, d) { v = Number(v); return isFinite(v) ? Math.max(lo, Math.min(hi, v)) : d; }
  function load(j, blobs) {
    if (!j || j.app !== "karandeshmukh.dev/studio/video" || j.version !== 1 || !j.project) throw new Error(T("This isn't a video project saved by this studio."));
    var src = j.project, ids = Object.keys(j.media || {}).slice(0, 50);
    stopAll(); MEDIA = {}; var next = blank(); next.name = String(src.name || "training-video").slice(0, 80); next.burnCaptions = src.burnCaptions !== false; next.clipVolume = num(src.clipVolume, 0, 2, 1);
    Object.keys(next.cursor).forEach(function (k) { if (src.cursor && k in src.cursor) next.cursor[k] = typeof next.cursor[k] === "boolean" ? !!src.cursor[k] : num(src.cursor[k], 0.5, 3, next.cursor[k]); });
    var map = {};
    return ids.reduce(function (p, id) {
      return p.then(function () {
        var d = j.media[id], b = blobs[d.file]; if (!b || ["video", "image", "audio"].indexOf(d.kind) < 0) return;
        var ev = (Array.isArray(d.cursor) ? d.cursor : []).slice(0, 20000).map(function (e) { return { t: num(e.t, 0, 1e5, 0), x: num(e.x, -1e4, 1e4, 0), y: num(e.y, -1e4, 1e4, 0), click: !!e.click }; });
        return addMedia(new Blob([b], { type: String(d.type || "") }), String(d.name || id).slice(0, 80), d.kind, ev).then(function (m) { map[id] = m.id; });
      });
    }, Promise.resolve()).then(function () {
      next.clips = (src.clips || []).filter(function (c) { return map[c.media]; }).map(function (c) { var m = MEDIA[map[c.media]]; return { id: uid("c"), media: map[c.media], in: num(c.in, 0, m.duration || 600, 0), out: num(c.out, 0.1, m.duration || 600, m.duration || 4) }; });
      next.overlays = (src.overlays || []).filter(function (o) { return TYPES[o.type]; }).slice(0, 500).map(function (o) { return { id: uid("o"), type: o.type, start: num(o.start, 0, 1e5, 0), end: num(o.end, 0, 1e5, 1), x: num(o.x, 0, 1, 0.3), y: num(o.y, 0, 1, 0.3), w: num(o.w, 0, 1, 0.2), h: num(o.h, 0, 1, 0.1), text: String(o.text || "").slice(0, 300), color: /^#[0-9a-fA-F]{6}$/.test(o.color) ? o.color : COLORS[o.type], size: num(o.size, 8, 120, 30), layer: num(o.layer, -999, 999, 0) }; });
      next.captions = (src.captions || []).slice(0, 2000).map(function (c) { return { id: uid("k"), start: num(c.start, 0, 1e5, 0), end: num(c.end, 0, 1e5, 1), text: String(c.text || "").slice(0, 300) }; });
      next.markers = (src.markers || []).slice(0, 200).map(function (k) { return { id: uid("k"), t: num(k.t, 0, 1e5, 0), label: String(k.label || "").slice(0, 80) }; });
      if (src.narration && map[src.narration.media]) { var n = src.narration; next.narration = { media: map[n.media], offset: num(n.offset, 0, 1e5, 0), volume: num(n.volume, 0, 2, 1), fadeIn: num(n.fadeIn, 0, 30, 0), fadeOut: num(n.fadeOut, 0, 30, 0), trimIn: num(n.trimIn, 0, 1e5, 0), trimOut: num(n.trimOut, 0, 1e5, 0) || undefined }; }
      P = next; sel = null; changed(true); if (hist) hist.reset(); props(); return show(0);
    });
  }
  $("#vd-open").addEventListener("change", function () {
    var f = this.files[0]; this.value = "";
    Kit.readBytes(f, 400 * 1048576).then(openProject).then(function () { say(T("Opened {name}.", { name: f.name })); }, fail);
  });

  /* ---------- Keeping the project in this browser ---------- */
  var timer = 0;
  function changed(light) {
    timeline();
    if (hist) hist.record();
    clearTimeout(timer);
    timer = setTimeout(function () {
      var j = projectJson(), blobs = {}; Object.keys(MEDIA).forEach(function (k) { blobs[j.media[k].file] = MEDIA[k].blob; });
      Kit.store.put("video", { json: j, blobs: blobs }).catch(function () {});
    }, 900);
    $("#vd-export").disabled = !P.clips.length; $("#vd-save").disabled = !P.clips.length;
    $("#vd-burn").checked = P.burnCaptions;
    if (window.studioVideo) sw.inline(!P.clips.length);
  }
  /* ---------- Undo and redo: the timeline and the pointer events, kept after each change ---------- */
  var hist = Kit.history({
    get: function () { var c = {}; Object.keys(MEDIA).forEach(function (k) { c[k] = MEDIA[k].cursor || []; }); return { P: P, cursor: c }; },
    set: function (s) { P = s.P; Object.keys(s.cursor).forEach(function (k) { if (MEDIA[k]) MEDIA[k].cursor = s.cursor[k]; }); sel = null; changed(true); props(); show(Math.min(playhead, duration())); },
    onChange: function (h) { $("#vd-undo").disabled = !h.canUndo(); $("#vd-redo").disabled = !h.canRedo(); },
  });
  function undo() { if (!exporting && hist.undo()) say(T("Undid the last change.")); }
  function redo() { if (!exporting && hist.redo()) say(T("Redid the change.")); }
  $("#vd-undo").addEventListener("click", undo); $("#vd-redo").addEventListener("click", redo);
  Kit.keys({ save: function () { if (!$("#vd-save").disabled) $("#vd-save").click(); }, undo: undo, redo: redo });
  if (document.fonts && document.fonts.load) document.fonts.load("700 30px Hanken").then(function () { frame(playhead); }, function () {});
  Kit.store.get("video").then(function (s) {
    if (!s || !s.json) return;
    var blobs = {}; return Promise.all(Object.keys(s.blobs || {}).map(function (k) { return s.blobs[k].arrayBuffer().then(function (b) { blobs[k] = new Uint8Array(b); }); })).then(function () { return load(s.json, blobs); }).then(function () { say(T("Reopened your last video project from this browser.")); });
  }).catch(function () {}).then(function () { if (!P.clips.length) { frame(0); timeline(); props(); } changed(true); });

  addEventListener("keydown", function (e) {
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === " " && document.activeElement && document.activeElement.closest(".vd")) { e.preventDefault(); $("#vd-play").click(); }
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") { if (!document.activeElement || !document.activeElement.closest(".vd-time,.vd-preview,.vd-tl")) return; e.preventDefault(); show(playhead + (e.key === "ArrowLeft" ? -1 : 1) * (e.shiftKey ? 1 : 1 / FPS)); }
  });
  addEventListener("resize", function () { timeline(); });
  window.studioVideo = { project: function () { return P; }, media: function () { return MEDIA; }, duration: duration, show: show, frame: frame, last: function () { return lastExport; }, toSRT: function () { return toSRT(P.captions); }, toVTT: function () { return toVTT(P.captions); },
    /** Opens a project ZIP from an address, as the sample cards do. */
    open: function (url) { return Kit.fetchBytes(url).then(openProject); } };
  sw.inline(!P.clips.length);
})();
