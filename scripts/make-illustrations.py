#!/usr/bin/env python3
"""Generates the page head illustrations in site/partials/illus-*.svg.

Engineering line art of real ground segment hardware: parabolic dishes on
elevation over azimuth pedestals, a Yagi on a rotator, satellites, signal
chains. Geometry is computed so dishes point their boresight at the
satellite they track. Run: python3 scripts/make-illustrations.py
"""
import math, os

OUT = os.path.join(os.path.dirname(__file__), "..", "site", "partials")
W, H = 520, 340

# palette (matches site.css tokens)
LINE = "#A9B7C8"     # structure lines
DIM = "#3C5876"      # secondary lines
FILL = "#10243A"     # structure fill
FILL2 = "#0D1E31"
CYAN = "#16B8D4"


def dcls(delay):
    """Animation offsets as classes, since the site's CSP forbids inline styles."""
    return f"il-d{int(round(delay / 0.3)) % 6}"


def f(v):
    return f"{v:.1f}"


def pts(points):
    return " ".join(f"{f(x)},{f(y)}" for x, y in points)


class Svg:
    def __init__(self, title, desc, w=W, h=H):
        self.w, self.h = w, h
        self.parts = []
        self.title, self.desc = title, desc

    def add(self, s):
        self.parts.append(s)

    def render(self, slug):
        return (
            f'<svg class="illus" viewBox="0 0 {self.w} {self.h}" role="img" '
            f'aria-labelledby="il-{slug}-t il-{slug}-d" xmlns="http://www.w3.org/2000/svg">'
            f'<title id="il-{slug}-t">{self.title}</title><desc id="il-{slug}-d">{self.desc}</desc>'
            + "".join(self.parts) + "</svg>"
        )


# ---------- primitives ----------

def stars(svg, seed, n=26, top=0, bottom=200):
    import random
    r = random.Random(seed)
    for _ in range(n):
        x, y = r.uniform(10, svg.w - 10), r.uniform(top + 8, bottom)
        svg.add(f'<circle cx="{f(x)}" cy="{f(y)}" r="{f(r.choice([0.6, 0.8, 1.0, 1.2]))}" fill="{LINE}" opacity="{f(r.uniform(.25, .6))}"/>')


def ground(svg, y, x0=0, x1=None):
    x1 = svg.w if x1 is None else x1
    svg.add(f'<line x1="{x0}" y1="{f(y)}" x2="{x1}" y2="{f(y)}" stroke="{DIM}" stroke-width="1.25"/>')
    for x in range(int(x0) + 6, int(x1), 14):
        svg.add(f'<line x1="{x}" y1="{f(y + 1)}" x2="{x - 6}" y2="{f(y + 7)}" stroke="{DIM}" stroke-width="0.75" opacity=".55"/>')


def label(svg, x, y, text, anchor="start", cls="il-label"):
    svg.add(f'<text class="{cls}" x="{f(x)}" y="{f(y)}" text-anchor="{anchor}">{text}</text>')


def beam(svg, a, b, pulse=True, width=1.0, delay=0.0):
    """Signal from a to b. Pulses travel from a to b."""
    d = f"M{f(a[0])} {f(a[1])} L{f(b[0])} {f(b[1])}"
    svg.add(f'<path d="{d}" stroke="{CYAN}" stroke-width="{width}" opacity=".35" fill="none"/>')
    if pulse:
        svg.add(f'<path class="il-pulse {dcls(delay)}" d="{d}" stroke="{CYAN}" stroke-width="{width + 1.2}" fill="none" stroke-linecap="round"/>')


