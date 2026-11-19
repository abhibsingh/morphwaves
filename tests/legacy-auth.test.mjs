// Unit tests for the legacy edge function. Run: node --test tests/
import test from "node:test";
import assert from "node:assert/strict";
import handler, { authorize, isProtectedPath } from "../netlify/edge-functions/legacy-auth.js";

const b64 = (s) => Buffer.from(s).toString("base64");
const req = (path, auth) =>
  new Request("https://www.morphwaves.com" + path, auth ? { headers: { authorization: auth } } : {});
const ctx = { next: async () => new Response("LEGACY CONTENT", { status: 200, headers: { "cache-control": "public, max-age=31536000" } }) };

function withEnv(user, pass, fn) {
  const prev = globalThis.Netlify;
  globalThis.Netlify = { env: { get: (k) => ({ LEGACY_USERNAME: user, LEGACY_PASSWORD: pass })[k] } };
  return fn().finally(() => { globalThis.Netlify = prev; });
}

test("protected path detection", () => {
  for (const p of ["/legacy", "/legacy/", "/legacy/index.html", "/legacy/_next/static/chunks/x.js", "/LEGACY/", "/Legacy/index.txt", "/%6Cegacy/", "/%256Cegacy/", "//legacy/", "/legacy.html", "/%E0%A4%A"])
    assert.equal(isProtectedPath(p), true, p);
  for (const p of ["/", "/about/", "/contact/", "/assets/css/site.css", "/legacyx", "/sitemap.xml"])
    assert.equal(isProtectedPath(p), false, p);
});

test("public pages pass through without touching the response", () =>
  withEnv("owner", "s3cret-pass-1234567890", async () => {
    assert.equal(await handler(req("/about/"), ctx), undefined);
  }));

test("fails closed when not configured", async () => {
  const r = await authorize(req("/legacy/"), undefined, undefined);
  assert.equal(r.ok, false);
  assert.equal(r.response.status, 503);
});

test("no credentials gives 401 challenge with noindex and no-store", () =>
  withEnv("owner", "s3cret-pass-1234567890", async () => {
    const r = await handler(req("/legacy/_next/static/css/d27c100b1fb1e2c4.css"), ctx);
    assert.equal(r.status, 401);
    assert.match(r.headers.get("www-authenticate"), /^Basic realm=/);
    assert.match(r.headers.get("x-robots-tag"), /noindex/);
    assert.match(r.headers.get("cache-control"), /no-store/);
    assert.doesNotMatch(await r.text(), /LEGACY CONTENT/);
  }));

test("wrong password and wrong user are rejected", () =>
  withEnv("owner", "s3cret-pass-1234567890", async () => {
    for (const a of ["Basic " + b64("owner:nope"), "Basic " + b64("someone:s3cret-pass-1234567890"), "Basic " + b64("owner"), "Basic !!!", "Bearer abc"]) {
      const r = await handler(req("/legacy/", a), ctx);
      assert.equal(r.status, 401, a);
    }
  }));

test("correct credentials serve content with private headers", () =>
  withEnv("owner", "s3cret-pass-1234567890", async () => {
    const r = await handler(req("/LEGACY/index.html", "Basic " + b64("owner:s3cret-pass-1234567890")), ctx);
    assert.equal(r.status, 200);
    assert.equal(await r.text(), "LEGACY CONTENT");
    assert.match(r.headers.get("cache-control"), /no-store/);
    assert.match(r.headers.get("x-robots-tag"), /noindex/);
  }));

test("password containing a colon works", () =>
  withEnv("owner", "a:b:c-long-password-xyz", async () => {
    const r = await handler(req("/legacy/", "Basic " + b64("owner:a:b:c-long-password-xyz")), ctx);
    assert.equal(r.status, 200);
  }));
