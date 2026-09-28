import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { requireCartoKey } from './scripts/require-carto-key.mjs';

export default defineConfig(({ mode }) => {
  // This build is produced locally and its output hand-pushed to Vercel, so a
  // missing key would otherwise ship a silently watermarked map to the live
  // Webflow site. See scripts/require-carto-key.mjs.
  requireCartoKey(mode);

  return {
    plugins: [react(), tailwindcss()],
    // Vite's default app build statically replaces process.env.NODE_ENV
    // (React checks it internally); library mode doesn't do this
    // automatically, since it assumes a downstream bundler will. Without it,
    // the IIFE crashes with "process is not defined" the moment it runs
    // standalone in a real browser with no bundler underneath it.
    define: {
      'process.env.NODE_ENV': JSON.stringify('production'),
    },
    build: {
      outDir: 'dist-embed',
      emptyOutDir: true,
      cssCodeSplit: false,
      lib: {
        entry: 'src/embed.tsx',
        name: 'ConsortiumMapEmbed',
        formats: ['iife' as const],
      },
      rollupOptions: {
        output: {
          entryFileNames: 'consortium-map.js',
          // Only the CSS entry point needs a stable name (it's the one file
          // the Webflow snippet's own <link> injection references directly).
          // Everything else (font subset files, etc.) keeps normal hashed
          // names — forcing them all through the same pattern collided their
          // names and made Rollup fall back to inlining every font as a
          // base64 data URI, ballooning the CSS to over 1MB.
          assetFileNames: (assetInfo) =>
            assetInfo.names?.[0]?.endsWith('.css')
              ? 'consortium-map.[ext]'
              : 'assets/[name]-[hash][extname]',
        },
      },
    },
  };
});