def dish(svg, cx, gy, D, target, mast=None, side=1):
    """Parabolic dish on an elevation over azimuth pedestal, boresight aimed at target.
    Returns the feed (focus) point."""
    mast = mast if mast is not None else D * 0.62
    px, py = cx, gy - mast                      # elevation axis
    ang = math.atan2(-(target[1] - py), target[0] - px)  # boresight angle above horizontal
    bx, by = math.cos(ang), -math.sin(ang)       # boresight unit (svg y down)
    qx, qy = -by, bx                             # perpendicular
    fD = 0.42; fl = fD * D
    vx0 = D * 0.10                               # vertex in front of the axis

    def w(x, y):
        return (px + x * bx + y * qx, py + x * by + y * qy)

    # pedestal
    top_w, bot_w = D * 0.12, D * 0.34
    svg.add(f'<polygon points="{pts([(cx - bot_w/2, gy), (cx - top_w/2, py + D*0.16), (cx + top_w/2, py + D*0.16), (cx + bot_w/2, gy)])}" fill="{FILL}" stroke="{LINE}" stroke-width="1.25" stroke-linejoin="round"/>')
    svg.add(f'<rect x="{f(cx - D*0.11)}" y="{f(py + D*0.07)}" width="{f(D*0.22)}" height="{f(D*0.10)}" rx="1.5" fill="{FILL2}" stroke="{LINE}" stroke-width="1.25"/>')
    svg.add(f'<line x1="{f(cx - bot_w*0.32)}" y1="{f(gy - mast*0.35)}" x2="{f(cx + bot_w*0.32)}" y2="{f(gy - mast*0.35)}" stroke="{DIM}" stroke-width="1"/>')
    # yoke arm to the axis
    svg.add(f'<line x1="{f(cx)}" y1="{f(py + D*0.08)}" x2="{f(px)}" y2="{f(py)}" stroke="{LINE}" stroke-width="2"/>')
    # counterweight behind the reflector
    c1, c2 = w(-D*0.05, -D*0.07), w(-D*0.17, D*0.07)
    cw = [w(-D*0.05, -D*0.07), w(-D*0.05, D*0.07), w(-D*0.17, D*0.07), w(-D*0.17, -D*0.07)]
    svg.add(f'<polygon points="{pts(cw)}" fill="{FILL2}" stroke="{DIM}" stroke-width="1"/>')
    # reflector: front parabola and thicker back
    n = 28
    front, back = [], []
    for i in range(n + 1):
        y = -D/2 + D * i / n
        xf = vx0 + y*y / (4*fl)
        front.append(w(xf, y))
        back.append(w(xf - D*0.045*(1 - 0.6*(2*y/D)**2), y))
    outline = front + back[::-1]
    svg.add(f'<polygon points="{pts(outline)}" fill="{FILL}" stroke="{LINE}" stroke-width="1.4" stroke-linejoin="round"/>')
    # rib lines on the back
    for t in (-0.25, 0.25):
        y = t * D
        svg.add(f'<line x1="{f(w(vx0 + y*y/(4*fl) - D*0.04, y)[0])}" y1="{f(w(vx0 + y*y/(4*fl) - D*0.04, y)[1])}" x2="{f(w(-D*0.02, y*0.35)[0])}" y2="{f(w(-D*0.02, y*0.35)[1])}" stroke="{DIM}" stroke-width="1"/>')
    svg.add(f'<circle cx="{f(px)}" cy="{f(py)}" r="{f(max(2.2, D*0.03))}" fill="{FILL2}" stroke="{LINE}" stroke-width="1.25"/>')
    # feed and struts
    focus = w(vx0 + fl, 0)
    rimA, rimB = w(vx0 + (D*0.42)**2/(4*fl), -D*0.42), w(vx0 + (D*0.42)**2/(4*fl), D*0.42)
    for r in (rimA, rimB):
        svg.add(f'<line x1="{f(r[0])}" y1="{f(r[1])}" x2="{f(focus[0])}" y2="{f(focus[1])}" stroke="{LINE}" stroke-width="1"/>')
    horn = [w(vx0 + fl - D*0.07, -D*0.025), w(vx0 + fl - D*0.07, D*0.025), w(vx0 + fl + D*0.01, D*0.04), w(vx0 + fl + D*0.01, -D*0.04)]
    svg.add(f'<polygon points="{pts(horn)}" fill="{FILL2}" stroke="{LINE}" stroke-width="1.1" stroke-linejoin="round"/>')
    return focus


