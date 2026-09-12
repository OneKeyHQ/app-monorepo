/** @jest-environment jsdom */
import { act, renderHook, waitFor } from '@testing-library/react';

import { Toast, rootNavigationRef } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { preloadMarketDetailV2Page } from '@onekeyhq/kit/src/views/Market/MarketDetailV2/utils/marketDetailPagePreload';
import { appEventBus } from '@onekeyhq/shared/src/eventBus/appEventBus';
import { EEnterWay } from '@onekeyhq/shared/src/logger/scopes/dex';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { useToDetailPage } from './useToMarketDetailPage';

jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));

const mockNavigationPush = jest.fn();
const mockNavigationReplace = jest.fn();
const mockClearTokenDetail = jest.fn();
const mockPrepareTokenDetailPreview = jest.fn();
let mockCurrentRouteName = 'MarketDetailV2';
let mockSplitViewType = 'UNKNOWN';
let mockTravelMode = false;

jest.mock('@onekeyhq/shared/src/travelMode', () => ({
  travelModeManager: {
    getRuntimeEnvironmentSync: () => ({
      profile: { kind: mockTravelMode ? 'travel-mode' : 'standard' },
    }),
  },
}));

jest.mock('@react-navigation/native', () => ({
  useRoute: jest.fn(() => ({ name: mockCurrentRouteName })),
}));

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: {
    isExtensionUiPopup: true,
    isExtensionUiSidePanel: false,
    isNative: false,
  },
}));

jest.mock('@onekeyhq/shared/src/logger/scopes/dex', () => ({
  EEnterWay: {
    ExtensionPopup: 'ExtensionPopup',
    ExtensionSidePanel: 'ExtensionSidePanel',
    Search: 'Search',
  },
}));

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceMarket: { fetchMarketAssetDetail: jest.fn() },
    serviceApp: {
      openExtensionMarketTokenDetail: jest.fn(),
      openExtensionMarketStockDetail: jest.fn(),
    },
  },
}));

jest.mock(
  '@onekeyhq/kit/src/views/Market/MarketDetailV2/utils/marketDetailPagePreload',
  () => ({
    preloadMarketDetailV2Page: jest.fn(() => Promise.resolve()),
  }),
);

jest.mock('@onekeyhq/components', () => ({
  Toast: { error: jest.fn() },
  ESplitViewType: {
    UNKNOWN: 'UNKNOWN',
  },
  s: (value: number) => value,
  rootNavigationRef: {
    current: {
      navigate: jest.fn(),
    },
  },
  useMedia: jest.fn(() => ({ gtLg: false })),
  useSplitViewType: jest.fn(() => mockSplitViewType),
}));

jest.mock('@onekeyhq/kit/src/hooks/useAppNavigation', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    push: mockNavigationPush,
    replace: mockNavigationReplace,
    switchTab: jest.fn(),
  })),
}));

jest.mock('@onekeyhq/kit/src/states/jotai/contexts/marketV2', () => ({
  useTokenDetailActions: jest.fn(() => ({
    current: {
      clearTokenDetail: mockClearTokenDetail,
      prepareTokenDetailPreview: mockPrepareTokenDetailPreview,
    },
  })),
}));

jest.mock('@onekeyhq/shared/src/eventBus/appEventBus', () => ({
  appEventBus: {
    emit: jest.fn(),
  },
}));

jest.mock('@onekeyhq/shared/src/eventBus/appEventBusNames', () => ({
  EAppEventBusNames: {
    CleanTokenDetailInTabletDetailView: 'CleanTokenDetailInTabletDetailView',
  },
}));

jest.mock('@onekeyhq/shared/src/utils/networkUtils', () => ({
  __esModule: true,
  default: {
    getNetworkShortCode: jest.fn(() => 'eth'),
  },
}));

