#!/usr/bin/env node
// Local preview that behaves like Netlify for this site:
//   clean URLs (/about/ -> about/index.html), custom 404.html,
//   and the real legacy auth edge function in front of every request.
// Usage:
//   LEGACY_USERNAME=owner LEGACY_PASSWORD=change-me-long-random node scripts/serve.mjs [port]
// Forms: POST requests return 404 locally because Netlify Forms only exists on
// Netlify. The contact form then shows its honest error message.

import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { join, extname, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import legacyAuth from "../netlify/edge-functions/legacy-auth.js";

const DIST = join(fileURLToPath(new URL("..", import.meta.url)), "dist");
const PORT = Number(process.argv[2] || 8888);
const TYPES = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".txt": "text/plain; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".ico": "image/x-icon", ".woff2": "font/woff2", ".xml": "application/xml" };

async function resolveFile(pathname) {
  let p;
  try { p = decodeURIComponent(pathname); } catch { return null; }
  p = normalize(p).replace(/^(\.\.[/\\])+/, "");
  const candidates = p.endsWith("/") ? [join(p, "index.html")] : [p, p + ".html", join(p, "index.html")];
  for (const c of candidates) {
    const full = join(DIST, c);
    if (!full.startsWith(DIST)) return null;
    try { if ((await stat(full)).isFile()) return full; } catch {}
  }
  return null;
}

async function serveStatic(request) {
  const url = new URL(request.url);
  if (request.method !== "GET" && request.method !== "HEAD") return new Response("Not found", { status: 404 });
  // Netlify redirects /about to /about/ when about/index.html exists
  if (!url.pathname.endsWith("/") && !extname(url.pathname)) {
    const dir = await resolveFile(url.pathname + "/");
    if (dir) return new Response(null, { status: 301, headers: { Location: url.pathname + "/" + url.search } });
  }
  const file = await resolveFile(url.pathname);
  if (!file) {
    const nf = url.pathname.toLowerCase().startsWith("/legacy/") ? join(DIST, "legacy", "404.html") : join(DIST, "404.html");
    return new Response(await readFile(nf), { status: 404, headers: { "Content-Type": TYPES[".html"] } });
  }
  return new Response(await readFile(file), { status: 200, headers: { "Content-Type": TYPES[extname(file)] || "application/octet-stream" } });
}

createServer(async (req, res) => {
  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) if (typeof v === "string") headers.set(k, v);
  const request = new Request(`http://localhost:${PORT}${req.url}`, { method: req.method, headers });
  const context = { next: () => serveStatic(request) };
  const response = (await legacyAuth(request, context)) ?? (await serveStatic(request));
  res.writeHead(response.status, Object.fromEntries(response.headers));
  res.end(req.method === "HEAD" ? undefined : Buffer.from(await response.arrayBuffer()));
}).listen(PORT, () => console.log(`Preview on http://localhost:${PORT}  (legacy at /legacy/, needs LEGACY_USERNAME and LEGACY_PASSWORD)`));
