import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EEnterWay } from '@onekeyhq/shared/src/logger/scopes/dex';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { ERootRoutes, ETabMarketRoutes } from '@onekeyhq/shared/src/routes';
import { isTabBarHiddenByRequest } from '@onekeyhq/shared/src/tabBar/hideTabBarRequests';

import {
  buildReplacedMarketDetailParams,
  findMarketTabStack,
  finishMarketDetailTabBarTransition,
  getCurrentMarketStockDetailId,
  getCurrentMarketStockDetailRoute,
  getNativeMarketListResetParams,
  openOrReplaceMarketDetailRoute,
  prepareMarketDetailTabBarTransition,
  replaceFocusedMarketDetailRoute,
  resolveMarketDetailBackAction,
} from './marketDetailNavigation';

const dispatchMock = jest.fn();
const getRootStateMock = jest.fn();
const getCurrentRouteMock = jest.fn();
const navigationStateListeners = new Set<() => void>();
const rootNavigationMock = {
  dispatch: (...args: unknown[]) => {
    dispatchMock(...args);
  },
  getRootState: (): unknown => getRootStateMock() as unknown,
  getCurrentRoute: (): unknown => getCurrentRouteMock() as unknown,
  addListener: (type: string, callback: () => void) => {
    if (type !== 'state') {
      return () => {};
    }
    navigationStateListeners.add(callback);
    return () => {
      navigationStateListeners.delete(callback);
    };
  },
};
let mockRootNavigationCurrent: typeof rootNavigationMock | undefined =
  rootNavigationMock;

const emitNavigationState = () => {
  // A listener may unsubscribe itself here; removing the current entry mid
  // iteration is safe for a Set.
  for (const listener of navigationStateListeners) {
    listener();
  }
};

jest.mock('@onekeyhq/components', () => ({
  rootNavigationRef: {
    get current() {
      return mockRootNavigationCurrent;
    },
  },
}));

jest.mock('@react-navigation/native', () => ({
  CommonActions: {
    setParams: (params: unknown) => ({
      type: 'SET_PARAMS',
      payload: { params },
    }),
    reset: (state: unknown) => ({
      type: 'RESET',
      payload: state,
    }),
  },
  StackActions: {
    replace: (name: string, params: unknown) => ({
      type: 'REPLACE',
      payload: { name, params },
    }),
  },
}));

const stackedTokenDetailsState = {
  key: 'root',
  index: 0,
  routes: [
    {
      name: 'main',
      state: {
        key: 'discovery-stack',
        index: 2,
        routes: [
          { key: 'list', name: 'TabDiscovery' },
          { key: 'detail-a', name: 'MarketDetailV2' },
          { key: 'detail-b', name: 'MarketStockDetail' },
        ],
      },
    },
  ],
};

const bannerThenTokenState = {
  key: 'root',
  index: 0,
  routes: [
    {
      name: 'main',
      state: {
        key: 'market-stack',
        index: 2,
        routes: [
          { key: 'list', name: 'TabMarket' },
          { key: 'banner', name: 'MarketBannerDetail' },
          { key: 'detail-1', name: 'MarketDetailV2' },
        ],
      },
    },
  ],
};

const selectorOverlayStackedState = {
  key: 'root',
  index: 1,
  routes: [
    stackedTokenDetailsState.routes[0],
    { key: 'modal', name: 'MobileTokenSelector' },
  ],
};

const swapProOverlayState = {
  key: 'root',
  index: 1,
  routes: [
    {
      name: 'main',
      state: {
        key: 'market-stack',
        index: 1,
        routes: [
          { key: 'list', name: 'TabMarket' },
          { key: 'detail-bg', name: 'MarketDetailV2' },
        ],
      },
    },
    {
      key: 'swap-modal',
      name: 'SwapModal',
      state: {
        key: 'swap-stack',
        index: 0,
        routes: [{ key: 'swap-detail', name: 'SwapProMarketDetail' }],
      },
    },
  ],
};

