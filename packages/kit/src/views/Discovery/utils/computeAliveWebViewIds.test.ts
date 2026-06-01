import { computeAliveWebViewIds } from './computeAliveWebViewIds';

import type { IWebTab } from '../types';

function tab(id: string): IWebTab {
  return { id, url: `https://${id}.example` };
}

describe('computeAliveWebViewIds', () => {
  it('returns empty set when there are no tabs', () => {
    expect(
      computeAliveWebViewIds({ tabs: [], activeTabId: null, mountOrder: [] })
        .size,
    ).toBe(0);
  });

  it('keeps every tab alive when count is within the limit', () => {
    const tabs = [tab('a'), tab('b'), tab('c')];
    const alive = computeAliveWebViewIds({
      tabs,
      activeTabId: 'a',
      mountOrder: ['a'],
      max: 5,
    });
    expect(alive).toEqual(new Set(['a', 'b', 'c']));
  });

  it('always keeps the active tab alive even if it is least recent', () => {
    const tabs = [tab('a'), tab('b'), tab('c'), tab('d')];
    const alive = computeAliveWebViewIds({
      tabs,
      activeTabId: 'd',
      mountOrder: ['a', 'b', 'c'], // d never recorded yet
      max: 2,
    });
    expect(alive.has('d')).toBe(true);
    expect(alive.size).toBe(2);
  });

  it('evicts least-recently-active tabs beyond the limit', () => {
    const tabs = [tab('a'), tab('b'), tab('c'), tab('d'), tab('e')];
    // recency: c (active) > b > a ; d and e are older
    const alive = computeAliveWebViewIds({
      tabs,
      activeTabId: 'c',
      mountOrder: ['c', 'b', 'a'],
      max: 3,
    });
    expect(alive).toEqual(new Set(['c', 'b', 'a']));
    expect(alive.has('d')).toBe(false);
    expect(alive.has('e')).toBe(false);
  });

  it('falls back to tab order for tabs absent from mountOrder', () => {
    const tabs = [tab('a'), tab('b'), tab('c')];
    const alive = computeAliveWebViewIds({
      tabs,
      activeTabId: null,
      mountOrder: [],
      max: 2,
    });
    // deterministic: first two tabs in list order
    expect(alive).toEqual(new Set(['a', 'b']));
  });

  it('ignores ids in mountOrder that no longer exist', () => {
    const tabs = [tab('a'), tab('b')];
    const alive = computeAliveWebViewIds({
      tabs,
      activeTabId: 'a',
      mountOrder: ['ghost', 'a', 'b'],
      max: 5,
    });
    expect(alive).toEqual(new Set(['a', 'b']));
  });

  it('returns empty set for non-positive max', () => {
    const tabs = [tab('a')];
    expect(
      computeAliveWebViewIds({
        tabs,
        activeTabId: 'a',
        mountOrder: ['a'],
        max: 0,
      }).size,
    ).toBe(0);
  });
});
