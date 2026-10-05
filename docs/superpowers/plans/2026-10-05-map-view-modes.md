# Map View Modes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an expanded-map mode, a Portfolio mode (grid or list, no map) and a mobile bottom sheet to the Webflow Projects page map explorer, with marker clicks that only highlight the list and card clicks that open the project page.

**Architecture:** Webflow owns layout and controls. A plain TypeScript view controller (shipped in the embed bundle) toggles combo classes on `.map-explorer`; state-dependent CSS lives in `webflow/view-modes.css`, pasted into a `<style>` Embed on the page. The React map gets a `selectOnly` mode that drops the modal and dispatches a `cm:select` DOM event, which the controller uses to reveal and scroll to the card. The build ships as `consortium-map-v3.*` so v2 pages are untouched.

**Tech Stack:** React 19, TypeScript, Vite 8 (library/IIFE build), Leaflet + markercluster, Vitest + jsdom (new, tests only), Webflow + Finsweet Attributes List Filter v2, Vercel.

**Spec:** `docs/superpowers/specs/2026-10-05-map-view-modes-design.md`

## Global Constraints

- Desktop/mobile breakpoint: `(min-width: 992px)` is desktop. Below is mobile.
- Default state: desktop Map view, split, grid. Mobile sheet at `peek`. Nothing persisted between visits.
- State classes on `.map-explorer`: `is-portfolio`, `is-list`, `is-map-expanded`, `is-sheet-peek`, `is-sheet-half`, `is-sheet-full`. No other state classes.
- Control attributes: `data-cm-view="map|portfolio"`, `data-cm-layout="grid|list"`, `data-cm-expand`, `data-cm-sheet`, `data-cm-sheet-handle`. Active control gets `is-active` and `aria-pressed="true"`.
- Map → page event: `document.dispatchEvent(new CustomEvent('cm:select', { detail: { id } }))`.
- Never hide the map container with `display:none` (Leaflet 0×0 bounds bug, see README). Use `visibility:hidden` + out of flow.
- Sheet: flick threshold `0.5` px/ms, tap threshold `6` px, peek visible height `72px` (CSS var `--cm-sheet-peek`).
- Card click navigates to `/work/<slug>` via a Webflow Link Block. No JS navigation.
- Output filenames: `consortium-map-v3.js` / `consortium-map-v3.css`. v1 and v2 files must keep being served.
- The standalone dev app (`npm run dev`, `ExplorerLayout`) keeps its modal and current behavior.
- `npm run build:embed` requires `VITE_CARTO_BASEMAP_KEY` in `.env` (it already exists locally).

## Review Focus

1. **Filter changed while in Portfolio, then back to Map** → map shows only the filtered markers and tiles render at the right size (no grey strip, no stale bounds). Pinned in Task 8, step "Portfolio → filter → Map".
2. **Viewport crosses 992px mid-drag or with a sheet state set** → drag is cancelled, inline `transform` cleared, the other side's defaults applied. Pinned in Task 3 test "breakpoint change resets and clears inline transform" and Task 4 cancel wiring.
3. **`cm:select` for an id with no card on the page** (filtered out or missing) → nothing happens, no exception, state unchanged. Pinned in Task 5 test "ignores unknown ids".
4. **Sheet `transitionend` never fires** (transition disabled, element hidden, Webflow override) → card still scrolls into view via the fallback timer. Pinned in Task 5 test "falls back when transitionend never fires".
5. **Card wrapped in a Link Block** → hover still highlights its marker and Finsweet still filters it. Pinned in Task 8, steps "hover" and "filter in every view".

---

## File Structure

| File | Responsibility |
|---|---|
| `vitest.config.ts` (new) | Test runner config (jsdom available, `pretendToBeVisual` for rAF) |
| `src/webflow/sheetSnap.ts` (new) | Pure snap maths: types, snap points, `resolveSnap`, `nextSnapOnTap`, `clampOffset` |
| `src/webflow/sheetSnap.test.ts` (new) | Unit tests for snap maths |
| `src/webflow/viewState.ts` (new) | `ViewState` type, defaults, state → class list, apply classes, sync control `aria-pressed` |
| `src/webflow/viewState.test.ts` (new) | Unit tests for class mapping |
| `src/webflow/sheetDrag.ts` (new) | Pointer drag on the sheet handle, snaps via callback |
| `src/webflow/viewController.ts` (new) | Wires controls, breakpoint, sheet drag, keyboard, `cm:select` |
| `src/webflow/viewController.test.ts` (new) | jsdom tests for the controller |
| `src/lib/cmsSource.ts` | Adds `SELECT_EVENT` constant (shared contract) |
| `src/components/map/ClusterLayer.tsx` | `selectOnly` prop: select without modal, dispatch `cm:select` |
| `src/components/map/MapPanel.tsx` | Passes `selectOnly` through |
| `src/components/layout/MapOnlyLayout.tsx` | Drops the modal, passes `selectOnly` |
| `src/hooks/useCmsBridge.ts` | Drops card click handler and scroll-on-select effect |
| `src/embed.tsx` | Inits the view controller; CSS URL → v3 |
| `vite.embed.config.ts` | Output names → v3 |
| `webflow/view-modes.css` (new) | State-dependent CSS, source of truth for the Webflow `<style>` Embed |
| `dev/webflow-cms-fixture.html` | New controls/markup, links `view-modes.css`, loads v3 |
| `README.md` | Documents contract, event, CSS embed, v3, three-version deploy |

---

### Task 1: Vitest setup + sheet snap maths

**Files:**
- Create: `vitest.config.ts`
- Create: `src/webflow/sheetSnap.ts`
- Test: `src/webflow/sheetSnap.test.ts`
- Modify: `package.json` (devDependencies, `test` script)

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `type SheetSnap = 'peek' | 'half' | 'full'`
  - `type SnapPoints = Record<SheetSnap, number>` (translateY offsets in px; `full` is smallest)
  - `const FLICK_VELOCITY = 0.5`, `const TAP_THRESHOLD = 6`, `const DEFAULT_PEEK_VISIBLE = 72`
  - `computeSnapPoints(trackHeight: number, peekVisible: number): SnapPoints`
  - `resolveSnap(offset: number, velocity: number, points: SnapPoints): SheetSnap` (velocity px/ms, positive = downward)
  - `nextSnapOnTap(current: SheetSnap): SheetSnap`
  - `clampOffset(offset: number, points: SnapPoints): number`

- [ ] **Step 1: Install Vitest and jsdom**

Run: `npm install -D vitest jsdom`
Then: `npx vitest --version`
Expected: prints a version. If npm reports a peer-dependency conflict with `vite@^8`, install the newest Vitest major whose `peerDependencies.vite` includes `^8` (`npm view vitest peerDependencies`), and rerun.

- [ ] **Step 2: Add config and script**

Create `vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';

// Tests only. The SPA and embed builds have their own configs.
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
    environmentOptions: {
      // Gives jsdom-environment tests a requestAnimationFrame.
      jsdom: { pretendToBeVisual: true },
    },
  },
});
```

In `package.json` `"scripts"`, add after `"preview"`:

```json
    "test": "vitest run"
```

- [ ] **Step 3: Write the failing test**

Create `src/webflow/sheetSnap.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  clampOffset,
  computeSnapPoints,
  nextSnapOnTap,
  resolveSnap,
} from './sheetSnap';

const points = computeSnapPoints(800, 72);

describe('computeSnapPoints', () => {
  it('places full at 0, half at the middle, peek showing the handle', () => {
    expect(points).toEqual({ full: 0, half: 400, peek: 728 });
  });

  it('never returns a negative peek on a tiny track', () => {
    expect(computeSnapPoints(50, 72)).toEqual({ full: 0, half: 25, peek: 0 });
  });
});

describe('resolveSnap', () => {
  it('snaps to the nearest point on a slow release', () => {
    expect(resolveSnap(380, 0, points)).toBe('half');
    expect(resolveSnap(700, 0.2, points)).toBe('peek');
    expect(resolveSnap(100, -0.2, points)).toBe('full');
  });

  it('treats a velocity just under the threshold as slow', () => {
    expect(resolveSnap(380, 0.49, points)).toBe('half');
  });

  it('follows a downward flick to the next point below', () => {
    expect(resolveSnap(390, 0.8, points)).toBe('half');
    expect(resolveSnap(410, 0.8, points)).toBe('peek');
    expect(resolveSnap(10, 0.5, points)).toBe('half');
  });

  it('follows an upward flick to the next point above', () => {
    expect(resolveSnap(390, -0.8, points)).toBe('full');
    expect(resolveSnap(700, -0.8, points)).toBe('half');
  });

  it('clamps a flick past either end', () => {
    expect(resolveSnap(728, 2, points)).toBe('peek');
    expect(resolveSnap(0, -2, points)).toBe('full');
  });
});

describe('nextSnapOnTap', () => {
  it('cycles peek → half → full → peek', () => {
    expect(nextSnapOnTap('peek')).toBe('half');
    expect(nextSnapOnTap('half')).toBe('full');
    expect(nextSnapOnTap('full')).toBe('peek');
  });
});

describe('clampOffset', () => {
  it('keeps the offset between full and peek', () => {
    expect(clampOffset(-40, points)).toBe(0);
    expect(clampOffset(900, points)).toBe(728);
    expect(clampOffset(300, points)).toBe(300);
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `npx vitest run src/webflow/sheetSnap.test.ts`
Expected: FAIL, cannot resolve `./sheetSnap`.

- [ ] **Step 5: Write the implementation**

Create `src/webflow/sheetSnap.ts`:

```ts
/**
 * Snap maths for the mobile project sheet. Offsets are the sheet's
 * translateY in px from the top of its track: `full` is 0 (covers the map),
 * `peek` leaves only the handle and title visible.
 */
