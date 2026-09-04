/** @jest-environment jsdom */
import { act, renderHook } from '@testing-library/react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { preloadMarketDetailV2Page } from '@onekeyhq/kit/src/views/Market/MarketDetailV2/utils/marketDetailPagePreload';
import { resolveMarketAssetRouteIdentity } from '@onekeyhq/kit/src/views/Market/MarketDetailV2/utils/resolveMarketAssetRouteIdentity';
import { appEventBus } from '@onekeyhq/shared/src/eventBus/appEventBus';
import { EEnterWay } from '@onekeyhq/shared/src/logger/scopes/dex';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { useToDetailPage } from './useToMarketDetailPage';

const mockNavigationPush = jest.fn();
const mockNavigationReplace = jest.fn();
const mockClearTokenDetail = jest.fn();
const mockPrepareTokenDetailPreview = jest.fn();
let mockCurrentRouteName = 'MarketDetailV2';
let mockSplitViewType = 'UNKNOWN';

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

jest.mock(
  '@onekeyhq/kit/src/views/Market/MarketDetailV2/utils/resolveMarketAssetRouteIdentity',
  () => ({
    resolveMarketAssetRouteIdentity: jest.fn(),
  }),
);

jest.mock('@onekeyhq/components', () => ({
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
    jest.useFakeTimers();
    mockCurrentRouteName = 'MarketDetailV2';
    mockSplitViewType = 'UNKNOWN';
    (
      resolveMarketAssetRouteIdentity as jest.MockedFunction<
        typeof resolveMarketAssetRouteIdentity
      >
    ).mockResolvedValue(undefined);
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

  it('navigates stock items with stockId instead of chain identity', async () => {
    const mockedPlatformEnv = platformEnv as typeof platformEnv & {
      isExtensionUiPopup: boolean;
    };
    mockedPlatformEnv.isExtensionUiPopup = false;
    const { result } = renderHook(() => useToDetailPage());

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
          underlyingAssetTicker: 'AAPL',
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

  it('resolves search and watchlist tokens to the canonical Asset route', async () => {
    const mockedPlatformEnv = platformEnv as typeof platformEnv & {
      isExtensionUiPopup: boolean;
    };
    mockedPlatformEnv.isExtensionUiPopup = false;
    (
      resolveMarketAssetRouteIdentity as jest.MockedFunction<
        typeof resolveMarketAssetRouteIdentity
      >
    ).mockResolvedValue({
      marketTokenId: 'bitcoin',
      marketVariantId: 'bitcoin-evm--1-0xbtc',
    });
    const { result } = renderHook(() =>
      useToDetailPage({ resolveMarketAsset: true }),
    );

    await act(async () => {
      await result.current({
        tokenAddress: '0xbtc',
        networkId: 'evm--1',
        symbol: 'BTC',
        isNative: false,
      });
    });

    expect(resolveMarketAssetRouteIdentity).toHaveBeenCalledWith({
      networkId: 'evm--1',
      tokenAddress: '0xbtc',
      symbol: 'BTC',
      isNative: false,
    });
    expect(mockNavigationPush).toHaveBeenCalledWith('MarketDetailV2', {
      tokenAddress: '0xbtc',
      network: 'eth',
      isNative: false,
      from: undefined,
      marketTokenId: 'bitcoin',
      marketVariantId: 'bitcoin-evm--1-0xbtc',
      marketTokenCategory: 'top_coins',
    });
    mockedPlatformEnv.isExtensionUiPopup = true;
  });

  it('keeps the token route when no exact Asset identity is found', async () => {
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

    expect(mockPrepareTokenDetailPreview).toHaveBeenCalledWith(
      tokenDetailPreview,
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

    await act(async () => {
      await result.current({
        tokenAddress: '0xabc',
        networkId: 'evm--1',
        symbol: 'ABC',
        isNative: false,
      });
    });

    expect(openExtensionMarketTokenDetailMock).toHaveBeenCalledWith({
      tokenAddress: '0xabc',
      network: 'eth',
      isNative: false,
      from: EEnterWay.Search,
      showFavoriteButton: false,
    });
    expect(globalThis.close).not.toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(100);
    });

    expect(globalThis.close).toHaveBeenCalledTimes(1);
  });
});
