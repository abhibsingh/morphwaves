#!/usr/bin/env node
// Builds the public Morphwaves site into dist/.
//   site/pages/*.html     page bodies with a JSON front matter comment
//   site/partials/*.html  shared head, header and footer
//   site/assets/          css, js, fonts, images (copied as is)
//   legacy-site/          the preserved original site, copied to dist/legacy/
//                         with its /_next/ asset prefix rebased. legacy-site/
//                         itself is never modified.
// No dependencies. Run: node scripts/build.mjs

import { readFileSync, writeFileSync, mkdirSync, rmSync, cpSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, dirname, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SITE = join(ROOT, "site");
const DIST = join(ROOT, "dist");
const LEGACY_SRC = join(ROOT, "legacy-site");
const ORIGIN = "https://www.morphwaves.com";
const YEAR = String(new Date().getFullYear());
const EMAIL = "Abhishek@morphwaves.in";

const read = (p) => readFileSync(p, "utf8");
const partial = (name) => read(join(SITE, "partials", `${name}.html`));

// ---------- Inline boot script, allowed by CSP hash ----------
const BOOT = "document.documentElement.classList.add('js')";
const BOOT_HASH = "sha256-" + createHash("sha256").update(BOOT).digest("base64");

// ---------- Sky plot (azimuth and elevation polar plot of a pass) ----------
// Purely illustrative geometry. Center is zenith (90 deg), outer ring is the horizon.
function skyplot() {
  const C = 260, R = 210;
  const pt = (az, el) => {
    const r = R * (90 - el) / 90, a = (az * Math.PI) / 180;
    return [C + r * Math.sin(a), C - r * Math.cos(a)];
  };
  const track = (azStart, azSpan, maxEl, n = 64) => {
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      pts.push(pt(azStart + azSpan * t, maxEl * Math.sin(Math.PI * t)));
    }
    return pts;
  };
  const d = (pts) => "M" + pts.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join(" L");
  const f = (n) => n.toFixed(1);

  const main = track(312, 196, 63);
  const fut1 = track(28, 128, 24);
  const fut2 = track(232, 150, 38);
  const aos = main[0], los = main[main.length - 1], tca = main[32];
  // satellite marker placed past TCA, with a small footprint cone toward the station
  const sat = main[40];

  let s = `<svg class="skyplot" viewBox="0 0 520 540" role="img" aria-labelledby="sp-title sp-desc" xmlns="http://www.w3.org/2000/svg">
<title id="sp-title">Sky plot of an illustrative satellite pass</title>
<desc id="sp-desc">A polar chart as used in ground station operations. Rings mark elevation at 0, 30 and 60 degrees, with the zenith at the centre. A solid line traces a satellite pass from acquisition of signal in the north west, through its closest approach near 63 degrees elevation, to loss of signal in the south east. Two dashed lines show later passes.</desc>`;
  // azimuth spokes every 30 deg
  for (let az = 0; az < 360; az += 30) {
    const [x, y] = pt(az, 0);
    s += `<line class="sp-spoke" x1="${C}" y1="${C}" x2="${f(x)}" y2="${f(y)}"/>`;
  }
  // ticks every 10 deg on the horizon
  for (let az = 0; az < 360; az += 10) {
    const a = (az * Math.PI) / 180, r1 = R, r2 = R + (az % 30 === 0 ? 9 : 5);
    s += `<line class="sp-tick" x1="${f(C + r1 * Math.sin(a))}" y1="${f(C - r1 * Math.cos(a))}" x2="${f(C + r2 * Math.sin(a))}" y2="${f(C - r2 * Math.cos(a))}"/>`;
  }
  s += `<circle class="sp-ring" cx="${C}" cy="${C}" r="${f(R * 2 / 3)}"/>`;
  s += `<circle class="sp-ring" cx="${C}" cy="${C}" r="${f(R / 3)}"/>`;
  s += `<circle class="sp-ring sp-ring-outer" cx="${C}" cy="${C}" r="${R}"/>`;
  // elevation labels along the north east diagonal
  [[0, "0°"], [30, "30°"], [60, "60°"]].forEach(([el, label]) => {
    const [x, y] = pt(198, el);
    s += `<text x="${f(x - 6)}" y="${f(y + 14)}" text-anchor="end">${label}</text>`;
  });
  // cardinals
  s += `<text class="sp-cardinal" x="${C}" y="${C - R - 18}" text-anchor="middle">N</text>`;
  s += `<text class="sp-cardinal" x="${C + R + 18}" y="${C + 4}" text-anchor="middle">E</text>`;
  s += `<text class="sp-cardinal" x="${C}" y="${C + R + 28}" text-anchor="middle">S</text>`;
  s += `<text class="sp-cardinal" x="${C - R - 18}" y="${C + 4}" text-anchor="middle">W</text>`;
  // future passes
  s += `<path class="sp-future" d="${d(fut1)}"/><path class="sp-future" d="${d(fut2)}"/>`;
  // station at zenith
  s += `<circle class="sp-station" cx="${C}" cy="${C}" r="3"/>`;
  // footprint cone
  s += `<path class="sp-cone" d="M${C} ${C} L${f(sat[0] - 14)} ${f(sat[1] - 6)} L${f(sat[0] + 10)} ${f(sat[1] + 12)} Z"/>`;
  // main pass
  s += `<path class="sp-pass" pathLength="1" d="${d(main)}"/>`;
  // AOS, TCA, LOS nodes
  s += `<circle class="sp-node" cx="${f(aos[0])}" cy="${f(aos[1])}" r="4.5"/>`;
  s += `<circle class="sp-node" cx="${f(los[0])}" cy="${f(los[1])}" r="4.5"/>`;
  s += `<circle class="sp-node" cx="${f(tca[0])}" cy="${f(tca[1])}" r="3.5"/>`;
  s += `<text class="sp-label" x="${f(aos[0] - 10)}" y="${f(aos[1] - 12)}" text-anchor="end">AOS</text>`;
  s += `<text class="sp-label" x="${f(los[0] + 10)}" y="${f(los[1] + 20)}">LOS</text>`;
  s += `<text class="sp-label" x="${f(tca[0] + 12)}" y="${f(tca[1] - 10)}">Max el 63°</text>`;
  // satellite
  s += `<g class="sp-sat-g"><circle class="sp-sat" cx="${f(sat[0])}" cy="${f(sat[1])}" r="6.5"/></g>`;
  s += `</svg>`;
  return s;
}

