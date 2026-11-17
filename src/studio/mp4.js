/* Turns a fragmented MP4 (what MediaRecorder makes) into an ordinary MP4 with one index and a known length.
   Browsers' recorders write the file in pieces as they go and never go back to write its length, so some players
   show the wrong length or can't seek. This reads every piece and writes the same audio and video samples again,
   unchanged, under a single index. Nothing is re-encoded. Works in the browser (window.Mp4) and in Node. */
(function (root) {
  "use strict";
  var CONTAINERS = { moov: 1, trak: 1, mdia: 1, minf: 1, stbl: 1, mvex: 1, moof: 1, traf: 1, dinf: 1, edts: 1 };

  function u32(b, o) { return ((b[o] << 24) >>> 0) + (b[o + 1] << 16) + (b[o + 2] << 8) + b[o + 3]; }
  function u64(b, o) { return u32(b, o) * 4294967296 + u32(b, o + 4); }
  function type(b, o) { return String.fromCharCode(b[o], b[o + 1], b[o + 2], b[o + 3]); }

  /** Reads boxes between start and end. Container boxes get children; the rest keep their bytes. */
  function parse(b, start, end) {
    var out = [], o = start;
    while (o + 8 <= end) {
      var size = u32(b, o), t = type(b, o + 4), hdr = 8;
      if (size === 1) { size = u64(b, o + 8); hdr = 16; } else if (size === 0) size = end - o;
      if (size < hdr || o + size > end) throw new Error("The video file is damaged: a " + t + " box runs past the end.");
      var box = { type: t, start: o, size: size, hdr: hdr };
      if (CONTAINERS[t]) box.kids = parse(b, o + hdr, o + size); else box.body = b.subarray(o + hdr, o + size);
      out.push(box); o += size;
    }
    return out;
  }
  function find(list, t) { for (var i = 0; i < list.length; i++) if (list[i].type === t) return list[i]; return null; }
  function all(list, t) { return list.filter(function (x) { return x.type === t; }); }

  /* ---------- writing ---------- */
  function Writer() { this.parts = []; this.size = 0; }
  Writer.prototype.bytes = function (u8) { this.parts.push(u8); this.size += u8.length; };
  function be(n, len) { var a = new Uint8Array(len); for (var i = len - 1; i >= 0; i--) { a[i] = n % 256; n = Math.floor(n / 256); } return a; }
  function ascii(s) { var a = new Uint8Array(4); for (var i = 0; i < 4; i++) a[i] = s.charCodeAt(i); return a; }
  function join(list) { var n = 0; list.forEach(function (x) { n += x.length; }); var a = new Uint8Array(n), o = 0; list.forEach(function (x) { a.set(x, o); o += x.length; }); return a; }
  /** A box from a type and its body (an array of byte arrays). */
  function box(t, body) { var inner = join(body); return join([be(inner.length + 8, 4), ascii(t), inner]); }
  function full(t, version, flags, body) { return box(t, [new Uint8Array([version]), be(flags, 3)].concat(body)); }
  function serialize(node) {
    if (node.kids) return box(node.type, node.kids.map(serialize));
    if (node.raw) return node.raw;
    return box(node.type, [node.body]);
  }

  /** True when the file is made of fragments (has moof boxes). */
  function isFragmented(bytes) {
    var b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    try { return parse(b, 0, b.length).some(function (x) { return x.type === "moof"; }); } catch (e) { return false; }
  }

  /**
   * flatten(bytes) -> { bytes, duration (seconds), tracks: [{id, kind, samples, duration}] }
   * Throws an Error with a plain message when the file isn't something it can rewrite.
   */
  function flatten(input) {
    var b = input instanceof Uint8Array ? input : new Uint8Array(input);
    var top = parse(b, 0, b.length);
    var ftyp = find(top, "ftyp"), moov = find(top, "moov");
    if (!ftyp || !moov) throw new Error("This isn't an MP4 file.");
    var moofs = all(top, "moof");
    if (!moofs.length) return { bytes: b, unchanged: true };

    var mvhd = find(moov.kids, "mvhd"), movieScale = u32(mvhd.body, mvhd.body[0] === 1 ? 20 : 12);
    var trex = {};
    var mvex = find(moov.kids, "mvex");
    if (mvex) all(mvex.kids, "trex").forEach(function (x) {
      var d = x.body; trex[u32(d, 4)] = { sdi: u32(d, 8), dur: u32(d, 12), size: u32(d, 16), flags: u32(d, 20) };
    });
    var tracks = {};
    all(moov.kids, "trak").forEach(function (trak) {
      var tkhd = find(trak.kids, "tkhd"), id = u32(tkhd.body, tkhd.body[0] === 1 ? 20 : 12);
      var mdia = find(trak.kids, "mdia"), mdhd = find(mdia.kids, "mdhd"), hdlr = find(mdia.kids, "hdlr");
      tracks[id] = { id: id, trak: trak, scale: u32(mdhd.body, mdhd.body[0] === 1 ? 20 : 12), kind: type(hdlr.body, 8), chunks: [], samples: 0, ticks: 0, start: null, cts: false, sync: [], allSync: true };
    });

    // Read every fragment: each track run (trun) becomes one chunk of samples that sit next to each other in the file.
    moofs.forEach(function (moof) {
      all(moof.kids, "traf").forEach(function (traf) {
        var tfhd = find(traf.kids, "tfhd"), d = tfhd.body, fl = (d[1] << 16) | (d[2] << 8) | d[3], id = u32(d, 4), o = 8;
        var T = tracks[id]; if (!T) throw new Error("The video file refers to a track it doesn't have.");
        var def = trex[id] || { dur: 0, size: 0, flags: 0 }, base = moof.start;
        var dur = def.dur, size = def.size, sflags = def.flags;
        if (fl & 0x1) { base = u64(d, o); o += 8; }
        if (fl & 0x2) o += 4;
        if (fl & 0x8) { dur = u32(d, o); o += 4; }
        if (fl & 0x10) { size = u32(d, o); o += 4; }
        if (fl & 0x20) { sflags = u32(d, o); o += 4; }
        var tfdt = find(traf.kids, "tfdt");
        if (tfdt) {
          var at = tfdt.body[0] === 1 ? u64(tfdt.body, 4) : u32(tfdt.body, 4);
          if (T.start === null) T.start = at;
          else {
            // A fragment may start a little after the last one ended. Give the gap to the previous sample so every sample keeps its time.
            var gap = at - (T.start + T.ticks), lc = T.chunks[T.chunks.length - 1];
            if (gap && lc && lc.durs[lc.durs.length - 1] + gap > 0) { lc.durs[lc.durs.length - 1] += gap; T.ticks += gap; }
          }
        }
        all(traf.kids, "trun").forEach(function (trun) {
          var r = trun.body, v = r[0], rf = (r[1] << 16) | (r[2] << 8) | r[3], n = u32(r, 4), p = 8, dataOff = 0, first = null;
          if (rf & 0x1) { dataOff = u32(r, p) | 0; p += 4; }
          if (rf & 0x4) { first = u32(r, p); p += 4; }
          var chunk = { at: base + dataOff, bytes: 0, sizes: [], durs: [], cts: [], first: T.samples };
          for (var i = 0; i < n; i++) {
            var sd = dur, ss = size, sf = i === 0 && first !== null ? first : sflags, sc = 0;
            if (rf & 0x100) { sd = u32(r, p); p += 4; }
            if (rf & 0x200) { ss = u32(r, p); p += 4; }
            if (rf & 0x400) { sf = u32(r, p); p += 4; }
            if (rf & 0x800) { sc = v === 1 ? u32(r, p) | 0 : u32(r, p); p += 4; }
            chunk.sizes.push(ss); chunk.durs.push(sd); chunk.cts.push(sc); chunk.bytes += ss;
            if (sc) T.cts = true;
            var nonSync = (sf >>> 16) & 1;
            if (nonSync) T.allSync = false; else T.sync.push(T.samples + 1);
            T.samples++; T.ticks += sd;
          }
          if (chunk.at + chunk.bytes > b.length) throw new Error("The video file is cut short: a piece of it is missing.");
          T.chunks.push(chunk);
        });
      });
    });

    var ids = Object.keys(tracks).map(Number).filter(function (id) { return tracks[id].samples; });
    if (!ids.length) throw new Error("The video file has no audio or video in it.");
    // Chunks go into the new mdat in the order they appeared in the file, so audio and video stay interleaved.
    var order = [];
    ids.forEach(function (id) { tracks[id].chunks.forEach(function (c) { order.push({ id: id, c: c }); }); });
    order.sort(function (x, y) { return x.c.at - y.c.at; });

    function sampleTable(T, offsets) {
      // stts: runs of equal durations; ctts: runs of equal offsets; stsz: every size; stsc: samples per chunk; stco/co64: where each chunk starts.
      var durs = [], cts = [], sizes = [];
      T.chunks.forEach(function (c) { durs = durs.concat(c.durs); cts = cts.concat(c.cts); sizes = sizes.concat(c.sizes); });
      function runs(list) { var out = []; list.forEach(function (x) { var l = out[out.length - 1]; if (l && l[1] === x) l[0]++; else out.push([1, x]); }); return out; }
      var stts = runs(durs), kids = [];
      kids.push(full("stts", 0, 0, [be(stts.length, 4)].concat(stts.map(function (r) { return join([be(r[0], 4), be(r[1], 4)]); }))));
      if (T.cts) {
        var neg = cts.some(function (x) { return x < 0; }), ct = runs(cts);
        kids.push(full("ctts", neg ? 1 : 0, 0, [be(ct.length, 4)].concat(ct.map(function (r) { return join([be(r[0], 4), be(r[1] < 0 ? r[1] + 4294967296 : r[1], 4)]); }))));
      }
      if (!T.allSync) kids.push(full("stss", 0, 0, [be(T.sync.length, 4)].concat(T.sync.map(function (s) { return be(s, 4); }))));
      var sc = []; T.chunks.forEach(function (c, i) { var l = sc[sc.length - 1]; if (!l || l[1] !== c.sizes.length) sc.push([i + 1, c.sizes.length]); });
      kids.push(full("stsc", 0, 0, [be(sc.length, 4)].concat(sc.map(function (r) { return join([be(r[0], 4), be(r[1], 4), be(1, 4)]); }))));
      kids.push(full("stsz", 0, 0, [be(0, 4), be(sizes.length, 4)].concat(sizes.map(function (s) { return be(s, 4); }))));
      var big = offsets.some(function (o) { return o > 4294967295; });
      kids.push(full(big ? "co64" : "stco", 0, 0, [be(offsets.length, 4)].concat(offsets.map(function (o) { return be(o, big ? 8 : 4); }))));
      return kids;
    }
    function setDuration(node, value) {
      // mvhd, tkhd and mdhd keep the duration at a fixed place: after the times (and the timescale or track id).
      var d = new Uint8Array(node.body), v = d[0], at = node.type === "tkhd" ? (v === 1 ? 28 : 20) : (v === 1 ? 24 : 16);
      if (v === 1) d.set(be(value, 8), at); else d.set(be(Math.min(value, 4294967295), 4), at);
      return { type: node.type, body: d };
    }

    var movieTicks = 0, info = [];
    ids.forEach(function (id) { var T = tracks[id]; T.movieTicks = Math.round(T.ticks * movieScale / T.scale); movieTicks = Math.max(movieTicks, T.movieTicks); });

    function buildMoov(offsets) {
      var kids = [setDuration(mvhd, movieTicks)];
      moov.kids.forEach(function (k) {
        if (k.type === "mvhd" || k.type === "mvex") return;
        if (k.type !== "trak") { kids.push(k); return; }
        var id = u32(find(k.kids, "tkhd").body, find(k.kids, "tkhd").body[0] === 1 ? 20 : 12), T = tracks[id];
        if (!T || !T.samples) return;
        kids.push({ type: "trak", kids: k.kids.map(function (t) {
          if (t.type === "tkhd") return setDuration(t, T.movieTicks);
          if (t.type === "edts") return null;
          if (t.type !== "mdia") return t;
          return { type: "mdia", kids: t.kids.map(function (m) {
            if (m.type === "mdhd") return setDuration(m, T.ticks);
            if (m.type !== "minf") return m;
            return { type: "minf", kids: m.kids.map(function (s) {
              if (s.type !== "stbl") return s;
              var stsd = find(s.kids, "stsd");
              return { type: "stbl", kids: [stsd].concat(sampleTable(T, offsets[id]).map(function (raw) { return { raw: raw }; })) };
            }) };
          }) };
        }).filter(Boolean).concat(T.start ? [elst(T)] : []) });
      });
      return serialize({ type: "moov", kids: kids });
    }
    // If a track's first sample doesn't start at zero, an edit list keeps it in step with the other track.
    function elst(T) {
      var delay = Math.round(T.start * movieScale / T.scale);
      return { raw: box("edts", [full("elst", 0, 0, [be(2, 4), be(delay, 4), be(0xffffffff, 4), be(1, 2), be(0, 2), be(T.movieTicks, 4), be(0, 4), be(1, 2), be(0, 2)])]) };
    }

    // Lay out: ftyp, moov, mdat. moov's size depends on the offsets only through stco vs co64, so build it twice.
    var ftypBytes = serialize(ftyp), dataSize = order.reduce(function (s, x) { return s + x.c.bytes; }, 0);
    var mdatHdr = dataSize + 8 > 4294967295 ? 16 : 8;
    function offsetsFrom(moovSize) {
      var at = ftypBytes.length + moovSize + mdatHdr, off = {};
      ids.forEach(function (id) { off[id] = []; });
      order.forEach(function (x) { off[x.id].push(at); at += x.c.bytes; });
      return off;
    }
    var moovBytes = buildMoov(offsetsFrom(0));
    moovBytes = buildMoov(offsetsFrom(moovBytes.length));
    var check = buildMoov(offsetsFrom(moovBytes.length));
    if (check.length !== moovBytes.length) moovBytes = buildMoov(offsetsFrom(check.length));

    var out = new Uint8Array(ftypBytes.length + moovBytes.length + mdatHdr + dataSize), o = 0;
    out.set(ftypBytes, o); o += ftypBytes.length;
    out.set(moovBytes, o); o += moovBytes.length;
    if (mdatHdr === 16) { out.set(be(1, 4), o); out.set(ascii("mdat"), o + 4); out.set(be(dataSize + 16, 8), o + 8); }
    else { out.set(be(dataSize + 8, 4), o); out.set(ascii("mdat"), o + 4); }
    o += mdatHdr;
    order.forEach(function (x) { out.set(b.subarray(x.c.at, x.c.at + x.c.bytes), o); o += x.c.bytes; });

    ids.forEach(function (id) { var T = tracks[id]; info.push({ id: id, kind: T.kind, samples: T.samples, duration: T.ticks / T.scale }); });
    return { bytes: out, duration: movieTicks / movieScale, tracks: info };
  }

  var Mp4 = { flatten: flatten, isFragmented: isFragmented, parse: parse };
  if (typeof module !== "undefined" && module.exports) module.exports = Mp4; else root.Mp4 = Mp4;
})(typeof window !== "undefined" ? window : this);
