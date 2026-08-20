import type { Location } from '../../types/location';
import { locationAriaLabel } from '../../lib/mapUtils';

interface LocationCardProps {
  location: Location;
  index: number;
  isSelected: boolean;
  isHovered: boolean;
  tabIndex: 0 | -1;
  onActivate: () => void;
  onHoverStart: () => void;
  onHoverEnd: () => void;
  registerRef: (el: HTMLLIElement | null) => void;
}

export function LocationCard({
  location,
  index,
  isSelected,
  isHovered,
  tabIndex,
  onActivate,
  onHoverStart,
  onHoverEnd,
  registerRef,
}: LocationCardProps) {
  return (
    <li
      ref={registerRef}
      role="option"
      aria-selected={isSelected}
      aria-label={locationAriaLabel(location)}
      tabIndex={tabIndex}
      data-location-id={location.id}
      onClick={onActivate}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onActivate();
        }
      }}
      onMouseEnter={onHoverStart}
      onMouseLeave={onHoverEnd}
      className={`card-reveal group flex cursor-pointer gap-3 border-b border-surface-line p-3 outline-none transition-colors focus-visible:bg-surface-raised ${
        isSelected ? 'bg-surface-raised' : isHovered ? 'bg-surface-raised/60' : 'bg-transparent'
      }`}
      style={{ animationDelay: `${Math.min(index, 12) * 45}ms` }}
    >
      <div className="relative h-20 w-28 shrink-0 overflow-hidden">
        <img src={location.image} alt="" className="h-full w-full object-cover" loading="lazy" />
        <span className="absolute left-0 top-0 bg-ink/85 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.15em] text-paper">
          {location.category}
        </span>
        <span
          className={`pointer-events-none absolute inset-0 border-2 transition-colors ${
            isSelected ? 'border-brand' : 'border-transparent'
          }`}
        />
      </div>
      <div className="flex min-w-0 flex-col justify-center gap-1">
        <span className="truncate font-display text-base leading-tight text-paper">{location.name}</span>
        <span className="font-mono text-[11px] uppercase tracking-[0.15em] text-fog">
          {location.city}, {location.state}
        </span>
      </div>
    </li>
  );
}
