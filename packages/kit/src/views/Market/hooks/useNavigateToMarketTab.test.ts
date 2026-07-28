import { isMarketNavigationTargetApplied } from './marketNavigationTarget';

describe('isMarketNavigationTargetApplied', () => {
  it('does not accept a stale selected spot category from another tab', () => {
    expect(
      isMarketNavigationTargetApplied(
        {
          tab: 'watchlist',
          selectedSpotCategory: 'stock',
        },
        {
          tab: 'trending',
          spotCategory: 'stock',
        },
      ),
    ).toBe(false);
  });

  it('accepts the requested spot category after it is fully applied', () => {
    expect(
      isMarketNavigationTargetApplied(
        {
          tab: 'trending',
          selectedSpotCategory: 'stock',
        },
        {
          tab: 'trending',
          spotCategory: 'stock',
        },
      ),
    ).toBe(true);
  });

  it('accepts the requested perps category after it is fully applied', () => {
    expect(
      isMarketNavigationTargetApplied(
        {
          tab: 'perps',
          selectedPerpsCategory: 'all',
        },
        {
          tab: 'perps',
          perpsCategory: 'all',
        },
      ),
    ).toBe(true);
  });

  it('accepts a tab-only target after the tab is applied', () => {
    expect(
      isMarketNavigationTargetApplied(
        {
          tab: 'watchlist',
          selectedSpotCategory: 'stock',
        },
        {
          tab: 'watchlist',
        },
      ),
    ).toBe(true);
  });
});
