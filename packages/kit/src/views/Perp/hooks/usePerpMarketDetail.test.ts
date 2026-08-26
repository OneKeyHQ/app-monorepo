/* cspell:ignore SKHX SKHY */

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import type { IMarketTokenDetail } from '@onekeyhq/shared/types/market';

import {
  resolvePerpMarketDetail,
  usePerpFundingHistory,
} from './usePerpMarketDetail';

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
const mockUsePromiseResult = jest.mocked(usePromiseResult);

describe('usePerpFundingHistory', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUsePromiseResult.mockReturnValue({
      result: [],
      isLoading: false,
      run: jest.fn(),
      setResult: jest.fn(),
      setStopPolling: jest.fn(),
    });
  });

  it('preserves the current result while a polling refresh runs', () => {
    usePerpFundingHistory('BTC', '90d');

    expect(mockUsePromiseResult).toHaveBeenCalledWith(
      expect.any(Function),
      ['BTC', '90d'],
      expect.not.objectContaining({
        undefinedResultIfReRun: true,
      }),
    );
    expect(mockUsePromiseResult).toHaveBeenCalledWith(
      expect.any(Function),
      ['BTC', '90d'],
      expect.objectContaining({
        pollingInterval: 60 * 1000,
      }),
    );
  });
});

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

  // `STX` is Stacks on the main DEX and Seagate on para.
  it('prefers a dex-scoped entry over a bare symbol of the same name', async () => {
    mockServiceHyperliquid.getPerpsAssetMetaMap.mockResolvedValue({
      STX: {
        assetId: 'blockstack',
        assetType: 'coingecko',
      },
      'para:STX': {
        assetId: 'STX',
        assetType: 'stock',
        localizedMessage: 'Seagate introduction',
      },
    });
    mockServiceMarketV2.fetchMarketStockByTicker.mockResolvedValue({
      ticker: 'STX',
      name: 'Seagate Technology',
      stock: { subtitle: 'Seagate Technology', sourceLogoUri: '' },
    });

    await expect(
      resolvePerpMarketDetail({ coin: 'para:STX', displayName: 'STX' }),
    ).resolves.toMatchObject({
      assetMetaKey: 'para:STX',
      assetId: 'STX',
      assetType: 'stock',
    });
    expect(mockServiceMarket.fetchMarketTokenDetail.mock.calls).toHaveLength(0);
  });

  it('still resolves the main dex symbol to the bare entry', async () => {
    mockServiceHyperliquid.getPerpsAssetMetaMap.mockResolvedValue({
      STX: {
        assetId: 'blockstack',
        assetType: 'non_coingecko',
        localizedMessage: 'Stacks introduction',
      },
      'para:STX': {
        assetId: 'STX',
        assetType: 'stock',
      },
    });

    await expect(
      resolvePerpMarketDetail({ coin: 'STX', displayName: 'STX' }),
    ).resolves.toMatchObject({
      assetMetaKey: 'STX',
      assetId: 'blockstack',
    });
  });
});
