import { useEffect } from 'react';
import { MapContainer, TileLayer } from 'react-leaflet';
import { useMapExplorer } from '../../hooks/useMapExplorer';
import { TILE_ATTRIBUTION, TILE_URL, DEFAULT_CENTER, DEFAULT_ZOOM } from '../../lib/constants';
import { ClusterLayer } from './ClusterLayer';
import { MapBoundsSync } from './MapBoundsSync';
import { MapInvalidateOnShow } from './MapInvalidateOnShow';
import { MapErrorBoundary } from './MapErrorBoundary';
import { MapErrorState } from '../states/MapErrorState';
import { probeTileSource } from '../../lib/tileHealth';

/**
 * `syncBounds` narrows the list to the current viewport (the standalone
 * explorer). The Webflow embed turns it off: there the list is the CMS
 * Collection List, driven by the page's filter rather than the map.
 * `selectOnly` makes marker clicks highlight the CMS card instead of opening
 * the detail modal (see ClusterLayer).
 */
export function MapPanel({
  syncBounds = true,
  selectOnly = false,
}: {
  syncBounds?: boolean;
  selectOnly?: boolean;
}) {
  const { mapReady, setMapReady, mapError, setMapError, mapInstanceKey, retryMap } =
    useMapExplorer();

  // A gated or over-quota basemap answers HTTP 200 with a placeholder image, so
  // `tileerror` below never fires and the map fails with a clean console. Probe
  // for that explicitly. Re-runs on retry, which bumps mapInstanceKey.
  useEffect(() => {
    let cancelled = false;

    probeTileSource(TILE_URL).then((health) => {
      if (cancelled || health !== 'placeholder') return;
      console.error(
        'Basemap is returning placeholder tiles, not map data. The CARTO API key is ' +
          'missing, invalid, or over its monthly quota — check https://carto.com/basemaps/apikey',
      );
      setMapError('The map basemap is unavailable. This has been logged — please try again shortly.');
    });

    return () => {
      cancelled = true;
    };
  }, [mapInstanceKey, setMapError]);

  return (
    <div className="relative h-full w-full bg-ink" role="region" aria-label="Project map">
      {mapError ? (
        <MapErrorState message={mapError} onRetry={retryMap} />
      ) : (
        <MapErrorBoundary key={mapInstanceKey} onError={setMapError}>
          <MapContainer
            key={mapInstanceKey}
            center={DEFAULT_CENTER}
            zoom={DEFAULT_ZOOM}
            className="h-full w-full"
            whenReady={() => setMapReady(true)}
          >
            <TileLayer
              url={TILE_URL}
              attribution={TILE_ATTRIBUTION}
              eventHandlers={{
                tileerror: () => setMapError('Map tiles failed to load. Check your connection and retry.'),
              }}
            />
            <ClusterLayer selectOnly={selectOnly} />
            {syncBounds ? <MapBoundsSync /> : null}
            <MapInvalidateOnShow />
          </MapContainer>
        </MapErrorBoundary>
      )}
      {!mapReady && !mapError ? (
        <div className="absolute inset-0 z-[500] flex items-center justify-center bg-ink">
          <span
            role="status"
            aria-live="polite"
            className="h-8 w-8 animate-spin rounded-full border-2 border-surface-line border-t-brand"
          />
        </div>
      ) : null}
    </div>
  );
}
