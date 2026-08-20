import { useCallback, useEffect, useMemo } from 'react';
import { useMapEvents } from 'react-leaflet';
import type L from 'leaflet';
import type { LeafletEventHandlerFnMap } from 'leaflet';
import { useMapExplorer } from '../../hooks/useMapExplorer';

/**
 * Filters the list to whatever falls inside the current viewport. Always
 * checks the raw dataset's lat/lng against map.getBounds() — never against
 * the cluster group's rendered layers — so a location on-screen but folded
 * into a cluster bubble still counts as visible.
 */
export function MapBoundsSync() {
  const { locations, setVisibleLocationIds } = useMapExplorer();

  const syncBounds = useCallback(
    (map: L.Map) => {
      const bounds = map.getBounds();
      const ids = locations
        .filter((location) => bounds.contains([location.latitude, location.longitude]))
        .map((location) => location.id);
      setVisibleLocationIds(new Set(ids));
    },
    [locations, setVisibleLocationIds],
  );

  // react-leaflet's useMapEvents re-subscribes (map.off + map.on) whenever
  // this object's identity changes, which is every render for an inline
  // literal. Memoizing it keeps the subscription stable across the
  // cascading re-renders a single selection triggers, so a moveend/zoomend
  // firing mid-cascade is never missed by an unsubscribe/resubscribe gap.
  const handlers: LeafletEventHandlerFnMap = useMemo(
    () => ({
      moveend: (event) => syncBounds(event.target),
      zoomend: (event) => syncBounds(event.target),
    }),
    [syncBounds],
  );

  const map = useMapEvents(handlers);

  // moveend/zoomend don't fire on mount, so run one sync immediately.
  useEffect(() => {
    syncBounds(map);
  }, [map, syncBounds]);

  return null;
}
