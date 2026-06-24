import type { IMarketTokenListItem } from '@onekeyhq/shared/types/marketV2';

import {
  getMarketTokenDisplayPrice,
  getMarketTokenDisplayPriceChange24h,
  getMarketTokenDisplayVolume24h,
  getTokenKey,
  mapMarketTokenToDisplay,
} from './utils';

describe('PopularTrading market token display utils', () => {
  test('builds the same token key for case-insensitive EVM addresses', () => {
    expect(
      getTokenKey({
        chainId: 'evm--1',
        contractAddress: '0x390A684EF9CaDe28A7AD0DfA61AB1eB3842618c4',
      }),
    ).toBe(
      getTokenKey({
        chainId: 'evm--1',
        contractAddress: '0x390a684ef9cade28a7ad0dfa61ab1eb3842618c4',
      }),
    );
  });

  test('builds the same token key for legacy native placeholder addresses', () => {
    expect(
      getTokenKey({
        chainId: 'evm--1',
        contractAddress: '',
        isNative: true,
      }),
    ).toBe(
      getTokenKey({
        chainId: 'evm--1',
        contractAddress: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
      }),
    );
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
