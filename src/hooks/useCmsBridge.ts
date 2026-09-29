import { useEffect } from 'react';
import { useMapExplorer } from './useMapExplorer';
import {
  ACTIVE_CLASS,
  HOVER_CLASS,
  ITEM_SELECTOR,
  findCmsItem,
  findCmsList,
} from '../lib/cmsSource';

function itemFrom(target: EventTarget | null): HTMLElement | null {
  return target instanceof Element ? target.closest<HTMLElement>(ITEM_SELECTOR) : null;
}

function setExclusiveClass(className: string, id: string | null) {
  document.querySelectorAll(`.${className}`).forEach((el) => el.classList.remove(className));
  if (id) findCmsItem(id)?.classList.add(className);
}

/**
 * Links the Webflow Collection List (light DOM, outside the embed's shadow
 * root) to the map's selection/hover state, in both directions:
 *   card hover → marker highlight, card click → reveal marker;
 *   marker hover/select → HOVER_CLASS / ACTIVE_CLASS on the card, which the
 *   Webflow Designer styles.
 */
export function useCmsBridge() {
  const { locations, selectedLocationId, hoveredLocationId, selectLocation, setHovered } =
    useMapExplorer();

  useEffect(() => {
    const list = findCmsList();
    if (!list) return;

    // mouseover/mouseout (not enter/leave) so one delegated listener covers
    // items Finsweet adds later; relatedTarget filters out moves between an
    // item's own children.
    const handleOver = (event: MouseEvent) => {
      const item = itemFrom(event.target);
      if (!item?.dataset.cmId || item.contains(event.relatedTarget as Node | null)) return;
      setHovered(item.dataset.cmId);
    };
    const handleOut = (event: MouseEvent) => {
      const item = itemFrom(event.target);
      if (!item || item.contains(event.relatedTarget as Node | null)) return;
      setHovered(null);
    };
    // A real link inside the card (e.g. to the project page) keeps its
    // default behavior; anywhere else on the card reveals it on the map.
    const handleClick = (event: MouseEvent) => {
      const item = itemFrom(event.target);
      if (!item?.dataset.cmId) return;
      if ((event.target as Element).closest('a[href]')) return;
      selectLocation(item.dataset.cmId);
    };

    list.addEventListener('mouseover', handleOver);
    list.addEventListener('mouseout', handleOut);
    list.addEventListener('click', handleClick);
    return () => {
      list.removeEventListener('mouseover', handleOver);
      list.removeEventListener('mouseout', handleOut);
      list.removeEventListener('click', handleClick);
    };
  }, [selectLocation, setHovered]);

  // `locations` is a dependency so classes are re-applied after the filter
  // re-renders items (Finsweet may swap in fresh nodes).
  useEffect(() => {
    setExclusiveClass(HOVER_CLASS, hoveredLocationId);
  }, [hoveredLocationId, locations]);

  useEffect(() => {
    setExclusiveClass(ACTIVE_CLASS, selectedLocationId);
  }, [selectedLocationId, locations]);

  // Scroll only on selection change — not on every filter re-read, which
  // would yank the page back to the active card.
  useEffect(() => {
    if (!selectedLocationId) return;
    findCmsItem(selectedLocationId)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [selectedLocationId]);
}
