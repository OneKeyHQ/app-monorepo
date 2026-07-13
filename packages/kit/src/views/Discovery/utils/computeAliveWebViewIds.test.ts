import { computeAliveWebViewIds } from './computeAliveWebViewIds';

import type { IWebTab } from '../types';

function tab(id: string): IWebTab {
  return { id, url: `https://${id}.example` };
}

// Home / new-tab entry that renders no WebView.
function emptyTab(id: string): IWebTab {
  return { id, url: '' };
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

  it('excludes url-less tabs so they never consume a keep-alive slot', () => {
    // active tab is a URL-less start tab; it must not occupy the budget.
    const tabs = [emptyTab('home'), tab('a'), tab('b')];
    const alive = computeAliveWebViewIds({
      tabs,
      activeTabId: 'home',
      mountOrder: ['home', 'a', 'b'],
      max: 2,
    });
    expect(alive.has('home')).toBe(false);
    expect(alive).toEqual(new Set(['a', 'b']));
  });

  it('keeps the full budget of DApp webviews alongside an active empty tab', () => {
    // Regression for the low-end case: max=3 with an active home tab must still
    // keep 3 real DApp webviews alive, not 2.
    const tabs = [emptyTab('home'), tab('a'), tab('b'), tab('c'), tab('d')];
    const alive = computeAliveWebViewIds({
      tabs,
      activeTabId: 'home',
      mountOrder: ['home', 'a', 'b', 'c'],
      max: 3,
    });
    expect(alive.has('home')).toBe(false);
    expect(alive.size).toBe(3);
    expect(alive).toEqual(new Set(['a', 'b', 'c']));
  });

  it('returns empty set when every tab is url-less', () => {
    const tabs = [emptyTab('home'), emptyTab('blank')];
    expect(
      computeAliveWebViewIds({
        tabs,
        activeTabId: 'home',
        mountOrder: ['home'],
        max: 5,
      }).size,
    ).toBe(0);
  });
});
