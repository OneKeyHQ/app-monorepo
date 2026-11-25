/** @jest-environment jsdom */
import type { ComponentType } from 'react';

import {
  BaseNavigationContainer,
  CommonActions,
  type NavigationState,
  type ParamListBase,
  StackRouter,
  TabRouter,
  createNavigationContainerRef,
  createNavigatorFactory,
  useNavigationBuilder,
} from '@react-navigation/core';
import { act, render } from '@testing-library/react';

import appGlobals from '../appGlobals';
import { OneKeyLocalError } from '../errors';
import { ETranslations } from '../locale';
import platformEnv from '../platformEnv';
import {
  ERootRoutes,
  ETabDiscoveryRoutes,
  ETabMarketRoutes,
  ETabRoutes,
  ETabSwapRoutes,
  type ITabSwapParamList,
} from '../routes';

import {
  navigateToNotificationDetailByLocalParams,
  retireSwapTabPrefill,
  transferTabletSwapPrefill,
} from './notificationsUtils';
import { isSwapTabPrefillRetired } from './swapEntryUtils';
import timerUtils from './timerUtils';

jest.mock('@react-navigation/native', () => {
  const core = jest.requireActual<typeof import('@react-navigation/core')>(
    '@react-navigation/core',
  );
  return {
    CommonActions: core.CommonActions,
    StackActions: core.StackActions,
  };
});

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
    ...jest.requireActual<typeof import('./timerUtils')>('./timerUtils')
      .default,
    wait: jest.fn(async () => undefined),
  },
}));

// Exercise React Navigation's real nested Tab/Stack routers so nested params
// (e.g. `pop`) are resolved by useNavigationBuilder, not copied by the test.
function TestStack(props: Parameters<typeof useNavigationBuilder>[1]) {
  const { state, descriptors, NavigationContent } = useNavigationBuilder(
    StackRouter,
    props,
  );
  return (
    <NavigationContent>
      {state.routes.map((route) => (
        <div key={route.key}>{descriptors[route.key].render()}</div>
      ))}
    </NavigationContent>
  );
}

function TestTabs(props: Parameters<typeof useNavigationBuilder>[1]) {
  const { state, descriptors, NavigationContent } = useNavigationBuilder(
    TabRouter,
    props,
  );
  return (
    <NavigationContent>
      {state.routes.map((route) => (
        <div key={route.key}>{descriptors[route.key].render()}</div>
      ))}
    </NavigationContent>
  );
}

type ITestNavigator = {
  Navigator: ComponentType<{ children: React.ReactNode }>;
  Screen: ComponentType<{ name: string; component: ComponentType }>;
};

const RootStack = createNavigatorFactory(TestStack)() as ITestNavigator;
const MainTabs = createNavigatorFactory(TestTabs)() as ITestNavigator;
const MarketStack = createNavigatorFactory(TestStack)() as ITestNavigator;
const DiscoveryStack = createNavigatorFactory(TestStack)() as ITestNavigator;
const SwapStack = createNavigatorFactory(TestStack)() as ITestNavigator;

function EmptyScreen() {
  return null;
}

function MarketStackScreen() {
  return (
    <MarketStack.Navigator>
      <MarketStack.Screen
        name={ETabMarketRoutes.TabMarket}
        component={EmptyScreen}
      />
      <MarketStack.Screen
        name={ETabMarketRoutes.MarketDetailV2}
        component={EmptyScreen}
      />
      <MarketStack.Screen
        name={ETabMarketRoutes.MarketBannerDetail}
        component={EmptyScreen}
      />
    </MarketStack.Navigator>
  );
}

function DiscoveryStackScreen() {
  return (
    <DiscoveryStack.Navigator>
      <DiscoveryStack.Screen
        name={ETabDiscoveryRoutes.TabDiscovery}
        component={EmptyScreen}
      />
    </DiscoveryStack.Navigator>
  );
}

function SwapStackScreen() {
  return (
    <SwapStack.Navigator>
      <SwapStack.Screen name={ETabSwapRoutes.TabSwap} component={EmptyScreen} />
    </SwapStack.Navigator>
  );
}

function MainTabsScreen() {
  return (
    <MainTabs.Navigator>
      <MainTabs.Screen name={ETabRoutes.Home} component={EmptyScreen} />
      <MainTabs.Screen name={ETabRoutes.Market} component={MarketStackScreen} />
      <MainTabs.Screen
        name={ETabRoutes.Discovery}
        component={DiscoveryStackScreen}
      />
      <MainTabs.Screen name={ETabRoutes.Swap} component={SwapStackScreen} />
    </MainTabs.Navigator>
  );
}

