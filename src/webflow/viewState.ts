import type { SheetSnap } from './sheetSnap';

export type View = 'map' | 'portfolio';
export type Layout = 'grid' | 'list';
export type MapSize = 'split' | 'expanded';

export interface ViewState {
  view: View;
  layout: Layout;
  mapSize: MapSize;
  sheet: SheetSnap;
}

export const DEFAULT_STATE: ViewState = {
  view: 'map',
  layout: 'grid',
  mapSize: 'split',
  sheet: 'peek',
};

export const STATE_CLASSES = [
  'is-portfolio',
  'is-list',
  'is-map-expanded',
  'is-sheet-peek',
  'is-sheet-half',
  'is-sheet-full',
] as const;

const ACTIVE_CLASS = 'is-active';

/**
 * The combo classes `.map-explorer` should carry for a state. Desktop shows
 * view and map size; the split-view list is always a grid, so `is-list`
 * only appears in Portfolio. Mobile shows the sheet position and layout.
 */
export function classesFor(state: ViewState, isDesktop: boolean): string[] {
  if (isDesktop) {
    if (state.view === 'portfolio') {
      return state.layout === 'list' ? ['is-portfolio', 'is-list'] : ['is-portfolio'];
    }
    return state.mapSize === 'expanded' ? ['is-map-expanded'] : [];
  }
  const classes = [`is-sheet-${state.sheet}`];
  if (state.layout === 'list') classes.push('is-list');
  return classes;
}

export function applyClasses(root: HTMLElement, state: ViewState, isDesktop: boolean): void {
  root.classList.remove(...STATE_CLASSES);
  root.classList.add(...classesFor(state, isDesktop));
}

function setPressed(el: Element, pressed: boolean) {
  el.classList.toggle(ACTIVE_CLASS, pressed);
  el.setAttribute('aria-pressed', String(pressed));
}

/** Reflects the state on every control, wherever it sits on the page. */
export function syncControls(doc: ParentNode, state: ViewState, isDesktop: boolean): void {
  doc.querySelectorAll('[data-cm-view]').forEach((el) => {
    setPressed(el, el.getAttribute('data-cm-view') === state.view);
  });
  doc.querySelectorAll('[data-cm-layout]').forEach((el) => {
    setPressed(el, el.getAttribute('data-cm-layout') === state.layout);
  });
  doc.querySelectorAll('[data-cm-expand]').forEach((el) => {
    if (isDesktop) {
      const expanded = state.mapSize === 'expanded';
      setPressed(el, expanded);
      el.setAttribute('aria-label', expanded ? 'Show project list' : 'Expand map');
    } else {
      el.classList.remove(ACTIVE_CLASS);
      el.removeAttribute('aria-pressed');
      el.setAttribute('aria-label', 'Show full map');
    }
  });
}
