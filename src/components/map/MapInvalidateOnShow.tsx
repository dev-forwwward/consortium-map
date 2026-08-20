import { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import { useMapExplorer } from '../../hooks/useMapExplorer';

/**
 * The map stays mounted even when hidden behind `display:none` on mobile
 * (switching Leaflet re-init is expensive and bug-prone), but a hidden map
 * computes the wrong internal size. Recompute it whenever the mobile view
 * flips back to "map", and on any other layout-driven resize.
 */
export function MapInvalidateOnShow() {
  const map = useMap();
  const { mobileView } = useMapExplorer();

  useEffect(() => {
    if (mobileView !== 'map') return;
    const frame = requestAnimationFrame(() => map.invalidateSize());
    return () => cancelAnimationFrame(frame);
  }, [mobileView, map]);

  useEffect(() => {
    const container = map.getContainer();
    const observer = new ResizeObserver((entries) => {
      // A hidden (display:none) container reports a 0x0 box — both on the
      // mobile "list" tab (where the map panel starts hidden) and any other
      // transition to hidden. Recalculating against that degenerate size
      // corrupts the map's bounds, so skip it; the dedicated effect above
      // already re-syncs once the panel becomes visible again.
      const { width, height } = entries[0]?.contentRect ?? { width: 0, height: 0 };
      if (width === 0 || height === 0) return;
      map.invalidateSize();
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [map]);

  return null;
}
