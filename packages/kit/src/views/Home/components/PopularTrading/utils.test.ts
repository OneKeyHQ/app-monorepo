import type { IMarketTokenListItem } from '@onekeyhq/shared/types/marketV2';

import {
  getMarketCategoryIds,
  getMarketTokenDisplayPrice,
  getMarketTokenDisplayPriceChange24h,
  getMarketTokenDisplayVolume24h,
  mapMarketTokenToDisplay,
} from './utils';

describe('PopularTrading market token display utils', () => {
  test('deduplicates and sorts selected and prefetched categories', () => {
    expect(
      getMarketCategoryIds({
        prefetchMarketCategoryIds: ['stocks', 'trending', 'stocks'],
        selectedMarketCategoryId: 'perps-hot',
      }),
    ).toEqual(['perps-hot', 'stocks', 'trending']);
  });

  test('omits an absent selected category', () => {
    expect(
      getMarketCategoryIds({
        prefetchMarketCategoryIds: [],
        selectedMarketCategoryId: undefined,
      }),
    ).toEqual([]);
  });

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
});
