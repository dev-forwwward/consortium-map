# Map view modes: expanded map, portfolio grid/list, mobile sheet

Date: 2026-10-05
Status: Approved design, pending spec review
Branch: `map-v2`

## Goal

Extend the Projects page map explorer (Webflow site **DEV - Consortium V6**, page **Projects**, `6aaa6d56fc57cb950af89e26`) with:

1. An **expanded map** mode that hides the project list.
2. A **Portfolio** mode that hides the map and shows only projects, as a **grid** or a **list**.
3. A **mobile bottom sheet** replacing the stacked list/map layout below 992px.

And change interaction so that:

- Clicking a **marker** only highlights the matching card in the list. No modal, no zoom.
- Clicking a **card** (any view) opens the project detail page `/work/<slug>`.

### Success criteria

- A visitor can switch Portfolio ↔ Map, grid ↔ list, and split ↔ expanded on desktop.
- On mobile, the sheet drags or taps between peek, half and full.
- The Finsweet category filter keeps working in every view, and the map shows exactly what the filter shows (unchanged behavior).
- Existing pages using `consortium-map-v2.*` are unaffected.

## Design references (Figma, file `nt8s236BtTgF8G62J05fTi`)

| Node | What |
|---|---|
| `4512:33490` | Desktop: four frames, left to right: Map split, Map expanded, Portfolio grid, Portfolio list |
| `4513:34718` | Expand button (31×31, corner brackets), top-right of the map |
| `3640:49476` | Mobile: sheet at peek. **Entry screen on mobile.** |
| `3640:49390` | Mobile: sheet at half |
| `3771:71282` | Mobile: sheet at full |

## Decisions

| Topic | Decision |
|---|---|
| Expand trigger | Button in the top-right corner of the map. Toggles split ↔ expanded. |
| Default on load, desktop | Map view, split. Nothing persisted between visits. |
| Default on load, mobile | Sheet at peek. |
| Mobile pill | Hidden. The sheet replaces the Portfolio/Map pill. |
| Card click | Always navigates to `/work/<slug>` (Works Template page). |
| Card hover | Still highlights the matching marker or cluster (unchanged). |
| Marker click | Selects the marker, adds `is-cm-active` to the card and scrolls it into view. No modal, no zoom. |
| Marker click while expanded | Return to split, then highlight and scroll to the card. |
| Marker click on mobile at peek | Snap sheet to half, then scroll to the card. At half or full, the sheet stays and scrolls. |
| Cluster click | Zooms into the cluster (unchanged). |
| Split-view list | Always a 2-column grid. The grid/list toggle is hidden in split view. |
| Versioning | Ship as `consortium-map-v3.*`. v2 stays frozen, like v1. |

## Architecture

Webflow owns the layout and the UI elements. A plain TypeScript **view controller**, shipped inside the embed bundle, owns view state by toggling combo classes on `.map-explorer`. The React map stays map-only, and changes only in how a marker click behaves.

```
Webflow page (light DOM)                         Embed (shadow DOM)
┌──────────────────────────────────────────┐     ┌───────────────────────┐
│ .map-explorer  ← combo classes           │     │ React map (Leaflet)   │
│   pill / toggle / expand / sheet handle  │     │                       │
│   CMS Collection List (Finsweet filter)  │◄────┤ marker click →        │
│                                          │     │ dispatch cm:select    │
│ viewController.ts (listens, toggles)     │     │                       │
└──────────────────────────────────────────┘     └───────────────────────┘
```

### State model

State is expressed as combo classes on `.map-explorer`. The Webflow Designer cannot style a child based on a parent's combo class, so state-dependent rules live in a CSS file in this repo, `webflow/view-modes.css`, pasted into a `<style>` Embed on the Projects page and linked from the fixture. Base (split view) styles stay in Designer classes.

| State | Values | Classes | Applies at |
|---|---|---|---|
| view | `map` (default), `portfolio` | `is-portfolio` | ≥992px |
| layout | `grid` (default), `list` | `is-list` | portfolio view on desktop, sheet on mobile |
| map size | `split` (default), `expanded` | `is-map-expanded` | ≥992px, map view only |
| sheet | `peek` (default), `half`, `full` | `is-sheet-peek`, `is-sheet-half`, `is-sheet-full` | <992px |

The breakpoint is read with `matchMedia('(min-width: 992px)')`. Crossing it clears the other side's classes and applies that side's defaults.

### Markup contract (new)

The controller finds controls by attribute, so class names and styling stay free for the Designer.

| Attribute | Element | Behavior |
|---|---|---|
| `data-cm-view="map"` / `"portfolio"` | Pill buttons | Set view |
| `data-cm-layout="grid"` / `"list"` | Grid/list icon buttons | Set layout |
| `data-cm-expand` | 31×31 button over the map, top-right | Desktop: toggle split ↔ expanded. Mobile: snap sheet to peek. |
| `data-cm-sheet` | The list column (the sheet on mobile) | The element the sheet drag moves |
| `data-cm-sheet-handle` | Drag bar at the top of the sheet | Drag, or tap to cycle peek → half → full → peek |

The active control gets `is-active` and `aria-pressed="true"`; the others get `aria-pressed="false"`. All controls are `<button>` elements or carry `role="button"` and `tabindex="0"`, and respond to Enter and Space.

The existing contract (`data-cm-list`, `data-cm-item`, `data-cm-field`, `fs-list-*`) is unchanged.

**Card link:** each `.project-card` is wrapped in a Link Block bound to the Works Template page (the current Collection Item). Navigation is native, so middle-click, cmd-click and keyboard work.

### Map → page event

The embed dispatches on `document`:

```ts
document.dispatchEvent(new CustomEvent('cm:select', { detail: { id } }));
```

The view controller listens and:

