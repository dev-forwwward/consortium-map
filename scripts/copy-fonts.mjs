// Copies just the latin-subset font files out of the installed @fontsource
// packages into public/fonts/, with stable names. Run before building the
// embed bundle so these ship as plain static files (see src/embed.css for
// why: Vite's library-mode build force-inlines anything a stylesheet's
// url() touches, ignoring assetsInlineLimit, which balloons the bundle if
// fontsource's own multi-subset CSS is imported directly instead).
import { copyFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const outDir = join(root, 'public', 'fonts');
mkdirSync(outDir, { recursive: true });

const files = [
  ['@fontsource-variable/archivo/files/archivo-latin-wdth-normal.woff2', 'archivo-variable-latin.woff2'],
  ['@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-500-normal.woff2', 'ibm-plex-mono-500-latin.woff2'],
  ['@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-600-normal.woff2', 'ibm-plex-mono-600-latin.woff2'],
  ['@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-400-normal.woff2', 'ibm-plex-sans-400-latin.woff2'],
  ['@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-500-normal.woff2', 'ibm-plex-sans-500-latin.woff2'],
  ['@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-600-normal.woff2', 'ibm-plex-sans-600-latin.woff2'],
];

for (const [src, dest] of files) {
  copyFileSync(join(root, 'node_modules', src), join(outDir, dest));
}

console.log(`Copied ${files.length} font files to public/fonts/`);
