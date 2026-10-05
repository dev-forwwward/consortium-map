// Copies webflow/view-modes.css (the single source of truth) into dist-embed/
// under a stable name so Vercel serves it. The Projects page Embed links to it
// instead of pasting it (Webflow's Embed limit is 10,000 chars). Must run AFTER
// the vite build, which empties dist-embed/.
import { copyFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const outDir = join(root, 'dist-embed');
mkdirSync(outDir, { recursive: true });
copyFileSync(join(root, 'webflow', 'view-modes.css'), join(outDir, 'consortium-map-v3-page.css'));
console.log('Copied webflow/view-modes.css to dist-embed/consortium-map-v3-page.css');
