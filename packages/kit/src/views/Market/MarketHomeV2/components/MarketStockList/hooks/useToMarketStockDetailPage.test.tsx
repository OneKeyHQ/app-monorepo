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

const mockReplace = jest.fn();
const mockSetParams = jest.fn();
const mockPopToTop = jest.fn();
const mockPush = jest.fn();
const mockSwitchTabAsync = jest.fn<Promise<void>, [unknown]>(() =>
  Promise.resolve(),
);
let mockIsModalPage = false;
let mockCurrentRouteName: string = ETabMarketRoutes.MarketDetailV2;
jest.mock('@react-navigation/native', () => ({
  useRoute: () => ({ name: mockCurrentRouteName }),
}));
jest.mock('@onekeyhq/kit/src/hooks/useAppNavigation', () => ({
  __esModule: true,
  default: () => ({
    replace: mockReplace,
    setParams: mockSetParams,
    popToTop: mockPopToTop,
    push: mockPush,
  }),
}));

const mockPrepareStockTokenDetail = jest.fn();
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
  switchTabAsync: (route: unknown) => mockSwitchTabAsync(route),
  useIsModalPage: () => mockIsModalPage,
  useMedia: () => ({ gtLg: true }),
  useSplitViewType: () => 'UNKNOWN',
}));

jest.mock('@onekeyhq/kit/src/states/jotai/contexts/marketV2', () => ({
  useTokenDetailActions: () => ({
    current: { prepareStockTokenDetail: mockPrepareStockTokenDetail },
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
    isDesktop: true,
    isExtensionUiPopup: false,
    isExtensionUiSidePanel: false,
    isNative: false,
    isWeb: false,
  },
}));

jest.mock('@onekeyhq/shared/src/utils/extUtils', () => ({
  closeExtensionPopupAfterExpandTabOpen: jest.fn(),
}));

const mockNavigate: jest.Mock = jest.requireMock('@onekeyhq/components')
  .rootNavigationRef.current.navigate;
const mockedPlatformEnv = platformEnv as typeof platformEnv & {
  isExtensionUiPopup: boolean;
  isExtensionUiSidePanel: boolean;
  isDesktop: boolean;
  isNative: boolean;
  isWeb: boolean;
};
const mockCloseExtensionPopupAfterExpandTabOpen = jest.mocked(
  closeExtensionPopupAfterExpandTabOpen,
);

describe('useToMarketStockDetailPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedPlatformEnv.isExtensionUiPopup = false;
    mockedPlatformEnv.isExtensionUiSidePanel = false;
    mockedPlatformEnv.isDesktop = true;
    mockedPlatformEnv.isNative = false;
    mockedPlatformEnv.isWeb = false;
    mockIsModalPage = false;
    mockCurrentRouteName = ETabMarketRoutes.MarketDetailV2;
  });

  it('resets the tab stack before opening the selected stock', async () => {
    const { result } = renderHook(() =>
      useToMarketStockDetailPage({ replaceCurrentDetail: true }),
    );
    await act(async () => {
      await result.current({
        stockId: 'AAPL',
        symbol: 'AAPL',
        name: 'Apple',
        logoUrl: 'aapl.png',
      });
    });
    expect(mockPopToTop).toHaveBeenCalled();
    expect(mockPush).toHaveBeenCalledWith(ETabMarketRoutes.MarketStockDetail, {
      stockId: 'AAPL',
      stockPreviewSymbol: 'AAPL',
      stockPreviewName: 'Apple',
      stockPreviewLogoUrl: 'aapl.png',
    });
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('updates the current stock route without remounting the detail page', async () => {
    mockCurrentRouteName = ETabMarketRoutes.MarketStockDetail;
    const { result } = renderHook(() =>
      useToMarketStockDetailPage({ replaceCurrentDetail: true }),
    );

    await act(async () => {
      await result.current({
        stockId: 'GOOG',
        symbol: 'GOOG',
        name: 'Alphabet Inc.',
        logoUrl: 'goog.png',
      });
    });

    expect(mockSetParams).toHaveBeenCalledWith({
      stockId: 'GOOG',
      tokenAddress: undefined,
      network: undefined,
      isNative: undefined,
      stockPreviewSymbol: 'GOOG',
      stockPreviewName: 'Alphabet Inc.',
      stockPreviewLogoUrl: 'goog.png',
    });
    expect(mockPopToTop).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('preserves native stock navigation when another stock detail is active', async () => {
    mockedPlatformEnv.isDesktop = false;
    mockedPlatformEnv.isNative = true;
    mockCurrentRouteName = ETabMarketRoutes.MarketStockDetail;
    const { result } = renderHook(() =>
      useToMarketStockDetailPage({ replaceCurrentDetail: true }),
    );

    await act(async () => {
      await result.current({
        stockId: 'GOOG',
        symbol: 'GOOG',
        name: 'Alphabet Inc.',
        logoUrl: 'goog.png',
      });
    });

    expect(mockSetParams).not.toHaveBeenCalled();
    expect(mockPopToTop).toHaveBeenCalled();
    expect(mockPush).toHaveBeenCalledWith(
      ETabMarketRoutes.MarketStockDetail,
      expect.objectContaining({ stockId: 'GOOG' }),
    );
  });

  it('dismisses the market modal before opening the selected stock', async () => {
    mockIsModalPage = true;
    const { result } = renderHook(() =>
      useToMarketStockDetailPage({ replaceCurrentDetail: true }),
    );
    await act(async () => {
      await result.current({
        stockId: 'AAPL',
        symbol: 'AAPL',
        name: 'Apple',
        logoUrl: 'aapl.png',
      });
    });
    expect(mockSwitchTabAsync).toHaveBeenCalledWith(ETabRoutes.Market);
    expect(mockNavigate).toHaveBeenCalledWith(ERootRoutes.Main, {
      screen: ETabRoutes.Market,
      params: {
        screen: ETabMarketRoutes.MarketStockDetail,
        params: {
          stockId: 'AAPL',
          stockPreviewSymbol: 'AAPL',
          stockPreviewName: 'Apple',
          stockPreviewLogoUrl: 'aapl.png',
        },
      },
    });
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('opens the selected stock in Discovery after dismissing a native modal', async () => {
    mockIsModalPage = true;
    mockedPlatformEnv.isNative = true;
    const { result } = renderHook(() =>
      useToMarketStockDetailPage({ replaceCurrentDetail: true }),
    );

    await act(async () => {
      await result.current('AAPL');
    });

    expect(mockSwitchTabAsync).toHaveBeenCalledWith(ETabRoutes.Discovery);
    expect(mockNavigate).toHaveBeenCalledWith(ERootRoutes.Main, {
      screen: ETabRoutes.Discovery,
      params: {
        screen: ETabMarketRoutes.MarketStockDetail,
        params: { stockId: 'AAPL' },
      },
    });
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

    expect(mockPrepareStockTokenDetail).toHaveBeenCalledWith({
      tokenAddress: '',
      networkId: '',
      isNative: undefined,
    });
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

  it('preserves the resolved stock variant identity for navigation', async () => {
    const { result } = renderHook(() => useToMarketStockDetailPage());

    await act(async () => {
      await result.current({
        stockId: 'AAPL',
        symbol: 'AAPL',
        name: 'Apple Inc.',
        logoUrl: 'https://example.com/aapl.png',
        tokenAddress: '0xstock',
        networkId: 'evm--1',
        isNative: false,
      });
    });

    expect(mockPrepareStockTokenDetail).toHaveBeenCalledWith({
      tokenAddress: '0xstock',
      networkId: 'evm--1',
      isNative: false,
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
