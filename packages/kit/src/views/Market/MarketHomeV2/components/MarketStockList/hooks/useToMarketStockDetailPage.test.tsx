/** @jest-environment jsdom */
import { act, renderHook } from '@testing-library/react';

import { appEventBus } from '@onekeyhq/shared/src/eventBus/appEventBus';
import {
  ERootRoutes,
  ETabMarketRoutes,
  ETabRoutes,
} from '@onekeyhq/shared/src/routes';

import { useToMarketStockDetailPage } from './useToMarketStockDetailPage';

let mockSplitViewType = 'UNKNOWN';

jest.mock('@onekeyhq/components', () => {
  const mockRootNavigate = jest.fn();
  return {
    ESplitViewType: { UNKNOWN: 'UNKNOWN' },
    mockRootNavigate,
    rootNavigationRef: { current: { navigate: mockRootNavigate } },
    useMedia: () => ({ gtLg: true }),
    useSplitViewType: () => mockSplitViewType,
  };
});

jest.mock('@onekeyhq/kit/src/hooks/useAppNavigation', () => {
  const mockNavigationReplace = jest.fn();
  return {
    __esModule: true,
    default: () => ({ replace: mockNavigationReplace }),
    mockNavigationReplace,
  };
});

jest.mock('@onekeyhq/kit/src/states/jotai/contexts/marketV2', () => ({
  useTokenDetailActions: () => ({
    current: { clearTokenDetail: jest.fn() },
  }),
}));

jest.mock(
  '@onekeyhq/kit/src/views/Market/MarketDetailV2/utils/marketDetailPagePreload',
  () => ({ preloadMarketDetailV2Page: jest.fn(() => Promise.resolve()) }),
);

jest.mock('@onekeyhq/shared/src/eventBus/appEventBus', () => ({
  EAppEventBusNames: {
    CleanTokenDetailInTabletDetailView: 'CleanTokenDetailInTabletDetailView',
  },
  appEventBus: { emit: jest.fn() },
}));

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: {
    isExtensionUiPopup: false,
    isExtensionUiSidePanel: false,
    isNative: false,
  },
}));

jest.mock('@onekeyhq/shared/src/utils/extUtils', () => ({
  closeExtensionPopupAfterExpandTabOpen: jest.fn(),
}));

const mockRootNavigate = (
  jest.requireMock('@onekeyhq/components') as {
    mockRootNavigate: jest.Mock;
  }
).mockRootNavigate;
const mockNavigationReplace = (
  jest.requireMock('@onekeyhq/kit/src/hooks/useAppNavigation') as {
    mockNavigationReplace: jest.Mock;
  }
).mockNavigationReplace;

describe('useToMarketStockDetailPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSplitViewType = 'UNKNOWN';
  });

  it('keeps the Market home entry navigation behavior by default', async () => {
    const { result } = renderHook(() => useToMarketStockDetailPage());

    await act(async () => {
      await result.current('AAPL');
    });

    expect(mockRootNavigate).toHaveBeenCalledWith(ERootRoutes.Main, {
      screen: ETabRoutes.Market,
      params: {
        screen: ETabMarketRoutes.MarketStockDetail,
        params: { stockId: 'AAPL' },
      },
    });
    expect(mockNavigationReplace).not.toHaveBeenCalled();
  });

  it('replaces the current detail route without clearing split view', async () => {
    mockSplitViewType = 'SUB';
    const appEventBusEmitSpy = jest.spyOn(appEventBus, 'emit');
    const { result } = renderHook(() =>
      useToMarketStockDetailPage({ replaceCurrentDetail: true }),
    );

    await act(async () => {
      await result.current('AAPL');
    });

    expect(appEventBusEmitSpy).not.toHaveBeenCalled();
    expect(mockNavigationReplace).toHaveBeenCalledWith(
      ETabMarketRoutes.MarketStockDetail,
      { stockId: 'AAPL' },
    );
    expect(mockRootNavigate).not.toHaveBeenCalled();
  });
});
