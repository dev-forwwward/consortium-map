// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { OFFMAP_CLASS, PAGED_CLASS, readCmsLocations, splitLocation } from './cmsSource';

const card = (id: string, { className = '', attrs = '' } = {}) =>
  `<div class="w-dyn-item ${className}" ${attrs}><div data-cm-item data-cm-id="${id}" data-cm-lat="36" data-cm-lng="-86"></div></div>`;

describe('readCmsLocations', () => {
  it('keeps cards that Show more has paged out, but drops cards a filter hid', () => {
    document.body.innerHTML = `
      <style>.${PAGED_CLASS} { display: none; }</style>
      <div data-cm-list>
        ${card('shown')}
        ${card('paged', { className: PAGED_CLASS })}
        ${card('filtered', { attrs: 'style="display: none"' })}
        ${card('hidden', { attrs: 'hidden' })}
      </div>`;
    const list = document.querySelector<HTMLElement>('[data-cm-list]')!;
    // Guard: the paged card really is display:none, so the test exercises the exception.
    expect(getComputedStyle(list.children[1]).display).toBe('none');
    expect(readCmsLocations(list).map((l) => l.id)).toEqual(['shown', 'paged']);
  });

  it('keeps cards the map view narrowed out, unless a filter also hid them', () => {
    document.body.innerHTML = `
      <style>.${OFFMAP_CLASS} { display: none; }</style>
      <div data-cm-list>
        ${card('offmap', { className: OFFMAP_CLASS })}
        ${card('offmap-filtered', { className: OFFMAP_CLASS, attrs: 'style="display: none"' })}
      </div>`;
    const list = document.querySelector<HTMLElement>('[data-cm-list]')!;
    expect(readCmsLocations(list).map((l) => l.id)).toEqual(['offmap']);
  });
});

// A card shaped like the Webflow page: its own fields in data-cm-field
// children, its buildings in a hidden nested Collection List.
// Points sit beside the card's link inside its Collection Item, as on the
// Webflow page (a Collection List can't go inside a Link Block).
const multiCard = (
  id: string,
  points: { id: string; lat: string; lng: string; location?: string }[],
  { attrs = '', lat = '', lng = '' } = {},
) => `
  <div class="w-dyn-item" ${attrs}>
    <a href="/work/${id}"><div data-cm-item>
      <div data-cm-field="name">Back Nine</div>
      <div data-cm-field="category">Franchise Design</div>
      <div data-cm-field="location"></div>
      <div class="cm-data" style="display: none">
        <div data-cm-field="id">${id}</div>
        <div data-cm-field="lat">${lat}</div>
        <div data-cm-field="lng">${lng}</div>
      </div>
    </div></a>
    <div class="cm-data" data-cm-points style="display: none">
        <div class="w-dyn-list"><div class="w-dyn-items">
          ${points
            .map(
              (p) => `<div class="w-dyn-item" data-cm-point>
                <div data-cm-point-field="id">${p.id}</div>
                <div data-cm-point-field="lat">${p.lat}</div>
                <div data-cm-point-field="lng">${p.lng}</div>
                <div data-cm-point-field="location">${p.location ?? ''}</div>
              </div>`,
            )
            .join('')}
        </div></div>
    </div>
  </div>`;

const listOf = (html: string) => {
  document.body.innerHTML = `<div data-cm-list>${html}</div>`;
  return document.querySelector<HTMLElement>('[data-cm-list]')!;
};

describe('readCmsLocations with building points', () => {
  it('gives a card one pin per building, carrying the card id and the building place', () => {
    const list = listOf(
      multiCard('back-nine', [
        { id: 'ti-190', lat: '42.59', lng: '-83.60', location: 'Milford MI' },
        { id: 'ti-01', lat: '34.12', lng: '-83.82', location: 'Braselton, GA' },
      ]),
    );
    const locations = readCmsLocations(list);
    expect(locations).toHaveLength(2);
    expect(locations[0]).toMatchObject({
      id: 'back-nine::ti-190',
      cardId: 'back-nine',
      name: 'Back Nine',
      category: 'Franchise Design',
      city: 'Milford',
      state: 'MI',
      latitude: 42.59,
      longitude: -83.6,
    });
    expect(locations[1]).toMatchObject({ city: 'Braselton', state: 'GA' });
  });

  it('skips buildings without coordinates and falls back to the card when none are usable', () => {
    const list = listOf(
      multiCard('brentwood', [{ id: 'a', lat: '', lng: '' }, { id: 'b', lat: '', lng: '' }], {
        lat: '36.03',
        lng: '-86.78',
      }) +
        multiCard('mixed', [
          { id: 'ok', lat: '30', lng: '-90' },
          { id: 'bad', lat: '300', lng: '-90' },
          { id: 'empty', lat: '', lng: '' },
        ]),
    );
    const locations = readCmsLocations(list);
    expect(locations.map((l) => [l.id, l.cardId])).toEqual([
      ['brentwood', undefined],
      ['mixed::ok', 'mixed'],
    ]);
    expect(locations[0]).toMatchObject({ latitude: 36.03, longitude: -86.78 });
  });

  it('never reads a building value as the card own field', () => {
    // Card has no lat/lng of its own and its points have none either: no pin,
    // even though nested elements exist below the card's fields.
    const list = listOf(multiCard('empty-card', [{ id: 'x', lat: '', lng: '' }]));
    expect(readCmsLocations(list)).toEqual([]);
  });

  it('keeps each card to the buildings in its own Collection Item', () => {
    const list = listOf(
      multiCard('a', [{ id: 'a1', lat: '30', lng: '-90' }]) +
        multiCard('b', [{ id: 'b1', lat: '31', lng: '-91' }, { id: 'b2', lat: '32', lng: '-92' }]),
    );
    expect(readCmsLocations(list).map((l) => l.id)).toEqual(['a::a1', 'b::b1', 'b::b2']);
  });

  it('drops every building pin when the filter hides the card', () => {
    const list = listOf(
      multiCard('back-nine', [{ id: 'a', lat: '30', lng: '-90' }], { attrs: 'style="display: none"' }),
    );
    expect(readCmsLocations(list)).toEqual([]);
  });
});

describe('splitLocation', () => {
  it.each([
    ['Brentwood, TN', 'Brentwood', 'TN'],
    ['Milford MI', 'Milford', 'MI'],
    ['White Marsh MD', 'White Marsh', 'MD'],
    ['Nashville', 'Nashville', ''],
    ['Lake Nona (Orlando)', 'Lake Nona (Orlando)', ''],
  ])('%s', (input, city, state) => {
    expect(splitLocation(input)).toEqual({ city, state });
  });
});
