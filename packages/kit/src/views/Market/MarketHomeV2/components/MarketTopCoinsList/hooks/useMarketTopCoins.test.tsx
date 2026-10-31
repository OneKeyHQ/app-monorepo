/** @jest-environment jsdom */

import { act, renderHook } from '@testing-library/react';

import { Toast } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { travelModeManager } from '@onekeyhq/shared/src/travelMode';
import type {
  IMarketAssetDetailData,
  IMarketAssetListItem,
} from '@onekeyhq/shared/types/market';

import {
  resolveMarketTopCoinNavigationTarget,
  useMarketTopCoins,
} from './useMarketTopCoins';

const mockToMarketDetailPage = jest.fn();
const mockUseToDetailPage = jest.fn(
  (_options?: unknown) => mockToMarketDetailPage,
);

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
    serviceToken: {
      fetchTokenInfoOnly: jest.fn(),
    },
  },
}));

jest.mock('@onekeyhq/kit/src/hooks/usePromiseResult', () => ({
  usePromiseResult: jest.fn(() => ({ result: [], isLoading: false })),
}));

jest.mock('../../MarketTokenList/hooks/useToMarketDetailPage', () => ({
  useToDetailPage: (options: unknown) => mockUseToDetailPage(options),
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
  about: '',
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
  const serviceToken = backgroundApiProxy.serviceToken as jest.Mocked<
    typeof backgroundApiProxy.serviceToken
  >;

  beforeEach(() => {
    jest.clearAllMocks();
    serviceMarket.fetchMarketAssetDetail.mockRejectedValue(
      new Error('utility unavailable'),
    );
    serviceToken.fetchTokenInfoOnly.mockReset().mockResolvedValue({
      info: { decimals: 8 },
    } as Awaited<ReturnType<typeof serviceToken.fetchTokenInfoOnly>>);
    mockToMarketDetailPage.mockResolvedValue(undefined);
  });

  it('resolves the Home navigation target while metadata never settles', async () => {
    serviceMarket.fetchMarketAssetDetail.mockResolvedValueOnce(bitcoinDetail);
    serviceToken.fetchTokenInfoOnly.mockReturnValueOnce(
      new Promise(() => undefined),
    );

    await expect(
      resolveMarketTopCoinNavigationTarget(bitcoin),
    ).resolves.toMatchObject({
      networkId: 'evm--1',
      tokenAddress: '0xbtc',
      marketTokenId: 'btc',
      marketVariantId: 'btc-evm--1-0xbtc',
      decimals: undefined,
    });
    expect(serviceToken.fetchTokenInfoOnly.mock.calls).toHaveLength(0);
  });

  it('hands the Asset list item to detail navigation before detail resolves', async () => {
    serviceMarket.fetchMarketAssetDetail.mockReturnValueOnce(
      new Promise(() => undefined),
    );
    const { result } = renderHook(() => useMarketTopCoins());

    await act(async () => {
      await result.current.handleItemPress(bitcoin);
    });

    expect(mockToMarketDetailPage).toHaveBeenCalledWith(bitcoin);
    expect(serviceMarket.fetchMarketAssetDetail.mock.calls).toHaveLength(0);
    expect(Toast.error).not.toHaveBeenCalled();
  });

  it('ignores repeated presses while navigation is pending', async () => {
    mockToMarketDetailPage.mockReturnValueOnce(new Promise(() => undefined));
    const { result } = renderHook(() => useMarketTopCoins());

    await act(async () => {
      void result.current.handleItemPress(bitcoin);
    });
    await act(async () => {
      await result.current.handleItemPress(bitcoin);
    });

    expect(mockToMarketDetailPage).toHaveBeenCalledTimes(1);
  });

  it('lets a later press navigate after the first navigation finishes', async () => {
    const { result } = renderHook(() => useMarketTopCoins());

    await act(async () => {
      await result.current.handleItemPress(bitcoin);
      await result.current.handleItemPress(bitcoin);
    });

    expect(mockToMarketDetailPage).toHaveBeenCalledTimes(2);
  });

  it('does not open a Top Coin while travel mode is active', async () => {
    const runtimeSpy = jest
      .spyOn(travelModeManager, 'getRuntimeEnvironmentSync')
      .mockReturnValue({
        profile: { kind: 'travel-mode' },
      } as ReturnType<typeof travelModeManager.getRuntimeEnvironmentSync>);
    serviceMarket.fetchMarketAssetDetail.mockResolvedValueOnce(bitcoinDetail);
    const { result } = renderHook(() => useMarketTopCoins());

    await act(async () => {
      await result.current.handleItemPress(bitcoin);
    });

    expect(serviceMarket.fetchMarketAssetDetail.mock.calls).toHaveLength(0);
    expect(mockToMarketDetailPage).not.toHaveBeenCalled();
    runtimeSpy.mockRestore();
  });

  it('forwards detail replacement mode to the detail navigation owner', () => {
    renderHook(() => useMarketTopCoins({ replaceCurrentDetail: true }));

    expect(mockUseToDetailPage).toHaveBeenCalledWith({
      marketTokenCategory: 'top_coins',
      replaceCurrentDetail: true,
    });
  });

  it('reports a navigation failure and releases the navigation guard', async () => {
    serviceMarket.fetchMarketAssetDetail.mockResolvedValue(bitcoinDetail);
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
