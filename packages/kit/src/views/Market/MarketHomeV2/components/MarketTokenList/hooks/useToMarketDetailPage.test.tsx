/** @jest-environment jsdom */
import { act, renderHook } from '@testing-library/react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { preloadMarketDetailV2Page } from '@onekeyhq/kit/src/views/Market/MarketDetailV2/utils/marketDetailPagePreload';
import { EEnterWay } from '@onekeyhq/shared/src/logger/scopes/dex';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  ERootRoutes,
  ETabMarketRoutes,
  ETabRoutes,
} from '@onekeyhq/shared/src/routes';

import { useToDetailPage } from './useToMarketDetailPage';

const mockNavigation = {
  push: jest.fn(),
  switchTab: jest.fn(),
};
const mockRootNavigate = jest.fn();

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
    },
  },
}));

jest.mock('@onekeyhq/components', () => ({
  ESplitViewType: {
    UNKNOWN: 'UNKNOWN',
  },
  rootNavigationRef: {
    current: {
      navigate: (...args: unknown[]) => {
        mockRootNavigate(...args);
      },
    },
  },
  useMedia: jest.fn(() => ({ gtLg: false })),
  useSplitViewType: jest.fn(() => 'UNKNOWN'),
}));

jest.mock('@onekeyhq/kit/src/hooks/useAppNavigation', () => ({
  __esModule: true,
  default: jest.fn(),
}));

jest.mock(
  '@onekeyhq/kit/src/views/Market/MarketDetailV2/utils/marketDetailPagePreload',
  () => ({
    prefetchMarketDetailV2FirstScreenKLine: jest.fn(() => Promise.resolve()),
    prefetchMarketDetailV2FirstScreenTransactions: jest.fn(() =>
      Promise.resolve(),
    ),
    preloadMarketDetailV2Page: jest.fn(() => Promise.resolve()),
    prepareMarketDetailV2KlineSource: jest.fn(),
  }),
);

jest.mock('@onekeyhq/kit/src/states/jotai/contexts/marketV2', () => ({
  useTokenDetailActions: jest.fn(() => ({
    current: {
      clearTokenDetail: jest.fn(),
      changeActiveToken: jest.fn(),
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

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    const mutablePlatformEnv = platformEnv as typeof platformEnv & {
      isExtensionUiPopup: boolean;
      isExtensionUiSidePanel: boolean;
      isNative: boolean;
    };
    mutablePlatformEnv.isExtensionUiPopup = true;
    mutablePlatformEnv.isExtensionUiSidePanel = false;
    mutablePlatformEnv.isNative = false;
    jest.mocked(useAppNavigation).mockReturnValue(mockNavigation as never);
    jest.mocked(preloadMarketDetailV2Page).mockResolvedValue(undefined);
    openExtensionMarketTokenDetailMock = jest.spyOn(
      backgroundApiProxy.serviceApp,
      'openExtensionMarketTokenDetail',
    ) as unknown as jest.Mock;
    openExtensionMarketTokenDetailMock.mockResolvedValue(undefined);
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

  it('pushes the native detail route without waiting for the shell preload', async () => {
    const mutablePlatformEnv = platformEnv as typeof platformEnv & {
      isExtensionUiPopup: boolean;
      isNative: boolean;
    };
    mutablePlatformEnv.isExtensionUiPopup = false;
    mutablePlatformEnv.isNative = true;
    const { result } = renderHook(() => useToDetailPage());
    const pendingShellPreload = new Promise<void>(() => undefined);
    jest.mocked(preloadMarketDetailV2Page).mockReturnValue(pendingShellPreload);
    let navigationPromise: Promise<void> | undefined;

    act(() => {
      navigationPromise = result.current({
        tokenAddress: '0xabc',
        networkId: 'evm--1',
        symbol: 'ABC',
        isNative: false,
      });
    });

    expect(mockNavigation.push).toHaveBeenCalledWith('MarketDetailV2', {
      tokenAddress: '0xabc',
      network: 'eth',
      isNative: false,
      from: undefined,
    });
    await expect(navigationPromise).resolves.toBeUndefined();
  });

  it('opens the native nested detail route without waiting for the shell preload', async () => {
    const mutablePlatformEnv = platformEnv as typeof platformEnv & {
      isExtensionUiPopup: boolean;
      isNative: boolean;
    };
    mutablePlatformEnv.isExtensionUiPopup = false;
    mutablePlatformEnv.isNative = true;
    const { result } = renderHook(() =>
      useToDetailPage({ switchToMarketTabFirst: true }),
    );
    const pendingShellPreload = new Promise<void>(() => undefined);
    jest.mocked(preloadMarketDetailV2Page).mockReturnValue(pendingShellPreload);
    let navigationPromise: Promise<void> | undefined;

    act(() => {
      navigationPromise = result.current({
        tokenAddress: '0xabc',
        networkId: 'evm--1',
        symbol: 'ABC',
        isNative: false,
      });
    });

    expect(mockRootNavigate).toHaveBeenCalledWith(ERootRoutes.Main, {
      screen: ETabRoutes.Discovery,
      params: {
        screen: ETabMarketRoutes.MarketDetailV2,
        params: {
          tokenAddress: '0xabc',
          network: 'eth',
          isNative: false,
          from: undefined,
        },
      },
    });
    await expect(navigationPromise).resolves.toBeUndefined();
  });
});
