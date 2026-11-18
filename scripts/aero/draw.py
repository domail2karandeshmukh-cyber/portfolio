#!/usr/bin/env python3
"""Draws the illustrations (ICNs) of the fictional ARF-1 training rig as SVG line art, into content/aerospace/csdb.

    python3 -I scripts/aero/draw.py

Original drawings of an invented rig, in an isometric projection made by this script: no CAD data, no real
equipment. Each part of the parts-catalogue view is a group with the id item-NNN, which the illustrated parts data
module names as the hotspot's applicationStructureIdent, so a viewer can highlight a part from the parts list and
the parts list from the picture.
"""
import math
import os

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, "content", "aerospace", "csdb")
C30, S30 = math.cos(math.radians(30)), 0.5
INK = "#1b1b1b"
FILL = {"top": "#ffffff", "x": "#e9e9e9", "y": "#f5f5f5", "flat": "#ffffff"}
W, H = 800, 560


class View:
    def __init__(self, scale, ox, oy):
        self.s, self.ox, self.oy = scale, ox, oy

    def p(self, x, y, z):
        return (self.ox + (x - y) * C30 * self.s, self.oy + (x + y) * S30 * self.s - z * self.s)


def pts(points):
    return " ".join(f"{x:.1f},{y:.1f}" for x, y in points)


def poly(points, fill="#fff", sw=1.2, extra=""):
    return f'<polygon points="{pts(points)}" fill="{fill}" stroke="{INK}" stroke-width="{sw}" stroke-linejoin="round"{extra}/>'


def line(v, a, b, sw=0.9, dash=None):
    (x1, y1), (x2, y2) = v.p(*a), v.p(*b)
    d = f' stroke-dasharray="{dash}"' if dash else ""
    return f'<line x1="{x1:.1f}" y1="{y1:.1f}" x2="{x2:.1f}" y2="{y2:.1f}" stroke="{INK}" stroke-width="{sw}"{d}/>'


def box(v, x0, y0, z0, dx, dy, dz, cls="solid"):
    x1, y1, z1 = x0 + dx, y0 + dy, z0 + dz
    top = [v.p(x0, y0, z1), v.p(x1, y0, z1), v.p(x1, y1, z1), v.p(x0, y1, z1)]
    fx = [v.p(x1, y0, z0), v.p(x1, y1, z0), v.p(x1, y1, z1), v.p(x1, y0, z1)]
    fy = [v.p(x0, y1, z0), v.p(x1, y1, z0), v.p(x1, y1, z1), v.p(x0, y1, z1)]
    return f'<g class="{cls}">' + poly(top, FILL["top"]) + poly(fx, FILL["x"]) + poly(fy, FILL["y"]) + "</g>"


def circle3(v, c, r, axis, n=72):
    cx, cy, cz = c
    out = []
    for i in range(n):
        t = 2 * math.pi * i / n
        a, b = r * math.cos(t), r * math.sin(t)
        out.append(v.p(cx, cy + a, cz + b) if axis == "x" else v.p(cx + a, cy, cz + b) if axis == "y" else v.p(cx + a, cy + b, cz))
    return out


def hull(points):
    pts_ = sorted(set((round(x, 2), round(y, 2)) for x, y in points))
    if len(pts_) < 3:
        return pts_

    def cross(o, a, b):
        return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
    lower, upper = [], []
    for p in pts_:
        while len(lower) >= 2 and cross(lower[-2], lower[-1], p) <= 0:
            lower.pop()
        lower.append(p)
    for p in reversed(pts_):
        while len(upper) >= 2 and cross(upper[-2], upper[-1], p) <= 0:
            upper.pop()
        upper.append(p)
    return lower[:-1] + upper[:-1]


