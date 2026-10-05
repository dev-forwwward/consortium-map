// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SELECT_EVENT } from '../lib/cmsSource';
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

describe('cm:select', () => {
  let scrollSpy: ReturnType<typeof vi.fn>;
  let scrollToSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers({
      toFake: ['setTimeout', 'clearTimeout', 'requestAnimationFrame', 'cancelAnimationFrame'],
    });
    scrollSpy = vi.fn();
    Element.prototype.scrollIntoView = scrollSpy as unknown as Element['scrollIntoView'];
    scrollToSpy = vi.fn();
    Element.prototype.scrollTo = scrollToSpy as unknown as Element['scrollTo'];
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const select = (id: string) =>
    document.dispatchEvent(new CustomEvent(SELECT_EVENT, { detail: { id } }));

  it('returns to split and scrolls to the card when expanded', () => {
    const root = mountDom();
    controller = initViewController(root, {
      matchMedia: fakeMatchMedia(true).matchMedia,
      prefersReducedMotion: () => false,
    });
    click('[data-cm-expand]');

    select('alpha');
    expect(root.classList.contains('is-map-expanded')).toBe(false);
    expect(scrollSpy).not.toHaveBeenCalled();

    vi.advanceTimersByTime(50);
    expect(scrollSpy).toHaveBeenCalledTimes(1);
    expect(scrollSpy).toHaveBeenCalledWith({ behavior: 'smooth', block: 'nearest' });
  });

  it('scrolls straight away in split view', () => {
    const root = mountDom();
    controller = initViewController(root, {
      matchMedia: fakeMatchMedia(true).matchMedia,
      prefersReducedMotion: () => true,
    });
    select('alpha');
    expect(scrollSpy).toHaveBeenCalledWith({ behavior: 'auto', block: 'nearest' });
  });

  it('opens the sheet to half on mobile, then scrolls after the transition', () => {
    const root = mountDom();
    controller = initViewController(root, {
      matchMedia: fakeMatchMedia(false).matchMedia,
      prefersReducedMotion: () => false,
    });
    const sheet = document.querySelector<HTMLElement>('[data-cm-sheet]')!;

    select('alpha');
    expect(root.classList.contains('is-sheet-half')).toBe(true);
    expect(scrollSpy).not.toHaveBeenCalled();

    const end = new Event('transitionend', { bubbles: true }) as TransitionEvent;
    Object.defineProperty(end, 'propertyName', { value: 'transform' });
    sheet.dispatchEvent(end);
    expect(scrollToSpy).toHaveBeenCalledTimes(1);
    expect(scrollToSpy).toHaveBeenCalledWith({ top: expect.any(Number), behavior: 'smooth' });
    expect(scrollSpy).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1000);
    expect(scrollToSpy).toHaveBeenCalledTimes(1);
  });

  it('falls back when transitionend never fires', () => {
    const root = mountDom();
    controller = initViewController(root, {
      matchMedia: fakeMatchMedia(false).matchMedia,
      prefersReducedMotion: () => false,
    });
    select('alpha');
    vi.advanceTimersByTime(449);
    expect(scrollToSpy).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(scrollToSpy).toHaveBeenCalledTimes(1);
    expect(scrollSpy).not.toHaveBeenCalled();
  });

  it('keeps the sheet where it is when already open', () => {
    const root = mountDom();
    controller = initViewController(root, {
      matchMedia: fakeMatchMedia(false).matchMedia,
      prefersReducedMotion: () => false,
    });
    key('[data-cm-sheet-handle]', 'Enter');
    key('[data-cm-sheet-handle]', 'Enter');
    select('alpha');
    expect(root.classList.contains('is-sheet-full')).toBe(true);
    expect(scrollToSpy).toHaveBeenCalledTimes(1);
    expect(scrollSpy).not.toHaveBeenCalled();
  });

  it('scrolls the sheet scroller by the card offset, not the explorer', () => {
    const root = mountDom();
    const sheet = document.querySelector<HTMLElement>('[data-cm-sheet]')!;
    const scroller = document.createElement('div');
    scroller.className = 'map-explorer_scroll';
    while (sheet.childNodes.length) scroller.appendChild(sheet.firstChild!);
    sheet.appendChild(scroller);
    scroller.scrollTop = 40;
    const card = document.querySelector<HTMLElement>('[data-cm-item]')!;
    scroller.getBoundingClientRect = () => ({ top: 100 }) as DOMRect;
    card.getBoundingClientRect = () => ({ top: 260 }) as DOMRect;
    controller = initViewController(root, {
      matchMedia: fakeMatchMedia(false).matchMedia,
      prefersReducedMotion: () => true,
    });
    key('[data-cm-sheet-handle]', 'Enter');
    select('alpha');
    expect(scrollToSpy).toHaveBeenCalledWith({ top: 200, behavior: 'auto' });
    expect(scrollSpy).not.toHaveBeenCalled();
  });

  it('ignores unknown ids', () => {
    const root = mountDom();
    controller = initViewController(root, { matchMedia: fakeMatchMedia(true).matchMedia });
    click('[data-cm-expand]');
    expect(() => select('nope')).not.toThrow();
    expect(root.classList.contains('is-map-expanded')).toBe(true);
    vi.advanceTimersByTime(1000);
    expect(scrollSpy).not.toHaveBeenCalled();
  });

  it('stops listening after destroy', () => {
    const root = mountDom();
    controller = initViewController(root, { matchMedia: fakeMatchMedia(true).matchMedia });
    controller.destroy();
    select('alpha');
    vi.advanceTimersByTime(1000);
    expect(scrollSpy).not.toHaveBeenCalled();
  });
});

