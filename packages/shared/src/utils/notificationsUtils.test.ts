import appGlobals from '../appGlobals';
import { EAppEventBusNames, appEventBus } from '../eventBus/appEventBus';
import { ETranslations } from '../locale';
import platformEnv from '../platformEnv';
import {
  ERootRoutes,
  ETabDiscoveryRoutes,
  ETabMarketRoutes,
  ETabRoutes,
} from '../routes';

import { navigateToNotificationDetailByLocalParams } from './notificationsUtils';
import timerUtils from './timerUtils';

jest.mock('@react-navigation/native', () => ({
  CommonActions: {
    reset: jest.fn((state: unknown) => ({ type: 'RESET', payload: state })),
  },
  StackActions: {
    push: jest.fn((screen: string, params: unknown) => ({
      type: 'PUSH',
      payload: { screen, params },
    })),
  },
}));

jest.mock('../eventBus/appEventBus', () => ({
  EAppEventBusNames: {
    SwitchDiscoveryTabInNative: 'SwitchDiscoveryTabInNative',
    ShowNotificationPageNavigation: 'ShowNotificationPageNavigation',
  },
  appEventBus: {
    emit: jest.fn(),
    on: jest.fn(),
  },
}));

jest.mock('./openUrlUtils', () => ({
  openUrlExternal: jest.fn(),
}));

jest.mock('./timerUtils', () => ({
  __esModule: true,
  default: {
    wait: jest.fn(async () => undefined),
  },
}));

const mockAppEventBus = appEventBus as typeof appEventBus & {
  emit: jest.Mock;
};

