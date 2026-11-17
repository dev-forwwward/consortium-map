// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ENTER_ATTR,
  EXIT_MS,
  LEAVING_CLASS,
  SCROLL_IDLE_MS,
  SCROLL_SETTLE_CAP_MS,
  createViewSwitch,
  type ViewSwitch,
} from './viewSwitch';

const scrollEnd = () => window.dispatchEvent(new Event('scrollend'));
const setScrollY = (y: number) => Object.defineProperty(window, 'scrollY', { value: y, configurable: true });
/** One frame of the glide: the page is at `y` and a scroll event fires. */
const scrollFrame = (y: number) => {
  setScrollY(y);
  window.dispatchEvent(new Event('scroll'));
};

let root: HTMLElement;
let viewSwitch: ViewSwitch;
let scrollTo: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  document.body.innerHTML = '<div class="map-explorer"></div>';
  root = document.querySelector<HTMLElement>('.map-explorer')!;
  viewSwitch = createViewSwitch(root);
});

afterEach(() => {
  viewSwitch.destroy();
  setScrollY(0);
  scrollTo.mockRestore();
  vi.useRealTimers();
});

describe('viewSwitch', () => {
  it('fades out, then applies and marks the enter at EXIT_MS', () => {
    const apply = vi.fn();
    viewSwitch.start(apply);
    expect(root.classList.contains(LEAVING_CLASS)).toBe(true);
    expect(viewSwitch.pending).toBe(true);
    expect(apply).not.toHaveBeenCalled();

    vi.advanceTimersByTime(EXIT_MS - 1);
    expect(apply).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(apply).toHaveBeenCalledTimes(1);
    expect(root.classList.contains(LEAVING_CLASS)).toBe(false);
    expect(root.getAttribute(ENTER_ATTR)).toBe('a');
    expect(viewSwitch.pending).toBe(false);
  });

  it('alternates the enter marker a, b, a', () => {
    const marks: (string | null)[] = [];
    for (let i = 0; i < 3; i++) {
      viewSwitch.start(() => {});
      vi.advanceTimersByTime(EXIT_MS);
      marks.push(root.getAttribute(ENTER_ATTR));
    }
    expect(marks).toEqual(['a', 'b', 'a']);
  });

  it('latest apply wins while pending', () => {
    const first = vi.fn();
    const second = vi.fn();
    viewSwitch.start(first);
    vi.advanceTimersByTime(50);
    viewSwitch.start(second);
    vi.advanceTimersByTime(EXIT_MS - 50);
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('cancel drops the swap', () => {
    const apply = vi.fn();
    viewSwitch.start(apply);
    vi.advanceTimersByTime(50);
    viewSwitch.cancel();
    expect(root.classList.contains(LEAVING_CLASS)).toBe(false);
    expect(viewSwitch.pending).toBe(false);

    vi.advanceTimersByTime(1000);
    expect(apply).not.toHaveBeenCalled();
    expect(root.getAttribute(ENTER_ATTR)).toBeNull();
  });

  it('waits for the glide to reach the top', () => {
    const apply = vi.fn();
    viewSwitch.start(apply, { scrollToTop: true });
    expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' });

    for (const y of [900, 700, 500, 300]) {
      vi.advanceTimersByTime(50);
      scrollFrame(y);
    }
    expect(apply).not.toHaveBeenCalled();

    vi.advanceTimersByTime(50);
    scrollFrame(0);
    expect(apply).toHaveBeenCalledTimes(1);
  });

  it('a glide longer than the old 800ms cap still swaps at the top', () => {
    const apply = vi.fn();
    viewSwitch.start(apply, { scrollToTop: true });
    for (let t = 50, y = 6000; t <= 1250; t += 50, y -= 240) {
      vi.advanceTimersByTime(50);
      scrollFrame(y);
    }
    expect(apply).not.toHaveBeenCalled();

    vi.advanceTimersByTime(50);
    scrollFrame(0);
    expect(apply).toHaveBeenCalledTimes(1);
  });

  it('reaching the top before the fade is done still waits for EXIT_MS', () => {
    const apply = vi.fn();
    viewSwitch.start(apply, { scrollToTop: true });
    vi.advanceTimersByTime(100);
    scrollFrame(0);
    expect(apply).not.toHaveBeenCalled();

    vi.advanceTimersByTime(EXIT_MS - 100);
    expect(apply).toHaveBeenCalledTimes(1);
  });

  it('settles when the glide stops away from the top', () => {
    // Something else stopped it: Lenis, the visitor's wheel.
    const apply = vi.fn();
    viewSwitch.start(apply, { scrollToTop: true });
    vi.advanceTimersByTime(50);
    scrollFrame(800);
    vi.advanceTimersByTime(50);
    scrollFrame(500);
    vi.advanceTimersByTime(SCROLL_IDLE_MS - 1);
    expect(apply).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(apply).toHaveBeenCalledTimes(1);
  });

  it('does not hang when the glide never starts', () => {
    const apply = vi.fn();
    viewSwitch.start(apply, { scrollToTop: true });
    vi.advanceTimersByTime(Math.max(EXIT_MS, SCROLL_IDLE_MS));
    expect(apply).toHaveBeenCalledTimes(1);
  });

  it('caps a glide that never reaches the top', () => {
    const apply = vi.fn();
    viewSwitch.start(apply, { scrollToTop: true });
    let elapsed = 0;
    while (elapsed < SCROLL_SETTLE_CAP_MS - 50) {
      vi.advanceTimersByTime(50);
      elapsed += 50;
      scrollFrame(500);
    }
    vi.advanceTimersByTime(SCROLL_SETTLE_CAP_MS - 1 - elapsed);
    expect(apply).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(apply).toHaveBeenCalledTimes(1);
  });

  it('a stray scrollend mid-glide does not swap', () => {
    const apply = vi.fn();
    viewSwitch.start(apply, { scrollToTop: true });
    for (const y of [900, 700, 500]) {
      vi.advanceTimersByTime(50);
      scrollFrame(y);
    }
    scrollEnd();
    expect(apply).not.toHaveBeenCalled();
  });

  it('ignores scroll events when not scrolling', () => {
    const apply = vi.fn();
    viewSwitch.start(apply);
    vi.advanceTimersByTime(10);
    scrollFrame(0);
    expect(apply).not.toHaveBeenCalled();
    expect(scrollTo).not.toHaveBeenCalled();

    vi.advanceTimersByTime(EXIT_MS - 10);
    expect(apply).toHaveBeenCalledTimes(1);
  });

  it('destroy mid-switch leaves nothing behind', () => {
    const apply = vi.fn();
    viewSwitch.start(() => {});
    vi.advanceTimersByTime(EXIT_MS);
    expect(root.getAttribute(ENTER_ATTR)).toBe('a');

    viewSwitch.start(apply, { scrollToTop: true });
    viewSwitch.destroy();
    vi.advanceTimersByTime(1000);
    scrollFrame(0);
    expect(apply).not.toHaveBeenCalled();
    expect(root.classList.contains(LEAVING_CLASS)).toBe(false);
    expect(root.hasAttribute(ENTER_ATTR)).toBe(false);
  });
});
