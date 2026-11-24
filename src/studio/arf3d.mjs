/* The fictional ARF-1 training rig in 3D, for the illustrated parts catalogue (/studio/ipc).

   The geometry is the one scripts/aero/draw.py draws the catalogue figures from: the same boxes and cylinders, in the
   same units, at the same places, and the same distances between a part's place on the rig and its place in the
   exploded view. Change a part there and here together. Parts are white with ink edges, like the drawings; nothing
   is textured, and no CAD data or real equipment is behind it.

   The build bundles this file with three.js into /studio/arf3d.js (build.mjs); the page loads it only when a reader
   asks for the 3D view. It holds no words: /studio/ipc.js gives it the label of the canvas and hears which part was
   picked. The parts list stays the way to reach every part with a keyboard or a screen reader. */
import {
  AmbientLight, BoxGeometry, BufferGeometry, Color, CylinderGeometry, DirectionalLight, DoubleSide, EdgesGeometry,
  Float32BufferAttribute, Group, LineBasicMaterial, LineSegments, Mesh, MeshLambertMaterial, OrthographicCamera,
  Raycaster, RingGeometry, Scene, Vector2, Vector3, WebGLRenderer,
} from "three";

const INK = 0x1b1b1b, PAPER = 0xffffff, PICKED = 0xffe9a8, GLASS = 0xcfe6f3;
const HOLES = [[200, 80], [350, 80], [200, 220], [350, 220]];
/* The drawing's axes are x (along the rig), y (toward the reader) and z (up); three.js has y up. */
const at = (x, y, z) => new Vector3(x, z, y);

function solid(geo, mat, line) {
  const m = new Mesh(geo, mat);
  m.add(new LineSegments(new EdgesGeometry(geo, 25), line));
  return m;
}
function box(mat, line, x0, y0, z0, dx, dy, dz) {
  const m = solid(new BoxGeometry(dx, dz, dy), mat, line);
  m.position.copy(at(x0 + dx / 2, y0 + dy / 2, z0 + dz / 2));
  return m;
}
/** A cylinder from c along +axis ("x", "y" or "z" of the drawing). */
function cyl(mat, line, c, r, len, axis, open) {
  const m = solid(new CylinderGeometry(r, r, len, 56, 1, !!open), mat, line);
  if (axis === "x") { m.rotation.z = Math.PI / 2; m.position.copy(at(c[0] + len / 2, c[1], c[2])); }
  else if (axis === "y") { m.rotation.x = Math.PI / 2; m.position.copy(at(c[0], c[1] + len / 2, c[2])); }
  else m.position.copy(at(c[0], c[1], c[2] + len / 2));
  return m;
}
/** Ink lines on a face: circles of the given radii about c, and spokes of the largest one, on a plane across an axis. */
function marks(line, c, radii, axis, spokes) {
  const pts = [], n = 64;
  const on = (r, t) => axis === "x" ? at(c[0], c[1] + r * Math.cos(t), c[2] + r * Math.sin(t)) : at(c[0] + r * Math.cos(t), c[1], c[2] + r * Math.sin(t));
  for (const r of radii) for (let i = 0; i < n; i++) { pts.push(on(r, 2 * Math.PI * i / n), on(r, 2 * Math.PI * (i + 1) / n)); }
  for (let k = 0; k < (spokes || 0); k++) { const t = Math.PI * k / spokes; pts.push(on(radii[0], t), on(-radii[0], t)); }
  const g = new BufferGeometry();
  g.setAttribute("position", new Float32BufferAttribute(pts.flatMap((p) => [p.x, p.y, p.z]), 3));
  return new LineSegments(g, line);
}

