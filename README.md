# Consortium Map

Airbnb-style split-view location explorer — a scrollable project list synced with an interactive, clustered map.

## Stack

- React 19 + TypeScript, built with Vite
- [Leaflet](https://leafletjs.com/) + [react-leaflet](https://react-leaflet.js.org/) for the map, [leaflet.markercluster](https://github.com/Leaflet/Leaflet.markercluster) for clustering
- Tailwind CSS v4
- Map tiles: CARTO dark basemap (free, no API key required)

No API keys or `.env` file needed — the app runs entirely off the bundled dataset and public tile servers.

## Prerequisites

- Node.js `^20.19.0` or `>=22.12.0` (required by Vite 8 — check with `node -v`)
- npm (ships with Node)

## Setup

```bash
git clone https://github.com/dev-forwwward/consortium-map.git
cd consortium-map
npm install
```

## Run it

```bash
npm run dev
```

Opens at `http://localhost:5173` (Vite prints the exact URL — pass `-- --port <n>` to override).

## Other scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the dev server with hot reload |
| `npm run build` | Type-check (`tsc --noEmit`) then build a production bundle to `dist/` |
| `npm run preview` | Serve the production build locally to sanity-check it |
| `npm run build:embed` | Copies fonts, type-checks, builds the standalone Webflow embed bundle to `dist-embed/` |

## Project structure

```
src/
├─ data/locations.ts        # sample dataset — id, name, category, city, state, image, lat/lng
├─ types/location.ts        # Location type
├─ context/                 # shared state (selection, hover, map bounds, mobile view)
├─ hooks/                   # useMapExplorer, useLocations, keyboard nav
├─ components/
│  ├─ layout/                # split-view shell + mobile List/Map toggle
│  ├─ list/                  # project card list
│  ├─ map/                   # MapContainer, clustering, marker icons, detail modal
│  └─ states/                # loading / empty / map-error UI
└─ styles/markers.css        # marker + cluster marker styling
```

To point the app at real data, edit `src/data/locations.ts` (or swap `useLocations` for a fetch call — it already returns the same `{ locations, status }` shape a network request would).

## Notes for contributors

- The map stays mounted at all times, even when hidden on mobile — it's toggled with `visibility`, not `display:none`, because a hidden (0×0) Leaflet container corrupts its bounds calculation.
- List filtering is bounds-driven: it always checks raw lat/lng against `map.getBounds()`, never against which markers happen to be rendered as clusters. A marker rendered on screen does not guarantee `bounds.contains()` is true — Leaflet renders a buffer slightly beyond the exact viewport for smooth panning, so cards can legitimately drop out of the list while their marker is still visible. This is expected, not a bug.
- See `src/lib/constants.ts` to change the tile source, default map center/zoom, or cluster radius.

## Embeddable widget (Webflow build)

This same app also ships as a self-mounting `<script>` embed for the client's Webflow site — a second, parallel build that doesn't touch the normal SPA path above.

**How it works:** `src/embed.tsx` is a separate entry point (built via `vite.embed.config.ts`, library mode, IIFE output) that looks for `#consortium-map-root` in the host page, attaches a Shadow DOM to it, injects the compiled CSS inside the shadow root via a `<link>`, and renders `<App/>` inside. Shadow DOM was chosen over Tailwind's `prefix()` option specifically so none of our classes (`.flex`, `.relative`, etc.) collide with the host site's — zero `className` changes needed anywhere in the app.

```bash
npm run build:embed
# → dist-embed/consortium-map.js   (stable filename, no hash)
# → dist-embed/consortium-map.css  (stable filename, no hash)
```

Filenames are pinned (not hashed) because the Webflow snippet references them by exact URL — a hash would mean editing Webflow on every deploy.

**Hosting:** deployed to Vercel, project `consortium-map-embed` in the `fwd-projects` team. Live URLs:
- `https://consortium-map-embed-fwd-projects.vercel.app/consortium-map.js`
- `https://consortium-map-embed-fwd-projects.vercel.app/consortium-map.css`

To redeploy: rebuild (`npm run build:embed`) and push the contents of `dist-embed/` to that Vercel project. **Vercel Authentication (deployment protection) must stay disabled on this project** — it's on by default for new Vercel projects and returns an HTML auth-wall page instead of the actual JS/CSS if re-enabled, silently breaking the embed on the live Webflow site with no error in Webflow itself.

**Gotchas specific to this build** (all already handled in the code, documented here so nobody "fixes" them again or reintroduces the bug when touching this code):
- `vite.embed.config.ts` sets `define: { 'process.env.NODE_ENV': JSON.stringify('production') }`. Vite's library mode does *not* auto-replace this the way normal app builds do — omit it and the bundle crashes at runtime with `process is not defined`.
- Fonts are self-hosted, not loaded from Google Fonts (avoids a third-party network call from a script running on someone else's domain). `scripts/copy-fonts.mjs` copies just the latin-subset `.woff2` files from the installed `@fontsource*` packages into `public/fonts/`, and `src/embed.css` hand-writes the `@font-face` rules. Do **not** `@import` a fontsource package's own CSS directly in the embed build — Vite library mode force-inlines every asset referenced via CSS `url()` as base64 regardless of `assetsInlineLimit`, which previously ballooned the CSS to 1.2MB.
- `src/embed.tsx` hardcodes `CSS_URL` as a constant pointing at the deployed CSS file — it's not resolved via `import.meta.url` (unreliable under Rollup's `iife` output). If the Vercel project/domain ever changes, update this constant and rebuild.
- The detail modal is keyed by `detailOpenSeq` (a counter in `MapExplorerProvider`, incremented on every open) rather than by location id, so reopening the *same* marker twice always mounts a fresh `<dialog>`. This sidesteps a documented Chromium/Edge bug where a `<dialog>` re-opened (not freshly created) inside a shadow root can become unclickable.
- `dev/webflow-fixture.html` is a throwaway local test page with deliberately hostile CSS (clashing `.flex`/`.relative`/`.border-b` class names, loud colors) for manually verifying shadow-DOM isolation in both directions before shipping a change. Serve it with `npx serve dev` and point its `<script src>` at either the live Vercel URL or a local `dist-embed/` server.

## Webflow integration

Live on the Webflow site **"Map"** at `https://map-f696d1.webflow.io`, single Home page. The whole integration is one Embed (`HtmlEmbed`) element on that page, containing three lines: the `#consortium-map-root` mount div, a `<noscript>` fallback, and the loader `<script src=".../consortium-map.js" defer>` tag — all three in the *same* element.

**Why the script isn't in Webflow's page/footer custom code instead:** that's where it'd conventionally go, but `data_scripts_tool > set_page_freeform_code` returns `HTTP 406` for any block containing a `<script>` tag on this site (plain text/comments write fine — only executable script content is rejected). This looks like a plan-gated restriction on page/site-level custom code, separate from the Embed element's own code setting, which accepts `<script>` without issue. So the loader script lives inside the Embed element itself rather than in the footer block. If a future redesign moves the script out of the Embed element, expect to hit this same 406 and either upgrade the Webflow site plan or keep the script co-located with the mount div as done here.

Also deliberately **not** using Webflow's `register_hosted_script` (SRI-hashed script registration) — that ties a hash to one exact file's bytes and would break on every redeploy of a stable-named file unless the hash were bumped in lockstep. The freeform/embed approach has no such constraint.
