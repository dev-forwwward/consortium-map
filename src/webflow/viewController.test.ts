// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DESKTOP_QUERY, initViewController, type ViewController } from './viewController';

function fakeMatchMedia(initial: boolean) {
  const listeners = new Set<(event: MediaQueryListEvent) => void>();
  const mql = {
    matches: initial,
    media: DESKTOP_QUERY,
    addEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) =>
      listeners.add(listener),
    removeEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) =>
      listeners.delete(listener),
  };
  return {
    matchMedia: () => mql as unknown as MediaQueryList,
    set(matches: boolean) {
      mql.matches = matches;
      listeners.forEach((listener) => listener({ matches } as MediaQueryListEvent));
    },
  };
}

function mountDom(): HTMLElement {
  document.body.innerHTML = `
    <div class="map-view-toggle">
      <button data-cm-view="portfolio">Portfolio</button>
      <button data-cm-view="map">Map view</button>
    </div>
    <div class="map-explorer">
      <div class="map-explorer_list" data-cm-sheet>
        <div class="map-explorer_sheet-handle" data-cm-sheet-handle role="button" tabindex="0"></div>
        <div class="layout-toggle">
          <button data-cm-layout="grid"></button>
          <button data-cm-layout="list"></button>
        </div>
        <div data-cm-list>
          <div data-cm-item><div data-cm-field="id">alpha</div></div>
        </div>
      </div>
      <div class="map-explorer_map"><button data-cm-expand></button></div>
    </div>`;
  return document.querySelector<HTMLElement>('.map-explorer')!;
}

const click = (selector: string) =>
  document.querySelector<HTMLElement>(selector)!.dispatchEvent(
    new MouseEvent('click', { bubbles: true }),
  );
const key = (selector: string, keyName: string) =>
  document.querySelector<HTMLElement>(selector)!.dispatchEvent(
    new KeyboardEvent('keydown', { key: keyName, bubbles: true, cancelable: true }),
  );

let controller: ViewController;
afterEach(() => controller?.destroy());

describe('desktop', () => {
  let root: HTMLElement;
  beforeEach(() => {
    root = mountDom();
    controller = initViewController(root, { matchMedia: fakeMatchMedia(true).matchMedia });
  });

  it('starts in map view, split, grid', () => {
    expect(root.className).toBe('map-explorer');
    expect(document.querySelector('[data-cm-view="map"]')!.getAttribute('aria-pressed')).toBe('true');
    expect(document.querySelector('[data-cm-layout="grid"]')!.getAttribute('aria-pressed')).toBe('true');
  });

  it('switches to portfolio and to list', () => {
    click('[data-cm-view="portfolio"]');
    expect(root.classList.contains('is-portfolio')).toBe(true);
    click('[data-cm-layout="list"]');
    expect(root.classList.contains('is-list')).toBe(true);
    expect(controller.getState()).toMatchObject({ view: 'portfolio', layout: 'list' });
  });

  it('drops is-list in map view but remembers the layout', () => {
    click('[data-cm-view="portfolio"]');
    click('[data-cm-layout="list"]');
    click('[data-cm-view="map"]');
    expect(root.className).toBe('map-explorer');
    expect(controller.getState().layout).toBe('list');
  });

  it('toggles expanded with the expand button', () => {
    click('[data-cm-expand]');
    expect(root.classList.contains('is-map-expanded')).toBe(true);
    click('[data-cm-expand]');
    expect(root.classList.contains('is-map-expanded')).toBe(false);
  });

  it('returns to split when coming back from portfolio', () => {
    click('[data-cm-expand]');
    click('[data-cm-view="portfolio"]');
    click('[data-cm-view="map"]');
    expect(controller.getState().mapSize).toBe('split');
    expect(root.classList.contains('is-map-expanded')).toBe(false);
  });

  it('ignores a click on the already active control', () => {
    click('[data-cm-view="map"]');
    expect(root.className).toBe('map-explorer');
  });

  it('stops listening after destroy', () => {
    controller.destroy();
    click('[data-cm-view="portfolio"]');
    expect(root.classList.contains('is-portfolio')).toBe(false);
  });
});

describe('mobile', () => {
  let root: HTMLElement;
  beforeEach(() => {
    root = mountDom();
    controller = initViewController(root, { matchMedia: fakeMatchMedia(false).matchMedia });
  });

  it('starts at peek', () => {
    expect(root.classList.contains('is-sheet-peek')).toBe(true);
  });

  it('cycles the sheet with Enter and Space on the handle', () => {
    key('[data-cm-sheet-handle]', 'Enter');
    expect(root.classList.contains('is-sheet-half')).toBe(true);
    key('[data-cm-sheet-handle]', ' ');
    expect(root.classList.contains('is-sheet-full')).toBe(true);
    key('[data-cm-sheet-handle]', 'Enter');
    expect(root.classList.contains('is-sheet-peek')).toBe(true);
  });

  it('snaps back to peek with the expand button', () => {
    key('[data-cm-sheet-handle]', 'Enter');
    click('[data-cm-expand]');
    expect(root.classList.contains('is-sheet-peek')).toBe(true);
  });

  it('applies the layout toggle in the sheet', () => {
    click('[data-cm-layout="list"]');
    expect(root.className).toBe('map-explorer is-sheet-peek is-list');
  });
});

describe('breakpoint change', () => {
  it('resets and clears inline transform', () => {
    const root = mountDom();
    const media = fakeMatchMedia(false);
    controller = initViewController(root, { matchMedia: media.matchMedia });
    const sheet = document.querySelector<HTMLElement>('[data-cm-sheet]')!;

    click('[data-cm-layout="list"]');
    key('[data-cm-sheet-handle]', 'Enter');
    sheet.style.transform = 'translateY(123px)';
    sheet.classList.add('is-sheet-dragging');

    media.set(true);
    expect(root.className).toBe('map-explorer');
    expect(sheet.style.transform).toBe('');
    expect(sheet.classList.contains('is-sheet-dragging')).toBe(false);
    expect(controller.getState()).toMatchObject({ view: 'map', mapSize: 'split', sheet: 'peek', layout: 'list' });

    media.set(false);
    expect(root.className).toBe('map-explorer is-sheet-peek is-list');
  });
});