// ---------- Page assembly ----------
const NAV = [
  { href: "/", label: "Home" },
  { href: "/about/", label: "About" },
  { href: "/capabilities/", label: "Capabilities" },
  { href: "/groundops/", label: "GroundOps" },
  { href: "/partnerships/", label: "Partnerships" },
  { href: "/contact/", label: "Contact" },
];

function navHtml(current) {
  return NAV.map(({ href, label }) => {
    const cur = href === current ? ' aria-current="page"' : "";
    return `<li><a class="nav-link" href="${href}"${cur}>${label}</a></li>`;
  }).join("");
}

function parsePage(file) {
  const raw = read(file);
  const m = raw.match(/^<!--\s*(\{[\s\S]*?\})\s*-->\s*/);
  if (!m) throw new Error(`Missing front matter in ${file}`);
  return { meta: JSON.parse(m[1]), body: raw.slice(m[0].length) };
}

function fill(tpl, vars) {
  return tpl.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, k) => {
    if (!(k in vars)) throw new Error(`Unknown template variable {{${k}}}`);
    return vars[k];
  });
}

const escAttr = (s) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

function buildPage(file) {
  const { meta, body } = parsePage(file);
  const canonical = ORIGIN + meta.path;
  const vars = {
    title: escAttr(meta.title),
    description: escAttr(meta.description),
    canonical,
    path: meta.path,
    robots: meta.noindex ? "noindex, follow" : "index, follow",
    ogImage: ORIGIN + "/assets/img/og-morphwaves.png",
    year: YEAR,
    email: EMAIL,
    boot: BOOT,
    bootHash: BOOT_HASH,
    nav: navHtml(meta.nav || meta.path),
    skyplot: skyplot(),
    groundopsDiagram: read(join(SITE, "partials", "groundops-diagram.svg")),
    ...Object.fromEntries(readdirSync(join(SITE, "partials")).filter((n) => /^illus-[\w]+\.svg$/.test(n))
      .map((n) => ["illus_" + n.slice(6, -4), read(join(SITE, "partials", n))])),
    ...Object.fromEntries(readdirSync(join(SITE, "partials")).filter((n) => /^overlay-[\w]+\.svg$/.test(n))
      .map((n) => ["overlay_" + n.slice(8, -4), read(join(SITE, "partials", n))])),
    extraScripts: (meta.scripts || []).map((s) => `<script src="${s}" defer></script>`).join(""),
  };
  const head = fill(partial("head"), vars);
  const header = fill(partial("header"), vars);
  const footer = fill(partial("footer"), vars);
  const main = fill(body, vars);
  const html = `<!doctype html>
<html lang="en-IN">
${head}
<body>
<a class="skip-link" href="#main">Skip to content</a>
${header}
<main id="main" tabindex="-1">
${main}
</main>
${footer}
</body>
</html>
`;
  return { meta, html };
}

