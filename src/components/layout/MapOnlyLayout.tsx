import { useMapExplorer } from '../../hooks/useMapExplorer';
import { useCmsBridge } from '../../hooks/useCmsBridge';
import { MapPanel } from '../map/MapPanel';
import { LocationDetailModal } from '../map/LocationDetailModal';

/**
 * The Webflow embed: map only. The project list and its filter live on the
 * host page as a CMS Collection List; useCmsBridge keeps the two in sync.
 */
export function MapOnlyLayout() {
  const { detailOpenSeq } = useMapExplorer();
  useCmsBridge();

  return (
    <div className="relative h-full overflow-hidden bg-ink text-paper">
      <MapPanel syncBounds={false} />
      <LocationDetailModal key={detailOpenSeq} />
    </div>
  );
}
