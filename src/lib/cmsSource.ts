import type { Location } from '../types/location';

/**
 * Attribute contract between the Webflow page and the embed. The Collection
 * List wrapper carries LIST_SELECTOR; each Collection Item carries
 * ITEM_SELECTOR plus the data-cm-* fields below, bound to CMS fields in the
 * Designer. See README → "Webflow CMS setup".
 */
export const LIST_SELECTOR = '[data-cm-list]';
export const ITEM_SELECTOR = '[data-cm-item]';

export const ACTIVE_CLASS = 'is-cm-active';
export const HOVER_CLASS = 'is-cm-hover';

export function findCmsList(root: ParentNode = document): HTMLElement | null {
  return root.querySelector<HTMLElement>(LIST_SELECTOR);
}

export function findCmsItem(id: string, root: ParentNode = document): HTMLElement | null {
  return root.querySelector<HTMLElement>(`${ITEM_SELECTOR}[data-cm-id="${CSS.escape(id)}"]`);
}

/**
 * An item counts as hidden only if it — or an ancestor inside the list — is
 * display:none / [hidden]. Deliberately not a getClientRects() check: on
 * mobile the whole list column may be toggled off while the map is showing,
 * and that must not empty the map.
 */
function isFilteredOut(item: HTMLElement, list: HTMLElement): boolean {
  for (let node: HTMLElement | null = item; node && node !== list; node = node.parentElement) {
    if (node.hidden || getComputedStyle(node).display === 'none') return true;
  }
  return false;
}

// The list is re-read on every filter change, so remember what was already
// reported instead of repeating the same warning each time.
const warned = new Set<string>();
function warnOnce(key: string, message: string) {
  if (warned.has(key)) return;
  warned.add(key);
  console.warn(`[consortium-map-embed] ${message}`);
}

function parseCoordinate(raw: string | undefined): number | null {
  if (raw == null || raw.trim() === '') return null;
  const value = Number(raw.trim().replace(',', '.'));
  return Number.isFinite(value) ? value : null;
}

/**
 * Reads the rendered CMS items into Locations, skipping anything the filter
 * has hidden. An item with a missing or malformed coordinate is skipped with
 * a warning rather than thrown on, so one editor typo never takes down the
 * whole map.
 */
export function readCmsLocations(list: HTMLElement): Location[] {
  const seen = new Set<string>();
  const locations: Location[] = [];

  list.querySelectorAll<HTMLElement>(ITEM_SELECTOR).forEach((item) => {
    if (isFilteredOut(item, list)) return;

    const { cmId, cmName, cmLat, cmLng } = item.dataset;
    const latitude = parseCoordinate(cmLat);
    const longitude = parseCoordinate(cmLng);

    if (!cmId || latitude == null || longitude == null) {
      warnOnce(
        `missing:${cmId ?? cmName}`,
        `skipping CMS item "${cmName ?? cmId ?? '(unnamed)'}" — ` +
          'data-cm-id, data-cm-lat and data-cm-lng must all be set, with numeric coordinates',
      );
      return;
    }
    if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
      warnOnce(
        `range:${cmId}`,
        `skipping CMS item "${cmName ?? cmId}" — coordinates out of range ` +
          `(${latitude}, ${longitude}); latitude and longitude may be swapped`,
      );
      return;
    }
    if (seen.has(cmId)) return;
    seen.add(cmId);

    locations.push({
      id: cmId,
      name: cmName ?? '',
      category: item.dataset.cmCategory ?? '',
      city: item.dataset.cmCity ?? '',
      state: item.dataset.cmState ?? '',
      image: item.dataset.cmImage ?? '',
      latitude,
      longitude,
      url: item.dataset.cmUrl || undefined,
    });
  });

  return locations;
}
