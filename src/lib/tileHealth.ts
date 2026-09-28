export type TileHealth = 'ok' | 'placeholder' | 'unreachable';

/**
 * Two deliberately dissimilar tiles: dense urban (Nashville) and open ocean
 * (mid-Pacific), both at z10. A working basemap cannot serve these as the same
 * number of bytes. A gated or quota-exhausted one serves both as the identical
 * placeholder image.
 */
const PROBE_TILES = [
  { z: 10, x: 265, y: 401 },
  { z: 10, x: 113, y: 512 },
] as const;

const PROBE_TIMEOUT_MS = 8000;

function expand(urlTemplate: string, tile: { z: number; x: number; y: number }): string {
  return urlTemplate
    .replace('{s}', 'a')
    .replace('{z}', String(tile.z))
    .replace('{x}', String(tile.x))
    .replace('{y}', String(tile.y))
    // Probe the 1x tile: smaller, and retina makes no difference to the
    // comparison since the placeholder is served at every scale.
    .replace('{r}', '');
}

/**
 * Detects a basemap that answers successfully but returns nothing usable.
 *
 * CARTO's keyless/over-quota response is HTTP 200 with a watermarked "API KEY
 * REQUIRED" PNG, which means Leaflet's `tileerror` never fires and the map dies
 * with a clean console — the exact failure that reached the live Webflow site in
 * September 2026. Rather than pin this to CARTO's current watermark bytes (or
 * its `wm-` ETag, which CORS does not expose to JS), compare two tiles that no
 * real basemap could render identically.
 */
export async function probeTileSource(urlTemplate: string): Promise<TileHealth> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);

  try {
    const sizes = await Promise.all(
      PROBE_TILES.map(async (tile) => {
        const response = await fetch(expand(urlTemplate, tile), { signal: controller.signal });
        if (!response.ok) return null;
        return (await response.blob()).size;
      }),
    );

    // A genuinely unreachable tile server is already covered by Leaflet's
    // `tileerror` handler; don't report it twice.
    if (sizes.some((size) => size === null)) return 'unreachable';

    return sizes[0] === sizes[1] ? 'placeholder' : 'ok';
  } catch {
    return 'unreachable';
  } finally {
    clearTimeout(timeout);
  }
}
