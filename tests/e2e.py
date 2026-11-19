"""Browser checks against the local preview (scripts/serve.mjs).
Run: LEGACY_USERNAME=owner LEGACY_PASSWORD=... node scripts/serve.mjs 8888 &
     LEGACY_USERNAME=owner LEGACY_PASSWORD=... python3 tests/e2e.py http://localhost:8888
"""
import asyncio, os, sys
from playwright.async_api import async_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8888"
CHROME = os.environ.get("CHROME", "/usr/bin/google-chrome")
U, P = os.environ.get("LEGACY_USERNAME"), os.environ.get("LEGACY_PASSWORD")
results = []
def check(name, ok, detail=""):
    results.append((ok, name, detail)); print(("PASS " if ok else "FAIL ") + name + (f"  [{detail}]" if detail and not ok else ""))

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME, args=["--no-sandbox"])
        pg = await b.new_page(viewport={"width": 1280, "height": 900})

        # Internal links all resolve
        seen, bad = set(), []
        for path in ["/", "/about/", "/capabilities/", "/groundops/", "/partnerships/", "/contact/"]:
            await pg.goto(BASE + path)
            for href in await pg.eval_on_selector_all("a[href^='/']", "els => els.map(e => e.getAttribute('href'))"):
                u = href.split("#")[0]
                if u in seen: continue
                seen.add(u)
                r = await pg.request.get(BASE + u)
                if r.status != 200: bad.append(f"{u} {r.status}")
        check("all internal links return 200", not bad, ", ".join(bad))
        check("no public link points at /legacy", not any(s.lower().startswith("/legacy") for s in seen))

        # Skip link is first focusable element
        await pg.goto(BASE + "/")
        await pg.keyboard.press("Tab")
        check("skip link receives first focus", await pg.evaluate("document.activeElement.className") == "skip-link")

        # Contact: empty submit shows errors and focuses first invalid field
        await pg.goto(BASE + "/contact/?interest=pilot")
        check("interest preselected from query", await pg.input_value("#f-interest") == "pilot")
        await pg.click("button[type=submit]")
        check("empty submit marks name invalid", await pg.get_attribute("#f-name", "aria-invalid") == "true")
        check("focus moves to first invalid field", await pg.evaluate("document.activeElement.id") == "f-name")
        check("error text shown", len(await pg.inner_text("#e-email")) > 0)
        await pg.fill("#f-name", "Test Person"); await pg.fill("#f-org", "Test Org")
        await pg.fill("#f-email", "not-an-email"); await pg.fill("#f-message", "short")
        await pg.click("button[type=submit]")
        check("bad email rejected", await pg.get_attribute("#f-email", "aria-invalid") == "true")
        check("short message rejected", await pg.get_attribute("#f-message", "aria-invalid") == "true")
        await pg.fill("#f-email", "test@example.org"); await pg.fill("#f-message", "This is a test message long enough.")
        await pg.click("button[type=submit]")
        await pg.wait_for_selector("#form-status.is-error, #form-status.is-success", timeout=8000)
        cls = await pg.get_attribute("#form-status", "class")
        # Locally there is no Netlify Forms backend, so an honest error must appear, never a fake success
        check("no simulated success without a backend", "is-error" in cls, cls)
        check("error offers email fallback", "Abhishek@morphwaves.in" in await pg.inner_text("#form-status"))
        check("form data kept after failed send", await pg.input_value("#f-name") == "Test Person")
        check("netlify form attributes present", await pg.get_attribute("#contact-form", "data-netlify") == "true" and await pg.get_attribute("#contact-form", "netlify-honeypot") == "company_website")

        # Mobile menu
        m = await b.new_page(viewport={"width": 375, "height": 800})
        await m.goto(BASE + "/about/")
        check("mobile menu hidden initially", not await m.is_visible("#site-nav"))
        await m.click(".nav-toggle")
        check("mobile menu opens", await m.is_visible("#site-nav") and await m.get_attribute(".nav-toggle", "aria-expanded") == "true")
        await m.keyboard.press("Escape")
        check("Escape closes menu and returns focus", not await m.is_visible("#site-nav") and await m.evaluate("document.activeElement.classList.contains('nav-toggle')"))

        # Reduced motion: sky plot drawn immediately
        rm = await b.new_page(viewport={"width": 1280, "height": 900}, reduced_motion="reduce")
        await rm.goto(BASE + "/")
        op = await rm.evaluate("getComputedStyle(document.querySelector('.sp-sat-g')).opacity")
        check("reduced motion shows final sky plot state", op == "1", op)

        # 404
        r = await pg.goto(BASE + "/does-not-exist/")
        check("unknown route returns styled 404", r.status == 404 and "out of range" in await pg.inner_text("h1"))

        # Legacy without credentials
        anon = await b.new_context()
        for path in ["/legacy/", "/legacy/_next/static/css/d27c100b1fb1e2c4.css", "/Legacy/index.html", "/%6cegacy/index.txt"]:
            r = await anon.request.get(BASE + path)  # browsers abort navigation on a 401 challenge
            body = await r.text()
            check(f"anonymous {path} is 401 with no content", r.status == 401 and "MorphWave" not in body and "_next" not in body, str(r.status))

        # Legacy with credentials renders the original
        if U and P:
            authed = await b.new_context(http_credentials={"username": U, "password": P}, viewport={"width": 1440, "height": 900})
            lp = await authed.new_page(); errs = []
            lp.on("pageerror", lambda e: errs.append(str(e)))
            failed = []
            lp.on("response", lambda resp: failed.append(f"{resp.status} {resp.url}") if resp.status >= 400 and "favicon" not in resp.url else None)
            r = await lp.goto(BASE + "/legacy/", wait_until="networkidle")
            await lp.wait_for_timeout(1500)
            check("legacy loads with credentials", r.status == 200)
            check("legacy keeps original title", await lp.title() == "MorphWave — Every Surface Has A Voice")
            check("legacy has no JS errors or failed assets", not errs and not failed, "; ".join(errs + failed)[:300])
            check("legacy stays on /legacy/ after hydration", await lp.evaluate("location.pathname") == "/legacy/")
            check("legacy response is noindex and no-store", "noindex" in (r.headers.get("x-robots-tag") or "") and "no-store" in (r.headers.get("cache-control") or ""))
        await b.close()
    failed = [r for r in results if not r[0]]
    print(f"\n{len(results) - len(failed)}/{len(results)} passed")
    sys.exit(1 if failed else 0)

asyncio.run(main())
