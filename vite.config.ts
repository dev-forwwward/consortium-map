import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { requireCartoKey } from './scripts/require-carto-key.mjs';

export default defineConfig(({ mode }) => {
  requireCartoKey(mode);

  return {
    plugins: [react(), tailwindcss()],
  };
});
