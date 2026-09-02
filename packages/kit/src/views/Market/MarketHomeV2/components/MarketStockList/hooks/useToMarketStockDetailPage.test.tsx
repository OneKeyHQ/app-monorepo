/** @jest-environment jsdom */
import { act, renderHook } from '@testing-library/react';

import {
  ERootRoutes,
  ETabMarketRoutes,
  ETabRoutes,
} from '@onekeyhq/shared/src/routes';

import { useToMarketStockDetailPage } from './useToMarketStockDetailPage';

const mockClearTokenDetail = jest.fn();
const mockPreloadMarketDetailV2Page = jest.fn(() => Promise.resolve());

jest.mock('@onekeyhq/components', () => ({
  ESplitViewType: { UNKNOWN: 'UNKNOWN' },
  rootNavigationRef: { current: { navigate: jest.fn() } },
  useMedia: () => ({ gtLg: true }),
  useSplitViewType: () => 'UNKNOWN',
}));

jest.mock('@onekeyhq/kit/src/states/jotai/contexts/marketV2', () => ({
  useTokenDetailActions: () => ({
    current: { clearTokenDetail: mockClearTokenDetail },
  }),
}));

jest.mock(
  '@onekeyhq/kit/src/views/Market/MarketDetailV2/utils/marketDetailPagePreload',
  () => ({
    preloadMarketDetailV2Page: () => mockPreloadMarketDetailV2Page(),
  }),
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

const mockNavigate = (
  jest.requireMock('@onekeyhq/components') as {
    rootNavigationRef: { current: { navigate: jest.Mock } };
  }
).rootNavigationRef.current.navigate;

describe('useToMarketStockDetailPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('preserves the selected stock preview in the detail route seed', async () => {
    const stockPreview = {
      stockId: 'AAPL',
      symbol: 'AAPL',
      name: 'Apple Inc.',
      logoUrl: 'https://example.com/aapl.png',
    };
    const { result } = renderHook(() => useToMarketStockDetailPage());

    await act(async () => {
      await result.current(stockPreview);
    });

    expect(mockClearTokenDetail).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledWith(ERootRoutes.Main, {
      screen: ETabRoutes.Market,
      params: {
        screen: ETabMarketRoutes.MarketStockDetail,
        params: {
          stockId: 'AAPL',
          stockPreviewSymbol: 'AAPL',
          stockPreviewName: 'Apple Inc.',
          stockPreviewLogoUrl: 'https://example.com/aapl.png',
        },
      },
    });
  });
});