def cylinder(v, c, r, length, axis, cls="solid", face="#ffffff", rings=()):
    """A cylinder from c along +axis. The far end and the side are drawn as one silhouette, then the near end."""
    cx, cy, cz = c
    end = (cx + length, cy, cz) if axis == "x" else (cx, cy + length, cz) if axis == "y" else (cx, cy, cz + length)
    a, b = circle3(v, c, r, axis), circle3(v, end, r, axis)
    out = f'<g class="{cls}">' + poly(hull(a + b), FILL["y"])
    for k in rings:  # rings along the length, for detail
        mid = (cx + k, cy, cz) if axis == "x" else (cx, cy + k, cz) if axis == "y" else (cx, cy, cz + k)
        out += f'<polyline points="{pts(half(circle3(v, mid, r, axis), axis))}" fill="none" stroke="{INK}" stroke-width="0.7"/>'
    out += poly(b, face) + "</g>"
    return out


def half(points, axis):
    """The visible half of a ring on a cylinder side: the lower half in screen space."""
    ys = [p[1] for p in points]
    mid = (max(ys) + min(ys)) / 2
    n = len(points)
    start = max(range(n), key=lambda i: points[i][0])
    seq = points[start:] + points[:start]
    lo = [p for p in seq if p[1] >= mid - 0.01]
    return lo


def ring(v, c, r, axis, sw=0.8, fill="none"):
    return f'<polygon points="{pts(circle3(v, c, r, axis))}" fill="{fill}" stroke="{INK}" stroke-width="{sw}"/>'


def label(x, y, text, anchor="start", size=13, weight="400"):
    return f'<text x="{x:.1f}" y="{y:.1f}" font-size="{size}" font-weight="{weight}" text-anchor="{anchor}">{text}</text>'


def callout(v, at3, to, text, item=None):
    """A leader from a point on the part to a label. The number is the item number of the parts list."""
    (ax, ay), (tx, ty) = v.p(*at3), to
    g = (f'<g class="callout"{f" data-item={chr(34)}{item}{chr(34)}" if item else ""}>'
         f'<line x1="{ax:.1f}" y1="{ay:.1f}" x2="{tx:.1f}" y2="{ty:.1f}" stroke="{INK}" stroke-width="0.8"/>'
         f'<circle cx="{ax:.1f}" cy="{ay:.1f}" r="2.2" fill="{INK}"/>')
    anchor = "end" if tx < ax else "start"
    dx = -5 if anchor == "end" else 5
    g += label(tx + dx, ty + 4.5, text, anchor, 14 if item else 12.5, "600" if item else "400") + "</g>"
    return g


def co(v, at3, dx, dy, text, item=None):
    """A callout whose label sits dx, dy pixels from the point it marks."""
    x, y = v.p(*at3)
    return callout(v, at3, (x + dx, y + dy), text, item)


def explode(v, a, b):
    return line(v, a, b, 0.7, "10 3 2 3")


def svg(icn, title, desc, body, note=None):
    foot = label(W - 14, H - 12, icn, "end", 10.5)
    if note:
        foot += label(14, H - 12, note, "start", 10.5)
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}" role="img" aria-labelledby="t d">'
            f'<title id="t">{title}</title><desc id="d">{desc}</desc>'
            f'<style>text{{font-family:"Hanken Grotesk","Helvetica Neue",Arial,sans-serif;fill:{INK}}}'
            f'.part.on .solid polygon{{fill:#ffe9a8}}.callout.on text{{fill:#9a5b00}}.callout.on line{{stroke:#9a5b00;stroke-width:1.6}}.callout.on circle{{fill:#9a5b00}}</style>'
            f'<rect width="{W}" height="{H}" fill="#fff"/>{body}{foot}</svg>')

# ---------------------------------------------------------------- The parts of the rig


def base(v):
    return box(v, 0, 0, 0, 620, 320, 12) + box(v, 0, 0, 12, 620, 14, 200)


def filter_housing(v, dx=0, cover=True):
    out = box(v, 70 + dx, 120, 12, 60, 60, 88)  # support
    out += cylinder(v, (30 + dx, 150, 160), 60, 140, "x", rings=(20, 120))
    return out


