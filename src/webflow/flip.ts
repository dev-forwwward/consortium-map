/** Animation id, so a new slide can cancel the previous one and nothing else. */
export const FLIP_ID = 'cm-flip';

export interface FlipOptions {
  duration: number;
  easing: string;
}

const hasBox = (rect: DOMRect) => rect.width > 0 || rect.height > 0;

/**
 * Runs `change` (a layout change) and slides each element from where it was
 * to where the change put it (FLIP). Works whatever positions the element in
 * either state (absolute, sticky, in flow), since only the boxes are compared.
 *
 * Animates the `translate` property, so an element's own `transform` (the
 * pill's translateX(-50%)) is left alone. Elements hidden before or after
 * (display:none) jump, as do elements in environments without
 * Element.animate (jsdom).
 */
export function flip(elements: Iterable<HTMLElement>, change: () => void, options: FlipOptions): void {
  const moving = Array.from(elements, (el) => {
    // Measured mid-slide, so an interrupted slide continues from where it is.
    const before = el.getBoundingClientRect();
    el.getAnimations?.().forEach((animation) => {
      if (animation.id === FLIP_ID) animation.cancel();
    });
    return { el, before };
  });

  change();

  moving.forEach(({ el, before }) => {
    if (typeof el.animate !== 'function') return;
    const after = el.getBoundingClientRect();
    if (!hasBox(before) || !hasBox(after)) return;
    const dx = Math.round(before.left - after.left);
    const dy = Math.round(before.top - after.top);
    if (dx === 0 && dy === 0) return;
    el.animate([{ translate: `${dx}px ${dy}px` }, { translate: '0px 0px' }], {
      ...options,
      id: FLIP_ID,
    });
  });
}
