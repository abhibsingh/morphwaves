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

## Editing pages

Each page in `site/pages/` starts with a JSON comment holding its title, meta description and path. Header, footer and head tags live once in `site/partials/` and apply to every page. Design tokens are at the top of `site/assets/css/site.css`.

See `docs/OWNER_GUIDE.md` before deploying.