def filter_element(v, x0, open_=True):
    out = cylinder(v, (x0, 150, 160), 50, 110, "x", rings=(12, 24, 36, 48, 60, 72, 84, 96), face="#ffffff")
    out += ring(v, (x0 + 110, 150, 160), 22, "x", 0.8)
    return out


def clamp(v, x0):
    """A band clamp: a ring, so what is behind it shows through the middle."""
    a, b = circle3(v, (x0, 150, 160), 63, "x"), circle3(v, (x0 + 10, 150, 160), 63, "x")
    hole = circle3(v, (x0 + 10, 150, 160), 55, "x")
    d = "M" + " L".join(f"{x:.1f},{y:.1f}" for x, y in b) + "Z M" + " L".join(f"{x:.1f},{y:.1f}" for x, y in hole) + "Z"
    side = hull(a + b)
    dh = "M" + " L".join(f"{x:.1f},{y:.1f}" for x, y in side) + "Z M" + " L".join(f"{x:.1f},{y:.1f}" for x, y in circle3(v, (x0, 150, 160), 55, "x")) + "Z"
    return (f'<g class="solid"><path d="{dh}" fill="{FILL["y"]}" fill-rule="evenodd" stroke="{INK}" stroke-width="1.2"/>'
            f'<path d="{d}" fill="#f0f0f0" fill-rule="evenodd" stroke="{INK}" stroke-width="1.2"/></g>')


def indicator(v, z0):
    out = cylinder(v, (100, 150, z0), 12, 16, "z", face="#ffffff")
    out += cylinder(v, (100, 150, z0 + 16), 7, 8, "z", face="#ffffff")
    return out


def fan(v, z0=0):
    """The fan assembly: housing with a flange; the outlet grille is on the +x face."""
    out = box(v, 190, 70, 12 + z0, 170, 160, 10)  # flange
    out += box(v, 210, 85, 22 + z0, 130, 130, 140)  # housing
    c = (340, 150, 92 + z0)
    for r in (52, 40, 28, 14):
        out += ring(v, c, r, "x", 0.9 if r == 52 else 0.6)
    for k in range(6):  # grille bars
        t = math.pi * k / 6
        a = (340, 150 + 52 * math.cos(t), 92 + z0 + 52 * math.sin(t))
        b = (340, 150 - 52 * math.cos(t), 92 + z0 - 52 * math.sin(t))
        out += line(v, a, b, 0.6)
    return out


def flange_holes(v, z0=0, rad=4):
    out = ""
    for x, y in ((200, 80), (350, 80), (200, 220), (350, 220)):
        out += ring(v, (x, y, 22.2 + z0), rad, "z", 0.8, "#ffffff")
    return out


def screw(v, x, y, z):
    return cylinder(v, (x, y, z), 3.2, 26, "z", face="#ffffff") + cylinder(v, (x, y, z + 26), 7, 5, "z", face="#ffffff") + line(v, (x - 4.5, y, z + 31.1), (x + 4.5, y, z + 31.1), 0.9)


def washer(v, x, y, z):
    return cylinder(v, (x, y, z), 8, 2.2, "z", face="#ffffff") + ring(v, (x, y, z + 2.2), 3.4, "z", 0.7)


def latch(v, x, y, z):
    return box(v, x - 14, y - 9, z, 28, 18, 12) + box(v, x - 4, y - 9, z + 12, 8, 18, 16)


def bracket(v, x, y, z):
    return box(v, x - 16, y - 12, z, 32, 24, 6) + box(v, x - 16, y - 12, z + 6, 6, 24, 22)


def duct(v):
    return cylinder(v, (360, 150, 160), 40, 120, "x", rings=(60,))


def flow_indicator(v):
    out = box(v, 400, 118, 195, 52, 64, 46)
    a = v.p(426, 182, 236)
    out += f'<path d="M{a[0]-16:.1f},{a[1]+10:.1f} a18 12 0 0 1 32 0" fill="none" stroke="{INK}" stroke-width="0.8"/>'
    out += line(v, (426, 182, 222), (434, 182, 232), 1.2)
    return out