export type SheetSnap = 'peek' | 'half' | 'full';
export type SnapPoints = Record<SheetSnap, number>;

/** Release speed (px/ms) above which a drag counts as a flick. */
export const FLICK_VELOCITY = 0.5;
/** Pointer travel (px) below which a press counts as a tap. */
export const TAP_THRESHOLD = 6;
/** Fallback for the `--cm-sheet-peek` CSS variable. */
export const DEFAULT_PEEK_VISIBLE = 72;

// Ascending offset: top of the screen first.
const ORDER: SheetSnap[] = ['full', 'half', 'peek'];

export function computeSnapPoints(trackHeight: number, peekVisible: number): SnapPoints {
  const height = Math.max(0, trackHeight);
  return {
    full: 0,
    half: Math.round(height / 2),
    peek: Math.max(0, height - peekVisible),
  };
}

export function clampOffset(offset: number, points: SnapPoints): number {
  return Math.min(points.peek, Math.max(points.full, offset));
}

export function resolveSnap(offset: number, velocity: number, points: SnapPoints): SheetSnap {
  if (Math.abs(velocity) >= FLICK_VELOCITY) {
    const down = velocity > 0;
    const ahead = ORDER.filter((snap) => (down ? points[snap] > offset : points[snap] < offset));
    if (ahead.length === 0) return down ? 'peek' : 'full';
    return down ? ahead[0] : ahead[ahead.length - 1];
  }
  return ORDER.reduce((best, snap) =>
    Math.abs(points[snap] - offset) < Math.abs(points[best] - offset) ? snap : best,
  );
}

