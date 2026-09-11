# Museum Mood

Your reaction belongs in a museum. Pick one of eight moods, edit a caption, and download a 1600 × 900 JPEG made from a public-domain Met painting.

Live: https://mood.jezamancenido.com

The previous ChatGPT host (`https://museum-mood.becoming.chatgpt.site`) can stay up until DNS and HTTPS for the subdomain are confirmed.

## Run locally

Requires Node 22.13+ and npm.

```sh
npm ci
npm run dev
```

## Build and verify

```sh
npx tsc --noEmit
node scripts/catalog.mjs
node scripts/catalog.mjs --live
node scripts/test-exports.mjs
npm run build
```

The static export is written to `dist/client/`. There is no runtime API, authentication, tracking, or database. Share links use `?mood=judging` (and the other seven mood IDs). X compose receives text; users attach the downloaded JPEG manually.

## GitHub Pages and custom domain

This site is a project Pages site on `curiousjam/museum-mood`. The personal site at `jezamancenido.com` stays on `curiousjam/curiousjam.github.io`. Do not merge the two repos.

Pushes to `main` run `.github/workflows/pages.yml`, which builds with Node 22 and publishes `dist/client/`. The root `CNAME` file must remain `mood.jezamancenido.com`.

### GitHub

1. Make the repo **public** unless you have a paid plan that allows Pages from a private repo.
2. **Settings → Pages**: source **GitHub Actions**.
3. Custom domain: `mood.jezamancenido.com`.
4. After DNS verifies, enable **Enforce HTTPS**. This can take up to an hour.

Until the custom domain is attached, GitHub may also serve the site at `https://curiousjam.github.io/museum-mood/`.

### Squarespace DNS

Leave the existing apex and `www` records that serve [jezamancenido.com](https://jezamancenido.com).

1. Squarespace → **Settings → Domains → jezamancenido.com → DNS** (custom records).
2. Add a **CNAME**:
   - **Host:** `mood`
   - **Target:** `curiousjam.github.io` (no `https://`, no `/museum-mood`)
   - TTL: default or 1 hour
3. Do not attach a Squarespace website to the `mood` subdomain. If Squarespace creates one, disconnect it so only the CNAME remains.

Confirm with:

```sh
dig CNAME mood.jezamancenido.com
```

The answer should be `curiousjam.github.io`. Then check `https://mood.jezamancenido.com`, `/classic/?mood=judging`, and `/motion`.

## Artwork data

`data/catalog.json` contains official metadata, image source URLs, full museum credit lines, and verification timestamps. The eight images in `public/art` are from The Met Open Access collection, verified with `isPublicDomain: true`. Artwork titles and artist names are retained on exported cards. This is an independent project, not endorsed by The Met.

To regenerate from the Met API:

```sh
node scripts/catalog.mjs --generate
```

This uses v1.1 search and v1 object records and downloads original images. Optimize image dimensions after regenerating before shipping. The validator requires eight distinct works and artists from at least three departments. Edit the curated seeds in `scripts/catalog.mjs` to replace works.

## Reuse

Clone or copy this directory, install dependencies, and edit `lib/moods.ts` to use your own public origin. For a new deployment, remove the existing `project_id` from `.openai/hosting.json` before registering your own Site. Do not deploy to this project's existing ID.

Code is MIT licensed. Artwork and collection metadata have their separate Met Open Access / CC0 provenance; see https://www.metmuseum.org/hubs/open-access.

## Validation notes

The published artifact is static HTML, CSS, JavaScript, and images. The starter dependency audit reports development/server-package advisories; none of those server endpoints or development servers are deployed. Keep the local development server private and update the toolchain before adding runtime server features.
