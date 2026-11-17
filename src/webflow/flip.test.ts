// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { FLIP_ID, flip } from './flip';

const MOVE = { duration: 600, easing: 'ease' };

/** An element whose box is `before` until `change` runs, then `after`. */
function mount(before: Partial<DOMRect>, after: Partial<DOMRect>) {
  const el = document.createElement('div');
  let moved = false;
  el.getBoundingClientRect = () =>
    ({ width: 100, height: 30, ...(moved ? after : before) }) as DOMRect;
  const animate = vi.fn();
  el.animate = animate as unknown as Element['animate'];
  return { el, animate, change: vi.fn(() => (moved = true)) };
}

describe('flip', () => {
  it('slides each element from where it was to where the change put it', () => {
    const { el, animate, change } = mount({ left: 500, top: 800 }, { left: 200, top: 790 });
    flip([el], change, MOVE);
    expect(change).toHaveBeenCalledTimes(1);
    expect(animate).toHaveBeenCalledWith([{ translate: '300px 10px' }, { translate: '0px 0px' }], {
      ...MOVE,
      id: FLIP_ID,
    });
  });

  it('leaves an element that did not move', () => {
    const { el, animate, change } = mount({ left: 200, top: 800 }, { left: 200, top: 800 });
    flip([el], change, MOVE);
    expect(change).toHaveBeenCalledTimes(1);
    expect(animate).not.toHaveBeenCalled();
  });

  it('skips an element hidden before or after (display:none has no box)', () => {
    const shown = mount({ left: 0, top: 0, width: 0, height: 0 }, { left: 200, top: 800 });
    flip([shown.el], shown.change, MOVE);
    expect(shown.animate).not.toHaveBeenCalled();

    const hidden = mount({ left: 200, top: 800 }, { left: 0, top: 0, width: 0, height: 0 });
    flip([hidden.el], hidden.change, MOVE);
    expect(hidden.animate).not.toHaveBeenCalled();
  });

  it('cancels its own running slide after measuring, so a new one starts where the element is', () => {
    const { el, change } = mount({ left: 500, top: 800 }, { left: 200, top: 800 });
    const order: string[] = [];
    const ours = { id: FLIP_ID, cancel: vi.fn(() => order.push('cancel')) };
    const other = { id: 'cm-card', cancel: vi.fn() };
    el.getAnimations = () => [ours, other] as unknown as Animation[];
    const measure = el.getBoundingClientRect;
    el.getBoundingClientRect = () => (order.push('measure'), measure());
    flip([el], change, MOVE);
    expect(ours.cancel).toHaveBeenCalledTimes(1);
    expect(other.cancel).not.toHaveBeenCalled();
    expect(order.slice(0, 2)).toEqual(['measure', 'cancel']);
  });

  it('still applies the change where elements cannot animate', () => {
    const el = document.createElement('div');
    const change = vi.fn();
    expect(() => flip([el], change, MOVE)).not.toThrow();
    expect(change).toHaveBeenCalledTimes(1);
  });
});
