import type { IMarketAssetListItem } from '@onekeyhq/shared/types/market';
import type { IMarketTokenListItem } from '@onekeyhq/shared/types/marketV2';

import {
  buildHomeMarketCategories,
  getMarketTokenDisplayPrice,
  getMarketTokenDisplayPriceChange24h,
  getMarketTokenDisplayVolume24h,
  getTokenKey,
  mapMarketAssetToDisplay,
  mapMarketTokenToDisplay,
} from './utils';

describe('PopularTrading market token display utils', () => {
  test('normalizes placeholder market values instead of returning NaN', () => {
    const item: IMarketTokenListItem = {
      networkId: 'evm--56',
      address: '0x44f161ae29361e332dea039dfa2f404e0bc5b5cc',
      name: 'Humanity',
      symbol: 'H',
      logoUrls: ['primary.png', 'fallback.png'],
      decimals: 18,
      price: '0.00137840543892581329',
      priceChange24hPercent: '-',
      volume24h: '-',
      communityRecognized: true,
    };

    expect(getMarketTokenDisplayPrice(item)).toBe(
      parseFloat(item.price ?? '0'),
    );
    expect(getMarketTokenDisplayPriceChange24h(item)).toBe(0);
    expect(getMarketTokenDisplayVolume24h(item)).toBe(0);

    const displayToken = mapMarketTokenToDisplay(item);
    expect(displayToken?.priceChange24h).toBe(0);
    expect(Number.isNaN(displayToken?.priceChange24h)).toBe(false);
    expect(displayToken?.logoUrls).toEqual(item.logoUrls);
    expect(displayToken?.communityRecognized).toBe(true);
  });

  test('maps Top Coins assets without inventing a token identity', () => {
    const item: IMarketAssetListItem = {
      assetId: 'bitcoin',
      symbol: 'btc',
      logoUrl: 'btc.png',
      price: '100000',
      priceChange24hPercent: '1.25',
      priceChange7dPercent: '-',
      marketCap: '2000000000000',
      volume24h: '50000000000',
      sparkline24h: [],
    };

    const displayToken = mapMarketAssetToDisplay(item);

    expect(displayToken).toMatchObject({
      chainId: '',
      contractAddress: '',
      isNative: false,
      symbol: 'BTC',
      price: 100_000,
      priceChange24h: 1.25,
      marketCap: 2_000_000_000_000,
      volume24h: 50_000_000_000,
      marketAsset: item,
    });
    expect(getTokenKey(displayToken)).toBe('market:bitcoin');
  });

  test('inserts Top Coins before stocks in the wallet home tabs', () => {
    const categories = buildHomeMarketCategories({
      apiHomeTabs: [
        { type: 'watchlist', name: '自选' },
        { type: 'trending', name: '热门' },
        { type: 'stocks', name: '股票' },
      ],
      favoritesCategory: {
        id: 'favorites',
        name: 'Favorites',
        iconName: 'StarOutline',
        iconOnly: true,
      },
      marketCategories: [],
      homePerpsHotCategory: {
        id: 'home-perps-hot',
        name: '合约',
      },
      topCoinsFallbackName: 'Top Coins',
    });

    expect(categories).toEqual([
      {
        id: 'favorites',
        name: '自选',
        iconName: 'StarOutline',
        iconOnly: true,
      },
      { id: 'trending', name: '热门', icon: undefined },
      { id: 'top_coins', name: 'Top Coins' },
      { id: 'stocks', name: '股票', icon: undefined },
      { id: 'home-perps-hot', name: '合约' },
    ]);
  });

  test('preserves a server-provided Top Coins tab and localized name', () => {
    const categories = buildHomeMarketCategories({
      apiHomeTabs: [
        { type: 'watchlist', name: 'Watchlist' },
        { type: 'top_coins', name: 'Mainstream Coins' },
        { type: 'stocks', name: 'Stocks' },
      ],
      favoritesCategory: { id: 'favorites', name: 'Favorites' },
      marketCategories: [],
      topCoinsFallbackName: 'Top Coins',
    });

    expect(categories.filter((item) => item.id === 'top_coins')).toEqual([
      { id: 'top_coins', name: 'Mainstream Coins', icon: undefined },
    ]);
  });
});
