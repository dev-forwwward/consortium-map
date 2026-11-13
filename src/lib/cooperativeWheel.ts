import type { Map as LeafletMap } from 'leaflet';

/**
 * Google Maps-style "cooperative" wheel handling for a map that sits inside a
 * scrolling page: a plain wheel over the map scrolls the page (the event is
 * left alone, so it bubbles out of the shadow root to the site's Lenis or to
 * native scrolling), and only Ctrl or ⌘ + wheel zooms the map. A trackpad
 * pinch arrives as a ctrlKey wheel in Chrome, Edge and Firefox, so pinch-zoom
 * keeps working without a key.
 */

/** Ctrl or ⌘ held, on any platform: the Mac/Windows split only changes the hint's wording. */
export function isZoomWheel(event: Pick<WheelEvent, 'ctrlKey' | 'metaKey'>): boolean {
  return event.ctrlKey || event.metaKey;
}

export function wheelZoomHint(platform: string): string {
  return /mac|iphone|ipad/i.test(platform)
    ? 'Use ⌘ + scroll to zoom the map'
    : 'Use Ctrl + scroll to zoom the map';
}

// Leaflet 1.x's ScrollWheelZoom handler, past its public enable/disable. Reusing
// its wheel step keeps Leaflet's own zoom maths (delta accumulation, debounce,
// zoom around the cursor) and its DomEvent.stop, which also blocks the
// browser's Ctrl + wheel page zoom.
type WheelZoomInternals = {
  _delta?: number;
  _onWheelScroll(event: WheelEvent): void;
};

export interface CooperativeWheelCallbacks {
  /** A wheel without the key: the page scrolled instead. Show the hint. */
  onPlainWheel?: () => void;
  /** A wheel with the key: the map zoomed. */
  onZoomWheel?: () => void;
}

/** Swaps Leaflet's wheel zoom for the cooperative one. Returns the undo. */
export function enableCooperativeWheelZoom(
  map: LeafletMap,
  { onPlainWheel, onZoomWheel }: CooperativeWheelCallbacks = {},
): () => void {
  const handler = map.scrollWheelZoom;
  const internals = handler as unknown as WheelZoomInternals;
  const wasEnabled = handler.enabled();
  handler.disable();
  // Set by the handler's addHooks; missing if it was never enabled.
  if (typeof internals._delta !== 'number') internals._delta = 0;

  const container = map.getContainer();
  const onWheel = (event: WheelEvent) => {
    if (isZoomWheel(event)) {
      internals._onWheelScroll.call(handler, event);
      onZoomWheel?.();
    } else {
      onPlainWheel?.();
    }
  };
  // Not passive: Ctrl + wheel must be preventable or the browser zooms the page.
  container.addEventListener('wheel', onWheel, { passive: false });

  return () => {
    container.removeEventListener('wheel', onWheel);
    if (wasEnabled) handler.enable();
  };
}
