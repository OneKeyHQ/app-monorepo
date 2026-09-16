import { EUniversalSearchType } from '@onekeyhq/shared/types/search';

import {
  getUniversalSearchTabIndex,
  prioritizeMarketFocusedSections,
} from './universalSearchTabs';

describe('getUniversalSearchTabIndex', () => {
  it('places Stocks before Market and Perp', () => {
    expect(
      getUniversalSearchTabIndex(EUniversalSearchType.MarketStock, {
        isWebDappMode: false,
      }),
    ).toBe(2);
    expect(
      getUniversalSearchTabIndex(EUniversalSearchType.V2MarketToken, {
        isWebDappMode: false,
      }),
    ).toBe(3);
    expect(
      getUniversalSearchTabIndex(EUniversalSearchType.Perp, {
        isWebDappMode: false,
      }),
    ).toBe(4);
  });
});

describe('prioritizeMarketFocusedSections', () => {
  it('lifts Stocks, Market, then Perp when Market is focused', () => {
    const sections = [
      { tabIndex: 1, title: 'Wallets' },
      { tabIndex: 2, title: 'Stocks' },
      { tabIndex: 3, title: 'Market' },
      { tabIndex: 4, title: 'Perp' },
    ];

    expect(
      prioritizeMarketFocusedSections(sections, {
        stocks: 2,
        market: 3,
        perp: 4,
      }).map((section) => section.title),
    ).toEqual(['Stocks', 'Market', 'Perp', 'Wallets']);
  });

  it('keeps the original order when neither Stocks nor Market is present', () => {
    const sections = [
      { tabIndex: 1, title: 'Wallets' },
      { tabIndex: 4, title: 'Perp' },
    ];

    expect(
      prioritizeMarketFocusedSections(sections, {
        stocks: 2,
        market: 3,
        perp: 4,
      }),
    ).toEqual(sections);
  });
});
