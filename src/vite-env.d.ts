/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** CARTO basemaps API key. Required since 23 September 2026 — see README. */
  readonly VITE_CARTO_BASEMAP_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
