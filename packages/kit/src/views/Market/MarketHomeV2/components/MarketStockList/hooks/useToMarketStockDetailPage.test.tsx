/** @jest-environment jsdom */
import { act, renderHook } from '@testing-library/react';

import { finishMarketDetailTabBarTransition } from '@onekeyhq/kit/src/views/Market/utils/marketDetailNavigation';
import { EEnterWay } from '@onekeyhq/shared/src/logger/scopes/dex';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IMarketStockDetailRouteParams } from '@onekeyhq/shared/src/routes';
import {
  ERootRoutes,
  ETabMarketRoutes,
  ETabRoutes,
} from '@onekeyhq/shared/src/routes';
import { closeExtensionPopupAfterExpandTabOpen } from '@onekeyhq/shared/src/utils/extUtils';

import {
  hasExplicitMarketStockTokenIdentity,
  shouldRetainCurrentStockTokenDetail,
  useToMarketStockDetailPage,
} from './useToMarketStockDetailPage';

const mockReplace = jest.fn();
const mockSetParams = jest.fn();
const mockPopToTop = jest.fn();
const mockPush = jest.fn();
const mockSwitchTabAsync = jest.fn<Promise<void>, [unknown]>(() =>
  Promise.resolve(),
);
let mockIsModalPage = false;
let mockCurrentRouteName: string = ETabMarketRoutes.MarketDetailV2;
let mockCurrentRouteParams: Partial<IMarketStockDetailRouteParams> | undefined;
jest.mock('@react-navigation/native', () => ({
  useRoute: () => ({
    name: mockCurrentRouteName,
    params: mockCurrentRouteParams,
  }),
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
const mockGetRootState = jest.fn();

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
  rootNavigationRef: {
    current: {
      getRootState: (): unknown => mockGetRootState() as unknown,
      navigate: jest.fn(),
    },
  },
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
    HideTabBar: 'HideTabBar',
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

describe('shouldRetainCurrentStockTokenDetail', () => {
  const sameStock = {
    currentHasExplicitToken: false,
    currentStockId: 'AAPL',
    nextHasTokenParams: false,
    nextStockId: 'aapl',
    replaceCurrentDetail: true,
  };

  it('keeps an unresolved same-stock reselection', () => {
    expect(shouldRetainCurrentStockTokenDetail(sameStock)).toBe(true);
  });

  it('does not keep an explicit variant when the base stock is reselected', () => {
    expect(
      shouldRetainCurrentStockTokenDetail({
        ...sameStock,
        currentHasExplicitToken: true,
      }),
    ).toBe(false);
  });

  it('does not keep a different stock', () => {
    expect(
      shouldRetainCurrentStockTokenDetail({
        ...sameStock,
        nextStockId: 'GOOG',
      }),
    ).toBe(false);
  });
});

describe('hasExplicitMarketStockTokenIdentity', () => {
  it('treats a contract address as an explicit variant', () => {
    expect(hasExplicitMarketStockTokenIdentity({ tokenAddress: '0xabc' })).toBe(
      true,
    );
  });

  it('treats a native coin as an explicit variant', () => {
    expect(hasExplicitMarketStockTokenIdentity({ isNative: true })).toBe(true);
  });

  it('ignores an unresolved stock route', () => {
    expect(
      hasExplicitMarketStockTokenIdentity({
        isNative: false,
        tokenAddress: '',
      }),
    ).toBe(false);
  });
});

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
    mockCurrentRouteParams = undefined;
    mockGetRootState.mockReturnValue(undefined);
  });

  afterEach(() => {
    finishMarketDetailTabBarTransition();
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
      from: undefined,
      disableTrade: undefined,
      showFavoriteButton: undefined,
      tokenAddress: undefined,
      network: undefined,
      isNative: undefined,
      stockPreviewSymbol: 'GOOG',
      stockPreviewName: 'Alphabet Inc.',
      stockPreviewLogoUrl: 'goog.png',
    });
    expect(mockPopToTop).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
    expect(mockPrepareStockTokenDetail).toHaveBeenCalledTimes(1);
  });

  it('preserves loaded detail when reselecting the current unresolved stock', async () => {
    mockCurrentRouteName = ETabMarketRoutes.MarketStockDetail;
    mockCurrentRouteParams = { stockId: 'AAPL' };
    const { result } = renderHook(() =>
      useToMarketStockDetailPage({ replaceCurrentDetail: true }),
    );

    await act(async () => {
      await result.current({
        stockId: 'aapl',
        symbol: 'AAPL',
        name: 'Apple Inc.',
        logoUrl: 'aapl.png',
      });
    });

    expect(mockPrepareStockTokenDetail).not.toHaveBeenCalled();
    expect(mockSetParams).toHaveBeenCalledWith(
      expect.objectContaining({ stockId: 'aapl' }),
    );
  });

  it('clears the previous variant when the current stock is reselected without one', async () => {
    mockCurrentRouteName = ETabMarketRoutes.MarketStockDetail;
    mockCurrentRouteParams = {
      stockId: 'AAPL',
      tokenAddress: '0xold',
      network: 'evm--1',
      isNative: false,
    };
    const { result } = renderHook(() =>
      useToMarketStockDetailPage({ replaceCurrentDetail: true }),
    );

    await act(async () => {
      await result.current({
        stockId: 'aapl',
        symbol: 'AAPL',
        name: 'Apple Inc.',
        logoUrl: 'aapl.png',
      });
    });

    expect(mockPrepareStockTokenDetail).toHaveBeenCalledWith({
      tokenAddress: '',
      networkId: '',
    });
    expect(mockSetParams).toHaveBeenCalledWith(
      expect.objectContaining({
        stockId: 'aapl',
        tokenAddress: undefined,
      }),
    );
  });

  it.each(['desktop', 'web'])(
    'clears selection policies when shallow-merging a retained %s route',
    async (platform) => {
      mockedPlatformEnv.isDesktop = platform === 'desktop';
      mockedPlatformEnv.isWeb = platform === 'web';
      mockCurrentRouteName = ETabMarketRoutes.MarketStockDetail;
      let params: IMarketStockDetailRouteParams = {
        stockId: 'AAPL',
        from: EEnterWay.Search,
        disableTrade: true,
        showFavoriteButton: false,
        tokenAddress: 'old-token',
        network: 'evm--1',
        isNative: false,
      };
      mockSetParams.mockImplementationOnce(
        (update: Partial<IMarketStockDetailRouteParams>) => {
          params = { ...params, ...update };
        },
      );
      const { result } = renderHook(() =>
        useToMarketStockDetailPage({ replaceCurrentDetail: true }),
      );
      await act(async () => {
        await result.current('GOOG');
      });
      expect(params.stockId).toBe('GOOG');
      expect(params.disableTrade).toBeUndefined();
      expect(params.showFavoriteButton).toBeUndefined();
      expect(params.from).toBeUndefined();
      expect(params.tokenAddress).toBeUndefined();
      expect(params.network).toBeUndefined();
      expect(params.isNative).toBeUndefined();
    },
  );

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

  it('preserves native detail when the modal reselects its current stock', async () => {
    mockIsModalPage = true;
    mockedPlatformEnv.isDesktop = false;
    mockedPlatformEnv.isNative = true;
    mockCurrentRouteName = 'MobileTokenSelector';
    mockGetRootState.mockReturnValue({
      key: 'root',
      index: 1,
      routes: [
        {
          name: 'main',
          state: {
            key: 'discovery-stack',
            index: 1,
            routes: [
              { key: 'list', name: ETabRoutes.Discovery },
              {
                key: 'stock-detail',
                name: ETabMarketRoutes.MarketStockDetail,
                params: { stockId: 'AAPL' },
              },
            ],
          },
        },
        { key: 'selector', name: 'MobileTokenSelector' },
      ],
    });
    const { result } = renderHook(() =>
      useToMarketStockDetailPage({ replaceCurrentDetail: true }),
    );

    await act(async () => {
      await result.current({
        stockId: 'aapl',
        symbol: 'AAPL',
        name: 'Apple',
        logoUrl: 'aapl.png',
      });
    });

    expect(mockPrepareStockTokenDetail).not.toHaveBeenCalled();
    expect(mockSwitchTabAsync).toHaveBeenCalledWith(ETabRoutes.Discovery);
    expect(mockNavigate).toHaveBeenCalled();
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
