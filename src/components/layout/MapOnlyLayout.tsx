import { useCmsBridge } from '../../hooks/useCmsBridge';
import { MapPanel } from '../map/MapPanel';

/**
 * The Webflow embed: map only. The project list and its filter live on the
 * host page as a CMS Collection List; useCmsBridge keeps the two in sync.
 * A marker click highlights its card (no modal); the page's view controller
 * reveals and scrolls to it.
 */
export function MapOnlyLayout() {
  useCmsBridge();

  return (
    <div className="relative h-full overflow-hidden bg-ink text-paper">
      <MapPanel syncBounds={false} selectOnly />
    </div>
  );
}