describe('navigateToNotificationDetailByLocalParams (Native Market & Discovery routing)', () => {
  const navigateMock = jest.fn();
  const getRootStateMock = jest.fn(() => ({
    routes: [{ name: ERootRoutes.Main }],
    index: 0,
  }));
  const getEarnAccountMock = jest.fn(async () => null);
  const originalNavigationRef = appGlobals.$navigationRef;
  const originalTabletMainViewNavigationRef =
    appGlobals.$tabletMainViewNavigationRef;
  const originalIsNative = platformEnv.isNative;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    platformEnv.isNative = true;
    (timerUtils.wait as jest.Mock).mockResolvedValue(undefined);
    appGlobals.$tabletMainViewNavigationRef = undefined as never;
    appGlobals.$navigationRef = {
      current: {
        navigate: navigateMock,
        getRootState: getRootStateMock,
        dispatch: jest.fn(),
      },
    } as never;
  });

  afterEach(() => {
    jest.useRealTimers();
    platformEnv.isNative = originalIsNative;
    appGlobals.$navigationRef = originalNavigationRef;
    appGlobals.$tabletMainViewNavigationRef =
      originalTabletMainViewNavigationRef;
  });

  it('keeps ETabRoutes.Market payloads on the standalone Market tab on native', async () => {
    await navigateToNotificationDetailByLocalParams({
      payload: {
        screen: ERootRoutes.Main,
        params: {
          screen: ETabRoutes.Market,
          params: {
            screen: ETabMarketRoutes.MarketDetailV2,
            params: { marketTokenId: 'bitcoin' },
          },
        },
      },
      localParams: {},
      getEarnAccount: getEarnAccountMock,
    });

    jest.runAllTimers();

    expect(navigateMock).toHaveBeenCalledWith(
      ERootRoutes.Main,
      {
        screen: ETabRoutes.Market,
        params: {
          screen: ETabMarketRoutes.MarketDetailV2,
          params: { marketTokenId: 'bitcoin' },
        },
      },
      { pop: true },
    );
    expect(mockAppEventBus.emit).not.toHaveBeenCalled();
  });

  it('redirects legacy Discovery-embedded Market detail notification payloads to ETabRoutes.Market on native', async () => {
    await navigateToNotificationDetailByLocalParams({
      payload: {
        screen: ERootRoutes.Main,
        params: {
          screen: ETabRoutes.Discovery,
          params: {
            screen: ETabMarketRoutes.MarketDetailV2,
            params: { marketTokenId: 'ethereum' },
          },
        },
      },
      localParams: {},
      getEarnAccount: getEarnAccountMock,
    });

    jest.runAllTimers();

    expect(navigateMock).toHaveBeenCalledWith(
      ERootRoutes.Main,
      {
        screen: ETabRoutes.Market,
        params: {
          screen: ETabMarketRoutes.MarketDetailV2,
          params: { marketTokenId: 'ethereum' },
        },
      },
      { pop: true },
    );
    expect(mockAppEventBus.emit).not.toHaveBeenCalled();
  });

  it('redirects legacy Discovery defaultTab=global_market notification payloads to ETabRoutes.Market -> TabMarket on native', async () => {
    await navigateToNotificationDetailByLocalParams({
      payload: {
        screen: ERootRoutes.Main,
        params: {
          screen: ETabRoutes.Discovery,
          params: {
            screen: ETabDiscoveryRoutes.TabDiscovery,
            params: { defaultTab: ETranslations.global_market },
          },
        },
      },
      localParams: {},
      getEarnAccount: getEarnAccountMock,
    });

    jest.runAllTimers();

    expect(navigateMock).toHaveBeenCalledWith(
      ERootRoutes.Main,
      {
        screen: ETabRoutes.Market,
        params: {
          screen: ETabMarketRoutes.TabMarket,
        },
      },
      { pop: true },
    );
    expect(mockAppEventBus.emit).not.toHaveBeenCalled();
  });

  it.each([
    [ETabMarketRoutes.MarketDetailV2, { marketTokenId: 'bitcoin' }] as const,
    [ETabMarketRoutes.MarketBannerDetail, { tokenListId: 'banner-1' }] as const,
  ])(
    'pops an existing %s route on the Market stack back to TabMarket when a legacy defaultTab=global_market notification is opened',
    async (activeDetailRoute, activeDetailParams) => {
      const {
        CommonActions: RouterActions,
        StackRouter,
        TabRouter,
      } = jest.requireActual<typeof import('@react-navigation/routers')>(
        '@react-navigation/routers',
      );
      const tabRouteNames = [
        ETabRoutes.Home,
        ETabRoutes.Market,
        ETabRoutes.Discovery,
      ];
      const marketRouteNames = [
        ETabMarketRoutes.TabMarket,
        ETabMarketRoutes.MarketDetailV2,
        ETabMarketRoutes.MarketBannerDetail,
      ];
      const tabRouterConfig = {
        routeNames: tabRouteNames,
        routeParamList: {},
        routeGetIdList: {},
      };
      const marketRouterConfig = {
        routeNames: marketRouteNames,
        routeParamList: {},
        routeGetIdList: {},
      };
      const tabRouter = TabRouter({
        backBehavior: 'initialRoute',
      });
      const marketStackRouter = StackRouter({});

      const initialMarketStackState =
        marketStackRouter.getInitialState(marketRouterConfig);
      const navigatedMarketPartialState =
        marketStackRouter.getStateForAction(
          initialMarketStackState,
          RouterActions.navigate({
            name: activeDetailRoute,
            params: activeDetailParams,
          }),
          marketRouterConfig,
        ) ?? initialMarketStackState;
      const marketStackState = marketStackRouter.getRehydratedState(
        navigatedMarketPartialState,
        marketRouterConfig,
      );

      expect(marketStackState.routes.map((r) => r.name)).toEqual([
        ETabMarketRoutes.TabMarket,
        activeDetailRoute,
      ]);

      let tabState = tabRouter.getInitialState(tabRouterConfig);
      tabState = {
        ...tabState,
        routes: tabState.routes.map((route) =>
          route.name === ETabRoutes.Market
            ? { ...route, state: marketStackState }
            : route,
        ),
      };

      await navigateToNotificationDetailByLocalParams({
        payload: {
          screen: ERootRoutes.Main,
          params: {
            screen: ETabRoutes.Discovery,
            params: {
              screen: ETabDiscoveryRoutes.TabDiscovery,
              params: { defaultTab: ETranslations.global_market },
            },
          },
        },
        localParams: {},
        getEarnAccount: getEarnAccountMock,
      });

      jest.runAllTimers();

      const [, mainParams, navigateOptions] = navigateMock.mock.calls[0] as [
        string,
        {
          screen: string;
          params?: { screen: string; params?: Record<string, unknown> };
        },
        { pop?: boolean },
      ];

      const nextTabPartialState =
        tabRouter.getStateForAction(
          tabState,
          RouterActions.navigate(
            mainParams.screen,
            mainParams.params,
            navigateOptions,
          ),
          tabRouterConfig,
        ) ?? tabState;
      const nextTabState = tabRouter.getRehydratedState(
        nextTabPartialState,
        tabRouterConfig,
      );

      const nextMarketRoute = nextTabState.routes.find(
        (route) => route.name === ETabRoutes.Market,
      );
      expect(nextTabState.routes[nextTabState.index]?.name).toBe(
        ETabRoutes.Market,
      );
      expect(nextMarketRoute?.params).toEqual({
        screen: ETabMarketRoutes.TabMarket,
      });

      const finalMarketPartialState =
        marketStackRouter.getStateForAction(
          marketStackState,
          RouterActions.navigate({
            name: (nextMarketRoute?.params as { screen: string }).screen,
            params: (
              nextMarketRoute?.params as { params?: Record<string, unknown> }
            ).params,
            pop: navigateOptions?.pop,
          }),
          marketRouterConfig,
        ) ?? marketStackState;
      const finalMarketStackState = marketStackRouter.getRehydratedState(
        finalMarketPartialState,
        marketRouterConfig,
      );

      expect(finalMarketStackState.routes.map((r) => r.name)).toEqual([
        ETabMarketRoutes.TabMarket,
      ]);
      expect(finalMarketStackState.index).toBe(0);
    },
  );

  it('still redirects ETabRoutes.Earn to ETabRoutes.Discovery and emits SwitchDiscoveryTabInNative(global_earn)', async () => {
    await navigateToNotificationDetailByLocalParams({
      payload: {
        screen: ERootRoutes.Main,
        params: {
          screen: ETabRoutes.Earn,
        },
      },
      localParams: {},
      getEarnAccount: getEarnAccountMock,
    });

    jest.runAllTimers();

    expect(navigateMock).toHaveBeenCalledWith(
      ERootRoutes.Main,
      {
        screen: ETabRoutes.Discovery,
      },
      { pop: true },
    );
    expect(mockAppEventBus.emit).toHaveBeenCalledWith(
      EAppEventBusNames.SwitchDiscoveryTabInNative,
      { tab: ETranslations.global_earn },
    );
  });
});
