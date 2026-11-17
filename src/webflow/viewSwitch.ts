/** On `.map-explorer` while the current view fades out (webflow/view-modes.css). */
export const LEAVING_CLASS = 'is-cm-view-leaving';
/** Enter marker on `.map-explorer`, flipped 'a' <-> 'b' on every swap. */
export const ENTER_ATTR = 'data-cm-enter';
/** Must match the `.map-explorer` opacity transition in webflow/view-modes.css. */
export const EXIT_MS = 150;
/** The glide counts as stopped (by Lenis, the visitor) after this long without a scroll event. */
export const SCROLL_IDLE_MS = 150;
/** Longest wait for the glide back up before swapping anyway. Chromium's smooth scroll takes
 *  longer the further it goes (~1.3s from 6000px), so this is a safety net, not the usual end. */
export const SCROLL_SETTLE_CAP_MS = 2000;

export interface ViewSwitch {
  /**
   * Starts a switch, or extends the pending one: fades `root` out now and,
   * with `scrollToTop`, glides the window to the top. The swap runs once the
   * fade is done and the scroll has settled: it calls the latest `apply`,
   * drops the fade and flips the enter marker.
   */
  start(apply: () => void, options?: { scrollToTop?: boolean }): void;
  /** Drops a pending swap without applying it and fades `root` back in. */
  cancel(): void;
  readonly pending: boolean;
  destroy(): void;
}

/**
 * Exit -> swap -> enter for a desktop view switch (Portfolio <-> Map, grid <->
 * list). See docs/superpowers/specs/2026-11-17-view-switch-cascade-design.md.
 *
 * The cascade itself is CSS keyed on the enter marker. The marker alternates
 * between two values, each pointing at its own copy of the keyframes, because
 * a CSS animation only restarts when its animation-name changes; removing a
 * one-shot class afterwards would change the cards' name back and replay their
 * load animation.
 */
export function createViewSwitch(root: HTMLElement): ViewSwitch {
  let apply: (() => void) | null = null;
  let exitDone = false;
  let scrollDone = true;
  let exitTimer: ReturnType<typeof setTimeout> | undefined;
  let scrollTimer: ReturnType<typeof setTimeout> | undefined;
  let idleTimer: ReturnType<typeof setTimeout> | undefined;

  const scrollSettled = () => {
    scrollDone = true;
    stopWaitingForScroll();
    trySwap();
  };

  const waitForIdle = () => {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(scrollSettled, SCROLL_IDLE_MS);
  };

  // Settled when the glide reaches the top, or once it has stopped short (no
  // scroll event for SCROLL_IDLE_MS). Not on scrollend: another scroll ending
  // mid-glide (Lenis momentum, a scroll-into-view) fires one with the page
  // still low, and a fixed timeout cuts long glides short.
  const onScroll = () => {
    if (window.scrollY <= 1) scrollSettled();
    else waitForIdle();
  };

  const stopWaitingForScroll = () => {
    window.removeEventListener('scroll', onScroll);
    clearTimeout(scrollTimer);
    clearTimeout(idleTimer);
  };

  const reset = () => {
    clearTimeout(exitTimer);
    stopWaitingForScroll();
    apply = null;
    exitDone = false;
    scrollDone = true;
    root.classList.remove(LEAVING_CLASS);
  };

  const trySwap = () => {
    if (!apply || !exitDone || !scrollDone) return;
    const run = apply;
    reset();
    run();
    root.setAttribute(ENTER_ATTR, root.getAttribute(ENTER_ATTR) === 'a' ? 'b' : 'a');
  };

  return {
    start(next, { scrollToTop = false } = {}) {
      const wasPending = apply !== null;
      apply = next;
      if (!wasPending) {
        root.classList.add(LEAVING_CLASS);
        exitTimer = setTimeout(() => {
          exitDone = true;
          trySwap();
        }, EXIT_MS);
      }
      if (scrollToTop && scrollDone) {
        scrollDone = false;
        window.addEventListener('scroll', onScroll);
        waitForIdle();
        scrollTimer = setTimeout(scrollSettled, SCROLL_SETTLE_CAP_MS);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    },
    cancel() {
      if (apply) reset();
    },
    get pending() {
      return apply !== null;
    },
    destroy() {
      reset();
      root.removeAttribute(ENTER_ATTR);
    },
  };
}
