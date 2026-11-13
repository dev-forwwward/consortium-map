import { PAGED_CLASS } from '../lib/cmsSource';

export const DEFAULT_PAGE_SIZE = 12;
/**
 * On the card grid after a Show more click: the page CSS drops the filter
 * fade's nth-child stagger, which would hold every revealed card (13+) at the
 * longest delay. Cleared when the filter re-renders, so its stagger returns.
 */
export const REVEALING_CLASS = 'is-cm-revealing';

const ITEMS_SELECTOR = '.map-explorer_items';
const LIST_SELECTOR = '[data-cm-list]';
const FOCUSABLE = 'a[href], button, [tabindex]';

export interface ShowMore {
  /** Whether paging applies right now (desktop Portfolio). */
  sync(active: boolean): void;
  destroy(): void;
}

/**
 * Portfolio "Show more": the first `pageSize` cards show, and a button below
 * the grid reveals the next page. Cards past the limit get PAGED_CLASS, which
 * the page CSS hides in desktop Portfolio only; they stay in the DOM, so the
 * map still has every filtered project (see cmsSource's isFilteredOut).
 *
 * Finsweet's filter re-inserts the matching cards on every change, so a change
 * to the card list starts again from the first page. The button is created
 * here, with the site's `.button` class, so the page needs no Designer markup.
 */
export function attachShowMore(
  root: HTMLElement,
  { pageSize = DEFAULT_PAGE_SIZE }: { pageSize?: number } = {},
): ShowMore | null {
  const items = root.querySelector<HTMLElement>(ITEMS_SELECTOR);
  if (!items) return null;
  const anchor = items.closest<HTMLElement>(LIST_SELECTOR) ?? items;

  let limit = pageSize;
  let active = false;

  const wrap = document.createElement('div');
  wrap.className = 'cm-show-more';
  wrap.hidden = true;
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'button cm-show-more_button';
  button.textContent = 'Show more';
  wrap.append(button);
  anchor.after(wrap);

  const cards = () => Array.from(items.children) as HTMLElement[];

  const apply = () => {
    const all = cards();
    all.forEach((card, index) => {
      const paged = index >= limit;
      // Only touch what changes: every class mutation wakes the map's list observer.
      if (card.classList.contains(PAGED_CLASS) !== paged) card.classList.toggle(PAGED_CLASS, paged);
    });
    wrap.hidden = !active || all.length <= limit;
  };

  const onClick = () => {
    const firstNew = limit;
    const hadFocus = document.activeElement === button;
    limit += pageSize;
    items.classList.add(REVEALING_CLASS);
    apply();
    // The button vanishes once everything shows; don't drop keyboard focus on <body>.
    if (hadFocus && wrap.hidden) {
      cards()[firstNew]?.querySelector<HTMLElement>(FOCUSABLE)?.focus({ preventScroll: true });
    }
  };
  button.addEventListener('click', onClick);

  const observer = new MutationObserver(() => {
    limit = pageSize;
    items.classList.remove(REVEALING_CLASS);
    apply();
  });
  observer.observe(items, { childList: true });

  apply();

  return {
    sync(next) {
      active = next;
      apply();
    },
    destroy() {
      observer.disconnect();
      button.removeEventListener('click', onClick);
      wrap.remove();
      items.classList.remove(REVEALING_CLASS);
      cards().forEach((card) => card.classList.remove(PAGED_CLASS));
    },
  };
}