/** Every catalogue item: what it is made of on the rig, and how far it moves in the exploded view (drawing units). */
function parts(line) {
  const list = [];
  const item = (id, away, make, glass) => {
    const mat = new MeshLambertMaterial(glass ? { color: GLASS, transparent: true, opacity: 0.38, side: DoubleSide, depthWrite: false } : { color: PAPER });
    const g = new Group();
    for (const m of make(mat)) g.add(m);
    g.traverse((o) => { o.userData.item = id; });
    list.push({ id, g, mat, glass: !!glass, away: at(away[0], away[1], away[2]) });
  };
  item("006", [0, 0, 0], (m) => [box(m, line, 70, 120, 12, 60, 60, 88), cyl(m, line, [30, 150, 160], 60, 140, "x")]);
  item("007", [-215, 0, 0], (m) => [cyl(m, line, [45, 150, 160], 50, 110, "x"), marks(line, [155.4, 150, 160], [22], "x")]);
  item("008", [-60, 0, 0], (m) => {
    const two = new MeshLambertMaterial({ color: PAPER, side: DoubleSide });
    m.side = DoubleSide;
    const cap = (x) => { const r = solid(new RingGeometry(55, 63, 56), two, line); r.rotation.y = Math.PI / 2; r.position.copy(at(x, 150, 160)); return r; };
    return [cyl(m, line, [20, 150, 160], 63, 10, "x", true), cyl(m, line, [20, 150, 160], 55, 10, "x", true), cap(20), cap(30)];
  });
  item("009", [0, 0, 42], (m) => [cyl(m, line, [100, 150, 220], 12, 16, "z"), cyl(m, line, [100, 150, 236], 7, 8, "z")]);
  item("001", [0, 0, 60], (m) => [box(m, line, 190, 70, 12, 170, 160, 10), box(m, line, 210, 85, 22, 130, 130, 140), marks(line, [340.4, 150, 92], [52, 40, 28, 14], "x", 6)]);
  item("003", [0, 0, 226], (m) => HOLES.map(([x, y]) => cyl(m, line, [x, y, 22], 8, 2.2, "z")));
  item("002", [0, 0, 263.8], (m) => HOLES.flatMap(([x, y]) => [cyl(m, line, [x, y, -1.8], 3.2, 26, "z"), cyl(m, line, [x, y, 24.2], 7, 5, "z")]));
  item("004", [0, 0, 60], (m) => [182, 368].flatMap((x) => [box(m, line, x - 14, 141, 36, 28, 18, 12), box(m, line, x - 4, 141, 48, 8, 18, 16)]));
  item("005", [0, 0, 0], (m) => [182, 368].flatMap((x) => [box(m, line, x - 16, 138, 12, 32, 24, 6), box(m, line, x - 16, 138, 18, 6, 24, 22)]));
  item("011", [50, 47, 30], (m) => [box(m, line, 262, 215, 50, 26, 22, 20)]);
  item("010", [40, 0, 0], (m) => [box(m, line, 470, 170, 12, 130, 130, 140), marks(line, [495, 300.4, 120], [7], "y"), marks(line, [530, 300.4, 120], [5], "y"), marks(line, [560, 300.4, 120], [5], "y"), marks(line, [520, 300.4, 70], [15, 4], "y"), box(m, line, 572, 300, 50, 12, 5, 26)]);
  item("012", [0, 110, 0], (m) => [box(m, line, 170, 329, 20, 260, 2, 170)], true);
  return list;
}