def yagi(svg, x, gy, h, target, L=70, elements=7):
    top = (x, gy - h)
    svg.add(f'<line x1="{f(x)}" y1="{f(gy)}" x2="{f(x)}" y2="{f(top[1] + 8)}" stroke="{LINE}" stroke-width="2"/>')
    for k in (0.3, 0.6):  # guy lines
        svg.add(f'<line x1="{f(x)}" y1="{f(gy - h*k)}" x2="{f(x - 22)}" y2="{f(gy)}" stroke="{DIM}" stroke-width=".8"/>')
        svg.add(f'<line x1="{f(x)}" y1="{f(gy - h*k)}" x2="{f(x + 22)}" y2="{f(gy)}" stroke="{DIM}" stroke-width=".8"/>')
    svg.add(f'<rect x="{f(x - 7)}" y="{f(top[1] + 2)}" width="14" height="12" rx="2" fill="{FILL2}" stroke="{LINE}" stroke-width="1.2"/>')
    ang = math.atan2(-(target[1] - top[1]), target[0] - top[0])
    bx, by = math.cos(ang), -math.sin(ang)
    qx, qy = -by, bx
    a = (top[0] - bx*L*0.35, top[1] - by*L*0.35)
    b = (top[0] + bx*L*0.65, top[1] + by*L*0.65)
    svg.add(f'<line x1="{f(a[0])}" y1="{f(a[1])}" x2="{f(b[0])}" y2="{f(b[1])}" stroke="{LINE}" stroke-width="1.8"/>')
    for i in range(elements):
        t = i / (elements - 1)
        cxp, cyp = a[0] + (b[0]-a[0])*t, a[1] + (b[1]-a[1])*t
        half = (13 if i == 0 else 11 - i*0.9)
        svg.add(f'<line x1="{f(cxp - qx*half)}" y1="{f(cyp - qy*half)}" x2="{f(cxp + qx*half)}" y2="{f(cyp + qy*half)}" stroke="{LINE}" stroke-width="1.3"/>')
    return b


def comsat(svg, x, y, s=1.0, rot=-12):
    g = [f'<g transform="translate({f(x)} {f(y)}) rotate({rot}) scale({s})">']
    for side in (-1, 1):
        x0 = 10 if side > 0 else -52
        g.append(f'<rect x="{x0}" y="-6" width="42" height="12" fill="{FILL}" stroke="{LINE}" stroke-width="1"/>')
        for k in range(1, 6):
            g.append(f'<line x1="{x0 + k*7}" y1="-6" x2="{x0 + k*7}" y2="6" stroke="{DIM}" stroke-width=".7"/>')
        g.append(f'<line x1="{side*5}" y1="0" x2="{side*10}" y2="0" stroke="{LINE}" stroke-width="1.2"/>')
    g.append(f'<rect x="-6" y="-8" width="12" height="16" rx="1" fill="{FILL2}" stroke="{LINE}" stroke-width="1.2"/>')
    g.append(f'<path d="M-5 9 Q0 15 5 9" fill="none" stroke="{LINE}" stroke-width="1.2"/>')
    g.append(f'<line x1="0" y1="8" x2="0" y2="12" stroke="{LINE}" stroke-width="1"/>')
    g.append("</g>")
    svg.add("".join(g))
    return (x, y + 10 * s)


def cubesat(svg, x, y, s=1.0, rot=10):
    g = [f'<g transform="translate({f(x)} {f(y)}) rotate({rot}) scale({s})">',
         f'<rect x="-5" y="-9" width="10" height="18" fill="{FILL2}" stroke="{LINE}" stroke-width="1.1"/>',
         f'<line x1="-5" y1="-3" x2="5" y2="-3" stroke="{DIM}" stroke-width=".7"/><line x1="-5" y1="3" x2="5" y2="3" stroke="{DIM}" stroke-width=".7"/>']
    for side in (-1, 1):
        x0 = 6 if side > 0 else -22
        g.append(f'<rect x="{x0}" y="-9" width="16" height="18" fill="{FILL}" stroke="{LINE}" stroke-width="1"/>')
        g.append(f'<line x1="{x0 + 8}" y1="-9" x2="{x0 + 8}" y2="9" stroke="{DIM}" stroke-width=".7"/>')
    g.append(f'<line x1="0" y1="9" x2="0" y2="15" stroke="{LINE}" stroke-width="1"/>')
    g.append("</g>")
    svg.add("".join(g))
    return (x, y + 12 * s)


