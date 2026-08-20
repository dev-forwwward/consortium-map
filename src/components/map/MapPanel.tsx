import { MapContainer, TileLayer } from 'react-leaflet';
import { useMapExplorer } from '../../hooks/useMapExplorer';
import { TILE_ATTRIBUTION, TILE_URL, DEFAULT_CENTER, DEFAULT_ZOOM } from '../../lib/constants';
import { ClusterLayer } from './ClusterLayer';
import { MapBoundsSync } from './MapBoundsSync';
import { MapInvalidateOnShow } from './MapInvalidateOnShow';
import { MapErrorBoundary } from './MapErrorBoundary';
import { MapErrorState } from '../states/MapErrorState';

export function MapPanel() {
  const { mapReady, setMapReady, mapError, setMapError, mapInstanceKey, retryMap } =
    useMapExplorer();

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
            <ClusterLayer />
            <MapBoundsSync />
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
