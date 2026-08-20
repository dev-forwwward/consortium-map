import { useMapExplorer } from '../../hooks/useMapExplorer';
import { MobileViewToggle } from './MobileViewToggle';
import { LocationListPanel } from '../list/LocationListPanel';
import { MapPanel } from '../map/MapPanel';
import { LocationDetailModal } from '../map/LocationDetailModal';

export function ExplorerLayout() {
  const { mobileView } = useMapExplorer();

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-ink text-paper md:flex-row">
      <MobileViewToggle />

      {/*
        Below md, list and map are stacked in the same box via absolute
        positioning and toggled with visibility (not display:none) — a
        display:none map container reports 0x0 to Leaflet, which corrupts
        its bounds. `md:contents` drops this wrapper's own box at md+ so its
        children become normal flex items of the row layout instead.
      */}
      <div className="relative min-h-0 flex-1 md:contents">
        <div
          id="panel-list"
          role="tabpanel"
          aria-labelledby="tab-list"
          className={`min-h-0 overflow-hidden max-md:absolute max-md:inset-0 md:static md:w-72 md:flex-none lg:w-96 ${
            mobileView === 'map' ? 'max-md:invisible max-md:pointer-events-none' : ''
          }`}
        >
          <LocationListPanel />
        </div>

        <div
          id="panel-map"
          role="tabpanel"
          aria-labelledby="tab-map"
          className={`relative min-h-0 max-md:absolute max-md:inset-0 md:static md:flex-1 ${
            mobileView === 'list' ? 'max-md:invisible max-md:pointer-events-none' : ''
          }`}
        >
          <MapPanel />
        </div>
      </div>

      <LocationDetailModal />
    </div>
  );
}