function walk(dir) {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

// ---------- Build ----------
rmSync(DIST, { recursive: true, force: true });
mkdirSync(DIST, { recursive: true });
cpSync(join(SITE, "assets"), join(DIST, "assets"), { recursive: true });
for (const f of ["robots.txt", "favicon.svg", "favicon.ico", "_redirects"]) {
  if (existsSync(join(SITE, f))) cpSync(join(SITE, f), join(DIST, f));
}

const pages = readdirSync(join(SITE, "pages")).filter((f) => f.endsWith(".html"));
const sitemap = [];
for (const f of pages) {
  const { meta, html } = buildPage(join(SITE, "pages", f));
  const out = meta.output || join(meta.path.replace(/^\//, ""), "index.html");
  mkdirSync(dirname(join(DIST, out)), { recursive: true });
  writeFileSync(join(DIST, out), html);
  if (!meta.noindex) sitemap.push({ loc: ORIGIN + meta.path, priority: meta.priority || "0.7" });
  console.log("page   ", out);
}

sitemap.sort((a, b) => (a.loc.length - b.loc.length));
writeFileSync(join(DIST, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemap.map((u) => `  <url><loc>${u.loc}</loc><lastmod>${new Date().toISOString().slice(0, 10)}</lastmod><priority>${u.priority}</priority></url>`).join("\n")}
</urlset>
`);
console.log("sitemap", sitemap.length, "urls");

// ---------- Legacy copy (private, served behind netlify/edge-functions/legacy-auth.js) ----------
const LEGACY_FILES = ["index.html", "404.html", "index.txt", "_next"];
const LEGACY_OUT = join(DIST, "legacy");
mkdirSync(LEGACY_OUT, { recursive: true });
for (const f of LEGACY_FILES) cpSync(join(LEGACY_SRC, f), join(LEGACY_OUT, f), { recursive: true });
let rebased = 0;
for (const p of walk(LEGACY_OUT)) {
  if (![".html", ".txt", ".js", ".css"].includes(extname(p))) continue;
  const src = read(p);
  if (!src.includes("/_next/")) continue;
  writeFileSync(p, src.split("/_next/").join("/legacy/_next/"));
  rebased++;
}
console.log("legacy ", walk(LEGACY_OUT).length, "files copied,", rebased, "rebased to /legacy/_next/");
