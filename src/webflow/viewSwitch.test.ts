// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ENTER_ATTR,
  EXIT_MS,
  LEAVING_CLASS,
  SCROLL_SETTLE_CAP_MS,
  createViewSwitch,
  type ViewSwitch,
} from './viewSwitch';

const scrollEnd = () => window.dispatchEvent(new Event('scrollend'));

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

  it('waits for scrollend when scrolling to the top', () => {
    const apply = vi.fn();
    viewSwitch.start(apply, { scrollToTop: true });
    expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' });

    vi.advanceTimersByTime(EXIT_MS);
    expect(apply).not.toHaveBeenCalled();

    scrollEnd();
    expect(apply).toHaveBeenCalledTimes(1);
  });

  it('scrollend before the fade is done still waits for EXIT_MS', () => {
    const apply = vi.fn();
    viewSwitch.start(apply, { scrollToTop: true });
    vi.advanceTimersByTime(100);
    scrollEnd();
    expect(apply).not.toHaveBeenCalled();

    vi.advanceTimersByTime(EXIT_MS - 100);
    expect(apply).toHaveBeenCalledTimes(1);
  });

  it('caps the scroll wait', () => {
    const apply = vi.fn();
    viewSwitch.start(apply, { scrollToTop: true });
    vi.advanceTimersByTime(SCROLL_SETTLE_CAP_MS - 1);
    expect(apply).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(apply).toHaveBeenCalledTimes(1);
  });

  it('ignores scrollend when not scrolling', () => {
    const apply = vi.fn();
    viewSwitch.start(apply);
    vi.advanceTimersByTime(10);
    scrollEnd();
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
    scrollEnd();
    expect(apply).not.toHaveBeenCalled();
    expect(root.classList.contains(LEAVING_CLASS)).toBe(false);
    expect(root.hasAttribute(ENTER_ATTR)).toBe(false);
  });
});
