import { loadEnv } from 'vite';

/**
 * Fails the build when VITE_CARTO_BASEMAP_KEY is missing.
 *
 * CARTO gated basemaps.cartocdn.com behind an API key on 23 September 2026, and
 * a keyless tile request still answers HTTP 200 with a watermarked placeholder
 * image. Nothing throws, nothing 4xxs — the map just silently renders "API KEY
 * REQUIRED" across every tile. Since the embed is built locally and the output
 * hand-pushed to Vercel, a forgotten .env would ship exactly that to the live
 * Webflow site. Failing here is the only stage that can catch it cheaply.
 */
export function requireCartoKey(mode) {
  // Vite does not expose .env through process.env inside the config itself.
  const env = loadEnv(mode, process.cwd(), '');
  if (!env.VITE_CARTO_BASEMAP_KEY) {
    throw new Error(
      'VITE_CARTO_BASEMAP_KEY is not set.\n' +
        'The CARTO basemap requires an API key since 23 September 2026.\n' +
        'Get one at https://carto.com/basemaps/apikey and add it to .env:\n' +
        '  VITE_CARTO_BASEMAP_KEY=<key>\n',
    );
  }
}
