/** @jest-environment jsdom */

import { act, renderHook } from '@testing-library/react';

import { Toast } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type {
  IMarketAssetDetailData,
  IMarketAssetListItem,
} from '@onekeyhq/shared/types/market';

import { useMarketTopCoins } from './useMarketTopCoins';

const mockToMarketDetailPage = jest.fn();

jest.mock('react-intl', () => ({
  useIntl: () => ({
    formatMessage: ({ id }: { id: string }) => id,
  }),
}));

jest.mock('@onekeyhq/components', () => ({
  Toast: { error: jest.fn() },
}));

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceMarket: {
      fetchMarketAssetDetail: jest.fn(),
      fetchMarketAssetList: jest.fn(),
    },
  },
}));

jest.mock('@onekeyhq/kit/src/hooks/usePromiseResult', () => ({
  usePromiseResult: jest.fn(() => ({ result: [], isLoading: false })),
}));

jest.mock('../../MarketTokenList/hooks/useToMarketDetailPage', () => ({
  useToDetailPage: () => mockToMarketDetailPage,
}));

const bitcoin: IMarketAssetListItem = {
  assetId: 'btc',
  price: '100000',
  volume24h: '1000000',
  marketCap: '2000000',
  symbol: 'BTC',
  logoUrl: 'https://example.com/btc.png',
  priceChange24hPercent: '1',
  priceChange7dPercent: '2',
  sparkline24h: [],
};

const bitcoinDetail: IMarketAssetDetailData = {
  asset: {
    assetId: 'btc',
    name: 'Bitcoin',
    symbol: 'BTC',
    logoUrl: 'https://example.com/btc.png',
  },
  variants: [],
  selectedVariant: {
    variantId: 'btc-evm--1-0xbtc',
    networkId: 'evm--1',
    tokenAddress: '0xbtc',
    networkName: 'Ethereum',
    networkSymbol: 'ETH',
    networkLogoUrl: 'https://example.com/eth.png',
    isNative: false,
    isDefault: true,
  },
  market: {
    price: '100000',
    priceChange24h: '1000',
    priceChange24hPercent: '1',
    marketCap: '2000000',
    marketCapRank: 1,
    volume24h: '1000000',
    circulatingSupply: '20',
    fdv: '2100000',
    totalSupply: '21',
    maxSupply: '21',
  },
  performance: {
    priceChange7dPercent: '2',
    price7dAgo: '98000',
    priceChange30dPercent: '3',
    price30dAgo: '97000',
    priceChange3mPercent: '4',
    price3mAgo: '96000',
    priceChange1yPercent: '5',
    price1yAgo: '95000',
    allTimeHighChangePercent: '-10',
    allTimeHighPrice: '110000',
  },
};

describe('useMarketTopCoins', () => {
  const serviceMarket = backgroundApiProxy.serviceMarket as jest.Mocked<
    typeof backgroundApiProxy.serviceMarket
  >;

  beforeEach(() => {
    jest.clearAllMocks();
    serviceMarket.fetchMarketAssetDetail.mockRejectedValue(
      new Error('utility unavailable'),
    );
    mockToMarketDetailPage.mockResolvedValue(undefined);
  });

  it('navigates with the default variant returned by the Asset detail API', async () => {
    serviceMarket.fetchMarketAssetDetail.mockResolvedValueOnce(bitcoinDetail);
    const { result } = renderHook(() => useMarketTopCoins());

    await act(async () => {
      await result.current.handleItemPress(bitcoin);
    });

    expect(serviceMarket.fetchMarketAssetDetail.mock.calls).toContainEqual([
      {
        assetId: 'btc',
        currency: 'usd',
      },
    ]);
    expect(mockToMarketDetailPage).toHaveBeenCalledWith({
      address: '0xbtc',
      change24h: 1,
      isNative: false,
      marketCap: 2_000_000,
      marketTokenId: 'btc',
      name: 'Bitcoin',
      networkId: 'evm--1',
      price: 100_000,
      symbol: 'BTC',
      tokenAddress: '0xbtc',
      tokenImageUri: 'https://example.com/btc.png',
      turnover: 1_000_000,
    });
  });

  it('falls back to a synthetic detail route when lookup fails', async () => {
    const { result } = renderHook(() => useMarketTopCoins());

    await act(async () => {
      await result.current.handleItemPress(bitcoin);
      await result.current.handleItemPress(bitcoin);
    });

    expect(serviceMarket.fetchMarketAssetDetail.mock.calls).toHaveLength(2);
    expect(mockToMarketDetailPage).toHaveBeenCalledTimes(2);
    expect(mockToMarketDetailPage).toHaveBeenLastCalledWith({
      address: 'btc',
      change24h: 1,
      decimals: 0,
      disableTrade: true,
      marketCap: 2_000_000,
      name: 'BTC',
      networkId: 'coingecko',
      price: 100_000,
      showFavoriteButton: false,
      skipMarketDataFetch: true,
      symbol: 'BTC',
      tokenAddress: 'btc',
      tokenImageUri: 'https://example.com/btc.png',
      turnover: 1_000_000,
    });
    expect(Toast.error).not.toHaveBeenCalled();
  });

  it('reports a navigation failure and releases the navigation guard', async () => {
    mockToMarketDetailPage
      .mockRejectedValueOnce(new Error('navigation unavailable'))
      .mockResolvedValueOnce(undefined);
    const { result } = renderHook(() => useMarketTopCoins());

    await act(async () => {
      await result.current.handleItemPress(bitcoin);
      await result.current.handleItemPress(bitcoin);
    });

    expect(Toast.error).toHaveBeenCalledWith({
      title: ETranslations.global_an_error_occurred,
    });
    expect(mockToMarketDetailPage).toHaveBeenCalledTimes(2);
  });
});
