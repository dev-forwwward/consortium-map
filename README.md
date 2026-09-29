# Consortium Map

Airbnb-style split-view location explorer — a scrollable project list synced with an interactive, clustered map.

## Stack

- React 19 + TypeScript, built with Vite
- [Leaflet](https://leafletjs.com/) + [react-leaflet](https://react-leaflet.js.org/) for the map, [leaflet.markercluster](https://github.com/Leaflet/Leaflet.markercluster) for clustering
- Tailwind CSS v4
- Map tiles: CARTO dark basemap (free tier, **API key required**)

Project data comes from the bundled dataset, but the basemap needs a CARTO API key — see [Setup](#setup).

## Prerequisites

- Node.js `^20.19.0` or `>=22.12.0` (required by Vite 8 — check with `node -v`)
- npm (ships with Node)

## Setup

```bash
git clone https://github.com/dev-forwwward/consortium-map.git
cd consortium-map
npm install
cp .env.example .env   # then paste your CARTO key into it
```

### CARTO basemap API key

**CARTO started requiring an API key on `basemaps.cartocdn.com` on 23 September 2026.** Without one,
tiles still return HTTP 200 — the body is just a watermarked "API KEY REQUIRED" image — so the map
renders as a wall of placeholder text with no error anywhere. This is what broke the live embed.

Get a key at <https://carto.com/basemaps/apikey> (email address only, no account), then:

```
VITE_CARTO_BASEMAP_KEY=<your key>
```

- `.env` is gitignored, so the key stays out of the repo — but it is compiled into the JS bundle and
  is readable by anyone who views source. That is normal for browser basemap keys.
- **Add domain restrictions to the key in the CARTO dashboard.** That is the only thing stopping
  someone else's traffic from consuming your quota.
- Free tiers are 1M tile requests/month for commercial use, 5M for non-commercial. Requests are
  counted per calendar month (UTC) across every key on the account. Consortium is commercial, so the
  1M ceiling applies — roughly 10,000 sessions on the map page.
- Both `npm run build` and `npm run build:embed` **fail** if the variable is unset
  (`scripts/require-carto-key.mjs`). The embed is built locally and hand-pushed to Vercel, so a
  forgotten `.env` would otherwise silently ship a broken map to the client's site.
- `src/lib/tileHealth.ts` probes two dissimilar tiles at runtime and trips `MapErrorState` if they
  come back byte-identical, which is what a placeholder basemap looks like. That catches an expired
  key, a revoked key, or a blown quota in production — none of which raise `tileerror`, because they
  all answer 200.

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

**How it works:** `src/embed.tsx` is a separate entry point (built via `vite.embed.config.ts`, library mode, IIFE output) that looks for `#consortium-map-root` in the host page, attaches a Shadow DOM to it, injects the compiled CSS inside the shadow root via a `<link>`, and renders the **map only** (`MapOnlyLayout`) inside. The project list is not part of the embed — it is a Webflow CMS Collection List on the page, which the embed reads (see [Webflow CMS setup](#webflow-cms-setup)). `npm run dev` still runs the full standalone list + map explorer from the bundled dataset. Shadow DOM was chosen over Tailwind's `prefix()` option specifically so none of our classes (`.flex`, `.relative`, etc.) collide with the host site's — zero `className` changes needed anywhere in the app.

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
- `dev/webflow-cms-fixture.html` stands in for the Webflow projects page: a fake Collection List with the `data-cm-*` attributes, a category filter, and one deliberately broken item. Run `npm run build:embed`, serve the repo root (`python3 -m http.server 4321`), and open `http://localhost:4321/dev/webflow-cms-fixture.html`. The mount's `data-css-url` points the embed at the local CSS instead of the deployed one.
- `dev/webflow-fixture.html` is a throwaway local test page with deliberately hostile CSS (clashing `.flex`/`.relative`/`.border-b` class names, loud colors) for manually verifying shadow-DOM isolation in both directions before shipping a change. Serve it with `npx serve dev` and point its `<script src>` at either the live Vercel URL or a local `dist-embed/` server.

## Webflow integration

Live on the Webflow dev site at `https://dev-consortium-map-filter-v2.webflow.io`, on the `/projects` page. (An earlier prototype lived at `https://map-f696d1.webflow.io` on its Home page — that one is superseded.) The whole integration is one Embed (`HtmlEmbed`) element on the page, containing three lines: the `#consortium-map-root` mount div, a `<noscript>` fallback, and the loader `<script src=".../consortium-map.js" defer>` tag — all three in the *same* element.

**Why the script isn't in Webflow's page/footer custom code instead:** that's where it'd conventionally go, but `data_scripts_tool > set_page_freeform_code` returns `HTTP 406` for any block containing a `<script>` tag on this site (plain text/comments write fine — only executable script content is rejected). This looks like a plan-gated restriction on page/site-level custom code, separate from the Embed element's own code setting, which accepts `<script>` without issue. So the loader script lives inside the Embed element itself rather than in the footer block. If a future redesign moves the script out of the Embed element, expect to hit this same 406 and either upgrade the Webflow site plan or keep the script co-located with the mount div as done here.

Also deliberately **not** using Webflow's `register_hosted_script` (SRI-hashed script registration) — that ties a hash to one exact file's bytes and would break on every redeploy of a stable-named file unless the hash were bumped in lockstep. The freeform/embed approach has no such constraint.

## Webflow CMS setup

The project list lives in a Webflow CMS collection so the client can add, edit and remove projects in the Editor. The embed reads the rendered Collection List from the page, so every change the client publishes shows up on the map with no redeploy.

### Collection fields

| Field | Type | Notes |
|---|---|---|
| Name | Plain text | |
| Slug | (built in) | Used as the item's id |
| Category | Option or Reference | Also what the filter matches on |
| City, State | Plain text | |
| Image | Image | |
| Latitude, Longitude | **Number** (decimal) | Webflow has no geo field. Copy them from Google Maps (right-click → the first number is latitude). |

### Attribute contract

On the **Collection List** element (the wrapper around the items): `data-cm-list` (no value).

On each **Collection Item**, add custom attributes bound to CMS fields:

| Attribute | Bound to |
|---|---|
| `data-cm-item` | (no value) |
| `data-cm-id` | Slug |
| `data-cm-name` | Name |
| `data-cm-category` | Category |
| `data-cm-city` / `data-cm-state` | City / State |
| `data-cm-image` | Image (URL) |
| `data-cm-lat` / `data-cm-lng` | Latitude / Longitude |
| `data-cm-url` | *(optional)* project page URL, which adds a "View project" button to the map's detail popup |

An item with a missing or invalid coordinate is left off the map and logged once as a `console.warn` that names it. The rest of the map is unaffected.

### How the list and map stay in sync

`src/hooks/useLocations.ts` (`cms` source) watches the list with a `MutationObserver`. Whenever items are hidden (`display:none` / `hidden`), removed or added, it re-reads the visible ones, so the map always shows exactly what the filter shows. It doesn't depend on any particular filter library. `src/hooks/useCmsBridge.ts` links the two directions:

- Hovering a card highlights its marker (or the cluster containing it).
- Clicking a card zooms the map to its marker. Clicks on a real `<a>` inside the card still navigate normally. If the *whole card* is a Link Block, clicking it navigates, so put the project link on a button or title instead if you want click-to-locate.
- Hovering or clicking a marker adds `is-cm-hover` / `is-cm-active` to the matching card and scrolls it into view. **Style these two classes in the Designer** (create them as combo classes on the card).

The embed no longer narrows the list to the map's viewport. The list follows the filter only.

### Filter (Finsweet Attributes)

Use Finsweet Attributes **List Filter** on the same Collection List: `fs-list-element="list"` on the list, `fs-list-field="category"` on the category text in each card, and the filter buttons in the top row. Because of the `HTTP 406` restriction described in [Webflow integration](#webflow-integration), the Finsweet `<script>` probably has to live in an Embed element too, not in page custom code.

### Limits

- A Collection List shows at most **100 items**. Past that, use Finsweet's load-more/pagination. Appended items are picked up automatically.
- Layout (list column, sticky map column, mobile stacking or toggling) is built in Webflow. Give `#consortium-map-root` an explicit height. The map resizes itself whenever its box changes.

