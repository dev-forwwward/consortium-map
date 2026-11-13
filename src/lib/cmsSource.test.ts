// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { PAGED_CLASS, readCmsLocations } from './cmsSource';

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
});