export function nextSnapOnTap(current: SheetSnap): SheetSnap {
  if (current === 'peek') return 'half';
  if (current === 'half') return 'full';
  return 'peek';
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npx vitest run src/webflow/sheetSnap.test.ts`
Expected: PASS, all tests.

- [ ] **Step 7: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json vitest.config.ts src/webflow/sheetSnap.ts src/webflow/sheetSnap.test.ts
git commit -m "Add Vitest and the mobile sheet snap maths"
```

---

### Task 2: View state → classes

**Files:**
- Create: `src/webflow/viewState.ts`
- Test: `src/webflow/viewState.test.ts`

**Interfaces:**
- Consumes: `SheetSnap` from `./sheetSnap`.
- Produces:
  - `type View = 'map' | 'portfolio'`, `type Layout = 'grid' | 'list'`, `type MapSize = 'split' | 'expanded'`
  - `interface ViewState { view: View; layout: Layout; mapSize: MapSize; sheet: SheetSnap }`
  - `const DEFAULT_STATE: ViewState`
  - `const STATE_CLASSES: readonly string[]`
  - `classesFor(state: ViewState, isDesktop: boolean): string[]`
  - `applyClasses(root: HTMLElement, state: ViewState, isDesktop: boolean): void`
  - `syncControls(doc: ParentNode, state: ViewState, isDesktop: boolean): void`

- [ ] **Step 1: Write the failing test**

Create `src/webflow/viewState.test.ts`:

```ts
// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_STATE, applyClasses, classesFor, syncControls } from './viewState';

describe('classesFor', () => {
  it('adds nothing for the desktop default', () => {
    expect(classesFor(DEFAULT_STATE, true)).toEqual([]);
  });

  it('marks portfolio, and list only inside portfolio, on desktop', () => {
    expect(classesFor({ ...DEFAULT_STATE, view: 'portfolio' }, true)).toEqual(['is-portfolio']);
    expect(classesFor({ ...DEFAULT_STATE, view: 'portfolio', layout: 'list' }, true)).toEqual([
      'is-portfolio',
      'is-list',
    ]);
    expect(classesFor({ ...DEFAULT_STATE, layout: 'list' }, true)).toEqual([]);
  });

  it('marks expanded only in map view on desktop', () => {
    expect(classesFor({ ...DEFAULT_STATE, mapSize: 'expanded' }, true)).toEqual(['is-map-expanded']);
    expect(
      classesFor({ ...DEFAULT_STATE, view: 'portfolio', mapSize: 'expanded' }, true),
    ).toEqual(['is-portfolio']);
  });

  it('uses the sheet state and layout on mobile, ignoring view and map size', () => {
    expect(classesFor(DEFAULT_STATE, false)).toEqual(['is-sheet-peek']);
    expect(
      classesFor({ view: 'portfolio', layout: 'list', mapSize: 'expanded', sheet: 'full' }, false),
    ).toEqual(['is-sheet-full', 'is-list']);
  });
});

describe('applyClasses', () => {
  it('replaces previous state classes and leaves other classes alone', () => {
    const root = document.createElement('div');
    root.className = 'map-explorer is-portfolio is-sheet-half';
    applyClasses(root, { ...DEFAULT_STATE, mapSize: 'expanded' }, true);
    expect(root.className).toBe('map-explorer is-map-expanded');
  });
});

describe('syncControls', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <button data-cm-view="map"></button>
      <button data-cm-view="portfolio"></button>
      <button data-cm-layout="grid"></button>
      <button data-cm-layout="list"></button>
      <button data-cm-expand></button>`;
  });

  const el = (selector: string) => document.querySelector(selector)!;

  it('marks the active view and layout', () => {
    syncControls(document, { ...DEFAULT_STATE, view: 'portfolio', layout: 'list' }, true);
    expect(el('[data-cm-view="portfolio"]').getAttribute('aria-pressed')).toBe('true');
    expect(el('[data-cm-view="portfolio"]').classList.contains('is-active')).toBe(true);
    expect(el('[data-cm-view="map"]').getAttribute('aria-pressed')).toBe('false');
    expect(el('[data-cm-view="map"]').classList.contains('is-active')).toBe(false);
    expect(el('[data-cm-layout="list"]').getAttribute('aria-pressed')).toBe('true');
  });

  it('labels the expand button for its next action', () => {
    syncControls(document, DEFAULT_STATE, true);
    expect(el('[data-cm-expand]').getAttribute('aria-label')).toBe('Expand map');
    expect(el('[data-cm-expand]').getAttribute('aria-pressed')).toBe('false');

    syncControls(document, { ...DEFAULT_STATE, mapSize: 'expanded' }, true);
    expect(el('[data-cm-expand]').getAttribute('aria-label')).toBe('Show project list');
    expect(el('[data-cm-expand]').getAttribute('aria-pressed')).toBe('true');

    syncControls(document, DEFAULT_STATE, false);
    expect(el('[data-cm-expand]').getAttribute('aria-label')).toBe('Show full map');
    expect(el('[data-cm-expand]').hasAttribute('aria-pressed')).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/webflow/viewState.test.ts`
Expected: FAIL, cannot resolve `./viewState`.

- [ ] **Step 3: Write the implementation**

Create `src/webflow/viewState.ts`:

```ts
import type { SheetSnap } from './sheetSnap';

export type View = 'map' | 'portfolio';
export type Layout = 'grid' | 'list';
export type MapSize = 'split' | 'expanded';

export interface ViewState {
  view: View;
  layout: Layout;
  mapSize: MapSize;
  sheet: SheetSnap;
}

export const DEFAULT_STATE: ViewState = {
  view: 'map',
  layout: 'grid',
  mapSize: 'split',
  sheet: 'peek',
};

export const STATE_CLASSES = [
  'is-portfolio',
  'is-list',
  'is-map-expanded',
  'is-sheet-peek',
  'is-sheet-half',
  'is-sheet-full',
] as const;

const ACTIVE_CLASS = 'is-active';

/**
 * The combo classes `.map-explorer` should carry for a state. Desktop shows
 * view and map size; the split-view list is always a grid, so `is-list`
 * only appears in Portfolio. Mobile shows the sheet position and layout.
 */
export function classesFor(state: ViewState, isDesktop: boolean): string[] {
  if (isDesktop) {
    if (state.view === 'portfolio') {
      return state.layout === 'list' ? ['is-portfolio', 'is-list'] : ['is-portfolio'];
    }
    return state.mapSize === 'expanded' ? ['is-map-expanded'] : [];
  }
  const classes = [`is-sheet-${state.sheet}`];
  if (state.layout === 'list') classes.push('is-list');
  return classes;
}

export function applyClasses(root: HTMLElement, state: ViewState, isDesktop: boolean): void {
  root.classList.remove(...STATE_CLASSES);
  root.classList.add(...classesFor(state, isDesktop));
}

function setPressed(el: Element, pressed: boolean) {
  el.classList.toggle(ACTIVE_CLASS, pressed);
  el.setAttribute('aria-pressed', String(pressed));
}

/** Reflects the state on every control, wherever it sits on the page. */
export function syncControls(doc: ParentNode, state: ViewState, isDesktop: boolean): void {
  doc.querySelectorAll('[data-cm-view]').forEach((el) => {
    setPressed(el, el.getAttribute('data-cm-view') === state.view);
  });
  doc.querySelectorAll('[data-cm-layout]').forEach((el) => {
    setPressed(el, el.getAttribute('data-cm-layout') === state.layout);
  });
  doc.querySelectorAll('[data-cm-expand]').forEach((el) => {
    if (isDesktop) {
      const expanded = state.mapSize === 'expanded';
      setPressed(el, expanded);
      el.setAttribute('aria-label', expanded ? 'Show project list' : 'Expand map');
    } else {
      el.classList.remove(ACTIVE_CLASS);
      el.removeAttribute('aria-pressed');
      el.setAttribute('aria-label', 'Show full map');
    }
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/webflow/viewState.test.ts`
Expected: PASS.

- [ ] **Step 5: Type-check and commit**

Run: `npx tsc --noEmit` (expected: no errors)

```bash
git add src/webflow/viewState.ts src/webflow/viewState.test.ts
git commit -m "Map view state to explorer combo classes and control state"
```

---

### Task 3: View controller — controls, keyboard, breakpoint

**Files:**
- Create: `src/webflow/viewController.ts`
- Test: `src/webflow/viewController.test.ts`

**Interfaces:**
- Consumes: `DEFAULT_STATE`, `ViewState`, `applyClasses`, `syncControls` from `./viewState`; `nextSnapOnTap` from `./sheetSnap`.
- Produces:
  - `const DESKTOP_QUERY = '(min-width: 992px)'`
  - `interface ViewControllerOptions { matchMedia?: (query: string) => MediaQueryList; prefersReducedMotion?: () => boolean }`
  - `interface ViewController { getState(): ViewState; destroy(): void }`
  - `initViewController(root: HTMLElement, options?: ViewControllerOptions): ViewController`

Behavior added in this task:
- Click on any `[data-cm-view]`, `[data-cm-layout]`, `[data-cm-expand]` anywhere in the document updates state.
- Enter/Space on those controls or `[data-cm-sheet-handle]`, when the element is not a native `<button>`, acts like a click. Enter/Space on the handle cycles the sheet.
- Switching view resets `mapSize` to `split`.
- `[data-cm-expand]`: desktop toggles `mapSize`; mobile sets `sheet: 'peek'`.
- Breakpoint change: keeps `layout`, resets everything else to defaults, clears inline `transform` on `[data-cm-sheet]` and removes `is-sheet-dragging`.

- [ ] **Step 1: Write the failing test**

Create `src/webflow/viewController.test.ts`:

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/webflow/viewController.test.ts`
Expected: FAIL, cannot resolve `./viewController`.

- [ ] **Step 3: Write the implementation**

Create `src/webflow/viewController.ts`:

```ts
import { nextSnapOnTap } from './sheetSnap';
import { DEFAULT_STATE, applyClasses, syncControls, type ViewState } from './viewState';

export const DESKTOP_QUERY = '(min-width: 992px)';

const CONTROL_SELECTOR = '[data-cm-view], [data-cm-layout], [data-cm-expand]';
const HANDLE_SELECTOR = '[data-cm-sheet-handle]';
const SHEET_SELECTOR = '[data-cm-sheet]';
const DRAGGING_CLASS = 'is-sheet-dragging';

export interface ViewControllerOptions {
  matchMedia?: (query: string) => MediaQueryList;
  prefersReducedMotion?: () => boolean;
}

export interface ViewController {
  getState(): ViewState;
  destroy(): void;
}

/**
 * Owns the Projects page view state (Map/Portfolio, grid/list, split/expanded,
 * mobile sheet position) and expresses it as combo classes on `root`
 * (`.map-explorer`). Controls are found by data attribute anywhere in the
 * document, since the Portfolio/Map pill sits outside the explorer. See
 * README → "View modes".
 */
export function initViewController(
  root: HTMLElement,
  options: ViewControllerOptions = {},
): ViewController {
  const matchMedia = options.matchMedia ?? ((query: string) => window.matchMedia(query));
  const desktop = matchMedia(DESKTOP_QUERY);
  const sheet = root.querySelector<HTMLElement>(SHEET_SELECTOR);

  let state: ViewState = { ...DEFAULT_STATE };

  const render = () => {
    applyClasses(root, state, desktop.matches);
    syncControls(document, state, desktop.matches);
  };

  const update = (next: Partial<ViewState>) => {
    state = { ...state, ...next };
    render();
  };

  const activate = (control: Element) => {
    const view = control.getAttribute('data-cm-view');
    if (view === 'map' || view === 'portfolio') {
      if (view !== state.view) update({ view, mapSize: 'split' });
      return;
    }
    const layout = control.getAttribute('data-cm-layout');
    if (layout === 'grid' || layout === 'list') {
      if (layout !== state.layout) update({ layout });
      return;
    }
    if (control.hasAttribute('data-cm-expand')) {
      if (desktop.matches) {
        update({ mapSize: state.mapSize === 'expanded' ? 'split' : 'expanded' });
      } else {
        update({ sheet: 'peek' });
      }
    }
  };

  const onClick = (event: MouseEvent) => {
    const control = (event.target as Element | null)?.closest?.(CONTROL_SELECTOR);
    if (control) activate(control);
  };

  // Native <button>s already turn Enter/Space into a click; Webflow Divs and
  // Link Blocks carrying role="button" don't.
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const target = event.target as Element | null;
    const handle = target?.closest?.(HANDLE_SELECTOR);
    if (handle) {
      event.preventDefault();
      update({ sheet: nextSnapOnTap(state.sheet) });
      return;
    }
    const control = target?.closest?.(CONTROL_SELECTOR);
    if (!control || control instanceof HTMLButtonElement) return;
    event.preventDefault();
    activate(control);
  };

  const clearDrag = () => {
    if (!sheet) return;
    sheet.style.transform = '';
    sheet.classList.remove(DRAGGING_CLASS);
  };

  const onBreakpoint = () => {
    clearDrag();
    state = { ...DEFAULT_STATE, layout: state.layout };
    render();
  };

  document.addEventListener('click', onClick);
  document.addEventListener('keydown', onKeyDown);
  desktop.addEventListener('change', onBreakpoint);
  render();

  return {
    getState: () => ({ ...state }),
    destroy() {
      document.removeEventListener('click', onClick);
      document.removeEventListener('keydown', onKeyDown);
      desktop.removeEventListener('change', onBreakpoint);
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/webflow/viewController.test.ts`
Expected: PASS.

- [ ] **Step 5: Type-check and commit**

Run: `npx tsc --noEmit` (expected: no errors)

```bash
git add src/webflow/viewController.ts src/webflow/viewController.test.ts
git commit -m "View controller: pill, layout toggle, expand button, breakpoint reset"
```

---

### Task 4: Sheet drag

**Files:**
- Create: `src/webflow/sheetDrag.ts`
- Modify: `src/webflow/viewController.ts`

**Interfaces:**
- Consumes: `computeSnapPoints`, `clampOffset`, `resolveSnap`, `nextSnapOnTap`, `TAP_THRESHOLD`, `DEFAULT_PEEK_VISIBLE`, `SheetSnap` from `./sheetSnap`.
- Produces:
  - `interface SheetDragOptions { sheet: HTMLElement; handle: HTMLElement; isEnabled(): boolean; getSnap(): SheetSnap; onSnap(snap: SheetSnap): void }`
  - `interface SheetDrag { cancel(): void; destroy(): void }`
  - `attachSheetDrag(options: SheetDragOptions): SheetDrag`

Pointer events are not reliably available in jsdom, so this task is verified in the browser in Task 8 (drag, flick, tap). The snap decisions themselves are already unit-tested in Task 1.

- [ ] **Step 1: Write `sheetDrag.ts`**

Create `src/webflow/sheetDrag.ts`:

```ts
import {
  DEFAULT_PEEK_VISIBLE,
  TAP_THRESHOLD,
  clampOffset,
  computeSnapPoints,
  nextSnapOnTap,
  resolveSnap,
  type SheetSnap,
  type SnapPoints,
} from './sheetSnap';

export interface SheetDragOptions {
  sheet: HTMLElement;
  handle: HTMLElement;
  /** False on desktop: the handle is hidden there, but guard anyway. */
  isEnabled(): boolean;
  getSnap(): SheetSnap;
  onSnap(snap: SheetSnap): void;
}

export interface SheetDrag {
  cancel(): void;
  destroy(): void;
}

const DRAGGING_CLASS = 'is-sheet-dragging';
// Velocity is measured over the last stretch of the drag, not the whole of it.
const VELOCITY_WINDOW_MS = 100;

interface Sample {
  y: number;
  t: number;
}

function readPeekVisible(sheet: HTMLElement): number {
  const value = parseFloat(getComputedStyle(sheet).getPropertyValue('--cm-sheet-peek'));
  return Number.isFinite(value) ? value : DEFAULT_PEEK_VISIBLE;
}

/**
 * Drags the mobile sheet by its handle. While dragging, the sheet follows the
 * pointer through an inline transform (CSS transitions off via
 * `is-sheet-dragging`); on release it hands the chosen snap to `onSnap`, which
 * sets the class, and drops the inline transform so CSS animates to the snap.
 */
export function attachSheetDrag(options: SheetDragOptions): SheetDrag {
  const { sheet, handle } = options;

  let pointerId: number | null = null;
  let startY = 0;
  let startOffset = 0;
  let offset = 0;
  let points: SnapPoints = { full: 0, half: 0, peek: 0 };
  let samples: Sample[] = [];

  const reset = () => {
    if (pointerId !== null && handle.hasPointerCapture?.(pointerId)) {
      handle.releasePointerCapture(pointerId);
    }
    pointerId = null;
    samples = [];
    sheet.style.transform = '';
    sheet.classList.remove(DRAGGING_CLASS);
  };

  const onPointerDown = (event: PointerEvent) => {
    if (!event.isPrimary || !options.isEnabled() || pointerId !== null) return;
    pointerId = event.pointerId;
    handle.setPointerCapture?.(event.pointerId);
    points = computeSnapPoints(sheet.offsetHeight, readPeekVisible(sheet));
    startY = event.clientY;
    startOffset = points[options.getSnap()];
    offset = startOffset;
    samples = [{ y: event.clientY, t: event.timeStamp }];
    sheet.classList.add(DRAGGING_CLASS);
  };

  const onPointerMove = (event: PointerEvent) => {
    if (event.pointerId !== pointerId) return;
    offset = clampOffset(startOffset + (event.clientY - startY), points);
    sheet.style.transform = `translateY(${offset}px)`;
    samples.push({ y: event.clientY, t: event.timeStamp });
    while (samples.length > 2 && event.timeStamp - samples[0].t > VELOCITY_WINDOW_MS) {
      samples.shift();
    }
  };

  const onPointerUp = (event: PointerEvent) => {
    if (event.pointerId !== pointerId) return;
    const travel = Math.abs(event.clientY - startY);
    const first = samples[0];
    const elapsed = event.timeStamp - first.t;
    const velocity = elapsed > 0 ? (event.clientY - first.y) / elapsed : 0;
    const current = options.getSnap();

    const target =
      travel < TAP_THRESHOLD ? nextSnapOnTap(current) : resolveSnap(offset, velocity, points);
    // Set the target class first, then drop the inline transform in the same
    // frame, so the transition runs from where the finger let go.
    options.onSnap(target);
    reset();
  };

  const onPointerCancel = (event: PointerEvent) => {
    if (event.pointerId === pointerId) reset();
  };

  handle.addEventListener('pointerdown', onPointerDown);
  handle.addEventListener('pointermove', onPointerMove);
  handle.addEventListener('pointerup', onPointerUp);
  handle.addEventListener('pointercancel', onPointerCancel);

  return {
    cancel: reset,
    destroy() {
      reset();
      handle.removeEventListener('pointerdown', onPointerDown);
      handle.removeEventListener('pointermove', onPointerMove);
      handle.removeEventListener('pointerup', onPointerUp);
      handle.removeEventListener('pointercancel', onPointerCancel);
    },
  };
}
```

- [ ] **Step 2: Wire it into the controller**

In `src/webflow/viewController.ts`, add the import:

```ts
import { attachSheetDrag } from './sheetDrag';
```

After `const sheet = root.querySelector<HTMLElement>(SHEET_SELECTOR);`, add:

```ts
  const handle = root.querySelector<HTMLElement>(HANDLE_SELECTOR);
```

Replace the `clearDrag` function with:

```ts
  const drag =
    sheet && handle
      ? attachSheetDrag({
          sheet,
          handle,
          isEnabled: () => !desktop.matches,
          getSnap: () => state.sheet,
          onSnap: (snap) => update({ sheet: snap }),
        })
      : null;

  const clearDrag = () => {
    drag?.cancel();
    if (!sheet) return;
    sheet.style.transform = '';
    sheet.classList.remove(DRAGGING_CLASS);
  };
```

In `destroy()`, add as the last line:

```ts
      drag?.destroy();
```

- [ ] **Step 3: Run all tests and type-check**

Run: `npm test && npx tsc --noEmit`
Expected: all tests PASS (Task 3's breakpoint test now also exercises `drag.cancel()`), no type errors.

- [ ] **Step 4: Commit**

```bash
git add src/webflow/sheetDrag.ts src/webflow/viewController.ts
git commit -m "Drag the mobile project sheet between snap points"
```

---

### Task 5: Reveal the card on `cm:select`

**Files:**
- Modify: `src/lib/cmsSource.ts`
- Modify: `src/webflow/viewController.ts`
- Test: `src/webflow/viewController.test.ts`

**Interfaces:**
- Consumes: `findCmsItem` from `../lib/cmsSource`.
- Produces: `export const SELECT_EVENT = 'cm:select'` in `src/lib/cmsSource.ts`, with `detail: { id: string }`. Task 6 dispatches it.

Behavior:
- Unknown id (no card on the page) → ignored, no state change.
- Desktop, map view, expanded → set `split`, wait two animation frames, then scroll.
- Mobile, sheet at peek → set `half`, wait for `transitionend` on the sheet (`transform`), or 450 ms, whichever first; with reduced motion, one animation frame. Then scroll.
- Otherwise → scroll now.
- Scroll = `card.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'nearest' })`.

- [ ] **Step 1: Add the event constant**

In `src/lib/cmsSource.ts`, after `export const HOVER_CLASS = 'is-cm-hover';`, add:

```ts

/**
 * Dispatched on `document` by the embed when a marker is clicked, with
 * `detail: { id }`. The page's view controller reveals and scrolls to the
 * matching card.
 */
export const SELECT_EVENT = 'cm:select';
```

- [ ] **Step 2: Write the failing tests**

Append to `src/webflow/viewController.test.ts`. First extend the import lines at the top of the file:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SELECT_EVENT } from '../lib/cmsSource';
```

(replace the existing `vitest` import line with the one above). Then append:

```ts
describe('cm:select', () => {
  let scrollSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers({
      toFake: ['setTimeout', 'clearTimeout', 'requestAnimationFrame', 'cancelAnimationFrame'],
    });
    scrollSpy = vi.fn();
    Element.prototype.scrollIntoView = scrollSpy as unknown as Element['scrollIntoView'];
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
    expect(scrollSpy).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(1000);
    expect(scrollSpy).toHaveBeenCalledTimes(1);
  });

  it('falls back when transitionend never fires', () => {
    const root = mountDom();
    controller = initViewController(root, {
      matchMedia: fakeMatchMedia(false).matchMedia,
      prefersReducedMotion: () => false,
    });
    select('alpha');
    vi.advanceTimersByTime(449);
    expect(scrollSpy).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(scrollSpy).toHaveBeenCalledTimes(1);
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
    expect(scrollSpy).toHaveBeenCalledTimes(1);
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
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run src/webflow/viewController.test.ts`
Expected: the new `cm:select` tests FAIL (no scroll, no class change); earlier tests still PASS.

- [ ] **Step 4: Implement**

In `src/webflow/viewController.ts`, add the import:

```ts
import { SELECT_EVENT, findCmsItem } from '../lib/cmsSource';
```

Add near the other constants:

```ts
// Longer than the sheet's CSS transition, in case transitionend never fires.
const SHEET_SETTLE_FALLBACK_MS = 450;
```

Inside `initViewController`, after `const matchMedia = ...`, add:

```ts
  const prefersReducedMotion =
    options.prefersReducedMotion ??
    (() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
```

After the `onBreakpoint` function, add:

```ts
  const scrollToCard = (card: HTMLElement) => {
    card.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'nearest' });
  };

  // Two frames: the first applies the class change, the second runs after
  // layout, so the card has its final position.
  const afterLayout = (callback: () => void) => {
    requestAnimationFrame(() => requestAnimationFrame(callback));
  };

  const afterSheetSettles = (callback: () => void) => {
    if (!sheet || prefersReducedMotion()) {
      requestAnimationFrame(callback);
      return;
    }
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      sheet.removeEventListener('transitionend', onEnd);
      clearTimeout(timer);
      callback();
    };
    const onEnd = (event: TransitionEvent) => {
      if (event.target === sheet && event.propertyName === 'transform') finish();
    };
    sheet.addEventListener('transitionend', onEnd);
    const timer = setTimeout(finish, SHEET_SETTLE_FALLBACK_MS);
  };

  const onSelect = (event: Event) => {
    const id = (event as CustomEvent<{ id?: string }>).detail?.id;
    const card = id ? findCmsItem(id) : null;
    if (!card) return;

    if (desktop.matches && state.view === 'map' && state.mapSize === 'expanded') {
      update({ mapSize: 'split' });
      afterLayout(() => scrollToCard(card));
    } else if (!desktop.matches && state.sheet === 'peek') {
      update({ sheet: 'half' });
      afterSheetSettles(() => scrollToCard(card));
    } else {
      scrollToCard(card);
    }
  };
```

Register and unregister it next to the other listeners:

```ts
  document.addEventListener(SELECT_EVENT, onSelect);
```

and in `destroy()`:

```ts
      document.removeEventListener(SELECT_EVENT, onSelect);
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test && npx tsc --noEmit`
Expected: all PASS, no type errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/cmsSource.ts src/webflow/viewController.ts src/webflow/viewController.test.ts
git commit -m "Reveal and scroll to the card when a marker is selected"
```

---

### Task 6: Map side — select-only markers, no modal, no card click

**Files:**
- Modify: `src/components/map/ClusterLayer.tsx:31-111`
- Modify: `src/components/map/MapPanel.tsx:17,61`
- Modify: `src/components/layout/MapOnlyLayout.tsx` (whole file)
- Modify: `src/hooks/useCmsBridge.ts` (whole file)

**Interfaces:**
- Consumes: `SELECT_EVENT` from `src/lib/cmsSource.ts` (Task 5).
- Produces: `ClusterLayer({ selectOnly?: boolean })`, `MapPanel({ syncBounds?: boolean; selectOnly?: boolean })`.

- [ ] **Step 1: `ClusterLayer` select-only mode**

In `src/components/map/ClusterLayer.tsx`:

Add to the imports:

```ts
import { SELECT_EVENT } from '../../lib/cmsSource';
```

Replace the component signature line:

```ts
export function ClusterLayer() {
```

with:

```ts
/**
 * `selectOnly` (the Webflow embed): a marker click selects the location and
 * tells the page via SELECT_EVENT, which highlights and reveals the card.
 * No detail modal. Off (the standalone explorer): a click opens the modal.
 */
export function ClusterLayer({ selectOnly = false }: { selectOnly?: boolean }) {
```

In the "Rebuild markers" effect, replace this block:

```ts
      marker.on('click', () => selectLocation(location.id, { openDetail: true }));
```

with:

```ts
      const activate = () => {
        if (selectOnly) {
          selectLocation(location.id);
          document.dispatchEvent(new CustomEvent(SELECT_EVENT, { detail: { id: location.id } }));
        } else {
          selectLocation(location.id, { openDetail: true });
        }
      };

      marker.on('click', activate);
```

Replace:

```ts
        el.setAttribute('aria-label', `${locationAriaLabel(location)} — open details`);
        el.addEventListener('keydown', (event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            selectLocation(location.id, { openDetail: true });
          }
        });
```

with:

```ts
        el.setAttribute(
          'aria-label',
          `${locationAriaLabel(location)} — ${selectOnly ? 'show in project list' : 'open details'}`,
        );
        el.addEventListener('keydown', (event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            activate();
          }
        });
```

Update that effect's dependency array from:

```ts
  }, [locations, selectedLocationId, selectLocation, setHovered, tagClusters]);
```

to:

```ts
  }, [locations, selectedLocationId, selectLocation, setHovered, tagClusters, selectOnly]);
```

- [ ] **Step 2: `MapPanel` passes it through**

In `src/components/map/MapPanel.tsx`, replace:

```ts
export function MapPanel({ syncBounds = true }: { syncBounds?: boolean }) {
```

with:

```ts
export function MapPanel({
  syncBounds = true,
  selectOnly = false,
}: {
  syncBounds?: boolean;
  selectOnly?: boolean;
}) {
```

and replace `<ClusterLayer />` with:

```tsx
            <ClusterLayer selectOnly={selectOnly} />
```

Also extend the doc comment above `MapPanel` with a final line:

```ts
 * `selectOnly` makes marker clicks highlight the CMS card instead of opening
 * the detail modal (see ClusterLayer).
```

- [ ] **Step 3: `MapOnlyLayout` without the modal**

Replace the whole of `src/components/layout/MapOnlyLayout.tsx` with:

```tsx
import { useCmsBridge } from '../../hooks/useCmsBridge';
import { MapPanel } from '../map/MapPanel';

/**
 * The Webflow embed: map only. The project list and its filter live on the
 * host page as a CMS Collection List; useCmsBridge keeps the two in sync.
 * A marker click highlights its card (no modal); the page's view controller
 * reveals and scrolls to it.
 */
export function MapOnlyLayout() {
  useCmsBridge();

  return (
    <div className="relative h-full overflow-hidden bg-ink text-paper">
      <MapPanel syncBounds={false} selectOnly />
    </div>
  );
}
```

- [ ] **Step 4: `useCmsBridge` without card click or scroll**

Replace the whole of `src/hooks/useCmsBridge.ts` with:

```ts
import { useEffect } from 'react';
import { useMapExplorer } from './useMapExplorer';
import {
  ACTIVE_CLASS,
  HOVER_CLASS,
  ITEM_SELECTOR,
  findCmsItem,
  findCmsList,
  getCmsItemId,
} from '../lib/cmsSource';

function itemFrom(target: EventTarget | null): HTMLElement | null {
  return target instanceof Element ? target.closest<HTMLElement>(ITEM_SELECTOR) : null;
}

function setExclusiveClass(className: string, id: string | null) {
  document.querySelectorAll(`.${className}`).forEach((el) => el.classList.remove(className));
  if (id) findCmsItem(id)?.classList.add(className);
}

/**
 * Links the Webflow Collection List (light DOM, outside the embed's shadow
 * root) to the map's selection/hover state:
 *   card hover → marker highlight;
 *   marker hover/select → HOVER_CLASS / ACTIVE_CLASS on the card, which the
 *   Webflow Designer styles.
 * A card click is a plain link to the project page. Scrolling the selected
 * card into view is the page's view controller's job (src/webflow), since it
 * may first have to bring the list back.
 */
export function useCmsBridge() {
  const { locations, selectedLocationId, hoveredLocationId, setHovered } = useMapExplorer();

  useEffect(() => {
    const list = findCmsList();
    if (!list) return;

    // mouseover/mouseout (not enter/leave) so one delegated listener covers
    // items Finsweet adds later; relatedTarget filters out moves between an
    // item's own children.
    const handleOver = (event: MouseEvent) => {
      const item = itemFrom(event.target);
      if (!item || item.contains(event.relatedTarget as Node | null)) return;
      const id = getCmsItemId(item);
      if (id) setHovered(id);
    };
    const handleOut = (event: MouseEvent) => {
      const item = itemFrom(event.target);
      if (!item || item.contains(event.relatedTarget as Node | null)) return;
      setHovered(null);
    };

    list.addEventListener('mouseover', handleOver);
    list.addEventListener('mouseout', handleOut);
    return () => {
      list.removeEventListener('mouseover', handleOver);
      list.removeEventListener('mouseout', handleOut);
    };
  }, [setHovered]);

  // `locations` is a dependency so classes are re-applied after the filter
  // re-renders items (Finsweet may swap in fresh nodes).
  useEffect(() => {
    setExclusiveClass(HOVER_CLASS, hoveredLocationId);
  }, [hoveredLocationId, locations]);

  useEffect(() => {
    setExclusiveClass(ACTIVE_CLASS, selectedLocationId);
  }, [selectedLocationId, locations]);
}
```

- [ ] **Step 5: Verify both builds still compile**

Run: `npx tsc --noEmit && npm test`
Expected: no type errors, tests PASS.

Run: `npm run build`
Expected: SPA build succeeds (standalone app untouched: `ExplorerLayout` still renders the modal and `ClusterLayer` defaults to `selectOnly={false}`).

- [ ] **Step 6: Commit**

```bash
git add src/components/map/ClusterLayer.tsx src/components/map/MapPanel.tsx src/components/layout/MapOnlyLayout.tsx src/hooks/useCmsBridge.ts
git commit -m "Embed: marker click highlights the card, no modal; card click is a link"
```

---

### Task 7: Embed wiring + v3 output

**Files:**
- Modify: `src/embed.tsx`
- Modify: `vite.embed.config.ts:39-55`

**Interfaces:**
- Consumes: `initViewController` from `./webflow/viewController` (Tasks 3–5).
- Produces: `dist-embed/consortium-map-v3.js`, `dist-embed/consortium-map-v3.css`.

- [ ] **Step 1: Init the controller and point CSS at v3**

In `src/embed.tsx`:

Add to the imports:

```ts
import { initViewController } from './webflow/viewController';
```

Replace:

```ts
const CSS_URL = 'https://consortium-map-embed-fwd-projects.vercel.app/consortium-map-v2.css';
```

with:

```ts
const CSS_URL = 'https://consortium-map-embed-fwd-projects.vercel.app/consortium-map-v3.css';
```

Replace the trailing `mount();` with:

```ts
mount();

// View modes (Map/Portfolio, grid/list, expanded map, mobile sheet). The
// script tag is deferred, so the page is parsed by now.
const explorer = document.querySelector<HTMLElement>('.map-explorer');
if (explorer) {
  initViewController(explorer);
} else {
  console.warn('[consortium-map-embed] .map-explorer not found — view modes disabled');
}
```

- [ ] **Step 2: Rename outputs**

In `vite.embed.config.ts`, replace:

```ts
          entryFileNames: 'consortium-map-v2.js',
```

with:

```ts
          entryFileNames: 'consortium-map-v3.js',
```

and:

```ts
              ? 'consortium-map-v2.[ext]'
```

with:

```ts
              ? 'consortium-map-v3.[ext]'
```

- [ ] **Step 3: Build**

Run: `npm run build:embed && ls dist-embed`
Expected: build succeeds; `dist-embed/` contains `consortium-map-v3.js`, `consortium-map-v3.css`, `assets/`, `fonts/`, and no v2 files.

- [ ] **Step 4: Commit**

```bash
git add src/embed.tsx vite.embed.config.ts
git commit -m "Ship the view-mode embed as consortium-map-v3.*"
```

---

### Task 8: View-mode CSS + fixture + browser verification

**Files:**
- Create: `webflow/view-modes.css`
- Modify: `dev/webflow-cms-fixture.html`

**Interfaces:**
- Consumes: v3 build (Task 7); class and attribute contract (Global Constraints).
- Produces: `webflow/view-modes.css`, pasted verbatim into Webflow in Task 10.

New Webflow class names used by the CSS (Task 10 creates them in the Designer):

| Class | Element |
|---|---|
| `map-view-toggle`, `map-view-toggle_button` | Portfolio/Map pill and its two buttons |
| `map-explorer_header` | Row holding the title and the layout toggle |
| `layout-toggle`, `layout-toggle_button` | Grid/list icon buttons |
| `map-explorer_sheet-handle`, `map-explorer_sheet-bar` | Mobile drag handle and its visible bar |
| `map-explorer_scroll` | Wrapper around header + Collection List inside the list column |
| `map-explorer_items` | The Collection List (`.w-dyn-items`, carries `fs-list-element="list"`) |
| `map-expand-button` | 31×31 expand button over the map |
| `project-card_link` | Link Block wrapping each card |
| `project-card_tag-inline` | Second category tag, inside `.project-card_body`, shown only in list rows |

- [ ] **Step 1: Write the CSS**

Create `webflow/view-modes.css`:

```css
/*
 * Projects page view modes — Map/Portfolio, grid/list, expanded map,
 * mobile sheet. State-dependent rules only; base styles live in Webflow
 * Designer classes. Source of truth: paste this file verbatim into the
 * "View modes CSS" Embed on the Projects page (inside a <style> tag).
 * State classes are set on .map-explorer by src/webflow/viewController.ts.
 */

[data-cm-sheet] { --cm-sheet-peek: 72px; }

/* ---------- Cards: grid by default (split list, portfolio, sheet) ---------- */

.map-explorer_items {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1.5rem 0.75rem;
}
.map-explorer_items .project-card {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 0.5rem;
  padding: 0;
}
.map-explorer_items .project-card_image-wrap {
  width: 100%;
  height: auto;
  aspect-ratio: 211 / 120;
}
.project-card_link { display: block; color: inherit; text-decoration: none; }
.project-card_tag-inline { display: none; }

/* ---------- Cards: list rows ---------- */

.map-explorer.is-list .map-explorer_items {
  grid-template-columns: 1fr;
  gap: 0;
}
.map-explorer.is-list .map-explorer_items .project-card {
  flex-direction: row;
  align-items: center;
  gap: 1.5rem;
  padding: 0.5rem 0;
  border-bottom: 1px solid rgba(242, 240, 235, 0.15);
}
.map-explorer.is-list .map-explorer_items .project-card_image-wrap {
  width: 9rem;
  flex: none;
  aspect-ratio: 144 / 71;
}
.map-explorer.is-list .project-card_image-wrap .project-card_tag { display: none; }
.map-explorer.is-list .project-card_body {
  display: flex;
  flex: 1;
  align-items: center;
  gap: 1rem;
  min-width: 0;
}
.map-explorer.is-list .project-card_tag-inline { display: inline-block; }
.map-explorer.is-list .project-card_location { margin-left: auto; text-align: right; }

/* ---------- Desktop ---------- */

@media (min-width: 992px) {
  .map-explorer { position: relative; }
  .map-explorer_sheet-handle { display: none; }
  .layout-toggle { display: none; }
  .map-expand-button {
    position: absolute;
    top: 1rem;
    right: 1rem;
    z-index: 10;
  }
  .map-view-toggle {
    position: fixed;
    left: 50%;
    bottom: 1rem;
    z-index: 50;
    transform: translateX(-50%);
  }

  /* Expanded: list out, map takes the full width. */
  .map-explorer.is-map-expanded .map-explorer_list { display: none; }

  /* Portfolio: list full width; map stays mounted but hidden and out of flow.
     Never display:none — a 0x0 Leaflet container corrupts its bounds. */
  .map-explorer.is-portfolio { height: auto; }
  .map-explorer.is-portfolio .map-explorer_list {
    width: 100%;
    flex: 1 1 auto;
    overflow: visible;
  }
  .map-explorer.is-portfolio .map-explorer_map {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100vh;
    visibility: hidden;
    pointer-events: none;
  }
  .map-explorer.is-portfolio .layout-toggle { display: flex; }
  .map-explorer.is-portfolio .map-explorer_items {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 2rem 0.75rem;
  }
  .map-explorer.is-portfolio.is-list .map-explorer_items { grid-template-columns: 1fr; gap: 0; }
}

/* ---------- Mobile: bottom sheet over the map ---------- */

@media (max-width: 991px) {
  .map-view-toggle { display: none; }

  .filter_form {
    flex-wrap: nowrap;
    justify-content: flex-start;
    overflow-x: auto;
    scrollbar-width: none;
  }
  .filter_form::-webkit-scrollbar { display: none; }
  .filter_option { flex: none; }

  .map-explorer {
    position: relative;
    display: block;
    height: 100svh;
    overflow: hidden;
  }
  .map-explorer_map { position: absolute; inset: 0; }
  .map-expand-button {
    position: absolute;
    top: 1rem;
    right: 1rem;
    z-index: 10;
  }

  [data-cm-sheet] {
    position: absolute;
    inset: 0;
    z-index: 20;
    width: auto;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    padding-top: 0;
    touch-action: none;
    transition: transform 300ms cubic-bezier(0.2, 0.8, 0.2, 1);
  }
  [data-cm-sheet].is-sheet-dragging { transition: none; }
  .map-explorer.is-sheet-peek [data-cm-sheet] {
    transform: translateY(calc(100% - var(--cm-sheet-peek)));
  }
  .map-explorer.is-sheet-half [data-cm-sheet] { transform: translateY(50%); }
  .map-explorer.is-sheet-full [data-cm-sheet] { transform: translateY(0); touch-action: auto; }

  .map-explorer_sheet-handle {
    display: flex;
    justify-content: center;
    padding: 0.75rem 0;
    cursor: grab;
    touch-action: none;
  }
  .map-explorer_sheet-bar {
    width: 3.5rem;
    height: 3px;
    background: rgba(242, 240, 235, 0.5);
  }

  .map-explorer_scroll { flex: 1; min-height: 0; overflow: hidden; }
  .map-explorer.is-sheet-full .map-explorer_scroll { overflow-y: auto; touch-action: pan-y; }

  .layout-toggle { display: flex; }

  .map-explorer.is-list .map-explorer_items .project-card { gap: 1rem; }
  .map-explorer.is-list .map-explorer_items .project-card_image-wrap { width: 6rem; }
  .map-explorer.is-list .project-card_body { flex-wrap: wrap; gap: 0.25rem 0.75rem; }
  .map-explorer.is-list .project-card_location { margin-left: 0; flex-basis: 100%; text-align: left; }
}

@media (prefers-reduced-motion: reduce) {
  [data-cm-sheet] { transition: none; }
}
```

- [ ] **Step 2: Update the fixture**

In `dev/webflow-cms-fixture.html`:

1. In the header comment, replace `(DEV - Map v2 site)` with `(DEV - Consortium V6 site, view modes)`.
2. Inside `<head>`, after the existing `</style>`, add:

```html
    <link rel="stylesheet" href="/webflow/view-modes.css" />
    <style>
      /* Fixture-only stand-ins for Designer base styles of the new elements. */
      .map-view-toggle { display: flex; gap: 4px; padding: 4px; background: #e8e4dc; }
      .map-view-toggle_button, .layout-toggle_button, .map-expand-button { border: 0; font: inherit; cursor: pointer; }
      .map-view-toggle_button { padding: 4px 8px; background: transparent; color: #2a2a2a; font-family: monospace; text-transform: uppercase; }
      .map-view-toggle_button.is-active { background: #2a2a2a; color: #f2f0eb; }
      .map-explorer_header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; }
      .map-explorer_header .map-explorer_title { margin-bottom: 0; }
      .layout-toggle { gap: 4px; padding: 4px; border: 1px solid #555; }
      .layout-toggle_button { width: 20px; height: 20px; background: transparent; color: #f2f0eb; }
      .layout-toggle_button.is-active { background: #555; }
      .map-expand-button { width: 31px; height: 31px; background: #2a2a2a; color: #f2f0eb; }
      .map-explorer_list { background: #0e0f11; }
      .project-card_tag-inline { padding: 2px 4px; background: #e8e4dc; color: #0e0f11; font-size: 0.6rem; text-transform: uppercase; }
    </style>
```

3. Before `<div class="map-explorer">`, add the pill:

```html
    <div class="map-view-toggle" role="group" aria-label="Projects view">
      <button class="map-view-toggle_button" type="button" data-cm-view="portfolio">Portfolio</button>
      <button class="map-view-toggle_button" type="button" data-cm-view="map">Map view</button>
    </div>
```

4. Replace the opening of the list column:

```html
      <div class="map-explorer_list">
        <div class="map-explorer_title">Our projects</div>
        <div class="w-dyn-list" data-cm-list="true">
          <div role="list" class="w-dyn-items" fs-list-element="list">
```

with:

```html
      <div class="map-explorer_list" data-cm-sheet>
        <div class="map-explorer_sheet-handle" data-cm-sheet-handle role="button" tabindex="0" aria-label="Resize project list"><div class="map-explorer_sheet-bar"></div></div>
        <div class="map-explorer_scroll">
        <div class="map-explorer_header">
          <div class="map-explorer_title">Our projects</div>
          <div class="layout-toggle" role="group" aria-label="Layout">
            <button class="layout-toggle_button" type="button" data-cm-layout="grid" aria-label="Grid">▦</button>
            <button class="layout-toggle_button" type="button" data-cm-layout="list" aria-label="List">≡</button>
          </div>
        </div>
        <div class="w-dyn-list" data-cm-list="true">
          <div role="list" class="w-dyn-items map-explorer_items" fs-list-element="list">
```

and add one extra `</div>` (closing `.map-explorer_scroll`) right after the Collection List's closing `</div>` that ends `<div class="w-dyn-list" data-cm-list="true">`, before the `</div>` that closes `.map-explorer_list`.

5. For each of the ten real project items, wrap the `.project-card` in a link to `/work/<id>` and add the inline tag after the name. For example, the first item becomes:

```html
          <div role="listitem" class="w-dyn-item">
            <a class="project-card_link" href="/work/brentwood-vistas">
            <div class="project-card" data-cm-item="true">
              <div class="project-card_image-wrap">
                <img class="project-card_image" data-cm-field="image" src="https://picsum.photos/seed/cm-0/320/220" alt="Brentwood Vistas" />
                <div class="project-card_tag" fs-list-field="category" data-cm-field="category">Multi-Family</div>
              </div>
              <div class="project-card_body">
                <div class="project-card_name" data-cm-field="name">Brentwood Vistas</div>
                <div class="project-card_tag-inline">Multi-Family</div>
                <div class="project-card_location" data-cm-field="location">Brentwood, TN</div>
              </div>
              <div class="cm-data">
                <div data-cm-field="id">brentwood-vistas</div>
                <div data-cm-field="lat">36.0331</div>
                <div data-cm-field="lng">-86.7828</div>
              </div>
            </div>
            </a>
          </div>
```

Apply the same two changes to the other nine items, using each item's own `data-cm-field="id"` value in the `href` and its own category text in `.project-card_tag-inline`. Leave the "Editor Typo Project" item unwrapped.

6. Inside `.map-explorer_map`, before `#consortium-map-root`, add:

```html
        <button class="map-expand-button" type="button" data-cm-expand aria-label="Expand map">⤢</button>
```

7. Change the mount's CSS URL and the script tag from v2 to v3:

```html
        <div id="consortium-map-root" style="height: 100%; min-height: 600px" data-css-url="/dist-embed/consortium-map-v3.css"></div>
```

```html
        <script src="/dist-embed/consortium-map-v3.js" defer></script>
```

8. In the fixture's own `<style>`, delete the now-conflicting lines `.project-card { display: flex; gap: 1rem; align-items: center; padding: 0.75rem; border-left: 3px solid transparent; cursor: pointer; }` and `.project-card_image-wrap { position: relative; width: 9rem; height: 6.25rem; flex: none; overflow: hidden; }`, replacing them with:

```css
      .project-card { border-left: 3px solid transparent; cursor: pointer; }
      .project-card_image-wrap { position: relative; overflow: hidden; }
```

On mobile the fixture's `min-height: 600px` on the mount would fight the sheet layout; change the mount's inline style to `style="height: 100%"`.

- [ ] **Step 3: Serve the fixture**

Run (background): `npm run build:embed && python3 -m http.server 4321`
Open: `http://localhost:4321/dev/webflow-cms-fixture.html` with the Playwright MCP browser.

- [ ] **Step 4: Verify desktop at 1440×900**

Resize to 1440×900. Check each, taking a screenshot after each state:

1. Default: list on the left as a 2-column card grid, map on the right with markers, pill at the bottom with "Map view" active, no grid/list toggle visible.
2. Click the expand button → list gone, map full width, tiles cover the whole area (no grey strip). Click again → split.
3. Expand, then click a marker (zoom in if needed to get a single pin) → list returns, the card has `is-cm-active` and is scrolled into view. No modal appears.
4. Hover a card → its marker (or cluster) gets `map-hover-highlight`.
5. Click a card → browser navigates to `/work/<slug>` (404 on the fixture server is expected). Go back.
6. Click "Portfolio" → no map, 3-column cards, grid/list toggle visible. Click list → rows with thumbnail, name, inline tag, location on the right.
7. **Portfolio → filter → Map:** in Portfolio, select the "Hospitality" filter → only matching cards. Click "Map view" → split view, map shows only Hospitality markers, tiles render at full size (no grey strip). Select "All".
8. **Filter in every view:** in split, expanded and Portfolio list, change the filter and confirm card and marker counts match.

Run `browser_evaluate` with `document.querySelector('.map-explorer').className` at each step to confirm the classes match the Global Constraints.

- [ ] **Step 5: Verify mobile at 393×881**

Reload at 393×881:

1. Loads at peek: map fills the screen, only the handle and "Our projects" visible at the bottom, no pill.
2. Tap the handle → half; tap → full (cards scroll inside the sheet); tap → peek.
3. Drag the handle up slowly from peek and release near the middle → snaps to half. Flick down from half → peek.
4. At peek, tap a single marker → sheet opens to half and the card scrolls into view with `is-cm-active`.
5. At half, tap the expand button → peek.
6. Toggle list in the sheet → rows.
7. Filter chips scroll horizontally.
8. With the sheet at half, resize to 1440 → desktop split default, no inline `transform` on the sheet (`document.querySelector('[data-cm-sheet]').style.transform === ''`). Resize back to 393 → peek.

Check the console: no errors (the "Editor Typo Project" warning is expected).

- [ ] **Step 6: Commit**

```bash
git add webflow/view-modes.css dev/webflow-cms-fixture.html
git commit -m "View-mode CSS and fixture markup for map/portfolio/sheet"
```

---

### Task 9: README

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Update the embed section**

In the "Embeddable widget (Webflow build)" section:

- In the build output code block, replace `consortium-map-v2.js` / `consortium-map-v2.css` with `consortium-map-v3.js` / `consortium-map-v3.css`.
- Replace the paragraph starting "**Two versions are served side by side.**" with:

```markdown
**Three versions are served side by side.** `consortium-map.js` / `.css` (v1) is the original self-contained list + map. `consortium-map-v2.js` / `.css` is the map-only, CMS-driven build where a card click zooms the map and a marker opens a detail modal. Both are frozen and still used by older pages. `consortium-map-v3.js` / `.css` is what this repo now produces: view modes, marker click highlights the card, card click opens the project page. A Vercel deploy replaces *every* file, so each deploy must include the v1 and v2 files too. Download them from the live URLs before deploying:
```

- In the deploy code block, after the existing two `curl` lines, add:

```bash
curl -sfO https://consortium-map-embed-fwd-projects.vercel.app/consortium-map-v2.js
curl -sfO https://consortium-map-embed-fwd-projects.vercel.app/consortium-map-v2.css
```

and change the comment on the `cp` line to `# v3 files + fonts/`.

- [ ] **Step 2: Update "How the list and map stay in sync"**

Replace the two bullets beginning "Clicking a card zooms the map" and "Hovering or clicking a marker adds" with:

```markdown
- Clicking a card opens the project page. Each card is wrapped in a Link Block bound to the Works Template page.
- Hovering a marker adds `is-cm-hover` to the matching card. Clicking a marker selects it, adds `is-cm-active` to the card and dispatches `cm:select` (`detail: { id }`) on `document`. There is no detail modal in the embed.
```

- [ ] **Step 3: Add a "View modes" section after "How the list and map stay in sync"**

```markdown
### View modes

`src/webflow/viewController.ts` (started by the embed) owns the page's view state and writes it as combo classes on `.map-explorer`:

| Class | Meaning |
|---|---|
| `is-portfolio` | Desktop Portfolio view: list full width, map hidden but mounted |
| `is-list` | List rows instead of cards (Portfolio on desktop, sheet on mobile) |
| `is-map-expanded` | Desktop map full width, list hidden |
| `is-sheet-peek` / `is-sheet-half` / `is-sheet-full` | Mobile (<992px) sheet position |

Controls are found by attribute, anywhere on the page:

| Attribute | Element |
|---|---|
| `data-cm-view="map"` / `"portfolio"` | Pill buttons |
| `data-cm-layout="grid"` / `"list"` | Layout toggle buttons |
| `data-cm-expand` | Expand button over the map (mobile: snaps the sheet to peek) |
| `data-cm-sheet` | The list column, which is the sheet on mobile |
| `data-cm-sheet-handle` | Sheet drag handle (drag, tap, or Enter/Space) |

The active control gets `is-active` and `aria-pressed="true"`.

On `cm:select`, the controller brings the list back if the map is expanded (desktop) or opens the sheet to half if it is at peek (mobile), then scrolls the card into view.

**CSS:** the Webflow Designer can't style a child based on a parent's combo class, so the state rules live in `webflow/view-modes.css`. Paste it verbatim into the "View modes CSS" Embed on the Projects page (inside `<style>…</style>`) whenever it changes. The fixture links the same file.

**The map is never `display:none`.** In Portfolio it is hidden with `visibility:hidden` and taken out of flow; `MapInvalidateOnShow` re-measures it when it comes back.
```

- [ ] **Step 4: Update the testing notes**

In the gotchas list, in the bullet about `dev/webflow-cms-fixture.html`, replace "a fake Collection List with the `data-cm-*` attributes, a category filter, and one deliberately broken item" with "a fake Collection List with the `data-cm-*` attributes, a category filter, the view-mode controls and sheet, and one deliberately broken item". Add a new bullet after it:

```markdown
- Unit tests (`npm test`, Vitest) cover the sheet snap maths, the state → class mapping and the view controller (jsdom). Pointer dragging is checked by hand in the fixture.
```

- [ ] **Step 5: Commit**

```bash
git add README.md
git commit -m "README: view modes, cm:select, v3 and three-version deploy"
```

---

### Task 10: Build it in Webflow (DEV - Consortium V6, Projects page)

**Files:** none in the repo. Webflow site `6aaa6d56fc57cb950af89e3f`, page `6aaa6d56fc57cb950af89e26`.

Use the Webflow MCP data tools (`data_element_tool`, `data_element_builder`, `data_style_tool`, `data_element_settings_tool`); the Designer bridge has been unreliable this session, and these work without it. Call `webflow_guide_tool` once first in a new session. Reuse existing classes where they exist. Before each structural change, `query_elements` the target to confirm IDs. The known IDs today:

| Element | ID (`component` is the page id `6aaa6d56fc57cb950af89e26`) |
|---|---|
| `.map-explorer` | `2a0546a3-dbf0-19d4-2918-575e7e4e6f1a` |
| `.map-explorer_list` | `2a0546a3-dbf0-19d4-2918-575e7e4e6f1b` |
| `.map-explorer_title` | `2a0546a3-dbf0-19d4-2918-575e7e4e6f1c` |
| Unnamed Block holding the Collection List | `2a0546a3-dbf0-19d4-2918-575e7e4e6f1e` |
| Collection List (`fs-list-element="list"`) | `2a0546a3-dbf0-19d4-2918-575e7e4e6f20` |
| `.project-card` | `5f81f060-b9c0-c726-707f-2bae69bacd18` |
| `.project-card_body` | `1f71f974-be18-1f7a-aab3-27d6ead6f5e3` |
| `.map-explorer_map` | `2a0546a3-dbf0-19d4-2918-575e7e4e6f25` |
| `map_embed` (HtmlEmbed) | `2a0546a3-dbf0-19d4-2918-575e7e4e6f26` |

- [ ] **Step 1: Read the current embed code**

Use `data_element_settings_tool` to read the `map_embed` HtmlEmbed's code. Save a copy to the scratchpad. Confirm which script/CSS version it loads and that it contains the Finsweet script and the radio prep script.

- [ ] **Step 2: Add attributes to existing elements**

- `.map-explorer_list`: attribute `data-cm-sheet` = `true`.
- Collection List (`…6f20`): add class `map-explorer_items` (keep `fs-list-element="list"`).

- [ ] **Step 3: Build the new structure inside `.map-explorer_list`**

Target tree (new elements in **bold**):

```
.map-explorer_list [data-cm-sheet]
├ **Div .map-explorer_sheet-handle** [data-cm-sheet-handle] [role=button] [tabindex=0] [aria-label="Resize project list"]
│ └ **Div .map-explorer_sheet-bar**
└ **Div .map-explorer_scroll**
  ├ **Div .map-explorer_header**
  │ ├ .map-explorer_title "Our projects"   (moved)
  │ └ **Div .layout-toggle** [role=group] [aria-label="Layout"]
  │   ├ **Div .layout-toggle_button** [data-cm-layout=grid] [role=button] [tabindex=0] [aria-label="Grid"]  (grid-01 icon, 12×12)
  │   └ **Div .layout-toggle_button** [data-cm-layout=list] [role=button] [tabindex=0] [aria-label="List"]  (3-line icon)
  └ existing Block (…6f1e) with the Collection List   (moved)
```

Icons: export `grid-01` (Figma `4512:33630`) and the 3-line list icon (`4512:33631`) as SVG via the Figma MCP and upload with `data_assets_tool`, or inline them as HtmlEmbed SVGs inside the buttons.

- [ ] **Step 4: Card link and inline tag**

- Wrap `.project-card` (`5f81f060-…`) in a **Link Block `.project-card_link`**, link type: Current Works item (Collection page). Check in `query_elements` afterwards that `data-cm-item` is still on `.project-card` and the `fs-list-field` tag is unchanged.
- Inside `.project-card_body`, between `.project-card_name` and `.project-card_location`, add **Div `.project-card_tag-inline`** bound to Work Category → Name. No `data-cm-field`, no `fs-list-field`.

- [ ] **Step 5: Expand button**

Inside `.map-explorer_map`, before `map_embed`, add **Div `.map-expand-button`** [data-cm-expand] [role=button] [tabindex=0] [aria-label="Expand map"], 31×31, with the corner-bracket icon from Figma `4513:34718` (export as SVG). Style per Figma (`get_design_context` on `4513:34718`).

- [ ] **Step 6: Portfolio/Map pill**

Before `.map-explorer` inside `.projects_section` (or wherever the section's direct children sit), add:

```
**Div .map-view-toggle** [role=group] [aria-label="Projects view"]
├ **Div .map-view-toggle_button** [data-cm-view=portfolio] [role=button] [tabindex=0] "Portfolio"
└ **Div .map-view-toggle_button** [data-cm-view=map] [role=button] [tabindex=0] "Map view"
```

Style per Figma node `4512:33556` (188×33 pill, 4px padding, active button dark with light text, mono uppercase). Add combo class `is-active` on `.map-view-toggle_button` and `.layout-toggle_button` with the active styles, so the controller's `is-active` is styled.

- [ ] **Step 7: Card hover/active styles**

Confirm `.project-card` combo classes `is-cm-hover` and `is-cm-active` still exist and read well in the new 2-column grid (Figma frame 1). Adjust in the Designer if needed.

- [ ] **Step 8: View modes CSS Embed**

Add an HtmlEmbed named **"View modes CSS"** as the first child of `.projects_section`, with content:

```html
<style>
/* paste webflow/view-modes.css here verbatim */
</style>
```

Paste the full contents of `webflow/view-modes.css` in place of the comment line.

- [ ] **Step 9: Point the map Embed at v3**

In the `map_embed` code read in Step 1, change `consortium-map-v2.js` → `consortium-map-v3.js`. If it sets `data-css-url`, change v2 → v3 there too. Leave the Finsweet and radio prep scripts untouched. Write it back with `data_element_settings_tool`.

- [ ] **Step 10: Re-read and confirm**

`query_elements` on `.map-explorer` with `children_depth: -1`. Confirm the tree in Step 3, all `data-cm-*` attributes, the Link Block, and that `data-cm-list`, `data-cm-item`, `data-cm-field` and `fs-list-*` attributes are unchanged from before.

---

### Task 11: Deploy and staging check

**Files:** none. **Requires explicit user approval before Step 3 and before Step 5.**

- [ ] **Step 1: Fresh build**

Run: `npm test && npm run build:embed`
Expected: tests PASS, `dist-embed/consortium-map-v3.*` present.

- [ ] **Step 2: Assemble the deploy folder**

```bash
rm -rf /tmp/cm-deploy && mkdir /tmp/cm-deploy && cd /tmp/cm-deploy
curl -sfO https://consortium-map-embed-fwd-projects.vercel.app/consortium-map.js
curl -sfO https://consortium-map-embed-fwd-projects.vercel.app/consortium-map.css
curl -sfO https://consortium-map-embed-fwd-projects.vercel.app/consortium-map-v2.js
curl -sfO https://consortium-map-embed-fwd-projects.vercel.app/consortium-map-v2.css
cp -R /Users/00_Claude/consortium-map/dist-embed/* .
ls
```

Expected: v1, v2 and v3 JS and CSS, plus `assets/` and `fonts/`. Each `curl` must succeed (non-zero exit = stop and report).

- [ ] **Step 3: Preview deploy (ask the user first)**

```bash
vercel link --yes --project consortium-map-embed --scope fwd-projects
vercel deploy --scope fwd-projects
```

On the preview URL, check all six files return `200` with JS/CSS content types (`curl -sI <url>/<file>`), not an HTML auth page.

- [ ] **Step 4: Production deploy (ask the user first)**

```bash
vercel deploy --prod --scope fwd-projects
```

Re-check the six files on `https://consortium-map-embed-fwd-projects.vercel.app/`.

- [ ] **Step 5: Publish Webflow to staging (ask the user first)**

Publish DEV - Consortium V6 to the Webflow subdomain only (`data_sites_tool > publish_site`, `publishToWebflowSubdomain: true`, no custom domains).

- [ ] **Step 6: Staging check**

On `https://dev-consortium.webflow.io/projects`, repeat Task 8 Steps 4 and 5 (desktop 1440×900 and mobile 393×881). Report results with screenshots, including any step that fails.
