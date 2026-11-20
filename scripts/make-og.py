#!/usr/bin/env python3
"""Per page Open Graph images (1200x630) for site/assets/img/og/.
Left: page message on navy. Right: the page's NASA photo, fading into navy."""
from PIL import Image, ImageDraw, ImageFont, ImageFilter
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent
IMG = ROOT / "site/assets/img"; OUT = IMG / "og"; OUT.mkdir(exist_ok=True)
F = "/usr/share/fonts/opentype/inter/"
title_f = ImageFont.truetype(F + "Inter-SemiBold.otf", 60)
brand_f = ImageFont.truetype(F + "Inter-SemiBold.otf", 30)
small_f = ImageFont.truetype(F + "Inter-Medium.otf", 24)
PAGES = {
  "home": ("earth/orbit-poster.jpg", "Software for satellite ground operations", "Monitoring, integration and automation"),
  "about": ("photos/about-1200.jpg", "Building reliable technology for the space economy", "About Morphwaves"),
  "capabilities": ("photos/capabilities-1200.jpg", "Four capability areas, marked by maturity", "Capabilities"),
  "groundops": ("photos/groundops-1200.jpg", "GroundOps: one view of every pass", "Product concept, in development"),
  "partnerships": ("photos/partnerships-1200.jpg", "Build ground operations software with us", "Partnerships"),
  "contact": ("photos/contact-1200.jpg", "Talk to Morphwaves", "Abhishek@morphwaves.in"),
}
NAVY = (8, 22, 38); CYAN = (22, 184, 212)
def wrap(d, text, font, width):
    lines, cur = [], ""
    for w in text.split():
        t = (cur + " " + w).strip()
        if d.textlength(t, font=font) <= width: cur = t
        else: lines.append(cur); cur = w
    return lines + [cur]
for slug, (photo, title, sub) in PAGES.items():
    im = Image.new("RGB", (1200, 630), NAVY)
    ph = Image.open(IMG / photo).convert("RGB")
    w = 560; s = max(w / ph.width, 630 / ph.height)
    ph = ph.resize((int(ph.width * s) + 1, int(ph.height * s) + 1), Image.LANCZOS)
    l = (ph.width - w) // 2; t = (ph.height - 630) // 2
    ph = ph.crop((l, t, l + w, t + 630))
    mask = Image.linear_gradient("L").rotate(90).resize((w, 630))  # dark on left -> fade in
    mask = mask.point(lambda v: min(255, int((255 - v) * 1.6)))
    im.paste(ph, (1200 - w, 0), mask)
    d = ImageDraw.Draw(im)
    # mark
    d.ellipse((72, 70, 116, 114), outline=(60, 88, 118), width=2)
    d.arc((60, 50, 150, 140), 200, 290, fill=CYAN, width=3)
    d.ellipse((104, 64, 116, 76), fill=CYAN)
    d.text((132, 74), "Morphwaves", font=brand_f, fill=(247, 249, 252))
    y = 250
    for line in wrap(d, title, title_f, 620):
        d.text((72, y), line, font=title_f, fill=(255, 255, 255)); y += 74
    d.rectangle((72, y + 22, 132, y + 25), fill=CYAN)
    d.text((72, y + 44), sub, font=small_f, fill=(169, 183, 200))
    d.text((72, 560), "morphwaves.com", font=small_f, fill=(127, 220, 236))
    im.save(OUT / f"{slug}.jpg", quality=86, optimize=True, progressive=True)
    print(slug, (OUT / f"{slug}.jpg").stat().st_size // 1024, "KB")
