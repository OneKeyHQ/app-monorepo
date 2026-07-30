/* cspell:ignore SKHX SKHY */

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type { IMarketTokenDetail } from '@onekeyhq/shared/types/market';

import { resolvePerpMarketDetail } from './usePerpMarketDetail';

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceHyperliquid: {
      getPerpsAssetMetaMap: jest.fn(),
    },
    serviceMarket: {
      fetchMarketTokenDetail: jest.fn(),
    },
    serviceMarketV2: {
      fetchMarketStockByTicker: jest.fn(),
    },
  },
}));

jest.mock('@onekeyhq/kit/src/hooks/usePromiseResult', () => ({
  usePromiseResult: jest.fn(),
}));

const mockServiceHyperliquid = jest.mocked(
  backgroundApiProxy.serviceHyperliquid,
);
const mockServiceMarket = jest.mocked(backgroundApiProxy.serviceMarket);
const mockServiceMarketV2 = jest.mocked(backgroundApiProxy.serviceMarketV2);

describe('resolvePerpMarketDetail', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('loads stock details by the configured ticker', async () => {
    const stockDetail = {
      ticker: 'SKHY',
      name: 'SK hynix Inc.',
      stock: {
        subtitle: 'SK hynix Inc.',
        sourceLogoUri: '',
      },
    };
    mockServiceHyperliquid.getPerpsAssetMetaMap.mockResolvedValue({
      SKHX: {
        assetId: 'SKHY',
        assetType: 'stock',
        localizedMessage: 'Fallback introduction',
      },
    });
    mockServiceMarketV2.fetchMarketStockByTicker.mockResolvedValue(stockDetail);

    await expect(
      resolvePerpMarketDetail({ coin: 'xyz:SKHX', displayName: 'SKHX' }),
    ).resolves.toEqual({
      assetMetaKey: 'SKHX',
      assetId: 'SKHY',
      assetType: 'stock',
      localizedMessage: 'Fallback introduction',
      detail: undefined,
      stockDetail,
    });
    expect(mockServiceMarketV2.fetchMarketStockByTicker.mock.calls).toEqual([
      ['SKHY'],
    ]);
    expect(mockServiceMarket.fetchMarketTokenDetail.mock.calls).toHaveLength(0);
  });

  it('keeps the existing CoinGecko detail path', async () => {
    const detail: IMarketTokenDetail = {
      name: 'Bitcoin',
      image: '',
      symbol: 'BTC',
      about: '',
      explorers: [],
      links: {
        homePageUrl: '',
        discordUrl: '',
        twitterUrl: '',
        whitepaper: '',
        telegramUrl: '',
      },
      stats: {
        performance: {
          priceChangePercentage1h: 0,
          priceChangePercentage24h: 0,
          priceChangePercentage7d: 0,
          priceChangePercentage14d: 0,
          priceChangePercentage30d: 0,
          priceChangePercentage1y: 0,
        },
        marketCap: 0,
        marketCapRank: 0,
        volume24h: 0,
        low24h: 0,
        high24h: 0,
        atl: { time: new Date(0), value: 0 },
        ath: { time: new Date(0), value: 0 },
        fdv: 0,
        circulatingSupply: 0,
        totalSupply: 0,
        maxSupply: 0,
        currentPrice: '0',
        lastUpdated: '',
      },
      fallbackToChart: false,
      detailPlatforms: {},
      platforms: {},
    };
    mockServiceHyperliquid.getPerpsAssetMetaMap.mockResolvedValue({
      BTC: {
        assetId: 'bitcoin',
        assetType: 'coingecko',
      },
    });
    mockServiceMarket.fetchMarketTokenDetail.mockResolvedValue(detail);

    await expect(
      resolvePerpMarketDetail({ coin: 'BTC', displayName: 'BTC' }),
    ).resolves.toMatchObject({
      assetId: 'bitcoin',
      assetType: 'coingecko',
      detail,
    });
    expect(mockServiceMarket.fetchMarketTokenDetail.mock.calls).toEqual([
      ['bitcoin'],
    ]);
    expect(
      mockServiceMarketV2.fetchMarketStockByTicker.mock.calls,
    ).toHaveLength(0);
  });

  it('does not fetch remote details for non-CoinGecko assets', async () => {
    mockServiceHyperliquid.getPerpsAssetMetaMap.mockResolvedValue({
      GOLD: {
        assetId: 'GOLD',
        assetType: 'non_coingecko',
        localizedMessage: 'Gold introduction',
      },
    });

    await expect(
      resolvePerpMarketDetail({ coin: 'xyz:GOLD', displayName: 'GOLD' }),
    ).resolves.toMatchObject({
      assetId: 'GOLD',
      assetType: 'non_coingecko',
      localizedMessage: 'Gold introduction',
    });
    expect(mockServiceMarket.fetchMarketTokenDetail.mock.calls).toHaveLength(0);
    expect(
      mockServiceMarketV2.fetchMarketStockByTicker.mock.calls,
    ).toHaveLength(0);
  });
});
