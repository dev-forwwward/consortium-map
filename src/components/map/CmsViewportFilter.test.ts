// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { OFFMAP_CLASS } from '../../lib/cmsSource';
import { markCardsInView } from './CmsViewportFilter';

const listOf = (...ids: string[]) => {
  document.body.innerHTML = `<div data-cm-list>${ids
    .map((id) => `<div class="w-dyn-item"><a><div data-cm-item data-cm-id="${id}"></div></a></div>`)
    .join('')}</div>`;
  return document.querySelector<HTMLElement>('[data-cm-list]')!;
};
const offIds = () =>
  Array.from(document.querySelectorAll(`.w-dyn-item.${OFFMAP_CLASS} [data-cm-item]`)).map((el) =>
    el.getAttribute('data-cm-id'),
  );

describe('markCardsInView', () => {
  it('marks the Collection Item of every card not in view, and counts the rest', () => {
    const list = listOf('a', 'b', 'c');
    expect(markCardsInView(list, new Set(['b']))).toBe(1);
    expect(offIds()).toEqual(['a', 'c']);
    expect(markCardsInView(list, new Set(['a', 'b', 'c']))).toBe(3);
    expect(offIds()).toEqual([]);
  });

  it('touches nothing when the view leaves the marks as they are', async () => {
    const list = listOf('a', 'b');
    markCardsInView(list, new Set(['a']));
    const records: MutationRecord[] = [];
    const observer = new MutationObserver((r) => records.push(...r));
    observer.observe(list, { subtree: true, attributes: true });
    markCardsInView(list, new Set(['a']));
    await Promise.resolve();
    observer.disconnect();
    expect(records).toEqual([]);
  });
});