def shelter(svg, x, gy, w=56, h=34):
    svg.add(f'<rect x="{f(x)}" y="{f(gy - h)}" width="{w}" height="{h}" fill="{FILL}" stroke="{LINE}" stroke-width="1.25"/>')
    svg.add(f'<polyline points="{pts([(x - 3, gy - h), (x + w/2, gy - h - 7), (x + w + 3, gy - h)])}" fill="none" stroke="{LINE}" stroke-width="1.25" stroke-linejoin="round"/>')
    svg.add(f'<rect x="{f(x + 8)}" y="{f(gy - 22)}" width="12" height="22" fill="{FILL2}" stroke="{DIM}" stroke-width="1"/>')
    for k in range(3):
        svg.add(f'<line x1="{f(x + 30)}" y1="{f(gy - 24 + k*5)}" x2="{f(x + 46)}" y2="{f(gy - 24 + k*5)}" stroke="{DIM}" stroke-width="1"/>')
    svg.add(f'<circle cx="{f(x + w - 7)}" cy="{f(gy - h + 7)}" r="1.6" fill="{CYAN}"/>')


def cable(svg, points, dashed=False):
    d = "M" + " L".join(f"{f(x)} {f(y)}" for x, y in points)
    dash = ' stroke-dasharray="3 3"' if dashed else ""
    svg.add(f'<path d="{d}" stroke="{DIM}" stroke-width="1.2" fill="none"{dash}/>')


def arc(svg, x0, y0, x1, y1, lift, dashed=True, color=DIM, width=1.1):
    mx, my = (x0 + x1)/2, min(y0, y1) - lift
    dash = ' stroke-dasharray="2 5"' if dashed else ""
    svg.add(f'<path d="M{f(x0)} {f(y0)} Q{f(mx)} {f(my)} {f(x1)} {f(y1)}" stroke="{color}" stroke-width="{width}" fill="none"{dash}/>')


def qpoint(x0, y0, x1, y1, lift, t):
    mx, my = (x0 + x1)/2, min(y0, y1) - lift
    x = (1-t)**2*x0 + 2*(1-t)*t*mx + t*t*x1
    y = (1-t)**2*y0 + 2*(1-t)*t*my + t*t*y1
    return x, y


def block(svg, x, y, w, h, text, accent=False, sub=None):
    svg.add(f'<rect x="{f(x)}" y="{f(y)}" width="{w}" height="{h}" rx="6" fill="{FILL}" stroke="{CYAN if accent else LINE}" stroke-width="{1.5 if accent else 1.2}"/>')
    label(svg, x + w/2, y + h/2 + (0 if sub else 4), text, "middle", "il-label il-strong")
    if sub:
        label(svg, x + w/2, y + h/2 + 15, sub, "middle")


# ---------- compositions ----------

def about():
    s = Svg("A ground station tracking a satellite pass",
            "A large parabolic dish on a pedestal tracks a satellite moving along a dashed arc across the sky, from acquisition of signal on the left to loss of signal on the right. A signal beam links the satellite to the dish feed. An equipment shelter stands beside the dish, connected by a cable.")
    stars(s, 3, 30, 0, 190)
    gy = 292
    x0, y0, x1, y1, lift = 30, 232, 500, 250, 210
    arc(s, x0, y0, x1, y1, lift)
    label(s, x0 + 2, y0 + 18, "AOS"); label(s, x1 - 2, y1 + 18, "LOS", "end")
    sat = qpoint(x0, y0, x1, y1, lift, 0.38)
    for t in (0.18, 0.58, 0.78):
        p = qpoint(x0, y0, x1, y1, lift, t)
        s.add(f'<circle cx="{f(p[0])}" cy="{f(p[1])}" r="1.8" fill="{DIM}"/>')
    ground(s, gy)
    focus = dish(s, 300, gy, 124, sat)
    ant = comsat(s, sat[0], sat[1], 0.85, -18)
    beam(s, ant, focus, width=1.1)
    shelter(s, 400, gy)
    cable(s, [(318, gy - 4), (400, gy - 4)])
    label(s, sat[0] - 6, sat[1] - 26, "Satellite pass", "middle")
    return s