describe('marketDetailNavigation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    platformEnv.isNative = true;
    mockRootNavigationCurrent = rootNavigationMock;
    getRootStateMock.mockReturnValue(undefined);
    getCurrentRouteMock.mockReturnValue(undefined);
  });

  afterEach(() => {
    finishMarketDetailTabBarTransition();
    navigationStateListeners.clear();
    platformEnv.isNative = false;
  });

  describe('market detail tab bar transition', () => {
    const focusRoute = (name: string, rootRouteName = ERootRoutes.Main) => {
      getRootStateMock.mockReturnValue({
        index: 0,
        routes: [{ name: rootRouteName }],
      });
      getCurrentRouteMock.mockReturnValue({ name });
    };

    beforeEach(() => {
      jest.useFakeTimers();
      platformEnv.isNativeAndroid = true;
      focusRoute(ETabMarketRoutes.MarketDetailV2);
    });

    afterEach(() => {
      finishMarketDetailTabBarTransition();
      platformEnv.isNativeAndroid = false;
      jest.useRealTimers();
    });

    it('hides the tab bar while the pushed detail screen is still mounting', () => {
      prepareMarketDetailTabBarTransition();
      expect(isTabBarHiddenByRequest()).toBe(true);
    });

    it('releases the request when the detail screen takes ownership', () => {
      prepareMarketDetailTabBarTransition();
      finishMarketDetailTabBarTransition();
      expect(isTabBarHiddenByRequest()).toBe(false);
    });

    it('never hides the tab bar off Android', () => {
      platformEnv.isNativeAndroid = false;
      prepareMarketDetailTabBarTransition();
      expect(isTabBarHiddenByRequest()).toBe(false);
    });

    it('does not hide the tab bar before navigation is ready', () => {
      mockRootNavigationCurrent = undefined;
      prepareMarketDetailTabBarTransition();
      expect(isTabBarHiddenByRequest()).toBe(false);
    });

    it('waits for committed navigation state instead of evaluating immediately', () => {
      focusRoute(ETabMarketRoutes.TabMarket);
      prepareMarketDetailTabBarTransition();
      expect(isTabBarHiddenByRequest()).toBe(true);

      focusRoute(ETabMarketRoutes.MarketDetailV2);
      emitNavigationState();
      expect(isTabBarHiddenByRequest()).toBe(true);
    });

    it('releases the request once the transition deadline passes', () => {
      prepareMarketDetailTabBarTransition();
      jest.advanceTimersByTime(1500);
      expect(isTabBarHiddenByRequest()).toBe(false);
    });

    it('keeps one deadline across back to back navigations', () => {
      prepareMarketDetailTabBarTransition();
      jest.advanceTimersByTime(1000);
      prepareMarketDetailTabBarTransition();
      expect(isTabBarHiddenByRequest()).toBe(true);
      // A re-armed timer would still hold the request 500ms after the second
      // call; the deadline belongs to the first one.
      jest.advanceTimersByTime(500);
      expect(isTabBarHiddenByRequest()).toBe(false);
    });

    it('releases early when the navigation settles outside a detail route', () => {
      prepareMarketDetailTabBarTransition();
      focusRoute(ETabMarketRoutes.TabMarket);
      emitNavigationState();
      expect(isTabBarHiddenByRequest()).toBe(false);
    });

    it('keeps the request while the navigation settles on a detail route', () => {
      prepareMarketDetailTabBarTransition();
      focusRoute(ETabMarketRoutes.MarketStockDetail);
      emitNavigationState();
      expect(isTabBarHiddenByRequest()).toBe(true);
    });

    it('keeps the request while a root overlay covers the tab bar', () => {
      prepareMarketDetailTabBarTransition();
      focusRoute('SwapMainLand', ERootRoutes.Modal);
      emitNavigationState();
      expect(isTabBarHiddenByRequest()).toBe(true);
    });

    it('stops listening to navigation state once the transition ends', () => {
      prepareMarketDetailTabBarTransition();
      expect(navigationStateListeners.size).toBe(1);
      finishMarketDetailTabBarTransition();
      expect(navigationStateListeners.size).toBe(0);
    });
  });

  it('finds the deepest market stack under a selector overlay', () => {
    expect(findMarketTabStack(selectorOverlayStackedState)).toEqual(
      stackedTokenDetailsState.routes[0].state,
    );
  });

  it('reads the current stock detail identity under a selector overlay', () => {
    getRootStateMock.mockReturnValue({
      key: 'root',
      index: 1,
      routes: [
        {
          name: 'main',
          state: {
            key: 'discovery-stack',
            index: 1,
            routes: [
              { key: 'list', name: 'TabDiscovery' },
              {
                key: 'stock-detail',
                name: 'MarketStockDetail',
                params: { stockId: 'AAPL' },
              },
            ],
          },
        },
        { key: 'modal', name: 'MobileTokenSelector' },
      ],
    });

    expect(getCurrentMarketStockDetailId()).toBe('AAPL');
    expect(getCurrentMarketStockDetailRoute()).toEqual({ stockId: 'AAPL' });
  });

  it('clears stale identity params when replacing a detail route', () => {
    expect(
      buildReplacedMarketDetailParams({
        tokenAddress: '0xabc',
        network: 'eth',
        isNative: false,
      }),
    ).toEqual({
      tokenAddress: '0xabc',
      network: 'eth',
      isNative: false,
      marketTokenId: undefined,
      marketVariantId: undefined,
      marketTokenCategory: undefined,
      marketTokenSymbol: undefined,
      resolveMarketAsset: undefined,
      skipMarketDataFetch: undefined,
      legacyTokenPreview: undefined,
      marketTokenPreviewId: undefined,
      stockId: undefined,
      stockPreviewSymbol: undefined,
      stockPreviewName: undefined,
      stockPreviewLogoUrl: undefined,
      from: undefined,
      disableTrade: undefined,
      showFavoriteButton: undefined,
    });
  });

  it('clears a stale extension preview handle when the asset changes', () => {
    expect(
      buildReplacedMarketDetailParams({
        tokenAddress: '0xnew',
        network: 'eth',
      }).marketTokenPreviewId,
    ).toBeUndefined();
    expect(
      buildReplacedMarketDetailParams({
        tokenAddress: '0xnew',
        network: 'eth',
        marketTokenPreviewId: 'preview-2',
      }).marketTokenPreviewId,
    ).toBe('preview-2');
  });

  it('resets stacked details to a single current detail', () => {
    getRootStateMock.mockReturnValue(stackedTokenDetailsState);

    expect(
      openOrReplaceMarketDetailRoute({
        routeName: 'MarketDetailV2',
        params: {
          tokenAddress: '0xabc',
          network: 'eth',
        },
      }),
    ).toBe(true);

    expect(dispatchMock).toHaveBeenCalledWith({
      type: 'RESET',
      payload: {
        index: 1,
        routes: [
          { key: 'list', name: 'TabDiscovery' },
          {
            name: 'MarketDetailV2',
            params: buildReplacedMarketDetailParams({
              tokenAddress: '0xabc',
              network: 'eth',
            }),
          },
        ],
      },
      target: 'discovery-stack',
    });
  });

  it('updates the current token detail in place when the stack is already a single detail', () => {
    getRootStateMock.mockReturnValue({
      key: 'root',
      routes: [
        {
          name: 'main',
          state: {
            key: 'market-stack',
            index: 1,
            routes: [
              { key: 'list', name: 'TabMarket' },
              { key: 'detail-1', name: 'MarketDetailV2' },
            ],
          },
        },
      ],
    });
    platformEnv.isNative = false;

    expect(
      openOrReplaceMarketDetailRoute({
        routeName: 'MarketDetailV2',
        params: {
          tokenAddress: '0xabc',
          network: 'eth',
        },
      }),
    ).toBe(true);

    expect(dispatchMock).toHaveBeenCalledWith({
      type: 'SET_PARAMS',
      payload: {
        params: buildReplacedMarketDetailParams({
          tokenAddress: '0xabc',
          network: 'eth',
        }),
      },
      source: 'detail-1',
    });
  });

  it('keeps the banner list when replacing leftover token details', () => {
    getRootStateMock.mockReturnValue({
      key: 'root',
      index: 0,
      routes: [
        {
          name: 'main',
          state: {
            key: 'market-stack',
            index: 3,
            routes: [
              { key: 'list', name: 'TabMarket' },
              { key: 'banner', name: 'MarketBannerDetail' },
              { key: 'detail-a', name: 'MarketDetailV2' },
              { key: 'detail-b', name: 'MarketStockDetail' },
            ],
          },
        },
      ],
    });

    expect(
      openOrReplaceMarketDetailRoute({
        routeName: 'MarketDetailV2',
        params: {
          tokenAddress: '0xabc',
          network: 'eth',
        },
      }),
    ).toBe(true);

    expect(dispatchMock).toHaveBeenCalledWith({
      type: 'RESET',
      payload: {
        index: 2,
        routes: [
          { key: 'list', name: 'TabMarket' },
          { key: 'banner', name: 'MarketBannerDetail' },
          {
            name: 'MarketDetailV2',
            params: buildReplacedMarketDetailParams({
              tokenAddress: '0xabc',
              network: 'eth',
            }),
          },
        ],
      },
      target: 'market-stack',
    });
  });

  it('updates the token detail in place when it sits on a banner list', () => {
    getRootStateMock.mockReturnValue(bannerThenTokenState);
    platformEnv.isNative = false;

    expect(
      openOrReplaceMarketDetailRoute({
        routeName: 'MarketDetailV2',
        params: {
          tokenAddress: '0xabc',
          network: 'eth',
        },
      }),
    ).toBe(true);

    expect(dispatchMock).toHaveBeenCalledWith({
      type: 'SET_PARAMS',
      payload: {
        params: buildReplacedMarketDetailParams({
          tokenAddress: '0xabc',
          network: 'eth',
        }),
      },
      source: 'detail-1',
    });
  });

  it('still collapses leftover details under a token selector overlay', () => {
    getRootStateMock.mockReturnValue(selectorOverlayStackedState);
    getCurrentRouteMock.mockReturnValue({ name: 'MobileTokenSelector' });

    expect(
      openOrReplaceMarketDetailRoute({
        routeName: 'MarketDetailV2',
        params: {
          tokenAddress: '0xabc',
          network: 'eth',
        },
      }),
    ).toBe(true);

    expect(dispatchMock).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'RESET',
        target: 'discovery-stack',
      }),
    );
  });

  it('does not rewrite the background Market stack from SwapPro', () => {
    getRootStateMock.mockReturnValue(swapProOverlayState);
    getCurrentRouteMock.mockReturnValue({
      name: 'SwapProMarketDetail',
      key: 'swap-detail',
    });

    expect(
      openOrReplaceMarketDetailRoute({
        routeName: 'MarketDetailV2',
        params: {
          tokenAddress: '0xabc',
          network: 'eth',
        },
      }),
    ).toBe(false);
    expect(dispatchMock).not.toHaveBeenCalled();
  });

  it('returns false when no market tab stack is mounted', () => {
    expect(
      openOrReplaceMarketDetailRoute({
        routeName: 'MarketDetailV2',
        params: { tokenAddress: '0xabc', network: 'eth' },
      }),
    ).toBe(false);
    expect(dispatchMock).not.toHaveBeenCalled();
  });

  it('updates the focused token detail when nested stack state is missing', () => {
    getCurrentRouteMock.mockReturnValue({
      name: 'MarketDetailV2',
      key: 'detail-focused',
    });

    expect(
      replaceFocusedMarketDetailRoute({
        routeName: 'MarketDetailV2',
        params: {
          tokenAddress: '0xabc',
          network: 'eth',
        },
      }),
    ).toBe(true);

    expect(dispatchMock).toHaveBeenCalledWith({
      type: 'SET_PARAMS',
      payload: {
        params: buildReplacedMarketDetailParams({
          tokenAddress: '0xabc',
          network: 'eth',
        }),
      },
      source: 'detail-focused',
    });
  });

  it('replaces the focused detail when switching to a stock page', () => {
    platformEnv.isNativeAndroid = true;
    getCurrentRouteMock.mockReturnValue({ name: 'MarketDetailV2' });

    expect(
      replaceFocusedMarketDetailRoute({
        routeName: 'MarketStockDetail',
        params: { stockId: 'AAPL' },
      }),
    ).toBe(true);

    expect(dispatchMock).toHaveBeenCalledWith({
      type: 'REPLACE',
      payload: {
        name: 'MarketStockDetail',
        params: buildReplacedMarketDetailParams({ stockId: 'AAPL' }),
      },
    });
    expect(isTabBarHiddenByRequest()).toBe(true);
  });

  it('does not touch a non-detail focused route', () => {
    getCurrentRouteMock.mockReturnValue({ name: 'MobileTokenSelector' });

    expect(
      replaceFocusedMarketDetailRoute({
        routeName: 'MarketDetailV2',
        params: { tokenAddress: '0xabc', network: 'eth' },
      }),
    ).toBe(false);
    expect(dispatchMock).not.toHaveBeenCalled();
  });

  it('updates SwapPro in place instead of replacing a tab route', () => {
    getCurrentRouteMock.mockReturnValue({
      name: 'SwapProMarketDetail',
      key: 'swap-detail',
    });

    expect(
      replaceFocusedMarketDetailRoute({
        routeName: 'MarketDetailV2',
        params: {
          tokenAddress: '0xabc',
          network: 'eth',
        },
      }),
    ).toBe(true);

    expect(dispatchMock).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'SET_PARAMS',
        source: 'swap-detail',
      }),
    );
    const dispatched = dispatchMock.mock.calls[0]?.[0] as {
      payload?: { params?: Record<string, unknown> };
    };
    expect(dispatched.payload?.params).toEqual(
      expect.objectContaining({
        tokenAddress: '0xabc',
        network: 'eth',
      }),
    );
    expect(dispatched.payload?.params).not.toHaveProperty('from');
    expect(dispatched.payload?.params).not.toHaveProperty('disableTrade');
    expect(dispatched.payload?.params).not.toHaveProperty('showFavoriteButton');
  });

  it('pops to the list when previous route is a leftover detail', () => {
    expect(
      resolveMarketDetailBackAction({
        isTabletDetailView: false,
        isNative: true,
        routes: [
          { name: 'TabDiscovery' },
          { name: 'MarketDetailV2' },
          { name: 'MarketStockDetail' },
        ],
        index: 2,
      }),
    ).toEqual({ type: 'popToTop' });
  });

  it('pops once when previous route is the market list', () => {
    expect(
      resolveMarketDetailBackAction({
        isTabletDetailView: false,
        isNative: false,
        routes: [{ name: 'TabMarket' }, { name: 'MarketDetailV2' }],
        index: 1,
      }),
    ).toEqual({ type: 'pop' });
  });

  it('pops once from a banner-list token detail', () => {
    expect(
      resolveMarketDetailBackAction({
        isTabletDetailView: false,
        isNative: false,
        from: EEnterWay.BannerList,
        routes: [
          { name: 'TabMarket' },
          { name: 'MarketBannerDetail' },
          { name: 'MarketDetailV2' },
        ],
        index: 2,
      }),
    ).toEqual({ type: 'pop' });
  });

  it('pops once when previous route is the banner list', () => {
    expect(
      resolveMarketDetailBackAction({
        isTabletDetailView: false,
        isNative: true,
        routes: [
          { name: 'TabDiscovery' },
          { name: 'MarketBannerDetail' },
          { name: 'MarketDetailV2' },
        ],
        index: 2,
      }),
    ).toEqual({ type: 'pop' });
  });

  it('pops once from SwapPro market detail', () => {
    expect(
      resolveMarketDetailBackAction({
        isTabletDetailView: false,
        isNative: true,
        from: EEnterWay.SwapPro,
        routes: [{ name: 'SwapProMarketDetail' }],
        index: 0,
      }),
    ).toEqual({ type: 'pop' });
  });

  it('resets native empty history to Discovery instead of TabMarket', () => {
    expect(
      resolveMarketDetailBackAction({
        isTabletDetailView: false,
        isNative: true,
        routes: [{ name: 'MarketDetailV2' }],
        index: 0,
      }),
    ).toEqual({
      type: 'reset',
      name: 'TabDiscovery',
      params: getNativeMarketListResetParams(),
    });
    expect(getNativeMarketListResetParams()).toEqual({
      defaultTab: ETranslations.global_market,
    });
  });

  it('keeps search-entry native back switching to Discovery', () => {
    expect(
      resolveMarketDetailBackAction({
        isTabletDetailView: false,
        isNative: true,
        from: EEnterWay.Search,
        routes: [{ name: 'TabDiscovery' }, { name: 'MarketDetailV2' }],
        index: 1,
      }),
    ).toEqual({ type: 'popAndSwitchDiscovery' });
  });

  it('resets native search empty history onto the Market tab', () => {
    expect(
      resolveMarketDetailBackAction({
        isTabletDetailView: false,
        isNative: true,
        from: EEnterWay.Search,
        routes: [{ name: 'MarketDetailV2' }],
        index: 0,
      }),
    ).toEqual({
      type: 'reset',
      name: 'TabDiscovery',
      params: getNativeMarketListResetParams(),
    });
  });
});