def control_box(v, dx=0):
    out = box(v, 470 + dx, 170, 12, 130, 130, 140)
    # front (+y) face details: switch, knob, lamps
    for x, z, r in ((495, 120, 7), (530, 120, 5), (560, 120, 5)):
        out += ring(v, (x + dx, 300, z), r, "y", 0.8, "#ffffff")
    out += ring(v, (520 + dx, 300, 70), 15, "y", 0.9, "#ffffff") + ring(v, (520 + dx, 300, 70), 4, "y", 0.7)
    out += box(v, 572 + dx, 300, 50, 12, 5, 26)
    return out


def cable(v, z0=0, dy=0):
    a, b = v.p(275, 215 + dy, 60 + z0), v.p(470, 230, 80)
    c1, c2 = v.p(320, 280, 30 + z0), v.p(420, 280, 40)
    return f'<path d="M{a[0]:.1f},{a[1]:.1f} C{c1[0]:.1f},{c1[1]:.1f} {c2[0]:.1f},{c2[1]:.1f} {b[0]:.1f},{b[1]:.1f}" fill="none" stroke="{INK}" stroke-width="3.4"/>' \
           f'<path d="M{a[0]:.1f},{a[1]:.1f} C{c1[0]:.1f},{c1[1]:.1f} {c2[0]:.1f},{c2[1]:.1f} {b[0]:.1f},{b[1]:.1f}" fill="none" stroke="#fff" stroke-width="1.6"/>'


def connector(v, z0=0, dy=0):
    return box(v, 262, 215 + dy, 50 + z0, 26, 22, 20)


def panel(v, dy=0):
    x0, x1, z0, z1, y = 170, 430, 20, 190, 330 + dy
    face = [v.p(x0, y, z0), v.p(x1, y, z0), v.p(x1, y, z1), v.p(x0, y, z1)]
    inner = [v.p(x0 + 14, y, z0 + 14), v.p(x1 - 14, y, z0 + 14), v.p(x1 - 14, y, z1 - 14), v.p(x0 + 14, y, z1 - 14)]
    return (f'<g class="solid"><polygon points="{pts(face)}" fill="#eef6fb" fill-opacity="0.55" stroke="{INK}" stroke-width="1.2"/>'
            f'<polygon points="{pts(inner)}" fill="none" stroke="{INK}" stroke-width="0.6"/></g>')

# ---------------------------------------------------------------- The illustrations


def general():
    v = View(0.78, 300, 190)
    body = base(v) + filter_housing(v) + clamp(v, 150) + indicator(v, 220) + fan(v) + flange_holes(v) + cable(v) + connector(v) + duct(v) + flow_indicator(v) + control_box(v)
    calls = [
        callout(v, (40, 160, 214), (110, 150), "Air filter"),
        callout(v, (100, 150, 244), (230, 24), "Differential pressure indicator"),
        callout(v, (275, 85, 162), (330, 40), "Fan assembly"),
        callout(v, (426, 150, 241), (600, 70), "Airflow indicator"),
        callout(v, (470, 150, 190), (650, 130), "Outlet duct"),
        callout(v, (600, 236, 152), (720, 300), "Control box"),
        callout(v, (262, 226, 60), (150, 470), "Connector"),
        callout(v, (600, 7, 212), (740, 190), "Frame"),
    ]
    body += "".join(calls)
    return svg("ICN-0DEMO-ARF0001-001-01", "ARF-1 training rig - general view",
               "Isometric view of the fictional training rig: the air filter on the left, the fan assembly in the middle, the outlet duct with the airflow indicator, and the control box at the front right, on a base plate with a rear frame.", body, "Access panel not shown. Fictional training rig.")