def capabilities():
    s = Svg("Where Morphwaves works in the ground segment",
            "A signal chain from left to right: a satellite sends a signal to a dish antenna, which feeds an RF front end, then a modem, then ground software, then the operations team. A bracket under the antenna, RF front end and modem reads integration. A bracket under ground software and operations reads software and automation.",
            w=600, h=320)
    stars(s, 7, 18, 0, 90)
    gy = 214
    ground(s, gy, 0, 150)
    sat = (118, 40)
    focus = dish(s, 70, gy, 92, sat)
    a = comsat(s, sat[0], sat[1], 0.7, -14)
    beam(s, a, focus)
    y = 176; h = 44
    xs = [(162, 96, "RF front end", "LNA, converter"), (272, 82, "Modem", "Demodulate"),
          (368, 112, "Ground software", "Monitor, schedule", True), (494, 96, "Operations", "Team, alerts", True)]
    cable(s, [(96, gy - 4), (150, gy - 4), (150, y + h/2), (162, y + h/2)])
    prev = None
    for i, item in enumerate(xs):
        x, w, t, sub = item[:4]; acc = len(item) > 4
        block(s, x, y, w, h, t, acc, sub)
        if prev is not None:
            s.add(f'<line x1="{f(prev)}" y1="{f(y + h/2)}" x2="{f(x)}" y2="{f(y + h/2)}" stroke="{LINE}" stroke-width="1.2"/>')
            s.add(f'<path class="il-pulse {dcls(i*0.6)}" d="M{f(prev)} {f(y + h/2)} L{f(x)} {f(y + h/2)}" stroke="{CYAN}" stroke-width="2.2" fill="none"/>')
        prev = x + w
    # brackets
    def bracket(x0, x1, yb, text, accent=False):
        c = CYAN if accent else LINE
        s.add(f'<path d="M{f(x0)} {f(yb)} v8 H{f(x1)} v-8" stroke="{c}" stroke-width="1.2" fill="none"/>')
        label(s, (x0 + x1)/2, yb + 26, text, "middle", "il-label il-strong" if accent else "il-label")
    bracket(24, 354, 246, "Integration and testing")
    bracket(368, 590, 246, "Software and automation", True)
    return s


def capabilities_mobile():
    s = Svg("Where Morphwaves works in the ground segment",
            "A signal chain from top to bottom: a satellite sends a signal to a dish antenna, which feeds an RF front end, then a modem, then ground software, then the operations team. A bracket beside the antenna, RF front end and modem reads integration and testing. A bracket beside ground software and operations reads software and automation.",
            w=340, h=430)
    stars(s, 5, 14, 0, 70)
    gy = 120
    ground(s, gy, 0, 180)
    sat = (150, 26)
    focus = dish(s, 64, gy, 76, sat)
    beam(s, comsat(s, sat[0], sat[1], 0.62, -14), focus)
    items = [("RF front end", "LNA, converter", False), ("Modem", "Demodulate", False),
             ("Ground software", "Monitor, schedule", True), ("Operations", "Team, alerts", True)]
    x, w, h, gap, y = 24, 170, 48, 22, 150
    cable(s, [(64, gy), (64, gy + 12), (x + w/2, gy + 12), (x + w/2, y)])
    tops = []
    for i, (t, sub, acc) in enumerate(items):
        yy = y + i * (h + gap); tops.append(yy)
        block(s, x, yy, w, h, t, acc, sub)
        if i:
            a, b = (x + w/2, yy - gap), (x + w/2, yy)
            s.add(f'<line x1="{f(a[0])}" y1="{f(a[1])}" x2="{f(b[0])}" y2="{f(b[1])}" stroke="{LINE}" stroke-width="1.2"/>')
            s.add(f'<path class="il-pulse {dcls(i*0.6)}" d="M{f(a[0])} {f(a[1])} L{f(b[0])} {f(b[1])}" stroke="{CYAN}" stroke-width="2.2" fill="none"/>')
    def vbracket(y0, y1, lines, accent=False):
        c = CYAN if accent else LINE; bx = x + w + 14
        s.add(f'<path d="M{f(bx)} {f(y0)} h8 V{f(y1)} h-8" stroke="{c}" stroke-width="1.2" fill="none"/>')
        for k, ln in enumerate(lines):
            label(s, bx + 16, (y0 + y1)/2 - 4 + k*15, ln, "start", "il-label il-strong" if accent else "il-label")
    vbracket(70, tops[1] + h, ["Integration", "and testing"])
    vbracket(tops[2], tops[3] + h, ["Software and", "automation"], True)
    return s


