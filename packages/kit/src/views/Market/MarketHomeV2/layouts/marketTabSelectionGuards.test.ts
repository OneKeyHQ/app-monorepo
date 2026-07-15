import {
  getIsMarketTabSelectionInFlight,
  shouldIgnoreStalePagerTabChange,
  shouldRestoreSpotCategoryFromAtom,
} from './marketTabSelectionGuards';

describe('shouldRestoreSpotCategoryFromAtom', () => {
  it('allows cold-start restore when no local selection is pending', () => {
    expect(
      shouldRestoreSpotCategoryFromAtom({
        pendingSpotCategoryId: undefined,
        atomSpotCategoryId: 'stock',
      }),
    ).toBe(true);
  });

  it('blocks restore while the atom echo lags the local selection', () => {
    expect(
      shouldRestoreSpotCategoryFromAtom({
        pendingSpotCategoryId: 'stock',
        atomSpotCategoryId: 'trending',
      }),
    ).toBe(false);
  });

  it('blocks out-of-order stale echoes of older selections', () => {
    // User picked "stock" last; an older "ai-tech" write echoes back later.
    expect(
      shouldRestoreSpotCategoryFromAtom({
        pendingSpotCategoryId: 'stock',
        atomSpotCategoryId: 'ai-tech',
      }),
    ).toBe(false);
  });

  it('allows restore once the atom caught up with the local selection', () => {
    expect(
      shouldRestoreSpotCategoryFromAtom({
        pendingSpotCategoryId: 'stock',
        atomSpotCategoryId: 'stock',
      }),
    ).toBe(true);
  });
});

describe('getIsMarketTabSelectionInFlight', () => {
  it('is not in flight without a recorded write', () => {
    expect(
      getIsMarketTabSelectionInFlight({
        lastWrittenSelection: undefined,
        atomTab: 'trending',
        atomSpotCategoryId: 'trending',
      }),
    ).toBe(false);
  });

  it('is in flight while the written tab has not echoed back', () => {
    expect(
      getIsMarketTabSelectionInFlight({
        lastWrittenSelection: { tab: 'watchlist' },
        atomTab: 'trending',
        atomSpotCategoryId: 'trending',
      }),
    ).toBe(true);
  });

  it('is in flight while the written category has not echoed back', () => {
    expect(
      getIsMarketTabSelectionInFlight({
        lastWrittenSelection: { tab: 'trending', categoryId: 'stock' },
        atomTab: 'trending',
        atomSpotCategoryId: 'trending',
      }),
    ).toBe(true);
  });

  it('settles once tab and category both echoed back', () => {
    expect(
      getIsMarketTabSelectionInFlight({
        lastWrittenSelection: { tab: 'trending', categoryId: 'stock' },
        atomTab: 'trending',
        atomSpotCategoryId: 'stock',
      }),
    ).toBe(false);
  });

  it('ignores the category when the write did not include one', () => {
    // Watchlist/perps taps keep the previous spot category untouched.
    expect(
      getIsMarketTabSelectionInFlight({
        lastWrittenSelection: { tab: 'perps' },
        atomTab: 'perps',
        atomSpotCategoryId: 'stock',
      }),
    ).toBe(false);
  });
});

describe('shouldIgnoreStalePagerTabChange', () => {
  it('ignores an old pager callback after an external atom selection', () => {
    expect(
      shouldIgnoreStalePagerTabChange({
        incomingTabName: 'Favorites',
        selectedTabName: 'Stocks',
        isRecentPagerDrag: false,
      }),
    ).toBe(true);
  });

  it('accepts a tab change backed by a user drag', () => {
    expect(
      shouldIgnoreStalePagerTabChange({
        incomingTabName: 'Favorites',
        selectedTabName: 'Stocks',
        isRecentPagerDrag: true,
      }),
    ).toBe(false);
  });

  it('accepts the expected programmatic target', () => {
    expect(
      shouldIgnoreStalePagerTabChange({
        expectedTabName: 'Favorites',
        incomingTabName: 'Favorites',
        selectedTabName: 'Stocks',
        isRecentPagerDrag: false,
      }),
    ).toBe(false);
  });
});
