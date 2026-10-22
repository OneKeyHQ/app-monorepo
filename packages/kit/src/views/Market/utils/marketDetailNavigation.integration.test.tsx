/** @jest-environment jsdom */

import { Fragment } from 'react';
import type { PropsWithChildren } from 'react';

import {
  BaseNavigationContainer,
  createNavigationContainerRef,
  createNavigatorFactory,
  useNavigationBuilder,
} from '@react-navigation/core';
import { StackRouter } from '@react-navigation/routers';
import { act, render } from '@testing-library/react';

import { ERootRoutes, ETabMarketRoutes } from '@onekeyhq/shared/src/routes';

import { openOrReplaceMarketDetailRoute } from './marketDetailNavigation';

import type { ParamListBase } from '@react-navigation/core';

const mockNavigationRef = createNavigationContainerRef<ParamListBase>();

jest.mock('@onekeyhq/components', () => ({
  get rootNavigationRef() {
    return mockNavigationRef;
  },
}));

jest.mock('@react-navigation/native', () =>
  jest.requireActual<typeof import('@react-navigation/routers')>(
    '@react-navigation/routers',
  ),
);

function TestStackNavigator({ children }: PropsWithChildren) {
  const { state, descriptors, NavigationContent } = useNavigationBuilder(
    StackRouter,
    { children },
  );
  return (
    <NavigationContent>
      {state.routes.map((route) => (
        <Fragment key={route.key}>{descriptors[route.key].render()}</Fragment>
      ))}
    </NavigationContent>
  );
}

const Stack = createNavigatorFactory(TestStackNavigator)();
const EmptyScreen = () => null;

function MarketStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name={ETabMarketRoutes.MarketDetailV2}
        component={EmptyScreen}
        initialParams={{ tokenAddress: 'old-token', network: 'sol' }}
      />
    </Stack.Navigator>
  );
}

it('updates the nested detail while its selector overlay is focused', () => {
  const onUnhandledAction = jest.fn();
  render(
    <BaseNavigationContainer
      ref={mockNavigationRef}
      onUnhandledAction={onUnhandledAction}
    >
      <Stack.Navigator>
        <Stack.Screen name={ERootRoutes.Main} component={MarketStack} />
        <Stack.Screen name={ERootRoutes.Modal} component={EmptyScreen} />
      </Stack.Navigator>
    </BaseNavigationContainer>,
  );

  act(() => mockNavigationRef.navigate(ERootRoutes.Modal));
  expect(mockNavigationRef.getCurrentRoute()?.name).toBe(ERootRoutes.Modal);
  const previousStack = mockNavigationRef
    .getRootState()
    .routes.find((route) => route.name === ERootRoutes.Main)?.state;
  const previousRouteKey = previousStack?.routes?.[0].key;

  act(() => {
    expect(
      openOrReplaceMarketDetailRoute({
        routeName: ETabMarketRoutes.MarketDetailV2,
        params: { tokenAddress: 'next-token', network: 'sol' },
      }),
    ).toBe(true);
  });

  expect(onUnhandledAction).not.toHaveBeenCalled();
  const nextStack = mockNavigationRef
    .getRootState()
    .routes.find((route) => route.name === ERootRoutes.Main)?.state;
  expect(nextStack?.key).toBe(previousStack?.key);
  expect(nextStack?.routes).toHaveLength(1);
  expect(nextStack?.routes?.[0]).toMatchObject({
    key: previousRouteKey,
    params: { tokenAddress: 'next-token', network: 'sol' },
  });
  expect(mockNavigationRef.getCurrentRoute()?.name).toBe(ERootRoutes.Modal);
});
