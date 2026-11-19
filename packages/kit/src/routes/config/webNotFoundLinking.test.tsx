/** @jest-environment jsdom */

import assert from 'node:assert/strict';

import { useRouterConfig } from '.';

import { StackRouter } from '@react-navigation/core';
import { renderHook } from '@testing-library/react';

import { ERootRoutes } from '@onekeyhq/shared/src/routes';

import {
  WEB_ROUTE_RECOVERED_EVENT,
  clearWebRouteNotFoundState,
} from './webDappUrlFallback';

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isWeb: true, isWebDappMode: true, isDev: false },
}));
jest.mock('@onekeyhq/shared/src/lazyLoad', () => ({
  __esModule: true,
  default: () => () => null,
}));
jest.mock('@onekeyhq/components', () => ({
  useRouterEventsRef: () => ({ current: [] }),
}));
jest.mock('@onekeyhq/shared/src/logger/logger', () => ({}));
jest.mock('@onekeyhq/shared/src/performance/init', () => ({
  debugLandingLog: jest.fn(),
}));
jest.mock('expo-linking', () => ({ createURL: () => '/' }));
jest.mock('react-intl', () => ({ useIntl: () => ({}) }));
jest.mock('../../hooks/usePerpTabConfig', () => ({
  usePerpTabConfig: () => ({ perpDisabled: false }),
}));
jest.mock('../LazyRootNavigators', () => ({}));
jest.mock('../routerPathConfig', () => ({}));
jest.mock('../Tab/Navigator', () => ({ TabNavigator: () => null }));
jest.mock('../Tab/router', () => ({
  useTabRouterConfig: () => [
    { name: 'Market', rewrite: '/market', exact: true },
  ],
}));
jest.mock('../withOverlayPageHost', () => ({
  withOverlayPageHost: () => () => null,
}));
jest.mock('./deeplink', () => ({ registerDeepLinking: jest.fn() }));
jest.mock('./loggerUtmParams', () => ({
  captureAndReportLoggerUtmParamsFromUrl: jest.fn(),
}));

it('keeps a production Web deep link through root stack rehydration and URL sync', () => {
  const unmatchedPath = '/new-campaign-v680?utm_source=email&campaign_id=20';
  const dispatch = jest.spyOn(globalThis, 'dispatchEvent');
  globalThis.history.replaceState(null, '', unmatchedPath);

  try {
    const { result } = renderHook(() => useRouterConfig());
    const { containerProps, routerConfig } = result.current;
    const { linking } = containerProps;
    assert.ok(linking?.getStateFromPath && linking.getPathFromState);
    const parsed = linking.getStateFromPath(unmatchedPath, linking.config);
    assert.ok(parsed);

    const stack = StackRouter({ initialRouteName: ERootRoutes.Main });
    const rehydrated = stack.getRehydratedState(
      { index: parsed.index, routes: parsed.routes },
      {
        routeNames: routerConfig.map(({ name }) => name),
        routeParamList: {},
        routeGetIdList: {},
      },
    );
    expect(rehydrated.routes[rehydrated.index].name).toBe(ERootRoutes.NotFound);
    expect(linking.getPathFromState(rehydrated, linking.config)).toBe(
      unmatchedPath,
    );
    const recoveredEvent = expect.objectContaining({
      type: WEB_ROUTE_RECOVERED_EVENT,
    });
    expect(dispatch).not.toHaveBeenCalledWith(recoveredEvent);

    const market = linking.getStateFromPath('/market', linking.config);
    assert.ok(market);
    expect(linking.getPathFromState(market, linking.config)).toBe('/market');
    expect(dispatch).toHaveBeenCalledWith(recoveredEvent);
  } finally {
    jest.restoreAllMocks();
    clearWebRouteNotFoundState();
    globalThis.history.replaceState(null, '', '/');
  }
});