def fan_ri(post):
    v = View(0.86, 300, 236)
    lift = 150
    calls = []
    body = box(v, 150, 40, 0, 260, 220, 12)  # the base plate under the fan
    body += flange_holes(v, -10, 4) if not post else ""
    if post:
        for x in (182, 368):
            body += bracket(v, x, 150, 12)
        calls.append(co(v, (182, 162, 30), -150, 40, "5", "005"))
    body += explode(v, (275, 150, 12), (275, 150, lift))
    body += fan(v, lift - 10)
    if not post:
        for x, y in ((200, 80), (350, 80), (200, 220), (350, 220)):
            body += explode(v, (x, y, 22 + lift - 10), (x, y, 210 + lift))
            body += washer(v, x, y, 175 + lift - 10)
            body += screw(v, x, y, 195 + lift - 10)
        calls.append(co(v, (200, 220, 226 + lift - 10), -150, -20, "2", "002"))
        calls.append(co(v, (200, 220, 177 + lift - 10), -160, 10, "3", "003"))
    else:
        for x in (182, 368):
            body += latch(v, x, 150, 26 + lift)
        calls.append(co(v, (182, 159, 40 + lift), -170, -30, "4", "004"))
    body += explode(v, (300, 262, 60 + lift - 10), (300, 262, 60))
    body += connector(v, lift - 10, 32).replace("", "") if False else box(v, 290, 247, 50 + lift - 10, 26, 22, 20)
    calls.append(co(v, (275, 85, 162 + lift - 10), 170, -40, "1", "001"))
    calls.append(co(v, (303, 269, 60 + lift - 10), -190, 120, "11", "011"))
    body += "".join(calls)
    title = "Fan assembly - removal and installation (" + ("after" if post else "before") + " Modification M01)"
    desc = ("Exploded view: the fan assembly (1) lifted off the base plate. " + ("Two quick-release latches (4) on two brackets (5) hold it." if post else
            "Four screws (2) and four washers (3) hold its flange to the base plate.") + " The connector (11) is disconnected.")
    return svg(ICN["fan-latches" if post else "fan-screws"], title, desc, body, "Fictional training rig. Not to scale.")


def filter_view():
    v = View(1.0, 300, 250)
    body = box(v, 20, 60, 0, 260, 180, 12)
    body += box(v, 160, 120, 12, 60, 60, 88)
    body += explode(v, (-60, 150, 160), (120, 150, 160))
    body += filter_element(v, -60)
    body += cylinder(v, (120, 150, 160), 60, 140, "x", rings=(20,))
    body += clamp(v, 60)
    body += explode(v, (190, 150, 220), (190, 150, 262))
    body += cylinder(v, (190, 150, 262), 12, 16, "z") + cylinder(v, (190, 150, 278), 7, 8, "z")
    body += co(v, (260, 150, 110), 150, 40, "6", "006")
    body += co(v, (-10, 150, 110), -120, 60, "7", "007")
    body += co(v, (65, 150, 97), -120, 70, "8", "008")
    body += co(v, (190, 150, 286), 120, -40, "9", "009")
    # inset: the indicator bands
    body += '<g transform="translate(570,370)"><rect x="0" y="0" width="200" height="120" fill="#fff" stroke="#1b1b1b" stroke-width="1"/>'
    body += label(100, 20, "Indicator (9), seen from above", "middle", 11.5)
    body += '<circle cx="60" cy="72" r="30" fill="#fff" stroke="#1b1b1b"/><circle cx="60" cy="72" r="14" fill="#2e8b57" stroke="#1b1b1b"/>'
    body += '<circle cx="150" cy="72" r="30" fill="#fff" stroke="#1b1b1b"/><circle cx="150" cy="72" r="14" fill="#c62828" stroke="#1b1b1b"/>'
    body += label(60, 114, "Green: serviceable", "middle", 10.5) + label(150, 114, "Red: blocked", "middle", 10.5) + "</g>"
    return svg(ICN["filter"], "Air filter - examination",
               "Exploded view of the air filter: the filter element (7) pulled out of the filter housing (6), the clamp (8) released, and the differential pressure indicator (9) on top. An inset shows the green and red bands of the indicator.",
               body, "Fictional training rig. Not to scale.")


