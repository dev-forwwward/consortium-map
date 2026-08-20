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
- List filtering is bounds-driven: it always checks raw lat/lng against `map.getBounds()`, never against which markers happen to be rendered as clusters.
- See `src/lib/constants.ts` to change the tile source, default map center/zoom, or cluster radius.
