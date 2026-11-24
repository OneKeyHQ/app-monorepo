/** @jest-environment jsdom */
import type { ComponentType } from 'react';

import {
  BaseNavigationContainer,
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

import { navigateToNotificationDetailByLocalParams } from './notificationsUtils';

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

function renderSwapNotificationNavigator() {
  const ref = createNavigationContainerRef<ParamListBase>();
  render(
    <BaseNavigationContainer ref={ref}>
      <RootStack.Navigator>
        <RootStack.Screen name={ERootRoutes.Main} component={MainTabsScreen} />
      </RootStack.Navigator>
    </BaseNavigationContainer>,
  );
  appGlobals.$navigationRef = { current: ref };

  return {
    async navigate(params: Record<string, unknown>) {
      await act(async () => {
        await navigateToNotificationDetailByLocalParams({
          payload: {
            screen: ERootRoutes.Main,
            params: {
              screen: ETabRoutes.Swap,
              params: { screen: ETabSwapRoutes.TabSwap, params },
            },
          },
          localParams: {},
          getEarnAccount: jest.fn(async () => null),
        });
      });
    },
    getCurrentRoute: () => ref.getCurrentRoute(),
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