function findNestedState(
  state: NavigationState | undefined,
  routeName: string,
): NavigationState | undefined {
  if (!state) return undefined;
  for (const route of state.routes) {
    const child = route.state as NavigationState | undefined;
    if (route.name === routeName) return child;
    const found = findNestedState(child, routeName);
    if (found) return found;
  }
  return undefined;
}

const swapNotificationParams = {
  tab: 'swap',
  importNetworkId: 'evm--1',
  importFromToken: {
    networkId: 'evm--1',
    contractAddress: '0xdac17f958d2ee523a2206206994597c13d831ec7',
    symbol: 'USDT',
    decimals: 6,
  },
  importToToken: {
    networkId: 'evm--1',
    contractAddress: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
    symbol: 'USDC',
    decimals: 6,
  },
};

function renderSwapNotificationNavigator({
  isTabletMainView = false,
  getIsSplitViewActive,
}: {
  isTabletMainView?: boolean;
  getIsSplitViewActive?: () => boolean;
} = {}) {
  const ref = createNavigationContainerRef<ParamListBase>();
  render(
    <BaseNavigationContainer ref={ref}>
      <RootStack.Navigator>
        <RootStack.Screen name={ERootRoutes.Main} component={MainTabsScreen} />
        <RootStack.Screen name={ERootRoutes.Modal} component={EmptyScreen} />
      </RootStack.Navigator>
    </BaseNavigationContainer>,
  );
  if (isTabletMainView) {
    appGlobals.$tabletMainViewNavigationRef = { current: ref };
  } else {
    appGlobals.$navigationRef = { current: ref };
  }

  const deliver = (params: Record<string, unknown>) =>
    navigateToNotificationDetailByLocalParams({
      payload: {
        screen: ERootRoutes.Main,
        params: {
          screen: ETabRoutes.Swap,
          params: { screen: ETabSwapRoutes.TabSwap, params },
        },
      },
      localParams: {},
      getEarnAccount: jest.fn(async () => null),
      getIsSplitViewActive,
    });

  return {
    deliver,
    async navigate(params: Record<string, unknown>) {
      await act(async () => {
        await deliver(params);
      });
    },
    getCurrentRoute: () => ref.getCurrentRoute(),
    getSwapPrefill: () =>
      (
        ref.getCurrentRoute()?.params as
          | ITabSwapParamList[ETabSwapRoutes.TabSwap]
          | undefined
      )?.swapPrefill,
    getRootState: () => ref.getRootState(),
    openModal: () => ref.navigate(ERootRoutes.Modal),
  };
}

