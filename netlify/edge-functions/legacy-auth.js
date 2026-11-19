// Owner only access to the preserved original Morphwaves site at /legacy/.
//
// Runs on Netlify's edge, on the server, before any file under /legacy is
// served (HTML, JavaScript chunks, CSS, RSC payloads, the 404 page).
// Credentials come from environment variables set in the Netlify UI:
//   LEGACY_USERNAME
//   LEGACY_PASSWORD   (use a long random value, at least 20 characters)
// If either variable is missing the function fails closed and serves nothing.

const REALM = "Morphwaves private archive";

const PRIVATE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
  "X-Robots-Tag": "noindex, nofollow, noarchive, nosnippet",
  "Referrer-Policy": "no-referrer",
  "X-Frame-Options": "DENY",
};

const encoder = new TextEncoder();

async function digest(value) {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(value)));
}

// Compares fixed length SHA-256 digests so timing does not reveal how much matched.
async function safeEqual(a, b) {
  const [x, y] = await Promise.all([digest(a), digest(b)]);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

function parseBasic(header) {
  if (!header || !header.startsWith("Basic ")) return null;
  try {
    const decoded = atob(header.slice(6).trim());
    const i = decoded.indexOf(":");
    if (i < 0) return null;
    return { user: decoded.slice(0, i), pass: decoded.slice(i + 1) };
  } catch {
    return null;
  }
}

function deny(status, message, challenge) {
  const headers = { ...PRIVATE_HEADERS, "Content-Type": "text/plain; charset=utf-8" };
  if (challenge) headers["WWW-Authenticate"] = `Basic realm="${REALM}", charset="UTF-8"`;
  return new Response(message, { status, headers });
}

export async function authorize(request, expectedUser, expectedPass) {
  if (!expectedUser || !expectedPass) {
    return { ok: false, response: deny(503, "Private archive is not configured.", false) };
  }
  const creds = parseBasic(request.headers.get("authorization"));
  if (!creds) return { ok: false, response: deny(401, "Authentication required.", true) };
  const [u, p] = await Promise.all([
    safeEqual(creds.user, expectedUser),
    safeEqual(creds.pass, expectedPass),
  ]);
  if (!(u && p)) return { ok: false, response: deny(401, "Authentication required.", true) };
  return { ok: true };
}

function readEnv(name) {
  if (globalThis.Netlify?.env?.get) return globalThis.Netlify.env.get(name);
  if (globalThis.Deno?.env?.get) return globalThis.Deno.env.get(name);
  return globalThis.process?.env?.[name];
}

// True for /legacy and anything under it, after decoding and lowercasing, so
// variants such as /LEGACY/ or /%6Cegacy/ cannot bypass the check.
export function isProtectedPath(pathname) {
  let p = pathname;
  try {
    for (let i = 0; i < 3 && p.includes("%"); i++) p = decodeURIComponent(p);
  } catch {
    return true; // malformed encoding: treat as protected
  }
  p = p.toLowerCase().replace(/\\/g, "/").replace(/\/{2,}/g, "/");
  return p === "/legacy" || p.startsWith("/legacy/") || p.startsWith("/legacy.") || p.startsWith("/legacy%");
}

export default async function legacyAuth(request, context) {
  if (!isProtectedPath(new URL(request.url).pathname)) return; // public site: pass through untouched
  const result = await authorize(request, readEnv("LEGACY_USERNAME"), readEnv("LEGACY_PASSWORD"));
  if (!result.ok) return result.response;

  const upstream = await context.next();
  const response = new Response(upstream.body, upstream);
  for (const [k, v] of Object.entries(PRIVATE_HEADERS)) response.headers.set(k, v);
  return response;
}

export const config = {
  // Runs on every path and filters in code (see isProtectedPath) so that
  // encoded or differently cased spellings of /legacy are also covered.
  path: "/*",
  // Known public routes skip the function entirely. This keeps Netlify Forms
  // POSTs on "/" and "/contact/thanks/" untouched and avoids edge invocations
  // for normal traffic. Anything not listed (including every spelling of
  // /legacy) still runs through isProtectedPath above.
  excludedPath: [
    "/",
    "/about/", "/capabilities/", "/groundops/", "/partnerships/",
    "/contact/", "/contact/thanks/",
    "/assets/*",
    "/favicon.svg", "/favicon.ico", "/robots.txt", "/sitemap.xml", "/404.html",
  ],
};
