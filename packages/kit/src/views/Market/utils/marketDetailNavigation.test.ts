import { StackRouter, TabRouter } from '@react-navigation/routers';

import { MARKET_TOP_COINS_CATEGORY_ID } from '@onekeyhq/shared/src/consts/marketConsts';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { EEnterWay } from '@onekeyhq/shared/src/logger/scopes/dex';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  ERootRoutes,
  ETabMarketRoutes,
  ETabRoutes,
} from '@onekeyhq/shared/src/routes';
import { isTabBarHiddenByRequest } from '@onekeyhq/shared/src/tabBar/hideTabBarRequests';

import {
  buildReplacedMarketDetailParams,
  dismissDiscoveryMarketDetailForTrade,
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

import type { INavigationStateNode } from './marketDetailNavigation';

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
  TabRouter: jest.requireActual<typeof import('@react-navigation/routers')>(
    '@react-navigation/routers',
  ).TabRouter,
  StackActions: {
    pop: (count: number) => ({ type: 'POP', payload: { count } }),
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
        key: 'market-stack',
        index: 2,
        routes: [
          { key: 'list', name: 'TabMarket' },
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
    platformEnv.isNativeIOS = false;
    mockRootNavigationCurrent = rootNavigationMock;
    getRootStateMock.mockReturnValue(undefined);
    getCurrentRouteMock.mockReturnValue(undefined);
  });

  afterEach(() => {
    finishMarketDetailTabBarTransition();
    navigationStateListeners.clear();
    platformEnv.isNative = false;
  });

  describe('leaving Market detail for trading', () => {
    const marketStack = {
      key: 'market-stack',
      index: 1,
      routes: [
        { key: 'list', name: 'TabMarket', params: { category: 'top-coins' } },
        { key: 'detail', name: 'MarketDetailV2' },
      ],
    };

    beforeEach(() => {
      getRootStateMock.mockReturnValue(marketStack);
      getCurrentRouteMock.mockReturnValue(marketStack.routes[1]);
    });

    it.each(['MarketDetailV2', 'MarketStockDetail', 'MarketNativeDetail'])(
      'pops only the current %s route',
      (name) => {
        getCurrentRouteMock.mockReturnValue({ key: 'detail', name });
        void dismissDiscoveryMarketDetailForTrade();
        expect(dispatchMock).toHaveBeenCalledWith({
          type: 'POP',
          payload: { count: 1 },
          source: 'detail',
          target: 'market-stack',
        });
      },
    );

    it('keeps a newer detail when asynchronous Perps preparation finishes', () => {
      void dismissDiscoveryMarketDetailForTrade('previous-detail');
      expect(dispatchMock).not.toHaveBeenCalled();
    });

    it('returns to the existing list with its params preserved', () => {
      const router = StackRouter({});
      const config = {
        routeNames: ['TabMarket', 'MarketDetailV2'],
        routeParamList: {},
        routeGetIdList: {},
      };
      const stack = { ...router.getInitialState(config), ...marketStack };
      void dismissDiscoveryMarketDetailForTrade('detail');
      const action = dispatchMock.mock.calls[0]?.[0] as Parameters<
        typeof router.getStateForAction
      >[1];
      const updated = router.getStateForAction(stack, action, config);
      expect(updated?.index).toBe(0);
      expect(updated?.routes).toEqual([marketStack.routes[0]]);
    });

    it('returns past stacked details while preserving history below the list', () => {
      const router = StackRouter({});
      const config = {
        routeNames: [
          'previous-screen',
          'TabMarket',
          'MarketDetailV2',
          'MarketStockDetail',
        ],
        routeParamList: {},
        routeGetIdList: {},
      };
      const routes = [
        { key: 'previous', name: 'previous-screen' },
        marketStack.routes[0],
        { key: 'older-detail', name: 'MarketStockDetail' },
        marketStack.routes[1],
      ];
      const stack = {
        ...router.getInitialState(config),
        ...marketStack,
        index: 3,
        routes,
      };
      getRootStateMock.mockReturnValue(stack);
      void dismissDiscoveryMarketDetailForTrade('detail');
      const action = dispatchMock.mock.calls[0]?.[0] as Parameters<
        typeof router.getStateForAction
      >[1];
      expect(action).toMatchObject({
        type: 'POP',
        payload: { count: 2 },
        source: 'detail',
        target: 'market-stack',
      });
      const updated = router.getStateForAction(stack, action, config);
      expect(updated?.index).toBe(1);
      expect(updated?.routes).toEqual(routes.slice(0, 2));
    });

    it.each([1, 2])(
      'returns from %s banner token details to the existing banner list',
      (detailCount) => {
        const router = StackRouter({});
        const config = {
          routeNames: ['TabMarket', 'MarketBannerDetail', 'MarketDetailV2'],
          routeParamList: {},
          routeGetIdList: {},
        };
        const preservedRoutes = [
          marketStack.routes[0],
          {
            key: 'banner-list',
            name: 'MarketBannerDetail',
            params: {
              tokenListId: 'featured-tokens',
              title: 'Featured tokens',
            },
          },
        ];
        const stack = {
          ...router.getInitialState(config),
          ...marketStack,
          index: preservedRoutes.length + detailCount - 1,
          routes: [
            ...preservedRoutes,
            ...Array.from({ length: detailCount }, (_, index) => ({
              key: `detail-${index}`,
              name: 'MarketDetailV2',
            })),
          ],
        };
        const current = stack.routes[stack.index];
        getRootStateMock.mockReturnValue(stack);
        getCurrentRouteMock.mockReturnValue(current);
        void dismissDiscoveryMarketDetailForTrade(current.key);
        const action = dispatchMock.mock.calls[0]?.[0] as Parameters<
          typeof router.getStateForAction
        >[1];
        expect(action).toMatchObject({
          type: 'POP',
          payload: { count: detailCount },
          source: current.key,
          target: 'market-stack',
        });
        const updated = router.getStateForAction(stack, action, config);
        expect(updated?.index).toBe(1);
        expect(updated?.routes).toEqual(preservedRoutes);
      },
    );

    it('does not remove unrelated screens between the list and detail', () => {
      getRootStateMock.mockReturnValue({
        ...marketStack,
        index: 2,
        routes: [
          marketStack.routes[0],
          { key: 'other-screen', name: 'other-screen' },
          marketStack.routes[1],
        ],
      });
      void dismissDiscoveryMarketDetailForTrade('detail');
      expect(dispatchMock).not.toHaveBeenCalled();
    });

    it.each(['TabDiscovery', 'MobileTokenSelector', 'SwapProMarketDetail'])(
      'preserves history when the focused route is %s',
      (name) => {
        getCurrentRouteMock.mockReturnValue({ key: 'other', name });
        void dismissDiscoveryMarketDetailForTrade();
        expect(dispatchMock).not.toHaveBeenCalled();
      },
    );

    it('pops a detail in the standalone Market tab stack', () => {
      getRootStateMock.mockReturnValue({
        ...marketStack,
        key: 'market-stack',
        routes: [{ key: 'list', name: 'TabMarket' }, marketStack.routes[1]],
      });
      dismissDiscoveryMarketDetailForTrade();
      expect(dispatchMock).toHaveBeenCalledWith({
        type: 'POP',
        payload: { count: 1 },
        source: 'detail',
        target: 'market-stack',
      });
    });

    it('does not pop a detail in another stack', () => {
      getRootStateMock.mockReturnValue({
        ...marketStack,
        routes: [{ key: 'list', name: 'TabHome' }, marketStack.routes[1]],
      });
      void dismissDiscoveryMarketDetailForTrade();
      expect(dispatchMock).not.toHaveBeenCalled();
    });

    it('preserves desktop and web detail navigation', () => {
      platformEnv.isNative = false;
      void dismissDiscoveryMarketDetailForTrade();
      expect(dispatchMock).not.toHaveBeenCalled();
    });
  });

  describe('atomic iOS navigation from detail to Perps', () => {
    const tabRouter = TabRouter({});
    const tabConfig = {
      routeNames: [
        ETabRoutes.Home,
        ETabRoutes.Market,
        ETabRoutes.Perp,
        ETabRoutes.WebviewPerpTrade,
      ],
      routeParamList: {},
      routeGetIdList: {},
    };
    const stackRouter = StackRouter({});
    const stackConfig = {
      routeNames: [
        'TabMarket',
        'MarketNativeDetail',
        'MarketDetailV2',
        'MarketStockDetail',
        'MarketBannerDetail',
      ],
      routeParamList: {},
      routeGetIdList: {},
    };
    const list = {
      key: 'list',
      name: 'TabMarket',
      params: { category: 'top-coins' },
    };
    const createTabs = (
      routes: {
        key: string;
        name: string;
        params?: Record<string, unknown>;
      }[] = [list, { key: 'detail', name: 'MarketNativeDetail' }],
    ) => {
      const stack = {
        ...stackRouter.getInitialState(stackConfig),
        key: 'market-stack',
        index: routes.length - 1,
        routes,
      };
      const tabs = tabRouter.getInitialState(tabConfig);
      return {
        ...tabs,
        index: 1,
        routes: tabs.routes.map((route) =>
          route.name === ETabRoutes.Market
            ? {
                ...route,
                state: stack,
                params: {
                  retained: true,
                  screen: 'MarketNativeDetail',
                  params: { previous: 'BTC' },
                  initial: true,
                  state: stack,
                },
              }
            : route,
        ),
      };
    };
    beforeEach(() => {
      platformEnv.isNativeIOS = true;
      getCurrentRouteMock.mockReturnValue({
        key: 'detail',
        name: 'MarketNativeDetail',
      });
    });

    it('passes the owned Web Perps request in the same atomic tab reset', () => {
      const previousTabs = createTabs();
      const tabs = {
        ...previousTabs,
        routes: previousTabs.routes.map((route) =>
          route.name === ETabRoutes.WebviewPerpTrade
            ? {
                ...route,
                params: {
                  state: {
                    index: 0,
                    routes: [
                      {
                        name: ETabRoutes.WebviewPerpTrade,
                        params: { previous: true },
                      },
                    ],
                  },
                },
              }
            : route,
        ),
      };
      getRootStateMock.mockReturnValue({
        key: 'root',
        routes: [{ name: 'main', state: tabs }],
      });
      const params = {
        screen: ETabRoutes.WebviewPerpTrade,
        params: { tradeRequest: { requestId: 'own-ui', expiresAt: 2000 } },
      } as const;
      expect(
        dismissDiscoveryMarketDetailForTrade(
          'detail',
          ETabRoutes.WebviewPerpTrade,
          params,
        ),
      ).toBe('ready');
      const action = dispatchMock.mock.calls[0][0] as Parameters<
        typeof tabRouter.getStateForAction
      >[1];
      const updated = tabRouter.getStateForAction(tabs, action, tabConfig);
      expect(
        updated?.routes.find(
          (route) => route.name === ETabRoutes.WebviewPerpTrade,
        )?.params,
      ).toEqual(params);
    });

    it.each([ETabRoutes.Perp, ETabRoutes.WebviewPerpTrade])(
      'selects %s and removes details without remounting Market or its list',
      (target) => {
        const tabs = createTabs();
        getRootStateMock.mockReturnValue({
          key: 'root',
          routes: [{ name: 'main', state: tabs }],
        });
        expect(dismissDiscoveryMarketDetailForTrade('detail', target)).toBe(
          'ready',
        );
        expect(dispatchMock).toHaveBeenCalledTimes(1);
        const action = dispatchMock.mock.calls[0]?.[0] as Parameters<
          typeof tabRouter.getStateForAction
        >[1];
        expect(action.type).toBe('RESET');
        expect(action.target).toBe(tabs.key);
        const partial = tabRouter.getStateForAction(tabs, action, tabConfig);
        expect(partial).not.toBeNull();
        if (!partial) throw new OneKeyLocalError('Tab reset was not handled');
        const updated = tabRouter.getRehydratedState(partial, tabConfig);
        expect(updated.key).toBe(tabs.key);
        expect(updated.stale).toBe(false);
        expect(updated.routes[updated.index].name).toBe(target);
        const source = updated.routes[1];
        expect(source.key).toBe(tabs.routes[1].key);
        expect(source.params).toBe(tabs.routes[1].params);
        expect(source.state?.routes).toEqual([list]);
        expect(source.state?.index).toBe(0);
        expect(source.state?.routes[0]).toBe(list);
        expect(updated.preloadedRouteKeys).toEqual(tabs.preloadedRouteKeys);
        expect(
          updated.routes.filter((route) => route.name !== ETabRoutes.Market),
        ).toEqual(
          tabs.routes.filter((route) => route.name !== ETabRoutes.Market),
        );
        expect(
          updated.history.every((item) =>
            updated.routes.some((route) => route.key === item.key),
          ),
        ).toBe(true);
      },
    );

    it('preserves the banner list and earlier routes while removing every stacked detail', () => {
      const banner = {
        key: 'banner',
        name: 'MarketBannerDetail',
        params: { tokenListId: 'featured' },
      };
      const tabs = createTabs([
        list,
        banner,
        { key: 'older', name: 'MarketDetailV2' },
        { key: 'detail', name: 'MarketStockDetail' },
      ]);
      getRootStateMock.mockReturnValue({
        routes: [{ name: 'main', state: tabs }],
      });
      getCurrentRouteMock.mockReturnValue({
        key: 'detail',
        name: 'MarketStockDetail',
      });
      dismissDiscoveryMarketDetailForTrade('detail', ETabRoutes.Perp);
      const action = dispatchMock.mock.calls[0]?.[0] as Parameters<
        typeof tabRouter.getStateForAction
      >[1];
      const updated = tabRouter.getStateForAction(tabs, action, tabConfig);
      expect(updated?.routes[1].state?.routes).toEqual([list, banner]);
      expect(updated?.routes[1].state?.index).toBe(1);
    });

    it('cancels a stale request before changing any tab', () => {
      getRootStateMock.mockReturnValue({
        routes: [{ name: 'main', state: createTabs() }],
      });
      expect(
        dismissDiscoveryMarketDetailForTrade('older-detail', ETabRoutes.Perp),
      ).toBe('cancelled');
      expect(dispatchMock).not.toHaveBeenCalled();
    });

    it('does not pop the visible stack when the target tab is unavailable', () => {
      const tabs = createTabs();
      getRootStateMock.mockReturnValue({
        routes: [
          { name: 'main', state: { ...tabs, routes: tabs.routes.slice(0, 2) } },
        ],
      });
      expect(
        dismissDiscoveryMarketDetailForTrade('detail', ETabRoutes.Perp),
      ).toBe('cancelled');
      expect(dispatchMock).not.toHaveBeenCalled();
    });

    it('selects Perps and trims the standalone Market tab stack without remounting TabMarket', () => {
      const marketTabConfig = {
        routeNames: [
          ETabRoutes.Home,
          ETabRoutes.Market,
          ETabRoutes.Perp,
          ETabRoutes.WebviewPerpTrade,
        ],
        routeParamList: {},
        routeGetIdList: {},
      };
      const marketStackConfig = {
        routeNames: [
          'TabMarket',
          'MarketNativeDetail',
          'MarketDetailV2',
          'MarketStockDetail',
          'MarketBannerDetail',
        ],
        routeParamList: {},
        routeGetIdList: {},
      };
      const marketList = {
        key: 'market-list',
        name: 'TabMarket',
      };
      const marketStack = {
        ...stackRouter.getInitialState(marketStackConfig),
        key: 'market-stack',
        index: 1,
        routes: [marketList, { key: 'detail', name: 'MarketDetailV2' }],
      };
      const baseTabs = tabRouter.getInitialState(marketTabConfig);
      const tabs = {
        ...baseTabs,
        index: 1,
        routes: baseTabs.routes.map((route) =>
          route.name === ETabRoutes.Market
            ? {
                ...route,
                state: marketStack,
              }
            : route,
        ),
      };
      getRootStateMock.mockReturnValue({
        key: 'root',
        routes: [{ name: 'main', state: tabs }],
      });
      getCurrentRouteMock.mockReturnValue({
        key: 'detail',
        name: 'MarketDetailV2',
      });

      expect(
        dismissDiscoveryMarketDetailForTrade('detail', ETabRoutes.Perp),
      ).toBe('ready');
      const action = dispatchMock.mock.calls[0]?.[0] as Parameters<
        typeof tabRouter.getStateForAction
      >[1];
      const partial = tabRouter.getStateForAction(
        tabs,
        action,
        marketTabConfig,
      );
      if (!partial) throw new OneKeyLocalError('Tab reset was not handled');
      const updated = tabRouter.getRehydratedState(partial, marketTabConfig);
      expect(updated.routes[updated.index].name).toBe(ETabRoutes.Perp);
      expect(updated.routes[1].state?.routes).toEqual([marketList]);
      expect(updated.routes[1].state?.index).toBe(0);
    });
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
            key: 'market-stack',
            index: 1,
            routes: [
              { key: 'list', name: 'TabMarket' },
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

  describe('with a legacy Market route still in the Discovery stack', () => {
    const buildTabsState = (
      marketRoutes: { key: string; name: string }[],
    ): INavigationStateNode => ({
      key: 'root',
      index: 1,
      routes: [
        {
          key: 'main',
          name: 'main',
          state: {
            key: 'tabs',
            index: 1,
            routes: [
              {
                key: 'market-tab',
                name: ETabRoutes.Market,
                state: {
                  key: 'market-stack',
                  index: marketRoutes.length - 1,
                  routes: marketRoutes,
                },
              },
              {
                key: 'discovery-tab',
                name: ETabRoutes.Discovery,
                state: {
                  key: 'discovery-stack',
                  index: 1,
                  routes: [
                    { key: 'discovery-home', name: 'TabDiscovery' },
                    {
                      key: 'legacy-detail',
                      name: 'MarketStockDetail',
                      params: { stockId: 'TSLA' },
                    },
                  ],
                },
              },
            ],
          },
        },
        { key: 'modal', name: 'MobileTokenSelector' },
      ],
    });

    it('never picks the Discovery stack as the Market stack', () => {
      expect(
        findMarketTabStack(
          buildTabsState([
            { key: 'list', name: 'TabMarket' },
            { key: 'detail', name: 'MarketDetailV2' },
          ]),
        )?.key,
      ).toBe('market-stack');
      expect(
        findMarketTabStack(buildTabsState([{ key: 'list', name: 'TabMarket' }]))
          ?.key,
      ).toBe('market-stack');
    });

    it('replaces the selected stock on the Market stack, not the hidden Discovery stack', () => {
      getRootStateMock.mockReturnValue(
        buildTabsState([
          { key: 'list', name: 'TabMarket' },
          { key: 'detail', name: 'MarketDetailV2' },
        ]),
      );

      expect(
        openOrReplaceMarketDetailRoute({
          routeName: 'MarketStockDetail',
          params: { stockId: 'NVDA' },
        }),
      ).toBe(true);

      expect(dispatchMock).toHaveBeenCalledTimes(1);
      expect(dispatchMock).toHaveBeenCalledWith(
        expect.objectContaining({ target: 'market-stack' }),
      );
      // The hidden Discovery stock detail must not be read as the current one.
      expect(getCurrentMarketStockDetailId()).toBeUndefined();
    });
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
          { key: 'list', name: 'TabMarket' },
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
      target: 'market-stack',
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
      target: 'market-stack',
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
        target: 'market-stack',
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

  it.each([
    {
      label: 'another top coin',
      params: {
        tokenAddress: '',
        network: 'btc',
        isNative: true,
        marketTokenId: 'bitcoin',
        marketVariantId: 'bitcoin-native',
        marketTokenCategory: MARKET_TOP_COINS_CATEGORY_ID,
      },
    },
    {
      label: 'a regular token',
      params: {
        tokenAddress: '0xabc',
        network: 'bsc',
        isNative: false,
      },
    },
  ])(
    'updates top coin route identity under the selector when choosing $label',
    ({ params }) => {
      const router = StackRouter({});
      const config = {
        routeNames: ['TabMarket', 'MarketDetailV2'],
        routeParamList: {},
        routeGetIdList: {},
      };
      const stack = {
        ...router.getInitialState(config),
        key: 'market-stack',
        index: 1,
        routes: [
          { key: 'list', name: 'TabMarket' },
          {
            key: 'detail',
            name: 'MarketDetailV2',
            params: {
              network: 'eth',
              tokenAddress: '',
              isNative: true,
              marketTokenId: 'ethereum',
              marketVariantId: 'ethereum-native',
              marketTokenCategory: MARKET_TOP_COINS_CATEGORY_ID,
            },
          },
        ],
      };
      getRootStateMock.mockReturnValue({
        key: 'root',
        index: 1,
        routes: [
          { key: 'main', name: 'main', state: stack },
          { key: 'selector', name: 'MarketModal' },
        ],
      });
      getCurrentRouteMock.mockReturnValue({ name: 'MobileTokenSelector' });

      expect(
        openOrReplaceMarketDetailRoute({ routeName: 'MarketDetailV2', params }),
      ).toBe(true);
      const action = dispatchMock.mock.calls[0]?.[0] as Parameters<
        typeof router.getStateForAction
      >[1];
      // Root dispatch reaches an unfocused child only with an explicit target.
      expect(action.target).toBe(stack.key);
      const updated = router.getStateForAction(stack, action, config);
      expect(updated?.routes[1].params).toEqual(
        buildReplacedMarketDetailParams(params),
      );
      expect(updated?.routes.map((route) => route.key)).toEqual([
        'list',
        'detail',
      ]);
    },
  );

  it('targets the owning modal stack when updating a focused SwapPro detail', () => {
    getRootStateMock.mockReturnValue({
      key: 'root',
      routes: [
        {
          key: 'modal',
          name: 'SwapModal',
          state: {
            key: 'swap-modal-stack',
            routes: [{ key: 'swap-detail', name: 'SwapProMarketDetail' }],
          },
        },
      ],
    });
    getCurrentRouteMock.mockReturnValue({
      key: 'swap-detail',
      name: 'SwapProMarketDetail',
    });
    expect(
      replaceFocusedMarketDetailRoute({
        routeName: 'MarketDetailV2',
        params: { tokenAddress: '0xabc', network: 'eth' },
      }),
    ).toBe(true);
    expect(dispatchMock).toHaveBeenCalledWith(
      expect.objectContaining({
        target: 'swap-modal-stack',
        source: 'swap-detail',
      }),
    );
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
          { name: 'TabMarket' },
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
          { name: 'TabMarket' },
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

  it('resets native empty history to TabMarket', () => {
    expect(
      resolveMarketDetailBackAction({
        isTabletDetailView: false,
        isNative: true,
        routes: [{ name: 'MarketDetailV2' }],
        index: 0,
      }),
    ).toEqual({
      type: 'reset',
      name: 'TabMarket',
      params: getNativeMarketListResetParams(),
    });
    expect(getNativeMarketListResetParams()).toBeUndefined();
  });

  it('keeps search-entry native back switching to Market', () => {
    expect(
      resolveMarketDetailBackAction({
        isTabletDetailView: false,
        isNative: true,
        from: EEnterWay.Search,
        routes: [{ name: 'TabMarket' }, { name: 'MarketDetailV2' }],
        index: 1,
      }),
    ).toEqual({ type: 'popAndSwitchMarket' });
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
      name: 'TabMarket',
      params: getNativeMarketListResetParams(),
    });
  });
});