describe('notify through real nested navigators', () => {
  const originalNavigationRef = appGlobals.$navigationRef;
  const originalTabletMainViewNavigationRef =
    appGlobals.$tabletMainViewNavigationRef;
  const originalIsNative = platformEnv.isNative;

  beforeEach(() => {
    platformEnv.isNative = true;
    appGlobals.$tabletMainViewNavigationRef = undefined as never;
  });

  afterEach(() => {
    platformEnv.isNative = originalIsNative;
    appGlobals.$navigationRef = originalNavigationRef;
    appGlobals.$tabletMainViewNavigationRef =
      originalTabletMainViewNavigationRef;
  });

  it.each([
    [ETabMarketRoutes.MarketDetailV2, { marketTokenId: 'bitcoin' }] as const,
    [ETabMarketRoutes.MarketBannerDetail, { tokenListId: 'banner-1' }] as const,
  ])(
    'pops an existing %s route on the Market stack back to TabMarket',
    async (activeDetailRoute, activeDetailParams) => {
      const ref = createNavigationContainerRef<ParamListBase>();
      render(
        <BaseNavigationContainer
          ref={ref}
          initialState={{
            index: 0,
            routes: [
              {
                name: ERootRoutes.Main,
                state: {
                  index: 1,
                  routes: [
                    { name: ETabRoutes.Home },
                    {
                      name: ETabRoutes.Market,
                      state: {
                        index: 1,
                        routes: [
                          { name: ETabMarketRoutes.TabMarket },
                          {
                            name: activeDetailRoute,
                            params: activeDetailParams,
                          },
                        ],
                      },
                    },
                    { name: ETabRoutes.Discovery },
                  ],
                },
              },
            ],
          }}
        >
          <RootStack.Navigator>
            <RootStack.Screen
              name={ERootRoutes.Main}
              component={MainTabsScreen}
            />
          </RootStack.Navigator>
        </BaseNavigationContainer>,
      );
      appGlobals.$navigationRef = { current: ref } as never;

      expect(
        findNestedState(ref.getRootState(), ETabRoutes.Market)?.routes.map(
          (route) => route.name,
        ),
      ).toEqual([ETabMarketRoutes.TabMarket, activeDetailRoute]);

      await act(async () => {
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
          getEarnAccount: jest.fn(async () => null),
        });
      });

      const rootState = ref.getRootState();
      const mainState = findNestedState(rootState, ERootRoutes.Main);
      expect(mainState?.routes[mainState.index]?.name).toBe(ETabRoutes.Market);
      const marketState = findNestedState(rootState, ETabRoutes.Market);
      expect(marketState?.routes.map((route) => route.name)).toEqual([
        ETabMarketRoutes.TabMarket,
      ]);
      expect(marketState?.index).toBe(0);
    },
  );

  it('delivers a fresh identity-only Swap prefill on each delivery of the same page payload', async () => {
    const navigation = renderSwapNotificationNavigator();
    const externalRequestId = 'external';
    const params = {
      ...swapNotificationParams,
      fromAmount: '100',
      swapPrefill: { requestId: externalRequestId },
    };

    await navigation.navigate(params);

    const firstRoute = navigation.getCurrentRoute();
    const firstParams = firstRoute?.params as
      | ITabSwapParamList[ETabSwapRoutes.TabSwap]
      | undefined;
    expect(firstRoute?.name).toBe(ETabSwapRoutes.TabSwap);
    expect(firstParams).toStrictEqual({
      tab: 'swap',
      swapPrefill: {
        requestId: expect.any(String),
        fromToken: {
          networkId: 'evm--1',
          contractAddress:
            swapNotificationParams.importFromToken.contractAddress,
          isNative: false,
        },
        toToken: {
          networkId: 'evm--1',
          contractAddress: swapNotificationParams.importToToken.contractAddress,
          isNative: false,
        },
      },
    });
    expect(firstParams?.swapPrefill?.requestId).not.toBe(externalRequestId);

    await navigation.navigate(params);

    const secondRoute = navigation.getCurrentRoute();
    const secondParams = secondRoute?.params as
      | ITabSwapParamList[ETabSwapRoutes.TabSwap]
      | undefined;
    expect(secondRoute?.key).toBe(firstRoute?.key);
    expect(secondParams).toStrictEqual({
      tab: 'swap',
      swapPrefill: {
        ...firstParams?.swapPrefill,
        requestId: expect.any(String),
      },
    });
    expect(secondParams?.swapPrefill?.requestId).not.toBe(
      firstParams?.swapPrefill?.requestId,
    );
  });

  it('routes the pair only to the visible tablet pane and clears the previous pane after rotation', async () => {
    let isSplitViewActive = true;
    const mainPane = renderSwapNotificationNavigator({
      isTabletMainView: true,
    });
    const detailPane = renderSwapNotificationNavigator({
      getIsSplitViewActive: () => isSplitViewActive,
    });

    await detailPane.navigate(swapNotificationParams);

    const visibleRoute = mainPane.getCurrentRoute();
    expect(visibleRoute?.name).toBe(ETabSwapRoutes.TabSwap);
    expect(visibleRoute?.params).toMatchObject({
      tab: 'swap',
      swapPrefill: {
        fromToken: {
          contractAddress:
            swapNotificationParams.importFromToken.contractAddress,
        },
      },
    });
    expect(detailPane.getCurrentRoute()?.params).toStrictEqual({
      tab: 'swap',
      swapPrefill: undefined,
    });

    jest.mocked(timerUtils.wait).mockImplementationOnce(async (ms) => {
      expect(ms).toBe(350);
      isSplitViewActive = false;
    });
    await detailPane.navigate({
      ...swapNotificationParams,
      importFromToken: swapNotificationParams.importToToken,
      importToToken: swapNotificationParams.importFromToken,
    });

    expect(detailPane.getCurrentRoute()?.params).toMatchObject({
      tab: 'swap',
      swapPrefill: {
        fromToken: {
          contractAddress: swapNotificationParams.importToToken.contractAddress,
        },
      },
    });
    expect(mainPane.getCurrentRoute()?.params).toStrictEqual({
      tab: 'swap',
      swapPrefill: undefined,
    });
  });

  it('moves the same pending request when the tablet rotates after dispatch', async () => {
    const mainPane = renderSwapNotificationNavigator({
      isTabletMainView: true,
    });
    const detailPane = renderSwapNotificationNavigator({
      getIsSplitViewActive: () => true,
    });
    await detailPane.navigate(swapNotificationParams);
    const pending = mainPane.getSwapPrefill();
    expect(pending?.requestId).toEqual(expect.any(String));

    await act(async () => transferTabletSwapPrefill(false));
    expect(detailPane.getSwapPrefill()).toBe(pending);
    expect(mainPane.getSwapPrefill()).toBeUndefined();

    await act(async () => transferTabletSwapPrefill(true));
    expect(mainPane.getSwapPrefill()).toBe(pending);
    expect(detailPane.getSwapPrefill()).toBeUndefined();

    await act(async () => {
      appGlobals.$tabletMainViewNavigationRef.current?.dispatch(
        CommonActions.setParams({ swapPrefill: undefined }),
      );
    });
    await act(async () => transferTabletSwapPrefill(false));
    expect(mainPane.getSwapPrefill()).toBeUndefined();
    expect(detailPane.getSwapPrefill()).toBeUndefined();
  });

  it('preserves a newer tab-only Stock notification when the tablet rotates', async () => {
    const mainPane = renderSwapNotificationNavigator({
      isTabletMainView: true,
    });
    const detailPane = renderSwapNotificationNavigator({
      getIsSplitViewActive: () => true,
    });

    await detailPane.navigate(swapNotificationParams);
    const pending = mainPane.getSwapPrefill();
    if (!pending) {
      throw new OneKeyLocalError('The first notification did not prefill');
    }

    await detailPane.navigate({ tab: 'stock' });
    expect(isSwapTabPrefillRetired(pending)).toBe(true);
    await act(async () => transferTabletSwapPrefill(false));

    for (const pane of [mainPane, detailPane]) {
      expect(pane.getCurrentRoute()?.params).toStrictEqual({
        tab: 'stock',
        swapPrefill: undefined,
      });
    }
  });

  it('retires only the matching prefill even when it already moved to the other pane', async () => {
    const mainPane = renderSwapNotificationNavigator({
      isTabletMainView: true,
    });
    const detailPane = renderSwapNotificationNavigator({
      getIsSplitViewActive: () => true,
    });

    await detailPane.navigate(swapNotificationParams);
    const pending = mainPane.getSwapPrefill();
    if (!pending) {
      throw new OneKeyLocalError('The first notification did not prefill');
    }
    await act(async () => transferTabletSwapPrefill(false));
    expect(detailPane.getSwapPrefill()).toBe(pending);

    await act(async () => retireSwapTabPrefill(pending));
    expect(isSwapTabPrefillRetired(pending)).toBe(true);
    expect(detailPane.getCurrentRoute()?.params).toStrictEqual({
      tab: 'swap',
      swapPrefill: undefined,
    });
    await act(async () => transferTabletSwapPrefill(true));
    expect(mainPane.getSwapPrefill()).toBeUndefined();

    await detailPane.navigate(swapNotificationParams);
    const refreshed = mainPane.getSwapPrefill();
    if (!refreshed) {
      throw new OneKeyLocalError('The second notification did not prefill');
    }
    await act(async () => retireSwapTabPrefill(pending));
    expect(isSwapTabPrefillRetired(refreshed)).toBe(false);
    expect(mainPane.getSwapPrefill()).toBe(refreshed);
  });

  it('keeps the newer Swap tap when the earlier tap is waiting for a modal to close', async () => {
    const navigation = renderSwapNotificationNavigator();
    await act(async () => navigation.openModal());
    expect(navigation.getCurrentRoute()?.name).toBe(ERootRoutes.Modal);

    let finishDismiss = () => {};
    const dismiss = new Promise<void>((resolve) => {
      finishDismiss = resolve;
    });
    jest.mocked(timerUtils.wait).mockImplementationOnce(async (ms) => {
      expect(ms).toBe(100);
      await dismiss;
    });

    let earlierNavigation: Promise<void> | undefined;
    await act(async () => {
      earlierNavigation = navigation.deliver(swapNotificationParams);
    });
    expect(navigation.getRootState().routes.map(({ name }) => name)).toEqual([
      ERootRoutes.Main,
    ]);

    const newerParams = {
      ...swapNotificationParams,
      importFromToken: swapNotificationParams.importToToken,
      importToToken: swapNotificationParams.importFromToken,
    };
    await navigation.navigate(newerParams);
    const newerRoute = navigation.getCurrentRoute();
    expect(newerRoute?.params).toMatchObject({
      swapPrefill: {
        fromToken: {
          contractAddress: newerParams.importFromToken.contractAddress,
        },
      },
    });

    await act(async () => {
      finishDismiss();
      await earlierNavigation;
    });

    expect(navigation.getCurrentRoute()?.params).toStrictEqual(
      newerRoute?.params,
    );
  });

  it.each([
    ['tab-only', { tab: 'stock' }],
    [
      'inconsistent network',
      { ...swapNotificationParams, importNetworkId: 'evm--56' },
    ],
    [
      'missing destination',
      { ...swapNotificationParams, importToToken: undefined },
    ],
  ])(
    'continues navigation with %s without reusing the previous pair',
    async (_case, params) => {
      const navigation = renderSwapNotificationNavigator();

      await navigation.navigate(swapNotificationParams);
      await navigation.navigate(params);

      const route = navigation.getCurrentRoute();
      expect(route?.name).toBe(ETabSwapRoutes.TabSwap);
      expect(route?.params).toStrictEqual({
        tab: params.tab,
        swapPrefill: undefined,
      });
    },
  );
});
