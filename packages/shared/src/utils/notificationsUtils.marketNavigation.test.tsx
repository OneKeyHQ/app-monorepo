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

function MainTabsScreen() {
  return (
    <MainTabs.Navigator>
      <MainTabs.Screen name={ETabRoutes.Home} component={EmptyScreen} />
      <MainTabs.Screen name={ETabRoutes.Market} component={MarketStackScreen} />
      <MainTabs.Screen
        name={ETabRoutes.Discovery}
        component={DiscoveryStackScreen}
      />
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

describe('navigateToNotificationDetailByLocalParams (legacy Market home through real navigators)', () => {
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
});
