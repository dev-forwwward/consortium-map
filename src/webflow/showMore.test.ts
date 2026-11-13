// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { PAGED_CLASS } from '../lib/cmsSource';
import { REVEALING_CLASS, attachShowMore, type ShowMore } from './showMore';

function mount(count: number): HTMLElement {
  const cards = Array.from(
    { length: count },
    (_, i) => `<div class="w-dyn-item"><a class="project-card_link" href="/p/${i}"><div class="project-card" data-cm-item></div></a></div>`,
  ).join('');
  document.body.innerHTML = `
    <div class="map-explorer">
      <div class="map-explorer_list">
        <div><div class="w-dyn-list" data-cm-list><div class="map-explorer_items">${cards}</div></div></div>
      </div>
    </div>`;
  return document.querySelector<HTMLElement>('.map-explorer')!;
}

const items = () => Array.from(document.querySelector('.map-explorer_items')!.children) as HTMLElement[];
const paged = () => items().map((el) => el.classList.contains(PAGED_CLASS));
const wrap = () => document.querySelector<HTMLElement>('.cm-show-more')!;
const button = () => wrap().querySelector('button')!;
// MutationObserver callbacks run as microtasks.
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

let showMore: ShowMore | null = null;
afterEach(() => showMore?.destroy());

describe('show more', () => {
  it('leaves only the first page unpaged and puts the button after the Collection List', () => {
    showMore = attachShowMore(mount(8), { pageSize: 3 });
    showMore!.sync(true);
    expect(paged()).toEqual([false, false, false, true, true, true, true, true]);
    expect(wrap().previousElementSibling?.hasAttribute('data-cm-list')).toBe(true);
    expect(wrap().hidden).toBe(false);
    expect(button().type).toBe('button');
    expect(button().textContent).toBe('Show more');
  });

  it('reveals a page per click and goes away once everything shows', () => {
    showMore = attachShowMore(mount(8), { pageSize: 3 });
    showMore!.sync(true);
    button().click();
    expect(paged().filter(Boolean)).toHaveLength(2);
    expect(wrap().hidden).toBe(false);
    button().click();
    expect(paged().some(Boolean)).toBe(false);
    expect(wrap().hidden).toBe(true);
  });

  it('is hidden outside Portfolio and when one page holds everything', () => {
    showMore = attachShowMore(mount(8), { pageSize: 3 });
    showMore!.sync(false);
    expect(wrap().hidden).toBe(true);
    showMore!.destroy();

    showMore = attachShowMore(mount(3), { pageSize: 3 });
    showMore!.sync(true);
    expect(wrap().hidden).toBe(true);
  });

  it('starts again from the first page when the filter re-renders the cards', async () => {
    const root = mount(8);
    showMore = attachShowMore(root, { pageSize: 3 });
    showMore!.sync(true);
    button().click();
    expect(paged().filter((p) => !p)).toHaveLength(6);

    // Finsweet re-inserts the matching cards and removes the rest.
    const list = root.querySelector('.map-explorer_items')!;
    const keep = items().slice(0, 5);
    list.replaceChildren(...keep.reverse());
    await flush();

    expect(paged()).toEqual([false, false, false, true, true]);
    expect(wrap().hidden).toBe(false);
  });

  it('marks a Show more reveal (no fade stagger) until the filter re-renders', async () => {
    const root = mount(8);
    const list = root.querySelector('.map-explorer_items')!;
    showMore = attachShowMore(root, { pageSize: 3 });
    showMore!.sync(true);
    expect(list.classList.contains(REVEALING_CLASS)).toBe(false);
    button().click();
    expect(list.classList.contains(REVEALING_CLASS)).toBe(true);

    list.replaceChildren(...items().slice(0, 5));
    await flush();
    expect(list.classList.contains(REVEALING_CLASS)).toBe(false);
  });

  it('moves focus to the first new card when the button goes away under it', () => {
    showMore = attachShowMore(mount(5), { pageSize: 3 });
    showMore!.sync(true);
    button().focus();
    button().click();
    expect(document.activeElement).toBe(items()[3].querySelector('a'));
  });

  it('keeps focus on the button while more remain', () => {
    showMore = attachShowMore(mount(8), { pageSize: 3 });
    showMore!.sync(true);
    button().focus();
    button().click();
    expect(document.activeElement).toBe(button());
  });

  it('removes the button and the paging on destroy', () => {
    showMore = attachShowMore(mount(8), { pageSize: 3 });
    showMore!.sync(true);
    showMore!.destroy();
    showMore = null;
    expect(document.querySelector('.cm-show-more')).toBeNull();
    expect(paged().some(Boolean)).toBe(false);
  });

  it('does nothing on a page without the card grid', () => {
    document.body.innerHTML = '<div class="map-explorer"></div>';
    expect(attachShowMore(document.querySelector<HTMLElement>('.map-explorer')!)).toBeNull();
  });
});
