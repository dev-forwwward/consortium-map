import { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import { latLngBounds } from 'leaflet';
import { DESKTOP_MAP_QUERY, MAP_LIMIT_BOUNDS, MOBILE_MAP_LIMIT_BOUNDS } from '../../lib/constants';

/**
 * The user can't pan past the limit bounds (one box for desktop, one for the
 * tall mobile map), and the furthest zoom-out is the level at which that box
 * still fills the map. That zoom depends on the container size, so it is
 * recomputed on every resize (window, expanded map, breakpoint change).
 */
export function MapViewLimits() {
  const map = useMap();

  useEffect(() => {
    const desktopBounds = latLngBounds(MAP_LIMIT_BOUNDS);
    const mobileBounds = latLngBounds(MOBILE_MAP_LIMIT_BOUNDS);
    const desktop = window.matchMedia(DESKTOP_MAP_QUERY);

    const apply = () => {
      const { x, y } = map.getSize();
      // A hidden (0x0) map can't be measured; the resize on show re-runs this.
      if (x === 0 || y === 0) return;
      const bounds = desktop.matches ? desktopBounds : mobileBounds;
      map.options.maxBoundsViscosity = 1;
      // Exact (fractional) fit: with the default whole-level snap, getBoundsZoom
      // rounds up and the furthest zoom-out crops well inside the bounds.
      const snap = map.options.zoomSnap;
      map.options.zoomSnap = 0;
      const minZoom = map.getBoundsZoom(bounds, true);
      map.options.zoomSnap = snap;
      map.setMinZoom(minZoom);
      map.setMaxBounds(bounds);
    };

    apply();
    map.on('resize', apply);
    desktop.addEventListener('change', apply);
    return () => {
      map.off('resize', apply);
      desktop.removeEventListener('change', apply);
    };
  }, [map]);

  return null;
}
