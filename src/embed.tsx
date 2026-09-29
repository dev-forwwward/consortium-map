import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import './styles/markers.css';
import './embed.css';

import { MapExplorerProvider } from './context/MapExplorerProvider';
import { MapOnlyLayout } from './components/layout/MapOnlyLayout';

const MOUNT_ID = 'consortium-map-root';
// Deployed alongside consortium-map.js at build/deploy time — hardcoded
// rather than resolved via import.meta.url, whose behavior isn't reliably
// guaranteed under Rollup's iife output format.
// A `data-css-url` on the mount element overrides it, for testing a local
// build against a fixture page.
const CSS_URL = 'https://consortium-map-embed-fwd-projects.vercel.app/consortium-map.css';

function mount() {
  const container = document.getElementById(MOUNT_ID);
  if (!container) {
    console.error(`[consortium-map-embed] mount target #${MOUNT_ID} not found — skipping mount`);
    return;
  }
  if (container.dataset.consortiumMapMounted === 'true') return;

  const shadow = container.shadowRoot ?? container.attachShadow({ mode: 'open' });

  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = container.dataset.cssUrl ?? CSS_URL;
  shadow.appendChild(link);

  const appRoot = document.createElement('div');
  appRoot.className = 'consortium-map-app';
  shadow.appendChild(appRoot);

  createRoot(appRoot).render(
    <StrictMode>
      <MapExplorerProvider source="cms">
        <MapOnlyLayout />
      </MapExplorerProvider>
    </StrictMode>,
  );

  container.dataset.consortiumMapMounted = 'true';
}

mount();
