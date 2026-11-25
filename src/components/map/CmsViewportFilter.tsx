import { useCallback, useEffect, useMemo } from 'react';
import { useMap, useMapEvents } from 'react-leaflet';
import type { LeafletEventHandlerFnMap } from 'leaflet';
import { useMapExplorer } from '../../hooks/useMapExplorer';
import { ITEM_SELECTOR, OFFMAP_CLASS, findCmsList, getCmsItemId } from '../../lib/cmsSource';
import { cardIdOf } from '../../types/location';

export const EMPTY_NOTE_CLASS = 'cm-offmap-empty';
const EMPTY_NOTE_TEXT = 'No projects in this area. Zoom out to see more.';

/** The card's own Collection Item, the element the list lays out. */
function cellOf(item: HTMLElement): HTMLElement {
  return item.closest<HTMLElement>('.w-dyn-item') ?? item;
}

/**
 * Marks the cards to keep in the list for a given set of card ids in view:
 * every other card gets OFFMAP_CLASS. Returns how many cards are in view.
 * Toggles only on change, so an unchanged view causes no DOM mutation (the
 * CMS reader observes the list).
 */
export function markCardsInView(list: HTMLElement, inView: Set<string>): number {
  let shown = 0;
  list.querySelectorAll<HTMLElement>(ITEM_SELECTOR).forEach((item) => {
    const id = getCmsItemId(item);
    const off = !id || !inView.has(id);
    const cell = cellOf(item);
    if (cell.classList.contains(OFFMAP_CLASS) !== off) cell.classList.toggle(OFFMAP_CLASS, off);
    if (!off) shown++;
  });
  return shown;
}

function setEmptyNote(list: HTMLElement, empty: boolean) {
  // A sibling of the list, not a child: the CMS reader observes the list.
  let note = list.parentElement?.querySelector<HTMLElement>(`:scope > .${EMPTY_NOTE_CLASS}`);
  if (!note) {
    if (!empty) return;
    note = document.createElement('p');
    note.className = EMPTY_NOTE_CLASS;
    note.textContent = EMPTY_NOTE_TEXT;
    list.after(note);
  }
  note.hidden = !empty;
}

/**
 * Webflow embed only: narrows the page's Collection List to the cards with at
 * least one pin inside the map's current view, by putting OFFMAP_CLASS on the
 * rest. view-modes.css hides those outside Portfolio (where the map is
 * hidden and the list shows everything). Like MapBoundsSync, it checks raw
 * lat/lng against map.getBounds(), so a pin folded into a cluster still
 * counts. Runs on moveend/zoomend only, never mid-drag.
 */
export function CmsViewportFilter() {
  const map = useMap();
  const { locations, dataStatus } = useMapExplorer();

  const apply = useCallback(() => {
    const list = findCmsList();
    if (!list) return;
    // A map with no size (hidden or not laid out yet) has meaningless
    // bounds; keep the last state. Showing it fires moveend again.
    const size = map.getSize();
    if (size.x === 0 || size.y === 0) return;
    const bounds = map.getBounds();
    const inView = new Set(
      locations
        .filter((location) => bounds.contains([location.latitude, location.longitude]))
        .map(cardIdOf),
    );
    setEmptyNote(list, markCardsInView(list, inView) === 0);
  }, [map, locations]);

  // Memoized for the same reason as MapBoundsSync: a stable subscription.
  const handlers: LeafletEventHandlerFnMap = useMemo(
    () => ({ moveend: apply, zoomend: apply }),
    [apply],
  );
  useMapEvents(handlers);

  // Locations change when the filter changes; re-apply for the same view.
  useEffect(() => {
    if (dataStatus === 'ready') apply();
  }, [apply, dataStatus]);

  useEffect(
    () => () => {
      document.querySelectorAll(`.${OFFMAP_CLASS}`).forEach((el) => el.classList.remove(OFFMAP_CLASS));
      document.querySelectorAll(`.${EMPTY_NOTE_CLASS}`).forEach((el) => el.remove());
    },
    [],
  );

  return null;
}
