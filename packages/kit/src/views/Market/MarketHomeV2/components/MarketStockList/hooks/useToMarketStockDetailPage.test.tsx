/** @jest-environment jsdom */
import { act, renderHook } from '@testing-library/react';

import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  ERootRoutes,
  ETabMarketRoutes,
  ETabRoutes,
} from '@onekeyhq/shared/src/routes';
import { closeExtensionPopupAfterExpandTabOpen } from '@onekeyhq/shared/src/utils/extUtils';

import { useToMarketStockDetailPage } from './useToMarketStockDetailPage';

const mockClearTokenDetail = jest.fn();
const mockOpenExtensionMarketStockDetail = jest.fn(() => Promise.resolve());
const mockPreloadMarketDetailV2Page = jest.fn(() => Promise.resolve());

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceApp: {
      openExtensionMarketStockDetail: mockOpenExtensionMarketStockDetail,
    },
  },
}));

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
const mockedPlatformEnv = platformEnv as typeof platformEnv & {
  isExtensionUiPopup: boolean;
  isExtensionUiSidePanel: boolean;
};
const mockCloseExtensionPopupAfterExpandTabOpen = jest.mocked(
  closeExtensionPopupAfterExpandTabOpen,
);

describe('useToMarketStockDetailPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedPlatformEnv.isExtensionUiPopup = false;
    mockedPlatformEnv.isExtensionUiSidePanel = false;
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

  it('forwards the selected stock preview through extension expansion', async () => {
    mockedPlatformEnv.isExtensionUiPopup = true;
    const { result } = renderHook(() => useToMarketStockDetailPage());

    await act(async () => {
      await result.current({
        stockId: 'AAPL',
        symbol: 'AAPL',
        name: 'Apple Inc.',
        logoUrl: 'https://example.com/aapl.png',
      });
    });

    expect(mockOpenExtensionMarketStockDetail).toHaveBeenCalledWith({
      stockId: 'AAPL',
      stockPreviewSymbol: 'AAPL',
      stockPreviewName: 'Apple Inc.',
      stockPreviewLogoUrl: 'https://example.com/aapl.png',
      from: 'ExtensionPopup',
    });
    expect(mockCloseExtensionPopupAfterExpandTabOpen).toHaveBeenCalledTimes(1);
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
