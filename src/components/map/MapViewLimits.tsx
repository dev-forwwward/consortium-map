import { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import { latLngBounds, point } from 'leaflet';
import { CONTIGUOUS_US_BOUNDS, DESKTOP_MAP_QUERY } from '../../lib/constants';

// Breathing room around the US at the furthest zoom-out, in px. Mobile adds
// room at the bottom for the peeking sheet that overlaps the map.
const PADDING = { desktop: { topLeft: [24, 24], bottomRight: [24, 24] }, mobile: { topLeft: [12, 12], bottomRight: [12, 72] } } as const;

/**
 * The furthest zoom-out is the (fractional) level at which the contiguous US
 * fits the map, and the pan limit is exactly that zoomed-out view: zoomed in,
 * the user can pan anywhere inside it but not past it. Both depend on the
 * container size, so they are recomputed on every resize (window, expanded
 * map, breakpoint change).
 */
export function MapViewLimits() {
  const map = useMap();

  useEffect(() => {
    const us = latLngBounds(CONTIGUOUS_US_BOUNDS);
    const desktop = window.matchMedia(DESKTOP_MAP_QUERY);

    const apply = () => {
      const size = map.getSize();
      // A hidden (0x0) map can't be measured; the resize on show re-runs this.
      if (size.x === 0 || size.y === 0) return;
      const pad = desktop.matches ? PADDING.desktop : PADDING.mobile;
      const topLeft = point(pad.topLeft[0], pad.topLeft[1]);
      const bottomRight = point(pad.bottomRight[0], pad.bottomRight[1]);

      // Exact (fractional) fit: with the default whole-level snap, getBoundsZoom
      // would round down and leave the furthest zoom-out needlessly far out.
      const snap = map.options.zoomSnap;
      map.options.zoomSnap = 0;
      const zoom = map.getBoundsZoom(us, false, topLeft.add(bottomRight));
      map.options.zoomSnap = snap;

      // The view at that zoom with the US inside the padded area: its centre is
      // the US centre shifted by half the padding difference.
      const offset = bottomRight.subtract(topLeft).divideBy(2);
      const nw = map.project(us.getNorthWest(), zoom);
      const se = map.project(us.getSouthEast(), zoom);
      const centre = nw.add(se).divideBy(2).add(offset);
      const half = size.divideBy(2);
      const view = latLngBounds(
        map.unproject(centre.subtract(half), zoom),
        map.unproject(centre.add(half), zoom),
      );

      map.options.maxBoundsViscosity = 1;
      map.setMinZoom(zoom);
      map.setMaxBounds(view);
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
