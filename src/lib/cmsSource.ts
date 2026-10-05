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

/**
 * Dispatched on `document` by the embed when a marker is clicked, with
 * `detail: { id }`. The page's view controller reveals and scrolls to the
 * matching card.
 */
export const SELECT_EVENT = 'cm:select';

export function findCmsList(root: ParentNode = document): HTMLElement | null {
  return root.querySelector<HTMLElement>(LIST_SELECTOR);
}

/** An item's id, from `data-cm-id` or a `data-cm-field="id"` child. */
export function getCmsItemId(item: HTMLElement): string | undefined {
  return readField(item, 'id');
}

export function findCmsItem(id: string, root: ParentNode = document): HTMLElement | null {
  for (const item of root.querySelectorAll<HTMLElement>(ITEM_SELECTOR)) {
    if (getCmsItemId(item) === id) return item;
  }
  return null;
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
 * Reads one field from an item. A `data-cm-<key>` attribute on the item wins;
 * otherwise a descendant tagged `data-cm-field="<key>"` supplies it — its
 * `src` for an image, its text otherwise. The descendant form exists because
 * Webflow can bind CMS fields into an element's text but not into a regular
 * Div's attributes, so bound (optionally hidden) text elements are the
 * editor-friendly way to carry values like coordinates.
 */
function readField(item: HTMLElement, key: string): string | undefined {
  const attr = item.getAttribute(`data-cm-${key}`);
  if (attr != null && attr !== '') return attr;
  const el = item.querySelector<HTMLElement>(`[data-cm-field="${key}"]`);
  if (!el) return undefined;
  const value = el instanceof HTMLImageElement ? el.currentSrc || el.src : el.textContent;
  return value?.trim() || undefined;
}

/** "Brentwood, TN" → { city: "Brentwood", state: "TN" }; no comma → all city. */
function splitLocation(location: string): { city: string; state: string } {
  const comma = location.lastIndexOf(',');
  if (comma === -1) return { city: location.trim(), state: '' };
  return { city: location.slice(0, comma).trim(), state: location.slice(comma + 1).trim() };
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

    const id = readField(item, 'id');
    const name = readField(item, 'name');
    const latitude = parseCoordinate(readField(item, 'lat'));
    const longitude = parseCoordinate(readField(item, 'lng'));

    if (!id || latitude == null || longitude == null) {
      warnOnce(
        `missing:${id ?? name}`,
        `skipping CMS item "${name ?? id ?? '(unnamed)'}" — ` +
          'id, lat and lng must all be set, with numeric coordinates',
      );
      return;
    }
    if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
      warnOnce(
        `range:${id}`,
        `skipping CMS item "${name ?? id}" — coordinates out of range ` +
          `(${latitude}, ${longitude}); latitude and longitude may be swapped`,
      );
      return;
    }
    if (seen.has(id)) return;
    seen.add(id);

    const location = readField(item, 'location');
    const { city, state } = location
      ? splitLocation(location)
      : { city: readField(item, 'city') ?? '', state: readField(item, 'state') ?? '' };

    locations.push({
      id,
      name: name ?? '',
      category: readField(item, 'category') ?? '',
      city,
      state,
      image: readField(item, 'image') ?? '',
      latitude,
      longitude,
      url: readField(item, 'url'),
    });
  });

  return locations;
}
