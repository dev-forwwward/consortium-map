# View switch: cascade reveal

Date: 2026-11-17
Status: Draft, awaiting approval
Branch: `map-v2`

## Intent

Switching Portfolio ↔ Map View on desktop is an instant class swap: the list column jumps from 30rem
to full width, the grid from 2 to 3 columns, and the map pops in or out (`visibility`). It reads as a
glitch. The new view should instead build itself softly, in cascade: list wrapper first, then the
list items one by one, then the map section.

## Goals

- Portfolio ↔ Map View: the current view fades out, then the new one reveals in order:
  list header → cards (staggered) → map (Map View only).
- Grid ↔ list toggle (Portfolio): same exit fade and cascade (no map involved).
- Switching to Map View while scrolled deep into Portfolio glides the page back up first, so the
  page doesn't jump when the explorer shrinks to viewport height.

## Non-goals

- Mobile (the sheet doesn't use the pill; its transitions stay as they are).
- The expand button (split ↔ expanded map).
- Morphing cards between their old and new positions.

## Anti-goals

- The map flashing grey, losing its view, or mis-measuring (Leaflet 0×0 bug).
- A sluggish switch: the new view must start revealing within ~200ms of the click (longer only
  while the page scrolls up).
- Any motion when the visitor prefers reduced motion.

## Approaches

1. **Class-triggered CSS cascade (picked).** The controller sets short-lived state on
   `.map-explorer`; `webflow/view-modes.css` runs the timed fade-ins. Reuses the cards' existing
   `cm-card-in` stagger, no new dependency, works in every browser and the fixture, unit-testable.
2. GSAP timeline. Finer control, but makes the embed depend on a library the host page happens to
   load; the fixture doesn't have it.
3. View Transitions API. Built for morphs, not a sequenced reveal; the cascade would need a
   `view-transition-name` per card, and the page is frozen while it plays. Dropped.

## Design

**Sequence (desktop, motion allowed):**

1. Click. State updates and the controls' `is-active` / `aria-pressed` sync **immediately**.
2. **Exit:** `.map-explorer` gets `is-cm-view-leaving` → fades to opacity 0 (~150ms).
   If the target is Map View and the explorer's top is above the viewport, the window smooth-scrolls
   to the top in parallel.
3. **Swap:** once the fade is done (and the scroll has settled, `scrollend` or a ~800ms cap), the
   state classes are applied (`applyClasses`), `is-cm-view-leaving` comes off, and the explorer's
   enter marker flips (see below).
4. **Cascade in** (all `cubic-bezier(0.2, 0.8, 0.2, 1)`, fade + small rise, like `cm-card-in`):
   - `.map-explorer_header` (title + layout toggle): 0ms
   - cards: 80ms, then +40ms each, capped at the 8th (same ladder as today, shifted by 80ms)
   - `.map-explorer_map`: ~240ms, slightly longer (~0.6s)
   - Anything without its own animation (e.g. Show more button) returns with the explorer's fade.

**Restarting CSS animations:** a CSS animation only replays when its `animation-name` changes.
Removing a one-shot class afterwards would change the name back and replay the cards' load
animation (a second flash). So the controller flips an attribute between two values on each switch,
`data-cm-enter="a"` ↔ `"b"`, and never removes it; each value points to its own copy of the
keyframes. With no attribute (page load), nothing changes from today. Filter changes after a switch
still animate on insertion, using whichever name is current.

**Interruptions:** a click during the exit just updates state; the pending swap applies whatever the
state is when it runs. Clicking back to the view already on screen cancels the pending swap and fades
it back in. A click during the cascade starts a new exit. A breakpoint change cancels any pending
transition and renders instantly.

**Instant (today's behavior) when:** reduced motion, mobile, or no actual view/layout change.
The reduced-motion check goes through the injected `matchMedia` (the existing tests' fake reports
`matches: true`, so they keep testing the instant path unchanged).

**Unchanged:** map stays mounted, never `display:none`; `MapInvalidateOnShow` re-measures on
resize; the ScrollTrigger height observer still refreshes after the height settles; `onSelect`
(marker click) is untouched.

## Files

- `src/webflow/viewController.ts`: exit → swap → enter orchestration, scroll-up, interruption handling.
- `src/webflow/viewController.test.ts`: new tests for the animated path (fake timers): controls sync
  immediately, classes apply after the exit, enter marker alternates a/b, re-click cancels,
  breakpoint cancels, reduced motion stays instant.
- `webflow/view-modes.css`: leaving fade, `data-cm-enter` keyframe pairs and delays for header,
  cards and map, reduced-motion override.
- `README.md`: one paragraph under View modes.

## Left to the builder

Exact durations within the ranges above, tuned in the fixture; how the exit duration is shared
between CSS and JS (a timer that matches the CSS value is fine, since jsdom has no `transitionend`);
whether to use `window.lenis.scrollTo` when present instead of native `scrollTo`.

Deploy (rebuild + Vercel push of the 7 files) is a separate step, done only when asked.
