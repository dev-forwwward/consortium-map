// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import L from 'leaflet';
import { RESIZE_SETTLE_MS, attachViewLimits } from './viewLimits';

const desktop = {
  matches: true,
  addEventListener: () => {},
  removeEventListener: () => {},
} as unknown as MediaQueryList;

let map: L.Map;
let size: L.Point;
let detach: () => void;

// jsdom has no 3D transforms, and without them Leaflet rounds every zoom to a whole level; browsers
// keep the fractional fit. Pretend, as a browser does. Zoom animation stays off: jsdom never ends it.
const browser = L.Browser as { any3d: boolean };
const any3d = browser.any3d;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  browser.any3d = true;
  document.body.innerHTML = '<div id="map"></div>';
  map = L.map('map', { zoomSnap: 0.25, zoomAnimation: false }).setView([39, -98], 3);
  size = L.point(1100, 700);
  // jsdom has no layout: the map's container size is whatever the test says.
  map.getSize = () => size.clone();
});

afterEach(() => {
  detach?.();
  map.remove();
  browser.any3d = any3d;
  vi.useRealTimers();
});

/** A run of resize events, one per frame, as during the expand slide. */
const slide = (to: number, frames = 10) => {
  const from = size.x;
  for (let i = 1; i <= frames; i++) {
    size = L.point(Math.round(from + ((to - from) * i) / frames), size.y);
    map.fire('resize');
    vi.advanceTimersByTime(16);
  }
};

describe('view limits', () => {
  it('fits the US on the first real measurement, at once and unanimated', () => {
    const setView = vi.spyOn(map, 'setView');
    detach = attachViewLimits(map, desktop);
    expect(setView).toHaveBeenCalledTimes(1);
    expect(setView.mock.calls[0][2]).toMatchObject({ animate: false });
    expect(map.getZoom()).toBeCloseTo(map.getMinZoom(), 5);
  });

  it('waits for a hidden map to get its size, then fits at once', () => {
    size = L.point(0, 0);
    const setView = vi.spyOn(map, 'setView');
    detach = attachViewLimits(map, desktop);
    expect(setView).not.toHaveBeenCalled();

    size = L.point(1100, 700);
    map.fire('resize');
    expect(setView).toHaveBeenCalledTimes(1);
    expect(setView.mock.calls[0][2]).toMatchObject({ animate: false });
  });

  it('holds the zoom through a run of resizes, then refits once, animated', () => {
    detach = attachViewLimits(map, desktop);
    const fitted = map.getMinZoom();
    const setView = vi.spyOn(map, 'setView');
    const setMinZoom = vi.spyOn(map, 'setMinZoom');

    slide(1700);
    // Re-fitting every frame switched tile levels mid-slide and blanked the basemap.
    expect(setView).not.toHaveBeenCalled();
    expect(setMinZoom).not.toHaveBeenCalled();

    vi.advanceTimersByTime(RESIZE_SETTLE_MS);
    expect(setView).toHaveBeenCalledTimes(1);
    expect(setView.mock.calls[0][2]).toMatchObject({ animate: true });
    expect(map.getMinZoom()).toBeGreaterThan(fitted); // wider map, the US fits closer in
  });

  it('a narrower map zooms out to its own fit (collapsing the expanded map)', () => {
    detach = attachViewLimits(map, desktop);
    slide(1700);
    vi.advanceTimersByTime(RESIZE_SETTLE_MS);
    const expanded = map.getZoom();

    slide(1100);
    vi.advanceTimersByTime(RESIZE_SETTLE_MS);
    // setView clamps to the current minZoom: the lower fit must not be held at the expanded one.
    expect(map.getMinZoom()).toBeLessThan(expanded);
    expect(map.getZoom()).toBeCloseTo(map.getMinZoom(), 5);
  });

  it('zoomed in, keeps the view inside the new limit, animated', () => {
    detach = attachViewLimits(map, desktop);
    map.setZoom(map.getMinZoom() + 2, { animate: false });
    const zoom = map.getZoom();
    const panInside = vi.spyOn(map, 'panInsideBounds');

    slide(600);
    expect(panInside).not.toHaveBeenCalled();

    vi.advanceTimersByTime(RESIZE_SETTLE_MS);
    expect(panInside).toHaveBeenCalledWith(expect.anything(), { animate: true });
    expect(map.getZoom()).toBeCloseTo(zoom, 5); // the user's zoom is kept
  });

  it('stops after detach', () => {
    detach = attachViewLimits(map, desktop);
    const setView = vi.spyOn(map, 'setView');
    detach();
    slide(1700);
    vi.advanceTimersByTime(RESIZE_SETTLE_MS);
    expect(setView).not.toHaveBeenCalled();
  });
});