def groundops():
    s = Svg("One operating view across different antennas",
            "Three ground antennas stand on the horizon: a large dish tracking a geostationary satellite high in the sky, a smaller dish tracking a satellite in medium orbit, and a Yagi antenna tracking a small low orbit satellite. Cables from all three run into a dashed box labelled GroundOps concept.",
            w=540, h=340)
    stars(s, 11, 26, 0, 170)
    gy = 262
    ground(s, gy)
    geo, meo, leo = (150, 34), (300, 70), (430, 116)
    f1 = dish(s, 90, gy, 104, geo)
    f2 = dish(s, 250, gy, 66, meo)
    f3 = yagi(s, 392, gy, 76, leo, L=64)
    beam(s, comsat(s, *geo, 0.8, -8), f1, delay=0.2)
    beam(s, comsat(s, *meo, 0.62, -20), f2, delay=0.9)
    beam(s, cubesat(s, *leo, 0.9, 18), f3, delay=0.5)
    label(s, geo[0] + 42, geo[1] + 4, "GEO"); label(s, meo[0] + 32, meo[1] + 4, "MEO"); label(s, leo[0] + 34, leo[1] + 4, "LEO")
    bx, by, bw, bh = 150, 290, 240, 34
    s.add(f'<rect x="{bx}" y="{by}" width="{bw}" height="{bh}" rx="8" fill="{FILL}" stroke="{CYAN}" stroke-width="1.3" stroke-dasharray="5 4"/>')
    label(s, bx + bw/2, by + 22, "GroundOps concept", "middle", "il-label il-strong")
    for (x, _), tx in ((f1, bx + 30), (f2, bx + bw/2), (f3, bx + bw - 30)):
        pass
    cable(s, [(90, gy), (90, by + bh/2), (bx, by + bh/2)])
    cable(s, [(250, gy), (250, by)])
    cable(s, [(392, gy), (392, by + bh/2), (bx + bw, by + bh/2)])
    return s


