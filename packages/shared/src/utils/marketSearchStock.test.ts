import {
  isMarketSearchStockListing,
  mapMarketStockPublicItemToSearchToken,
} from './marketSearchStock';

import type { IMarketStockPublicItem } from '../../types/marketV2';

const apple: IMarketStockPublicItem = {
  stockId: 'AAPL',
  symbol: 'AAPL',
  name: 'Apple Inc.',
  logoUrl: 'https://example.com/aapl.png',
  assetType: 'stock',
  currency: 'USD',
  price: '190.12',
  priceChange24hPercent: '1.2',
  marketCap: '3000000000000',
  volume24h: '40000000000',
};

describe('isMarketSearchStockListing', () => {
  it('accepts stock search listings without a chain identity', () => {
    expect(
      isMarketSearchStockListing({
        stockId: 'AAPL',
        address: '',
        network: '',
      }),
    ).toBe(true);
  });

  it('rejects on-chain tokens even when they carry a stock id', () => {
    expect(
      isMarketSearchStockListing({
        stockId: 'AAPL',
        address: '0xaapl',
        network: 'evm--1',
      }),
    ).toBe(false);
  });
});

describe('mapMarketStockPublicItemToSearchToken', () => {
  it('maps a stock search hit onto the market search token shape', () => {
    expect(mapMarketStockPublicItemToSearchToken(apple)).toEqual({
      stockId: 'AAPL',
      name: 'Apple Inc.',
      symbol: 'AAPL',
      price: '190.12',
      address: '',
      network: '',
      logoUrl: 'https://example.com/aapl.png',
      isNative: false,
      decimals: 0,
      liquidity: '0',
      volume_24h: '40000000000',
      volume24h: '40000000000',
      marketCap: '3000000000000',
      priceChange24hPercent: '1.2',
      stock: {
        stockId: 'AAPL',
        subtitle: 'Apple Inc.',
        sourceLogoUri: '',
      },
    });
  });
});
