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