def partnerships():
    s = Svg("The ground segment ecosystem",
            "A central ground station dish is linked by signal lines to six partner types arranged around it: a satellite for satellite operators, a smaller dish for ground station providers, a small satellite for space startups, a classical building for research institutions, a factory for hardware manufacturers, and an equipment rack for systems integrators.",
            w=540, h=340)
    stars(s, 19, 22, 0, 330)
    cx, cy = 270, 182
    s.add(f'<circle cx="{cx}" cy="{cy}" r="74" fill="none" stroke="{DIM}" stroke-width="1" stroke-dasharray="2 5"/>')
    s.add(f'<circle cx="{cx}" cy="{cy}" r="44" fill="{FILL}" stroke="{LINE}" stroke-width="1.2"/>')
    # small dish in the hub
    dish(s, cx - 2, cy + 26, 40, (cx + 30, cy - 60), mast=22)
    s.add(f'<line x1="{cx - 26}" y1="{cy + 26}" x2="{cx + 26}" y2="{cy + 26}" stroke="{DIM}" stroke-width="1"/>')
    nodes = [
        ((96, 64), "Satellite operators"), ((444, 64), "Station providers"),
        ((60, 196), "Space startups"), ((480, 196), "Research institutes"),
        ((128, 306), "Manufacturers"), ((412, 306), "Systems integrators"),
    ]
    for i, ((x, y), name) in enumerate(nodes):
        dx, dy = x - cx, y - cy; d = math.hypot(dx, dy)
        a = (cx + dx/d*46, cy + dy/d*46); b = (x - dx/d*26, y - dy/d*26)
        beam(s, b, a, delay=i*0.35)
        s.add(f'<circle cx="{x}" cy="{y}" r="24" fill="{FILL2}" stroke="{DIM}" stroke-width="1"/>')
        label(s, x, y + 40 if y > cy - 20 else y - 32, name, "middle")
    # icons inside node circles
    comsat(s, 96, 62, 0.42, -10)
    dish(s, 446, 76, 26, (470, 40), mast=13)
    cubesat(s, 60, 194, 0.75, 14)
    # research institute: pediment and columns
    x, y = 480, 196
    s.add(f'<polygon points="{pts([(x-13, y-6), (x, y-14), (x+13, y-6)])}" fill="none" stroke="{LINE}" stroke-width="1.2" stroke-linejoin="round"/>')
    for k in (-9, -3, 3, 9):
        s.add(f'<line x1="{x+k}" y1="{y-4}" x2="{x+k}" y2="{y+9}" stroke="{LINE}" stroke-width="1.4"/>')
    s.add(f'<line x1="{x-14}" y1="{y+11}" x2="{x+14}" y2="{y+11}" stroke="{LINE}" stroke-width="1.4"/>')
    # factory
    x, y = 128, 306
    s.add(f'<polyline points="{pts([(x-14, y+10), (x-14, y-2), (x-7, y-8), (x-7, y-2), (x, y-8), (x, y-2), (x+7, y-8), (x+7, y-2), (x+14, y-2), (x+14, y+10), (x-14, y+10)])}" fill="none" stroke="{LINE}" stroke-width="1.2" stroke-linejoin="round"/>')
    s.add(f'<line x1="{x+10}" y1="{y-2}" x2="{x+10}" y2="{y-13}" stroke="{LINE}" stroke-width="1.4"/>')
    # equipment rack
    x, y = 412, 306
    s.add(f'<rect x="{x-9}" y="{y-13}" width="18" height="26" rx="1.5" fill="none" stroke="{LINE}" stroke-width="1.2"/>')
    for k in range(4):
        s.add(f'<line x1="{x-6}" y1="{y-8 + k*6}" x2="{x+3}" y2="{y-8 + k*6}" stroke="{DIM}" stroke-width="1.2"/>')
        s.add(f'<circle cx="{x+5.5}" cy="{y-8 + k*6}" r="1" fill="{CYAN if k == 1 else LINE}"/>')
    return s


def contact():
    s = Svg("A dish sending a signal to a satellite",
            "A small parabolic dish on a pedestal sends a signal up to a satellite. Pulses travel along the beam from the dish to the satellite.",
            w=440, h=300)
    stars(s, 23, 22, 0, 170)
    gy = 262
    ground(s, gy)
    sat = (330, 58)
    focus = dish(s, 150, gy, 108, sat)
    a = comsat(s, sat[0], sat[1], 0.8, -24)
    beam(s, focus, (a[0] - 4, a[1] - 2), width=1.1)
    label(s, sat[0], sat[1] - 26, "Uplink", "middle")
    return s


def notfound():
    s = Svg("A dish searching an empty sky",
            "A parabolic dish points at an empty patch of sky. Its dashed beam fades out with nothing to connect to, and a small search pattern of dots shows it scanning.",
            w=440, h=300)
    stars(s, 29, 26, 0, 190)
    gy = 262
    ground(s, gy)
    target = (300, 70)
    focus = dish(s, 140, gy, 108, target)
    s.add(f'<path d="M{f(focus[0])} {f(focus[1])} L{f(target[0])} {f(target[1])}" stroke="{CYAN}" stroke-width="1.1" stroke-dasharray="3 6" opacity=".5" fill="none"/>')
    for i, (r, op) in enumerate(((10, .5), (20, .35), (30, .2))):
        s.add(f'<circle class="il-scan {dcls(i*0.6)}" cx="{target[0]}" cy="{target[1]}" r="{r}" fill="none" stroke="{CYAN}" stroke-width="1" opacity="{op}" stroke-dasharray="2 4"/>')
    label(s, target[0], target[1] + 52, "No signal", "middle")
    return s


if __name__ == "__main__":
    for slug, fn in (("about", about), ("capabilities", capabilities), ("capabilities_m", capabilities_mobile), ("groundops", groundops),
                     ("partnerships", partnerships), ("contact", contact), ("404", notfound)):
        svg = fn().render(slug)
        with open(os.path.join(OUT, f"illus-{slug}.svg"), "w") as fh:
            fh.write(svg)
        print(slug, len(svg), "bytes")
