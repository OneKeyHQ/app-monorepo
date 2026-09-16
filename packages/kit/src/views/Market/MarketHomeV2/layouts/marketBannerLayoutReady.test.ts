import {
  shouldFetchWatchlistQuotesWhileFocused,
  shouldWaitForNativeMarketBannerBeforeLayout,
} from './marketBannerLayoutReady';

describe('shouldWaitForNativeMarketBannerBeforeLayout', () => {
  it('does not block native first paint so watchlist quotes can start with the banner', () => {
    expect(shouldWaitForNativeMarketBannerBeforeLayout()).toBe(false);
  });
});

describe('shouldFetchWatchlistQuotesWhileFocused', () => {
  it('lets native fetch on first load even when the route is not focused yet', () => {
    expect(
      shouldFetchWatchlistQuotesWhileFocused({
        isFocused: false,
        pageIndex: 1,
        isNative: true,
        isInitialLoad: true,
      }),
    ).toBe(true);
  });

  it('requires the watchlist page after native first load', () => {
    expect(
      shouldFetchWatchlistQuotesWhileFocused({
        isFocused: true,
        pageIndex: 1,
        isNative: true,
        isInitialLoad: false,
      }),
    ).toBe(false);
  });

  it('requires a focused watchlist page on other platforms', () => {
    expect(
      shouldFetchWatchlistQuotesWhileFocused({
        isFocused: true,
        pageIndex: 0,
        isNative: false,
        isInitialLoad: true,
      }),
    ).toBe(true);
    expect(
      shouldFetchWatchlistQuotesWhileFocused({
        isFocused: false,
        pageIndex: 0,
        isNative: false,
        isInitialLoad: true,
      }),
    ).toBe(false);
  });
});
