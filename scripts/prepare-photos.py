#!/usr/bin/env python3
"""Resizes the NASA ground station photos for the page heads.

Put the originals in a folder and run:
  python3 scripts/prepare-photos.py /path/to/originals
Each source is cropped to a 4:5 portrait around its focal point, then saved
as 1200 and 720 pixel wide progressive JPEGs in site/assets/img/photos/.
"""
import sys, os
from PIL import Image, ImageOps

OUT = os.path.join(os.path.dirname(__file__), "..", "site", "assets", "img", "photos")

# slug: (source file, focal point x, focal point y as fractions)
# Sources: NASA Deep Space Network image pages on nasa.gov (public domain).
PHOTOS = {
    "about":        ("src-about.jpg", 0.70, 0.50),         # DSS-14, Goldstone, sunset (dsn-sunset)
    "capabilities": ("src-partnerships.jpg", 0.55, 0.55),  # DSS-43 close up with the Moon (dss43-4_fs)
    "groundops":    ("Goldstone_70m_3.jpg", 0.40, 0.50),   # Goldstone 70 m at dusk (Goldstone_70m_3)
    "partnerships": ("src-capabilities.jpg", 0.50, 0.40),  # DSS-35, Canberra, backlit (DSS-35_May_21_2014_01)
    "contact":      ("src-contact.jpg", 0.28, 0.50),       # DSS-15, Goldstone, sunset with crescent Moon
}
RATIO = 4 / 5


def crop(im, fx, fy):
    w, h = im.size
    if w / h > RATIO:
        nw = int(h * RATIO); x = int(min(max(fx * w - nw / 2, 0), w - nw)); return im.crop((x, 0, x + nw, h))
    nh = int(w / RATIO); y = int(min(max(fy * h - nh / 2, 0), h - nh)); return im.crop((0, y, w, y + nh))


src = sys.argv[1]
os.makedirs(OUT, exist_ok=True)
for slug, (name, fx, fy) in PHOTOS.items():
    p = os.path.join(src, name)
    if not os.path.exists(p):
        print("missing", name); continue
    im = ImageOps.exif_transpose(Image.open(p)).convert("RGB")
    im = crop(im, fx, fy)
    for wpx in (1200, 720):
        r = im.resize((wpx, int(wpx / RATIO)), Image.LANCZOS)
        r.save(os.path.join(OUT, f"{slug}-{wpx}.jpg"), quality=80, optimize=True, progressive=True)
    print("ok", slug)
