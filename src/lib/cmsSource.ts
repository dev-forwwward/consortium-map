import type { Location } from '../types/location';

/**
 * Attribute contract between the Webflow page and the embed. The Collection
 * List wrapper carries LIST_SELECTOR; each Collection Item carries
 * ITEM_SELECTOR plus the data-cm-* fields below, bound to CMS fields in the
 * Designer. See README → "Webflow CMS setup".
 */
export const LIST_SELECTOR = '[data-cm-list]';
export const ITEM_SELECTOR = '[data-cm-item]';

/**
 * One map pin of a card that has several (e.g. a franchise's buildings): a
 * nested Collection List in the card's Collection Item (beside the card's
 * Link Block, since Webflow won't put a Collection List inside a link) renders
 * one POINT_SELECTOR element
 * per building, its values in `data-cm-point-field="<key>"` children (lat,
 * lng, location, id). A separate attribute from `data-cm-field` so the card's
 * own fields never pick up a nested value. A card with at least one valid
 * point gets one pin per point instead of its own.
 */
export const POINT_SELECTOR = '[data-cm-point]';

export const ACTIVE_CLASS = 'is-cm-active';
export const HOVER_CLASS = 'is-cm-hover';

/**
 * Set by the page's Show more (src/webflow/showMore.ts) on cards past the
 * current page. Portfolio CSS hides them, but they are still in the filter's
 * results, so the map keeps their markers.
 */
export const PAGED_CLASS = 'is-cm-paged';

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
 * and that must not empty the map. Nor does Show more's paging (PAGED_CLASS):
 * a paged-out card is display:none for the grid, not for the map.
 */
function isFilteredOut(item: HTMLElement, list: HTMLElement): boolean {
  for (let node: HTMLElement | null = item; node && node !== list; node = node.parentElement) {
    if (node.hidden) return true;
    if (node.classList.contains(PAGED_CLASS)) continue;
    if (getComputedStyle(node).display === 'none') return true;
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

/**
 * "Brentwood, TN" or "Milford MI" → { city, state }. Without a comma, a
 * trailing two-letter uppercase word is the state; otherwise it's all city.
 */
export function splitLocation(location: string): { city: string; state: string } {
  const comma = location.lastIndexOf(',');
  if (comma !== -1) {
    return { city: location.slice(0, comma).trim(), state: location.slice(comma + 1).trim() };
  }
  const match = /^(.*\S)\s+([A-Z]{2})$/.exec(location.trim());
  if (match) return { city: match[1], state: match[2] };
  return { city: location.trim(), state: '' };
}

function readPointField(point: HTMLElement, key: string): string | undefined {
  const attr = point.getAttribute(`data-cm-point-${key}`);
  if (attr != null && attr !== '') return attr;
  const el = point.querySelector<HTMLElement>(`[data-cm-point-field="${key}"]`);
  return el?.textContent?.trim() || undefined;
}

function validCoordinates(latitude: number | null, longitude: number | null): boolean {
  return (
    latitude != null && longitude != null && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180
  );
}

/**
 * The card's points that have usable coordinates. A point with a bad or
 * missing coordinate is skipped with a warning; the others still show.
 */
function readPoints(item: HTMLElement, cardId: string, cardName: string | undefined) {
  const points: { id: string; latitude: number; longitude: number; location?: string }[] = [];
  const seen = new Set<string>();
  // The card's own Collection Item: the card is never inside a nested list,
  // so the nearest .w-dyn-item is the right one.
  const scope = item.closest<HTMLElement>('.w-dyn-item') ?? item;
  scope.querySelectorAll<HTMLElement>(POINT_SELECTOR).forEach((point, index) => {
    const id = readPointField(point, 'id') ?? String(index);
    const latitude = parseCoordinate(readPointField(point, 'lat'));
    const longitude = parseCoordinate(readPointField(point, 'lng'));
    if (latitude == null && longitude == null) return; // not placed yet: silently off the map
    if (latitude == null || longitude == null || !validCoordinates(latitude, longitude)) {
      warnOnce(
        `point:${cardId}:${id}`,
        `skipping a pin of "${cardName ?? cardId}" (${id}) — ` +
          `invalid coordinates (${latitude}, ${longitude})`,
      );
      return;
    }
    if (seen.has(id)) return;
    seen.add(id);
    points.push({ id, latitude, longitude, location: readPointField(point, 'location') });
  });
  return points;
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

    const points = id ? readPoints(item, id, name) : [];
    if (id && points.length > 0) {
      if (seen.has(id)) return;
      seen.add(id);
      const card = readCard(item, id, name);
      for (const point of points) {
        const place = point.location ? splitLocation(point.location) : null;
        locations.push({
          ...card,
          id: `${id}::${point.id}`,
          cardId: id,
          city: place ? place.city : card.city,
          state: place ? place.state : card.state,
          latitude: point.latitude,
          longitude: point.longitude,
        });
      }
      return;
    }

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

    locations.push({ ...readCard(item, id, name), latitude, longitude });
  });

  return locations;
}

/** A card's fields other than its coordinates. */
function readCard(item: HTMLElement, id: string, name: string | undefined) {
  const location = readField(item, 'location');
  const { city, state } = location
    ? splitLocation(location)
    : { city: readField(item, 'city') ?? '', state: readField(item, 'state') ?? '' };
  return {
    id,
    name: name ?? '',
    category: readField(item, 'category') ?? '',
    city,
    state,
    image: readField(item, 'image') ?? '',
    url: readField(item, 'url'),
  };
}
