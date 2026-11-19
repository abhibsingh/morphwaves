#!/usr/bin/env python3
"""Signal overlays for the NASA page head photos.

Coordinates are in the 1200 x 1500 frame of site/assets/img/photos/*-1200.jpg
and follow each real antenna: the beam leaves along the dish's pointing
direction from its subreflector or feed. Output: site/partials/overlay-*.svg
Run after changing a photo crop: python3 scripts/make-overlays.py
"""
import os, math

OUT = os.path.join(os.path.dirname(__file__), "..", "site", "partials")
CYAN = "#5FE3F5"


def f(v):
    return f"{v:.1f}"


def path_d(points):
    return "M" + " L".join(f"{f(x)} {f(y)}" for x, y in points)


def length(points):
    return sum(math.dist(points[i], points[i + 1]) for i in range(len(points) - 1))


def overlay(slug, beams=(), feeds=(), ripples=None, light=False):
    """beams: list of (points from far end to the antenna, direction 'down' or 'up')."""
    CY = "#0AA6C4" if light else CYAN
    cls = "signal-overlay signal-overlay-light" if light else "signal-overlay"
    p = [f'<svg class="{cls}" viewBox="0 0 1200 1500" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg">',
         f'<defs><filter id="sg-{slug}" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="7"/></filter>']
    for i, (pts, _) in enumerate(beams):
        (x0, y0), (x1, y1) = pts[0], pts[-1]
        p.append(f'<linearGradient id="sb-{slug}-{i}" gradientUnits="userSpaceOnUse" x1="{f(x0)}" y1="{f(y0)}" x2="{f(x1)}" y2="{f(y1)}">'
                 f'<stop offset="0" stop-color="{CY}" stop-opacity="0"/><stop offset=".55" stop-color="{CY}" stop-opacity=".55"/>'
                 f'<stop offset="1" stop-color="{CY}" stop-opacity="1"/></linearGradient>')
    p.append("</defs>")
    for i, (pts, direction) in enumerate(beams):
        d = path_d(pts if direction == "down" else pts[::-1])
        L = length(pts)
        grad = f"url(#sb-{slug}-{i})"
        p.append(f'<path d="{path_d(pts)}" stroke="{grad}" stroke-width="22" fill="none" opacity=".16" filter="url(#sg-{slug})" stroke-linecap="round"/>')
        p.append(f'<path d="{path_d(pts)}" stroke="{grad}" stroke-width="2.2" fill="none" opacity=".7" stroke-linecap="round"/>')
        # pulses travel along d (towards the antenna for a downlink, away for an uplink)
        p.append(f'<path class="sig-pulse" d="{d}" stroke="{CY}" stroke-width="5" fill="none" stroke-linecap="round" pathLength="100"/>')
        p.append(f'<path class="sig-pulse sig-pulse-b" d="{d}" stroke="{CY}" stroke-width="5" fill="none" stroke-linecap="round" pathLength="100"/>')
    for (x, y, r) in feeds:
        p.append(f'<circle cx="{f(x)}" cy="{f(y)}" r="{r * 2.4:.1f}" fill="{CY}" opacity=".35" filter="url(#sg-{slug})" class="sig-glow"/>')
        p.append(f'<circle cx="{f(x)}" cy="{f(y)}" r="{r:.1f}" fill="#E9FBFF" class="sig-core"/>')
        p.append(f'<circle cx="{f(x)}" cy="{f(y)}" r="{r * 2:.1f}" fill="none" stroke="{CY}" stroke-width="2.5" class="sig-ring"/>')
    if ripples:
        cx, cy, r0, rx_ratio, tilt = ripples
        for k in range(3):
            p.append(f'<ellipse class="sig-ripple sig-ripple-{k}" cx="{f(cx)}" cy="{f(cy)}" rx="{f(r0)}" ry="{f(r0 * rx_ratio)}" '
                     f'transform="rotate({tilt} {f(cx)} {f(cy)})" fill="none" stroke="{CY}" stroke-width="3"/>')
    p.append("</svg>")
    return "".join(p)


def beam_to_edge(x, y, dx, dy, w=1200, h=1500):
    """From (x, y) along (dx, dy) to the frame edge."""
    n = math.hypot(dx, dy); dx, dy = dx / n, dy / n
    ts = []
    if dx > 0: ts.append((w - x) / dx)
    if dx < 0: ts.append(-x / dx)
    if dy > 0: ts.append((h - y) / dy)
    if dy < 0: ts.append(-y / dy)
    t = min(ts)
    return (x + dx * t, y + dy * t)


OVERLAYS = {
    # DSS-14 at sunset: dish faces up and left. Rim (430,1000) to (790,756); subreflector at (536,820).
    "about": dict(beams=[([beam_to_edge(536, 820, -244, -360), (536, 820)], "down")], feeds=[(536, 820, 6)]),
    # DSS-43 close up: signal comes down to the subreflector (600,870) and into the gold feed horn (636,1040).
    "capabilities": dict(beams=[([(520, 0), (600, 870), (636, 1040)], "down")], feeds=[(636, 1045, 7)], light=True),
    # Goldstone 70 m at dusk: dish faces up and right. Rim (280,410) to (860,1080); subreflector at (760,590).
    "groundops": dict(beams=[([beam_to_edge(760, 590, 670, -580), (760, 590)], "down")], feeds=[(760, 590, 7)]),
    # DSS-35 faces the camera: wavefronts ripple out from the dish face.
    "partnerships": dict(beams=[([(612, 0), (612, 330)], "down")], feeds=[(612, 335, 6)], ripples=(612, 560, 420, 0.92, 0), light=True),
    # DSS-15 at night points nearly straight up: uplink pulses rise from the feed at the apex.
    "contact": dict(beams=[([(560, 0), (512, 470)], "up")], feeds=[(512, 474, 6)]),
}

if __name__ == "__main__":
    for slug, spec in OVERLAYS.items():
        svg = overlay(slug, **spec)
        with open(os.path.join(OUT, f"overlay-{slug}.svg"), "w") as fh:
            fh.write(svg)
        print(slug, len(svg))
