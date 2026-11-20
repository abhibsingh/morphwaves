# Morphwaves website

Public site for Morphwaves, an early stage venture developing software for satellite ground operations. The original MorphWave acoustic site is preserved untouched and served privately at `/legacy/` behind server side authentication.

## Layout

| Path | What it is |
|---|---|
| `site/` | Source of the new public site: pages, shared partials, CSS, JS, fonts, images |
| `scripts/build.mjs` | Builds `dist/`. No dependencies, Node 18 or later |
| `scripts/serve.mjs` | Local preview that behaves like Netlify, including the legacy lock |
| `legacy-site/` | Byte identical copy of the original site. Never edited by the build |
| `netlify/edge-functions/legacy-auth.js` | Basic Auth gate for every `/legacy` request |
| `netlify.toml` | Build command, publish folder, security headers |
| `tests/` | Unit tests for the auth gate and browser tests for the whole site |
| `docs/OWNER_GUIDE.md` | Private access, rollback, deployment and audit notes |

## Preview locally

```sh
node scripts/build.mjs
LEGACY_USERNAME=owner LEGACY_PASSWORD='pick-a-long-random-value' node scripts/serve.mjs 8888
# open http://localhost:8888  and  http://localhost:8888/legacy/
```

The contact form shows an error locally because Netlify Forms exists only on Netlify. That is intended: the form never reports success unless the server accepted the message.

## Test

```sh
node --test tests/*.test.mjs                       # auth gate unit tests
pip install playwright && python3 tests/e2e.py     # browser tests, needs the preview running
```

## Homepage orbit animation

The homepage hero is a live 3D scene: a rotating Earth with satellites in low, medium and geostationary orbit sending signals to ground stations.

* Source: `site/src/orbit-scene.js` and `site/src/hero.js`. Bundled with three.js into `site/assets/js/orbit-scene.js` by `scripts/bundle-scene.sh`. The bundle is committed, so Netlify needs no npm install.
* Earth imagery in `site/assets/img/earth/` is NASA Blue Marble and Black Marble, which are public domain.
* It loads after the page finishes loading, pauses when off screen, shows a still view for visitors who reduce motion, and shows `orbit-poster.jpg` on devices without hardware graphics. Add `?scene=force` to the URL to force the live scene, for example in headless testing.

## Page photos

Page head photos in `site/assets/img/photos/` are NASA Deep Space Network photographs from nasa.gov (public domain), credited in each caption: DSS-14 and the 70 m antenna at Goldstone, DSS-15 at Goldstone, DSS-35 and DSS-43 at Canberra. `scripts/prepare-photos.py` crops them to 4:5 and writes 1200 and 720 pixel versions. NASA imagery does not imply NASA endorsement.

## Effects, founder section, FAQ and share images

- `site/assets/js/effects.js` holds small effects ported from React Bits to plain JavaScript: blur text on the homepage headline (`data-blur-text`), spotlight glow on cards (`.spot`), decrypted labels (`data-decrypt`), magnetic primary buttons (`.magnet`), and a one time reveal for `data-reveal` sections. Everything is decorative, so pages read fully without it, and motion is skipped for visitors who prefer reduced motion.
- The homepage focus cards, the footer and the About page founder section are adapted from MotionSites designs ("Capabilities", "Stark Minimal Footer", "LaunchEx About"), restyled in the Morphwaves palette. The 404 page shows a slowly turning Earth.
- Partner FAQ: edit the `faq` list in the front matter of `site/pages/partnerships.html`. The build renders both the visible FAQ and matching FAQPage structured data from it, so they never disagree.
- Structured data: Organization and WebSite JSON-LD are added to the homepage by `scripts/build.mjs`.
- Share images: `python3 scripts/make-og.py` regenerates `site/assets/img/og/*.jpg`. A page picks its image with `"og": "<name>"` in its front matter.

## Editing pages

Each page in `site/pages/` starts with a JSON comment holding its title, meta description and path. Header, footer and head tags live once in `site/partials/` and apply to every page. Design tokens are at the top of `site/assets/css/site.css`.

See `docs/OWNER_GUIDE.md` before deploying.
