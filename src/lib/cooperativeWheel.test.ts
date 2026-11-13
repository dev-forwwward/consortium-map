// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import L from 'leaflet';
import { enableCooperativeWheelZoom, wheelZoomHint } from './cooperativeWheel';

function wheel(target: Element, init: WheelEventInit = {}) {
  const event = new WheelEvent('wheel', { deltaY: 100, bubbles: true, cancelable: true, composed: true, ...init });
  target.dispatchEvent(event);
  return event;
}

describe('cooperative wheel zoom', () => {
  let container: HTMLDivElement;
  let map: L.Map;

  beforeEach(() => {
    vi.useFakeTimers();
    container = document.createElement('div');
    document.body.appendChild(container);
    map = L.map(container, { zoomAnimation: false, fadeAnimation: false }).setView([36, -86], 6);
  });

  afterEach(() => {
    map.remove();
    container.remove();
    vi.useRealTimers();
  });

  it('leaves a plain wheel to the page: not prevented, still bubbles, map stays put', () => {
    const onPlain = vi.fn();
    const reachedPage = vi.fn();
    document.addEventListener('wheel', reachedPage);
    enableCooperativeWheelZoom(map, { onPlainWheel: onPlain });

    const event = wheel(map.getPane('tilePane')!);
    vi.runAllTimers();

    expect(event.defaultPrevented).toBe(false);
    expect(reachedPage).toHaveBeenCalledTimes(1);
    expect(onPlain).toHaveBeenCalledTimes(1);
    expect(map.getZoom()).toBe(6);
    document.removeEventListener('wheel', reachedPage);
  });

  it.each([
    ['Ctrl', { ctrlKey: true }],
    ['⌘', { metaKey: true }],
  ])('zooms on %s + wheel and keeps it from the page and the browser zoom', (_key, modifier) => {
    const onZoom = vi.fn();
    enableCooperativeWheelZoom(map, { onZoomWheel: onZoom });

    const event = wheel(map.getPane('tilePane')!, modifier);
    vi.runAllTimers();

    expect(event.defaultPrevented).toBe(true);
    expect(onZoom).toHaveBeenCalledTimes(1);
    expect(map.getZoom()).toBeLessThan(6); // wheel down = zoom out
  });

  it('cleanup restores Leaflet’s plain wheel zoom', () => {
    const disable = enableCooperativeWheelZoom(map);
    disable();

    const event = wheel(map.getPane('tilePane')!);
    vi.runAllTimers();

    expect(event.defaultPrevented).toBe(true);
    expect(map.getZoom()).toBeLessThan(6);
  });
});

describe('wheelZoomHint', () => {
  it('names ⌘ on Apple platforms and Ctrl elsewhere', () => {
    expect(wheelZoomHint('MacIntel')).toBe('Use ⌘ + scroll to zoom the map');
    expect(wheelZoomHint('macOS')).toBe('Use ⌘ + scroll to zoom the map');
    expect(wheelZoomHint('Win32')).toBe('Use Ctrl + scroll to zoom the map');
    expect(wheelZoomHint('')).toBe('Use Ctrl + scroll to zoom the map');
  });
});
