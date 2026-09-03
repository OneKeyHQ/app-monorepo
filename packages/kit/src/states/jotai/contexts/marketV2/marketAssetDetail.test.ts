import type { IMarketAssetDetailData } from '@onekeyhq/shared/types/market';

import { buildMarketAssetTokenDetail } from './marketAssetDetail';

jest.mock(
  '@onekeyhq/kit/src/background/instance/backgroundApiProxy',
  () => ({}),
);

const dogeAssetDetail: IMarketAssetDetailData = {
  asset: {
    assetId: 'doge',
    name: 'Dogecoin',
    symbol: 'doge',
    logoUrl: 'https://example.com/doge.png',
  },
  variants: [],
  selectedVariant: {
    variantId: 'doge-doge--0-1',
    networkId: 'doge--0',
    tokenAddress: '',
    networkName: 'Dogecoin',
    networkSymbol: 'DOGE',
    networkLogoUrl: 'https://example.com/doge-network.png',
    isNative: true,
    isDefault: true,
  },
  market: {
    price: '0.25',
    priceChange24h: '0.01',
    priceChange24hPercent: '4.2',
    marketCap: '36000000000',
    marketCapRank: 8,
    volume24h: '1200000000',
    circulatingSupply: '145000000000',
    fdv: '36000000000',
    totalSupply: '145000000000',
    maxSupply: '',
  },
  performance: {
    priceChange7dPercent: '5',
    price7dAgo: '0.23',
    priceChange30dPercent: '6',
    price30dAgo: '0.22',
    priceChange3mPercent: '7',
    price3mAgo: '0.21',
    priceChange1yPercent: '8',
    price1yAgo: '0.2',
    allTimeHighChangePercent: '-60',
    allTimeHighPrice: '0.73',
  },
};

describe('buildMarketAssetTokenDetail', () => {
  it('preserves the native asset identity and maps market fields', () => {
    expect(
      buildMarketAssetTokenDetail({
        assetDetail: dogeAssetDetail,
        decimals: 8,
        lastUpdated: 1_788_332_400_000,
      }),
    ).toMatchObject({
      address: '',
      networkId: 'doge--0',
      isNative: true,
      name: 'Dogecoin',
      symbol: 'DOGE',
      decimals: 8,
      decimalsResolved: true,
      price: '0.25',
      priceChange24hPercent: '4.2',
      priceChange7dPercent: '5',
      marketCap: '36000000000',
      fdv: '36000000000',
      volume24h: '1200000000',
      lastUpdated: 1_788_332_400_000,
    });
  });
});
