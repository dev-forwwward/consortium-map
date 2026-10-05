import { useEffect } from 'react';
import { useMapExplorer } from './useMapExplorer';
import {
  ACTIVE_CLASS,
  HOVER_CLASS,
  ITEM_SELECTOR,
  findCmsItem,
  findCmsList,
  getCmsItemId,
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
 * root) to the map's selection/hover state:
 *   card hover → marker highlight;
 *   marker hover/select → HOVER_CLASS / ACTIVE_CLASS on the card, which the
 *   Webflow Designer styles.
 * A card click is a plain link to the project page. Scrolling the selected
 * card into view is the page's view controller's job (src/webflow), since it
 * may first have to bring the list back.
 */
export function useCmsBridge() {
  const { locations, selectedLocationId, hoveredLocationId, setHovered } = useMapExplorer();

  useEffect(() => {
    const list = findCmsList();
    if (!list) return;

    // mouseover/mouseout (not enter/leave) so one delegated listener covers
    // items Finsweet adds later; relatedTarget filters out moves between an
    // item's own children.
    const handleOver = (event: MouseEvent) => {
      const item = itemFrom(event.target);
      if (!item || item.contains(event.relatedTarget as Node | null)) return;
      const id = getCmsItemId(item);
      if (id) setHovered(id);
    };
    const handleOut = (event: MouseEvent) => {
      const item = itemFrom(event.target);
      if (!item || item.contains(event.relatedTarget as Node | null)) return;
      setHovered(null);
    };

    list.addEventListener('mouseover', handleOver);
    list.addEventListener('mouseout', handleOut);
    return () => {
      list.removeEventListener('mouseover', handleOver);
      list.removeEventListener('mouseout', handleOut);
    };
  }, [setHovered]);

  // `locations` is a dependency so classes are re-applied after the filter
  // re-renders items (Finsweet may swap in fresh nodes).
  useEffect(() => {
    setExclusiveClass(HOVER_CLASS, hoveredLocationId);
  }, [hoveredLocationId, locations]);

  useEffect(() => {
    setExclusiveClass(ACTIVE_CLASS, selectedLocationId);
  }, [selectedLocationId, locations]);
}