describe('keyboard on non-button controls', () => {
  const press = (el: Element, keyName: string) => {
    const event = new KeyboardEvent('keydown', { key: keyName, bubbles: true, cancelable: true });
    el.dispatchEvent(event);
    return event;
  };

  it.each(['Enter', ' '])('activates div[role=button] controls with %j', (keyName) => {
    const root = mountDom();
    document.body.insertAdjacentHTML(
      'beforeend',
      `<div role="button" tabindex="0" id="v" data-cm-view="portfolio"></div>
       <div role="button" tabindex="0" id="l" data-cm-layout="list"></div>
       <div role="button" tabindex="0" id="e" data-cm-expand></div>`,
    );
    controller = initViewController(root, { matchMedia: fakeMatchMedia(true).matchMedia });
    expect(press(document.getElementById('v')!, keyName).defaultPrevented).toBe(true);
    expect(controller.getState().view).toBe('portfolio');
    expect(press(document.getElementById('l')!, keyName).defaultPrevented).toBe(true);
    expect(controller.getState().layout).toBe('list');
    controller.destroy();
    controller = initViewController(root, { matchMedia: fakeMatchMedia(true).matchMedia });
    expect(press(document.getElementById('e')!, keyName).defaultPrevented).toBe(true);
    expect(controller.getState().mapSize).toBe('expanded');
  });

  it('leaves a native <button> to its own click', () => {
    const root = mountDom();
    controller = initViewController(root, { matchMedia: fakeMatchMedia(true).matchMedia });
    const event = press(document.querySelector('button[data-cm-expand]')!, 'Enter');
    expect(event.defaultPrevented).toBe(false);
    expect(controller.getState().mapSize).toBe('split');
  });

  it('ignores repeated keydown on the handle', () => {
    const root = mountDom();
    controller = initViewController(root, { matchMedia: fakeMatchMedia(false).matchMedia });
    const handle = document.querySelector('[data-cm-sheet-handle]')!;
    handle.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', repeat: true, bubbles: true, cancelable: true }),
    );
    expect(controller.getState().sheet).toBe('peek');
  });

  it('does not change the sheet from the handle on desktop', () => {
    const root = mountDom();
    controller = initViewController(root, { matchMedia: fakeMatchMedia(true).matchMedia });
    const event = press(document.querySelector('[data-cm-sheet-handle]')!, 'Enter');
    expect(event.defaultPrevented).toBe(false);
    expect(controller.getState().sheet).toBe('peek');
    expect(root.className).toBe('map-explorer');
  });
});

describe('link controls', () => {
  it('prevents the jump to # on <a> controls', () => {
    const root = mountDom();
    document.body.insertAdjacentHTML('beforeend', '<a href="#" id="a" data-cm-view="portfolio">P</a>');
    controller = initViewController(root, { matchMedia: fakeMatchMedia(true).matchMedia });
    const event = new MouseEvent('click', { bubbles: true, cancelable: true });
    document.getElementById('a')!.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(controller.getState().view).toBe('portfolio');
  });
});

describe('Lenis prevent', () => {
  const mount = () => {
    const root = mountDom();
    const list = root.querySelector<HTMLElement>('.map-explorer_list')!;
    list.insertAdjacentHTML('beforeend', '<div class="map-explorer_scroll"></div>');
    return { root, list, scroll: root.querySelector<HTMLElement>('.map-explorer_scroll')! };
  };
  const has = (el: HTMLElement) => el.hasAttribute('data-lenis-prevent');
  const media = () => fakeMatchMedia(false).matchMedia;

  it('marks both scrollers on init and removes them on destroy', () => {
    const { root, list, scroll } = mount();
    controller = initViewController(root, { matchMedia: media() });
    expect(has(list)).toBe(true);
    expect(has(scroll)).toBe(true);
    controller.destroy();
    expect(has(list)).toBe(false);
    expect(has(scroll)).toBe(false);
  });

  it('removes only what it added', () => {
    const { root, list, scroll } = mount();
    list.setAttribute('data-lenis-prevent', '');
    controller = initViewController(root, { matchMedia: media() });
    controller.destroy();
    expect(has(list)).toBe(true);
    expect(has(scroll)).toBe(false);
  });

  it('sets the attribute again after init, destroy, init', () => {
    const { root, list, scroll } = mount();
    initViewController(root, { matchMedia: media() }).destroy();
    controller = initViewController(root, { matchMedia: media() });
    expect(has(list)).toBe(true);
    expect(has(scroll)).toBe(true);
    controller.destroy();
    expect(has(list)).toBe(false);
    expect(has(scroll)).toBe(false);
  });
});

describe('double init', () => {
  it('returns a no-op controller the second time and does not double-toggle', () => {
    const root = mountDom();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const media = fakeMatchMedia(true).matchMedia;
    controller = initViewController(root, { matchMedia: media });
    const second = initViewController(root, { matchMedia: media });
    click('[data-cm-expand]');
    expect(root.classList.contains('is-map-expanded')).toBe(true);
    expect(warn).toHaveBeenCalledTimes(1);
    second.destroy();
    click('[data-cm-expand]');
    expect(root.classList.contains('is-map-expanded')).toBe(false);
    controller.destroy();
    expect(root.dataset.cmViewInit).toBeUndefined();
    warn.mockRestore();
  });
});
