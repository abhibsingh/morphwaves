# Owner guide

Nothing in this branch has been deployed. Production still serves the original site from `main`.

## 1. Where the original site is preserved

The original is kept in four independent places:

1. **Git tag `legacy-v1-original`** at commit `34ac233`, the exact state of `main` before any change.
2. **Git branch `legacy-original`**, same commit.
3. **Folder `legacy-site/`** in this branch. Its 24 site files are byte identical to the tag (checked with SHA256). The original `README.md` and `netlify.toml` are kept beside them.
4. **`main` on GitHub**, which is unchanged until you merge.

The build copies `legacy-site/` into `dist/legacy/` and rewrites only the asset prefix `/_next/` to `/legacy/_next/` in that copy, so the scripts and styles load from the new location. Layout, content and behaviour are unchanged. A browser comparison of original and preserved copy at 1440px and 375px gave the same page height, the same text and under 1.5% pixel difference, all from the randomised star field.

## 2. How to open the original site privately

After deployment the original lives at `https://www.morphwaves.com/legacy/`. It is not linked anywhere, is not in the sitemap or robots.txt, and every response carries `X-Robots-Tag: noindex` and `Cache-Control: private, no-store`.

Access is enforced on Netlify's servers by `netlify/edge-functions/legacy-auth.js` before any file is served, covering the page, every JavaScript chunk, the stylesheet, the RSC payload and its 404 page. Encoded or differently cased spellings such as `/LEGACY/` or `/%6Cegacy/` are also caught.

**Set the credentials once, in Netlify:**

1. Netlify > your site > Site configuration > Environment variables > Add a variable.
2. Add `LEGACY_USERNAME`, any value you like.
3. Add `LEGACY_PASSWORD`, a long random value (at least 20 characters). For example: `openssl rand -base64 24`.
4. Scope both to Functions, then redeploy.

If either variable is missing, `/legacy/` returns 503 and serves nothing. It fails closed.

**To view:** open `https://www.morphwaves.com/legacy/` and enter the username and password when the browser asks. To sign out, close the browser or use a private window.

**To change the password:** edit `LEGACY_PASSWORD` in Netlify and redeploy.

Notes:
* Basic Auth over HTTPS is sound for a single owner. There is no lockout after failed attempts, so the long random password is what protects you.
* `legacy-site/` is in this repository. If the GitHub repository is public, anyone can still read those files on GitHub, as they always could. Make the repository private if that matters to you.

## 3. Deploying (needs your approval, not done)

The Netlify project currently publishes the repository root with no build command. This branch changes `netlify.toml` to:

```toml
[build]
  command = "node scripts/build.mjs"
  publish = "dist"
```

Steps:

1. Push this branch: `git push -u origin redesign/space-tech` (and `git push origin legacy-original legacy-v1-original` for the backups).
2. Open a pull request. Netlify builds a **Deploy Preview** automatically. Check it, including `/legacy/` once the variables are set (set them for "Deploy Previews" too).
3. In Netlify > Forms, make sure **form detection is enabled**, then set an email notification for the `contact` form so submissions reach `Abhishek@morphwaves.in`.
4. In Netlify > Domain management, set `www.morphwaves.com` as the primary domain if it is not already. Netlify then redirects the bare domain to www. I did not add a redirect rule for this because, if the apex is currently primary, a manual rule would loop.
5. Merge to `main`. That is the production deployment.
6. After launch, submit `https://www.morphwaves.com/sitemap.xml` in Google Search Console.

No DNS change is required. No hosting resources are removed.

## 4. Rollback

Any one of these restores the original site.

**Fastest (no Git):** Netlify > Deploys > pick the last deploy before the merge > "Publish deploy". Instant, and reversible.

**From Git:**
```sh
git checkout main
git revert -m 1 <merge-commit>      # or: git reset --hard legacy-v1-original && git push --force-with-lease
git push
```

**From the folder, without Git history:** in Netlify set the base directory to `legacy-site`, leave the build command empty and set the publish directory to `.`. `legacy-site/` contains the original files and the original `netlify.toml`, so it deploys exactly as before.

## 5. Audit of the original site

* Prebuilt static export of a Next.js 14 App Router project. Source code is not in the repository, only compiled output.
* One route (`/`) plus `404.html`. Single page with a scroll driven three.js story of the MorphWave surface transducer. A floating menu button, no forms, no other pages.
* Hosted on Netlify, publish directory `.`, no build.
* Branding and copy describe the acoustic product, not satellite communications. Footer showed `Abhishek@Morphwaves.in` and a phone number.
* No `favicon.ico` (every page view logged a 404), no sitemap, no robots.txt, no canonical tag, OG image missing, title used a dash separator.

Because there was only one route and it remains at `/`, no redirects were needed.

## 6. Decisions you may want to revisit

* **Founder line.** The site does not name you or your background, following the brief's rule against inventing a team. Adding one sentence about your engineering experience on the About page would help investors. Say the word and I will add it.
* **LinkedIn.** Left out of the footer because no company page was confirmed.
* **Phone number.** The old footer showed a mobile number; the new site uses email only, as the brief specified.
* **Spam protection.** The form uses Netlify's honeypot and built in spam filtering. reCAPTCHA can be added with one attribute if spam appears.
* **Copy style.** Public copy avoids dashes and hyphenated compounds (so "ground segment software", "AI assisted"). The proper name IN-SPACe keeps its hyphen.