def parts(issue):
    v = View(0.74, 340, 165)
    post = issue == 2
    calls = []

    def g(item, inner, at, to):
        calls.append(callout(v, at, to, str(int(item)), item))
        return f'<g class="part" id="item-{item}" data-item="{item}">{inner}</g>'
    holes = ((200, 80), (350, 80), (200, 220), (350, 220))
    body = base(v)
    body += g("006", box(v, 70, 120, 12, 60, 60, 88) + cylinder(v, (30, 150, 160), 60, 140, "x", rings=(20, 120)), (130, 150, 205), (230, 40))
    body += explode(v, (-170, 150, 160), (30, 150, 160))
    body += g("007", filter_element(v, -170), (-120, 150, 210), (40, 100))
    body += g("008", clamp(v, -40), (-35, 150, 97), (120, 175))
    body += explode(v, (100, 150, 220), (100, 150, 262))
    body += g("009", cylinder(v, (100, 150, 262), 12, 16, "z") + cylinder(v, (100, 150, 278), 7, 8, "z"), (100, 150, 286), (250, 18))
    if post:
        body += g("005", bracket(v, 182, 150, 12) + bracket(v, 368, 150, 12), (360, 162, 15), (300, 300))
    else:
        body += flange_holes(v, -10)
    body += explode(v, (275, 150, 22), (275, 150, 72))
    body += g("001", fan(v, 60), (275, 85, 222), (470, 52))
    if post:
        body += g("004", latch(v, 182, 150, 96) + latch(v, 368, 150, 96), (168, 159, 108), (70, 230))
    body += "".join(explode(v, (x, y, 92), (x, y, 248)) for x, y in holes)
    body += g("003", "".join(washer(v, x, y, 248) for x, y in holes), (350, 220, 250), (640, 120))
    body += g("002", "".join(screw(v, x, y, 262) for x, y in holes), (350, 80, 293), (560, 20))
    body += duct(v) + flow_indicator(v)
    body += g("011", box(v, 312, 262, 80, 26, 22, 20), (338, 284, 90), (440, 440))
    body += g("010", control_box(v, 40), (640, 235, 152), (750, 330))
    body += g("012", panel(v, 110), (300, 440, 20), (330, 528))
    body += "".join(calls)
    note = "Item 12: transparent panel (classroom variant) or metal panel (workshop variant)."
    desc = ("Exploded view of the fictional training rig for the parts list. Item numbers: 1 fan assembly, 2 screws, 3 washers, "
            + ("4 latches, 5 latch brackets, " if post else "") + "6 filter housing, 7 filter element, 8 clamp, 9 differential pressure indicator, 10 control box, 11 connector, 12 access panel.")
    return svg(ICN["ipd-2" if post else "ipd-1"], "Training rig - parts catalogue view" + (" (issue 2, with Modification M01 parts)" if post else ""), desc, body, note)


