import { createContext, useCallback, useMemo, useState, type ReactNode } from 'react';
import type { Location } from '../types/location';
import { useLocations } from '../hooks/useLocations';

export type MobileView = 'list' | 'map';
export type DataStatus = 'loading' | 'ready' | 'error';

export interface MapExplorerContextValue {
  locations: Location[];
  dataStatus: DataStatus;
  visibleLocations: Location[];
  visibleLocationIds: Set<string>;
  setVisibleLocationIds: (ids: Set<string>) => void;

  selectedLocationId: string | null;
  selectedLocation: Location | null;
  hoveredLocationId: string | null;
  setHovered: (id: string | null) => void;
  selectLocation: (id: string | null, options?: { openDetail?: boolean }) => void;

  isDetailOpen: boolean;
  closeDetail: () => void;

  mobileView: MobileView;
  setMobileView: (view: MobileView) => void;

  mapReady: boolean;
  setMapReady: (ready: boolean) => void;
  mapError: string | null;
  setMapError: (message: string | null) => void;
  mapInstanceKey: number;
  retryMap: () => void;
}

export const MapExplorerContext = createContext<MapExplorerContextValue | null>(null);

export function MapExplorerProvider({ children }: { children: ReactNode }) {
  const { locations, status: dataStatus } = useLocations();

  const [visibleLocationIds, setVisibleLocationIds] = useState<Set<string>>(
    () => new Set(locations.map((location) => location.id)),
  );
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);
  const [hoveredLocationId, setHoveredLocationId] = useState<string | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [mobileView, setMobileView] = useState<MobileView>('list');
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [mapInstanceKey, setMapInstanceKey] = useState(0);

  const selectLocation = useCallback(
    (id: string | null, options?: { openDetail?: boolean }) => {
      setSelectedLocationId(id);
      if (options?.openDetail && id) {
        setIsDetailOpen(true);
      }
    },
    [],
  );

  const closeDetail = useCallback(() => setIsDetailOpen(false), []);

  const setHovered = useCallback((id: string | null) => setHoveredLocationId(id), []);

  const retryMap = useCallback(() => {
    setMapError(null);
    setMapReady(false);
    setMapInstanceKey((key) => key + 1);
  }, []);

  const visibleLocations = useMemo(
    () => locations.filter((location) => visibleLocationIds.has(location.id)),
    [locations, visibleLocationIds],
  );

  const selectedLocation = useMemo(
    () => locations.find((location) => location.id === selectedLocationId) ?? null,
    [locations, selectedLocationId],
  );

  const value: MapExplorerContextValue = {
    locations,
    dataStatus,
    visibleLocations,
    visibleLocationIds,
    setVisibleLocationIds,
    selectedLocationId,
    selectedLocation,
    hoveredLocationId,
    setHovered,
    selectLocation,
    isDetailOpen,
    closeDetail,
    mobileView,
    setMobileView,
    mapReady,
    setMapReady,
    mapError,
    setMapError,
    mapInstanceKey,
    retryMap,
  };

  return <MapExplorerContext.Provider value={value}>{children}</MapExplorerContext.Provider>;
}
