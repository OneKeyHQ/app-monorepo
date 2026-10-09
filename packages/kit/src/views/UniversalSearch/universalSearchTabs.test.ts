import type { IMarketAssetDetailData } from '@onekeyhq/shared/types/market';
import { EUniversalSearchType } from '@onekeyhq/shared/types/search';
import type { IUniversalSearchResultItem } from '@onekeyhq/shared/types/search';

import {
  getUniversalSearchTabIndex,
  getUniversalSearchWatchlistKey,
  isUniversalSearchItemInWatchlist,
  prioritizeMarketFocusedSections,
  resolveUniversalSearchInitialTabName,
  resolveUniversalSearchWatchlistKeys,
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

describe('getUniversalSearchWatchlistKey', () => {
  it('matches a native token by chain even when the address is empty', () => {
    expect(
      getUniversalSearchWatchlistKey({
        type: EUniversalSearchType.V2MarketToken,
        payload: { network: 'evm--1', address: '' },
      } as IUniversalSearchResultItem),
    ).toBe('evm--1:');
  });

  it('matches an issuer token by chain address instead of stock id', () => {
    expect(
      getUniversalSearchWatchlistKey({
        type: EUniversalSearchType.V2MarketToken,
        payload: {
          stockId: 'AAPL',
          network: 'evm--1',
          address: '0xAbC',
        },
      } as IUniversalSearchResultItem),
    ).toBe('evm--1:0xabc');
  });

  it('matches a bare stock listing by stock id', () => {
    expect(
      getUniversalSearchWatchlistKey({
        type: EUniversalSearchType.V2MarketToken,
        payload: { stockId: 'AAPL', network: '', address: '' },
      } as IUniversalSearchResultItem),
    ).toBe('stock:AAPL');
  });
});

describe('asset watchlist search matching', () => {
  const token = {
    type: EUniversalSearchType.V2MarketToken,
    payload: { network: 'evm--1', address: '' },
  } as IUniversalSearchResultItem;

  it('matches a favorited top coin through its native and contract variants', async () => {
    const fetchAssetDetail = jest.fn().mockResolvedValue({
      variants: [
        { networkId: 'evm--1', tokenAddress: '' },
        { networkId: 'evm--10', tokenAddress: '0xAbC' },
      ],
    });
    const keys = await resolveUniversalSearchWatchlistKeys({
      items: [{ assetId: 'ethereum', chainId: '', contractAddress: '' }],
      fetchAssetDetail,
    });
    expect(fetchAssetDetail).toHaveBeenCalledWith('ethereum');
    expect(keys.has('asset:ethereum')).toBe(true);
    expect(isUniversalSearchItemInWatchlist(token, keys)).toBe(true);
    expect(
      isUniversalSearchItemInWatchlist(
        {
          type: EUniversalSearchType.V2MarketToken,
          payload: { network: 'evm--10', address: '0xabc' },
        } as IUniversalSearchResultItem,
        keys,
      ),
    ).toBe(true);
    expect(
      isUniversalSearchItemInWatchlist(
        {
          type: EUniversalSearchType.V2MarketToken,
          payload: { network: 'evm--10', address: '0xdef' },
        } as IUniversalSearchResultItem,
        keys,
      ),
    ).toBe(false);
  });

  it('matches explicit asset IDs without losing chain-address favorites', () => {
    const assetToken = {
      type: EUniversalSearchType.V2MarketToken,
      payload: { assetId: 'ethereum', network: 'evm--1', address: '' },
    } as IUniversalSearchResultItem;
    expect(
      isUniversalSearchItemInWatchlist(assetToken, new Set(['asset:ethereum'])),
    ).toBe(true);
    expect(
      isUniversalSearchItemInWatchlist(assetToken, new Set(['evm--1:'])),
    ).toBe(true);
  });

  it('retains other favorites when an asset detail request fails', async () => {
    const fetchAssetDetail = jest
      .fn<Promise<IMarketAssetDetailData>, [string]>()
      .mockRejectedValueOnce(new Error('Unavailable'))
      .mockResolvedValueOnce({
        variants: [{ networkId: 'evm--1', tokenAddress: '' }],
      } as IMarketAssetDetailData);
    const keys = await resolveUniversalSearchWatchlistKeys({
      items: [
        { assetId: 'bitcoin', chainId: '', contractAddress: '' },
        { assetId: 'ethereum', chainId: '', contractAddress: '' },
        { stockId: 'AAPL', chainId: '', contractAddress: '' },
        { perpsCoin: 'BTC', chainId: '', contractAddress: '' },
      ],
      fetchAssetDetail,
    });
    expect([...keys]).toEqual(
      expect.arrayContaining([
        'asset:bitcoin',
        'asset:ethereum',
        'stock:AAPL',
        'perps:BTC',
        'evm--1:',
      ]),
    );
  });
});