describe('useToDetailPage', () => {
  const originalWindowClose = globalThis.close;
  let openExtensionMarketTokenDetailMock: jest.Mock;
  let openExtensionMarketStockDetailMock: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    jest
      .spyOn(backgroundApiProxy.serviceMarket, 'fetchMarketAssetDetail')
      .mockReset();
    Object.assign(platformEnv, { isNative: false });
    jest.useFakeTimers();
    mockCurrentRouteName = 'MarketDetailV2';
    mockSplitViewType = 'UNKNOWN';
    mockTravelMode = false;
    (
      platformEnv as typeof platformEnv & {
        isExtensionUiPopup: boolean;
      }
    ).isExtensionUiPopup = true;
    openExtensionMarketTokenDetailMock = jest.spyOn(
      backgroundApiProxy.serviceApp,
      'openExtensionMarketTokenDetail',
    ) as unknown as jest.Mock;
    openExtensionMarketTokenDetailMock.mockResolvedValue(undefined);
    openExtensionMarketStockDetailMock = jest.spyOn(
      backgroundApiProxy.serviceApp,
      'openExtensionMarketStockDetail',
    ) as unknown as jest.Mock;
    openExtensionMarketStockDetailMock.mockResolvedValue(undefined);
    Object.defineProperty(globalThis, 'close', {
      configurable: true,
      value: jest.fn(),
    });
  });

  afterEach(() => {
    jest.useRealTimers();
    Object.defineProperty(globalThis, 'close', {
      configurable: true,
      value: originalWindowClose,
    });
  });

  it('consumes failed asset navigation requests and displays an error', async () => {
    jest
      .spyOn(backgroundApiProxy.serviceMarket, 'fetchMarketAssetDetail')
      .mockRejectedValueOnce(new Error('offline'));
    const { result } = renderHook(() => useToDetailPage());
    await act(async () => {
      await expect(
        result.current({
          assetId: 'bitcoin',
          networkId: '',
          tokenAddress: '',
          symbol: 'BTC',
        }),
      ).resolves.toBeUndefined();
    });
    expect(Toast.error).toHaveBeenCalledTimes(1);
    expect(mockNavigationPush).not.toHaveBeenCalled();
    expect(openExtensionMarketTokenDetailMock).not.toHaveBeenCalled();
  });

  it('ignores asset detail presses before resolving a variant in Travel Mode', async () => {
    mockTravelMode = true;
    const fetchMarketAssetDetail = jest.spyOn(
      backgroundApiProxy.serviceMarket,
      'fetchMarketAssetDetail',
    );
    const { result } = renderHook(() => useToDetailPage());
    const preloadCalls = jest.mocked(preloadMarketDetailV2Page).mock.calls
      .length;

    await act(async () => {
      await result.current({
        assetId: 'bitcoin',
        networkId: '',
        tokenAddress: '',
        symbol: 'BTC',
      });
    });

    expect(fetchMarketAssetDetail).not.toHaveBeenCalled();
    expect(preloadMarketDetailV2Page).toHaveBeenCalledTimes(preloadCalls);
    expect(mockNavigationPush).not.toHaveBeenCalled();
    expect(mockNavigationReplace).not.toHaveBeenCalled();
    expect(openExtensionMarketTokenDetailMock).not.toHaveBeenCalled();
  });

  const assetItem = {
    assetId: 'bitcoin',
    networkId: '',
    tokenAddress: '',
    symbol: 'BTC',
  };
  const stockItem = {
    stockId: 'AAPL',
    networkId: '',
    tokenAddress: '',
    symbol: 'AAPL',
  };
  const tokenItem = {
    networkId: 'evm--1',
    tokenAddress: '0xtoken',
    symbol: 'TOKEN',
  };
  const assetDetail = {
    about: '',
    asset: { assetId: 'bitcoin', name: 'Bitcoin', symbol: 'BTC', logoUrl: '' },
    variants: [],
    selectedVariant: {
      variantId: 'bitcoin-native',
      networkId: 'btc--0',
      tokenAddress: '',
      networkName: 'Bitcoin',
      networkSymbol: 'BTC',
      networkLogoUrl: '',
      isNative: true,
      isDefault: true,
    },
    market: {
      price: '',
      priceChange24h: '',
      priceChange24hPercent: '',
      marketCap: '',
      marketCapRank: null,
      volume24h: '',
      circulatingSupply: '',
      fdv: '',
      totalSupply: '',
      maxSupply: '',
    },
    performance: {
      priceChange7dPercent: '',
      price7dAgo: '',
      priceChange30dPercent: '',
      price30dAgo: '',
      priceChange3mPercent: '',
      price3mAgo: '',
      priceChange1yPercent: '',
      price1yAgo: '',
      allTimeHighChangePercent: '',
      allTimeHighPrice: '',
    },
  };

  function deferred<T>() {
    let resolve!: (value: T) => void;
    let reject!: (reason: Error) => void;
    const promise = new Promise<T>((resolvePromise, rejectPromise) => {
      resolve = resolvePromise;
      reject = rejectPromise;
    });
    return { promise, resolve, reject };
  }

  it.each([
    ['asset', { ...assetItem, assetId: 'ethereum', symbol: 'ETH' }],
    ['stock', stockItem],
    ['token', tokenItem],
  ])(
    'ignores a late asset response after selecting another %s',
    async (_type, nextItem) => {
      Object.assign(platformEnv, { isExtensionUiPopup: false });
      const first = deferred<typeof assetDetail>();
      const fetchAssetDetail = jest
        .spyOn(backgroundApiProxy.serviceMarket, 'fetchMarketAssetDetail')
        .mockImplementationOnce(() => first.promise)
        .mockResolvedValueOnce(assetDetail);
      const { result, rerender } = renderHook(() => useToDetailPage());
      const firstNavigation = result.current(assetItem);
      await waitFor(() => {
        expect(fetchAssetDetail).toHaveBeenCalledTimes(1);
      });
      rerender();
      await act(async () => {
        await result.current(nextItem);
      });
      expect(mockNavigationPush).toHaveBeenCalledTimes(1);
      const lastNavigation = mockNavigationPush.mock.calls[0];
      await act(async () => {
        first.resolve(assetDetail);
        await firstNavigation;
      });
      expect(mockNavigationPush).toHaveBeenCalledTimes(1);
      expect(mockNavigationPush.mock.calls[0]).toEqual(lastNavigation);
      expect(Toast.error).not.toHaveBeenCalled();
    },
  );

  it('suppresses errors from superseded asset requests', async () => {
    const first = deferred<typeof assetDetail>();
    const fetchAssetDetail = jest
      .spyOn(backgroundApiProxy.serviceMarket, 'fetchMarketAssetDetail')
      .mockImplementationOnce(() => first.promise);
    const { result } = renderHook(() => useToDetailPage());
    const firstNavigation = result.current(assetItem);
    await waitFor(() => {
      expect(fetchAssetDetail).toHaveBeenCalledTimes(1);
    });
    await act(async () => {
      await result.current(stockItem);
      first.reject(new Error('offline'));
      await firstNavigation;
    });
    expect(Toast.error).not.toHaveBeenCalled();
    expect(openExtensionMarketStockDetailMock).toHaveBeenCalledTimes(1);
    expect(openExtensionMarketTokenDetailMock).not.toHaveBeenCalled();
  });

  it('ignores superseded native preload completion', async () => {
    Object.assign(platformEnv, { isExtensionUiPopup: false, isNative: true });
    const { result } = renderHook(() => useToDetailPage());
    const first = deferred<void>();
    jest
      .mocked(preloadMarketDetailV2Page)
      .mockImplementationOnce(() => first.promise);
    const firstNavigation = result.current(tokenItem);
    await act(async () => {
      await result.current(stockItem);
      first.resolve();
      await firstNavigation;
    });
    expect(mockNavigationPush).toHaveBeenCalledTimes(1);
    expect(mockNavigationPush).toHaveBeenCalledWith(
      'MarketStockDetail',
      expect.objectContaining({ stockId: 'AAPL' }),
    );
  });

  it('only runs the latest selection across separate search row hooks', async () => {
    Object.assign(platformEnv, { isExtensionUiPopup: false });
    const first = renderHook(() =>
      useToDetailPage({ switchToMarketTabFirst: true }),
    );
    const second = renderHook(() =>
      useToDetailPage({ switchToMarketTabFirst: true }),
    );
    const pending = deferred<void>();
    jest
      .mocked(preloadMarketDetailV2Page)
      .mockImplementationOnce(() => pending.promise);
    const navigate = jest.spyOn(rootNavigationRef.current!, 'navigate');
    const firstNavigation = first.result.current(tokenItem);
    await act(async () => {
      await second.result.current(stockItem);
    });
    expect(navigate).toHaveBeenCalledTimes(1);
    await act(async () => {
      pending.resolve();
      await firstNavigation;
    });
    expect(navigate).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        params: expect.objectContaining({ screen: 'MarketStockDetail' }),
      }),
    );
  });

  it('only runs the latest desktop navigation while preloading', async () => {
    Object.assign(platformEnv, { isExtensionUiPopup: false });
    const navigateSpy = jest.spyOn(rootNavigationRef.current!, 'navigate');
    const { result } = renderHook(() =>
      useToDetailPage({ switchToMarketTabFirst: true }),
    );
    await act(async () => {
      await Promise.all([result.current(tokenItem), result.current(stockItem)]);
    });
    act(() => {
      jest.advanceTimersByTime(500);
    });
    expect(navigateSpy).toHaveBeenCalledTimes(1);
    expect(navigateSpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        params: expect.objectContaining({
          screen: 'MarketStockDetail',
          params: expect.objectContaining({ stockId: 'AAPL' }),
        }),
      }),
    );
  });

  it('carries desktop search preview into the destination without changing the visible detail', async () => {
    Object.assign(platformEnv, { isExtensionUiPopup: false, isNative: false });
    const preview = {
      address: '0xabc',
      networkId: 'evm--1',
      symbol: 'ABC',
      name: 'ABC',
      decimals: 18,
      selectedAt: 1,
    };
    const { result } = renderHook(() =>
      useToDetailPage({
        switchToMarketTabFirst: true,
        resolveMarketAsset: true,
      }),
    );
    const ready = deferred<void>();
    jest
      .mocked(preloadMarketDetailV2Page)
      .mockImplementationOnce(() => ready.promise);
    const navigate = jest.spyOn(rootNavigationRef.current!, 'navigate');
    let navigation: Promise<void> | undefined;
    act(() => {
      navigation = result.current({
        ...tokenItem,
        tokenDetailPreview: preview,
      });
    });
    expect(mockPrepareTokenDetailPreview).not.toHaveBeenCalled();
    expect(mockClearTokenDetail).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
    await act(async () => {
      ready.resolve();
      await navigation;
    });
    expect(navigate).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        params: expect.objectContaining({
          screen: 'MarketDetailV2',
          params: expect.objectContaining({
            legacyTokenPreview: preview,
            resolveMarketAsset: true,
          }),
        }),
      }),
    );
    expect(mockPrepareTokenDetailPreview).not.toHaveBeenCalled();
    expect(mockClearTokenDetail).not.toHaveBeenCalled();
  });

  it.each([false, true])(
    'initializes a generated list preview at the platform owner (native=%s)',
    async (isNative) => {
      Object.assign(platformEnv, { isExtensionUiPopup: false, isNative });
      const { result } = renderHook(() => useToDetailPage());
      await act(async () => {
        await result.current({ ...tokenItem, name: 'ABC Token', decimals: 18 });
      });
      const preview = expect.objectContaining({
        name: 'ABC Token',
        decimals: 18,
        networkId: tokenItem.networkId,
        address: tokenItem.tokenAddress,
      });
      if (isNative) {
        expect(mockPrepareTokenDetailPreview).toHaveBeenCalledTimes(1);
        expect(mockPrepareTokenDetailPreview).toHaveBeenCalledWith(preview);
        expect(mockNavigationPush.mock.calls[0][1]).not.toHaveProperty(
          'legacyTokenPreview',
        );
      } else {
        expect(mockNavigationPush).toHaveBeenCalledWith(
          'MarketDetailV2',
          expect.objectContaining({ legacyTokenPreview: preview }),
        );
        expect(mockPrepareTokenDetailPreview).not.toHaveBeenCalled();
      }
      expect(mockClearTokenDetail).not.toHaveBeenCalled();
    },
  );

  it('navigates stock items with stockId instead of chain identity', async () => {
    const mockedPlatformEnv = platformEnv as typeof platformEnv & {
      isExtensionUiPopup: boolean;
    };
    mockedPlatformEnv.isExtensionUiPopup = false;
    const { result } = renderHook(() =>
      useToDetailPage({ resolveMarketAsset: true }),
    );

    await act(async () => {
      await result.current({
        tokenAddress: '0xaapl',
        networkId: 'evm--1',
        symbol: 'AAPLon',
        disableTrade: true,
        showFavoriteButton: false,
        stock: {
          subtitle: 'Apple Inc.',
          sourceLogoUri: '',
          stockId: 'AAPL',
        },
      });
    });

    expect(mockNavigationPush).toHaveBeenCalledWith('MarketStockDetail', {
      stockId: 'AAPL',
      tokenAddress: '0xaapl',
      network: 'eth',
      isNative: undefined,
      from: undefined,
      disableTrade: true,
      showFavoriteButton: false,
    });
    expect(preloadMarketDetailV2Page).toHaveBeenLastCalledWith({
      includeBodyModules: true,
      includeHeavyModules: true,
      isStockRoute: true,
      layout: 'mobile',
    });
    mockedPlatformEnv.isExtensionUiPopup = true;
  });

  it('navigates xStocks search items without stock metadata to stock detail', async () => {
    const mockedPlatformEnv = platformEnv as typeof platformEnv & {
      isExtensionUiPopup: boolean;
    };
    mockedPlatformEnv.isExtensionUiPopup = false;
    const { result } = renderHook(() => useToDetailPage());

    await act(async () => {
      await result.current({
        tokenAddress: '0xc156',
        networkId: 'evm--196',
        name: 'Airbnb xStock',
        symbol: 'ABNBx',
      });
    });

    expect(mockNavigationPush).toHaveBeenCalledWith('MarketStockDetail', {
      stockId: 'ABNB',
      tokenAddress: '0xc156',
      network: 'eth',
      isNative: undefined,
      from: undefined,
    });
    mockedPlatformEnv.isExtensionUiPopup = true;
  });

  it('replaces the current detail route for a stock selected from detail', async () => {
    const mockedPlatformEnv = platformEnv as typeof platformEnv & {
      isExtensionUiPopup: boolean;
    };
    mockedPlatformEnv.isExtensionUiPopup = false;
    const { result } = renderHook(() =>
      useToDetailPage({ replaceCurrentDetail: true }),
    );

    await act(async () => {
      await result.current({
        tokenAddress: '0xaapl',
        networkId: 'evm--1',
        symbol: 'AAPLon',
        stock: {
          subtitle: 'Apple Inc.',
          sourceLogoUri: '',
          underlyingAssetTicker: 'AAPL',
        },
      });
    });

    expect(mockNavigationReplace).toHaveBeenCalledWith('MarketStockDetail', {
      stockId: 'AAPL',
      tokenAddress: '0xaapl',
      network: 'eth',
      isNative: undefined,
      from: undefined,
    });
    expect(mockNavigationPush).not.toHaveBeenCalled();
    mockedPlatformEnv.isExtensionUiPopup = true;
  });

  it('updates the current V2 detail route without replacing it', async () => {
    const mockedPlatformEnv = platformEnv as typeof platformEnv & {
      isExtensionUiPopup: boolean;
    };
    mockedPlatformEnv.isExtensionUiPopup = false;
    const { result } = renderHook(() =>
      useToDetailPage({
        marketTokenCategory: 'top_coins',
        replaceCurrentDetail: true,
      }),
    );

    await act(async () => {
      await result.current({
        tokenAddress: '',
        networkId: 'evm--1',
        symbol: 'ETH',
        isNative: true,
        marketTokenId: 'ethereum',
      });
    });

    expect(mockNavigationPush).toHaveBeenCalledWith('MarketDetailV2', {
      tokenAddress: '',
      network: 'eth',
      isNative: true,
      from: undefined,
      marketTokenId: 'ethereum',
      marketTokenCategory: 'top_coins',
    });
    expect(mockNavigationReplace).not.toHaveBeenCalled();
  });

  it('keeps the current split-view detail route before replacing it', async () => {
    const mockedPlatformEnv = platformEnv as typeof platformEnv & {
      isExtensionUiPopup: boolean;
    };
    mockedPlatformEnv.isExtensionUiPopup = false;
    mockCurrentRouteName = 'MarketNativeDetail';
    mockSplitViewType = 'SUB';
    const appEventBusEmitSpy = jest.spyOn(appEventBus, 'emit');
    const { result } = renderHook(() =>
      useToDetailPage({
        marketTokenCategory: 'top_coins',
        replaceCurrentDetail: true,
      }),
    );

    await act(async () => {
      await result.current({
        tokenAddress: '',
        networkId: 'evm--1',
        symbol: 'ETH',
        isNative: true,
      });
    });

    expect(appEventBusEmitSpy).not.toHaveBeenCalled();
    expect(mockNavigationReplace).toHaveBeenCalledWith('MarketDetailV2', {
      tokenAddress: '',
      network: 'eth',
      isNative: true,
      from: undefined,
      marketTokenCategory: 'top_coins',
    });
  });

  it('preserves the originating market category for normal token detail', async () => {
    const mockedPlatformEnv = platformEnv as typeof platformEnv & {
      isExtensionUiPopup: boolean;
    };
    mockedPlatformEnv.isExtensionUiPopup = false;
    const { result } = renderHook(() =>
      useToDetailPage({ marketTokenCategory: 'top_coins' }),
    );

    await act(async () => {
      await result.current({
        tokenAddress: '',
        networkId: 'evm--1',
        symbol: 'ETH',
        isNative: true,
      });
    });

    expect(mockNavigationPush).toHaveBeenCalledWith('MarketDetailV2', {
      tokenAddress: '',
      network: 'eth',
      isNative: true,
      from: undefined,
      marketTokenCategory: 'top_coins',
    });
    expect(preloadMarketDetailV2Page).toHaveBeenLastCalledWith({
      includeBodyModules: true,
      includeHeavyModules: true,
      isStockRoute: false,
      layout: 'mobile',
    });
    mockedPlatformEnv.isExtensionUiPopup = true;
  });

  it('forwards legacy top-coins compatibility params to V2 detail', async () => {
    const mockedPlatformEnv = platformEnv as typeof platformEnv & {
      isExtensionUiPopup: boolean;
    };
    mockedPlatformEnv.isExtensionUiPopup = false;
    const { result } = renderHook(() =>
      useToDetailPage({ marketTokenCategory: 'top_coins' }),
    );

    await act(async () => {
      await result.current({
        tokenAddress: '',
        networkId: 'evm--999',
        symbol: 'HYPE',
        isNative: true,
        marketTokenId: 'hyperliquid',
        skipMarketDataFetch: true,
        disableTrade: true,
        showFavoriteButton: false,
      });
    });

    expect(mockNavigationPush).toHaveBeenCalledWith('MarketDetailV2', {
      tokenAddress: '',
      network: 'eth',
      isNative: true,
      from: undefined,
      marketTokenId: 'hyperliquid',
      skipMarketDataFetch: true,
      disableTrade: true,
      showFavoriteButton: false,
      marketTokenCategory: 'top_coins',
    });
    mockedPlatformEnv.isExtensionUiPopup = true;
  });

  it('preserves asset and variant identity for Top Coins detail', async () => {
    const mockedPlatformEnv = platformEnv as typeof platformEnv & {
      isExtensionUiPopup: boolean;
    };
    mockedPlatformEnv.isExtensionUiPopup = false;
    const { result } = renderHook(() =>
      useToDetailPage({ marketTokenCategory: 'top_coins' }),
    );

    await act(async () => {
      await result.current({
        tokenAddress: '',
        networkId: 'doge--0',
        symbol: 'DOGE',
        isNative: true,
        marketTokenId: 'doge',
        marketVariantId: 'doge-doge--0-1',
      });
    });

    expect(mockNavigationPush).toHaveBeenCalledWith('MarketDetailV2', {
      tokenAddress: '',
      network: 'eth',
      isNative: true,
      from: undefined,
      marketTokenId: 'doge',
      marketVariantId: 'doge-doge--0-1',
      marketTokenCategory: 'top_coins',
    });
    mockedPlatformEnv.isExtensionUiPopup = true;
  });

  it('navigates immediately and defers Asset identity resolution to detail', async () => {
    const mockedPlatformEnv = platformEnv as typeof platformEnv & {
      isExtensionUiPopup: boolean;
    };
    mockedPlatformEnv.isExtensionUiPopup = false;
    const tokenDetailPreview = {
      address: '0xbtc',
      networkId: 'evm--1',
      isNative: false,
      name: 'Bitcoin',
      symbol: 'BTC',
      decimals: 8,
      selectedAt: 1,
    };
    const { result } = renderHook(() =>
      useToDetailPage({ resolveMarketAsset: true }),
    );

    await act(async () => {
      await result.current({
        tokenAddress: '0xbtc',
        networkId: 'evm--1',
        symbol: 'BTC',
        isNative: false,
        tokenDetailPreview,
      });
    });

    expect(mockNavigationPush).toHaveBeenCalledWith('MarketDetailV2', {
      tokenAddress: '0xbtc',
      network: 'eth',
      isNative: false,
      from: undefined,
      resolveMarketAsset: true,
      marketTokenSymbol: 'BTC',
      legacyTokenPreview: tokenDetailPreview,
    });
    mockedPlatformEnv.isExtensionUiPopup = true;
  });

  it('passes native search identity to detail without waiting for lookup', async () => {
    const mockedPlatformEnv = platformEnv as typeof platformEnv & {
      isExtensionUiPopup: boolean;
    };
    mockedPlatformEnv.isExtensionUiPopup = false;
    const tokenDetailPreview = {
      address: 'native',
      networkId: 'btc--0',
      isNative: true,
      name: 'Bitcoin',
      symbol: 'BTC',
      decimals: 8,
      selectedAt: 1,
    };
    const { result } = renderHook(() =>
      useToDetailPage({ resolveMarketAsset: true }),
    );

    await act(async () => {
      await result.current({
        tokenAddress: 'native',
        networkId: 'btc--0',
        symbol: 'BTC',
        isNative: true,
        tokenDetailPreview,
      });
    });

    expect(mockNavigationPush).toHaveBeenCalledWith('MarketDetailV2', {
      tokenAddress: 'native',
      network: 'eth',
      isNative: true,
      from: undefined,
      resolveMarketAsset: true,
      marketTokenSymbol: 'BTC',
      legacyTokenPreview: tokenDetailPreview,
    });
    expect(mockPrepareTokenDetailPreview).not.toHaveBeenCalled();
    mockedPlatformEnv.isExtensionUiPopup = true;
  });

  it('does not block a later navigation on Asset resolution', async () => {
    const mockedPlatformEnv = platformEnv as typeof platformEnv & {
      isExtensionUiPopup: boolean;
    };
    mockedPlatformEnv.isExtensionUiPopup = false;
    const { result } = renderHook(() =>
      useToDetailPage({ resolveMarketAsset: true }),
    );

    await act(async () => {
      await result.current({
        tokenAddress: '0xfirst',
        networkId: 'evm--1',
        symbol: 'FIRST',
        isNative: false,
      });
      await result.current({
        tokenAddress: '0xsecond',
        networkId: 'evm--1',
        symbol: 'SECOND',
        isNative: false,
      });
    });

    expect(mockNavigationPush).toHaveBeenCalledTimes(2);
    expect(mockNavigationPush).toHaveBeenLastCalledWith(
      'MarketDetailV2',
      expect.objectContaining({
        tokenAddress: '0xsecond',
        resolveMarketAsset: true,
        marketTokenSymbol: 'SECOND',
      }),
    );
    mockedPlatformEnv.isExtensionUiPopup = true;
  });

  it('seeds unresolved Asset identity for the detail lifecycle', async () => {
    const mockedPlatformEnv = platformEnv as typeof platformEnv & {
      isExtensionUiPopup: boolean;
    };
    mockedPlatformEnv.isExtensionUiPopup = false;
    const { result } = renderHook(() =>
      useToDetailPage({ resolveMarketAsset: true }),
    );

    await act(async () => {
      await result.current({
        tokenAddress: 'DifferentBitcoinToken',
        networkId: 'sol--101',
        symbol: 'BTC',
        isNative: false,
      });
    });

    expect(mockNavigationPush).toHaveBeenCalledWith('MarketDetailV2', {
      tokenAddress: 'DifferentBitcoinToken',
      network: 'eth',
      isNative: false,
      from: undefined,
      resolveMarketAsset: true,
      marketTokenSymbol: 'BTC',
    });
    mockedPlatformEnv.isExtensionUiPopup = true;
  });

  it('uses a complete search preview while Asset identity is resolving', async () => {
    const mockedPlatformEnv = platformEnv as typeof platformEnv & {
      isExtensionUiPopup: boolean;
    };
    mockedPlatformEnv.isExtensionUiPopup = false;
    const tokenDetailPreview = {
      address: '0xabc',
      networkId: 'evm--1',
      isNative: false,
      name: 'ABC Token',
      symbol: 'ABC',
      decimals: 18,
      price: 1,
      selectedAt: 1,
    };
    const { result } = renderHook(() => useToDetailPage());

    await act(async () => {
      await result.current({
        tokenAddress: '0xabc',
        networkId: 'evm--1',
        symbol: 'ABC',
        isNative: false,
        tokenDetailPreview,
      });
    });

    expect(mockPrepareTokenDetailPreview).not.toHaveBeenCalled();
    expect(mockClearTokenDetail).not.toHaveBeenCalled();
    expect(mockNavigationPush).toHaveBeenCalledWith(
      'MarketDetailV2',
      expect.objectContaining({ legacyTokenPreview: tokenDetailPreview }),
    );
    mockedPlatformEnv.isExtensionUiPopup = true;
  });

  it('opens stock detail by stockId from an extension surface', async () => {
    const { result } = renderHook(() =>
      useToDetailPage({ showFavoriteButton: false }),
    );

    await act(async () => {
      await result.current({
        tokenAddress: '0xaapl',
        networkId: 'evm--1',
        symbol: 'AAPLon',
        disableTrade: true,
        stock: {
          subtitle: 'Apple Inc.',
          sourceLogoUri: '',
          underlyingAssetTicker: 'AAPL',
        },
      });
    });

    expect(openExtensionMarketStockDetailMock).toHaveBeenCalledWith({
      stockId: 'AAPL',
      tokenAddress: '0xaapl',
      network: 'eth',
      isNative: undefined,
      from: EEnterWay.ExtensionPopup,
      disableTrade: true,
      showFavoriteButton: false,
    });
    expect(openExtensionMarketTokenDetailMock).not.toHaveBeenCalled();
  });

  it('delays closing the extension popup after opening market token detail in expand tab', async () => {
    const { result } = renderHook(() =>
      useToDetailPage({
        switchToMarketTabFirst: true,
        from: EEnterWay.Search,
        showFavoriteButton: false,
      }),
    );

    const tokenDetailPreview = {
      address: '0xabc',
      networkId: 'evm--1',
      isNative: false,
      name: 'ABC Token',
      symbol: 'ABC',
      decimals: 18,
      selectedAt: 1,
    };

    await act(async () => {
      await result.current({
        tokenAddress: '0xabc',
        networkId: 'evm--1',
        symbol: 'ABC',
        isNative: false,
        tokenDetailPreview,
      });
    });

    expect(openExtensionMarketTokenDetailMock).toHaveBeenCalledWith({
      tokenAddress: '0xabc',
      network: 'eth',
      isNative: false,
      from: EEnterWay.Search,
      showFavoriteButton: false,
      tokenDetailPreview,
    });
    expect(globalThis.close).not.toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(100);
    });

    expect(globalThis.close).toHaveBeenCalledTimes(1);
  });
});
