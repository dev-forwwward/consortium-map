import { useEffect, useMemo, useState } from 'react';
import { useMap } from 'react-leaflet';
import { enableCooperativeWheelZoom, wheelZoomHint } from '../../lib/cooperativeWheel';

// How long the hint stays up after the last plain wheel.
const HINT_MS = 1200;

function platformName(): string {
  const nav = navigator as Navigator & { userAgentData?: { platform?: string } };
  return nav.userAgentData?.platform || navigator.platform || '';
}

/**
 * Embed only: a plain wheel over the map scrolls the page; Ctrl/⌘ + wheel
 * (or a trackpad pinch) zooms. A plain wheel flashes a Google Maps-style hint
 * over the map. Rendered inside MapContainer, so it overlays the map panes;
 * the controls (z-index 1000) stay above it and it takes no pointer events.
 */
export function CooperativeWheelZoom() {
  const map = useMap();
  const [visible, setVisible] = useState(false);
  const hint = useMemo(() => wheelZoomHint(platformName()), []);

  useEffect(() => {
    let timer: number | undefined;
    const disable = enableCooperativeWheelZoom(map, {
      onPlainWheel: () => {
        setVisible(true);
        window.clearTimeout(timer);
        timer = window.setTimeout(() => setVisible(false), HINT_MS);
      },
      onZoomWheel: () => {
        window.clearTimeout(timer);
        setVisible(false);
      },
    });
    return () => {
      disable();
      window.clearTimeout(timer);
    };
  }, [map]);

  // A pointer-only hint (keyboard users zoom with +/-), so kept out of the accessibility tree.
  return (
    <div className={`cm-wheel-hint${visible ? ' is-visible' : ''}`} aria-hidden="true">
      {hint}
    </div>
  );
}