/** Puts the rig in `el`. opts: label (the canvas's text alternative), onPick(item or ""), still (true for no easing). */
export function mount(el, opts) {
  opts = opts || {};
  const canvas = document.createElement("canvas");
  canvas.className = "ip-3dc";
  canvas.tabIndex = 0;
  canvas.setAttribute("role", "img");
  if (opts.label) canvas.setAttribute("aria-label", opts.label);
  const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: "low-power" });
  renderer.setClearColor(PAPER, 1);
  el.appendChild(canvas);

  const scene = new Scene();
  scene.add(new AmbientLight(0xffffff, 2.1));
  const sun = new DirectionalLight(0xffffff, 1.5);
  sun.position.set(-0.4, 1, 0.25);
  scene.add(sun);
  const line = new LineBasicMaterial({ color: INK });
  const fixed = new MeshLambertMaterial({ color: PAPER });
  const rig = new Group();
  // The base and the back wall, the duct and the flow indicator: on the rig, not in the parts list.
  for (const m of [box(fixed, line, 0, 0, 0, 620, 320, 12), box(fixed, line, 0, 0, 12, 620, 14, 200), cyl(fixed, line, [360, 150, 160], 40, 120, "x"), box(fixed, line, 400, 118, 195, 52, 64, 46)]) rig.add(m);
  const list = parts(line);
  for (const p of list) rig.add(p.g);
  scene.add(rig);

  const cam = new OrthographicCamera(-1, 1, 1, -1, -4000, 4000);
  const HOME = { az: Math.PI / 4, el: Math.atan(Math.SQRT1_2), zoom: 1 };
  const view = { az: HOME.az, el: HOME.el, zoom: 1, open: 1 }, goal = { open: 1 };
  let selected = "", raf = 0, gone = false;

  function frame() {
    raf = 0;
    if (gone) return;
    const gap = goal.open - view.open;
    view.open = opts.still || Math.abs(gap) < 0.004 ? goal.open : view.open + gap * 0.18;
    for (const p of list) p.g.position.copy(p.away).multiplyScalar(view.open);
    // What has to fit: the rig, and the parts as far out as they are now.
    const o = view.open, centre = at(310 - 90 * o, 160 + 55 * o, 100 + 95 * o), reach = 345 + 75 * o;
    const w = el.clientWidth || 1, h = el.clientHeight || 1, half = reach / view.zoom;
    cam.left = -half * (w / h); cam.right = half * (w / h); cam.top = half; cam.bottom = -half;
    cam.position.set(centre.x + 1000 * Math.cos(view.el) * Math.sin(view.az), centre.y + 1000 * Math.sin(view.el), centre.z + 1000 * Math.cos(view.el) * Math.cos(view.az));
    cam.lookAt(centre);
    cam.updateProjectionMatrix();
    renderer.render(scene, cam);
    if (view.open !== goal.open) raf = requestAnimationFrame(frame);
  }
  const draw = () => { if (!raf && !gone) raf = requestAnimationFrame(frame); };
  function size() {
    const w = el.clientWidth || 1, h = el.clientHeight || 1;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(w, h, false);
    draw();
  }
  const ro = window.ResizeObserver ? new ResizeObserver(size) : null;
  if (ro) ro.observe(el); else window.addEventListener("resize", size);

  // A drag turns the rig; a press without a drag picks the part under the pointer.
  const ray = new Raycaster(), spot = new Vector2();
  let from = null, dragged = false;
  canvas.addEventListener("pointerdown", (e) => { if (e.button !== 0) return; from = { x: e.clientX, y: e.clientY, az: view.az, el: view.el }; dragged = false; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener("pointermove", (e) => {
    if (!from) return;
    const dx = e.clientX - from.x, dy = e.clientY - from.y;
    if (!dragged && Math.abs(dx) + Math.abs(dy) < 5) return;
    dragged = true; canvas.classList.add("dragging");
    view.az = from.az - dx * 0.008;
    view.el = Math.max(0.09, Math.min(1.48, from.el + dy * 0.008));
    draw();
  });
  const end = (e) => {
    if (!from) return;
    const was = dragged;
    from = null; canvas.classList.remove("dragging");
    if (was || e.type !== "pointerup") return;
    const r = canvas.getBoundingClientRect();
    spot.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(spot, cam);
    const hit = ray.intersectObjects(list.filter((p) => p.g.visible).map((p) => p.g), true).filter((h) => h.object.isMesh)[0];
    if (opts.onPick) opts.onPick(hit ? hit.object.userData.item : "");
  };
  canvas.addEventListener("pointerup", end);
  canvas.addEventListener("pointercancel", end);
  canvas.addEventListener("keydown", (e) => {
    const step = { ArrowLeft: [0.12, 0], ArrowRight: [-0.12, 0], ArrowUp: [0, 0.08], ArrowDown: [0, -0.08] }[e.key];
    if (!step) return;
    e.preventDefault();
    view.az += step[0];
    view.el = Math.max(0.09, Math.min(1.48, view.el + step[1]));
    draw();
  });
  canvas.addEventListener("webglcontextlost", (e) => { e.preventDefault(); if (opts.onLost) opts.onLost(); });

  const api = {
    /** The item to show as selected ("" for none). */
    select(id) { selected = id || ""; for (const p of list) p.mat.color = new Color(p.id === selected ? PICKED : p.glass ? GLASS : PAPER); draw(); },
    /** The items of the issue on show, and those that are not on the chosen product (drawn faint). */
    show(ids, faint) { for (const p of list) { p.g.visible = ids.indexOf(p.id) >= 0; const f = !!faint && faint.indexOf(p.id) >= 0; if (!p.glass) { p.mat.transparent = f; p.mat.opacity = f ? 0.3 : 1; p.mat.needsUpdate = true; } } draw(); },
    /** 0 on the rig, 1 apart as in the catalogue figure. */
    explode(t) { goal.open = Math.max(0, Math.min(1, t)); draw(); },
    zoom(step) { view.zoom = step === 0 ? 1 : Math.max(1, Math.min(4, view.zoom * (step > 0 ? 1.4 : 1 / 1.4))); draw(); return view.zoom; },
    reset() { view.az = HOME.az; view.el = HOME.el; view.zoom = 1; draw(); },
    dispose() {
      gone = true;
      if (raf) cancelAnimationFrame(raf);
      if (ro) ro.disconnect(); else window.removeEventListener("resize", size);
      scene.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
      renderer.dispose();
      canvas.remove();
    },
  };
  size();
  api.select("");
  return api;
}
