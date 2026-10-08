import { EUniversalSearchType } from '@onekeyhq/shared/types/search';

import {
  getUniversalSearchTabIndex,
  prioritizeMarketFocusedSections,
  resolveUniversalSearchInitialTabName,
  shouldPrioritizeMarketSearchSections,
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
    ).toBe(5);
  });
});

describe('shouldPrioritizeMarketSearchSections', () => {
  it('is true on the Market route', () => {
    expect(
      shouldPrioritizeMarketSearchSections({
        isFocusInMarketRoute: true,
      }),
    ).toBe(true);
  });

  it('is true when opened from the market search preset', () => {
    expect(
      shouldPrioritizeMarketSearchSections({
        isFocusInMarketRoute: false,
        initialTab: 'market',
      }),
    ).toBe(true);
  });

  it('is false for Discovery-only search without the market preset', () => {
    expect(
      shouldPrioritizeMarketSearchSections({
        isFocusInMarketRoute: false,
      }),
    ).toBe(false);
  });
});

describe('resolveUniversalSearchInitialTabName', () => {
  it('opens All for the market preset so Stocks is not filtered out', () => {
    expect(
      resolveUniversalSearchInitialTabName({
        initialTab: 'market',
        allTabTitle: 'All',
        dappTabTitle: 'DApps',
      }),
    ).toBe('All');
  });

  it('still opens DApps for the dapp preset', () => {
    expect(
      resolveUniversalSearchInitialTabName({
        initialTab: 'dapp',
        allTabTitle: 'All',
        dappTabTitle: 'DApps',
      }),
    ).toBe('DApps');
  });
});

describe('prioritizeMarketFocusedSections', () => {
  it('lifts Tokens, Stocks, then Perp when Market is focused', () => {
    const sections = [
      { tabIndex: 1, title: 'Wallets' },
      { tabIndex: 2, title: 'Stocks' },
      { tabIndex: 3, title: 'Tokens' },
      { tabIndex: 5, title: 'Perp' },
    ];

    expect(
      prioritizeMarketFocusedSections(sections, {
        stocks: 2,
        market: 3,
        perp: 5,
      }).map((section) => section.title),
    ).toEqual(['Tokens', 'Stocks', 'Perp', 'Wallets']);
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
        perp: 5,
      }),
    ).toEqual(sections);
  });
});
