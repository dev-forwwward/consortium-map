import { latLngBounds, point, type Map as LeafletMap } from 'leaflet';
import { CONTIGUOUS_US_BOUNDS } from '../../lib/constants';

/**
 * A run of resizes (the expand slide, a window drag) counts as over after this
 * long without another. The limits are re-fitted once then, not per frame.
 */
export const RESIZE_SETTLE_MS = 120;

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
 * container size, so they are re-fitted after it changes (window, expanded
 * map, breakpoint change).
 *
 * The map opens on that zoomed-out view. It is applied on the first real
 * measurement, at once: on the Webflow page the map starts hidden (0x0), and
 * Leaflet's own initial centre ends up in the top-left corner once the
 * container gets its size. Later resizes are re-fitted once they settle, with
 * an animation: re-fitting every frame of the expand slide changed the zoom
 * each frame, switching tile levels mid-slide and blanking the basemap.
 * Meanwhile Leaflet keeps the centre as the map grows or shrinks. The view is
 * re-centred only when the user is zoomed fully out (or the new limit is above
 * their zoom); otherwise it is kept inside the new limit.
 */
export function attachViewLimits(map: LeafletMap, desktop: MediaQueryList): () => void {
  const us = latLngBounds(CONTIGUOUS_US_BOUNDS);
  let fitted = false;
  let settleTimer: ReturnType<typeof setTimeout> | undefined;

  const apply = (animate: boolean) => {
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

    const refit = !fitted || map.getZoom() <= map.getMinZoom() + 0.01 || map.getZoom() < zoom;
    // Unsnapped throughout: setView would round the fractional zoom up to the
    // next whole level, cropping the US and losing the "at min zoom" state.
    map.options.zoomSnap = 0;
    map.options.maxBoundsViscosity = 1;
    // The new limits go in first, as plain options. setView clamps to the
    // current minZoom, so a narrower map's lower fit would be held at the old
    // one; and setMinZoom / setMaxBounds would start a zoom or pan of their
    // own, which an animated setView started after them can't override.
    map.options.minZoom = zoom;
    map.options.maxBounds = view;
    if (refit) map.setView(map.unproject(centre, zoom), zoom, { animate });
    else map.panInsideBounds(view, { animate });
    // Leaflet's own maxBounds check on moveend: registered once, it reads the
    // option above on every later move. The zoom control re-reads its limits.
    if (!fitted) map.setMaxBounds(view);
    map.fire('zoomlevelschange');
    fitted = true;
    map.options.zoomSnap = snap;
  };

  const onResize = () => {
    clearTimeout(settleTimer);
    // The first fit can't wait: until then the map shows Leaflet's own view.
    if (!fitted) apply(false);
    else settleTimer = setTimeout(() => apply(true), RESIZE_SETTLE_MS);
  };

  apply(false);
  map.on('resize', onResize);
  desktop.addEventListener('change', onResize);
  return () => {
    clearTimeout(settleTimer);
    map.off('resize', onResize);
    desktop.removeEventListener('change', onResize);
  };
}
