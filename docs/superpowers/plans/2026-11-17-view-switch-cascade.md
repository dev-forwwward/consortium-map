# View Switch Cascade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On desktop, Portfolio ↔ Map View (and grid ↔ list) fades the current view out, then reveals the new one in cascade: list header → cards (staggered) → map.

**Architecture:** A small `viewSwitch` module owns the exit → swap → enter sequence on `.map-explorer` (leaving class, optional scroll-to-top, enter marker `data-cm-enter="a|b"` flipped per swap so CSS animations restart). `viewController` routes view/layout changes through it when on desktop with motion allowed; everything else stays instant. `webflow/view-modes.css` holds the fade and the keyframes/delays.

**Tech Stack:** TypeScript, Vitest + jsdom (fake timers), plain CSS (Webflow page stylesheet), Vite embed build.

**Spec:** `docs/superpowers/specs/2026-11-17-view-switch-cascade-design.md`

## Global Constraints

- Desktop only (`(min-width: 992px)`, `DESKTOP_QUERY`). Mobile and the sheet are untouched.
- Instant (today's behavior) when reduced motion is preferred, on mobile, or for the expand button (split ↔ expanded).
- Exit fade: 150ms. Scroll settle cap: 800ms. Easing everywhere: `cubic-bezier(0.2, 0.8, 0.2, 1)`.
- Cascade: header 0ms / 0.5s; cards 80ms + existing ladder (0–280ms, capped at the 8th) / 0.5s; map 240ms / 0.6s. All fade from opacity 0 with `translateY(0.5rem)`.
- The map is never `display:none`.
- Existing 71 tests stay green without edits. Controls (`is-active`, `aria-pressed`) and `getState()` update on click, not after the swap.
- No new dependencies.

## Review Focus

- Pill clicked three times within the exit (Portfolio → Map → Portfolio): one swap, ends on the last view. Test in Task 2.
- Keyboard activation (Enter on a `div[role=button]` view control) takes the same animated path. Test in Task 2.
- Controller destroyed mid-switch: no swap fires later, no leaving class left behind. Tests in Tasks 1 and 2.
- Finsweet filter change while the explorer is faded out: re-inserted cards must still cascade in after the swap. Manual check in Task 3.
- Map after it reveals: correct size, tiles drawn, no grey area (Leaflet re-measure). Manual check in Task 3.

---

### Task 1: `viewSwitch` sequencing module

**Files:**
- Create: `src/webflow/viewSwitch.ts`
- Test: `src/webflow/viewSwitch.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export const LEAVING_CLASS = 'is-cm-view-leaving';
  export const ENTER_ATTR = 'data-cm-enter';
  export const EXIT_MS = 150;              // must match the CSS opacity transition
  export const SCROLL_SETTLE_CAP_MS = 800;
  export interface ViewSwitch {
    /** Starts (or extends) a switch: adds LEAVING_CLASS now; if scrollToTop, window.scrollTo({ top: 0, behavior: 'smooth' }).
     *  Swap runs once EXIT_MS has passed AND (no scroll, or window 'scrollend', or SCROLL_SETTLE_CAP_MS since the scroll began).
     *  Swap = call the latest `apply`, remove LEAVING_CLASS, flip ENTER_ATTR (absent/'b' → 'a', 'a' → 'b').
     *  Calling start while pending replaces `apply`, keeps the original exit timer, and starts the scroll if newly requested. */
    start(apply: () => void, options?: { scrollToTop?: boolean }): void;
    /** Drops a pending swap without calling apply; removes LEAVING_CLASS; leaves ENTER_ATTR as is. No-op when idle. */
    cancel(): void;
    readonly pending: boolean;
    /** cancel() + remove ENTER_ATTR. */
    destroy(): void;
  }
  export function createViewSwitch(root: HTMLElement): ViewSwitch;
  ```

- [ ] **Step 1: Write the failing tests** (`// @vitest-environment jsdom`; `vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })`; `vi.spyOn(window, 'scrollTo').mockImplementation(() => {})`; `const scrollEnd = () => window.dispatchEvent(new Event('scrollend'))`)

  - `fades out, then applies and marks the enter at EXIT_MS`: `start(apply)` → root has `LEAVING_CLASS`, `pending === true`, apply not called; advance 149 → still not called; advance 1 → apply called once, no `LEAVING_CLASS`, `getAttribute(ENTER_ATTR) === 'a'`, `pending === false`.
  - `alternates the enter marker a, b, a`: three complete switches → `'a'`, `'b'`, `'a'`.
  - `latest apply wins while pending`: `start(first)`; advance 50; `start(second)`; advance 100 → `first` never called, `second` called once (swap still at 150ms from the first start).
  - `cancel drops the swap`: `start(apply)`; advance 50; `cancel()` → no `LEAVING_CLASS`, `pending === false`; advance 1000 → apply never called, `ENTER_ATTR` null.
  - `waits for scrollend when scrolling to the top`: `start(apply, { scrollToTop: true })` → `window.scrollTo` called with `{ top: 0, behavior: 'smooth' }`; advance 150 → not applied; `scrollEnd()` → applied once.
  - `scrollend before the fade is done still waits for EXIT_MS`: start with scroll; advance 100; `scrollEnd()` → not applied; advance 50 → applied.
  - `caps the scroll wait`: start with scroll, no scrollend; advance 799 → not applied; advance 1 → applied.
  - `ignores scrollend when not scrolling` : `start(apply)`; `scrollEnd()` at 10ms → not applied until 150ms.
  - `destroy mid-switch`: start with scroll; `destroy()`; advance 1000; `scrollEnd()` → apply never called, no `LEAVING_CLASS`, no `ENTER_ATTR`.

- [ ] **Step 2: Run to verify they fail**

  Run: `npx vitest run src/webflow/viewSwitch.test.ts`
  Expected: FAIL, cannot resolve `./viewSwitch`.

- [ ] **Step 3: Implement `createViewSwitch(root: HTMLElement): ViewSwitch` in `src/webflow/viewSwitch.ts`**

  Two flags (`exitDone`, `scrollDone`) and a `trySwap()` that runs when both are true. One `scrollend` listener on `window`, added only while a scroll is awaited and removed on swap/cancel. Doc comment points at the spec and says why the marker alternates (an animation only restarts when `animation-name` changes; removing a one-shot class would replay the cards' load animation).

- [ ] **Step 4: Run to verify they pass**

  Run: `npx vitest run src/webflow/viewSwitch.test.ts`
  Expected: PASS (9 tests).

- [ ] **Step 5: Commit**

  ```bash
  git add src/webflow/viewSwitch.ts src/webflow/viewSwitch.test.ts
  git commit -m "View switch: exit/swap/enter sequencing module"
  ```

---

### Task 2: Route desktop view/layout changes through `viewSwitch`

**Files:**
- Modify: `src/webflow/viewController.ts` (`initViewController`: `prefersReducedMotion` default, `render`/`update`, `onBreakpoint`, `destroy`)
- Test: `src/webflow/viewController.test.ts` (new `describe('animated switch')` block; existing tests unchanged)

**Interfaces:**
- Consumes: `createViewSwitch`, `LEAVING_CLASS`, `ENTER_ATTR`, `EXIT_MS`, `SCROLL_SETTLE_CAP_MS` from Task 1; `classesFor` from `./viewState`.
- Produces: no new exports. Behavior: `update()` syncs controls immediately; layout classes, Lenis attributes and `showMore.sync` apply either now (instant) or at the swap.

- [ ] **Step 1: Write the failing tests**

  Helpers in the test file:
  - `mediaWith({ desktop, reduce }: { desktop: boolean; reduce: boolean })` returns a `matchMedia(query)` that gives an mql with `matches: query === DESKTOP_QUERY ? desktop : reduce` (same `addEventListener`/`removeEventListener` shape as `fakeMatchMedia`).
  - Block setup: fake timers (`setTimeout`, `clearTimeout`, `requestAnimationFrame`, `cancelAnimationFrame`), `vi.spyOn(window, 'scrollTo').mockImplementation(() => {})`; controller with `matchMedia: fakeMatchMedia(true).matchMedia, prefersReducedMotion: () => false` unless the test says otherwise.

  Tests:
  - `fades out, then swaps to Portfolio`: click Portfolio → `[data-cm-view="portfolio"]` has `aria-pressed="true"`, `getState().view === 'portfolio'`, root has `is-cm-view-leaving`, not `is-portfolio`; advance `EXIT_MS` → root className is `map-explorer is-portfolio`, `data-cm-enter === 'a'`.
  - `animates the grid/list toggle in Portfolio`: to Portfolio, advance; click list → leaving, no `is-list`; advance → `is-list`, `data-cm-enter === 'b'`.
  - `clicking back to the view on screen cancels`: click Portfolio; advance 50; click Map → no `is-cm-view-leaving`; advance 1000 → className `map-explorer`, no `data-cm-enter`, Map `aria-pressed="true"`.
  - `three clicks within the exit end on the last view with one swap`: Portfolio, Map, Portfolio at 0/30/60ms; advance 150 from the first click → `is-portfolio`, `data-cm-enter === 'a'`; advance 1000 → still `'a'`.
  - `a layout click during the exit lands in the same swap`: Portfolio; advance 50; click list; advance 100 → className `map-explorer is-portfolio is-list`, `data-cm-enter === 'a'`.
  - `keyboard activation animates too`: insert `<div role="button" tabindex="0" id="v" data-cm-view="portfolio">`; Enter keydown on it → leaving; advance → `is-portfolio`.
  - `expand button stays instant`: click `[data-cm-expand]` → `is-map-expanded` immediately, no leaving.
  - `mobile stays instant`: `fakeMatchMedia(false)`, `prefersReducedMotion: () => false`; click list → className `map-explorer is-sheet-peek is-list` immediately.
  - `reduced motion by default reads matchMedia`: `matchMedia: mediaWith({ desktop: true, reduce: false })`, no `prefersReducedMotion` → click Portfolio → leaving (animated path). Same with `reduce: true` → `is-portfolio` immediately.
  - `scrolls up first when going to Map from deep in Portfolio`: to Portfolio, advance; stub `root.getBoundingClientRect = () => ({ top: -500 }) as DOMRect`; click Map → `window.scrollTo` called with `{ top: 0, behavior: 'smooth' }`; advance 150 → still `is-portfolio`; `window.dispatchEvent(new Event('scrollend'))` → className `map-explorer`.
  - `does not scroll when the explorer top is in view`: same with `top: 120` → `window.scrollTo` not called.
  - `breakpoint change mid-switch renders at once`: `const media = fakeMatchMedia(true)`; click Portfolio; `media.set(false)` → className `map-explorer is-sheet-peek`, no leaving; advance 1000 → unchanged.
  - `destroy mid-switch`: click Portfolio; `controller.destroy()`; advance 1000 → no `is-portfolio`, no leaving, no `data-cm-enter`.

- [ ] **Step 2: Run to verify they fail**

  Run: `npx vitest run src/webflow/viewController.test.ts`
  Expected: new tests FAIL (no leaving class; classes apply immediately); the existing 40-odd tests PASS.

- [ ] **Step 3: Implement in `src/webflow/viewController.ts`**

  - Default `prefersReducedMotion` becomes `() => matchMedia('(prefers-reduced-motion: reduce)').matches`, using the `matchMedia` option (the existing fake reports `true` for every query, so existing desktop tests keep the instant path).
  - Track `shown: ViewState`, the state last applied to the DOM. Split `render` into `renderControls()` (`syncControls`) and `applyLayout()` (`applyClasses`, `syncLenisPrevent`, `showMore.sync`, then `shown = { ...state }`); `render()` does both.
  - `update(next)`: set state, `renderControls()`, then:
    1. switch pending and `classesFor(state, true)` equals `classesFor(shown, true)` → `viewSwitch.cancel()`;
    2. else switch pending, or desktop + motion allowed + (`state.view !== shown.view` or `state.view === 'portfolio' && state.layout !== shown.layout`) → `viewSwitch.start(applyLayout, { scrollToTop: state.view === 'map' && root.getBoundingClientRect().top < 0 })`;
    3. else `applyLayout()`.
  - `onBreakpoint` calls `viewSwitch.cancel()` before rendering; `destroy` calls `viewSwitch.destroy()`.

- [ ] **Step 4: Run the whole suite**

  Run: `npx vitest run && npx tsc --noEmit`
  Expected: all tests PASS (71 existing + 9 from Task 1 + 13 new), no type errors.

- [ ] **Step 5: Commit**

  ```bash
  git add src/webflow/viewController.ts src/webflow/viewController.test.ts
  git commit -m "View controller: fade/cascade Portfolio <-> Map and grid <-> list on desktop"
  ```

---

### Task 3: Cascade CSS, Show more reset, README, fixture check

**Files:**
- Modify: `webflow/view-modes.css` (desktop block, after the card rules; reduced-motion block at the end)
- Modify: `src/webflow/showMore.ts` (`sync`)
- Test: `src/webflow/showMore.test.ts`
- Modify: `README.md` (View modes section, after the Show more paragraph)

**Interfaces:**
- Consumes: `LEAVING_CLASS` (`is-cm-view-leaving`) and `ENTER_ATTR` (`data-cm-enter`, values `a`/`b`) from Task 1, as literal selectors in CSS.

- [ ] **Step 1: Write the failing Show more test** in `src/webflow/showMore.test.ts`

  `a re-render ends the reveal stagger`: `attachShowMore(mount(8), { pageSize: 3 })`; `sync(true)`; `button().click()` → `.map-explorer_items` has `REVEALING_CLASS`; `sync(true)` → it doesn't.

- [ ] **Step 2: Run to verify it fails**

  Run: `npx vitest run src/webflow/showMore.test.ts`
  Expected: FAIL on the last assertion.

- [ ] **Step 3: Make `sync()` remove `REVEALING_CLASS`** (only if present: every class mutation wakes the map's list observer). Comment: otherwise a view switch after Show more would run every card's enter at the same delay.

- [ ] **Step 4: Add the CSS** to `webflow/view-modes.css`

  - Top level: `@keyframes cm-enter-a` and `@keyframes cm-enter-b`, identical, `from { opacity: 0; transform: translateY(0.5rem); }`. Comment: two names so each swap changes `animation-name` (restart); see `src/webflow/viewSwitch.ts`.
  - Desktop block:
    - `.map-explorer { transition: opacity 150ms ease; }` (comment: matches `EXIT_MS`), `.map-explorer.is-cm-view-leaving { opacity: 0; }`
    - `.map-explorer[data-cm-enter] .map-explorer_header`: `animation: cm-enter-a 0.5s cubic-bezier(0.2, 0.8, 0.2, 1) backwards`
    - `.map-explorer[data-cm-enter] .map-explorer_items > .w-dyn-item`: `animation-delay: calc(80ms + var(--cm-card-delay, 0ms))`, with `animation-name: cm-enter-a` / `cm-enter-b` per value
    - `.map-explorer[data-cm-enter] .map-explorer_map`: `animation: cm-enter-a 0.6s cubic-bezier(0.2, 0.8, 0.2, 1) 240ms backwards`
    - `[data-cm-enter="b"]` rules switch header and map to `cm-enter-b`.
  - Reduced-motion block: `.map-explorer { transition: none; }` and `animation: none` on the three `.map-explorer[data-cm-enter] …` selectors (same specificity, later in the file).

- [ ] **Step 5: Build and check in the fixture** (desktop, 1440×900)

  Run: `npm run build:embed`, then `python3 -m http.server 4321` (background), open `http://localhost:4321/dev/webflow-cms-fixture.html` with Playwright.
  Expected, via `evaluate`:
  - ~60ms after clicking Portfolio: `getComputedStyle(.map-explorer).opacity` < 1; after 400ms: `dataset.cmEnter === 'a'`, `is-portfolio`, first card's `getAnimations()[0].animationName === 'cm-enter-a'`.
  - Click Map: header and `.map-explorer_map` animate `cm-enter-b`; screenshot at ~1.2s shows the map fully drawn at the right size (Review Focus: no grey area).
  - Scroll to the bottom in Portfolio, click Map: page glides to the top before the map view appears.
  - Pick a category while the explorer is faded out (click Map, then a filter within 150ms): the filtered cards cascade in after the swap (Review Focus).
  - `emulateMedia({ reducedMotion: 'reduce' })`, reload: Portfolio ↔ Map is instant, no `data-cm-enter`.
  Stop the server afterwards.

- [ ] **Step 6: README** — one paragraph under View modes: desktop switches fade out (`is-cm-view-leaving`, 150ms), optionally glide to the top when going to Map, then cascade header → cards → map via `data-cm-enter="a|b"` (alternates so the CSS animations restart); instant on mobile, for the expand button and with reduced motion; logic in `src/webflow/viewSwitch.ts`.

- [ ] **Step 7: Full check and commit**

  Run: `npx vitest run && npx tsc --noEmit`
  Expected: all PASS.

  ```bash
  git add webflow/view-modes.css src/webflow/showMore.ts src/webflow/showMore.test.ts README.md
  git commit -m "Cascade reveal CSS for view switches; Show more reset on re-render"
  ```

  `dist-embed/` is rebuilt but not deployed: Vercel deploy only on request.
