import { useEffect, useRef, useState } from 'react';
import { useMapExplorer } from '../../hooks/useMapExplorer';
import { LocationCard } from './LocationCard';
import { LoadingState } from '../states/LoadingState';
import { EmptyState } from '../states/EmptyState';

export function LocationListPanel() {
  const {
    dataStatus,
    visibleLocations,
    selectedLocationId,
    hoveredLocationId,
    selectLocation,
    setHovered,
  } = useMapExplorer();

  const [activeId, setActiveId] = useState<string | null>(null);
  const cardRefs = useRef<Map<string, HTMLLIElement>>(new Map());

  const effectiveActiveId =
    activeId && visibleLocations.some((location) => location.id === activeId)
      ? activeId
      : (selectedLocationId ?? visibleLocations[0]?.id ?? null);

  // A marker click (or any external selection) scrolls the matching card
  // into view and keeps roving-tabindex bookkeeping in sync, without
  // stealing keyboard focus away from the map.
  useEffect(() => {
    if (!selectedLocationId) return;
    setActiveId(selectedLocationId);
    cardRefs.current.get(selectedLocationId)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [selectedLocationId]);

  const handleListKeyDown: React.KeyboardEventHandler<HTMLUListElement> = (event) => {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    if (visibleLocations.length === 0) return;
    event.preventDefault();

    const currentIndex = visibleLocations.findIndex((location) => location.id === effectiveActiveId);
    let nextIndex = currentIndex;
    if (event.key === 'ArrowDown') nextIndex = Math.min(currentIndex + 1, visibleLocations.length - 1);
    if (event.key === 'ArrowUp') nextIndex = Math.max(currentIndex - 1, 0);
    if (event.key === 'Home') nextIndex = 0;
    if (event.key === 'End') nextIndex = visibleLocations.length - 1;

    const nextLocation = visibleLocations[nextIndex];
    if (!nextLocation) return;
    setActiveId(nextLocation.id);
    selectLocation(nextLocation.id);
    cardRefs.current.get(nextLocation.id)?.focus();
  };

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-surface-line px-4 py-5">
        <h1 className="font-display text-xl uppercase tracking-[0.08em] text-paper">Our Projects</h1>
      </div>

      {dataStatus === 'loading' ? (
        <LoadingState label="Loading projects" />
      ) : visibleLocations.length === 0 ? (
        <EmptyState
          title="No projects in view"
          message="Pan or zoom the map to bring project locations into view."
        />
      ) : (
        <ul
          role="listbox"
          aria-label="Our projects"
          className="flex-1 overflow-y-auto"
          onKeyDown={handleListKeyDown}
        >
          {visibleLocations.map((location, index) => (
            <LocationCard
              key={location.id}
              location={location}
              index={index}
              isSelected={location.id === selectedLocationId}
              isHovered={location.id === hoveredLocationId}
              tabIndex={location.id === effectiveActiveId ? 0 : -1}
              onActivate={() => {
                setActiveId(location.id);
                selectLocation(location.id, { openDetail: true });
              }}
              onHoverStart={() => setHovered(location.id)}
              onHoverEnd={() => setHovered(null)}
              registerRef={(el) => {
                if (el) cardRefs.current.set(location.id, el);
                else cardRefs.current.delete(location.id);
              }}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
