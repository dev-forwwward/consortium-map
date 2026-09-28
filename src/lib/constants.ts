// CARTO began requiring an API key on basemaps.cartocdn.com on 23 September
// 2026. Keyless requests still return HTTP 200 — the body is just a watermarked
// "API KEY REQUIRED" placeholder — so a missing key fails silently rather than
// erroring. See tileHealth.ts for the runtime detection that catches that.
const CARTO_KEY = import.meta.env.VITE_CARTO_BASEMAP_KEY;

export const TILE_URL =
  `https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png?key=${CARTO_KEY}`;

export const TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';

export const BRAND_ORANGE = '#ff5a1f';

export const DEFAULT_CENTER: [number, number] = [35.6, -84.2];
export const DEFAULT_ZOOM = 6;
export const MAX_CLUSTER_RADIUS = 60;
