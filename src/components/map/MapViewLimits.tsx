import { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import { latLngBounds, point } from 'leaflet';
import { CONTIGUOUS_US_BOUNDS, DESKTOP_MAP_QUERY } from '../../lib/constants';

// Breathing room around the US at the furthest zoom-out, in px. Mobile adds
// room at the bottom for the peeking sheet that overlaps the map.
// Smallest usable area (after padding), in px, worth fitting the US into.
const MIN_ROOM = 120;
const MAX_ZOOM = 18;
const PADDING = { desktop: { topLeft: [24, 24], bottomRight: [24, 24] }, mobile: { topLeft: [12, 12], bottomRight: [12, 72] } } as const;

/**
 * The furthest zoom-out is the (fractional) level at which the contiguous US
 * fits the map, and the pan limit is exactly that zoomed-out view: zoomed in,
 * the user can pan anywhere inside it but not past it. Both depend on the
 * container size, so they are recomputed on every resize (window, expanded
 * map, breakpoint change).
 *
 * The map opens on that zoomed-out view. It is applied on the first real
 * measurement, not at mount: on the Webflow page the map starts hidden (0x0),
 * and Leaflet's own initial centre ends up in the top-left corner once the
 * container gets its size. Later resizes re-centre it only when the user is
 * zoomed fully out; otherwise the view is kept inside the new limit.
 */
export function MapViewLimits() {
  const map = useMap();

  useEffect(() => {
    const us = latLngBounds(CONTIGUOUS_US_BOUNDS);
    const desktop = window.matchMedia(DESKTOP_MAP_QUERY);
    let fitted = false;

    const apply = () => {
      const size = map.getSize();
      // A hidden (0x0) map can't be measured; the resize on show re-runs this.
      if (size.x === 0 || size.y === 0) return;
      const pad = desktop.matches ? PADDING.desktop : PADDING.mobile;
      const topLeft = point(pad.topLeft[0], pad.topLeft[1]);
      const bottomRight = point(pad.bottomRight[0], pad.bottomRight[1]);

      // Exact (fractional) fit, computed here rather than with getBoundsZoom:
      // that clamps to the current minZoom (so one bad fit would stick) and,
      // given a map smaller than its padding, returns the max zoom. During page
      // load the map is briefly a sliver (e.g. 390x46); skip until it's real.
      const room = size.subtract(topLeft).subtract(bottomRight);
      if (room.x < MIN_ROOM || room.y < MIN_ROOM) return;
      const span = map.project(us.getSouthEast(), 0).subtract(map.project(us.getNorthWest(), 0));
      const zoom = Math.min(MAX_ZOOM, Math.max(0, Math.log2(Math.min(room.x / span.x, room.y / span.y))));
      const snap = map.options.zoomSnap;

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

      const atMinZoom = map.getZoom() <= map.getMinZoom() + 0.01;
      // Unsnapped throughout: setView, and setMinZoom when it lifts the current
      // zoom up to the new minimum, would round the fractional zoom up to the
      // next whole level, cropping the US and losing the "at min zoom" state.
      map.options.zoomSnap = 0;
      map.options.maxBoundsViscosity = 1;
      map.setMinZoom(zoom);
      map.setMaxBounds(view);
      if (!fitted || atMinZoom) {
        map.setView(map.unproject(centre, zoom), zoom, { animate: false });
        fitted = true;
      } else {
        map.panInsideBounds(view, { animate: false });
      }
      map.options.zoomSnap = snap;
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
