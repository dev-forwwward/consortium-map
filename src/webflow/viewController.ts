import { SELECT_EVENT, findCmsItem } from '../lib/cmsSource';
import { attachSheetDrag } from './sheetDrag';
import { nextSnapOnTap } from './sheetSnap';
import { DEFAULT_STATE, applyClasses, syncControls, type ViewState } from './viewState';

export const DESKTOP_QUERY = '(min-width: 992px)';

const CONTROL_SELECTOR = '[data-cm-view], [data-cm-layout], [data-cm-expand]';
const HANDLE_SELECTOR = '[data-cm-sheet-handle]';
const SHEET_SELECTOR = '[data-cm-sheet]';
const DRAGGING_CLASS = 'is-sheet-dragging';
// Longer than the sheet's CSS transition, in case transitionend never fires.
const SHEET_SETTLE_FALLBACK_MS = 450;

export interface ViewControllerOptions {
  matchMedia?: (query: string) => MediaQueryList;
  prefersReducedMotion?: () => boolean;
}

export interface ViewController {
  getState(): ViewState;
  destroy(): void;
}

/**
 * Owns the Projects page view state (Map/Portfolio, grid/list, split/expanded,
 * mobile sheet position) and expresses it as combo classes on `root`
 * (`.map-explorer`). Controls are found by data attribute anywhere in the
 * document, since the Portfolio/Map pill sits outside the explorer. See
 * README → "View modes".
 */
export function initViewController(
  root: HTMLElement,
  options: ViewControllerOptions = {},
): ViewController {
  const matchMedia = options.matchMedia ?? ((query: string) => window.matchMedia(query));
  const prefersReducedMotion =
    options.prefersReducedMotion ??
    (() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  if (root.dataset.cmViewInit === 'true') {
    console.warn('initViewController: already initialised on this element; ignoring.');
    return { getState: () => ({ ...DEFAULT_STATE }), destroy() {} };
  }
  root.dataset.cmViewInit = 'true';
  const desktop = matchMedia(DESKTOP_QUERY);
  const sheet = root.querySelector<HTMLElement>(SHEET_SELECTOR);
  const handle = root.querySelector<HTMLElement>(HANDLE_SELECTOR);

  let state: ViewState = { ...DEFAULT_STATE };

  const render = () => {
    applyClasses(root, state, desktop.matches);
    syncControls(document, state, desktop.matches);
  };

  const update = (next: Partial<ViewState>) => {
    state = { ...state, ...next };
    render();
  };

  const activate = (control: Element) => {
    const view = control.getAttribute('data-cm-view');
    if (view === 'map' || view === 'portfolio') {
      if (view !== state.view) update({ view, mapSize: 'split' });
      return;
    }
    const layout = control.getAttribute('data-cm-layout');
    if (layout === 'grid' || layout === 'list') {
      if (layout !== state.layout) update({ layout });
      return;
    }
    if (control.hasAttribute('data-cm-expand')) {
      if (desktop.matches) {
        update({ mapSize: state.mapSize === 'expanded' ? 'split' : 'expanded' });
      } else {
        update({ sheet: 'peek' });
      }
    }
  };

  const onClick = (event: MouseEvent) => {
    const control = (event.target as Element | null)?.closest?.(CONTROL_SELECTOR);
    if (!control) return;
    // Link Blocks would otherwise jump to their href (usually "#").
    if (control instanceof HTMLAnchorElement) event.preventDefault();
    activate(control);
  };

  // Native <button>s already turn Enter/Space into a click; Webflow Divs and
  // Link Blocks carrying role="button" don't.
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    if (event.repeat) return;
    const target = event.target as Element | null;
    const handle = target?.closest?.(HANDLE_SELECTOR);
    if (handle) {
      if (desktop.matches) return;
      event.preventDefault();
      update({ sheet: nextSnapOnTap(state.sheet) });
      return;
    }
    const control = target?.closest?.(CONTROL_SELECTOR);
    if (!control || control instanceof HTMLButtonElement) return;
    event.preventDefault();
    activate(control);
  };

  const drag =
    sheet && handle
      ? attachSheetDrag({
          sheet,
          handle,
          isEnabled: () => !desktop.matches,
          getSnap: () => state.sheet,
          onSnap: (snap) => update({ sheet: snap }),
        })
      : null;

  const clearDrag = () => {
    drag?.cancel();
    if (!sheet) return;
    sheet.style.transform = '';
    sheet.classList.remove(DRAGGING_CLASS);
  };

  const onBreakpoint = () => {
    clearDrag();
    state = { ...DEFAULT_STATE, layout: state.layout };
    render();
  };

  const scrollToCard = (card: HTMLElement) => {
    const behavior = prefersReducedMotion() ? 'auto' : 'smooth';
    if (desktop.matches || !sheet) {
      card.scrollIntoView({ behavior, block: 'nearest' });
      return;
    }
    // On mobile scrollIntoView would also scroll `.map-explorer` (the sheet
    // overflows it), so drive the sheet's own scroller directly.
    const scroller = sheet.querySelector<HTMLElement>('.map-explorer_scroll') ?? sheet;
    const top =
      card.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop;
    scroller.scrollTo({ top, behavior });
  };

  // Two frames: the first applies the class change, the second runs after
  // layout, so the card has its final position.
  const afterLayout = (callback: () => void) => {
    requestAnimationFrame(() => requestAnimationFrame(callback));
  };

  const afterSheetSettles = (callback: () => void) => {
    if (!sheet || prefersReducedMotion()) {
      requestAnimationFrame(callback);
      return;
    }
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      sheet.removeEventListener('transitionend', onEnd);
      clearTimeout(timer);
      callback();
    };
    const onEnd = (event: TransitionEvent) => {
      if (event.target === sheet && event.propertyName === 'transform') finish();
    };
    sheet.addEventListener('transitionend', onEnd);
    const timer = setTimeout(finish, SHEET_SETTLE_FALLBACK_MS);
  };

  const onSelect = (event: Event) => {
    const id = (event as CustomEvent<{ id?: string }>).detail?.id;
    const card = id ? findCmsItem(id) : null;
    if (!card) return;

    if (desktop.matches && state.view === 'map' && state.mapSize === 'expanded') {
      update({ mapSize: 'split' });
      afterLayout(() => scrollToCard(card));
    } else if (!desktop.matches && state.sheet === 'peek') {
      update({ sheet: 'half' });
      afterSheetSettles(() => scrollToCard(card));
    } else {
      scrollToCard(card);
    }
  };

  document.addEventListener('click', onClick);
  document.addEventListener(SELECT_EVENT, onSelect);
  document.addEventListener('keydown', onKeyDown);
  desktop.addEventListener('change', onBreakpoint);
  render();

  return {
    getState: () => ({ ...state }),
    destroy() {
      document.removeEventListener('click', onClick);
      document.removeEventListener(SELECT_EVENT, onSelect);
      document.removeEventListener('keydown', onKeyDown);
      desktop.removeEventListener('change', onBreakpoint);
      drag?.destroy();
      delete root.dataset.cmViewInit;
    },
  };
}