def control_front():
    s = '<g transform="translate(70,60)">'
    s += f'<rect x="0" y="0" width="420" height="300" rx="6" fill="#f5f5f5" stroke="{INK}" stroke-width="1.4"/>'
    s += label(210, -14, "Control box, front panel", "middle", 12)
    # S1 toggle
    s += f'<rect x="40" y="60" width="44" height="70" rx="5" fill="#fff" stroke="{INK}"/><rect x="56" y="70" width="12" height="30" rx="4" fill="#fff" stroke="{INK}"/>'
    s += label(62, 150, "S1", "middle", 13, "600") + label(62, 52, "ON", "middle", 10) + label(62, 146 - 6, "", "middle")
    # CB1
    s += f'<circle cx="150" cy="95" r="20" fill="#fff" stroke="{INK}"/><circle cx="150" cy="95" r="10" fill="#fff" stroke="{INK}"/>' + label(150, 150, "CB1", "middle", 13, "600")
    # DS1 and DS2
    s += f'<circle cx="250" cy="95" r="14" fill="#e8f5e9" stroke="{INK}"/>' + label(250, 150, "DS1", "middle", 13, "600") + label(250, 166, "POWER", "middle", 10)
    s += f'<circle cx="330" cy="95" r="14" fill="#fff4e0" stroke="{INK}"/>' + label(330, 150, "DS2", "middle", 13, "600") + label(330, 166, "FAN FAULT", "middle", 10)
    # R1
    s += f'<circle cx="110" cy="235" r="34" fill="#fff" stroke="{INK}"/><circle cx="110" cy="235" r="20" fill="#fff" stroke="{INK}"/>'
    s += f'<line x1="110" y1="235" x2="124" y2="221" stroke="{INK}" stroke-width="2"/>' + label(70, 285, "MIN", "middle", 10) + label(150, 285, "MAX", "middle", 10) + label(110, 192, "R1", "middle", 13, "600")
    # TP1 and TP2
    s += f'<circle cx="270" cy="235" r="9" fill="#c62828" stroke="{INK}"/><circle cx="330" cy="235" r="9" fill="#1b1b1b" stroke="{INK}"/>'
    s += label(270, 265, "TP1 (+)", "middle", 12, "600") + label(330, 265, "TP2 (-)", "middle", 12, "600")
    s += "</g>"
    # The inside: circuit board with R2, cover removed
    s += '<g transform="translate(540,90)">'
    s += f'<rect x="0" y="0" width="200" height="240" fill="#fff" stroke="{INK}" stroke-width="1.2" stroke-dasharray="6 3"/>'
    s += label(100, -14, "Inside, cover removed", "middle", 12)
    s += f'<rect x="20" y="30" width="160" height="180" rx="4" fill="#eef3ec" stroke="{INK}"/>'
    for i in range(5):
        s += f'<rect x="{36 + i * 26}" y="52" width="16" height="10" fill="#fff" stroke="{INK}" stroke-width="0.7"/>'
    s += f'<rect x="76" y="120" width="44" height="40" rx="3" fill="#fff" stroke="{INK}"/><circle cx="98" cy="140" r="11" fill="#fff" stroke="{INK}"/><line x1="92" y1="140" x2="104" y2="140" stroke="{INK}" stroke-width="2"/>'
    s += label(98, 186, "R2", "middle", 13, "600") + label(98, 200, "adjustment", "middle", 10)
    s += "</g>"
    return svg(ICN["control"], "Control box - controls, indicators, test points and adjustment potentiometer",
               "Front panel of the control box with the power switch S1, circuit breaker CB1, POWER lamp DS1, FAN FAULT lamp DS2, speed control R1 with MIN and MAX, and test points TP1 and TP2. A second view shows the circuit board inside with the adjustment potentiometer R2.",
               s, "Fictional training rig. Not to scale.")


ICN = {
    "general": "ICN-0DEMO-ARF0001-001-01", "fan-screws": "ICN-0DEMO-ARF0002-001-01", "filter": "ICN-0DEMO-ARF0003-001-01",
    "ipd-1": "ICN-0DEMO-ARF0004-001-01", "ipd-2": "ICN-0DEMO-ARF0004-002-01", "fan-latches": "ICN-0DEMO-ARF0005-001-01", "control": "ICN-0DEMO-ARF0006-001-01",
}


def main():
    made = {ICN["general"]: general(), ICN["fan-screws"]: fan_ri(False), ICN["fan-latches"]: fan_ri(True), ICN["filter"]: filter_view(),
            ICN["ipd-1"]: parts(1), ICN["ipd-2"]: parts(2), ICN["control"]: control_front()}
    for name, s in made.items():
        with open(os.path.join(OUT, name + ".SVG"), "w", encoding="utf-8", newline="\n") as fh:
            fh.write(s)
    print(f"draw: {len(made)} illustrations")


if __name__ == "__main__":
    main()