1. Desktop, expanded: removes `is-map-expanded`, waits two animation frames for layout, then scrolls the card into view.
2. Mobile, peek: sets `is-sheet-half`, waits for the snap transition to end (or one frame with reduced motion), then scrolls the card into view.
3. Otherwise: scrolls the card into view.

Highlighting (`is-cm-active`) is still applied by `useCmsBridge`, as today. Scrolling moves out of `useCmsBridge` into the controller, so it happens after the layout change.

## Layout per state (Webflow)

| State | List column | Map column | Cards |
|---|---|---|---|
| Map · split | 30rem, left | Fills the rest | 2-column grid, image on top |
| Map · expanded | Hidden | Full width | None |
| Portfolio · grid | Full width | Hidden | 3-column, large image |
| Portfolio · list | Full width | Hidden | Row: 144px thumbnail, name + inline category tag, location right-aligned, divider lines |
| Mobile, any sheet state | Sheet over the map | Full screen behind the sheet | 2-column grid, or rows with `is-list` |

- **Hiding the map** in Portfolio uses `position:absolute; visibility:hidden; pointer-events:none`, never `display:none`. A 0×0 Leaflet container corrupts its bounds (see README). On return, the existing ResizeObserver in `MapInvalidateOnShow` calls `invalidateSize()`.
- **Pill** is fixed at bottom center on desktop and hidden on mobile.
- **Filter** row is unchanged on desktop and becomes horizontally scrolling chips on mobile.
- **List rows** hide the category tag that overlays the image, and show an inline tag next to the name. Both are bound to the same CMS field. Only the existing overlay tag keeps `fs-list-field="category"` and `data-cm-field="category"`.

## Mobile sheet

- **Snap points**, as offsets of the sheet's top from the top of the map area:
  - peek: map area height minus the handle-and-title height (about 72px)
  - half: 50% of the map area height
  - full: the top of the filter row
- **Drag:** pointer events on `[data-cm-sheet-handle]` with pointer capture. While dragging, the sheet follows with `transform: translateY(...)` and transitions are off. On release:
  - If the release velocity is above 0.5 px/ms, snap to the next point in the flick direction.
  - Otherwise, snap to the nearest point.
- **Tap** (movement under 6px): cycle peek → half → full → peek.
- **Scrolling:** the card list scrolls inside the sheet only at full. At peek and half, the list has `overflow:hidden` and the sheet captures touch, so the page doesn't scroll behind it.
- **Reduced motion:** with `prefers-reduced-motion: reduce`, snaps are instant.
- Snap maths is a pure function, `resolveSnap(offset, velocity, points) → point`, so it can be unit-tested.

## Code changes

| File | Change |
|---|---|
| `src/webflow/viewController.ts` (new) | Plain TS, no React. Wires controls, applies classes, handles the breakpoint, the sheet drag and `cm:select`. Exports `initViewController(root)`. |
| `src/webflow/sheetSnap.ts` (new) | Pure `resolveSnap` and snap-point computation. |
| `src/embed.tsx` | After mounting the map, calls `initViewController(document.querySelector('.map-explorer'))`. If `.map-explorer` is missing, logs one warning and skips. |
| `src/components/map/ClusterLayer.tsx` | New `selectOnly` prop. When set, a marker click calls `selectLocation(id)` without `openDetail` and dispatches `cm:select`. |
| `src/components/map/MapPanel.tsx` | Passes `selectOnly` through. |
| `src/components/layout/MapOnlyLayout.tsx` | Removes `LocationDetailModal`. Passes `selectOnly`. |
| `src/hooks/useCmsBridge.ts` | Removes the card click handler and the scroll-on-select effect. Keeps hover in both directions and the hover/active classes. |
| `vite.embed.config.ts` | Output names `consortium-map-v3.js` / `.css`. |
| `src/embed.tsx` `CSS_URL` | Points at `consortium-map-v3.css`. |
| `webflow/view-modes.css` (new) | State-dependent CSS. Source of truth for the Webflow `<style>` Embed. |
| `dev/webflow-cms-fixture.html` | Adds the pill, grid/list toggle, expand button, sheet markup, and links `webflow/view-modes.css`. |
| `README.md` | Documents the new markup contract, the `cm:select` event, v3, and the deploy steps for three versions. |

The standalone dev app (`npm run dev`, `ExplorerLayout`) keeps its modal and current behavior.

## Error handling

- Missing control elements are skipped individually. The page works with whatever controls exist.
- A `cm:select` for an id with no matching card (for example, filtered out) is ignored.
- If `.map-explorer` is missing, the map still mounts and the controller logs one warning.

## Testing

- **Unit:** `resolveSnap` covers nearest-point snapping, flicks in both directions, flicks at the ends (clamped), and the tap threshold. This project has no test runner yet, so the plan adds Vitest as a dev dependency for these tests only.
- **Fixture, with Playwright at 1440px and 393px:**
  - Desktop: default split; expand and collapse; Portfolio grid and list; back to Map; map tiles render correctly after returning from Portfolio; marker click while expanded returns to split and highlights the card; card click navigates.
  - Mobile: loads at peek; handle tap cycles; drag snaps; marker tap at peek goes to half and highlights the card; expand button returns to peek; resizing across 992px resets state.
  - The filter works in every view.
- **Webflow:** manual check on the staging domain after publishing.

## Rollout

1. Implement and test against the fixture.
2. Build the Webflow elements and combo classes on DEV - Consortium V6, Projects page. Point the Embed at v3.
3. Deploy to Vercel with v1, v2 and v3 side by side (preview first, then prod).
4. Publish Webflow to staging only, after the user approves.

## Out of scope

- Remembering the view between visits, or putting it in the URL.
- A grid/list toggle in split view.
- Any change to the standalone dev app or to v1/v2.
