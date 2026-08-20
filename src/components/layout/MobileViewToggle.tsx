import { useMapExplorer } from '../../hooks/useMapExplorer';
import type { MobileView } from '../../context/MapExplorerProvider';

const TABS: { view: MobileView; label: string; panelId: string }[] = [
  { view: 'list', label: 'List', panelId: 'panel-list' },
  { view: 'map', label: 'Map', panelId: 'panel-map' },
];

export function MobileViewToggle() {
  const { mobileView, setMobileView } = useMapExplorer();

  const handleKeyDown: React.KeyboardEventHandler<HTMLDivElement> = (event) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const currentIndex = TABS.findIndex((tab) => tab.view === mobileView);
    let nextIndex = currentIndex;
    if (event.key === 'ArrowLeft') nextIndex = Math.max(currentIndex - 1, 0);
    if (event.key === 'ArrowRight') nextIndex = Math.min(currentIndex + 1, TABS.length - 1);
    if (event.key === 'Home') nextIndex = 0;
    if (event.key === 'End') nextIndex = TABS.length - 1;
    const nextTab = TABS[nextIndex];
    setMobileView(nextTab.view);
    document.getElementById(`tab-${nextTab.view}`)?.focus();
  };

  return (
    <div
      role="tablist"
      aria-label="View"
      onKeyDown={handleKeyDown}
      className="flex border-b border-surface-line md:hidden"
    >
      {TABS.map((tab) => {
        const isSelected = mobileView === tab.view;
        return (
          <button
            key={tab.view}
            id={`tab-${tab.view}`}
            role="tab"
            type="button"
            aria-selected={isSelected}
            aria-controls={tab.panelId}
            tabIndex={isSelected ? 0 : -1}
            onClick={() => setMobileView(tab.view)}
            className={`flex-1 border-b-2 py-3 text-center font-mono text-xs uppercase tracking-[0.2em] transition-colors ${
              isSelected ? 'border-brand text-paper' : 'border-transparent text-fog'
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
