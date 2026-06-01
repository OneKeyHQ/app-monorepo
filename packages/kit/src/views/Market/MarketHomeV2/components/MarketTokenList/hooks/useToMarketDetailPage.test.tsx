/** @jest-environment jsdom */
import { act, renderHook } from '@testing-library/react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { EEnterWay } from '@onekeyhq/shared/src/logger/scopes/dex';

import { useToDetailPage } from './useToMarketDetailPage';

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
      navigate: jest.fn(),
    },
  },
  useSplitViewType: jest.fn(() => 'UNKNOWN'),
}));

jest.mock('@onekeyhq/kit/src/hooks/useAppNavigation', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    push: jest.fn(),
    switchTab: jest.fn(),
  })),
}));

jest.mock('@onekeyhq/kit/src/states/jotai/contexts/marketV2', () => ({
  useTokenDetailActions: jest.fn(() => ({
    current: {
      clearTokenDetail: jest.fn(),
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
    });
    expect(globalThis.close).not.toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(100);
    });

    expect(globalThis.close).toHaveBeenCalledTimes(1);
  });
});
