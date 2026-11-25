// @vitest-environment jsdom
import { beforeAll, describe, expect, it } from 'vitest';
import { LEAVING_CLASS } from './viewSwitch';

// The page stylesheet (webflow/view-modes.css), checked through jsdom's cascade. Read from disk:
// Vitest stubs CSS imports (even ?raw), and the project has no Node types, hence the local type.
type ReadFileSync = (path: string, encoding: 'utf8') => string;
const FS = 'node:fs';
const DESKTOP_MEDIA = '(min-width: 992px)';

/**
 * The stylesheet as a desktop browser applies it. jsdom ignores @media rules in getComputedStyle,
 * so the desktop block's rules are lifted to the top level (in place, so source order holds) and
 * every other @media block (mobile, reduced motion) is dropped.
 */
function asDesktop(css: string): string {
  const probe = document.createElement('style');
  probe.textContent = css;
  document.head.append(probe);
  const rules = Array.from(probe.sheet!.cssRules).flatMap((rule) => {
    if (!(rule instanceof CSSMediaRule)) return [rule.cssText];
    return rule.media.mediaText === DESKTOP_MEDIA ? Array.from(rule.cssRules, (r) => r.cssText) : [];
  });
  probe.remove();
  return rules.join('\n');
}

beforeAll(async () => {
  const { readFileSync } = (await import(/* @vite-ignore */ FS)) as { readFileSync: ReadFileSync };
  // Relative to the repo root, where vitest runs.
  const css = readFileSync('webflow/view-modes.css', 'utf8');
  const style = document.createElement('style');
  style.textContent = asDesktop(css);
  document.head.append(style);
});

describe('view-modes.css on desktop', () => {
  it('Map View hides cards with no pin in view; Portfolio lists them all', () => {
    const markup = (view: string) => `
      <div class="map-explorer ${view}"><div class="map-explorer_items">
        <div class="w-dyn-item is-cm-offmap"></div><div class="w-dyn-item"></div>
      </div><p class="cm-offmap-empty">x</p></div>`;
    document.body.innerHTML = markup('');
    const [off, on] = document.querySelectorAll('.w-dyn-item');
    expect(getComputedStyle(off).display).toBe('none');
    expect(getComputedStyle(on).display).not.toBe('none');
    document.body.innerHTML = markup('is-portfolio');
    expect(getComputedStyle(document.querySelector('.is-cm-offmap')!).display).not.toBe('none');
    expect(getComputedStyle(document.querySelector('.cm-offmap-empty')!).display).toBe('none');
  });

  it('a faded-out explorer takes no clicks', () => {
    // Its cards are still links: a click on the invisible explorer would open a project.
    document.body.innerHTML = `<div class="map-explorer ${LEAVING_CLASS}"></div>`;
    const explorer = document.querySelector('.map-explorer')!;
    expect(getComputedStyle(explorer).opacity).toBe('0');
    expect(getComputedStyle(explorer).pointerEvents).toBe('none');
  });

  it('the expanded map slides the list out instead of dropping it', () => {
    // display:none can't animate: the list stays rendered but hidden, and a negative margin of its
    // own width hands its space to the map, so the map's left edge follows the list out.
    document.body.innerHTML = `
      <div class="map-explorer is-map-expanded">
        <div class="map-explorer_list"></div><div class="map-explorer_map"></div>
      </div>`;
    const explorer = document.querySelector('.map-explorer')!;
    const list = document.querySelector('.map-explorer_list')!;
    expect(getComputedStyle(list).display).not.toBe('none');
    expect(getComputedStyle(list).visibility).toBe('hidden');
    expect(getComputedStyle(list).opacity).toBe('0');
    expect(getComputedStyle(list).marginLeft).toContain('--cm-list-w');
    expect(getComputedStyle(list).transitionProperty).toContain('margin-left');
    // The list leaves past the explorer's left edge: clip it there.
    expect(getComputedStyle(explorer).overflowX).toBe('clip');
  });

  it('Portfolio does not slide its list in', () => {
    // Expanded map -> Portfolio drops the negative margin; the full-width list must not glide in.
    document.body.innerHTML = `
      <div class="map-explorer is-portfolio">
        <div class="map-explorer_list"></div><div class="map-explorer_map"></div>
      </div>`;
    const list = document.querySelector('.map-explorer_list')!;
    expect(getComputedStyle(list).transitionProperty).not.toContain('margin-left');
  });

  it('the selected marker\'s card fills orange, also while hovered', () => {
    // A thin orange edge on the dark hover panel read as hover, not as the selection.
    document.body.innerHTML = `
      <div class="map-explorer">
        <div class="map-explorer_items"><div class="project-card is-cm-active is-cm-hover"></div></div>
      </div>`;
    const card = document.querySelector('.project-card')!;
    expect(getComputedStyle(card).backgroundColor).toContain('--_primitives---colors--orange');
    expect(getComputedStyle(card).boxShadow).not.toContain('inset');
  });

  it('the split map shows the list in place', () => {
    document.body.innerHTML = `
      <div class="map-explorer">
        <div class="map-explorer_list"></div><div class="map-explorer_map"></div>
      </div>`;
    const list = document.querySelector('.map-explorer_list')!;
    expect(getComputedStyle(list).visibility).toBe('visible');
    expect(getComputedStyle(list).opacity).toBe('1');
    expect(getComputedStyle(list).marginLeft).not.toContain('--cm-list-w');
  });
});
